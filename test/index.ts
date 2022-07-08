/// <reference path="../src/global.d.ts" />
import { describe, it } from 'mocha';
import { assert } from 'chai';
import { tmpdir } from 'os';

import * as lib from '../src/index.js';
import { DownloadUrlFunc, makeOptions } from '../src/options.js';

const tweets = [
	'https://twitter.com/Minecraft/status/1258774679675904000',
	'https://twitter.com/NVIDIAGeForce/status/1258069454312755201',
	'https://twitter.com/IGN/status/1271196450681167875'
];

const testDir = tmpdir();
function makeTestOptions(downloadUrlFn?: DownloadUrlFunc) {
	const options = makeOptions({
		overwrite: true,
		format: `${testDir}/#original#`,
		cache: false, // Disable caching for testing
	});
	if (downloadUrlFn != null)
		options.downloadUrlFn = downloadUrlFn;

	global.argv = options; // For Got hooks

	return options;
}

function testIfAllDownloaded(results, expected = 'downloaded') {
	assert.equal(results[0][0].status, expected);
}

describe('Twdl', function () {
	this.timeout(30000);

	it('should find an image and download', async function () {
		const results = await lib.downloadUrls([tweets[0]], makeTestOptions());
		testIfAllDownloaded(results);
	});

	it('should find a video and download', async function () {
		const results = await lib.downloadUrls([tweets[1]], makeTestOptions());
		testIfAllDownloaded(results);
		const videoUrl = results[0][0].mediaUrl;
		assert.match(videoUrl, /\.mp4/i, 'Media URL should be an mp4 video');
	});

	it('should find images and download', async function () {
		const results = await lib.downloadUrls([tweets[2]], makeTestOptions());
		testIfAllDownloaded(results);
		assert.equal(results[0].length, 4, 'Media count should be 4');
	});

	it('should return with custom function', async function () {
		const notDownloaded = 'not downloaded';

		const myDownloadUrlFn: DownloadUrlFunc = (mediaUrl, tweetData, mediaData, options) => {
			return {
				status: notDownloaded,
				mediaUrl,
				tweetUrl: tweetData.finalUrl,
				errors: [],
			};
		};

		const results = await lib.downloadUrls([tweets[2]], makeTestOptions(myDownloadUrlFn));
		testIfAllDownloaded(results, notDownloaded);
	});
});
