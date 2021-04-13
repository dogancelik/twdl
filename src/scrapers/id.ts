const rp = require('request-promise');

const util = require('../util');

function getIdFail(username) {
	let requestOptions = {
		method: 'POST',
		uri: 'https://tweeterid.com/ajax.php',
		body: `input=${username}`
	};

	return rp(requestOptions).then(function (id) {
		return id === 'error' ? undefined : id;
	});
}

exports.getId = function getId(tweetUrl) {
	let username = util.getUsername(tweetUrl),
		url = `http://gettwitterid.com/?user_name=${username}&submit=GET+USER+ID`,
		requestOptions = util.getRequestConfig({ uri: url });

	// @ts-ignore
	return rp(requestOptions).then(function (jq) {
		let profileInfo = jq('.profile_info');
		return profileInfo.length > 0 ? profileInfo.find('tr').first().find('td').last().text().trim() : undefined;
	}, function() {
		return getIdFail(username);
	});
};
