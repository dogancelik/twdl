const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const stat = Promise.promisify(fs.stat);
const utimes = Promise.promisify(fs.utimes);

const path = require('path');
const mkdirp = require('mkdirp');
const rp = require('request-promise');
const exiftool = require('exiftool-vendored').exiftool;
const logSymbols = require('log-symbols');

const util = require('./util');
const puppeteer = require('./scrapers/puppeteer');
const twitterApi = require('./scrapers/twitterApi');

function downloadError(err) {
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

async function downloadUrl(mediaUrl, tweetUrl, mediaData, options) {
	let parsedMedia = util.parseMediaUrl(mediaUrl);
	let filename = util.renderFormat(options.format, parsedMedia, tweetUrl, mediaData);
	let parsedPath = path.parse(filename);

	try {
		let stats = await stat(filename);
		if (options.overwrite === false && stats !== null) {
			console.log(`${logSymbols.warning} Skipped: '${mediaUrl}' as '${filename}'`);
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
		let body = await rp({ uri: parsedMedia.downloadUrl, method: 'GET', encoding: null })
		await writeFile(filename, body);
		console.log(`${logSymbols.success} Downloaded: '${parsedMedia.downloadUrl}' as '${filename}'`);
	} catch (err) {
		console.log(`${logSymbols.error} Failed to download: ${parsedMedia.downloadUrl}`, err.toString());
	}

	let embedData;
	if (options.embed || options.data) {
		embedData = util.createEmbedData(tweetUrl, mediaUrl, mediaData, options);
		try {
			await exiftool.write(filename, { Comment: embedData }, exifArgs);
			console.log(`${logSymbols.success} Metadata & data are embedded into '${filename}'`);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to embed metadata & data: ${err.toString()}`);
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

function downloadUrls(urls, options) {
	let logFound = (length) => console.log(`${logSymbols.info} Found ${length} item(s) in tweet.`);

	return Promise.each(urls, function (tweetUrl) {
		console.log(`${util.SEPERATOR}\nParsing URL: ${tweetUrl}`);
		return twitterApi.getMedia(tweetUrl, options.avatar).then(function (mediaData) {
			if (Array.isArray(mediaData.media)) {
				logFound(mediaData.media.length);
			} else {
				mediaData.media.then(media => logFound(media.length));
			}
			return Promise.each(mediaData.media, (mediaUrl) => downloadUrl(mediaUrl, tweetUrl, mediaData, options));
		}, downloadError).then(function () {
			console.log(`${logSymbols.success} Tweet download has finished.`);
		});
	})
		.finally(() => {
			exiftool.end(true);
			puppeteer.getBrowser().then(browser => browser.close());
		});
}

exports.downloadUrls = downloadUrls;
