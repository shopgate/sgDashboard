/// <reference path='../typings/socket.io/socket.io.d.ts' />
/// <reference path='../typings/winston/winston.d.ts' />
/// <reference path='../typings/underscore/underscore.d.ts' />
import winston = require('winston');
import io = require('socket.io');
import _ = require('underscore');
import DashboardSchema = require('../databaseSchema/Dashboard');
import LightState = require('./Objects/LightState');
import Location = require('./Objects/Location');
let debug = require('debug')('sgDashboard:module:websocket-handler');
var Dashboard = DashboardSchema.DashboardModel;

interface MessageHistory {
	event:string;
	data:any;
}

class WebsocketHandler {

	private _io:SocketIO.Server;
	private _messageHistory;

	constructor() {
		this._messageHistory = {};
		this._io = io();
		var _this = this;

		//create the namespace for the huebridge at every location
		var locationValues = _.values(Location.values);
		_.each(locationValues, function (value) {
			_this._io.of("huebridge_" + value).on('connection', function () {
				debug("Connect from huebridge at " + value);
			});
		})

	}


	/**
	 * Init all namespaces and attach the given webserver to the websocket server
	 * @param srv
	 */
	attachServer(srv:any) {
		debug("Start to attach webserver to socket.io");
		var _this = this;
		Dashboard.findWithPromise({})
			.then(function (dashboards:DashboardSchema.IDashboard[]) {
				_.each(dashboards, function (dashboard) {

					//create the namespace and the message history
					//if a client connect the last ten message will send to it
					_this._messageHistory[dashboard.key] = [];
					_this._io.of(dashboard.key).on('connection', function (socket) {
						_.each(_this._messageHistory[dashboard.key], function (message:MessageHistory) {
							socket.emit(message.event, message.data);
						})
					});


				});
				debug("Attach webserver to socket.io");
				_this._io.attach(srv);
			})

	}

	/**
	 * Add the given message to the histroy
	 * Only the last 10 messages will be saved
	 * @param namespace
	 * @param event
	 * @param data
	 */
	private addMessageToHistory(namespace:string, event:string, data:any) {
		if (!this._messageHistory[namespace]) {
			this._messageHistory[namespace] = [];
		}

		//if the history is > 10 messages remove the last one
		if (this._messageHistory[namespace].length >= 10) {
			this._messageHistory[namespace].shift();
		}

		//add to message history
		this._messageHistory[namespace].push({
			event: event,
			data: data
		})
	}

	/**
	 * handle an incoming websocket connection
	 * @param socket
	 */
	handleConnect(socket:SocketIO.Socket) {
		debug("Websocket connected");
		var _this = this;

		if (this._messageHistory) {
			Object.keys(this._messageHistory).forEach(function (key) {
				socket.emit(key, _this._messageHistory[key]);
			})
		}

	}

	/**
	 * Broadcast the given message into the given namespace
	 * @param namespace
	 * @param event
	 * @param payload
	 */
	sendToNamespace(namespace:string, event:string, payload:any) {
		var nsp = this._io.of(namespace);
		nsp.emit(event, payload);
		if (event != "refresh") {
			this.addMessageToHistory(namespace, event, payload);
		}
	}

	/**
	 * Send the given light state to the hue bridge gateways
	 * @param lightState
	 */
	sendToBridgeGateway(lightState:LightState.LightState) {
		debug("sendToBridgeGateway: " + JSON.stringify(lightState));
		var nsp = this._io.of("huebridge_" + Location.values[lightState.location]);
		nsp.emit("change", lightState);

	}

	/**
	 * Broadcast a message to every Dashboard
	 * @param type
	 * @param payload
	 */
	broadcastMessage(event:string, payload:any) {
		debug("broadcastMessage: " + event);
		this._io.sockets.emit(event, payload);
	}

}


export = new WebsocketHandler();