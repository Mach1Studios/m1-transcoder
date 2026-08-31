const path = require('node:path');
const {
	getFileProfile,
	getInputFormat,
	getOutputFormat,
} = require('../catalog/formats');
const { resolveOutputPath } = require('./outputNaming');
const { isProToolsEightChannel } = require('../probe/ffprobe');

const PRO_TOOLS_8_PAN = 'pan=8c|c0=c0|c1=c2|c2=c1|c3=c6|c4=c7|c5=c4|c6=c5|c7=c3';
const EIGHT_TO_FOUR_GAIN_MATCH_DB = -3.010299956639812;

function resolveOptionalPath(value, baseDirectory) {
	if (!value) return null;
	if (typeof value === 'string') return path.resolve(baseDirectory, value);
	if (value.path) return path.resolve(baseDirectory, value.path);
	return null;
}

function buildRecipeId(job, outputFormat, fileProfile) {
	const variants = [
		outputFormat.id,
		fileProfile.id,
		job.output.layout || 'multichannel',
		job.inputs.staticStereo ? 'with-static-stereo' : 'spatial-only',
		job.inputs.video ? 'with-video' : (fileProfile.generatedVideo ? 'generated-video' : 'audio-only'),
		job.inputs.customFormatJson ? 'custom-json' : 'preset',
	];
	return variants.join('.');
}

function buildJobPlan(manifest, job, probe) {
	const baseDirectory = manifest.baseDirectory;
	const inputFormat = getInputFormat(job.inputs.spatialAudio.format);
	const outputFormat = getOutputFormat(job.output.format);
	const fileProfile = getFileProfile(job.output.fileType);
	const inputFiles = job.inputs.spatialAudio.files.map((file) => path.resolve(baseDirectory, file));
	const outputPath = resolveOutputPath(job, outputFormat, fileProfile, baseDirectory);
	const staticStereoPath = resolveOptionalPath(job.inputs.staticStereo, baseDirectory);
	const videoPath = resolveOptionalPath(job.inputs.video, baseDirectory);
	const customFormatJsonPath = resolveOptionalPath(job.inputs.customFormatJson, baseDirectory);
	const staticStereoForTranscode = outputFormat.packaging === 'tbe'
		? null
		: staticStereoPath;
	const legacyPreGainLinear = !staticStereoPath
		? (outputFormat.legacyPreGainLinear || null)
		: null;
	const legacyNormalize = Boolean(
		outputFormat.legacyNormalize
		|| (
			outputFormat.id === 'apple-spatial-5.1-side'
			&& (staticStereoPath || fileProfile.generatedVideo)
		)
	);

	let proToolsOrder = job.inputs.spatialAudio.proToolsOrder;
	if (proToolsOrder === 'auto') {
		proToolsOrder = isProToolsEightChannel(probe) ? 'pro-tools-8' : 'none';
	}

	if (probe && probe.audioStreams[0] && job.inputs.spatialAudio.layout === 'interleaved') {
		const actualChannels = probe.audioStreams[0].channels;
		if (actualChannels < inputFormat.channels) {
			throw new Error(
				`${job.id}: ${inputFormat.label} requires ${inputFormat.channels} channels, input has ${actualChannels}`
			);
		}
	}

	const inputCliName = staticStereoForTranscode
		? `${inputFormat.cliName}+S`
		: inputFormat.cliName;
	const isGainMatchedEightToFour = (
		inputFormat.id === 'm1spatial-8'
		&& outputFormat.id === 'm1spatial-4'
		&& !staticStereoForTranscode
	);
	const transcodeMasterGainDb = isGainMatchedEightToFour
		? EIGHT_TO_FOUR_GAIN_MATCH_DB
		: 0;
	const stages = [
		{
			id: 'prepare-input',
			kind: 'prepare-input',
			inputFiles,
			layout: job.inputs.spatialAudio.layout,
			proToolsOrder,
			panFilter: proToolsOrder === 'pro-tools-8' ? PRO_TOOLS_8_PAN : null,
			expectedChannels: inputFormat.channels,
			staticStereoPath: staticStereoForTranscode,
		},
	];
	if (legacyPreGainLinear) {
		stages.push({
			id: 'legacy-input-gain',
			kind: 'legacy-input-gain',
			gainLinear: legacyPreGainLinear,
		});
	}

	if (outputFormat.packaging === 'fold-down') {
		stages.push({
			id: 'transcode-format',
			kind: 'fold-down',
			inputChannels: inputFormat.channels + (staticStereoPath ? 2 : 0),
		});
	} else if (
		outputFormat.cliName === inputFormat.cliName
		&& !staticStereoForTranscode
		&& !outputFormat.customJson
	) {
		stages.push({
			id: 'transcode-format',
			kind: 'copy-format',
		});
	} else {
		stages.push({
			id: 'transcode-format',
			kind: 'm1-transcode',
			inputFormat: inputCliName,
			outputFormat: outputFormat.cliName,
			outputChannels: outputFormat.channels,
			customFormatJsonPath,
			masterGainDb: transcodeMasterGainDb,
			normalize: legacyNormalize,
		});
	}

	stages.push({
		id: 'package-output',
		kind: 'package-output',
		outputPath,
		outputLayout: outputFormat.packaging === 'multi-mono'
			? 'multi-mono'
			: job.output.layout,
		fileProfile,
		outputFormat,
		videoPath,
		staticStereoPath,
		collision: job.output.collision,
		multiMono: job.output.multiMono,
	});

	return {
		id: job.id,
		recipeId: buildRecipeId(job, outputFormat, fileProfile),
		inputFormat,
		outputFormat,
		fileProfile,
		inputFiles,
		outputPath,
		outputLayout: outputFormat.packaging === 'multi-mono'
			? 'multi-mono'
			: job.output.layout,
		reportsEnabled: job.reports.enabled,
		stages,
		resolvedInput: {
			layout: job.inputs.spatialAudio.layout,
			proToolsOrder,
			staticStereoPath,
			videoPath,
			customFormatJsonPath,
		},
		gainActions: {
			masterGainDb: transcodeMasterGainDb,
			normalized: legacyNormalize,
			legacyPreGainLinear,
			matrixPolicy: isGainMatchedEightToFour
				? 'mach1-transcode-constant-power-with-minus-3.0103-db-gain-match'
				: null,
		},
	};
}

module.exports = {
	EIGHT_TO_FOUR_GAIN_MATCH_DB,
	PRO_TOOLS_8_PAN,
	buildJobPlan,
	buildRecipeId,
};
