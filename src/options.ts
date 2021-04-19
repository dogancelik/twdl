import { MediaData, DEFAULT_FORMAT } from './util';

export type DownloadUrlFuncReturn = {
	status: string,
	mediaUrl: string,
	tweetUrl: string,
};
// eslint-disable-next-line no-unused-vars
export type DownloadUrlFunc = (mediaUrl: string, tweetUrl: string, mediaData: MediaData, options: Partial<AllOptions>) => DownloadUrlFuncReturn;

export interface ModuleOptions {
	downloadUrlFn: DownloadUrlFunc
}

export interface CliOptions {
	_: string,
	urls: string[],
	list: string,
	cookie: string,
	debug: boolean,
	format: string,
	embed: boolean,
	data: string,
	text: boolean,
	overwrite: boolean,
	date: boolean,
	avatar: boolean,
	quote: boolean,
	media: boolean,
}

export const CliOptions = {
	list: {
		alias: 'l',
		default: '',
		describe: 'Load tweets from a file',
		type: 'string'
	},

	cookie: {
		alias: 'k',
		default: '',
		describe: 'Send cookie to Twitter',
		type: 'string'
	},

	debug: {
		alias: 'g',
		default: false,
		describe: 'Enable verbose errors for debugging',
		type: 'boolean'
	},
};

export const DownloadOptions = {
	format: {
		alias: 'f',
		default: DEFAULT_FORMAT,
		describe: 'Set filename format',
		type: 'string'
	},

	embed: {
		alias: 'e',
		default: false,
		describe: 'Embed tweet metadata in Comment',
		type: 'boolean'
	},

	data: {
		alias: 'd',
		default: '',
		describe: 'Embed additional data in Comment',
		type: 'string'
	},

	text: {
		alias: 'x',
		default: false,
		describe: 'Write tweet metadata as text file',
		type: 'boolean'
	},

	overwrite: {
		alias: 'o',
		default: false,
		describe: 'Overwrite already existing file',
		type: 'boolean'
	},

	date: {
		alias: 't',
		default: false,
		describe: 'Replace file date with tweet date',
		type: 'boolean'
	},
};

export const DownloadInfoOptions = {
	avatar: {
		alias: 'a',
		default: false,
		describe: 'Include profile image',
		type: 'boolean'
	},

	quote: {
		alias: 'u',
		default: false,
		describe: 'Include images of quoted tweet',
		type: 'boolean'
	},
};

export const InfoOptions = {
	media: {
		alias: 'm',
		default: false,
		describe: 'Show media URL(s) only',
		type: 'boolean'
	},
}

export type AllOptions = CliOptions & ModuleOptions;

export function makeOptions(newOptions: Partial<AllOptions>): Partial<AllOptions> {
	const defaultOptions = {};
	for (const [key, value] of Object.entries(CliOptions)) {
		defaultOptions[key] = value.default;
	}

	return Object.assign(defaultOptions, newOptions);
}
