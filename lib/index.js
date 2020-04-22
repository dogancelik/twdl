const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const stat = Promise.promisify(fs.stat);

const path = require('path');
const mkdirp = require('mkdirp');
const rp = require('request-promise');
const cheerio = require('cheerio');
const exiftool = require('exiftool-vendored').exiftool;


const logSymbols = require('log-symbols');
const util = require('../lib/util');

function getVideo(tweetUrl) {
	return rp({ uri: 'https://twdown.net/download.php', method: 'POST', form: { URL: tweetUrl } })
		.then(html => cheerio.load(html))
		.then(jq => [jq('a[download]').first().attr('href')]);
}

function getMedia(tweetUrl) {
	return rp(tweetUrl)
		.then(html => cheerio.load(html))
		.then(jq => {
			return jq('meta[property="og:type"][content="video"]').length > 0 ? getVideo(tweetUrl) :
			jq('meta[property="og:image"]')
				.map((i, el) => jq(el).attr('content').replace(':large', ':orig').replace('_400x400', ''))
				.get()
		});
}

const exifArgs = ['-overwrite_original'];

async function downloadUrl(mediaUrl, tweetUrl, options) {
	let filename = util.renderFormat(options.format, { mediaUrl, tweetUrl });
	let parsedPath = path.parse(filename);

	try {
		let stats = await stat(filename);
		if (options.overwrite === false && stats !== null) {
			console.log(`${logSymbols.warning} Skipped: '${mediaUrl}' as '${filename}'`);
			return ['skipped', mediaUrl, tweetUrl];
		}
	} catch (err) {
		console.log(`${logSymbols.error} Failed to get stats of file: ${filename}`, err.toString());
	}

	if (parsedPath.dir) {
		try {
			await mkdirp(parsedPath.dir);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to create folder: ${parsedPath.dir}`, err.toString());
		}
	}

	try {
		let body = await rp({ uri: mediaUrl, method: 'GET', encoding: null })
		await writeFile(filename, body);
		console.log(`${logSymbols.success} Downloaded: '${mediaUrl}' as '${filename}'`);
	} catch (err) {
		console.log(`${logSymbols.error} Failed to download: ${mediaUrl}`, err.toString());
	}

	if (options.embed) {
		try {
			if (filename.includes('.mp4')) {
				await exiftool.write(filename, { Title: `${tweetUrl} / ${mediaUrl}` }, exifArgs);
			} else {
				await exiftool.write(filename, { Credit: tweetUrl, Source: mediaUrl }, exifArgs);
			}
			console.log(`${logSymbols.success} Tweet and file URLs are embedded into '${filename}'`);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to embed metadata: ${err.toString()}`);
		}
	}

	if (options.data) {
		try {
			if (filename.includes('.mp4')) {
				await exiftool.write(filename, { Description: options.data }, exifArgs);
			} else {
				await exiftool.write(filename, { "Caption-Abstract": options.data }, exifArgs);
			}
			console.log(`${logSymbols.success} Data are embedded into '${filename}'`);
		} catch (err) {
			console.log(`${logSymbols.error} Failed to embed data: ${err.toString()}`);
		}
	}

	return ['downloaded', mediaUrl, tweetUrl];
}

function downloadUrls(urls, options) {
	return Promise.each(urls, function (tweetUrl) {
		console.log(`${util.SEPERATOR}\nParsing URL: ${tweetUrl}`);
		return getMedia(tweetUrl).then(function (media) {
			console.log(`${logSymbols.info} Found ${media.length} item(s) in tweet.`);
			return Promise.each(media, (mediaUrl) => downloadUrl(mediaUrl, tweetUrl, options));
		}).then(function () {
			console.log(`${logSymbols.success} Tweet download has finished.`);
		}, function (err) {
			console.log(`${logSymbols.error} Tweet download has failed.`), err.toString();
		});
	})
	.finally(() => exiftool.end(true));
}

exports.downloadUrls = downloadUrls;
