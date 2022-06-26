import { RequestError } from "got/dist/source/index.js";
import { AllOptions } from "../options.js";
import { getUsername, MediaData, newMediaData, OptionsWithCheerio, getRequest } from "../util.js";
import { parseTweetUrl } from "./twitterApi.js";

const NitterInstances = [
	'https://nitter.42l.fr',
	'https://nitter.pussthecat.org',
	'https://nitter.fdn.fr',
	'https://nitter.1d4.us',
	'https://nitter.kavin.rocks',
	'https://nitter.unixfox.eu',
	'https://nitter.domain.glass',
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
	'https://nitter.spaceint.fr',
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

export function getNitterUrl(getCustom?: string) {
	if (getCustom) return getCustom;

	const randomIndex = Math.floor(Math.random() * NitterInstances.length);
	return NitterInstances[randomIndex];
}

type RequestReturn = Promise<Partial<MediaData>>;

export function getProfileBio(tweetUrl: string, options: Partial<AllOptions>): RequestReturn {
	const mediaData = newMediaData(),
		username = getUsername(tweetUrl),
		requestConfig: OptionsWithCheerio = {
			uri: `${getNitterUrl()}/${username}`,
			cheerio: true,
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
	let uri = decodeURIComponent(imagePath);
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
		mediaData.bioRequest = getProfileBio(tweetUrl, options);
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

	const requestConfig: OptionsWithCheerio = {
		uri: `${getNitterUrl()}/${parsedTweetUrl.username}/status/${parsedTweetUrl.statusId}`,
		cheerio: true,
	};

	return getRequest(requestConfig).then(getMediaData);
}
