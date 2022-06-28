import { assert } from 'chai';

import * as util from '../src/util.js';

const tweetData: util.TweetData = {
	originalUrl: 'https://t.co/W7iANhrGOv',
	finalUrl: 'https://twitter.com/Minecraft/status/1258774679675904000',
	username: 'Minecraft',
};

const parsedMedia: util.ParsedMediaUrl = {
	original: 'https://pbs.twimg.com/media/EXgQ5hJXgAAVPEP.jpg',
	extension: '.jpg',
	downloadUrl: 'https://pbs.twimg.com/media/EXgQ5hJXgAAVPEP.jpg:orig',
	basename: 'EXgQ5hJXgAAVPEP.jpg'
};

describe('Util', function () {
	it('renderFormat should work', function (done) {
		const format = util.renderFormat('#username#/#original#', parsedMedia, tweetData, {}, {});
		assert.equal(format, 'Minecraft/EXgQ5hJXgAAVPEP.jpg', 'Rendered filename is incorrect');
		done();
	});
});
