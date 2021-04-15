import * as lib from '../../';
import * as util from '../util';
import logSymbols from 'log-symbols';
import mergeOptions from 'merge-options';

export const command = 'download [urls..]';
export const aliases = ['d'];
export const desc = 'Download media of tweet(s)';

export const builder = mergeOptions(
	lib.CliOptions,
	lib.DownloadOptions,
	lib.DownloadInfoOptions
);

export function handler(argv) {
	util.loadUrls(argv);
	util.checkUrls(argv);
	util.reportUrls(argv);
	util.applyCookie(argv);

	lib.downloadUrls(argv.urls, argv).catch(function (err) {
		if (argv.debug) {
			throw err;
		} else {
			console.error(`${logSymbols.error} Error occurred:`, argv.g ? err : err.toString());
			process.exit(2);
		}
	});
}
