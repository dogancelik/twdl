import { CookieJar } from 'tough-cookie';
import { getUsername, TweetData } from '../util.js';
import { gotInstance, loadCheerio } from '../api.js';
import { Response } from 'got';

function getIdSecond(username: string): Promise<string | undefined> {
	function getResponse(response: Response) {
		const body = response.body as string;
		return body === 'error' ? undefined : body;
	}

	return gotInstance.post(
		'https://tweeterid.com/ajax.php',
		{ body: `input=${username}` }
	).then(getResponse);
}

export function getId(tweetData: Partial<TweetData>): Promise<string> {
	function getCsrfToken() {
		function parseToken(jq: cheerio.Root) {
			const csrfToken = jq('meta[name="csrf-token"]');
			return csrfToken.length > 0 ? csrfToken.attr('content') : undefined;
		}

		return gotInstance.get(
			'https://www.codeofaninja.com/tools/find-twitter-id',
			{ cookieJar: cookieJar }
		)
			.then(loadCheerio)
			.then(parseToken);
	}

	const username = getUsername(tweetData.finalUrl);
	const cookieJar = new CookieJar();

	function getIdWithToken(csrfToken: string) {
		return gotInstance.post(
			'https://www.codeofaninja.com/tools/find-twitter-id-answer',
			{
				form: { _token: csrfToken, username: username },
				cookieJar: cookieJar,
			});
	}

	function parseHtml(jq: cheerio.Root) {
		const match = jq('div').text().match(/Twitter Numeric ID: ([0-9]+)/);
		if (match) {
			return Promise.resolve(match[1]);
		}

		return getIdSecond(username);
	}

	function trySecondSite(err: Error) {
		return getIdSecond(username);
	}

	return getCsrfToken()
		.then(getIdWithToken)
		.then(loadCheerio)
		.then(parseHtml, trySecondSite);
}

