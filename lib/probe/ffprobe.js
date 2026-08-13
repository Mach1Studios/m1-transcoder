const { ProcessRunner } = require('../execution/ProcessRunner');

async function probeMedia(filePath, toolchain, options = {}) {
	const runner = options.runner || new ProcessRunner();
	const { stdout } = await runner.run(toolchain.ffprobe, [
		'-v', 'error',
		'-show_entries',
		'format=filename,format_name,duration,size,bit_rate:format_tags=encoded_by,comment,ICMT:stream=index,codec_name,codec_type,sample_fmt,sample_rate,channels,channel_layout,bits_per_sample,duration',
		'-of', 'json',
		filePath,
	], {
		signal: options.signal,
		stage: 'probe',
	});
	const raw = JSON.parse(stdout);
	const audioStreams = (raw.streams || []).filter((stream) => stream.codec_type === 'audio');
	const firstAudio = audioStreams[0] || null;
	const tags = (raw.format && raw.format.tags) || {};

	return {
		path: filePath,
		formatName: raw.format ? raw.format.format_name : null,
		durationSeconds: Number((raw.format && raw.format.duration) || (firstAudio && firstAudio.duration) || 0),
		sizeBytes: Number((raw.format && raw.format.size) || 0),
		bitRate: Number((raw.format && raw.format.bit_rate) || 0),
		encodedBy: tags.encoded_by || tags.ENCODED_BY || null,
		comment: tags.ICMT || tags.comment || tags.COMMENT || null,
		audioStreams: audioStreams.map((stream) => ({
			index: Number(stream.index),
			codec: stream.codec_name || null,
			sampleFormat: stream.sample_fmt || null,
			sampleRate: Number(stream.sample_rate || 0),
			channels: Number(stream.channels || 0),
			channelLayout: stream.channel_layout || null,
			bitsPerSample: Number(stream.bits_per_sample || 0),
			durationSeconds: Number(stream.duration || 0),
		})),
	};
}

function isProToolsEightChannel(probe) {
	const stream = probe.audioStreams[0];
	return Boolean(
		stream
		&& stream.channels === 8
		&& typeof probe.encodedBy === 'string'
		&& probe.encodedBy.trim().toLowerCase() === 'pro tools'
	);
}

module.exports = {
	isProToolsEightChannel,
	probeMedia,
};
