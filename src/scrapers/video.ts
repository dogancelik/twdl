import { TweetData } from '../util.js';
import { gotInstance, loadCheerio } from '../api.js';

export function getVideo(tweetData: Partial<TweetData>): Promise<string> {
	function parsePage(jq: cheerio.Root) {
		if (jq('.alert-danger').text().indexOf('Uh-Oh!') > -1) {
			return undefined;
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
