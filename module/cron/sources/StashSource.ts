import AbstractSource = require('./AbstractSource');
import winston = require('winston');
import WidgetSchema = require('../../../databaseSchema/Widget');
import Promise = require('bluebird');
import request = require('request');
import async = require('async');
import _ = require('underscore');
import config = require('config');
import IStashBranchResponse = require('../../Objects/IStashBranchResponse');

var Widget = WidgetSchema.WidgetModel;

interface ILastCommitStashWidget extends WidgetSchema.IWidget {
	query : {
		keyword:string;
		limit:number;
		order:string;
	}
}


class StashSource extends AbstractSource.AbstractSource {

	/**
	 * Get the last commit of the branches in the given widget
	 * @param widget
	 * @returns {any}
	 * @private
	 */
	private _getLastCommitPerBranch(widget:ILastCommitStashWidget) {
		return new Promise(function (resolved, rejected) {
			
			//prepare url
			var url = "https://" + config.get('stash.host') + "/rest/api/latest/projects/SG/repos/shopgate/branches";
			url += "?details=true&start=0&limit=1000&orderBy=" + widget.query.order + "&filterText=" + widget.query.keyword;
			winston.debug("Do request to url" + url);
			//do request
			request(url, {auth: {user: config.get('stash.username'), pass: config.get('stash.password'), sendImmediately: true}}, function (error, response, body) {

				if (error) {
					rejected(error);
					return;
				}

				if(response.statusCode == 401) {
					rejected(new Error("Authentification failed"));
					return;
				}

				var json = <IStashBranchResponse> JSON.parse(body);

				var branches = json.values.slice(widget.query.limit * -1);

				var formattedBranches = [];
				_.each(branches, function (element) {

					if (!element.metadata['com.atlassian.stash.stash-branch-utils:ahead-behind-metadata-provider']) {
						return;
					}

					var branch = {
						displayId: element.displayId,
						ahead: element.metadata['com.atlassian.stash.stash-branch-utils:ahead-behind-metadata-provider'].ahead,
						behind: element.metadata['com.atlassian.stash.stash-branch-utils:ahead-behind-metadata-provider'].behind,
						author: element.metadata['com.atlassian.stash.stash-branch-utils:latest-changeset-metadata'].author,
						timestamp: element.metadata['com.atlassian.stash.stash-branch-utils:latest-changeset-metadata'].authorTimestamp,
						message: element.metadata['com.atlassian.stash.stash-branch-utils:latest-changeset-metadata'].message
					};
					formattedBranches.push(branch);
				});

				resolved(formattedBranches);
			})

		})
	}

	/**
	 * Itereate through the given widgets and get the zendesk information
	 * @param widgets
	 * @returns {any|Promise}
	 * @private
	 */
	_iterateThroughWidgets(widgets:WidgetSchema.IWidget[]) {

		var _this = this;
		var results = {};
		return new Promise(function (resolved, reject) {
			var results = {};
			async.eachLimit(widgets, 5, function (widget:WidgetSchema.IWidget, callback) {
				if (!results[widget.board]) {
					results[widget.board] = {};
				}
				winston.debug(widget.type);
				switch (widget.type) {
					case "last_commit_per_branch" :

						_this._getLastCommitPerBranch(widget)
							.then(function (result:any) {
								results[widget.board][widget.key] = {
									source: widget.source,
									type: widget.type,
									value: result
								};
								callback();
							})
							.catch(function (err) {
								callback(err);
							});

						break;
					default :
						winston.error("No implementation for type " + widget.type + " found");
				}

			}, function (err:Error) {
				if (err) {
					winston.error(err.message);
				}

				resolved(results);

			})
		})


	}

	
	execute() {

		var _this = this;
		Widget.findWithPromise({source: 'stash'})
			.then(function (widgets:WidgetSchema.IWidget[]) {
				return _this._iterateThroughWidgets.call(_this, widgets);
			})
			.then(this._sendToDashboards)
			.catch(function (err:Error) {
				winston.error(err.message);
			})

	}

	
}

export = StashSource;