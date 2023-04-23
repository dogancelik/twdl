import { fileURLToPath } from 'url';
import path from 'path';
import updateNotifier from 'update-notifier';
import logSymbols from 'log-symbols';
import fs from 'fs';
import { AllOptions } from '../options.js';
import { CommandModule } from 'yargs';

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
	if (argv) {
		global.argv = argv;

		if (process.env.TWDL_COOKIE != null && argv.cookie === '') {
			argv.cookie = process.env.TWDL_COOKIE;
		}
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

export function getImportPath() {
	return path.dirname(fileURLToPath(import.meta.url));
}

export function checkForUpdates() {
	try {
		const packagePath = path.join(getImportPath(), '../../package.json');
		fs.readFile(packagePath, 'utf8', function (error, data) {
			if (error) throw error;
			const packageJson = JSON.parse(data);
			updateNotifier({ pkg: packageJson }).notify();
		});
	} catch (error) {
		console.error(`${logSymbols.error} Error occurred when checking for updates:`, error.toString());
	}
}

export function getCommand(module: CommandModule) {
	return [].concat(module.command, module.aliases);
}
