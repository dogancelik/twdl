import * as lib from '../../index.js';
import * as cliUtil from '../util.js';
import mergeOptions from 'merge-options';
import { AllOptions, DownloadUrlFuncReturn } from '../../options.js';
import * as util from '../../util.js';

export const command = 'info [urls..]';
export const aliases = ['i'];
export const desc = 'Print information from tweet(s)';

export const builder = mergeOptions(
	lib.CliOptions,
	lib.DownloadInfoOptions,
	lib.InfoOptions
);

export function handler(argv: Partial<AllOptions>) {
	cliUtil.loadUrls(argv);
	cliUtil.checkUrls(argv);
	cliUtil.reportUrls(argv);
	cliUtil.applyCookie(argv);

	argv.downloadUrlFn = argv.media ? printMediaOnly : printEmbedData;
	argv.embed = true;
	return lib.downloadUrls(argv.urls, argv)
		.catch((err) => cliUtil.debugError(argv.debug, err))
		.finally(cliUtil.exitWithCode);
}

function printMediaOnly(mediaUrl: string, tweetData: util.TweetData): DownloadUrlFuncReturn {
	let status;
	console.log(mediaUrl);
	return { status, mediaUrl, tweetUrl: tweetData.finalUrl };
}

function printEmbedData(mediaUrl: string, tweetData: util.TweetData, mediaData: util.MediaData, options: Partial<AllOptions>): DownloadUrlFuncReturn {
	let status;
	const embedData = util.createEmbedData(tweetData, util.parseMediaUrl(mediaUrl), mediaData, options);
	console.log(`${embedData}\n${util.SEPERATOR}`);
	return { status, mediaUrl, tweetUrl: tweetData.finalUrl };
}
