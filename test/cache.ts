import { describe, it } from 'mocha';
import { assert } from 'chai';
import { Options } from 'got/dist/source/index.js';
import * as cache from '../src/cache.js';

const testUrls = [
	{ url: 'http://unknown-domain.com/unknown-path' },
	{ url: 'https://twitter.com/Minecraft/status/1258774679675904000' },
	{ url: 'https://nitter.it/Minecraft/status/1258774679675904000' },
	{ url: 'https://twitter.com/Minecraft' },
	{ url: 'https://nitter.42l.fr/Minecraft' },
	{
		url: 'https://www.savetweetvid.com/downloader',
		body: 'url=https://twitter.com/Minecraft/status/1258774679675904000',
	},
	{ url: 'https://tools.codeofaninja.com/find-twitter-id' },
	{
		url: 'https://tools.codeofaninja.com/find-twitter-id-answer',
		body: 'username=Minecraft',
	},
	{
		url: 'https://tweeterid.com/ajax.php',
		body: 'input=Minecraft',
	},
] as Array<Partial<Options>>;

describe('Cache', function () {
	it('should get correct cache name', async function () {
		const cacheNames = testUrls
			.map(option => cache.getCacheName(option as Options));

		assert.deepEqual(cacheNames, [
			false,
			false,
			'nitter-tweet-1258774679675904000',
			false,
			'nitter-user-Minecraft',
			'video-1258774679675904000',
			false,
			'id-Minecraft',
			'id2-Minecraft',
		]);
	});
});
