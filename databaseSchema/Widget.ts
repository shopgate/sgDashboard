///<reference path='../typings/tsd.d.ts' />
import mongoose = require("mongoose");
import winston = require("winston");


var WidgetSchema = new mongoose.Schema({
	key: {type: String, required: true, unique: true},
	title: {type: String, required: true},
	board: {type: String, required: true},
	source: {type: String, required: true, enum: ['jira', 'zendesk', 'google-docs', 'web', 'inopla', 'google', 'stash', 'general']},
	type: {type: String, required: true},
	query: {type: mongoose.Schema.Types.Mixed, required: true},
	position: {
		column: {type: Number, required: true},
		column_index: {type: Number, required: true},
		row: {type: Number, required: true},
		page: {type: Number, required: true}
	},
	appearance: {
		color: String,
		icon: String,
		limitsActive: { type: Boolean, default: false},
		highLimit: {
			value : Number,
			color: String,
			icon: String
		},
		lowLimit: {
			value : Number,
			color: String,
			icon: String
		}
	}
});

//add a function to using Promises
WidgetSchema.static('findWithPromise', function (conditions:Object) {
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

export interface IWidget extends mongoose.Document {
	_id: string;
	key: string;
	title: string;
	board: string;
	source: string;
	type: string;
	query: any;
	position : {
		column: number;
		column_index: number;
		row: number;
		page: number;
	};
	appearance: {
		color:string;
		icon:string
	}
}


// Model interface
export interface IWidgetModel extends mongoose.Model<IWidget> {
	findWithPromise(conditions:Object): Promise<any>;
}


export var WidgetModel = <IWidgetModel> mongoose.model<IWidget>('Widget', WidgetSchema);