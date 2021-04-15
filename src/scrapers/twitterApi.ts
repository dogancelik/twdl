import { Headers } from 'request';
import rp = require('request-promise');
import cheerio = require('cheerio');

import { MediaData, getUserAgent, getRequestConfig } from '../util';
import puppeteer = require('./puppeteer');
import { AllOptions } from '../options';

// Credits to: https://github.com/Mottl/GetOldTweets3/
// Also: https://github.com/JustAnotherArchivist/snscrape

export function buildHeaders(userAgent: string): Headers {
	if (userAgent == null) {
		userAgent = getUserAgent();
	}

	return {
		'User-Agent': userAgent,
		'Accept-Language': 'en-US,en;q=0.5',
	};
}

export function buildUrl(statusId: string, username: string, minPosition?: string | number): string {
	if (minPosition) {
		return `https://twitter.com/i/${username}/conversation/${statusId}?include_available_features=1&include_entities=1&min_position=${minPosition}`
	} else {
		return `https://twitter.com/user/status/${statusId}`;
	}
}

const picTwitter = 'pic.twitter.com',
	customUserAgent = 'Opera/9.80 (Windows NT 6.1; WOW64) Presto/2.12.388 Version/12.18 Bot';

export async function concatQuoteMedia(mediaData: MediaData): Promise<MediaData> {
	if (mediaData.quoteRequest != null) {
		const quoteMediaData = await mediaData.quoteRequest;
		if (quoteMediaData.error instanceof Error === false) {
			mediaData.quoteMedia = mediaData.quoteMedia.concat(quoteMediaData.media, quoteMediaData.quoteMedia);
		}
	}
	return mediaData;
}

export function getMedia(tweetUrl: string, options: Partial<AllOptions>): Promise<MediaData> {
	const urlParsed = new URL(tweetUrl),
		urlSplit = urlParsed.pathname.split('/'),
		statusId = encodeURIComponent(urlSplit[3]),
		username = encodeURIComponent(urlSplit[1]),
		pageUrl = buildUrl(statusId, username),
		headers = buildHeaders(customUserAgent);

	if (options.cookie.length > 0) {
		headers.Cookie = options.cookie;
	}
	const requestConfig = getRequestConfig({ uri: pageUrl, headers: headers });

	return rp(requestConfig).then((jq: cheerio.Root) => {
		const tweetContainer = jq('.permalink-tweet-container').first(),
			tweet = tweetContainer.find('.permalink-tweet').first(),
			profileSidebar = jq('.ProfileSidebar').first(),
			mediaContainer = jq('.AdaptiveMediaOuterContainer', tweetContainer).first();

		if (tweetContainer.length === 0) {
			return { error: new Error('Tweet is not found.') };
		}

		// Profile related
		const name = tweet.attr('data-name'),
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

		const quoteMedia = [];
		let quoteRequest: Promise<MediaData>;
		if (options.quote) {
			const quoteUrl = tweet.find('.twitter-timeline-link').first().attr('data-expanded-url');
			if (quoteUrl) {
				quoteRequest = getMedia(quoteUrl, options).then(concatQuoteMedia);
			}
		}

		return {
			name, username, userId, avatar,
			bio, website, location, joined, birthday,
			text, timestamp, date, dateFormat,
			isVideo, media, quoteMedia, quoteRequest
		};
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	}, (err: Error) => {
		// a temporary solution
		return puppeteer.getMedia(tweetUrl, options);
	});
}
