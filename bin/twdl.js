#!/usr/bin/env node
const logSymbols = require('log-symbols');
const lib = require('../lib/index');
const yargsOptions = require('../lib/options').options;
const fs = require('fs');

var yargs = require('yargs')
	.usage('twdl [options] <URLs>')
	.alias('h', 'help');

for (let [key, val] of Object.entries(yargsOptions)) {
	yargs.option(key, val);
}

var argv = yargs.argv;

var urls = argv._;
if (argv.list !== '') {
	try {
		var text = fs.readFileSync(argv.list);
	} catch (e) {
		console.log(`${logSymbols.error} ${e.toString()}`);
	} finally {
		urls = urls.concat(text.toString().trim().split('\n'));
	}
}

if (urls.length === 0) {
	console.log(`${logSymbols.error} No URL is provided. See 'twdl help'.`);
	process.exit(1);
}

console.log(`${logSymbols.info} Received ${urls.length} URLs.`);
var options = {
	avatar: argv.avatar,
	embed: argv.embed,
	data: argv.data,
	overwrite: argv.overwrite,
	format: argv.format,
	date: argv.date,
};

lib.downloadUrls(urls, options).catch(function (err) {
	console.error(`${logSymbols.error} Error occurred:`, err);
	process.exit(2);
});