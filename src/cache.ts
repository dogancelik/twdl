import { Response, Options } from 'got/dist/source';
import { Readable } from 'node:stream';
import LruCache from 'lru-cache';
import _debug from 'debug';
import fs from 'fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AllOptions, ICliOptions } from './options';

const debug = _debug('twdl:cache');

const lruCache = new LruCache({
	max: parseInt(process.env.TWDL_CACHE_MAX, 10) || 500,
	ttl: parseInt(process.env.TWDL_CACHE_TTL, 10) || (1000 * 60 * 60),
});

export function writeCache(response: Response, twdlOptions?: Partial<AllOptions>) {
	twdlOptions = twdlOptions || global.argv;

	if (twdlOptions?.cache) {
		const cacheName = getCacheName(response.request.options);
		if (!lruCache.has(cacheName) && cacheName) {
			if (response.body) {
				debug("Writing cache for '%s' to '%s'", response.url, cacheName);
				lruCache.set(cacheName, response.body);
			}
		}
	}
	return response;
}

export function readCache(requestOptions: Options, twdlOptions?: Partial<AllOptions>) {
	twdlOptions = twdlOptions || global.argv;

	if (!twdlOptions?.cache)
		return;

	const cacheName = getCacheName(requestOptions),
		cachedData = lruCache.get<string>(cacheName);
	if (cacheName && cachedData) {
		debug("Reading cache for '%s' from '%s'", requestOptions.url.toString(), cacheName);
		const response = new Readable({
			read() {
				this.push(cachedData);
				this.push(null);
			}
		}) as Response;
		response.statusCode = 200;
		response.headers = {};
		response.socket = null;
		response.complete = true;
		return response;
	}
}

function getCachePath() {
	let cachePath = process.env.TWDL_CACHE_PATH;
	if (!cachePath) {
		cachePath = path.join(tmpdir(), '/twdl-cache.json');
	}
	return cachePath;
}

export function dumpCache() {
	const cachePath = getCachePath();
	debug("Saving cache to '%s'", cachePath);
	const dump = lruCache.dump();
	return fs.writeFile(
		cachePath,
		JSON.stringify(dump),
		{ encoding: 'utf8' }
	);
}

export function reloadCache(twdlOptions?: Partial<AllOptions>) {
	twdlOptions = twdlOptions || global.argv;

	if (!twdlOptions?.cache) {
		debug('Cache is not loaded because it is disabled.');
		return Promise.resolve();
	}

	const cachePath = getCachePath();
	debug("Reloading cache from '%s'", cachePath);
	return fs.readFile(cachePath, 'utf8')
		.then(data => {
			try {
				const cache = JSON.parse(data);
				lruCache.load(cache);
			} catch (err) {
				debug("Failed to parse cache from '%s': %s", cachePath, err.toString());
			}
		}, err => {
			if (err.code !== 'ENOENT') {
				debug("Failed to reload cache from '%s' (%s)", cachePath, err.toString());
			}
		});
}

export function getCacheName(options: Options) {
	let url = options.url;
	if (typeof url === 'string') {
		url = new URL(url);
	}

	let match = url.href.match(/(nitter).*\/status\/([0-9]+)/i);
	if (match) {
		return `nitter-tweet-${match[2]}`;
	}

	match = url.href.match(/(nitter).*\/([a-z0-9_]+)/i);
	if (match) {
		return `nitter-user-${match[2]}`;
	}

	match = url.hostname.match(/savetweetvid/i);
	if (match) {
		const tweetUrl = decodeURIComponent(options.body as string);
		match = tweetUrl.match(/status\/([0-9]+)/i);
		if (match) {
			return `video-${match[1]}`;
		}
	}

	match = url.pathname.match(/find-twitter-id-answer/i);
	if (match) {
		const body = options.body as string;
		match = body.match(/username=([a-z0-9_]+)/i);
		if (match) {
			return `id-${match[1]}`;
		}
	}

	match = url.hostname.match(/tweeterid/i);
	if (match) {
		const body = options.body as string;
		match = body.match(/input=([a-z0-9_]+)/i);
		if (match) {
			return `id2-${match[1]}`;
		}
	}

	return false;
}
