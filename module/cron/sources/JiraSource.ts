/// <reference path='../../../typings/tsd.d.ts' />
import fs = require('fs');
import winston = require('winston');
import async = require('async');
import _ = require('underscore');
import JiraConnector = require('jira-connector');
import DashboardSchema = require('../../../databaseSchema/Dashboard');
import WidgetSchema = require('../../../databaseSchema/Widget');
import websocketHandler = require('../../WebsocketHandler');
import redisClient = require('../../redisClient');
import request = require('request');
import Promise = require('bluebird');
import AbstractSource = require('./AbstractSource');
import config = require('config');

let debug = require('debug')('sgDashboard:module:cron:jira');

var Widget = WidgetSchema.WidgetModel;

var jira = new JiraConnector({
	host: <string> config.get('jira.host'),
	basic_auth: {
		username: <string> config.get('jira.user'),
		password: <string> config.get('jira.password')
	}
});


class JiraSource extends AbstractSource.AbstractSource {

	/**
	 * Itereate through the given widgets and get the zendesk information
	 * @param widgets
	 * @returns {any|Promise}
	 * @private
	 */
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]) {
		var _this = this;
		return new Promise(function (resolved, reject) {

			var results = {};
			async.eachLimit(widgets, 5, function (widget:WidgetSchema.IWidget, callback) {

				_this._getDataFromJQL(widget.query)
					.then(function (data:any) {
						if (!results[widget.board]) {
							results[widget.board] = {};
						}

						results[widget.board][widget.key] = {
							source: widget.source,
							type: widget.type,
							value: data.total
						};
						callback();
					})
					.catch(function(err:any) {
						winston.error('Error while executing JQL', {
							query: widget.query,
							message: err.errorMessages
						})
						callback();
					});

			}, function (err:Error) {
				debug("Finshed with async");

				if (err) {
					winston.error(err.message);
				}

				resolved(results);

			})
		})
	}

	/**
	 * Retrieve the data for the given JQL
	 * this function cache the data for the jql for the current iteration
	 *
	 * @param widgets
	 * @returns {any}
	 * @private
	 */
	private _getDataFromJQL(jql:string) {
		var _this = this;

		return new Promise(function (resolved, reject) {
			var cacheKey = _this._getCacheKey(jql, _this.currentIteration);

			redisClient.get(cacheKey, function (err, result) {

				if (result) {
					resolved(JSON.parse(result));
					return;
				}

				jira.search.search({
					jql: jql,
					fields: ["count"],
					maxResult: 1
				}, function (err, data) {
					if (err) {
						reject(err);
						return;
					}
					redisClient.set(cacheKey, JSON.stringify(data), function () {
						redisClient.expire(cacheKey, 45);
						resolved(data);
					})

				});

			});

		});
	}


	/**
	 * Get the worklog for the given teamNumber
	 * @param teamNumber
	 * @returns {any}
	 * @private
	 */
	private _getWorklog(teamNumber:number) {
		return new Promise(function (resolved, rejected) {

			var url = "https://" + config.get('jira.host') + "/rest/tempo-timesheets/3/timesheet-approval?teamId=" + teamNumber;
			var requestConfig = {
				'url': url,
				'auth': {
					'user': <string> config.get('jira.user'),
					'pass': <string> config.get('jira.password'),
					'sendImmediately': true
				}
			};
			request(requestConfig, function (err, response, body) {
				if (err) {
					rejected(err);
					return;
				}
				try {
					var json = JSON.parse(body);
					resolved(json);
				} catch (e) {
					rejected(e);
				}
			});
		})

	}

	/**
	 * Get the all worklogs for the given widgets
	 * @param widgets
	 * @returns {any}
	 * @private
	 */
	private _getAllWorklogs(widgets:WidgetSchema.IWidget[]) {
		var _this = this;
		var results = {};
		return new Promise(function (resolved, rejected) {

			async.each(widgets, function (widget:WidgetSchema.IWidget, callback) {

				var teamNumber = parseInt(widget.query);
				if (isNaN(teamNumber)) {
					callback(new Error("Teamnumber is not a number"));
					return;
				}

				_this._getWorklog(teamNumber)
					.then(function (data) {
						if (!results[widget.board]) {
							results[widget.board] = {};
						}

						results[widget.board][widget.key] = {
							source: widget.source,
							type: widget.type,
							value: data
						};
						callback();
					})
					.catch(function (err) {
						callback(err);
					});

			}, function (err) {

				if (err) {
					rejected(err);
					return;
				}

				resolved(results);

			});

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

				_this._getDataFromJQL.call(_this, query)
					.then(function (data:any) {
						countResult[query] = data.total;
						data = null;
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

	/**
	 * This function should be overritten by the Source
	 * @param sourceQuery
	 * @param destinationQuery
	 * @returns {any}
	 * @private
	 */
	_checkForNewValues(query:string) {

		var _this = this;
		return new Promise(function (resolved, rejected) {

			if (_this.currentIteration == 0) {
				resolved(false);
				return;
			}
			var cacheKey = _this._getCacheKey(query, _this.currentIteration - 1);
			redisClient.get(cacheKey, function (err, oldTicketsString) {

				if (err) {
					rejected(err);
					return;
				}

				_this._getDataFromJQL.call(_this, query)
					.then(function (currentTickets:any) {

						if (!oldTicketsString) {
							debug("No old tickets found for key " + cacheKey);
							resolved(false);
							return;
						}

						var oldTickets = JSON.parse(oldTicketsString);
						var oldTicketsIds = _.pluck(oldTickets.issues, 'id');
						var currentTicketsIds = _.pluck(currentTickets.issues, 'id');

						var newTicketIds = _.difference(currentTicketsIds, oldTicketsIds);
						var newTickets = newTicketIds.length > 0;

						if (newTickets) {
							winston.info("Found new Tickets for Query: " + query);
						}

						resolved(newTickets);

					})

			})


		})
	}


	execute() {

		this.currentIteration++;
		var _this = this;
		Widget.findWithPromise({source: 'jira', type: 'tickets_count'})
			.then(function (widgets:WidgetSchema.IWidget[]) {
				return _this._iterateThroughWidgets.call(_this, widgets);
			})
			.then(this._sendToDashboards)
			.then(function () {
				return _this.checkForLightTrigger.call(_this, 'jira');
			})
			.then(function () {
				return Widget.findWithPromise({source: 'jira', type: 'worklog'});
			})
			.then(function (data:WidgetSchema.IWidget[]) {
				return _this._getAllWorklogs.call(_this, data);
			})
			.then(this._sendToDashboards)
			.catch(function (err:Error) {
				winston.error(err.message);
				winston.error(err.name);
			})

	}


}

export = JiraSource;


