import { join, all, mapSeries } from 'bluebird';
import { writeFile, stat, utimes } from 'fs/promises';

import path = require('path');
import replaceExt = require('replace-ext');
import mkdirp = require('mkdirp');
import rp = require('request-promise');
import { exiftool } from 'exiftool-vendored';
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

export interface DownloadStatus {
	status: string,
	mediaUrl: string,
	tweetUrl: string,
}

async function downloadUrl(mediaUrl: string, tweetUrl: string, mediaData: util.MediaData, options: Partial<AllOptions>) {
	const parsedMedia = util.parseMediaUrl(mediaUrl),
		filename = util.renderFormat(options.format, parsedMedia, tweetUrl, mediaData),
		parsedPath = path.parse(filename),
		downloadStatus: DownloadStatus = {
			status: undefined,
			mediaUrl: mediaUrl,
			tweetUrl: tweetUrl,
		};

	try {
		const stats = await stat(filename);
		if (options.overwrite === false && stats !== null) {
			console.log(`${logSymbols.warning} Skipped: '${parsedMedia.downloadUrl}' as '${filename}'`);
			downloadStatus.status = 'skipped';
			return downloadStatus;
		}
	} catch (err) {
		//
	}

	if (parsedPath.dir) {
		try {
			await mkdirp(parsedPath.dir);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to create folder: ${parsedPath.dir}`, err.toString());
		}
	}

	try {
		const body = await rp({ uri: parsedMedia.downloadUrl, method: 'GET', encoding: null });
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
		const textFile = replaceExt(filename, '.txt');
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

	downloadStatus.status = 'downloaded';
	return downloadStatus;
}

type DownloadUrlsResult = Promise<Array<DownloadStatus[]>>;

export function downloadUrls(urls: string[], options: Partial<AllOptions>): DownloadUrlsResult {
	const logFound = (length: number) => console.log(`${logSymbols.info} Found ${length} item(s) in tweet.`),
		downloadUrlFn = typeof options.downloadUrlFn === 'function' ? options.downloadUrlFn : downloadUrl;

	function mapUrls(tweetUrl: string, index: number, length: number) {
		tweetUrl = util.normalizeUrl(tweetUrl);
		console.log(`${util.SEPERATOR}\n${logSymbols.info} (${index + 1} / ${length}) Parsing URL: ${tweetUrl}`);
		return join(
			tweetUrl,
			id.getId(tweetUrl),
			twitterApi.getMedia(tweetUrl, options).then(twitterApi.concatQuoteMedia).catch(downloadError),
			video.getVideo(tweetUrl),
			joinResolved);
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

		return all(mediaData.media.map((mediaUrl) => downloadUrlFn(mediaUrl, tweetUrl, mediaData, options)))
			.then(function (results: DownloadStatus[]) {
				console.log(`${logSymbols.success} Tweet download has finished.`);
				return results;
			});
	}

	return mapSeries(urls, mapUrls)
		.finally(() => {
			exiftool.end(true);
			puppeteer.cleanBrowser();
		});
}
