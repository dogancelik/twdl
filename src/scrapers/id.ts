import rp = require('request-promise');

import util = require('../util');

function getIdFail(username: string) {
	let requestOptions = {
		method: 'POST',
		uri: 'https://tweeterid.com/ajax.php',
		body: `input=${username}`
	};

	return rp(requestOptions).then(function (id: string) {
		return id === 'error' ? undefined : id;
	});
}

export function getId(tweetUrl: string): string {
	let username = util.getUsername(tweetUrl),
		url = `http://gettwitterid.com/?user_name=${username}&submit=GET+USER+ID`,
		requestOptions = util.getRequestConfig({ uri: url });

	// @ts-ignore
	return rp(requestOptions).then(function (jq: cheerio.Root) {
		let profileInfo = jq('.profile_info'),
			userId = undefined;

		if (profileInfo.length > 0) {
			userId = profileInfo.find('tr').first().find('td').last().text().trim();
			return userId;
		}

		return getIdFail(username);
	}, function() {
		return getIdFail(username);
	});
};
