#!/usr/bin/env node
const logSymbols = require('log-symbols');
const lib = require('../');
const fs = require('fs');

var yargs = require('yargs')
	.usage('twdl [options] <URLs>')
	.alias('h', 'help')
	.options(lib.CliOptions);

var argv = yargs.argv;

var urls = argv._;
if (argv.list !== '') {
	try {
		var text = fs.readFileSync(argv.list),
			textArray = text.toString().trim().split('\n');
		urls = urls.concat(textArray);
	} catch (e) {
		console.log(`${logSymbols.error} ${e.toString()}`);
	}
}

if (urls.length === 0) {
	console.log(`${logSymbols.error} No URL is provided. See 'twdl help'.`);
	process.exit(1);
}

console.log(`${logSymbols.info} Received ${urls.length} URLs.`);
if (process.env.TWDL_COOKIE != null && argv.cookie === '') {
	argv.cookie = process.env.TWDL_COOKIE;
}

lib.downloadUrls(urls, argv).catch(function (err) {
	if (argv.debug) {
		throw err;
	} else {
		console.error(`${logSymbols.error} Error occurred:`, argv.g ? err : err.toString());
		process.exit(2);
	}
});
