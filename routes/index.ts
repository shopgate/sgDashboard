///<reference path='../typings/express/express.d.ts' />
///<reference path='../typings/winston/winston.d.ts' />
import express = require('express');
import winston = require("winston");
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

		Widget.find({board: dashboard._id}).sort({'position.row': 1, 'position.column_index': 1}).exec(function (err, widgets) {
			res.render('index/dashboard', {pageTitle: dashboard.name, dashboard: dashboard, widgets: widgets});

		})

	});

});

module.exports = router;
