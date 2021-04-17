import { MediaData, getUserAgent, getRequest, GetRequestHeaders, newMediaData, getRequestConfig } from '../util';
import puppeteer = require('./puppeteer');
import { AllOptions } from '../options';

// Credits to: https://github.com/Mottl/GetOldTweets3/
// Also: https://github.com/JustAnotherArchivist/snscrape

export function buildHeaders(userAgent: string): GetRequestHeaders {
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

import { RequestError } from 'got';

export function requestError(err: RequestError, tweetUrl: string, options: Partial<AllOptions>): Promise<Partial<MediaData>> {
	// a temporary solution
	if (err.response.statusCode !== 404) {
		return puppeteer.getMedia(tweetUrl, options);
	} else {
		throw err;
	}
}

function parseTweetUrl(tweetUrl: string) {
	const urlParsed = new URL(tweetUrl),
		urlSplit = urlParsed.pathname.split('/'),
		statusId = encodeURIComponent(urlSplit[3]),
		username = encodeURIComponent(urlSplit[1]),
		pageUrl = buildUrl(statusId, username);

	return { statusId, username, pageUrl };
}

export function getMedia(tweetUrl: string, options: Partial<AllOptions>): Promise<Partial<MediaData>> {
	const headers = buildHeaders(customUserAgent),
		parsedTweetUrl = parseTweetUrl(tweetUrl);

	function getMediaData(jq: cheerio.Root) {
		const tweetContainer = jq('.permalink-tweet-container').first(),
			tweet = tweetContainer.find('.permalink-tweet').first(),
			profileSidebar = jq('.ProfileSidebar').first(),
			mediaContainer = jq('.AdaptiveMediaOuterContainer', tweetContainer).first(),
			mediaData = newMediaData();

		if (tweetContainer.length === 0) {
			mediaData.error = new Error('Tweet is not found.');
			return mediaData;
		}

		// Profile related
		mediaData.name = tweet.attr('data-name');
		mediaData.username = tweet.attr('data-screen-name');
		mediaData.userId = tweet.attr('data-user-id');
		mediaData.avatar = tweet.find('.js-action-profile-avatar').attr('src').replace('_bigger', '');
		mediaData.bio = profileSidebar.find('.ProfileHeaderCard-bio').text().trim();
		mediaData.website = profileSidebar.find('.ProfileHeaderCard-url').text().trim();
		mediaData.location = profileSidebar.find('.ProfileHeaderCard-location').text().trim();
		mediaData.joined = profileSidebar.find('.ProfileHeaderCard-joinDate').text().trim();
		mediaData.birthday = profileSidebar.find('.ProfileHeaderCard-birthdate').text().trim();
		// Tweet related
		mediaData.isVideo = tweet.find('.AdaptiveMedia.is-video').length > 0;
		mediaData.text = tweet.find('.js-tweet-text-container').text().trim().replace(picTwitter, ' ' + picTwitter);
		mediaData.timestamp = parseInt(tweet.find('.tweet-timestamp ._timestamp').first().attr('data-time-ms'), 10);
		mediaData.date = new Date(mediaData.timestamp);
		mediaData.dateFormat = mediaData.date.toISOString();
		const getImages = () => mediaContainer.find('.js-adaptive-photo')
				.map((i, el) => jq(el).attr('data-image-url'))
				.get();

		// Media URLs
		mediaData.media = [];
		if (!mediaData.isVideo) {
			mediaData.media = getImages();
		}

		mediaData.quoteMedia = [];
		if (options.quote) {
			const quoteUrl = tweet.find('.twitter-timeline-link').first().attr('data-expanded-url');
			if (quoteUrl) {
				mediaData.quoteRequest = getMedia(quoteUrl, options).then(concatQuoteMedia);
			}
		}

		return mediaData;
	}

	return getRequest({
		uri: parsedTweetUrl.pageUrl,
		cheerio: true,
		headers: headers,
	}, options).then(getMediaData, (err: RequestError) => requestError(err, tweetUrl, options));
}

export function getThreadSiblings(tweetUrl, options) {
	const mediaData = newMediaData({ ancestors: undefined, descendants: undefined }),
		parsedTweetUrl = parseTweetUrl(tweetUrl),
		requestConfig = getRequestConfig({
			uri: tweetUrl,
			cheerio: true
		}, options, customUserAgent);

	function getSiblings(direction, parentJq, lastId?, collectedUrls = []) {
		const idAttrName = 'data-item-id',
			buildSiblingUrl = (jq, el) => buildUrl(jq(el).attr(idAttrName), parsedTweetUrl.username);

		function getReplies(direction, jq) {
			const replies = jq(`#${direction} .stream-item[data-item-id]`);
			if (replies.length === 0) {
				return [replies, false];
			}

			if (direction === 'ancestors') {
				return [replies, replies.first().attr(idAttrName)];
			} else {
				return [replies, replies.last().attr(idAttrName)];
			}
		}

		if (lastId === undefined) {
			const replies = getReplies(direction, parentJq);
			if (replies[1] === false) {
				return false;
			} else {
				const replyUrls = replies[0].map((i, el) => buildSiblingUrl(parentJq, el)).get();
				collectedUrls = collectedUrls.concat(replyUrls);
				lastId = replies[1];
			}
		}

		const siblingConfig = Object.assign({}, requestConfig);
		siblingConfig.uri = buildUrl(lastId, parsedTweetUrl.username);
		return getRequest(siblingConfig, options)
			.then(function (jq) {
				const [newReplies, newLastId] = getReplies(direction, jq);
				if (newLastId === false) {
					return collectedUrls;
				} else {
					const newUrls = newReplies.map((i, el) => buildSiblingUrl(jq, el)).get();
					if (direction === 'ancestors') {
						collectedUrls = newUrls.concat(collectedUrls);
					} else {
						collectedUrls = collectedUrls.concat(newUrls);
					}
					return getSiblings(direction, parentJq, newLastId, collectedUrls);
				}
			});
	}

	function parsePage(jq) {
		const tweetContainer = jq('.permalink-tweet-container').first();
		if (tweetContainer.length === 0) {
			mediaData.error = new Error('Thread is not found.');
			return mediaData;
		}

		mediaData.ancestors = getSiblings('ancestors', jq);
		mediaData.descendants = getSiblings('descendants', jq);

		return mediaData;
	}

	return getRequest(requestConfig, options)
		.then(parsePage, (err: RequestError) => { throw err; });
}
