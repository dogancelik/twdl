import util = require('./util');

export interface CliOptions {
	format: string
	list: string
	avatar: boolean
	quote: boolean
	embed: boolean
	data: string
	text: boolean
	overwrite: boolean
	date: boolean
	cookie: string
	debug: boolean
}

export interface ModuleOptions {
	downloadUrlFn: Function
}

export type AllOptions = CliOptions & ModuleOptions;

export const CliOptions = {
	format: {
		alias: 'f',
		default: util.DEFAULT_FORMAT,
		describe: 'Set filename format',
		type: 'string'
	},

	list: {
		alias: 'l',
		default: '',
		describe: 'Load tweets from a file',
		type: 'string'
	},

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
	}
};

export function makeOptions(newOptions: Partial<AllOptions>) {
	let defaultOptions = {};
	for (const [key, value] of Object.entries(CliOptions)) {
		defaultOptions[key] = value.default;
	}

	return Object.assign(defaultOptions, newOptions);
}
