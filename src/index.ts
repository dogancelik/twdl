import bluebird from 'bluebird';
const { join, all, mapSeries } = bluebird;
import { writeFile, stat, utimes } from 'fs/promises';

import path from 'path';
import replaceExt from 'replace-ext';
import mkdirp from 'mkdirp';
import { exiftool } from 'exiftool-vendored';
import logSymbols from 'log-symbols';

import * as cache from './cache.js';
import * as api from './api.js';
import * as util from './util.js';
import * as id from './scrapers/id.js';
import * as video from './scrapers/video.js';
import * as puppeteer from './scrapers/puppeteer.js';
import * as twitterApi from './scrapers/twitterApi.js';
import * as nitter from './scrapers/nitter.js';

import { AllOptions, ScraperType } from './options.js';
export * from './options.js';

const exifArgs = ['-overwrite_original'];

export interface DownloadStatus {
	status: string | DownloadStatusCode;
	errors: [string, Error][];
	mediaUrl: string;
	tweetUrl: string;
}

export enum DownloadStatusCode {
	Downloaded = 'downloaded',
	Skipped = 'skipped',
	FailedDownload = 'failedDownload',
	FailedEmbed = 'failedEmbed',
	FailedText = 'failedText',
	FailedDate = 'failedDate',
}

async function downloadUrl(mediaUrl: string, tweetData: util.TweetData, mediaData: util.MediaData, options: Partial<AllOptions>) {
	const parsedMedia = util.parseMediaUrl(mediaUrl),
		filename = util.renderFormat(options.format, parsedMedia, tweetData, mediaData, options),
		parsedPath = path.parse(filename),
		downloadStatus: DownloadStatus = {
			status: undefined,
			mediaUrl: mediaUrl,
			tweetUrl: tweetData.finalUrl,
			errors: [],
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
		if (parsedMedia.downloadUrl.includes('.m3u8')) {
			await video.downloadWithFfmpeg(parsedMedia.downloadUrl, filename);
		} else {
			const body = await api.gotInstance.get(parsedMedia.downloadUrl, {
				responseType: 'buffer',
				resolveBodyOnly: true,
				timeout: { request: 60 * 1000 },
			}) as Buffer;
			await writeFile(filename, body);
		}
		console.log(`${logSymbols.success} Downloaded: '${parsedMedia.downloadUrl}' as '${filename}'`);
	} catch (err) {
		downloadStatus.errors.push([DownloadStatusCode.FailedDownload, err]);
		console.log(`${logSymbols.error} Failed to download: ${parsedMedia.downloadUrl}`, err.toString());
	}

	let embedData: string;
	if (options.embed || options.data || options.text) {
		embedData = util.createEmbedData(tweetData, parsedMedia, mediaData, options);
	}

	if (options.embed) {
		try {
			await exiftool.write(filename, { Comment: embedData }, exifArgs);
			console.log(`${logSymbols.success} Metadata & data are embedded into '${filename}'`);
		} catch (err) {
			downloadStatus.errors.push([DownloadStatusCode.FailedEmbed, err]);
			console.log(`${logSymbols.error} Failed to embed metadata & data:`, err);
		}
	}

	if (options.text) {
		const textFile = replaceExt(filename, '.txt');
		try {
			await writeFile(textFile, embedData);
			console.log(`${logSymbols.success} Metadata & data are written into '${textFile}'`);
		} catch (err) {
			downloadStatus.errors.push([DownloadStatusCode.FailedText, err]);
			console.log(`${logSymbols.error} Failed to write metadata:`, err);
		}
	}

	if (options.date) {
		try {
			await utimes(filename, new Date(Date.now()), mediaData.date);
			console.log(`${logSymbols.success} Tweet date & time are set in '${filename}'`);
		} catch (err) {
			downloadStatus.errors.push([DownloadStatusCode.FailedDate, err]);
			console.log(`${logSymbols.error} Failed to set date: ${err.toString()}`);
		}
	}

	downloadStatus.status = DownloadStatusCode.Downloaded;
	return downloadStatus;
}

type DownloadUrlsResult = Promise<Array<DownloadStatus[]>>;

function logFound(error: Error, length: number) {
	function getErrorMessage() {
		if (error instanceof Error) {
			return error.message;
		} else {
			const message = (error as string || '').toString();
			return message.length > 0 ? message : 'Unknown error';
		}
	}

	if (error) {
		console.log(`${logSymbols.error} Tweet page error:`, getErrorMessage());
	} else {
		console.log(`${logSymbols.info} Found ${length} item(s) in tweet.`);
	}
}

export function downloadUrls(urls: string[], options: Partial<AllOptions>): DownloadUrlsResult {
	const downloadUrlFn = typeof options.downloadUrlFn === 'function' ? options.downloadUrlFn : downloadUrl;

	function mapUrls(tweetUrl: string, index: number, length: number) {
		const tweetUrlPromise = options.redirect ? api.getFinalUrl(tweetUrl) : util.normalizeUrl(tweetUrl),
			tweetData = util.newTweetData({ originalUrl: tweetUrl });
		console.log(`${util.SEPERATOR}\n${logSymbols.info} (${index + 1} / ${length}) Parsing URL: ${tweetUrl}`);

		function startParallel(finalUrl: util.TweetData['finalUrl']) {
			tweetData.finalUrl = finalUrl;
			Object.assign(tweetData, twitterApi.parseTweetUrl(tweetData, options));
			return join(
				tweetUrlPromise
					.then(r => tweetData) // Send 'tweetData' instead of 'tweetUrl'
					.catch(e => api.downloadError(e, api.RequestType.FinalUrl)),
				options.scraper.includes(ScraperType.Id) && id
					.getId(tweetData)
					.catch(e => api.downloadError(e, api.RequestType.GetId)),
				options.scraper.includes(ScraperType.Nitter) && nitter
					.getMedia(tweetData, options)
					.then(twitterApi.concatQuoteMedia)
					.catch(e => api.downloadError(e, api.RequestType.NitterMedia)),
				options.scraper.includes(ScraperType.Puppeteer) && puppeteer
					.getMedia(tweetData, options)
					.catch(e => api.downloadError(e, api.RequestType.PuppeteerMedia)),
				joinResolved
			);
		}

		return tweetUrlPromise
			.then(startParallel, catchErrors)
			.catch(catchErrors);

		function catchErrors(error: Error) {
			if (options.ignoreErrors) {
				console.log(`${logSymbols.error} Tweet final error:`, error.toString());
				return [] as DownloadStatus[];
			} else {
				throw error;
			}
		}
	}

	function joinResolved(tweetData: util.TweetData, userId: string, nitterData: util.MediaData, puppeteerData: util.MediaData) {
		if ((!nitterData || !nitterData.media) && (!puppeteerData || !puppeteerData.media)) {
			throw new Error('No media data');
		}

		const mediaData = Object.assign({}, nitterData, puppeteerData);

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
			mediaData.media.push(...mediaData.quoteMedia);
		}
		logFound(mediaData.error, mediaCount);

		return all(
			mediaData.media
				.map((mediaUrl) => downloadUrlFn(mediaUrl, tweetData, mediaData, options))
		)
			.then(function (results: DownloadStatus[]) {
				const anyErrors = results.some(result => result.errors.length > 0);
				if (anyErrors) {
					console.log(`${logSymbols.error} Tweet download has errors.`);
				} else {
					console.log(`${logSymbols.success} Tweet download has finished.`);
				}
				return results;
			});
	}

	return cache.reloadCache()
		.then(() => mapSeries(urls, mapUrls))
		.finally(() => {
			exiftool.end(true);
			puppeteer.cleanBrowser();
			options.cache && cache.dumpCache();
		});
}

export function getThreadUrls(tweetUrl: string, options: Partial<AllOptions>): Promise<Partial<util.MediaData>> {
	const tweetData = util.newTweetData({ originalUrl: tweetUrl });

	return twitterApi
		.getThreadSiblings(tweetData, options)
		.then(async (mediaData) => {
			mediaData.ancestors = await mediaData.ancestors as any;
			mediaData.descendants = await mediaData.descendants as any;
			return mediaData;
		});
}
