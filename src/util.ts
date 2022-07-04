/* eslint-disable no-unused-vars */
import url from 'url';
import path from 'path';
import { AllOptions } from './options.js';

export const SEPERATOR = '------------';

function getStatusId(tweetUrl: string) {
	return tweetUrl.match(/status\/([0-9]+)/)[1];
}

export function getUsername(tweetUrl: string, options?: Partial<AllOptions>, mediaData?: Partial<MediaData>): string {
	const usernameRegex = /([a-zA-Z0-9_]+)\/status/;

	if (mediaData?.finalUrl && options?.redirect) {
		return mediaData.username;
	}

	return tweetUrl.match(usernameRegex)[1];
}

export const DEFAULT_FORMAT = '#original#';

export interface ParsedMediaUrl {
	original: string,
	extension: string,
	downloadUrl: string,
	basename: string
}

export function parseMediaUrl(mediaUrl: string): ParsedMediaUrl {
	const parsed = url.parse(mediaUrl),
		data = {
			original: mediaUrl,
			extension: null,
			downloadUrl: parsed.href,
			basename: path.basename(parsed.pathname)
		} as ParsedMediaUrl;

	if (parsed.query !== null) {
		try {
			data.extension = parsed.query.match(/format=([a-z]+)/)[1];
			data.downloadUrl = parsed.href.split('?')[0];
		} catch {
			//
		}
	}

	if (data.extension !== null) {
		data.basename += '.' + data.extension;
		data.downloadUrl += '.' + data.extension;
	}

	if (data.downloadUrl.indexOf('pbs.twimg.com/media/') > -1) {
		data.downloadUrl += ':orig';
	}

	return data;
}

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export function renderFormat(
	formatStr: string,
	parsedMedia: ParsedMediaUrl,
	tweetData: TweetData,
	mediaData: Partial<MediaData>,
	options: Partial<AllOptions>
): string {
	const extname = path.extname(parsedMedia.basename),
		basename_noext = parsedMedia.basename.replace(extname, '');

	return formatStr
		.replace(/#tweet_id#/gi, getStatusId(tweetData.finalUrl))
		.replace(/#original#/gi, basename_noext)
		// Use original url (t.co)/old username or final url/latest username
		.replace(/#username#/gi, getUsername(tweetData.finalUrl, options, mediaData))
		+ extname;
}

export interface MediaData {
	error: Error;
	// Profile
	name: string;
	username: string;
	userId: string;
	avatar: string;
	bio: string;
	website: string;
	location: string;
	joined: string;
	birthday: string;
	// Tweet
	finalUrl: string;
	text: string;
	timestamp: number;
	date: Date;
	dateFormat: string;
	isVideo: boolean;
	media: string[];
	quoteMedia: string[];
	quoteRequest?: Promise<MediaData>;
	// Thread
	ancestors: Promise<string[]>;
	descendants: Promise<string[]>;
}

export function newMediaData(mediaData?: Partial<MediaData>): Partial<MediaData> {
	return Object.assign({
		error: false,
	}, mediaData);
}

export interface TweetData {
	originalUrl: string;
	finalUrl: string;
	username: string;
}

export function newTweetData(tweetData?: Partial<TweetData>): Partial<TweetData> {
	return Object.assign({
		originalUrl: '',
		finalUrl: '',
	}, tweetData);
}

export function createEmbedData(tweetData: TweetData, parsedMedia: ParsedMediaUrl, mediaData: MediaData, options: Partial<AllOptions>): string {
	let embedData = '';

	if (options.embed || options.text) {
		embedData += `
		Name: ${mediaData.name}
		Username: ${mediaData.username}
		ID: ${mediaData.userId}
		Bio: ${mediaData.bio}
		Website: ${mediaData.website}
		Location: ${mediaData.location}
		Birthday: ${mediaData.birthday}
		Joined: ${mediaData.joined}
		---
		Text: ${mediaData.text}
		Date: ${mediaData.dateFormat}
		Original URL: ${tweetData.originalUrl}
		Final URL: ${tweetData.finalUrl}
		Media: ${parsedMedia.downloadUrl}
		---`;
	}

	if (typeof options.data === 'string' && options.data.length > 0) {
		embedData += `
		Comment: ${options.data}
		`;
	}

	return embedData.trim().replace(/\t*/g, '');
}

export function normalizeUrl(url: string): Promise<string> {
	return Promise.resolve(
		url
			.replace(/^(http(s)?:\/\/)?/i, 'http$2://')
			.replace(/\/(photo|video)\/[1-4]$/i, '')
	);
}

export function noOp(): void {
	//
}
