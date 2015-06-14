/// <reference path='../typings/redis/redis.d.ts' />
import redis = require('redis');

var client = redis.createClient();
client.on('error', function (err) {
	throw err;
});

export = client;