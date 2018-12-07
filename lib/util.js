const SEPERATOR = '------------';

exports.SEPERATOR = SEPERATOR;

function getFilename(mediaUrl, tweetUrl) {
	let statusId = tweetUrl.match(/status\/([0-9]+)/)[1];
	return statusId + '_' + (
		mediaUrl.includes('video.twimg.com') ?
		mediaUrl.split('/')[8].split('?')[0] :
		mediaUrl.split('/')[4].split(':')[0]
	);
}

exports.getFilename = getFilename;