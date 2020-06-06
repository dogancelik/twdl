const rp = require('request-promise');

const util = require('../util');

function getVideo(tweetUrl) {
	// @ts-ignore
	return rp(util.getRequestConfig({
		uri: 'https://www.savetweetvid.com/downloader',
		method: 'POST',
		form: { url: tweetUrl },
	})).then(jq => {
		let rows = jq('a[download]').first().parent().parent().parent().children(),
			result = { res: 0, link: null };

		rows.each(function (i, el) {
			let row = jq(el),
				res = parseInt(row.children().eq(0).text().split('p')[0], 10);

			if (res > result.res) {
				result.res = res;
				result.link = row.find('a[download]');
			}
		});

		return result.link.attr('href');
	});
}

exports.getVideo = getVideo;