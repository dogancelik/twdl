#!/usr/bin/env node
const logSymbols = require('log-symbols');
const argv = require('yargs').argv;
const lib = require('../lib/index');

var urls = [];
if (Array.isArray(argv.u) || typeof argv.u === 'string') {
	urls = urls.concat(argv.u);
}

if (urls.length === 0) {
	console.log(`${logSymbols.error} Provide URL(s) with -u.`);
	process.exit(1);
} else {
	console.log(`${logSymbols.info} Received ${urls.length} URLs.`);
	lib.downloadUrls(urls);
}