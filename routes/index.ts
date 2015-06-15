///<reference path='../typings/express/express.d.ts' />
///<reference path='../typings/winston/winston.d.ts' />
///<reference path='../typings/underscore/underscore.d.ts' />
import express = require('express');
import winston = require("winston");
import _ = require("underscore");
import DashboardSchema = require('../databaseSchema/Dashboard');
import WidgetSchema = require('../databaseSchema/Widget');
var Dashboard = DashboardSchema.DashboardModel;
var Widget = WidgetSchema.WidgetModel;
var router = express.Router();


router.get('/', function (req, res) {

	Dashboard.find({}).sort({location: 1, name: 1}).exec(function (err, dashboards) {
		res.render('index/index', {"dashboards": dashboards, pageTitle: "Available Dashboards"});
	})

});

/**
 *
 */
router.get('/dashboard/:dashboardKey', function (req:express.Request, res:express.Response) {

	Dashboard.findOne({key: req.params.dashboardKey}).exec(function (err, dashboard:DashboardSchema.IDashboard) {
		if (!dashboard) {
			res.status(404);
			res.end("No board found");
			return;
		}

		Widget.find({board: dashboard._id}).sort({'position.page': 1, 'position.row': 1, 'position.column_index': 1}).exec(function (err, widgets) {
			var widgetsPerPage = {};

			//create an object with the pagenumber as index
			_.each(widgets, function (widget) {
				if(!widget.position.page) {
					widget.position.page = 0;
				}

				if(!widgetsPerPage[widget.position.page]) {
					widgetsPerPage[widget.position.page] = [];
				}

				widgetsPerPage[widget.position.page].push(widget);

			});

			res.render('index/dashboard', {pageTitle: dashboard.name, dashboard: dashboard, widgets: widgets, widgetsPerPage: widgetsPerPage});

		})

	});

});

module.exports = router;
