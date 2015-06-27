/// <reference path='../../../typings/xml2js/xml2js.d.ts' />
/// <reference path='../../../typings/winston/winston.d.ts' />
/// <reference path='../../../typings/underscore/underscore.d.ts' />
/// <reference path='../../../typings/request/request.d.ts' />
/// <reference path='../../../typings/async/async.d.ts' />
/// <reference path='../../../typings/moment-timezone/moment-timezone.d.ts' />
import winston = require('winston');
import xml2js = require('xml2js');
import request = require('request');
import _ = require('underscore');
import async = require('async');
import moment = require('moment');
import momentTimezone = require('moment-timezone');
import AbstractSource = require('./AbstractSource');
import lightHandler = require('../../LightHandler');
import InoplaCall = require('../../Objects/InoplaCall');
import WidgetSchema = require('../../../databaseSchema/Widget');
import LightState = require('../../Objects/LightState');
import fs = require('fs');
var Widget = WidgetSchema.WidgetModel;
import LightTriggerSchema = require('../../../databaseSchema/LightTrigger');
var LightTrigger = LightTriggerSchema.LightTriggerModel;
import redisClient = require('../../redisClient');
var parseString = xml2js.parseString;


var data = fs.readFileSync('./config/config.json', 'UTF-8');
var config = JSON.parse(data);

var inoplaURL = "https://schnittstelle.inopla.de/cdr/cdr_in_out.php?id=" + config.inopla.id + "&psec=" + config.inopla.psec + "&last_calls=500";

class InoplaSource extends AbstractSource.AbstractSource {

	private skipCount:number = 0;
	private lastMinutes:number = 30;
	private calls:InoplaCall[];

	/**
	 * Filter all calls from the given array which began in the last given minutes
	 * The date formatter using the timezone Europe/Berlin because Inopla returns it only in this timezone
	 *
	 * @param calls
	 * @param minutes
	 * @returns {T[]}
	 */
	private filterCallsFromLastMinutes(calls:InoplaCall[], minutes:number) {
		var currentDate = moment();

		return _.filter(calls, function (call) {
			return (currentDate.unix() - momentTimezone.tz(call.dateTime, "DD.MM.YYYY HH:mm:ss", "Europe/Berlin").unix()) <= minutes * 60;
		});
	}

	/**
	 * Filter out all calls which was accepted and had on of the given destination extension
	 * The extenstion are comma sperated like "0,100"
	 *
	 * @param calls
	 * @param commaSeperatedExtenstions
	 * @returns {T[]}
	 */
	private filterAcceptCalls(calls:InoplaCall[], commaSeperatedExtenstions:string) {
		var extenstionStringArray = commaSeperatedExtenstions.split(',');
		var extenstionArray = [];
		_.each(extenstionStringArray, function (element) {
			extenstionArray.push(parseInt(element));
		})

		return _.filter(calls, function (call) {
			return _.contains(extenstionArray, call.ddi) && call.successfully == true
		});
	}

	/**
	 * Filter out all calls which was missed and had on of the given desination extension
	 * The extenstion are comma sperated like "0,100"
	 *
	 * @param calls
	 * @param commaSeperatedExtenstions
	 * @returns {T[]}
	 */
	private filterMissedCalls(calls:InoplaCall[], commaSeperatedExtenstions:string) {
		var extenstionStringArray = commaSeperatedExtenstions.split(',');
		var extenstionArray = [];
		_.each(extenstionStringArray, function (element) {
			extenstionArray.push(parseInt(element));
		})

		return _.filter(calls, function (call) {
			return _.contains(extenstionArray, call.ddi) && call.successfully == false
		});
	}

	/**
	 * Calc the reachability from the given calls.
	 * It will be filtered by the given extension list
	 * @param calls
	 * @param commaSeperatedExtenstions
	 * @returns {number}
	 */
	private calcReachability(calls:InoplaCall[], commaSeperatedExtenstions:string) {

		if (calls.length == 0) {
			return 100;
		}

		var acceptCallsCount = this.filterAcceptCalls(calls, commaSeperatedExtenstions).length;
		var missedCallsCount = this.filterMissedCalls(calls, commaSeperatedExtenstions).length;

		if (acceptCallsCount == 0 && missedCallsCount == 0) {
			return 100;
		}

		var reachability = (acceptCallsCount / (missedCallsCount + acceptCallsCount)) * 100;
		return Math.round(reachability);
	}

	/**
	 * This function iterate through the given widgets and retrieve the information
	 * @param widgets
	 * @returns {Promise|any}
	 * @private
	 */
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]) {

		var results = {};
		var _this = this;

		//get the calls from the last hour
		var calls = this.filterCallsFromLastMinutes(this.calls, _this.lastMinutes);

		return new Promise(function (resolved, rejected) {
			async.eachLimit(widgets, 5, function (widget:WidgetSchema.IWidget, callback) {

				var phoneExtenstion = widget.query;

				//init vars
				var count = 0;
				if (!results[widget.board]) {
					results[widget.board] = {};
				}

				//accept calls
				if (widget.type == "accept_calls") {
					var acceptedCalls = _this.filterAcceptCalls(calls, phoneExtenstion);
					count = acceptedCalls.length;
				}

				//missed calls
				if (widget.type == "missed_calls") {
					var missedCalls = _this.filterMissedCalls(calls, phoneExtenstion);
					count = missedCalls.length;
				}

				//missed calls
				if (widget.type == "reachability_percent") {
					count = _this.calcReachability.call(_this, calls, phoneExtenstion);
				}

				results[widget.board][widget.key] = {
					source: widget.source,
					type: widget.type,
					value: count
				};
				callback();
			}, function (err:Error) {
				if (err) {
					winston.error(err.message);
				}

				resolved(results);

			})


		})
	}

	/**
	 * This function get the call history from inopla
	 * and create an array with Objects of the Type "InoplaCalls"
	 * @returns {Promise|any}
	 */
	getLastCalls() {

		return new Promise(function (resolved, rejected) {

			winston.debug("Start request to " + inoplaURL);
			request(inoplaURL, function (err, response, body) {
				winston.debug("Get answer from inopla");
				if (err) {
					rejected(err);
					return;
				}

				parseString(body, function (err, result) {
					var inoplaCalls:Array<InoplaCall> = [];
					_.each(result['cdr_data']['cdr_in'], function (data) {
						var call:InoplaCall;
						call = {
							callId: data['db_id'][0],
							dateTime: data['date_time'][0],
							caller: data['caller'][0],
							service: data['service'][0],
							ddi: parseInt(data['ddi'][0]),
							durationIn: data['duration_in'][0],
							durationOut: data['duration_out'][0],
							successfully: (data['successfully'][0] == "1") ? true : false
						}
						inoplaCalls.push(call);

					});
					resolved(inoplaCalls);


				})
			});
		})
	}

	/**
	 * Check for light trigger for the reachability
	 * @param sourceSystem
	 * @returns {any}
	 */
	checkForLightTrigger(sourceSystem:string) {
		var _this = this;

		return LightTrigger.findWithPromise({'dataSource.sourceSystem': sourceSystem})
			.then(function (lightTriggers:LightTriggerSchema.ILightTrigger[]) {

				return new Promise(function (resolved, rejected) {
					var calls = _this.filterCallsFromLastMinutes(_this.calls, _this.lastMinutes);
					var lights:LightState.LightState[] = [];
					async.eachLimit(lightTriggers, 5, function (lightTrigger:LightTriggerSchema.ILightTrigger, callback) {
						var lightState:LightState.LightState;

						var reachabilityPercent = _this.calcReachability.call(_this, calls, lightTrigger.dataSource.queries.sourceQuery);
						var color = <LightState.LightColor> parseInt(_this.getLightStatusForValue(lightTrigger, reachabilityPercent));
						var newLightStates = lightHandler.createLightStates(color, lightTrigger);
						lights = lights.concat(newLightStates);
						callback();

					}, function (err:Error) {
						if (err) {
							rejected(err);
							return;
						}
						resolved(lights)
					})
				});
			})


	}

	execute() {
		this.skipCount++;

		//Execute the checks for inopla every 4th time to reduce the api traffic
		if (this.skipCount < 4) {
			winston.debug("Skip inopla " + this.skipCount);
			return;
		}

		this.skipCount = 0;
		winston.debug("Run inopla");
		var _this = this;
		this.calls = [];
		this.getLastCalls()
			.then(function (calls:InoplaCall[]) {
				_this.calls = calls;
				winston.debug("Find widgets");
				return Widget.findWithPromise({source: 'inopla'});
			})
			.then(function (widgets:WidgetSchema.IWidget[]) {
				return _this._iterateThroughWidgets.call(_this, widgets);
			})
			.then(_this._sendToDashboards)
			.then(function () {
				return _this.checkForLightTrigger.call(_this, 'inopla');
			})
			.then(function (lights) {
				return _this._sendLightStatesToLight.call(_this, lights);
			})
			.catch(function (err) {
				console.log(err);
			})

	}


}

export = InoplaSource;


