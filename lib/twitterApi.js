// Credits to: https://github.com/Mottl/GetOldTweets3/

const userAgents = [
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:63.0) Gecko/20100101 Firefox/63.0',
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:62.0) Gecko/20100101 Firefox/62.0',
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:61.0) Gecko/20100101 Firefox/61.0',
	'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:63.0) Gecko/20100101 Firefox/63.0',
	'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
	'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
	'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15',
];

function buildHeaders(config) {
	if (config.userAgent == null) {
		config.userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
	}

	return {
		'Host': "twitter.com",
		'User-Agent': config.userAgent,
		'Accept': "application/json, text/javascript, */*; q=0.01",
		'Accept-Language': "en-US,en;q=0.5",
		'X-Requested-With': "XMLHttpRequest",
		'Referer': config.url,
		'Connection': "keep-alive"
	};
}

exports.buildHeaders = buildHeaders;

function buildUrl(tweetCriteria) {
	let url = 'https://twitter.com/i/search/timeline?';

	if (!tweetCriteria.topTweets) {
		url += 'f=tweets&';
	}

	url += 'vertical=news&';
		+ 'src=typd&';
		+ 'include_available_features=1&';
		+ 'include_entities=1&';
		+ 'reset_error_state=false&';

	let urlGetData = '';

	if (tweetCriteria.querySearch) {
		urlGetData += tweetCriteria.querySearch;
	}

	if (Array.isArray(tweetCriteria.excludeWords)) {
		urlGetData += tweetCriteria.excludeWords.join(' -');
	}

	if (Array.isArray(tweetCriteria.username)) {
		let usernames = tweetCriteria.username.map(i => ' from:' + i).join(' OR ');
		if (usernames.length > 0) {
			urlGetData += usernames;
		}
	}

	if (tweetCriteria.within) {
		if (tweetCriteria.near) {
			urlGetData += ` near:"${tweetCriteria.near}" within:${tweetCriteria.within}`
		} else if (tweetCriteria.lat && tweetCriteria.lon) {
			urlGetData += ` geocode:${tweetCriteria.lat},${tweetCriteria.lon},${tweetCriteria.within}`
		}
	}

	if (tweetCriteria.since) {
		urlGetData += ' since:' + tweetCriteria.since
	}

	if (tweetCriteria.until) {
		urlGetData += ' until:' + tweetCriteria.until
	}

	if (tweetCriteria.minReplies) {
		urlGetData += ' min_replies:' + tweetCriteria.minReplies
	}

	if (tweetCriteria.minFaves) {
		urlGetData += ' min_faves:' + tweetCriteria.minFaves
	}

	if (tweetCriteria.minRetweets) {
		urlGetData += ' min_retweets:' + tweetCriteria.minRetweets
	}

	if (tweetCriteria.lang) {
		url += 'l=' + tweetCriteria.lang + '&';
	}

	url += 'q=' + encodeURIComponent(urlGetData) + '&';
	url += 'max_position=' + (tweetCriteria.maxPosition ? tweetCriteria.maxPosition : '');

	return url;
}

exports.buildUrl = buildUrl;