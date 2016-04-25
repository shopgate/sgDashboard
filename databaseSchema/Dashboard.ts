///<reference path='../typings/tsd.d.ts' />
import mongoose = require("mongoose");
import winston = require("winston");
import Promise = require('bluebird');


var DashboardSchema = new mongoose.Schema({
	key: {type: String, required: true, index: true},
	name: {type: String, required: true, unique: true},
	location: {type: String, required: true},
	nextPageInterval: {type: Number, required: true}
});

//add a function to using Promises
DashboardSchema.static('findWithPromise', function (conditions:Object) {
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
});


export interface IDashboard extends mongoose.Document {
	_id: string;
	key:string
	name: string;
	location: string;
	nextPageInterval:number;
}


// Model interface
export interface IDashboardModel extends mongoose.Model<IDashboard> {
	findWithPromise(conditions:Object): Promise<any>;
}


export var DashboardModel = <IDashboardModel> mongoose.model<IDashboard>('Dashboard', DashboardSchema);