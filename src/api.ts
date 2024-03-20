import * as got from 'got';
import logSymbols from 'log-symbols';
import mergeOptions from 'merge-options';
import cheerio from 'cheerio';
import { AllOptions } from './options.js';
import { normalizeUrl } from './util.js';
import * as cache from './cache.js';
import { getNitterOptions } from './scrapers/nitter.js';

interface OptionsCommon {
	uri?: string,
	headers?: got.Headers,
	body?: string,
}
export type OptionsWithUri = OptionsCommon & Partial<got.OptionsInit>;

export interface CheerioRoot extends cheerio.Root {
	finalUrl: string;
}

export interface GotResponse<T = unknown> extends got.Response<T> {
	finalUrl: string;
}

const userAgents = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.3',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.1',
];

export function getUserAgent(useCustom?: string | boolean): string {
	return typeof useCustom === 'string' ?
		useCustom :
		userAgents[Math.floor(Math.random() * userAgents.length)];
}

export function getRequestConfig(config: any, options: Partial<AllOptions>, userAgent?: string) {
	const newConfig = mergeOptions({
		headers: { 'User-Agent': getUserAgent(userAgent) }
	}, config);

	// TODO: Integrate cookie feature to GOT INSTANCE
	if (typeof options !== 'undefined' &&
		Object.prototype.hasOwnProperty.call(options, 'cookie') &&
		options.cookie.length > 0) {
		newConfig.headers.Cookie = options.cookie;
	}

	return newConfig;
}

export enum RequestType {
	FinalUrl,
	GetId,
	NitterMedia,
	NitterBio,
	PuppeteerMedia,
	VideoUrl,
}

export function downloadError(err: got.HTTPError & got.Response, requestType: RequestType) {
	function getRequestTypeText() {
		switch (requestType) {
			case RequestType.FinalUrl:
				return 'Request to get tweet URL';
			case RequestType.GetId:
				return 'Request to get user ID';
			case RequestType.NitterMedia:
				return 'Nitter media download';
			case RequestType.NitterBio:
				return 'Nitter bio download';
			case RequestType.PuppeteerMedia:
				return 'Puppeteer media download';
			case RequestType.VideoUrl:
				return 'Request to get video URL';
			default:
				return "Something else";
		}
	}

	const requestTypeText = getRequestTypeText(),
		statusCode = err?.statusCode || 0;

	if (err.name === 'HTTPError') {
		if (statusCode >= 400 && statusCode < 500) {
			console.log(`${logSymbols.error} ${requestTypeText} has failed. Tweet is probably deleted.`, statusCode);
		} else if (statusCode >= 500) {
			console.log(`${logSymbols.error} ${requestTypeText} has failed. There is a technical issue.`, statusCode);
		} else {
			console.log(`${logSymbols.error} ${requestTypeText} has failed. Unknown error.`, statusCode, err.message);
		}
	} else {
		throw err;
	}
}

function replaceNitterWithNew(url: string | URL) {
	if (typeof url === 'string') {
		try {
			url = new URL(url);
		}
		catch (e) {
			return url;
		}
	}

	if (/nitter/i.test(url.hostname) === false) {
		return url;
	}

	const nitterOptions = getNitterOptions();
	url.hostname = nitterOptions.uri.split('/')[2];
	return url;
}

function shouldRetry(response: got.Response<string>) {
	const isError = response.statusCode >= 400 && response.statusCode < 600,
		isNitter = /nitter/i.test(response.url),
		isNotFound = response.body.toString().includes('Tweet not found');

	return (
		isError &&
		(isNitter && isNotFound) === false
	);
}

export const gotInstance = got.got.extend({
	headers: {
		'User-Agent': getUserAgent(),
	},
	hooks: {
		beforeRequest: [
			(options) => cache.readCache(options),
		],
		afterResponse: [
			(response: got.Response, retryWithMergedOptions) => {
				if (shouldRetry(response as any)) {
					const newOptions: got.OptionsInit = {
						headers: {
							'User-Agent': getUserAgent(),
						},
					};
					/*
					gotInstance.defaults.options.merge(newOptions);
					*/
					const newUrl = replaceNitterWithNew(response.requestUrl as URL);
					return retryWithMergedOptions({
						...newOptions,
						url: newUrl,
					});
				}
				if (!response.request.options.resolveBodyOnly) {
					(response as GotResponse).finalUrl = response.url;
				}
				return response;
			},
			(response) => cache.writeCache(response),
		],
		beforeRetry: [
			error => {
				if (error?.request?.options?.url) {
					error.request.options.url = replaceNitterWithNew(error.request.options.url as URL);
					console.log(`${logSymbols.warning} Retrying to download again: '${error.request.options.url}'`);
				}
			}
		],
		beforeRedirect: [
			async (options, response) => {
				if (response.statusCode === 302 && options.url.toString().includes('twitter.com')) {
					let finalRedirectUrl = response.headers.location.startsWith('/')
						? options.url.toString()
						: response.headers.location;
					finalRedirectUrl = await normalizeUrl(finalRedirectUrl);
					options.url = finalRedirectUrl;
					options.followRedirect = false;
				}
			}
		],
	},
	retry: {
		methods: ['HEAD', 'GET', 'POST'],
		limit: 5,
		backoffLimit: 5000,
		statusCodes: [
			400, 404, 502, 530,
		],
		errorCodes: [
			'ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE',
			'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN', 'ERR_GOT_REQUEST_ERROR',
		],
	},
	timeout: {
		request: 5000,
	},
});

export function getFinalUrl(url: string): Promise<string> {
	function getLocation(response: got.Response) {
		const body = response.body as string;
		if (body && body.length > 0) {
			const match = body.match(/content="[0-9];URL=([^"]+)"/i);
			if (match && match.length > 1) {
				return match[1];
			}
		}

		const headers = response.headers;
		if (headers && headers.location && headers.location.includes('twitter.com')) {
			return headers.location;
		}

		return response.url;
	}

	function getFinalUrl(response: got.Response) {
		return response.url;
	}

	function decodeTco(permalink?: string) {
		return gotInstance.get(
			permalink ?? url,
			{ followRedirect: !!permalink }
		);
	}

	if (url.includes('twitter.com')) {
		return normalizeUrl(url);
	}

	return decodeTco()
		.then(getLocation)
		.then(normalizeUrl)
		.then(decodeTco) // Pass permalink
		.then(getFinalUrl);
}

export function loadCheerio(response: got.Response): CheerioRoot {
	const jq = cheerio.load(response.body as string) as CheerioRoot;
	jq.finalUrl = response.url;
	return jq;
}
