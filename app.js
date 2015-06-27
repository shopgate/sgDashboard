var express = require('express');
var path = require('path');
var fs = require('fs');
var twig = require('twig');
var logger = require('morgan');
var config = require('./config/config.json');
var bodyParser = require('body-parser');
var routes = require('./routes/index');
var adminRoutes = require('./routes/admin');
var apitriggerRoutes = require('./routes/apitrigger');

var app = express();
var http = require('http').Server(app);


//setup mongodb
var mongoose = require('mongoose');
//mongoose.set('debug', true);
mongoose.connect(config.global.mongoose.uri, config.global.mongoose.options, function (err) {
	if (err) {
		winston.error(err);
	}
});


//winston config
var winston = require('winston');
winston.level = "debug";

twig.cache(false);

require('./module/cron/DashboardCron');

var websocketHandler = require('./module/WebsocketHandler');
websocketHandler.attachServer(http);

//view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded()); // to support URL-encoded bodies
app.use(logger('dev'));

//add debugging tools
app.use(function (req, res, next) {
    res.locals.debug = function (data) {
        return JSON.stringify(data, null, 2)
    }
    next();
});


app.use('/', routes);
app.use('/admin', adminRoutes);
app.use('/apitrigger', apitriggerRoutes);

http.listen(config.global.port);
console.log('Listening on port ' + config.global.port);
