const puppeteer = require('puppeteer');
const logSymbols = require('log-symbols');

const video = require('./video');

const launchOptions = {
};

let _browser = null;

async function getBrowser() {
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

async function getMedia(tweetUrl, includeAvatar) {
	let browser = await getBrowser();
	const page = await browser.newPage();
	await page.goto(getEnglishUrl(tweetUrl));

	page.waitForSelector('div[data-testid="primaryColumn"] > div > div > div > div > div + div[role="button"][data-focusable="true"][tabindex="0"]')
		.then((refreshElement) => refreshElement.click(), () => {});

	let article = await page.waitForSelector('article[role="article"][data-focusable="true"][tabindex="0"]');

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
		username = await page.evaluate(e => e.innerText, usernameElement),
		userId = undefined;

	// Tweet related
	let textElement = await article.$('div[lang][dir]'),
		text = await page.evaluate(e => e.innerText, textElement);

	let media = [],
		images = await article.$$('img[draggable="true"]'),
		isVideo = await article.$$eval('img[draggable="false"]', (els) => els.length === 1),
		avatar = await page.evaluate(e => e.src.replace('_bigger', ''), images[0]);

	if (includeAvatar) {
		media.push(avatar);
	}

	for (let e of images.slice(1)) {
		let src = await page.evaluate(e => e.src, e);
		media.push(src);
	}

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

	return {
		name, username, userId, avatar,
		bio, location, website, birthday, joined,
		text, timestamp, date, dateFormat,
		isVideo, media
	};
}

exports.getMedia = getMedia;