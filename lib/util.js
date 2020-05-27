const cheerio = require('cheerio');
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

function renderFormat(formatStr, mediaUrl, tweetUrl, mediaData) {
	let basename = getBasename(mediaUrl.replace(':orig', ''));
	let extname = path.extname(basename);
	let basename_noext = basename.replace(extname, '');

	return formatStr
		.replace(/#tweet_id#/gi, getStatusId(tweetUrl))
		.replace(/#original#/gi, basename_noext)
		.replace(/#username#/gi, getUsername(tweetUrl))
		+ extname;
}

exports.renderFormat = renderFormat;

function createEmbedData(tweetUrl, mediaUrl, mediaData, options) {
	let embedData = '';

	if (options.embed) {
		embedData += `
		Name: ${mediaData.name}
		Username: ${mediaData.username}
		ID: ${mediaData.userId}
		Bio: ${mediaData.bio}
		Website: ${mediaData.url}
		Location: ${mediaData.location}
		Joined: ${mediaData.joined}
		---
		Text: ${mediaData.text}
		Date: ${mediaData.dateFormat}
		Tweet: ${tweetUrl}
		Media: ${mediaUrl}
		---`;
	}

	if (options.data.length > 0) {
		embedData += `
		Comment: ${options.data}
		`;
	}

	return embedData.trim().replace(/\t*/g, '');
}

exports.createEmbedData = createEmbedData;

function getRequestConfig(config) {
	return Object.assign({
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36'
		},
		transform: (body) => cheerio.load(body),
	}, config);
}

exports.getRequestConfig = getRequestConfig;