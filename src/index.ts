import bluebird = require('bluebird');
import fs = require('fs');
const writeFile = bluebird.promisify(fs.writeFile);
const stat = bluebird.promisify(fs.stat);
const utimes = bluebird.promisify(fs.utimes);

import path = require('path');
import replaceExt = require('replace-ext');
import mkdirp = require('mkdirp');
import rp = require('request-promise');
const exiftool = require('exiftool-vendored').exiftool;
import logSymbols = require('log-symbols');

import * as util from './util';
import id = require('./scrapers/id');
import video = require('./scrapers/video');
import puppeteer = require('./scrapers/puppeteer');
import twitterApi = require('./scrapers/twitterApi');

import { AllOptions } from './options';
export * from './options';

import { ResponseAsJSON } from 'request';
type RequestError = Error & ResponseAsJSON;

function downloadError(err: RequestError) {
	if (err.name === 'StatusCodeError') {
		if (err.statusCode >= 400 && err.statusCode < 500) {
			console.log(`${logSymbols.error} Tweet download has failed. Tweet is probably deleted.`, err.statusCode);
		} else if (err.statusCode >= 500) {
			console.log(`${logSymbols.error} Tweet download has failed. There is a technical issue.`, err.statusCode);
		} else {
			console.log(`${logSymbols.error} Tweet download has failed. Unknown error.`, err.statusCode);
		}
	} else {
		throw err;
	}
}

const exifArgs = ['-overwrite_original'];

async function downloadUrl(mediaUrl: string, tweetUrl: string, mediaData: util.MediaData, options: AllOptions) {
	let parsedMedia = util.parseMediaUrl(mediaUrl);
	let filename = util.renderFormat(options.format, parsedMedia, tweetUrl, mediaData);
	let parsedPath = path.parse(filename);

	try {
		let stats = await stat(filename);
		if (options.overwrite === false && stats !== null) {
			console.log(`${logSymbols.warning} Skipped: '${parsedMedia.downloadUrl}' as '${filename}'`);
			return ['skipped', mediaUrl, tweetUrl];
		}
	} catch (err) {
	}

	if (parsedPath.dir) {
		try {
			await mkdirp(parsedPath.dir);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to create folder: ${parsedPath.dir}`, err.toString());
		}
	}

	try {
		let body = await rp({ uri: parsedMedia.downloadUrl, method: 'GET', encoding: null });
		await writeFile(filename, body);
		console.log(`${logSymbols.success} Downloaded: '${parsedMedia.downloadUrl}' as '${filename}'`);
	} catch (err) {
		console.log(`${logSymbols.error} Failed to download: ${parsedMedia.downloadUrl}`, err.toString());
	}

	let embedData: string;
	if (options.embed || options.data || options.text) {
		embedData = util.createEmbedData(tweetUrl, parsedMedia, mediaData, options);
	}

	if (options.embed) {
		try {
			await exiftool.write(filename, { Comment: embedData }, exifArgs);
			console.log(`${logSymbols.success} Metadata & data are embedded into '${filename}'`);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to embed metadata & data:`, err);
		}
	}

	if (options.text) {
		let textFile = replaceExt(filename, '.txt');
		try {
			await writeFile(textFile, embedData);
			console.log(`${logSymbols.success} Metadata & data are written into '${textFile}'`);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to write metadata:`, err);
		}
	}

	if (options.date) {
		try {
			await utimes(filename, new Date(Date.now()), mediaData.date);
			console.log(`${logSymbols.success} Tweet date & time are set in '${filename}'`);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to set date: ${err.toString()}`);
		}
	}

	return ['downloaded', mediaUrl, tweetUrl];
}

export function downloadUrls(urls: string[], options: AllOptions) {

	let logFound = (length: number) => console.log(`${logSymbols.info} Found ${length} item(s) in tweet.`),
		downloadUrlFn = typeof options.downloadUrlFn === 'function' ? options.downloadUrlFn : downloadUrl;

	function mapUrls(tweetUrl: string, index: number, length: number) {
		tweetUrl = util.normalizeUrl(tweetUrl);
		console.log(`${util.SEPERATOR}\n${logSymbols.info} (${index + 1} / ${length}) Parsing URL: ${tweetUrl}`);
		return bluebird.join(
			tweetUrl,
			id.getId(tweetUrl),
			twitterApi.getMedia(tweetUrl, options).then(twitterApi.concatQuoteMedia).catch(downloadError),
			video.getVideo(tweetUrl),
			joinResolved).then(function (results: any) {
				console.log(`${logSymbols.success} Tweet download has finished.`);
				return results;
			});
	}

	function joinResolved(tweetUrl: string, userId: string, mediaData: util.MediaData, videoUrl: string) {
		if (userId && mediaData.userId == null) {
			mediaData.userId = userId;
		}

		let mediaCount = mediaData.media.length;
		if (options.avatar && mediaData.avatar) {
			mediaCount += 1;
			mediaData.media.push(mediaData.avatar);
		}
		if (options.quote && Array.isArray(mediaData.quoteMedia) && mediaData.quoteMedia.length > 0) {
			mediaCount += mediaData.quoteMedia.length;
			mediaData.media = mediaData.media.concat(mediaData.quoteMedia);
		}
		if (videoUrl) {
			mediaCount += 1;
			mediaData.media.push(videoUrl);
		}
		logFound(mediaCount);

		return bluebird
			.all(mediaData.media.map((mediaUrl: string) => downloadUrlFn(mediaUrl, tweetUrl, mediaData, options)));
	}

	return bluebird.mapSeries(urls, mapUrls).finally(() => {
		exiftool.end(true);
		puppeteer.cleanBrowser();
	});
}
