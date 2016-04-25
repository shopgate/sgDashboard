/// <reference path='../../../typings/tsd.d.ts' />
import cron = require('cron');
import fs = require('fs');
import _ = require('underscore');
import redisClient = require('../../redisClient');
import request = require('request');
import winston = require('winston');
import async = require('async');
import Promise = require('bluebird');


import websocketHandler = require('../../WebsocketHandler');
import lightHandler = require('../../LightHandler');
import LightState = require('../../Objects/LightState');
import Location = require('../../Objects/Location');
import DashboardSchema = require('../../../databaseSchema/Dashboard');
var Dashboard = DashboardSchema.DashboardModel;
import WidgetSchema = require('../../../databaseSchema/Widget');
import LightTriggerSchema = require('../../../databaseSchema/LightTrigger');
var LightTrigger = LightTriggerSchema.LightTriggerModel;


interface Source {
	_sendToDashboards(results):Promise<any>;
	_sendLightStatesToLight(lights:Array<LightState.LightState>):Promise<any>;
	_doCompare(sourceQuery:string, destinationQuery:string):Promise<any>;
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]):Promise<any>;
}

export class AbstractSource implements Source {

	currentIteration:number;
	hueLights:Object = {};

	constructor() {
		this.currentIteration = 0;
	}

	/**
	 * Returns the cachekey for the given query and the iteration
	 * @param query
	 * @returns {string}
	 * @private
	 */
	_getCacheKey(query:string, iteration:number) {
		var compressedQuery = query.replace(' ', '');
		return compressedQuery + iteration;
	}

	/**
	 * Send the given results to the Dashboard
	 * @param results
	 * @returns {any}
	 * @private
	 */
	_sendToDashboards(results) {
		return new Promise(function (resolved, reject) {

			var dashboardIds = _.keys(results);

			//if no result is given
			if (dashboardIds.length == 0) {
				resolved();
				return;
			}
			Dashboard.findWithPromise({_id: {$in: dashboardIds}})
				.then(function (dashboards:DashboardSchema.IDashboard[]) {

					//iterate though all dashboards
					_.each(dashboards, function (dashboard:DashboardSchema.IDashboard) {
						if (!results[dashboard._id]) {
							return;
						}

						_.each(results[dashboard._id], function (value, key:string) {
							websocketHandler.sendToNamespace(dashboard.key, key, value);
						});

					})
					resolved(results);

				})
				.catch(function (err) {
					reject(err);
				})
		})
	}

	/**
	 * Send the given light commands to the connected gateways
	 * @param lightStates
	 * @returns {any}
	 * @private
	 */
	_sendLightStatesToLight(lightStates:LightState.LightState[]) {
		return lightHandler.sendMultipleLightStateToLights(lightStates);
	}

	/**
	 * This function should be overwritten by the source
	 * @param sourceQuery
	 * @param destinationQuery
	 * @returns {any}
	 * @private
	 */
	_doCompare(sourceQuery:string, destinationQuery:string) {
		return new Promise(function (resolved, rejected) {
			rejected(new Error("_doCompare is not implemented"));
		})
	}

	/**
	 * This function should be overwritten by the source
	 * @param sourceQuery
	 * @param destinationQuery
	 * @returns {any}
	 * @private
	 */
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]) {
		return new Promise(function (resolved, rejected) {
			rejected(new Error("_iterateThroughWidgets is not implemented"));
		})
	}

	/**
	 * This function should be overwritten by the source
	 * @param sourceQuery
	 * @param destinationQuery
	 * @returns {any}
	 * @private
	 */
	_checkForNewValues(query:string) {
		return new Promise(function (resolved, rejected) {
			rejected(new Error("_checkForNewValues is not implemented"));
		})
	}

	/**
	 * check for light trigger of the given source system
	 * This function implements the default feature like:
	 * -Compare of values
	 * -Check for new values
	 */
	checkForLightTrigger(sourceSystem:string) {

		var _this = this;
		return LightTrigger.findWithPromise({'dataSource.sourceSystem': sourceSystem})
			.then(function (lightTriggers:LightTriggerSchema.ILightTrigger[]) {
				var lights:LightState.LightState[] = [];

				return new Promise(function (resolved, rejected) {
					async.eachLimit(lightTriggers, 5, function (lightTrigger:LightTriggerSchema.ILightTrigger, callback) {

						//comparing the ticket counts
						if (lightTrigger.triggerType == "compare") {
							//call the source compare function
							_this._doCompare(lightTrigger.dataSource.queries.sourceQuery, lightTrigger.dataSource.queries.destinationQuery)
								.then(function (difference:number) {
									var color = <LightState.LightColor> parseInt(_this.getLightStatusForValue(lightTrigger, difference));
									var newLightStates = lightHandler.createLightStates(color, lightTrigger);
									lights = lights.concat(newLightStates);
									callback();
								})
								.catch(function (err) {
									callback(err);
								})
						}

						//check if Ticket have new values
						if (lightTrigger.triggerType == "newValue") {
							_this._checkForNewValues.call(_this, lightTrigger.dataSource.queries.sourceQuery)
								.then(function (alert) {

									//if no alert is trigger continue
									if (!alert) {
										callback();
										return;
									}

									var color = <LightState.LightColor> parseInt(lightTrigger.lightStatus.warning.color);
									var newLightStates = lightHandler.createLightStates(color, lightTrigger);
									lights = lights.concat(newLightStates);

									callback();
								})
								.catch(function (err) {
									callback(err);
								})
						}

					}, function (err:Error) {
						if (err) {
							rejected(err);
							return;
						}

						resolved(lights)
					});
				})
			})
			.then(function (lights) {
				return _this._sendLightStatesToLight.call(_this, lights);
			})

	}

	/**
	 * Get the light string to the given difference
	 *
	 * @param lightTrigger
	 * @param value
	 * @returns {string}
	 */
	getLightStatusForValue(lightTrigger:LightTriggerSchema.ILightTrigger, value:number) {

		//if difference is equal or lower the negative limit
		if (value <= lightTrigger.lightStatus.negative.limit && lightTrigger.lightStatus.negative.active) {
			return lightTrigger.lightStatus.negative.color;
		}

		//if difference is equal or lower the WARNING limit
		if (value <= lightTrigger.lightStatus.warning.limit && lightTrigger.lightStatus.negative.active) {
			return lightTrigger.lightStatus.warning.color;
		}

		return lightTrigger.lightStatus.positive.color;


	}


}
