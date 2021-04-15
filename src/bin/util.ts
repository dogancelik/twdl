import logSymbols from 'log-symbols';
import fs from 'fs';

export function loadUrls(argv) {
	let urls = argv.urls;
	if (argv.list !== '') {
		try {
			const text = fs.readFileSync(argv.list),
				textArray = text.toString().trim().split('\n');
			urls = urls.concat(textArray);
		} catch (e) {
			console.error(`${logSymbols.error} ${e.toString()}`);
		}
	}
	return urls;
}

export function checkUrls(argv) {
	if (Object.prototype.hasOwnProperty.call(argv, 'urls') === false ||
		argv.urls.length === 0) {
		console.error(`${logSymbols.error} No URL is provided. See 'twdl help'.`);
		process.exit(1);
	}
}

export function reportUrls(argv) {
	console.error(`${logSymbols.info} Received ${argv.urls.length} URLs.`);
}

export function applyCookie(argv) {
	if (process.env.TWDL_COOKIE != null && argv.cookie === '') {
		argv.cookie = process.env.TWDL_COOKIE;
	}
}
