import { exec } from 'node:child_process';
import { TweetData } from '../util.js';
import { gotInstance, loadCheerio } from '../api.js';
import { CookieJar } from 'tough-cookie';
import _debug from 'debug';

const debug = _debug('twdl:video');

export function getVideo(tweetData: Partial<TweetData>): Promise<string> {
	function parsePage(jq: cheerio.Root) {
		if (jq('.alert-danger').text().indexOf('Uh-Oh!') > -1) {
			debug("First method didn't work, trying second method.");
			return getVideoSecond(tweetData) as any;
		}

		return jq('.dropbox-saver').attr('href');
	}

	return gotInstance(
		'https://www.savetweetvid.com/downloader',
		{
			method: 'POST',
			form: { url: tweetData.finalUrl },
		})
		.then(loadCheerio)
		.then(parsePage);
}


function getVideoSecond(tweetData: Partial<TweetData>) {
	const baseUrl = 'https://twittervideodownloader.com';

	type SortItem = [number, string];

	function getCsrfToken() {
		function parseToken(jq: cheerio.Root) {
			if (jq === undefined) {
				debug('Cheerio is undefined, check response.');
				return undefined;
			}

			const csrfToken = jq('input[name="csrfmiddlewaretoken"]');
			return csrfToken.length > 0 ? csrfToken.attr('value') : undefined;
		}

		return gotInstance.get(
			`${baseUrl}/`,
			{ cookieJar: cookieJar }
		)
			.then(loadCheerio, (err) => {
				debug('Error getting CSRF token: %s', err);
				return undefined;
			})
			.then(parseToken);
	}

	const cookieJar = new CookieJar();

	function getPageWithToken(csrfToken: string) {
		if (csrfToken === undefined) {
			debug('CSRF token is undefined, check response.');
			return undefined;
		}

		debug('Got CSRF token: %s', csrfToken);
		return gotInstance(
			`${baseUrl}/download`,
			{
				method: 'POST',
				form: {
					csrfmiddlewaretoken: csrfToken,
					tweet: tweetData.finalUrl,
				},
				headers: {
					Referer: `${baseUrl}/`,
				},
				cookieJar: cookieJar,
			})
	}

	function parsePage(jq: cheerio.Root) {
		if (jq === undefined) {
			debug('Cheerio is undefined, check response.');
			return undefined;
		}

		const links = jq('.button[download]');

		function mapSizeHref(_i: number, link: cheerio.Element): SortItem[] | undefined {
			const href = jq(link).attr('href');
			if (href) {
				try {
					const size = href
						.split('/')[7]
						.split('x')
						.reduce((p, c) => p * ~~c, 1);
					return [[size, href]];
				} catch (e) {
					return undefined;
				}
			}
		}

		function sortBySize(a: SortItem, b: SortItem) {
			return b[0] - a[0];
		}

		const sorted: SortItem[] = links.map(mapSizeHref)
			.get()
			.filter(Boolean)
			.sort(sortBySize);
		debug('Sorted: %j', sorted);

		if (sorted.length) {
			return sorted[0][1];
		}

		return undefined;
	}

	return getCsrfToken()
		.then(getPageWithToken)
		.then(loadCheerio)
		.then(parsePage, (err) => {
			debug('Error parsing page: %s', err);
			return undefined;
		});
}

export function downloadWithFfmpeg(playlistUrl: string, outputFilename: string) {
	return new Promise((resolve, reject) => {
		exec(`ffmpeg -y -i "${playlistUrl}" -c copy "${outputFilename}"`, (err, stdout, stderr) => {
			if (err) {
				reject(err);
			} else {
				resolve(stdout);
			}
		});
	});
}
