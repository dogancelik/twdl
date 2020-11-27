const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const stat = Promise.promisify(fs.stat);
const utimes = Promise.promisify(fs.utimes);

const path = require('path');
const replaceExt = require('replace-ext');
const mkdirp = require('mkdirp');
const rp = require('request-promise');
const exiftool = require('exiftool-vendored').exiftool;
const logSymbols = require('log-symbols');

const util = require('./util');
const { makeOptions } = require('./options');
const id = require('./scrapers/id');
const video = require('./scrapers/video');
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

	let embedData;
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

function downloadUrls(urls, options) {
	options = makeOptions(options);

	let logFound = (length) => console.log(`${logSymbols.info} Found ${length} item(s) in tweet.`),
		downloadUrlFn = typeof options.downloadUrlFn === 'function' ? options.downloadUrlFn : downloadUrl;

	function mapUrls(tweetUrl, index, length) {
		console.log(`${util.SEPERATOR}\n${logSymbols.info} (${index + 1} / ${length}) Parsing URL: ${tweetUrl}`);
		return Promise.join(
			tweetUrl,
			id.getId(tweetUrl),
			twitterApi.getMedia(tweetUrl, options.cookie).catch(downloadError),
			video.getVideo(tweetUrl),
			joinResolved).then(function (results) {
				console.log(`${logSymbols.success} Tweet download has finished.`);
				return results;
			});
	}

	function joinResolved(tweetUrl, userId, mediaData, videoUrl) {
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

		return Promise
			.all(mediaData.media.map((mediaUrl) => downloadUrlFn(mediaUrl, tweetUrl, mediaData, options)));
	}

	return Promise.mapSeries(urls, mapUrls).finally(() => {
		exiftool.end(true);
		puppeteer.cleanBrowser();
	});
}

exports.downloadUrls = downloadUrls;
