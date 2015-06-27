/// <reference path='../typings/node/node.d.ts' />
import fs = require('fs');

interface Config {

	global : {
		port:number;
		mongoose : {
			uri:string;
			options:any;
		}
	}
	jira?: {
		host:string;
		port:number;
		user:string;
		password:string;
	}
	zendesk?: {
		username:string;
		token:string;
		remoteUri:string;
		debug:boolean;
	}
	googleOauth?:{
		clientId:string;
		clientSecret:string;
		apiUserRefreshToken:string;
	}
	inopla? : {
		id:string;
		psec:string;
	}
}

//load config
var data:any;
data = fs.readFileSync('./config/config.json', 'UTF-8');
export = <Config> JSON.parse(data);