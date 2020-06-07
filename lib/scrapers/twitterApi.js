const rp = require('request-promise');
const cheerio = require('cheerio');

const util = require('../util');
const puppeteer = require('./puppeteer');
const video = require('./video');

// Credits to: https://github.com/Mottl/GetOldTweets3/

function buildHeaders(config) {
	if (config.userAgent == null) {
		config.userAgent = util.getUserAgent();
	}

	return {
		'Host': "twitter.com",
		'User-Agent': config.userAgent,
		'Accept': "application/json, text/javascript, */*; q=0.01",
		'Accept-Language': "en-US,en;q=0.5",
		'X-Requested-With': "XMLHttpRequest",
		'Referer': config.url,
		'Connection': "keep-alive"
	};
}

exports.buildHeaders = buildHeaders;

function buildUrl(tweetCriteria) {
	let url = 'https://twitter.com/i/search/timeline?';

	if (!tweetCriteria.topTweets) {
		url += 'f=tweets&';
	}

	url += 'vertical=news&';
		+ 'src=typd&';
		+ 'include_available_features=1&';
		+ 'include_entities=1&';
		+ 'reset_error_state=false&';

	let urlGetData = '';

	if (tweetCriteria.querySearch) {
		urlGetData += tweetCriteria.querySearch;
	}

	if (Array.isArray(tweetCriteria.excludeWords)) {
		urlGetData += tweetCriteria.excludeWords.join(' -');
	}

	if (Array.isArray(tweetCriteria.username)) {
		let usernames = tweetCriteria.username.map(i => ' from:' + i).join(' OR ');
		if (usernames.length > 0) {
			urlGetData += usernames;
		}
	}

	if (tweetCriteria.within) {
		if (tweetCriteria.near) {
			urlGetData += ` near:"${tweetCriteria.near}" within:${tweetCriteria.within}`
		} else if (tweetCriteria.lat && tweetCriteria.lon) {
			urlGetData += ` geocode:${tweetCriteria.lat},${tweetCriteria.lon},${tweetCriteria.within}`
		}
	}

	if (tweetCriteria.since) {
		urlGetData += ' since:' + tweetCriteria.since
	}

	if (tweetCriteria.until) {
		urlGetData += ' until:' + tweetCriteria.until
	}

	if (tweetCriteria.minReplies) {
		urlGetData += ' min_replies:' + tweetCriteria.minReplies
	}

	if (tweetCriteria.minFaves) {
		urlGetData += ' min_faves:' + tweetCriteria.minFaves
	}

	if (tweetCriteria.minRetweets) {
		urlGetData += ' min_retweets:' + tweetCriteria.minRetweets
	}

	if (tweetCriteria.lang) {
		url += 'l=' + tweetCriteria.lang + '&';
	}

	url += 'q=' + encodeURIComponent(urlGetData) + '&';
	url += 'max_position=' + (tweetCriteria.maxPosition ? tweetCriteria.maxPosition : '');

	return url;
}

exports.buildUrl = buildUrl;

const picTwitter = 'pic.twitter.com';

function getMedia(tweetUrl) {
	let urlSplit = tweetUrl.split('/'),
		statusId = encodeURIComponent(urlSplit[urlSplit.length - 1]),
		username = encodeURIComponent(urlSplit[urlSplit.length - 3]),
		apiUrl = buildUrl({ querySearch: `url:${statusId} -filter:quote -"RT @${username}"` }),
		headers = buildHeaders({ url: tweetUrl }),
		requestConfig = { uri: apiUrl, headers: headers, json: true };

	// @ts-ignore
	return rp(requestConfig).then(obj => {
		if (obj.items_html.trim().length === 0) {
			return puppeteer.getMedia(tweetUrl);
		}

		let jq = cheerio.load(obj.items_html),
			tweet = jq('.js-stream-tweet').first();

		// Profile related
		let name = tweet.attr('data-name'),
			username = tweet.attr('data-screen-name'),
			userId = tweet.attr('data-user-id'),
			avatar = tweet.find('.js-action-profile-avatar').attr('src').replace('_bigger', ''),
			bio = undefined,
			website = undefined,
			location = undefined,
			joined = undefined,
			// Tweet related
			isVideo = tweet.find('.AdaptiveMedia.is-video').length > 0,
			text = tweet.find('.js-tweet-text-container').text().trim().replace(picTwitter, ' ' + picTwitter),
			timestamp = parseInt(tweet.find('.tweet-timestamp ._timestamp').first().attr('data-time-ms'), 10),
			date = new Date(timestamp),
			dateFormat = date.toISOString(),
			getImages = () => tweet.find('.js-adaptive-photo')
				.map((i, el) => jq(el).attr('data-image-url'))
				.get();

		// Media URLs
		let media = [];

		if (!isVideo) {
			media = getImages();
		}

		return {
			name, username, userId, avatar,
			bio, website, location, joined,
			text, timestamp, date, dateFormat,
			isVideo, media
		};
	});
}

exports.getMedia = getMedia;