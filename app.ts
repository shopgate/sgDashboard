///<reference path='./typings/tsd.d.ts' />
import express = require('express');
import path = require('path');
import fs = require('fs');
import twig = require('twig');
import logger = require('morgan');
import config = require('config');
import bodyParser = require('body-parser');
import routes = require('./routes/index');
import adminRoutes = require('./routes/admin');
import apitriggerRoutes = require('./routes/apitrigger');

let app = express();
let http = require('http').Server(app);


//setup mongodb
var mongoose = require('mongoose');
//mongoose.set('debug', true);
mongoose.connect(config.get('global.mongoose.uri'), config.get('global.mongoose.options'), function (err) {
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
app.use(bodyParser.urlencoded({ extended: true })); // to support URL-encoded bodies
app.use(logger('dev'));

//add debugging tools
app.use(function (req, res, next) {
    res.locals.debug = function (data) {
        return JSON.stringify(data, null, 2)
    };
    next();
});


app.use('/', routes);
app.use('/admin', adminRoutes);
app.use('/apitrigger', apitriggerRoutes);

http.listen(config.get('global.port'));
console.log('Listening on port ' + config.get('global.port'));
