const rp = require('request-promise');
const cheerio = require('cheerio');

const util = require('../util');
const puppeteer = require('./puppeteer');
const video = require('./video');

// Credits to: https://github.com/Mottl/GetOldTweets3/
// Also: https://github.com/JustAnotherArchivist/snscrape

function buildHeaders(userAgent) {
	if (userAgent == null) {
		userAgent = util.getUserAgent();
	}

	return {
		'User-Agent': userAgent,
		'Accept-Language': 'en-US,en;q=0.5',
	};
}

exports.buildHeaders = buildHeaders;

function buildUrl(statusId, username, minPosition) {
	if (minPosition) {
		return `https://twitter.com/i/${username}/conversation/${statusId}?include_available_features=1&include_entities=1&min_position=${minPosition}`
	} else {
		return `https://twitter.com/user/status/${statusId}`;
	}
}

exports.buildUrl = buildUrl;

const picTwitter = 'pic.twitter.com',
	customUserAgent = 'Opera/9.80 (Windows NT 6.1; WOW64) Presto/2.12.388 Version/12.18 Bot';

function getMedia(tweetUrl, options) {
	let urlSplit = tweetUrl.split('/'),
		statusId = encodeURIComponent(urlSplit[5]),
		username = encodeURIComponent(urlSplit[3]),
		pageUrl = buildUrl(statusId, username),
		headers = buildHeaders(customUserAgent);

	if (options.cookie.length > 0) {
		headers.Cookie = options.cookie;
	}
	let requestConfig = util.getRequestConfig({ uri: pageUrl, headers: headers });

	// @ts-ignore
	return rp(requestConfig).then(jq => {
		let tweetContainer = jq('.permalink-tweet-container').first(),
			tweet = tweetContainer.find('.permalink-tweet').first(),
			profileSidebar = jq('.ProfileSidebar').first(),
			mediaContainer = jq('.AdaptiveMediaOuterContainer', tweetContainer).first();

		// Profile related
		let name = tweet.attr('data-name'),
			username = tweet.attr('data-screen-name'),
			userId = tweet.attr('data-user-id'),
			avatar = tweet.find('.js-action-profile-avatar').attr('src').replace('_bigger', ''),
			bio = profileSidebar.find('.ProfileHeaderCard-bio').text().trim(),
			website = profileSidebar.find('.ProfileHeaderCard-url').text().trim(),
			location = profileSidebar.find('.ProfileHeaderCard-location').text().trim(),
			joined = profileSidebar.find('.ProfileHeaderCard-joinDate').text().trim(),
			birthday = profileSidebar.find('.ProfileHeaderCard-birthdate').text().trim(),
			// Tweet related
			isVideo = tweet.find('.AdaptiveMedia.is-video').length > 0,
			text = tweet.find('.js-tweet-text-container').text().trim().replace(picTwitter, ' ' + picTwitter),
			timestamp = parseInt(tweet.find('.tweet-timestamp ._timestamp').first().attr('data-time-ms'), 10),
			date = new Date(timestamp),
			dateFormat = date.toISOString(),
			getImages = () => mediaContainer.find('.js-adaptive-photo')
				.map((i, el) => jq(el).attr('data-image-url'))
				.get();

		// Media URLs
		let media = [];

		if (!isVideo) {
			media = getImages();
		}

		return {
			name, username, userId, avatar,
			bio, website, location, joined, birthday,
			text, timestamp, date, dateFormat,
			isVideo, media
		};
	}, err => {
		// a temporary solution
		return puppeteer.getMedia(tweetUrl, options);
	});
}

exports.getMedia = getMedia;
