import { RequestError } from "got/dist/source/index.js";
import logSymbols from "log-symbols";
import { AllOptions } from "../options.js";
import { getUserAgent, getUsername, MediaData, newMediaData, OptionsWithCheerio, getRequest, OptionsWithUri } from "../util.js";
import { parseTweetUrl } from "./twitterApi.js";

type NitterInstance = string | OptionsWithUri;

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
	'https://nitter.moomoo.me',
	'https://nitter.it',
	'https://nitter.grimneko.de',
	'https://nitter.ca',
	'https://nitter.mstdn.social',
	'https://nitter.weiler.rocks',
	'https://nitter.sethforprivacy.com',
	'https://nitter.cutelab.space',
	'https://nitter.nl',
	'https://nitter.mint.lgbt',
	'https://nitter.bus-hit.me',
	'https://nitter.esmailelbob.xyz',
	'https://nitter.winscloud.net',
	'https://nitter.tiekoetter.com',
	// 'https://nitter.spaceint.fr', // 302 redirect
	'https://nitter.privacy.com.de',
	'https://nitter.mastodon.pro',
	'https://nitter.notraxx.ch',
	'https://nitter.poast.org',
	'https://nitter.lunar.icu',
	'https://nitter.bird.froth.zone',
	'https://nitter.dcs0.hu',
	'https://nitter.cz',
	'https://nitter.privacydev.net',
	'https://nitter.ebnar.xyz',
	'https://nitter.kylrth.com',
	'https://nitter.oishi-ra.men',
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
	};

	const randomIndex = Math.floor(Math.random() * NitterInstances.length),
		instance = NitterInstances[randomIndex];

	if (typeof instance === 'object') {
		Object.assign(options, instance);
	} else if (typeof instance === 'string') {
		options.uri = instance;
	}

	return options;
}

type RequestReturn = Promise<Partial<MediaData>>;

export function getProfileBio(tweetUrl: string, options: Partial<AllOptions>): RequestReturn {
	const mediaData = newMediaData(),
		username = getUsername(tweetUrl),
		nitterOptions = getNitterOptions(),
		requestConfig: OptionsWithCheerio = {
			uri: `${nitterOptions.uri}/${username}`,
			cheerio: true,
			retry: { limit: 2 },
		};

	function getBioData(jq: cheerio.Root) {
		const profileCard = jq('.profile-card');
		mediaData.bio = profileCard.find('.profile-bio').text().trim();
		mediaData.website = profileCard.find('.profile-website').text().trim();
		mediaData.location = profileCard.find('.profile-location').text().trim();
		mediaData.joined = profileCard.find('.profile-joindate').text().trim();
		return mediaData;
	}

	return getRequest(requestConfig).then(getBioData);
}

function fixImageUrl(imagePath: string) {
	function decodeBase64(match: string, group1: string) {
		const decoded = Buffer.from(group1, 'base64').toString('ascii');
		return `/${decoded}`;
	}

	let uri = decodeURIComponent(imagePath);
	uri = uri.replace(/^\/pic\/enc\/([A-Za-z0-9\/=]+)/, decodeBase64);
	uri = uri.replace(/^\/pic/, '');
	uri = uri.replace('?name=small', '');
	uri = "https://pbs.twimg.com" + uri;
	return uri;
}

export function getMedia(tweetUrl: string, options: Partial<AllOptions>): RequestReturn {
	const mediaData = newMediaData(),
		parsedTweetUrl = parseTweetUrl(tweetUrl);

	function getMediaData(jq: cheerio.Root) {
		const tweetContainer = jq('.main-tweet').first(),
			tweet = tweetContainer.find('.timeline-item').first(),
			mediaContainer = tweet.find('.attachments').first(),
			mediaData = newMediaData();

		// Profile related
		mediaData.name = tweet.find('.fullname').text().trim();
		mediaData.username = tweet.find('.username').text().trim();
		mediaData.avatar = tweet.find('.avatar').attr('src').replace('_bigger', '');
		// Tweet related
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

		return mediaData;
	}

	const nitterOptions = getNitterOptions(),
		requestConfig: OptionsWithCheerio = {
			uri: `${nitterOptions.uri}/${parsedTweetUrl.username}/status/${parsedTweetUrl.statusId}`,
			cheerio: true,
			retry: { limit: 2 },
		};
	console.log(`${logSymbols.info} Nitter URL: ${requestConfig.uri}`);

	return getRequest(requestConfig).then(getMediaData);
}
