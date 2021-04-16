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
	argv.urls = urls;
	return urls;
}

export function checkUrls(argv) {
	if (Array.isArray(argv.urls) === false || argv.urls.length === 0) {
		console.error(`${logSymbols.error} No URL is provided. See 'twdl ${argv._[0]} --help'.`);
		process.exit(1);
	}
}

export function reportUrls(argv) {
	console.error(`${logSymbols.info} Received ${argv.urls.length} URL(s).`);
}

export function applyCookie(argv) {
	if (process.env.TWDL_COOKIE != null && argv.cookie === '') {
		argv.cookie = process.env.TWDL_COOKIE;
	}
}

export function exitOnError(isDebug: boolean, err: Error) {
	if (isDebug) {
		throw err;
	} else {
		console.error(`${logSymbols.error} Error occurred:`, isDebug ? err : err.toString());
		process.exit(2);
	}
}
