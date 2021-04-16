import * as lib from '../../';
import * as util from '../util';
import mergeOptions from 'merge-options';
import { AllOptions } from '../../options';

export const command = 'download [urls..]';
export const aliases = ['d'];
export const desc = 'Download media of tweet(s)';

export const builder = mergeOptions(
	lib.CliOptions,
	lib.DownloadOptions,
	lib.DownloadInfoOptions
);

export function handler(argv: Partial<AllOptions>) {
	util.loadUrls(argv);
	util.checkUrls(argv);
	util.reportUrls(argv);
	util.applyCookie(argv);

	lib.downloadUrls(argv.urls, argv).catch((err) => util.exitOnError(argv.debug, err));
}
