import puppeteer, { CookieParam, HTTPResponse } from 'puppeteer';
import { Browser, LaunchOptions } from 'puppeteer';
import logSymbols from 'log-symbols';
import { AllOptions } from '../options.js';
import { MediaData, TweetData, newMediaData, noOp } from '../util.js';
import { setTimeout } from "node:timers/promises";
import _debug from 'debug';

const debug = _debug('twdl:puppeteer');

let _browser = null;

export function cleanBrowser(): Promise<null> {
	return getBrowser().then((browser: Browser) => {
		browser.close();
		return _browser = null;
	});
}

const envOptions = process.env.TWDL_PUPPETEER_OPTS;

export async function getBrowser(launchOptions?: LaunchOptions): Promise<Browser> {
	launchOptions = launchOptions || {};
	if (envOptions) {
		const parsed = JSON.parse(envOptions);
		Object.assign(launchOptions, parsed);
		debug('Launch options for Puppeteer: %j', launchOptions);
	}
	if (_browser === null) {
		_browser = await puppeteer.launch(launchOptions)
	}
	return _browser;
}

function getEnglishUrl(tweetUrl: string) {
	return tweetUrl.split('?')[0] + '?lang=en';
}

function getVideoUrls(jsonResponses: any[] = []) {
	const videoUrls = [];
	jsonResponses.forEach((json) => {
		// If logged in
		json.data?.threaded_conversation_with_injections_v2?.instructions?.forEach((instruction) => {
			instruction.entries?.forEach(searchEntry);
		});
		// If not logged in
		if (json.data?.tweetResult) {
			searchEntry(json.data);
		}
	});
	return videoUrls;

	function searchEntry(entry: any) {
		const results = entry.content?.itemContent?.tweet_results || entry.tweetResult;
		results?.result?.legacy?.entities?.media?.forEach((media: any) => {
			const variants = media.video_info?.variants?.filter((i: any) => i.bitrate) || [];
			variants.sort((a: any, b: any) => b.bitrate - a.bitrate);
			const videoUrl = variants?.[0]?.url;
			if (videoUrl) {
				debug('Found video URL: %s', videoUrl);
				videoUrls.push(videoUrl);
				return;
			}

			const m3u8Url = media.video_info?.variants?.find((i: any) => i.url.includes(".m3u8"))?.url;
			if (m3u8Url) {
				debug('Found m3u8 URL: %s', m3u8Url);
				videoUrls.push(m3u8Url);
			}
		});
	}
}

export async function getMedia(tweetData: Partial<TweetData>, options: Partial<AllOptions>): Promise<Partial<MediaData>> {
	const browser = await getBrowser();
	const page = await browser.newPage();
	if (options.cookie) {
		let cookie: CookieParam[] = [];
		try {
			cookie = JSON.parse(options.cookie)
			debug('Loading cookies: %j', cookie);
		} catch (e) {
			debug('Failed to parse cookie: %s', e);
		}
		await page.setCookie(...cookie);
	}

	const mediaData = newMediaData();
	mediaData.media = [];
	page.on('response', watchForPlaylistUrl);
	const jsonResponses = [];
	async function watchForPlaylistUrl(response: HTTPResponse) {
		// skip preflight requests
		if (response.request().method() === 'OPTIONS') return;

		const url = response.url();
		if (/(TweetResultByRestId|TweetDetail)/.test(url)) {
			debug('Found JSON URL: %s…', url.substr(0, 100));
			const json = await response.json();
			jsonResponses.push(json);
		}
	}
	await page.goto(getEnglishUrl(tweetData.finalUrl));

	// Tweet failed to load
	page.waitForSelector('div[data-testid="primaryColumn"] > div > div > div > div > div + div[role="button"]')
		.then((refreshElement) => refreshElement.click(), noOp);

	let article: Awaited<ReturnType<typeof page.waitForSelector>> = null
	try {
		article = await page.waitForSelector('div[aria-label="Timeline: Conversation"] > div > div:first-child > div > div > article');
	} catch (err) {
		if (err.name === 'TimeoutError') {
			if (!options.cookie)
				console.log(`${logSymbols.warning} You can use cookies to bypass restricted content, see Wiki for more info.`);
			throw new Error('Selector error, tweet is not found. Check twdl for updates.');
		}
	}

	// View sensitive tweet
	article.$('div[data-testid="tweet"]:not(.r-d0pm55) > div > div > div > div + div > div[role="button"]')
		.then((viewButton) => viewButton && viewButton.click(), noOp);

	const source = await article.$('div[dir] > a[href*="#source-labels"]'), // Source app (e.g. Twitter for Android)
		dateHandle = await page.waitForSelector('a[aria-label*=" · "]:has(> time[datetime])'),
		dateText = (await page.evaluate((e: HTMLElement) => e.innerText, dateHandle)).replace(' · ', ' ');
	mediaData.timestamp = Date.parse(dateText);
	mediaData.date = new Date(mediaData.timestamp);
	mediaData.dateFormat = mediaData.date.toISOString();

	const nameParts = await article.$$('div[data-testid="User-Name"] > div'),
		nameElement = nameParts[0],
		usernameElement = nameParts[nameParts.length - 1];
	mediaData.name = await page.evaluate((e: HTMLElement) => e.innerText, nameElement);
	mediaData.username = await page.evaluate((e: HTMLElement) => e.innerText.replace('@', ''), usernameElement);
	mediaData.userId = undefined;

	// Tweet related
	const textElement = await article.$('div[lang][dir]');
	if (textElement != null) {
		mediaData.text = await page.evaluate((e: HTMLElement) => e.innerText, textElement);
	}

	const quoteMedia = [],
		images = await article.$$('img[draggable="true"]'),
		quoteImages = await article.$$('div[role="blockquote"] img[draggable="true"]');
	mediaData.isVideo = await article.$$eval('div[data-testid="videoComponent"]', (els: { length: number; }) => els.length > 0);
	mediaData.avatar = await page.evaluate((e: HTMLImageElement) => e.src.replace(/_(bigger|normal)/, ''), images[0]);

	await pushImages(images);
	await pushImages(quoteImages);

	async function pushImages(arr: typeof images) {
		for (const img of arr) {
			const src = await page.evaluate((e: HTMLImageElement) => e.src, img);
			// Ignore avatars
			if (!src.includes('profile_images'))
				mediaData.media.push(src);
		}
	}

	// Remove quote images
	mediaData.media = mediaData.media.filter(function (val: string) {
		return quoteMedia.indexOf(val) < 0;
	});

	if (jsonResponses.length > 0) {
		debug('Trying to get video data');
		try {
			mediaData.media.push(...getVideoUrls(jsonResponses));
		} catch (err) {
			//
		}
	}

	// Scrape profile metadata after media
	const profile = await nameElement.$('a[role="link"]');
	await profile.click();
	try {
		const button = await page.waitForSelector("xpath//div[@role='button' and contains(string(), 'Yes, view profile')]", { timeout: 5e3 });
		if (button) {
			// Skip profile warning
			await page.evaluate((el: HTMLElement) => el.click(), button[0]);
		}
	} catch (err) {
		//
	}
	await page.waitForSelector('nav[aria-label="Profile timelines"]');

	try {
		const bioElement = await page.$('div[data-testid="UserDescription"]');
		mediaData.bio = await page.evaluate((e: HTMLElement) => e.innerText, bioElement);
	} catch (err) {
		console.error(`${logSymbols.warning} No bio description detected`);
	}

	await setTimeout(500); // Birthday renders later
	const headerItems = await page.$$eval('div[data-testid="UserProfileHeader_Items"] > *', (els: HTMLAnchorElement[]) => {
		return els.map((e) => e.tagName === 'A' ? `${e.href} (${e.innerText})` : e.innerText);
	});
	headerItems.forEach((item: string) => {
		if (item.startsWith('https:')) {
			mediaData.website = item;
		}
		else if (item.startsWith('Born')) {
			mediaData.birthday = item;
		}
		else if (item.startsWith('Joined')) {
			mediaData.joined = item;
		}
		else {
			mediaData.location = item;
		}
	});

	await page.close();
	return mediaData;
}
