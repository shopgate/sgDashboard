///<reference path='../typings/express/express.d.ts' />
///<reference path='../typings/winston/winston.d.ts' />
///<reference path='../typings/underscore/underscore.d.ts' />
import express = require('express');
import winston = require("winston");
import _ = require("underscore");
import LightTriggerSchema = require('../databaseSchema/LightTrigger');
import lightHandler = require('../module/LightHandler');
import LightState = require('../module/Objects/LightState');
var LightTrigger = LightTriggerSchema.LightTriggerModel;
var router = express.Router();

//landing action for apitrigger
router.all('/:apikey', function (req, res, next) {

	LightTrigger.findWithPromise({"dataSource.queries.sourceQuery": req.params.apikey})
		.then(function (lightTrigger:LightTriggerSchema.ILightTrigger[]) {
			//check if lighttrigger was found for the given key
			if (!lightTrigger || !lightTrigger[0]) {
				res.statusCode = 404;
				res.end("Wrong apikey");
				return;
			}

			//create the light state out of the request
			var color = <LightState.LightColor> parseInt(lightTrigger[0].lightStatus.warning.color);
			var lightState = lightHandler.createLightStates(color, lightTrigger[0]);
			lightHandler.sendMultipleLightStateToLights(lightState)
				.then(function () {
					res.end("OK");
				})
				.catch(function (err) {
					next(err);
				})

		})
		.catch(function (err) {
			next(err);
		})

});


module.exports = router;
