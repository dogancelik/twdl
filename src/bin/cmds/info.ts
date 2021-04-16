import * as lib from '../../';
import * as util from '../util';
import mergeOptions from 'merge-options';
import { AllOptions } from '../../options';
import { createEmbedData, MediaData, parseMediaUrl, SEPERATOR } from '../../util';

export const command = 'info [urls..]';
export const aliases = ['i'];
export const desc = 'Print information from tweet(s)';

export const builder = mergeOptions(
	lib.CliOptions,
	lib.DownloadInfoOptions,
	lib.InfoOptions
);

export function handler(argv: Partial<AllOptions>) {
	util.loadUrls(argv);
	util.checkUrls(argv);
	util.reportUrls(argv);
	util.applyCookie(argv);

	argv.downloadUrlFn = argv.media ? printMediaOnly : printEmbedData;
	argv.embed = true;
	lib.downloadUrls(argv.urls, argv).catch((err) => util.exitOnError(argv.debug, err));
}

function printMediaOnly(mediaUrl: string, tweetUrl: string) {
	let status;
	console.log(mediaUrl);
	return { status, mediaUrl, tweetUrl };
}

function printEmbedData(mediaUrl: string, tweetUrl: string, mediaData: MediaData, options: Partial<AllOptions>) {
	let status;
	const embedData = createEmbedData(tweetUrl, parseMediaUrl(mediaUrl), mediaData, options);
	console.log(`${embedData}\n${SEPERATOR}`);
	return { status, mediaUrl, tweetUrl };
}
