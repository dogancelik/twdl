import rp = require('request-promise');

import util = require('../util');

export function getVideo(tweetUrl: string): string {
	return rp(util.getRequestConfig({
		uri: 'https://www.savetweetvid.com/downloader',
		method: 'POST',
		form: { url: tweetUrl },
	})).then((jq: cheerio.Root) => {
		if (jq('.alert-danger').text().indexOf('Uh-Oh!') > -1) {
			return undefined;
		}

		return jq('.dropbox-saver').attr('href');
	});
}
