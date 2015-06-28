/// <reference path='../../typings/node/node.d.ts' />
/// <reference path='../../typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../typings/cron/cron.d.ts' />
/// <reference path='../../typings/winston/winston.d.ts' />
/// <reference path='../../typings/async/async.d.ts' />
/// <reference path='../../typings/jira-connector/jira-connector.d.ts' />
/// <reference path='../../typings/moment/moment.d.ts' />
/// <reference path='../../typings/underscore/underscore.d.ts' />
/// <reference path='../../typings/request/request.d.ts' />
/// <reference path='../../typings/winston/winston.d.ts' />

import cron = require('cron');
var CronJob = cron.CronJob;
import winston = require('winston');

import JiraSource = require('./sources/JiraSource');
import ZendeskSource = require('./sources/ZendeskSource');
import InoplaSource = require('./sources/InoplaSource');
import GoogleSpreadsheetSource = require('./sources/GoogleSpreadsheetSource');
import StashSource = require('./sources/StashSource');


var zendeskSource = new ZendeskSource();
var jiraSource = new JiraSource();
var inoplaSource = new InoplaSource();
var googleSpreadsheetSource = new GoogleSpreadsheetSource();
var stashSource = new StashSource();


new CronJob('*/15 * * * * *', function () {
    winston.debug("Start cron");
    jiraSource.execute();
    zendeskSource.execute();
    inoplaSource.execute();
    googleSpreadsheetSource.execute();
	stashSource.execute();


}, null, true);


