import logSymbols from "log-symbols";
import { AllOptions } from "../options.js";
import * as util from "../util.js";
import * as api from "../api.js";
import { parseTweetUrl } from "./twitterApi.js";
import bluebird from 'bluebird';
const { join } = bluebird;

type NitterInstance = string | api.OptionsWithUri;

const NitterInstances: NitterInstance[] = [
	'https://nitter.42l.fr',
	'https://nitter.pussthecat.org',
	'https://nitter.fdn.fr',
	'https://nitter.1d4.us',
	'https://nitter.kavin.rocks',
	// 'https://nitter.unixfox.eu', // Undefined response code + 403
	// 'https://nitter.domain.glass', // Can't parse date
	'https://nitter.namazso.eu',
	'https://nitter.hu',
	'https://nitter.moomoo.me', // Unstable
	'https://nitter.it',
	'https://nitter.grimneko.de',
	'https://nitter.ca',
	// 'https://nitter.mstdn.social', // Redirect to main site
	'https://nitter.weiler.rocks',
	'https://nitter.sethforprivacy.com',
	'https://nitter.cutelab.space', // Not loading
	'https://nitter.nl',
	'https://nitter.mint.lgbt',
	'https://nitter.bus-hit.me',
	'https://nitter.esmailelbob.xyz', // Unstable
	'https://nitter.winscloud.net', // 404
	'https://nitter.tiekoetter.com',
	// 'https://nitter.spaceint.fr', // 302 redirect
	'https://nitter.privacy.com.de',
	'https://nitter.mastodon.pro',
	'https://nitter.notraxx.ch',
	'https://nitter.poast.org',
	// 'https://nitter.lunar.icu', // Dead
	'https://nitter.bird.froth.zone', // Not loading
	'https://nitter.dcs0.hu',
	'https://nitter.cz',
	'https://nitter.privacydev.net',
	'https://nitter.ebnar.xyz',
	'https://nitter.kylrth.com',
	// 'https://nitter.oishi-ra.men', // Dead
	'https://nitter.foss.wtf',
	'https://nitter.priv.pw',
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

	return api.gotInstance.get(url)
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
	uri = "https://pbs.twimg.com" + uri;
	return uri;
}

export function getMedia(tweetData: Partial<util.TweetData>, options: Partial<AllOptions>): RequestReturn {
	const parsedTweetUrl = parseTweetUrl(tweetData, options);

	function getMediaData(jq: api.CheerioRoot) {
		const tweetContainer = jq('.main-tweet').first(),
			tweet = tweetContainer.find('.timeline-item').first(),
			mediaContainer = tweet.find('.attachments').first(),
			mediaData = util.newMediaData();

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
		const dateText = tweet.find('.tweet-date a').first().attr('title').replace(' · ', ' ');
		mediaData.date = new Date(dateText);
		mediaData.dateFormat = mediaData.date.toISOString();
		const getImages = () => mediaContainer.find('.attachment.image img')
			.map((i, el) => jq(el).attr('src'))
			.get()
			.map(fixImageUrl);

		// Media URLs
		mediaData.media = [];
		if (!mediaData.isVideo) {
			mediaData.media = getImages();
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

	return api.gotInstance.get(url)
		.then(api.loadCheerio)
		.then(getMediaData);
}
