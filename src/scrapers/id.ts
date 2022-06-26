import { CookieJar } from 'tough-cookie';
import * as util from '../util.js';

function getIdFail(username: string): Promise<string> {
	const requestOptions = {
		method: 'POST',
		uri: 'https://tweeterid.com/ajax.php',
		body: `input=${username}`
	};

	return util.getRequest(requestOptions as any).then(function (id: string) {
		return id === 'error' ? undefined : id;
	});
}

export function getId(tweetUrl: string): Promise<string> {
	function getCsrfToken() {
		return util.getRequest({
			method: 'GET',
			uri: 'https://tools.codeofaninja.com/find-twitter-id',
			cookieJar: cookieJar,
			cheerio: true,
		}).then(function (jq: cheerio.Root) {
			const csrfToken = jq('meta[name="csrf-token"]');
			return csrfToken.length > 0 ? csrfToken.attr('content') : undefined;
		});
	}

	const username = util.getUsername(tweetUrl);
	const cookieJar = new CookieJar();

	return getCsrfToken().then(function (csrfToken: string) {
		return util.getRequest({
			method: 'POST',
			uri: 'https://tools.codeofaninja.com/find-twitter-id-answer',
			form: { _token: csrfToken, username: username },
			cheerio: true,
			cookieJar: cookieJar,
		});
	}).then(function (jq: cheerio.Root) {
		const match = jq('div').text().match(/Twitter Numeric ID: ([0-9]+)/);
		if (match) {
			return match[1];
		}

		return getIdFail(username);
	}, function(err) {
		return getIdFail(username);
	});
}

