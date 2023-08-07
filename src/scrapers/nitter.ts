import logSymbols from "log-symbols";
import { AllOptions } from "../options.js";
import * as util from "../util.js";
import * as api from "../api.js";
import * as video from "./video.js";
import { parseTweetUrl } from "./twitterApi.js";
import type { Response } from 'got';
import bluebird from 'bluebird';
import _debug from 'debug';
import { CookieJar, MemoryCookieStore } from "tough-cookie";

const { join } = bluebird;
const debug = _debug('twdl:nitter');

type NitterInstance = string | api.OptionsWithUri;

const NitterInstances: NitterInstance[] = [
	'https://nitter.42l.fr',
	'https://nitter.fdn.fr',
	'https://nitter.1d4.us',
	'https://nitter.kavin.rocks',
	// 'https://nitter.unixfox.eu', // Undefined response code + 403
	// 'https://nitter.domain.glass', // Can't parse date
	'https://nitter.namazso.eu',
	'https://nitter.moomoo.me', // Unstable
	'https://nitter.it',
	'https://nitter.grimneko.de',
	'https://nitter.weiler.rocks',
	'https://nitter.sethforprivacy.com',
	// 'https://nitter.cutelab.space', // Not loading
	'https://nitter.nl',
	'https://nitter.mint.lgbt',
	// 'https://nitter.bus-hit.me', // 502
	'https://nitter.esmailelbob.xyz', // Unstable
	// 'https://nitter.winscloud.net', // 404
	'https://nitter.tiekoetter.com',
	// 'https://nitter.spaceint.fr', // 302 redirect
	'https://nitter.privacy.com.de',
	'https://nitter.mastodon.pro',
	'https://nitter.notraxx.ch',
	'https://nitter.poast.org',
	'https://nitter.lunar.icu',
	'https://nitter.bird.froth.zone', // Not loading
	'https://nitter.dcs0.hu',
	'https://nitter.cz',
	'https://nitter.privacydev.net',
	'https://nitter.kylrth.com',
	'https://nitter.foss.wtf',
	// 'https://nitter.priv.pw', // SSL issue
]

export function getNitterOptions(getCustom?: string) {
	const options: NitterInstance = {
		uri: '',
	};
	if (getCustom) {
		if (typeof getCustom === 'object') {
			Object.assign(options, getCustom);
		} else if (typeof getCustom === 'string') {
			options.uri = getCustom;
		}
		return options;
	}

	const randomIndex = Math.floor(Math.random() * NitterInstances.length),
		instance = NitterInstances[randomIndex];

	if (typeof instance === 'object') {
		Object.assign(options, instance);
	} else if (typeof instance === 'string') {
		options.uri = instance;
	}

	return options;
}

type RequestReturn = Promise<Partial<util.MediaData> | void>;

const gotOptions = {
	https: { rejectUnauthorized: false },
};

export function getProfileBio(tweetData: Partial<util.TweetData>, options: Partial<AllOptions>): RequestReturn {
	const mediaData = util.newMediaData(),
		username = tweetData.username ?? util.getUsername(tweetData.finalUrl),
		nitterOptions = getNitterOptions(),
		url = `${nitterOptions.uri}/${username}`;

	function getBioData(jq: cheerio.Root) {
		const profileCard = jq('.profile-card');
		mediaData.bio = profileCard.find('.profile-bio').text().trim();
		mediaData.website = profileCard.find('.profile-website').text().trim();
		mediaData.location = profileCard.find('.profile-location').text().trim();
		mediaData.joined = profileCard.find('.profile-joindate').text().trim();
		return mediaData;
	}

	return api.gotInstance.get(url, gotOptions)
		.then(api.loadCheerio)
		.then(getBioData)
		.catch(e => api.downloadError(e, api.RequestType.NitterBio));
}

function fixImageUrl(imagePath: string) {
	function decodeBase64(match: string, group1: string) {
		const decoded = Buffer.from(group1, 'base64').toString('ascii');
		return `/${decoded}`;
	}

	let uri = decodeURIComponent(imagePath);
	uri = uri.replace(/^\/pic\/enc\/([A-Za-z0-9/=]+)/, decodeBase64);
	uri = uri.replace(/^\/pic/, '');
	uri = uri.replace('_bigger', '');
	uri = uri.replace('?name=small', '');
	uri = uri.replace(/&format=[a-z]+/i, '');
	uri = "https://pbs.twimg.com" + uri;
	return uri;
}

export function getMedia(tweetData: Partial<util.TweetData>, options: Partial<AllOptions>): RequestReturn {
	const parsedTweetUrl = parseTweetUrl(tweetData, options);

	function getMediaData(jq: api.CheerioRoot) {
		const tweetContainer = jq('.main-tweet').first(),
			tweet = tweetContainer.find('.timeline-item').first(),
			mediaContainer = tweet.find('.attachments').first(),
			mediaData = util.newMediaData(),
			errorPanel = jq('.error-panel');

		if (errorPanel.length > 0) {
			const errorText = errorPanel.text().trim();
			mediaData.error = new Error(errorText);
			mediaData.media = [];
			return mediaData;
		} else if (tweet.length === 0) {
			mediaData.error = new Error('Tweet not found');
			mediaData.media = [];
			return mediaData;
		}

		// Profile related
		mediaData.name = tweet.find('.fullname').first().text().trim();
		mediaData.username = tweet.find('.username').first().text().trim().replace('@', '');
		mediaData.avatar = fixImageUrl(tweet.find('.avatar').first().attr('src'));
		// Bio
		tweetData.username = mediaData.username;
		// Tweet related
		mediaData.finalUrl = jq.finalUrl;
		mediaData.isVideo = tweet.find('.attachment.video-container, .attachments.media-gif').length > 0;
		mediaData.text = tweet.find('.tweet-content').text().trim();
		const dateText = tweet.find('.tweet-date a').first().attr('title')?.replace(' · ', ' ');
		if (dateText) {
			mediaData.date = new Date(dateText);
			mediaData.dateFormat = mediaData.date.toISOString();
		}
		const getImages = () => mediaContainer.find('.attachment.image img')
			.map((i, el) => jq(el).attr('src'))
			.get()
			.map(fixImageUrl);

		// Media URLs
		mediaData.media = [];
		if (!mediaData.isVideo) {
			mediaData.media.push(...getImages());
		}

		return join(
			mediaData,
			getProfileBio(tweetData, options),
			combineMediaData
		);
	}

	function combineMediaData(mediaData: util.MediaData, bioData: util.MediaData) {
		if (mediaData && bioData) {
			if (bioData.bio)
				mediaData.bio = bioData.bio;
			if (bioData.website)
				mediaData.website = bioData.website;
			if (bioData.location)
				mediaData.location = bioData.location;
			if (bioData.joined)
				mediaData.joined = bioData.joined;
		}
		return mediaData;
	}

	const nitterOptions = getNitterOptions(),
		url = `${nitterOptions.uri}/${parsedTweetUrl.username}/status/${parsedTweetUrl.statusId}`;
	console.log(`${logSymbols.info} Nitter URL: ${url}`);

	return api.gotInstance.get(url, gotOptions)
		.then(api.loadCheerio)
		.then(getMediaData)
		.then(getVideoData);

	async function getVideoData(mediaData: Partial<util.MediaData>) {
		if (mediaData.isVideo) {
			let videoUrl = '';
			try {
				videoUrl = await getVideo(tweetData, options);
			} catch (e) {
				api.downloadError(e, api.RequestType.VideoUrl);
			}
			if (videoUrl) {
				mediaData.media.push(videoUrl);
			}
		}

		return mediaData;
	}
}

async function getVideo(tweetData: Partial<util.TweetData>, options: Partial<AllOptions>) {
	const parsedTweetUrl = parseTweetUrl(tweetData, options),
		nitterOptions = getNitterOptions(),
		path = `/${parsedTweetUrl.username}/status/${parsedTweetUrl.statusId}`,
		url = `${nitterOptions.uri}/enablehls`;

	function getPlaylistPlaylistUrl(jq: api.CheerioRoot) {
		const video = jq('.main-tweet .attachments .attachment.video-container video').first(),
			videoDataUrl = video.attr('data-url'),
			videoSource = video.find('source').first();

		if (videoSource.length > 0) {
			const videoUrl = videoSource.attr('src');
			debug('Got video source URL: %s', videoUrl);
			return videoUrl;
		}

		if (videoDataUrl) {
			const playlistUrl = `${nitterOptions.uri}${videoDataUrl}`;
			debug('Got playlist playlist URL: %s', playlistUrl);
			return api.gotInstance.get(playlistUrl, gotOptions)
				.then(parsePlaylistPlaylist)
				// .then(parsePlaylist);
		}
	}

	function parsePlaylistPlaylist(response: Response<string>) {
		const { body: data } = response;

		const lines = data.split('\n');
		let topPixels = 0;
		let videoPlaylistUrl = '';

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes('RESOLUTION=')) {
				const line = lines[i].trim();
				const resolution = line.match(/RESOLUTION=([\d]+x[\d]+)/)[1];
				const [width, height] = resolution.split('x').map(Number);
				const pixels = width * height;
				if (pixels > topPixels) {
					topPixels = pixels;
					const pathOnly = lines[i + 1].trim();
					videoPlaylistUrl = pathOnly;
				}
			}
		}

		if (videoPlaylistUrl) {
			if (videoPlaylistUrl.includes('/enc/')) {
				const urlMatch = videoPlaylistUrl.match(/\/enc\/([A-Za-z0-9]+)\/([^/]+)/);
				if (urlMatch) {
					videoPlaylistUrl = decodeURIComponent(urlMatch[2]);
					const split = videoPlaylistUrl.split('_');
					for (let i = 0; i < split.length; i++) {
						split[i] = Buffer.from(split[i], 'base64').toString('ascii');
					}
					videoPlaylistUrl = split.join('?');
				}
			}

			if (!videoPlaylistUrl.startsWith('https:')) {
				videoPlaylistUrl = `${nitterOptions.uri}${videoPlaylistUrl}`;
			}

			if (videoPlaylistUrl.includes('https%3A')) {
				const parsedUrl = new URL(videoPlaylistUrl);
				const urlMatch = parsedUrl.pathname.match(/https%3A[^ ]+/);
				if (urlMatch) {
					videoPlaylistUrl = decodeURIComponent(urlMatch[0]);
				}
			}

			debug('Got highest resolution playlist URL: %s', videoPlaylistUrl);
			return videoPlaylistUrl;
			// return api.gotInstance.get(videoPlaylistUrl, gotOptions);
		}
	}

	function parsePlaylist(response: Response<string>) {
		const { body: data } = response;
		const regex = /#EXT-X-MAP:URI="(.+)"/;
		const match = data.match(regex);
		if (match) {
			const host = response.requestUrl.hostname.includes('video.twimg.com')
				? `${response.requestUrl.protocol}//${response.requestUrl.hostname}`
				: nitterOptions.uri;
			const videoUrl = `${host}${match[1]}`;
			debug('Got video URL from playlist: %s', videoUrl);
			return videoUrl;
		}
	}

	const cookieJar = new CookieJar();
	cookieJar.setCookieSync('hlsPlayback=on', url);

	return api.gotInstance.post(url, {
		...gotOptions,
		form: { referer: path },
		cookieJar: cookieJar,
	})
		.then(api.loadCheerio)
		.then(getPlaylistPlaylistUrl);
}
