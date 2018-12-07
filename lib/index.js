const fs = require('fs');
const rp = require('request-promise');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const _ = require('lodash');
const writeFile = Promise.promisify(fs.writeFile);

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
				.map((i, el) => jq(el).attr('content').replace(':large', ':orig'))
				.get()
		});
}

function downloadUrl(mediaUrl, tweetUrl) {
	return rp({ uri: mediaUrl, method: 'GET', encoding: null })
		.then(body => writeFile(util.getFilename(mediaUrl, tweetUrl), body))
		.then(
			() => console.log(`${logSymbols.success} Downloaded: ${mediaUrl}`),
			(err) => console.log(`${logSymbols.error} Failed to download: ${mediaUrl}`, err.toString())
		);
}

function downloadUrls(urls) {
	return Promise.each(urls, function (tweetUrl) {
		console.log(`${util.SEPERATOR}\nParsing URL: ${tweetUrl}`);
		return getMedia(tweetUrl).then(function (media) {
			console.log(`${logSymbols.info} Found ${media.length} item(s) in tweet.`);
			return Promise.each(media, (mediaUrl) => downloadUrl(mediaUrl, tweetUrl));
		}).then(function () {
			console.log(`${logSymbols.success} Tweet download has finished.`);
		}, function (err) {
			console.log(`${logSymbols.error} Tweet download has failed.`), err.toString();
		});
	});
}

exports.downloadUrls = downloadUrls;
