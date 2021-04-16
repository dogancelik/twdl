import util = require('../util');

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
	const username = util.getUsername(tweetUrl),
		url = `http://gettwitterid.com/?user_name=${username}&submit=GET+USER+ID`,
		request = util.getRequest({ uri: url, cheerio: true });

	return request.then(function (jq: cheerio.Root) {
		const profileInfo = jq('.profile_info');
		let userId = undefined;

		if (profileInfo.length > 0) {
			userId = profileInfo.find('tr').first().find('td').last().text().trim();
			return userId;
		}

		return getIdFail(username);
	}, function() {
		return getIdFail(username);
	});
}
