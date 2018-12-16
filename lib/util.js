const url = require('url');
const path = require('path');

const SEPERATOR = '------------';

exports.SEPERATOR = SEPERATOR;

function getBasename(mediaUrl) {
	return path.basename(url.parse(mediaUrl).pathname);
}

function getStatusId(tweetUrl) {
	return tweetUrl.match(/status\/([0-9]+)/)[1];
}

function getUsername(tweetUrl) {
	return tweetUrl.match(/([a-zA-Z0-9_]+)\/status/)[1];
}

const DEFAULT_FORMAT = '#original#';

exports.DEFAULT_FORMAT = DEFAULT_FORMAT;

function renderFormat(formatStr, info) {
	let basename = getBasename(info.mediaUrl.replace(':orig', ''));
	let extname = path.extname(basename);
	let basename_noext = basename.replace(extname, '');

	return formatStr
		.replace(/#tweet_id#/gi, getStatusId(info.tweetUrl))
		.replace(/#original#/gi, basename_noext)
		.replace(/#username#/gi, getUsername(info.tweetUrl))
		+ extname;
}

exports.renderFormat = renderFormat;