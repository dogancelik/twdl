import * as lib from '../../';
import * as util from '../util';
import mergeOptions from 'merge-options';
import { AllOptions } from '../../options';
import chalk from 'chalk';

export const command = 'thread [urls]';
export const aliases = ['t'];
export const desc = `Collect tweet URLs of ${chalk.underline('a single')} thread`;

export const builder = mergeOptions(
	lib.CliOptions,
);

export function handler(argv: Partial<AllOptions>) {
	argv.urls = argv.urls && [].concat(argv.urls);
	util.loadUrls(argv);
	util.checkUrls(argv);
	util.reportUrls(argv);
	util.applyCookie(argv);

	lib
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
