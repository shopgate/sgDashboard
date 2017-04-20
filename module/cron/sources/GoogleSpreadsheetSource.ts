/// <reference path='../../../typings/tsd.d.ts' />
import fs = require('fs');
import winston = require('winston');
import _ = require('underscore');
import async = require('async');
import google = require("googleapis");
import GoogleSpreadsheets = require("google-spreadsheets");
import Promise = require('bluebird');
import AbstractSource = require('./AbstractSource');
import lightHandler = require('../../LightHandler');
import WidgetSchema = require('../../../databaseSchema/Widget');
import LightTriggerSchema = require('../../../databaseSchema/LightTrigger');
import LightState = require('../../Objects/LightState');
import redisClient = require('../../redisClient');
import config = require('config');

let debug = require('debug')('sgDashboard:module:cron:google-spreadsheet');


var Widget = WidgetSchema.WidgetModel;
var LightTrigger = LightTriggerSchema.LightTriggerModel;



/******** Interfaces ********/

interface CellPosition {
	row:number;
	col:number;
}

interface GoogleOAuthSetting {
	clientId : string;
	clientSecret :string;
	redirectUrl :string;
}

/******** Settings ********/

var oAuthSettings:GoogleOAuthSetting = {
	clientId: <string> config.get('googleOauth.clientId'),
	clientSecret: <string> config.get('googleOauth.clientSecret'),
	redirectUrl: "http://localhost:8080/auth/googleCallback"
};

/******** Class ***********/


class GoogleSpreadsheetSource extends AbstractSource.AbstractSource {

	private oAuthClient;
	/**
	 * The internal cache for the spreadsheets
	 */
	private internalCache;

	constructor() {
		super();
		this.internalCache = {};
		this.oAuthClient = new google.auth.OAuth2(oAuthSettings.clientId, oAuthSettings.clientSecret, oAuthSettings.redirectUrl);
		this.oAuthClient.setCredentials({
			access_token: "",
			refresh_token: <string> config.get('googleOauth.apiUserRefreshToken')
		});

		this.oAuthClient.refreshAccessToken(function () {
			debug("Refreshed access token");
		})

	}

	/**
	 * Retrieve the spreadsheet with the given id from Google
	 * The function is caching the spreadsheet in the local variable "internalCache"
	 * @param spreadsheetId
	 * @returns {any}
	 */
	private getSpreadSheet(spreadsheetId:string) {

		return new Promise((resolved, rejected) => {

			if (!spreadsheetId) {
				rejected(new Error("No spreadsheetId given"));
				return;
			}

			//try to get the spreadsheet from the internal cache
			if (this.internalCache[spreadsheetId]) {
				debug("Get it from internal cache");
				resolved(this.internalCache[spreadsheetId]);
				return;
			}

			//spreadsheet not found --> get it
			GoogleSpreadsheets({
				key: spreadsheetId,
				auth: this.oAuthClient
			}, (err, spreadsheet) => {
				if (err) {
					rejected(new Error('Error while getting spreadsheet: ' + spreadsheetId + '\nError: ' + err.message));
					return;
				}
				//add it to the internal cache
				this.internalCache[spreadsheetId] = spreadsheet;
				resolved(spreadsheet);

			})

		});
	}

	/**
	 * This function get the value of the given cell.
	 * The position parameter need the A1 notation like "exampleSheet!A1"
	 *
	 * @param spreadsheetId id of the Spreadsheet
	 * @param position position of the cell
	 * @returns {any|Promise<U>}
	 */
	getValueFromCell(spreadsheetId:string, position:string) {
		var worksheetName = null;
		var cellPositionInSheet:CellPosition = null;
		return new Promise((resolved, rejected) => {

			var splittetA1Notation = position.replace("\"", "").split("!");
			if (splittetA1Notation.length != 2) {
				rejected(new Error("The cell position is not correct!"));
				return;
			}

			worksheetName = splittetA1Notation[0];
			cellPositionInSheet = this.cellA1ToIndex.call(this, splittetA1Notation[1]);
			resolved();
		})
			.then(() => {
				return this.getSpreadSheet.call(this, spreadsheetId);
			})
			.then(function (spreadsheet:any) {
				return new Promise(function (resolved, rejected) {

					//find the matching worksheet
					var worksheet:any = _.findWhere(spreadsheet.worksheets, {title: worksheetName});
					if (!worksheet) {
						rejected(new Error("No spreadsheet found with title: " + worksheetName));
						return;
					}

					//get all cells of the worksheet to cache it for later use
					worksheet.cells({}, function (err, result) {

						if (err) {
							rejected(err);
							return;
						}

						if (!result.cells) {
							debug("No cells in document found!");
							resolved("");
							return;
						}

						//check if we have values for the given cell
						if (!result.cells[cellPositionInSheet.row] || !result.cells[cellPositionInSheet.row][cellPositionInSheet.col]) {
							debug("No value for postition " + position + " found");
							resolved("");
							return;
						}

						resolved(result.cells[cellPositionInSheet.row][cellPositionInSheet.col].value);

					});
				})
			});


	}

	/**
	 * This function iterate through the given widgets and retrieve the information
	 * @param widgets
	 * @returns {any}
	 * @private
	 */
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]) {
		return new Promise((resolved, rejected) => {

			var results = {};
			async.eachLimit(widgets, 5, (widget:WidgetSchema.IWidget, callback) => {

				if (!widget.query.spreedsheetId) {
					callback(new Error("No spreedsheet id found"));
				}

				this.getValueFromCell(widget.query.spreedsheetId, widget.query.cell)
					.then(function (value) {

						if (!results[widget.board]) {
							results[widget.board] = {};
						}

						results[widget.board][widget.key] = {
							source: widget.source,
							type: widget.type,
							value: value
						};
						callback();

					}).catch(function (err:NodeJS.ErrnoException) {
						winston.error(err.message, {
							spreedsheetId: widget.query.spreedsheetId,
							cell: widget.query.cell
						});
						callback();
					});

			}, function (err:Error) {
				resolved(results);
			});

		})
	}

	/**
	 * Map the given char to a color
	 * For example G => Green
	 *
	 * If no color was found the function return null
	 *
	 * @param char
	 * @returns {*}
	 * @private
	 */
	private _mapCharToColor(char:string) {
		switch (char.toUpperCase()) {
			case "R":
				return LightState.LightColor.RED;
			case "O":
				return LightState.LightColor.ORANGE;
			case "G":
				return LightState.LightColor.GREEN;
			case "B":
				return LightState.LightColor.BLUE;
			default :
				return null;
		}
	}

	/**
	 * This function get the lighttrigger which match to the google spreadsheet
	 * It gets the value from the given cell and map it to the color.
	 * Its return the prepared light states in an array, mapped to the location and light
	 *
	 * @param lightTriggers
	 * @returns {any}
	 * @private
	 */
	private _executeLightTrigger(lightTriggers) {
		var lights:LightState.LightState[] = [];
		return new Promise((resolved, rejected) => {

			//run 5 request parallel
			async.eachLimit(lightTriggers, 5, (lightTrigger:LightTriggerSchema.ILightTrigger, callback) => {

				//get the value from the given spreedsheet and the given cell
				this.getValueFromCell(lightTrigger.dataSource.queries.spreedsheetId, lightTrigger.dataSource.queries.cell)
					.then(function (value:string) {

						var color:LightState.LightColor = null;
						if (value != "") {
							color = this._mapCharToColor(value);

							if (color === null) {
								callback(new Error("No color found for " + value));
								return;
							}
						}

						var newLightStates = lightHandler.createLightStates(color, lightTrigger);
						lights = lights.concat(newLightStates);
						callback();
					}).catch(function (err) {
						callback(err);
					})


			}, function (err:Error) {
				if (err) {
					rejected(err);
					return;
				}
				resolved(lights);
			})
		});
	}

	/**
	 * Checks if a lighttrigger is availible for the google spreadsheet
	 * and execute it
	 *
	 * @param sourceSystem
	 * @returns {any}
	 * @private
	 */
	checkForLightTrigger(sourceSystem:string) {
		return LightTrigger.findWithPromise({'dataSource.sourceSystem': sourceSystem})
			.then((lightTriggers:LightTriggerSchema.ILightTrigger[]) => {
				return this._executeLightTrigger.call(this, lightTriggers);
			})


	}

	/**
	 * Parse a A1 string and convert it to a CellPosition Object
	 * @param cellA1
	 * @returns {{row: number, col: number}}
	 */
	private cellA1ToIndex(cellA1:string) {
		var match = cellA1.match(/^\$?([A-Z]+)\$?(\d+)$/);

		if (!match) {
			throw new Error("Invalid cell reference");
		}

		var position:CellPosition = {
			row: this.rowA1ToIndex(match[2]),
			col: this.colA1ToIndex(match[1])
		};

		return position;
	}

	/**
	 * Convert a column from A1 format to an index
	 * For example: A => 1
	 * @param colA1
	 * @returns {number}
	 */
	private colA1ToIndex(colA1) {
		var i, l, chr,
			sum = 0,
			A = "A".charCodeAt(0),
			radix = "Z".charCodeAt(0) - A + 1;

		if (typeof colA1 !== 'string' || !/^[A-Z]+$/.test(colA1)) {
			throw new Error("Expected column label");
		}

		for (i = 0, l = colA1.length; i < l; i++) {
			chr = colA1.charCodeAt(i);
			sum = sum * radix + chr - A + 1
		}

		return sum;
	}

	/**
	 * Convert a row in A1 format to an index
	 *
	 * @param rowA1
	 * @returns {number}
	 */
	private rowA1ToIndex(rowA1) {
		var index = parseInt(rowA1, 10)
		if (isNaN(index)) {
			throw new Error("Expected row number");
		}
		return index;
	}

	execute() {

		debug("Run google spreadsheet");
		this.currentIteration++;
		this.internalCache = {};
		Widget.findWithPromise({source: 'google', type: 'spreadsheet_value'})
			.then((widgets:WidgetSchema.IWidget[]) => {
				return this._iterateThroughWidgets(widgets);
			})
			.then(this._sendToDashboards)
			.then(() => {
				return this.checkForLightTrigger.call(this, 'google');
			})
			.then((lights) => {
				return this._sendLightStatesToLight.call(this, lights);
			})
			.catch(function (err) {
				winston.error(err);
			})

	}


}

export = GoogleSpreadsheetSource;