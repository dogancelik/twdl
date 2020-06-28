const rp = require('request-promise');

const util = require('../util');

function getVideo(tweetUrl) {
	// @ts-ignore
	return rp(util.getRequestConfig({
		uri: 'https://www.savetweetvid.com/downloader',
		method: 'POST',
		form: { url: tweetUrl },
	})).then(jq => {
		if (jq('.alert-danger').text().indexOf('Uh-Oh!') > -1) {
			return undefined;
		}

		return jq('.dropbox-saver').attr('href');
	});
}

exports.getVideo = getVideo;
