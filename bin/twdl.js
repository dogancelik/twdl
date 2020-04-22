#!/usr/bin/env node
const logSymbols = require('log-symbols');
const lib = require('../lib/index');
const util = require('../lib/util');
const fs = require('fs');

var argv = require('yargs')
	.usage('twdl [options] <URLs>')
	.option('f', {
		alias: 'format',
		default: util.DEFAULT_FORMAT,
		describe: 'Set filename format',
		type: 'string'
	})
	.option('l', {
		alias: 'list',
		default: '',
		describe: 'Load tweets from a file',
		type: 'string'
	})
	.option('e', {
		alias: 'embed',
		default: false,
		describe: 'Embed tweet & media URL in IPTC',
		type: 'boolean'
	})
	.option('d', {
		alias: 'data',
		default: '',
		describe: 'Embed additional data',
		type: 'string'
	})
	.alias('h', 'help')
	.argv;

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
	embed: argv.embed,
	data: argv.data,
	format: argv.format,
};
lib.downloadUrls(urls, options);