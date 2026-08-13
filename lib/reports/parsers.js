function finiteOrNull(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseAstats(text) {
	const channels = [];
	let current = null;
	let overall = {};

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/^.*?\]\s*/, '').trim();
		const channelMatch = line.match(/^Channel:\s*(\d+)/i);
		if (channelMatch) {
			current = {
				index: Number(channelMatch[1]) - 1,
				semanticIndex: `M${String(Number(channelMatch[1])).padStart(2, '0')}`,
			};
			channels[current.index] = current;
			continue;
		}
		if (/^Overall$/i.test(line)) {
			current = overall;
			continue;
		}
		if (!current) continue;

		const measurement = line.match(/^(Peak level dB|RMS level dB|Peak count|Number of samples):\s*(.+)$/i);
		if (!measurement) continue;
		const key = measurement[1].toLowerCase();
		const value = finiteOrNull(measurement[2]);
		if (key === 'peak level db') current.samplePeakDbfs = value;
		if (key === 'rms level db') current.rmsDbfs = value;
		if (key === 'peak count') current.peakCount = value;
		if (key === 'number of samples') current.sampleCount = value;
	}

	const validChannels = channels.filter(Boolean);
	if (!validChannels.length && Object.keys(overall).length) {
		channels.push({
			index: 0,
			semanticIndex: 'M01',
			...overall,
		});
	}
	const maximumSamplePeakDbfs = validChannels.reduce(
		(maximum, channel) => (
			channel.samplePeakDbfs === null || channel.samplePeakDbfs === undefined
				? maximum
				: Math.max(maximum, channel.samplePeakDbfs)
		),
		Number.NEGATIVE_INFINITY
	);

	return {
		channels: channels.filter(Boolean),
		overall,
		maximumSamplePeakDbfs: Number.isFinite(maximumSamplePeakDbfs)
			? maximumSamplePeakDbfs
			: finiteOrNull(overall.samplePeakDbfs),
	};
}

function parseEbur128(text) {
	const summaryIndex = text.lastIndexOf('Summary:');
	const summary = summaryIndex >= 0 ? text.slice(summaryIndex) : text;
	const integrated = summary.match(/\bI:\s*(-?[\d.]+)\s+LUFS/i);
	const range = summary.match(/\bLRA:\s*(-?[\d.]+)\s+LU/i);
	const truePeak = summary.match(/\bPeak:\s*(-?[\d.]+)\s+dBFS/i);

	return {
		integratedLufs: integrated ? finiteOrNull(integrated[1]) : null,
		loudnessRangeLu: range ? finiteOrNull(range[1]) : null,
		truePeakDbtp: truePeak ? finiteOrNull(truePeak[1]) : null,
	};
}

function reportToCsv(report) {
	const rows = [
		['job_id', 'status', 'input_path', 'output_path', 'output_layout', 'input_lufs', 'output_lufs', 'delta_lu', 'input_rms_dbfs', 'output_rms_dbfs', 'input_true_peak_dbtp', 'output_true_peak_dbtp', 'review', 'error_code', 'error_message', 'warnings'],
	];
	for (const result of report.results || []) {
		const before = result.measurements && result.measurements.before;
		const after = result.measurements && result.measurements.after;
		const delta = result.measurements && result.measurements.delta;
		rows.push([
			result.jobId,
			result.status,
			result.inputPath || '',
			result.outputPath || '',
			result.outputLayout || '',
			before && before.reference ? before.reference.integratedLufs : '',
			after && after.reference ? after.reference.integratedLufs : '',
			delta ? delta.integratedLufs : '',
			before && before.reference ? before.reference.rmsDbfs : '',
			after && after.reference ? after.reference.rmsDbfs : '',
			before && before.reference ? before.reference.truePeakDbtp : '',
			after && after.reference ? after.reference.truePeakDbtp : '',
			result.reviewRequired ? 'yes' : 'no',
			result.error ? result.error.code || '' : '',
			result.error ? result.error.message || '' : '',
			(result.warnings || []).join('; '),
		]);
	}
	return rows
		.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
		.join('\n') + '\n';
}

module.exports = {
	parseAstats,
	parseEbur128,
	reportToCsv,
};
