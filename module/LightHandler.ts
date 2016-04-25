/// <reference path='../typings/async/async.d.ts' />
import LightState = require('./Objects/LightState');
import async = require('async');
import _ = require('underscore');
import websocketHandler = require('./WebsocketHandler');
import LightTriggerSchema = require('../databaseSchema/LightTrigger');
import Promise = require('bluebird');

class LightHandler {
	private lights = {};

	/**
	 * Send one light state to the light over the gateways
	 * @param lightState
	 */
	sendLightStateToLights(lightState:LightState.LightState){
		websocketHandler.sendToBridgeGateway(lightState);
	}


	/**
	 * Send multiple lightstate to the lights over the gateways
	 * @param lightStates
	 * @returns {any}
	 */
	sendMultipleLightStateToLights(lightStates:LightState.LightState[]){
		var _this = this;
		return new Promise(function (resolved, rejected) {
			async.each(lightStates, function (lightState:LightState.LightState, callback) {
				//send to gateway
				_this.sendLightStateToLights(lightState);
				callback();
			}, function (err) {

				if (err) {
					rejected(err);
					return;
				}

				resolved();
			})

		})
	}

	/**
	 * Create a light state out of the information from the given information
	 *
	 * @param color
	 * @param lightTrigger
	 * @returns {any}
	 */
	createLightStates(color:LightState.LightColor, lightTrigger:LightTriggerSchema.ILightTrigger){

		var lightStates:LightState.LightState[] = [];

		var lightStatus:LightState.LightStatus = null;
		if (color === null) {
			lightStatus = LightState.LightStatus.OFF
		} else {
			if (lightTrigger.lightStatus.state == "alert") {
				lightStatus = LightState.LightStatus.BLINKING;
			}

			if (lightTrigger.lightStatus.state == "colorChange") {
				lightStatus = LightState.LightStatus.ON;
			}
		}


		var lightState:LightState.LightState = {
			location: null,
			lightId: 0,
			lightStatus: lightStatus,
			color: color,
			brightness: 80 //TODO: add possibility to change it
		};

		//add all information for a light into "lights" objects
		_.each(lightTrigger.lights, function (currentLight) {
			var lightStateClone = _.clone(lightState);
			lightStateClone.lightId = currentLight.id;
			lightStateClone.location = currentLight.location;
			lightStates.push(lightStateClone);
		});

		lightState = null;
		return lightStates;
	}

}

export = new LightHandler();