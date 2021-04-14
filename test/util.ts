import { assert } from 'chai';

import lib = require('../src/index');
import * as util from '../src/util';

const fake = {
	tweet: 'https://twitter.com/Minecraft/status/1258774679675904000',
	parsedMedia: {
		original: 'https://pbs.twimg.com/media/EXgQ5hJXgAAVPEP.jpg',
		extension: null,
		downloadUrl: 'https://pbs.twimg.com/media/EXgQ5hJXgAAVPEP.jpg:orig',
		basename: 'EXgQ5hJXgAAVPEP.jpg'
	}
};

describe('Util', function () {
	it('renderFormat should work', function (done) {
		let format = util.renderFormat('#username#/#original#', fake.parsedMedia, fake.tweet, {});
		assert.equal(format, 'Minecraft/EXgQ5hJXgAAVPEP.jpg', 'Rendered filename is incorrect');
		done();
	});
});
