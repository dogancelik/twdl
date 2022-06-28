import logSymbols from 'log-symbols';
import fs from 'fs';
import { AllOptions } from '../options';

export function loadUrls(argv: Partial<AllOptions>) {
	let urls = argv.urls ?? [];
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

export interface ProcessStatus {
	exitError?: Error;
	exitCode: number;
}

declare module global {
	const processStatus: ProcessStatus;
}

export function checkUrls(argv: Partial<AllOptions>) {
	if (argv._.length > 1) {
		const urls = argv._.slice(1);
		argv.urls = urls;
	}

	if (Array.isArray(argv.urls) === false || argv.urls.length === 0) {
		console.error(`${logSymbols.error} No URL is provided. See 'twdl ${argv._[0]} --help'.`);
		global.processStatus.exitCode = 1;
	}
}

export function reportUrls(argv: Partial<AllOptions>) {
	console.error(`${logSymbols.info} Received ${argv.urls.length} URL(s).`);
}

export function applyCookie(argv: Partial<AllOptions>) {
	if (process.env.TWDL_COOKIE != null && argv.cookie === '') {
		argv.cookie = process.env.TWDL_COOKIE;
	}
}

export function debugError(isDebug: boolean, err: Error) {
	if (isDebug) {
		throw err;
	} else {
		console.error(`${logSymbols.error} Error occurred:`, err.toString());
		global.processStatus.exitError = err;
		global.processStatus.exitCode = 2;
	}
}

export function exitWithCode() {
	if (global.processStatus.exitCode) {
		process.exit(global.processStatus.exitCode);
	}
}
