import * as lib from '../../index.js';
import * as util from '../util.js';
import mergeOptions from 'merge-options';
import { AllOptions } from '../../options.js';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

export const command = 'thread [urls]';
export const aliases = ['t'];
export const desc = `Collect tweet URLs of ${chalk.underline('a single')} thread`;

export const builder = mergeOptions(
	lib.CliOptions,
);

export function handler(argv: Partial<AllOptions>) {
	return console.log(`${logSymbols.warning} The 'thread' command is disabled until further notice.`);

	argv.urls = argv.urls && [].concat(argv.urls);
	util.loadUrls(argv);
	util.checkUrls(argv);
	util.reportUrls(argv);
	util.applyCookie(argv);

	return lib
		.getThreadUrls(argv.urls[0], argv)
		.then(mediaData => {
			logSiblings('Ancestors', mediaData.ancestors as any as string[]);
			logSiblings('Descendants', mediaData.descendants as any as string[]);
		})
		.catch((err) => util.exitOnError(argv.debug, err));
}

function logSiblings(label: string, siblings: string[], bullet: string = '\n') {
	const log = label + ': ' +
		(!Array.isArray(siblings) ? 'None' :
			bullet + siblings.join(bullet));
	console.log(log);
}
