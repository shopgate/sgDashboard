///<reference path='../typings/express/express.d.ts' />
///<reference path='../typings/winston/winston.d.ts' />
///<reference path='../typings/underscore/underscore.d.ts' />
import express = require('express');
import winston = require("winston");
import _ = require("underscore");
import DashboardSchema = require('../databaseSchema/Dashboard');
import Location = require('../module/Objects/Location');
import LightState = require('../module/Objects/LightState');
import lightsOnLocation = require('../module/Objects/LightsOnLocation');
import websocketHandler = require('../module/WebsocketHandler');
import WidgetSchema = require('../databaseSchema/Widget');
import LightTriggerSchema = require('../databaseSchema/LightTrigger');
var Dashboard = DashboardSchema.DashboardModel;
var Widget = WidgetSchema.WidgetModel;
var LightTrigger = LightTriggerSchema.LightTriggerModel;
var router = express.Router();

router.use(function (req, res, next) {
	res.locals.currentURL = req.originalUrl;
	next();
})

router.get('/', function (req, res) {
	res.redirect('/admin/dashboards');
})

router.get('/dashboards', function (req, res) {

	Dashboard.find({}, function (err:Error, dashboards:DashboardSchema.IDashboard[]) {
		res.render('admin/dashboards', {pageTitle: "Configure the dashboards", dashboards: dashboards});
	});

});

router.get('/dashboard_add', function (req, res) {
	res.render('admin/dashboard_add', {pageTitle: "Add a new Dashboard"});
})

router.post('/dashboard_add', function (req:express.Request, res:express.Response) {

	var newDashboard = new Dashboard(req.body);

	Dashboard.create(newDashboard, function (err:Error, data) {
		if (err) {
			res.json(err);
			return;
		}

		res.redirect("/admin/dashboards");

	});


})


router.get('/dashboard_edit/:id', function (req, res) {

	Dashboard.findById(req.params.id, function (err:Error, dashboard:DashboardSchema.IDashboard) {

		if (!dashboard) {
			res.redirect('/admin/dashboards');
			return;
		}
		Widget.find({board: dashboard._id}).sort({'position.page': 1, 'position.row': 1, 'position.column_index': 1}).exec(function (err:Error, widgets:WidgetSchema.IWidget[]) {

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

			res.render('admin/dashboard_edit', {
				pageTitle: "Edit Dashboard: " + dashboard.name,
				dashboard: dashboard,
				widgetsPerPage: widgetsPerPage
			});
		})
	});

});

router.post('/dashboard_edit/:id', function (req, res) {

	Dashboard.findByIdAndUpdate(req.params.id, req.body, function (err) {
		if (err) {
			res.json(err);
			return;
		}
		res.redirect('back');
	})

});

router.get('/dashboard_delete/:id', function (req, res) {

	Dashboard.findByIdAndRemove(req.params.id, function (err) {
		if (err) {
			res.json(err);
			return;
		}

		res.redirect('back');
	})

});

router.get('/dashboard_refresh/:key', function (req, res) {

	websocketHandler.sendToNamespace(req.params.key, "refresh", true);
	res.redirect('back');

});


router.get('/ajax_widget', function (req, res, next) {


	if (req.query.id) {
		Widget.findById(req.query.id, function (err, widget:WidgetSchema.IWidget) {
			res.render('admin/elements/widgets/' + widget.source + '/' + widget.type, {
				widget: widget
			});
		})
		return;
	}


	var widgetPath = req.query.widget
	if (!widgetPath) {
		next(new Error("No widget param found"));
	}

	var widgetPaths = widgetPath.split('/');

	res.render('admin/elements/widgets/' + widgetPaths[0] + '/' + widgetPaths[1], {});


});

router.post('/widget_add/:dashboardKey', function (req, res) {

	Dashboard.find({key: req.params.dashboardKey}, function (err:Error, dashboard:DashboardSchema.IDashboard) {

		dashboard = dashboard[0];
		req.body['board'] = dashboard._id;
		var newWidget = new Widget(req.body);
		Widget.create(newWidget, function (err:Error, dashboard:DashboardSchema.IDashboard) {
			if (err) {
				res.json(err);
				return;
			}
			res.redirect("/admin/dashboard_edit/" + req.params.dashboardKey);
		})
	});

});

router.post('/widget/:dashboardId', function (req, res) {
	winston.debug("/widget");
	//add widget
	if (!req.body.id) {
		req.body['board'] = req.params.dashboardId;
		var newWidget = new Widget(req.body);
		Widget.create(newWidget, function (err:Error, widget:WidgetSchema.IWidget) {
			if (err) {
				res.json(err);
				return;
			}
			res.redirect('back');
		})
		return;
	}

	Widget.findByIdAndUpdate(req.body.id, req.body, function (err:Error, data:WidgetSchema.IWidget) {

		if (err) {
			res.json(err);
			return;
		}
		res.redirect('back');

	})


});

router.get('/widget_delete/:id', function (req, res) {

	Widget.findByIdAndRemove(req.params.id, function (err) {
		if (err) {
			res.json(err);
			return;
		}

		res.redirect('back');
	})

});

/************* Lights **************/

/**
 * Show the overview over all light triggers
 */
router.get('/lights', function (req, res) {
	LightTrigger.find({}, function (err:Error, lightTriggers:LightTriggerSchema.ILightTrigger[]) {
		res.render('admin/lights', {
			lightTriggers: lightTriggers,
			location: Location,
			pageTitle: "Configure the the light trigger"
		});
	})
})

/**
 * Load the settings mask over ajax
 */
router.get('/ajax_lighttrigger', function (req, res, next) {
	//load existing lighttrigger
	if (req.query.id) {
		LightTrigger.findById(req.query.id, function (err, lightTrigger:LightTriggerSchema.ILightTrigger) {
			var formattedLightIds = {};
			_.each(lightTrigger.lights, function (light) {
				formattedLightIds[light.location + "/" + light.id] = light.id + "/" + light.location;
			})


			res.render('admin/elements/light_trigger/' + lightTrigger.dataSource.sourceSystem + '/' + lightTrigger.dataSource.type, {
				lighttrigger: lightTrigger,
				color: LightState.LightColor,
				lightOnLocation: lightsOnLocation,
				locationNames: Location.names,
				formattedLightIds : formattedLightIds
			});
		});
		return;
	}


	var lighttriggerPath = req.query.lighttrigger;
	if (!lighttriggerPath) {
		next(new Error("No widget param found"));
	}

	var lighttriggerPaths = lighttriggerPath.split('/');

	res.render('admin/elements/light_trigger/' + lighttriggerPaths[0] + '/' + lighttriggerPaths[1], {
		color: LightState.LightColor,
		lightOnLocation: lightsOnLocation,
		locationNames: Location.names,
		formattedLightIds : {}
	});


});

/**
 * Save or create the lighttrigger
 *
 */
router.post('/lighttrigger', function (req, res) {

	if(!req.body.lights || req.body.lights.length == 0) {
		//TODO: Error no light ids given
	}

	var data = req.body;
	//format lightids data into lightid and location
	var formattedLights = [];
	_.each(data.lights, function (lightIdString:string) {

		var lightIdSplittet = lightIdString.split('/');
		formattedLights.push({
			location: lightIdSplittet[0],
			id: lightIdSplittet[1]
		});

	});
	data.lights = formattedLights;

	//edit lighttrigger
	if (!data.id) {
		data['board'] = data.dashboardId;
		var lightTrigger = new LightTrigger(data);
		LightTrigger.create(lightTrigger, function (err:Error, lightTrigger:LightTriggerSchema.ILightTrigger) {
			if (err) {
				var output = {
					error: err,
					data: req.body
				};

				res.json(output);
				return;
			}
			res.redirect('back');
		})
		return;
	}

	LightTrigger.findByIdAndUpdate(req.body.id, req.body, function (err:Error, data:LightTriggerSchema.ILightTrigger) {

		if (err) {

			var output = {
				error: err,
				data: req.body
			};

			res.json(output);
			return;
		}
		res.redirect('back');
	})

});


/**
 * Save or create the lighttrigger
 *
 */
router.get('/lighttrigger_delete/:id', function (req, res) {

	LightTrigger.findByIdAndRemove(req.params.id, function (err, result) {

		if(err) {
			res.json(err);
			return;
		}

		res.redirect('back');

	})

});


module.exports = router;
