import cheerio = require('cheerio');
import url = require('url');
import path = require('path');
import mergeOptions = require('merge-options');
import { CliOptions } from './options';

export const SEPERATOR = '------------';

function getStatusId(tweetUrl: string) {
	return tweetUrl.match(/status\/([0-9]+)/)[1];
}

export function getUsername(tweetUrl: string) {
	return tweetUrl.match(/([a-zA-Z0-9_]+)\/status/)[1];
}

export const DEFAULT_FORMAT = '#original#';

interface ParsedMedia {
	original: string,
	extension: string,
	downloadUrl: string,
	basename: string
}

export function parseMediaUrl(mediaUrl: string) {
	let parsed = url.parse(mediaUrl),
		data = {
			original: mediaUrl,
			extension: null,
			downloadUrl: parsed.href,
			basename: path.basename(parsed.pathname)
		} as ParsedMedia;

	if (parsed.query !== null) {
		try {
			data.extension = parsed.query.match(/format=([a-z]+)/)[1];
			data.downloadUrl = parsed.href.split('?')[0];
		} catch {
		}
	}

	if (data.extension !== null)  {
		data.basename += '.' + data.extension;
		data.downloadUrl += '.' + data.extension;
	}

	if (data.downloadUrl.indexOf('pbs.twimg.com/media/') > -1) {
		data.downloadUrl += ':orig';
	}

	return data;
}

export function renderFormat(formatStr: string, parsedMedia: ParsedMedia, tweetUrl: string, mediaData: Partial<MediaData>) {
	let extname = path.extname(parsedMedia.basename),
		basename_noext = parsedMedia.basename.replace(extname, '');

	return formatStr
		.replace(/#tweet_id#/gi, getStatusId(tweetUrl))
		.replace(/#original#/gi, basename_noext)
		.replace(/#username#/gi, getUsername(tweetUrl))
		+ extname;
}

export interface MediaData {
	// Profile
	name: string,
	username: string,
	userId: string,
	avatar: string,
	bio: string,
	website: string,
	location: string,
	joined: string,
	birthday: string,
	// Tweet
	text: string,
	timestamp: number,
	date: Date,
	dateFormat: string,
	isVideo: boolean,
	media: string[],
	quoteMedia: string[],
	quoteRequest
}

export function createEmbedData(tweetUrl: string, parsedMedia: ParsedMedia, mediaData: MediaData, options: CliOptions) {
	let embedData = '';

	if (options.embed || options.text) {
		embedData += `
		Name: ${mediaData.name}
		Username: ${mediaData.username}
		ID: ${mediaData.userId}
		Bio: ${mediaData.bio}
		Website: ${mediaData.website}
		Location: ${mediaData.location}
		Birthday: ${mediaData.birthday}
		Joined: ${mediaData.joined}
		---
		Text: ${mediaData.text}
		Date: ${mediaData.dateFormat}
		Tweet: ${tweetUrl}
		Media: ${parsedMedia.downloadUrl}
		---`;
	}

	if (options.data.length > 0) {
		embedData += `
		Comment: ${options.data}
		`;
	}

	return embedData.trim().replace(/\t*/g, '');
}

const userAgents = [
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:63.0) Gecko/20100101 Firefox/63.0',
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:62.0) Gecko/20100101 Firefox/62.0',
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:61.0) Gecko/20100101 Firefox/61.0',
	'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:63.0) Gecko/20100101 Firefox/63.0',
	'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
	'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
	'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15',
];

export function getUserAgent(useCustom?: string | boolean) {
	return typeof useCustom === 'string' ?
		useCustom :
		userAgents[Math.floor(Math.random() * userAgents.length)];
}

import { Options as RequestOptions, MultipartBody } from 'request';

export function getRequestConfig(config: RequestOptions, includeHeaders = true) {
	let newConfig = mergeOptions({
		headers: { 'User-Agent': getUserAgent() },
		transform: (body: any) => cheerio.load(body),
		transform2xxOnly: true
	}, config);

	return newConfig;
}

export function normalizeUrl(url: string) {
	return url.replace(/^(http(s)?:\/\/)?/i, 'http$2://');
}
