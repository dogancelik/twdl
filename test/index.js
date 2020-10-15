const assert = require('chai').assert;

const index = require('../lib/index');
const util = require('../lib/util');
const { makeOptions } = require('../lib/options');

const tweets = [
	'https://twitter.com/Minecraft/status/1258774679675904000',
	'https://twitter.com/NVIDIAGeForce/status/1258069454312755201',
	'https://twitter.com/IGN/status/1271196450681167875'
];

function makeTestOptions(downloadUrlFn) {
	let options = makeOptions({ overwrite: true });
	if (downloadUrlFn != null) options.downloadUrlFn = downloadUrlFn;
	return options;
}


function testIfAllDownloaded(results, expected = 'downloaded') {
	for (let log of results[0]) {
		assert.equal(log[0], expected);
	}
}

describe('Twdl', function () {
	this.timeout(30000);

	it('should find an image and download', async function () {
		let results = await index.downloadUrls([tweets[0]], makeTestOptions());
		testIfAllDownloaded(results);
	});

	it('should find a video and download', async function () {
		let results = await index.downloadUrls([tweets[1]], makeTestOptions());
		testIfAllDownloaded(results);
		let videoUrl = results[0][0][1];
		assert.match(videoUrl, /\.mp4/i, 'Media URL should be an mp4 video');
	});

	it('should find images and download', async function () {
		let results = await index.downloadUrls([tweets[2]], makeTestOptions());
		testIfAllDownloaded(results);
		assert.equal(results[0].length, 4, 'Media count should be 4');
	});

	it('should return with custom function', async function () {
		const notDownloaded = 'not downloaded';

		function downloadUrl(mediaUrl, tweetUrl, mediaData, options) {
			return [notDownloaded, mediaUrl];
		}

		let results = await index.downloadUrls([tweets[2]], makeTestOptions(downloadUrl));
		testIfAllDownloaded(results, notDownloaded);
	});
});
