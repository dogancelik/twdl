import { getRequest } from '../util';

export function getVideo(tweetUrl: string): Promise<string> {
	const promise = getRequest({
		uri: 'https://www.savetweetvid.com/downloader',
		method: 'POST',
		form: { url: tweetUrl },
		cheerio: true,
	});

	return promise.then((jq: cheerio.Root) => {
		if (jq('.alert-danger').text().indexOf('Uh-Oh!') > -1) {
			return undefined;
		}

		return jq('.dropbox-saver').attr('href');
	});
}
