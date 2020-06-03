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

const util = require('./util');
const twitterApi = require('./twitterApi');

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

function getVideo(tweetUrl) {
	return rp(util.getRequestConfig({
		uri: 'https://www.savetweetvid.com/downloader',
		method: 'POST',
		form: { url: tweetUrl },
	})).then(jq => {
		let rows = jq('a[download]').first().parent().parent().parent().children(),
			result = { res: 0, link: null };

		rows.each(function (i, el) {
			let row = jq(el),
				res = parseInt(row.children().eq(0).text().split('p')[0], 10);

			if (res > result.res) {
				result.res = res;
				result.link = row.find('a[download]');
			}
		});

		return result.link.attr('href');
	});
}

const picTwitter = 'pic.twitter.com';

function getMedia(tweetUrl, includeAvatar) {
	let urlSplit = tweetUrl.split('/'),
		statusId = encodeURIComponent(urlSplit[urlSplit.length - 1]),
		username = encodeURIComponent(urlSplit[urlSplit.length - 3]),
		apiUrl = twitterApi.buildUrl({ username: [username], querySearch: 'url:' + statusId }),
		headers = twitterApi.buildHeaders({ url: tweetUrl }),
		requestConfig = { uri: apiUrl, headers: headers, json: true };

	return rp(requestConfig).then(obj => {
		let jq = cheerio.load(obj.items_html),
			tweet = jq('.js-stream-tweet').first();

			// Profile related
		let name = tweet.attr('data-name'),
			username = tweet.attr('data-screen-name'),
			userId = tweet.attr('data-user-id'),
			avatar = tweet.find('.js-action-profile-avatar').attr('src').replace('_bigger', ''),
			bio = '',
			website = '',
			location = '',
			joined = '',
			// Tweet related
			isVideo = tweet.find('.AdaptiveMedia.is-video').length > 0,
			text = tweet.find('.js-tweet-text-container').text().trim().replace(picTwitter, ' ' + picTwitter),
			timestamp = parseInt(tweet.find('.tweet-timestamp ._timestamp').first().attr('data-time-ms'), 10),
			date = new Date(timestamp),
			dateFormat = date.toISOString(),
			getImages = () => tweet.find('.js-adaptive-photo')
				.map((i, el) => jq(el).attr('data-image-url') + ':orig')
				.get();

		// Media URLs
		let media = [];
		if (includeAvatar) {
			media.push(avatar);
		}

		if (isVideo) {
			media.push(getVideo(tweetUrl));
		} else {
			media = media.concat(getImages());
		}

		return {
			name, username, userId, avatar,
			bio, website, location, joined,
			text, timestamp, date, dateFormat,
			media
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
		return getMedia(tweetUrl, options.avatar).then(function (mediaData) {
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
		.finally(() => exiftool.end(true));
}

exports.downloadUrls = downloadUrls;
