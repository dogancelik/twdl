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

	e: {
		alias: 'embed',
		default: false,
		describe: 'Embed tweet & media URL in IPTC',
		type: 'boolean'
	},

	d: {
		alias: 'data',
		default: '',
		describe: 'Embed additional data',
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
	}
};

exports.options = options;