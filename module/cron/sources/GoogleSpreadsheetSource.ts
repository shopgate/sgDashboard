/// <reference path='../../../typings/node/node.d.ts' />
/// <reference path='../../../typings/googleappis/googleapis.d.ts' />
/// <reference path='../../../typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../typings/google-spreadsheets/google-spreadsheets.d.ts' />
/// <reference path='../../../typings/underscore/underscore.d.ts' />
import fs = require('fs');
import winston = require('winston');
import _ = require('underscore');
import async = require('async');
import google = require("googleapis");
import GoogleSpreadsheets = require("google-spreadsheets");
import es6Promise = require('es6-promise');
import AbstractSource = require('./AbstractSource');
import WidgetSchema = require('../../../databaseSchema/Widget');
import LightTriggerSchema = require('../../../databaseSchema/LightTrigger');
import LightState = require('../../Objects/LightState');
import redisClient = require('../../redisClient');

var Promise = es6Promise.Promise;
var Widget = WidgetSchema.WidgetModel;
var LightTrigger = LightTriggerSchema.LightTriggerModel;


//get config
var jsonString = fs.readFileSync('./config/config.json', 'UTF-8');
var json = JSON.parse(jsonString);

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
	clientId: json.googleOauth.clientId,
	clientSecret: json.googleOauth.clientSecret,
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
		this.internalCache = {};
		this.oAuthClient = new google.auth.OAuth2(oAuthSettings.clientId, oAuthSettings.clientSecret, oAuthSettings.redirectUrl);
		this.oAuthClient.setCredentials({
			access_token: "",
			refresh_token: json.googleOauth.apiUserRefreshToken
		});

		this.oAuthClient.refreshAccessToken(function () {
			winston.debug("Refreshed access token");
		})
		super();
	}

	/**
	 * Retrieve the spreadsheet with the given id from Google
	 * The function is caching the spreadsheet in the local variable "internalCache"
	 * @param spreadsheetId
	 * @returns {any}
	 */
	private getSpreadSheet(spreadsheetId:string) {

		var _this = this;
		return new Promise(function (resolved, rejected) {

			if (!spreadsheetId) {
				rejected(new Error("No spreadsheetId given"));
				return;
			}

			//try to get the spreadsheet from the internal cache
			if (_this.internalCache[spreadsheetId]) {
				winston.debug("Get it from internal cache");
				resolved(_this.internalCache[spreadsheetId]);
				return;
			}

			//spreadsheet not found --> get it
			GoogleSpreadsheets({
				key: spreadsheetId,
				auth: _this.oAuthClient
			}, function (err, spreadsheet) {
				if (err) {
					rejected(err);
					return;
				}
				//add it to the internal cache
				_this.internalCache[spreadsheetId] = spreadsheet;
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

		var _this = this;
		var worksheetName = null;
		var cellPositionInSheet:CellPosition = null;
		return new Promise(function (resolved, rejected) {

			var splittetA1Notation = position.replace("\"", "").split("!");
			if (splittetA1Notation.length != 2) {
				rejected(new Error("The cell position is not correct!"));
				return;
			}

			worksheetName = splittetA1Notation[0];
			cellPositionInSheet = _this.cellA1ToIndex.call(_this, splittetA1Notation[1]);
			resolved();
		})
			.then(function () {
				console.log("getSpreadSheet");
				return _this.getSpreadSheet.call(_this, spreadsheetId);
			})
			.then(function (spreadsheet:any) {
				console.log("Get the spreadsheet");
				return new Promise(function (resolved, rejected) {

					//find the matching worksheet
					var worksheet:any = _.findWhere(spreadsheet.worksheets, {title: worksheetName});
					if (!worksheet) {
						rejected(new Error("No spreadsheet found with title: " + worksheetName));
						return;
					}

					//get all cells of the worksheet to cache it for later use
					worksheet.cells({}, function (err, result) {

						//check if we have values for the given cell
						if (!result.cells[cellPositionInSheet.row] || !result.cells[cellPositionInSheet.row][cellPositionInSheet.col]) {
							rejected(new Error("No value in the cell " + position + " found"));
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
		var _this = this;
		return new Promise(function (resolved, rejected) {

			var results = {};
			async.eachLimit(widgets, 5, function (widget:WidgetSchema.IWidget, callback) {

				if (!widget.query.spreedsheetId) {
					callback(new Error("No spreedsheet id found"));
				}

				_this.getValueFromCell(widget.query.spreedsheetId, widget.query.cell)
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

					}).catch(function (err:Error) {
						callback(err);
					});

			}, function (err:Error) {
				if (err) {
					winston.error(err.message);
				}
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
		var _this = this;
		var lights = {};
		return new Promise(function (resolved, rejected) {

			//run 5 request parallel
			async.eachLimit(lightTriggers, 5, function (lightTrigger:LightTriggerSchema.ILightTrigger, callback) {

				//get the value from the given spreedsheet and the given cell
				_this.getValueFromCell(lightTrigger.dataSource.queries.spreedsheetId, lightTrigger.dataSource.queries.cell)
					.then(function (value:string) {

						var color:LightState.LightColor = null;
						if(value != "")  {
							color = _this._mapCharToColor(value);

							if (color === null) {
								callback(new Error("No color found for " + value));
								return;
							}
						}

						lights = _this.createLightStates(color, lightTrigger, lights);
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
		var _this = this;

		return LightTrigger.findWithPromise({'dataSource.sourceSystem': sourceSystem})
			.then(function (lightTriggers:LightTriggerSchema.ILightTrigger[]) {
				return _this._executeLightTrigger.call(_this, lightTriggers);
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
		winston.debug("Run google spreadsheet");
		this.currentIteration++;
		this.internalCache = {};
		var _this = this;
		Widget.findWithPromise({source: 'google', type: 'spreadsheet_value'})
			.then(function (widgets:WidgetSchema.IWidget[]) {
				return _this._iterateThroughWidgets(widgets);
			})
			.then(this._sendToDashboards)
			.then(function () {
				return _this.checkForLightTrigger.call(_this, 'google');
			})
			.then(function (lights) {
				return _this._sendLightStatesToLight.call(_this, lights);
			})
			.catch(function (err) {
				winston.error(err);
			})

	}


}

export = GoogleSpreadsheetSource;