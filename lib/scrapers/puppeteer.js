const puppeteer = require('puppeteer');
const logSymbols = require('log-symbols');

let _browser = null;

/**
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function getBrowser(launchOptions) {
	launchOptions = launchOptions || {};

	if (_browser === null) {
		return (_browser = await puppeteer.launch(launchOptions));
	} else {
		return _browser;
	}
}

exports.getBrowser = getBrowser;

function getEnglishUrl(tweetUrl) {
	return tweetUrl.split('?')[0] + '?lang=en';
}

async function getMedia(tweetUrl) {
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
		.then(viewButton => viewButton && viewButton.click(), () => {});

	let source = await article.$('div[dir] > a[href*="#source-labels"]'), // Source app (e.g. Twitter for Android)
		dateHandle = await page.evaluateHandle(e => e.previousElementSibling.previousElementSibling, source),
		dateText = (await page.evaluate(e => e.innerText, dateHandle)).replace(' · ', ' '),
		timestamp = Date.parse(dateText),
		date = new Date(timestamp),
		dateFormat = date.toISOString();

	let nameParts = await article.$$('a[role="link"][data-focusable="true"] > div > div > div[dir]'),
		nameElement = nameParts[0],
		name = await page.evaluate(e => e.innerText, nameElement),
		usernameElement = nameParts[nameParts.length - 1],
		username = await page.evaluate(e => e.innerText.replace('@', ''), usernameElement),
		userId = undefined;

	// Tweet related
	let textElement = await article.$('div[lang][dir]'),
		text = '';
	if (textElement != null) {
		text = await page.evaluate(e => e.innerText, textElement);
	}

	let media = [],
		quoteMedia = [],
		images = await article.$$('img[draggable="true"]'),
		quoteImages = await article.$$('div[role="blockquote"] img[draggable="true"]'),
		isVideo = await article.$$eval('img[draggable="false"]', (els) => els.length === 1),
		avatar = await page.evaluate(e => e.src.replace('_bigger', ''), images[0]);

	// Remove the avatar
	for (let img of images.slice(1)) {
		let src = await page.evaluate(e => e.src, img);
		media.push(src);
	}

	for (let img of quoteImages) {
		let src = await page.evaluate(e => e.src, img);
		quoteMedia.push(src);
	}

	// Remove quote images
	media = media.filter(function (val) {
		return quoteMedia.indexOf(val) < 0;
	});

	// Scrape profile metadata after media
	let profile = await article.$('a[role="link"][data-focusable="true"]');
	await profile.click();
	await page.waitForSelector('nav[aria-label="Profile timelines"]');

	let bio = undefined;
	try {
		let bioElement = await page.$('div[data-testid="UserDescription"]');
		bio = await page.evaluate(e => e.innerText, bioElement);
	} catch (err) {
		console.error(`${logSymbols.warning} No bio detected`);
	}

	await page.waitFor(500); // Birthday renders later
	let headerItems = await page.$$eval('div[data-testid="UserProfileHeader_Items"] > *', (els) => {
		// @ts-ignore
		return els.map(e => e.tagName === 'A' ? `${e.href} (${e.innerText})` : e.innerText);
	}),
		location = undefined,
		website = undefined,
		birthday = undefined,
		joined = undefined;
	headerItems.forEach((item) => {
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

exports.getMedia = getMedia;
