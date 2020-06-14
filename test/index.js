const assert = require('chai').assert;

const index = require('../lib/index');
const util = require('../lib/util');

const tweets = [
	'https://twitter.com/Minecraft/status/1258774679675904000',
	'https://twitter.com/NVIDIAGeForce/status/1258069454312755201',
	'https://twitter.com/IGN/status/1271196450681167875'
];

const options = {
	avatar: false,
	embed: false,
	data: false,
	overwrite: true,
	format: util.DEFAULT_FORMAT,
	date: false,
	cookie: '',
};

function testIfAllDownloaded(results) {
	for (let log of results[0]) {
		assert.equal(log[0], 'downloaded');
	}
}

describe('Twdl', function () {
	this.timeout(15000);

	it('should find an image and download', function () {
		return index.downloadUrls([tweets[0]], options).then(testIfAllDownloaded);
	});

	it('should find a video and download', function () {
		return index.downloadUrls([tweets[1]], options).then((results) => {
			testIfAllDownloaded(results);
			let videoUrl = results[0][0][1];
			assert.match(videoUrl, /\.mp4/i, 'Media URL should be an mp4 video');
			return results;
		});
	});

	it('should find images and download', function () {
		return index.downloadUrls([tweets[2]], options).then((results) => {
			testIfAllDownloaded(results);
			assert.equal(results[0].length, 4, 'Media count should be 4');
		});
	});
});
