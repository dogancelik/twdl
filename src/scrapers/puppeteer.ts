import puppeteer from 'puppeteer';
import { Browser, LaunchOptions } from 'puppeteer/lib/cjs/puppeteer/api-docs-entry';
import logSymbols = require('log-symbols');
import { AllOptions } from '../options';

let _browser = null;

export function cleanBrowser() {
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

export async function getMedia(tweetUrl: string, options: Partial<AllOptions>) {
	let browser = await getBrowser();
	const page = await browser.newPage();
	await page.goto(getEnglishUrl(tweetUrl));

	// Tweet failed to load
	page.waitForSelector('div[data-testid="primaryColumn"] > div > div > div > div > div + div[role="button"]')
		.then((refreshElement) => refreshElement.click(), () => {});

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
		.then((viewButton) => viewButton && viewButton.click(), () => {});

	let source = await article.$('div[dir] > a[href*="#source-labels"]'), // Source app (e.g. Twitter for Android)
		dateHandle = await page.evaluateHandle((e: HTMLElement) => e.previousElementSibling.previousElementSibling, source),
		dateText = (await page.evaluate((e: HTMLElement) => e.innerText, dateHandle)).replace(' · ', ' '),
		timestamp = Date.parse(dateText),
		date = new Date(timestamp),
		dateFormat = date.toISOString();

	let nameParts = await article.$$('a[role="link"][data-focusable="true"] > div > div > div[dir]'),
		nameElement = nameParts[0],
		name = await page.evaluate((e: HTMLElement) => e.innerText, nameElement),
		usernameElement = nameParts[nameParts.length - 1],
		username = await page.evaluate((e: { innerText: { replace: (arg0: string, arg1: string) => any; }; }) => e.innerText.replace('@', ''), usernameElement),
		userId = undefined;

	// Tweet related
	let textElement = await article.$('div[lang][dir]'),
		text = '';
	if (textElement != null) {
		text = await page.evaluate((e: HTMLElement) => e.innerText, textElement);
	}

	let media = [],
		quoteMedia = [],
		images = await article.$$('img[draggable="true"]'),
		quoteImages = await article.$$('div[role="blockquote"] img[draggable="true"]'),
		isVideo = await article.$$eval('img[draggable="false"]', (els: { length: number; }) => els.length === 1),
		avatar = await page.evaluate((e: HTMLImageElement) => e.src.replace('_bigger', ''), images[0]);

	// Remove the avatar
	for (let img of images.slice(1)) {
		let src = await page.evaluate((e: HTMLImageElement) => e.src, img);
		media.push(src);
	}

	for (let img of quoteImages) {
		let src = await page.evaluate((e: HTMLImageElement) => e.src, img);
		quoteMedia.push(src);
	}

	// Remove quote images
	media = media.filter(function (val: string) {
		return quoteMedia.indexOf(val) < 0;
	});

	// Scrape profile metadata after media
	let profile = await article.$('a[role="link"][data-focusable="true"]');
	await profile.click();
	let button = await page.$x("//div[@role='button' and contains(string(), 'Yes, view profile')]");
	if (button.length > 0) {
		// Skip profile warning
		await page.evaluate((el: HTMLElement) => el.click(), button[0]);
	}
	await page.waitForSelector('nav[aria-label="Profile timelines"]');

	let bio = undefined;
	try {
		let bioElement = await page.$('div[data-testid="UserDescription"]');
		bio = await page.evaluate((e: HTMLElement) => e.innerText, bioElement);
	} catch (err) {
		console.error(`${logSymbols.warning} No bio detected`);
	}

	await page.waitForTimeout(500); // Birthday renders later
	let headerItems = await page.$$eval('div[data-testid="UserProfileHeader_Items"] > *', (els: HTMLAnchorElement[]) => {
		return els.map((e) => e.tagName === 'A' ? `${e.href} (${e.innerText})` : e.innerText);
	}),
		location = undefined,
		website = undefined,
		birthday = undefined,
		joined = undefined;
	headerItems.forEach((item: string) => {
		if (item.startsWith('https:')) {
			website = item;
		}
		else if (item.startsWith('Born')) {
			birthday = item;
		}
		else if (item.startsWith('Joined')) {
			joined = item;
		}
		else {
			location = item;
		}
	});

	await page.close();
	return {
		name, username, userId, avatar,
		bio, location, website, birthday, joined,
		text, timestamp, date, dateFormat,
		isVideo, media, quoteMedia
	};
}
