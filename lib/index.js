const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const stat = Promise.promisify(fs.stat);
const utimes = Promise.promisify(fs.utimes);

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

const picTwitter = 'pic.twitter.com';

function getMedia(tweetUrl) {
	return rp(tweetUrl)
		.then(html => cheerio.load(html))
		.then(jq => {
				// Profile related
			let name = jq('.permalink-header .fullname').first().text(),
				username = jq('.permalink-header .username').first().text(),
				userId = jq('.permalink-tweet[data-user-id]').first().attr('data-user-id'),
				bio = jq('.ProfileHeaderCard-bio').first().text().replace('/ +/g', ' ').trim(),
				url = jq('.ProfileHeaderCard-url').first().text().trim(),
				location = jq('.ProfileHeaderCard-locationText').first().text().trim(),
				joined = jq('.ProfileHeaderCard-joinDateText').first().text().trim(),
				// Tweet related
				isVideo = jq('meta[property="og:type"][content="video"]').length > 0,
				text = jq('.permalink-tweet .js-tweet-text-container').text().trim().replace(picTwitter, ' ' + picTwitter),
				timestamp = parseInt(jq('.tweet-timestamp ._timestamp').first().attr('data-time-ms'), 10),
				date = new Date(timestamp),
				dateFormat = date.toISOString(),
				getImages = () => jq('meta[property="og:image"]')
					.map((i, el) => jq(el).attr('content').replace(':large', ':orig').replace('_400x400', ''))
					.get();

			return {
				name, username, userId, bio, url, location, joined,
				text, timestamp, date, dateFormat,
				media: isVideo ? getVideo(tweetUrl) : getImages()
			};
		});
}

const exifArgs = ['-overwrite_original'];

async function downloadUrl(mediaUrl, tweetUrl, mediaData, options) {
	let filename = util.renderFormat(options.format, mediaUrl, tweetUrl, mediaData);
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
		let body = await rp({ uri: mediaUrl, method: 'GET', encoding: null })
		await writeFile(filename, body);
		console.log(`${logSymbols.success} Downloaded: '${mediaUrl}' as '${filename}'`);
	} catch (err) {
		console.log(`${logSymbols.error} Failed to download: ${mediaUrl}`, err.toString());
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
		return getMedia(tweetUrl).then(function (mediaData) {
			if (Array.isArray(mediaData.media)) {
				logFound(mediaData.media.length);
			} else {
				mediaData.media.then(media => logFound(media.length));
			}
			return Promise.each(mediaData.media, (mediaUrl) => downloadUrl(mediaUrl, tweetUrl, mediaData, options));
		}).then(function () {
			console.log(`${logSymbols.success} Tweet download has finished.`);
		}, function (err) {
			console.log(`${logSymbols.error} Tweet download has failed.`, err.toString());
		});
	})
	.finally(() => exiftool.end(true));
}

exports.downloadUrls = downloadUrls;
