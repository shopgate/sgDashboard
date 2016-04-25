/// <reference path='../../../typings/tsd.d.ts' />
import winston = require('winston');
import fs = require('fs');
import async = require('async');
import nodeZendesk = require('node-zendesk');
import moment = require('moment');
import _ = require('underscore');

import AbstractSource = require('./AbstractSource');
import redisClient = require('../../redisClient');
import config = require('config');
import LightState = require('../../Objects/LightState');
import WidgetSchema = require('../../../databaseSchema/Widget');
import LightTriggerSchema = require('../../../databaseSchema/LightTrigger');
var Widget = WidgetSchema.WidgetModel;

var zendeskClient = nodeZendesk.createClient(<nodeZendesk.ZendeskConfig> config.get('zendesk'));

class ZendeskSource extends AbstractSource.AbstractSource {


	/**
	 * Itereate through the given widgets and get the zendesk information
	 * @param widgets
	 * @returns {any|Promise}
	 * @private
	 */
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]) {

		var _this = this;
		var results = {};
		return new Promise(function (resolved, reject) {

			var results = {};
			async.eachLimit(widgets, 5, function (widget:WidgetSchema.IWidget, callback) {

				_this._getDataFromZendesk.call(_this, widget.query)
					.then(function (zendeskResult) {

						if (!results[widget.board]) {
							results[widget.board] = {};
						}
						results[widget.board][widget.key] = {
							source: widget.source,
							type: widget.type,
							value: zendeskResult.count
						};

						callback();
					})
					.catch(function (err) {
						callback(err);
					})

			}, function (err:Error) {
				if (err) {
					winston.error(err.message);
				}

				resolved(results);

			})
		})


	}

	/**
	 * Pre format the query for zendesk
	 * @param query
	 * @returns {string}
	 * @private
	 */
	private _preformatQuery(query:string) {
		if (query.indexOf("{now}") != -1) {
			query = query.replace("{now}", moment().format('YYYY-MM-DD'));
		}

		if (query.indexOf("{startOf:week}") != -1) {
			query = query.replace("{startOf:week}", moment().startOf('week').format('YYYY-MM-DD'));
		}

		if (query.indexOf("{startOf:month}") != -1) {
			query = query.replace("{startOf:month}", moment().startOf('month').format('YYYY-MM-DD'));
		}

		return query;

	}

	/**
	 * Get the data from zendesk with the given query
	 * @param query
	 * @returns {any|Promise}
	 * @private
	 */
	private _getDataFromZendesk(query:string) {

		var _this = this;
		return new Promise(function (resolved, rejected) {
			query = _this._preformatQuery(query);

			var compressedQuery = query.replace(' ', '');
			var cacheKey = compressedQuery + _this.currentIteration;

			redisClient.get(cacheKey, function (err, result) {

				if (result) {
					resolved(JSON.parse(result));
					return;
				}

				//data not found in cache --> get it from zendesk
				zendeskClient.search.query(query, function (err, statusCode, data, responseList, resultList) {

					if (err) {
						rejected(err);
						return;
					}

					if (statusCode < 200 && statusCode > 299) {
						rejected(new Error("Wrong errorcode :" + statusCode));
						return;
					}

					if (!resultList) {
						rejected(new Error("Result list is empty: " + statusCode + " " + data));
						return;
					}


					//write result to redis for a possible reuse
					redisClient.set(cacheKey, JSON.stringify(resultList), function () {

						//expire in 2 mins. Its just for the current cycle to prevent duplicated request
						redisClient.expire(cacheKey, 2 * 60);
						resolved(resultList);

					});
				})


			})

		});
	}


	/**
	 * Do a compare of the count of two queries
	 *
	 * It returns true if the destination query is greater or equal than the source query
	 *
	 * @param sourceQuery
	 * @param destinationQuery
	 * @returns {*}
	 * @private
	 */
	_doCompare(sourceQuery, destinationQuery) {

		var _this = this;
		var countResult = {};

		return new Promise(function (resolved, rejected) {
			async.each([sourceQuery, destinationQuery], function (query:string, callback) {

				_this._getDataFromZendesk.call(_this, query)
					.then(function (zendeskResult:any) {
						countResult[query] = zendeskResult.count;
						zendeskResult = null;
						callback();
					})
					.catch(function (err) {
						callback(err);
					})

			}, function (err) {

				if (err) {
					rejected(err);
					return;
				}

				var difference = countResult[destinationQuery] - countResult[sourceQuery];
				resolved(difference);

			});
		})

	}


	execute() {

		this.currentIteration++;

		var _this = this;
		return Widget.findWithPromise({source: 'zendesk', type: 'tickets_count'})
			.then(function (widgets:WidgetSchema.IWidget[]) {
				return _this._iterateThroughWidgets.call(_this, widgets);
			})
			.then(_this._sendToDashboards)
			.then(function () {
				return _this.checkForLightTrigger.call(_this, 'zendesk');
			})
			.catch(function (err) {
				winston.error(err.message);
			});

	}

}

export = ZendeskSource;
