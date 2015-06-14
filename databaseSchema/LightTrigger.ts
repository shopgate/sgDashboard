///<reference path='../typings/mongoose/mongoose.d.ts' />
///<reference path='../typings/winston/winston.d.ts' />
///<reference path='../typings/es6-promise/es6-promise.d.ts' />

import mongoose = require("mongoose");
import winston = require("winston");
import es6Promise = require('es6-promise');


var LightTriggerSchema = new mongoose.Schema({

	title: String,
	dataSource: {
		sourceSystem: {type: String, required: true, enum: ['jira', 'zendesk', 'google-docs', 'api-trigger', 'inopla', 'google']},
		type: {type: String},
		queries: mongoose.Schema.Types.Mixed
	},
	triggerType: {type: String, enum: ['newValue', 'compare', '']},
	lightStatus: {
		state: {type: String, required: true, enum: ['alert', 'colorChange']},
		positive: {
			active: Boolean,
			color: String,
			limit: Number
		},
		warning: {
			active: Boolean,
			color: String,
			limit: Number
		},
		negative: {
			active: Boolean,
			color: String,
			limit: Number
		},
		brightness: Number
	},
	lights: [{
		location: String,
		id: Number
	}]

});

//add a function to using Promises
LightTriggerSchema.static('findWithPromise', function (conditions:Object) {
	var _this = this;
	return new Promise(function (resolved, rejected) {
		_this.find(conditions, function (err, data) {
			if (err) {
				rejected(err);
				return;
			}
			resolved(data);
		})
	})
})


export interface ILightTrigger extends mongoose.Document {
	_id: string;
	title?: string;
	lightStatus : {
		state:string;
		positive:{
			active: boolean;
			color: string;
			limit: number;
		};
		warning:{
			active: boolean;
			color: string;
			limit: number;
		};
		negative:{
			active: boolean;
			color: string;
			limit: number;
		};
		brightness:number;
	};
	lights : [{
		location: string;
		id : number;
	}];
	dataSource: {
		sourceSystem:string;
		type:string;
		queries:any;
	};
	triggerType: string;
}


// Model interface
export interface ILightTriggerModel extends mongoose.Model<ILightTrigger> {
	findWithPromise(conditions:Object): Promise<any>;
}


export var LightTriggerModel = <ILightTriggerModel> mongoose.model<ILightTrigger>('LightTrigger', LightTriggerSchema);