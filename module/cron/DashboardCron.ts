/// <reference path='../../typings/tsd.d.ts' />

import cron = require('cron');
var CronJob = cron.CronJob;
import winston = require('winston');

import JiraSource = require('./sources/JiraSource');
import ZendeskSource = require('./sources/ZendeskSource');
import InoplaSource = require('./sources/InoplaSource');
import GoogleSpreadsheetSource = require('./sources/GoogleSpreadsheetSource');
import StashSource = require('./sources/StashSource');
let debug = require('debug')('sgDashboard:module:dashboard-cron');


var zendeskSource = new ZendeskSource();
var jiraSource = new JiraSource();
var inoplaSource = new InoplaSource();
var googleSpreadsheetSource = new GoogleSpreadsheetSource();
var stashSource = new StashSource();

jiraSource.init()
    .then(() => {
        new CronJob('0 */2 * * * *', function () {
            debug("Start cron");
            jiraSource.execute();
            zendeskSource.execute();
            inoplaSource.execute();
            googleSpreadsheetSource.execute();
            stashSource.execute();
        }, null, true);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })




