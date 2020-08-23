const util = require('./util');

const options = {
	f: {
		alias: 'format',
		default: util.DEFAULT_FORMAT,
		describe: 'Set filename format',
		type: 'string'
	},

	l: {
		alias: 'list',
		default: '',
		describe: 'Load tweets from a file',
		type: 'string'
	},

	a: {
		alias: 'avatar',
		default: false,
		describe: 'Include profile image',
		type: 'boolean'
	},

	u: {
		alias: 'quote',
		default: false,
		describe: 'Include images of quoted tweet',
		type: 'boolean'
	},

	e: {
		alias: 'embed',
		default: false,
		describe: 'Embed tweet metadata in IPTC',
		type: 'boolean'
	},

	d: {
		alias: 'data',
		default: '',
		describe: 'Embed additional data in IPTC',
		type: 'string'
	},

	o: {
		alias: 'overwrite',
		default: false,
		describe: 'Overwrite already existing file',
		type: 'boolean'
	},

	t: {
		alias: 'date',
		default: false,
		describe: 'Replace file date with tweet date',
		type: 'boolean'
	},

	k: {
		alias: 'cookie',
		default: '',
		describe: 'Send cookie to Twitter',
		type: 'string'
	}
};

exports.options = options;

function makeOptions(newOptions) {
	let defaultOptions = {};
	for (const value of Object.values(options)) {
		defaultOptions[value.alias] = value.default;
	}

	return Object.assign(defaultOptions, newOptions);
}

exports.makeOptions = makeOptions;
