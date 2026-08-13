const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getStereoFoldDownFilter } = require('../../app/stereoFoldDown');
const { getInputFormat, getOutputFormat } = require('../catalog/formats');
const { ProcessRunner } = require('../execution/ProcessRunner');
const {
	EIGHT_TO_FOUR_GAIN_MATCH_DB,
	PRO_TOOLS_8_PAN,
} = require('../planning/buildJobPlan');
const { probeMedia } = require('../probe/ffprobe');
const { parseAstats, parseEbur128 } = require('./parsers');

const REFERENCE_VERSION = 'm1horizon-stereo-v2-api-gain-match';

async function analyzeAstats(filePath, toolchain, runner, signal, stage) {
	const { stderr } = await runner.run(toolchain.ffmpeg, [
		'-hide_banner',
		'-nostats',
		'-i', filePath,
		'-map', '0:a:0',
		'-af', 'astats=reset=0',
		'-f', 'null',
		'-',
	], { signal, stage });
	return parseAstats(stderr);
}

async function analyzeLoudness(filePath, toolchain, runner, signal, stage) {
	const { stderr } = await runner.run(toolchain.ffmpeg, [
		'-hide_banner',
		'-nostats',
		'-i', filePath,
		'-map', '0:a:0',
		'-af', 'ebur128=peak=true',
		'-f', 'null',
		'-',
	], { signal, stage });
	return parseEbur128(stderr);
}

async function extractFirstAudio(filePath, outputPath, toolchain, runner, signal, stage) {
	await runner.run(toolchain.ffmpeg, [
		'-y',
		'-i', filePath,
		'-map', '0:a:0',
		'-c:a', 'pcm_s24le',
		outputPath,
	], { signal, stage });
	return outputPath;
}

async function renderHorizonReference(options) {
	const {
		filePath,
		format,
		toolchain,
		runner,
		signal,
		workspace,
		prefix,
	} = options;
	const extractedPath = path.join(workspace, `${prefix}-analysis-source.wav`);
	const horizonPath = path.join(workspace, `${prefix}-horizon.wav`);
	const referencePath = path.join(workspace, `${prefix}-reference-stereo.wav`);

	await extractFirstAudio(
		filePath,
		extractedPath,
		toolchain,
		runner,
		signal,
		`${prefix}-extract`
	);

	if (format.cliName === 'M1Horizon') {
		fs.copyFileSync(extractedPath, horizonPath);
	} else {
		await runner.run(toolchain.m1Transcode, [
			'm1transcode',
			'-in-file', path.basename(extractedPath),
			'-in-fmt', format.cliName,
			'-out-file', path.basename(horizonPath),
			'-out-fmt', 'M1Horizon',
			'-master-gain', String(
				format.id === 'm1spatial-8' ? EIGHT_TO_FOUR_GAIN_MATCH_DB : 0
			),
			'-out-file-chans', '0',
		], {
			cwd: workspace,
			signal,
			stage: `${prefix}-reference-transcode`,
		});
	}

	await runner.run(toolchain.ffmpeg, [
		'-y',
		'-i', horizonPath,
		'-af', getStereoFoldDownFilter(4),
		'-c:a', 'pcm_s24le',
		referencePath,
	], {
		cwd: workspace,
		signal,
		stage: `${prefix}-reference-fold-down`,
	});
	return referencePath;
}

async function analyzeSide(options) {
	const {
		filePath,
		format,
		toolchain,
		runner,
		signal,
		workspace,
		prefix,
	} = options;
	const metadata = await probeMedia(filePath, toolchain, { runner, signal });
	const native = await analyzeAstats(
		filePath,
		toolchain,
		runner,
		signal,
		`${prefix}-native-levels`
	);
	let reference;
	let referenceFallback = null;

	try {
		const referencePath = await renderHorizonReference(options);
		const [loudness, levels] = await Promise.all([
			analyzeLoudness(
				referencePath,
				toolchain,
				new ProcessRunner(),
				signal,
				`${prefix}-reference-loudness`
			),
			analyzeAstats(
				referencePath,
				toolchain,
				new ProcessRunner(),
				signal,
				`${prefix}-reference-levels`
			),
		]);
		reference = {
			version: REFERENCE_VERSION,
			...loudness,
			rmsDbfs: levels.overall.rmsDbfs
				?? levels.channels.reduce(
					(maximum, channel) => Math.max(maximum, channel.rmsDbfs ?? Number.NEGATIVE_INFINITY),
					Number.NEGATIVE_INFINITY
				),
			maximumSamplePeakDbfs: levels.maximumSamplePeakDbfs,
		};
	} catch (error) {
		const [loudness, levels] = await Promise.all([
			analyzeLoudness(filePath, toolchain, new ProcessRunner(), signal, `${prefix}-container-loudness`),
			analyzeAstats(filePath, toolchain, new ProcessRunner(), signal, `${prefix}-container-levels`),
		]);
		reference = {
			version: 'container-fallback',
			...loudness,
			rmsDbfs: levels.overall.rmsDbfs ?? null,
			maximumSamplePeakDbfs: levels.maximumSamplePeakDbfs,
		};
		referenceFallback = error.message;
	}

	return {
		path: filePath,
		format: format.id,
		metadata,
		native,
		reference,
		referenceFallback,
	};
}

function subtract(after, before) {
	if (!Number.isFinite(after) || !Number.isFinite(before)) return null;
	return Number((after - before).toFixed(3));
}

async function analyzeConversion(options) {
	const {
		plan,
		execution,
		toolchain,
		signal,
		onEvent = () => {},
	} = options;
	const runner = options.runner || new ProcessRunner({ onEvent });
	const beforeFormat = {
		...plan.inputFormat,
		cliName: execution.inputCliName || plan.inputFormat.cliName,
	};
	const afterPath = execution.outputs.length === 1
		? execution.outputPath
		: execution.convertedPath;
	const warnings = [];
	if (plan.gainActions.normalized) {
		warnings.push('Legacy recipe compatibility: peak normalization is enabled.');
	}
	if (plan.gainActions.legacyPreGainLinear) {
		warnings.push(
			`Legacy recipe compatibility: input gain multiplier ${plan.gainActions.legacyPreGainLinear} is applied.`
		);
	}
	if (execution.outputs.length > 1) {
		warnings.push('Reference measurements use the pre-packaging interleaved artifact for this multi-file output.');
	}
	onEvent({ type: 'analysisStarted', jobId: plan.id });

	const before = await analyzeSide({
		filePath: execution.preparedInputPath,
		format: beforeFormat,
		toolchain,
		runner,
		signal,
		workspace: execution.workspace,
		prefix: 'before',
	});
	const after = await analyzeSide({
		filePath: afterPath,
		format: plan.outputFormat,
		toolchain,
		runner,
		signal,
		workspace: execution.workspace,
		prefix: 'after',
	});
	if (before.referenceFallback) {
		warnings.push(`Input reference fallback: ${before.referenceFallback}`);
	}
	if (after.referenceFallback) {
		warnings.push(`Output reference fallback: ${after.referenceFallback}`);
	}

	const delta = {
		integratedLufs: subtract(after.reference.integratedLufs, before.reference.integratedLufs),
		loudnessRangeLu: subtract(after.reference.loudnessRangeLu, before.reference.loudnessRangeLu),
		rmsDbfs: subtract(after.reference.rmsDbfs, before.reference.rmsDbfs),
		truePeakDbtp: subtract(after.reference.truePeakDbtp, before.reference.truePeakDbtp),
		maximumSamplePeakDbfs: subtract(
			after.native.maximumSamplePeakDbfs,
			before.native.maximumSamplePeakDbfs
		),
	};
	const loudnessReview = Number.isFinite(delta.integratedLufs) && Math.abs(delta.integratedLufs) > 0.5;
	const clippingReview = (
		Number.isFinite(after.reference.truePeakDbtp)
		&& after.reference.truePeakDbtp >= 0
	) || (
		Number.isFinite(after.native.maximumSamplePeakDbfs)
		&& after.native.maximumSamplePeakDbfs >= 0
	);
	if (loudnessReview) warnings.push(`Reference loudness changed by ${delta.integratedLufs} LU.`);
	if (clippingReview) warnings.push('Output reaches or exceeds 0 dBTP/dBFS.');

	onEvent({ type: 'analysisCompleted', jobId: plan.id });
	return {
		before,
		after,
		delta,
		reviewRequired: loudnessReview || clippingReview,
		warnings,
		referenceVersion: REFERENCE_VERSION,
	};
}

async function analyzeFilePair(options) {
	const toolchain = options.toolchain;
	const runner = options.runner || new ProcessRunner({ onEvent: options.onEvent });
	const workspaceRoot = options.workspaceRoot || toolchain.tempDirectory || os.tmpdir();
	fs.mkdirSync(workspaceRoot, { recursive: true });
	const workspace = fs.mkdtempSync(path.join(workspaceRoot, 'legacy-report-'));
	const preparedInputPath = path.join(workspace, 'input-prepared.wav');
	const inputFormat = getInputFormat(options.inputFormat || 'm1spatial-8');
	const outputFormat = getOutputFormat(options.outputFormat);

	try {
		const args = [
			'-y',
			'-i', options.inputPath,
			'-map', '0:a:0',
		];
		if (options.proToolsOrder === 'pro-tools-8') {
			args.push('-af', PRO_TOOLS_8_PAN);
		}
		args.push('-c:a', 'pcm_s24le', preparedInputPath);
		await runner.run(toolchain.ffmpeg, args, {
			signal: options.signal,
			stage: 'legacy-report-prepare',
		});

		const plan = {
			id: options.jobId || 'single-render',
			inputFormat,
			outputFormat,
			gainActions: options.gainActions || {
				masterGainDb: 0,
				normalized: false,
			},
		};
		const execution = {
			workspace,
			preparedInputPath,
			outputPath: options.outputPath,
			outputs: [options.outputPath],
			convertedPath: options.outputPath,
			inputCliName: inputFormat.cliName,
		};
		return await analyzeConversion({
			plan,
			execution,
			toolchain,
			signal: options.signal,
			runner,
			onEvent: options.onEvent,
		});
	} finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
}

module.exports = {
	REFERENCE_VERSION,
	analyzeAstats,
	analyzeConversion,
	analyzeFilePair,
	analyzeLoudness,
	analyzeSide,
	renderHorizonReference,
};
