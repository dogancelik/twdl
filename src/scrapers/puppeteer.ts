import puppeteer from 'puppeteer';
import { Browser, LaunchOptions } from 'puppeteer';
import logSymbols from 'log-symbols';
import { AllOptions } from '../options.js';
import { MediaData, newMediaData, noOp } from '../util.js';

let _browser = null;

export function cleanBrowser(): Promise<null> {
	return getBrowser().then((browser: Browser) => {
		browser.close();
		return _browser = null;
	});
}

export async function getBrowser(launchOptions?: LaunchOptions): Promise<Browser> {
	launchOptions = launchOptions || {};
	if (_browser === null) {
		_browser = await puppeteer.launch(launchOptions)
	}
	return _browser;
}

function getEnglishUrl(tweetUrl: string) {
	return tweetUrl.split('?')[0] + '?lang=en';
}


export async function getMedia(tweetUrl: string, options: Partial<AllOptions>): Promise<Partial<MediaData>> {
	const browser = await getBrowser();
	const page = await browser.newPage();
	await page.goto(getEnglishUrl(tweetUrl));

	// Tweet failed to load
	page.waitForSelector('div[data-testid="primaryColumn"] > div > div > div > div > div + div[role="button"]')
		.then((refreshElement) => refreshElement.click(), noOp);

	let article = null;
	try {
		article = await page.waitForSelector('div[aria-label="Timeline: Conversation"] > div > div:first-child > div > div > article');
	} catch (err) {
		if (err.name === 'TimeoutError') {
			throw new Error('Selector error, tweet is not found. Check twdl for updates.');
		}
	}

	// View sensitive tweet
	article.$('div[data-testid="tweet"]:not(.r-d0pm55) > div > div > div > div + div > div[role="button"]')
		.then((viewButton) => viewButton && viewButton.click(), noOp);

	const mediaData = newMediaData();
	const source = await article.$('div[dir] > a[href*="#source-labels"]'), // Source app (e.g. Twitter for Android)
		dateHandle = await page.evaluateHandle((e: HTMLElement) => e.previousElementSibling.previousElementSibling, source),
		dateText = (await page.evaluate((e: HTMLElement) => e.innerText, dateHandle)).replace(' · ', ' ');
	mediaData.timestamp = Date.parse(dateText);
	mediaData.date = new Date(mediaData.timestamp);
	mediaData.dateFormat = mediaData.date.toISOString();

	const nameParts = await article.$$('a[role="link"][data-focusable="true"] > div > div > div[dir]'),
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

	mediaData.media = [];
	const quoteMedia = [],
		images = await article.$$('img[draggable="true"]'),
		quoteImages = await article.$$('div[role="blockquote"] img[draggable="true"]');
	mediaData.isVideo = await article.$$eval('img[draggable="false"]', (els: { length: number; }) => els.length === 1);
	mediaData.avatar = await page.evaluate((e: HTMLImageElement) => e.src.replace('_bigger', ''), images[0]);

	// Remove the avatar
	for (const img of images.slice(1)) {
		const src = await page.evaluate((e: HTMLImageElement) => e.src, img);
		mediaData.media.push(src);
	}

	for (const img of quoteImages) {
		const src = await page.evaluate((e: HTMLImageElement) => e.src, img);
		quoteMedia.push(src);
	}

	// Remove quote images
	mediaData.media = mediaData.media.filter(function (val: string) {
		return quoteMedia.indexOf(val) < 0;
	});

	// Scrape profile metadata after media
	const profile = await article.$('a[role="link"][data-focusable="true"]');
	await profile.click();
	const button = await page.$x("//div[@role='button' and contains(string(), 'Yes, view profile')]");
	if (button.length > 0) {
		// Skip profile warning
		await page.evaluate((el: HTMLElement) => el.click(), button[0]);
	}
	await page.waitForSelector('nav[aria-label="Profile timelines"]');

	try {
		const bioElement = await page.$('div[data-testid="UserDescription"]');
		mediaData.bio = await page.evaluate((e: HTMLElement) => e.innerText, bioElement);
	} catch (err) {
		console.error(`${logSymbols.warning} No bio detected`);
	}

	await page.waitForTimeout(500); // Birthday renders later
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
