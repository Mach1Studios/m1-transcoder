const fs = require('node:fs');
const path = require('node:path');
const {
	getFileProfile,
	getInputFormat,
	getOutputFormat,
} = require('../catalog/formats');
const { resolveOutputPath } = require('../planning/outputNaming');

const MANIFEST_KIND = 'mach1-transcoder.batch';
const SCHEMA_VERSION = 1;

class ManifestValidationError extends Error {
	constructor(errors) {
		super(`Invalid batch manifest:\n${errors.map((error) => `- ${error}`).join('\n')}`);
		this.name = 'ManifestValidationError';
		this.errors = errors;
	}
}

function createJob(inputPath, overrides = {}) {
	const resolvedInput = path.resolve(inputPath);
	const stem = path.basename(resolvedInput, path.extname(resolvedInput));
	return {
		id: overrides.id || `${stem}-${Math.random().toString(36).slice(2, 8)}`,
		enabled: overrides.enabled !== false,
		inputs: {
			spatialAudio: {
				format: overrides.inputFormat || 'm1spatial-8',
				layout: overrides.layout || 'interleaved',
				files: [resolvedInput],
				proToolsOrder: overrides.proToolsOrder || 'none',
			},
			staticStereo: null,
			video: null,
			customFormatJson: null,
		},
		output: {
			format: overrides.outputFormat || 'm1spatial-4',
			fileType: overrides.fileType || 'wav',
			layout: overrides.outputLayout
				|| (overrides.outputFormat === 'm1spatial-sdk-multimono' ? 'multi-mono' : 'multichannel'),
			path: overrides.outputPath || null,
			directory: overrides.outputDirectory || null,
			basename: overrides.basename || null,
			collision: overrides.collision || 'fail',
		},
		reports: {
			enabled: overrides.reportsEnabled !== false,
		},
	};
}

function createManifest(jobs = [], overrides = {}) {
	return {
		kind: MANIFEST_KIND,
		schemaVersion: SCHEMA_VERSION,
		catalogVersion: 1,
		baseDirectory: overrides.baseDirectory || '.',
		defaults: {
			concurrency: 1,
			collision: overrides.collision || 'fail',
			keepFailedWorkspace: overrides.keepFailedWorkspace !== false,
			reports: {
				enabled: overrides.reportsEnabled !== false,
				referenceSampleRate: overrides.referenceSampleRate || 48000,
			},
		},
		jobs,
	};
}

function normalizeJob(rawJob, index, defaults) {
	const job = rawJob || {};
	const inputs = job.inputs || {};
	const spatialAudio = inputs.spatialAudio || {};
	const output = job.output || {};
	const reports = job.reports || {};

	return {
		id: String(job.id || `job-${index + 1}`),
		enabled: job.enabled !== false,
		inputs: {
			spatialAudio: {
				format: spatialAudio.format || 'm1spatial-8',
				layout: spatialAudio.layout || 'interleaved',
				files: Array.isArray(spatialAudio.files) ? spatialAudio.files.map(String) : [],
				proToolsOrder: spatialAudio.proToolsOrder || 'auto',
			},
			staticStereo: inputs.staticStereo || null,
			video: inputs.video || null,
			customFormatJson: inputs.customFormatJson || null,
		},
		output: {
			format: output.format || 'm1spatial-4',
			fileType: output.fileType || 'wav',
			layout: output.layout
				|| (output.format === 'm1spatial-sdk-multimono' ? 'multi-mono' : 'multichannel'),
			path: output.path || null,
			directory: output.directory || null,
			basename: output.basename || null,
			collision: output.collision || defaults.collision || 'fail',
		},
		reports: {
			enabled: reports.enabled !== undefined
				? Boolean(reports.enabled)
				: defaults.reports.enabled !== false,
		},
	};
}

function normalizeManifest(raw, manifestPath = null) {
	const defaults = {
		concurrency: 1,
		collision: 'fail',
		keepFailedWorkspace: true,
		reports: {
			enabled: true,
			referenceSampleRate: 48000,
		},
		...(raw.defaults || {}),
		reports: {
			enabled: true,
			referenceSampleRate: 48000,
			...((raw.defaults && raw.defaults.reports) || {}),
		},
	};
	const manifestDirectory = manifestPath ? path.dirname(path.resolve(manifestPath)) : process.cwd();
	const declaredBase = raw.baseDirectory || '.';

	return {
		kind: raw.kind || MANIFEST_KIND,
		schemaVersion: Number(raw.schemaVersion || SCHEMA_VERSION),
		catalogVersion: Number(raw.catalogVersion || 1),
		baseDirectory: path.resolve(manifestDirectory, declaredBase),
		defaults,
		jobs: Array.isArray(raw.jobs)
			? raw.jobs.map((job, index) => normalizeJob(job, index, defaults))
			: [],
	};
}

function validateManifest(manifest, options = {}) {
	const errors = [];
	const ids = new Set();
	const outputs = new Map();
	const requireFiles = options.requireFiles !== false;

	if (manifest.kind !== MANIFEST_KIND) {
		errors.push(`kind must be "${MANIFEST_KIND}"`);
	}
	if (manifest.schemaVersion !== SCHEMA_VERSION) {
		errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
	}
	if (manifest.defaults.concurrency !== 1) {
		errors.push('Only concurrency 1 is currently supported');
	}
	if (!manifest.jobs.length) {
		errors.push('At least one job is required');
	}

	for (const [index, job] of manifest.jobs.entries()) {
		const prefix = `jobs[${index}]`;
		if (ids.has(job.id)) {
			errors.push(`${prefix}.id must be unique (${job.id})`);
		}
		ids.add(job.id);

		let inputFormat;
		let outputFormat;
		let fileProfile;
		try {
			inputFormat = getInputFormat(job.inputs.spatialAudio.format);
		} catch (error) {
			errors.push(`${prefix}.inputs.spatialAudio.format: ${error.message}`);
		}
		try {
			outputFormat = getOutputFormat(job.output.format);
		} catch (error) {
			errors.push(`${prefix}.output.format: ${error.message}`);
		}
		try {
			fileProfile = getFileProfile(job.output.fileType);
		} catch (error) {
			errors.push(`${prefix}.output.fileType: ${error.message}`);
		}
		if (!['multichannel', 'multi-mono'].includes(job.output.layout)) {
			errors.push(`${prefix}.output.layout is unsupported`);
		}
		const isMultiMonoOutput = (
			job.output.layout === 'multi-mono'
			|| (outputFormat && outputFormat.packaging === 'multi-mono')
		);
		if (
			isMultiMonoOutput
			&& fileProfile
			&& !(fileProfile.audioCodec === 'pcm' && ['wav', 'aif'].includes(fileProfile.container))
		) {
			errors.push(`${prefix} multi-mono output requires an uncompressed WAV or AIF file type`);
		}
		if (
			isMultiMonoOutput
			&& outputFormat
			&& !Number.isInteger(outputFormat.channels)
		) {
			errors.push(`${prefix} multi-mono output requires a format with a known channel count`);
		}

		const spatialFiles = job.inputs.spatialAudio.files;
		if (!spatialFiles.length) {
			errors.push(`${prefix}.inputs.spatialAudio.files must not be empty`);
		}
		if (!['interleaved', 'horizon-four-stereo', 'multi-mono'].includes(job.inputs.spatialAudio.layout)) {
			errors.push(`${prefix}.inputs.spatialAudio.layout is unsupported`);
		}
		if (!['auto', 'none', 'pro-tools-8'].includes(job.inputs.spatialAudio.proToolsOrder)) {
			errors.push(`${prefix}.inputs.spatialAudio.proToolsOrder is unsupported`);
		}
		if (
			job.inputs.spatialAudio.proToolsOrder === 'auto'
			&& options.allowAutoOrder === false
		) {
			errors.push(`${prefix}.inputs.spatialAudio.proToolsOrder must be explicitly resolved for headless execution`);
		}
		if (job.inputs.spatialAudio.layout === 'horizon-four-stereo' && spatialFiles.length !== 4) {
			errors.push(`${prefix} horizon-four-stereo layout requires exactly four files`);
		}
		if (
			inputFormat
			&& job.inputs.spatialAudio.layout === 'multi-mono'
			&& spatialFiles.length !== inputFormat.channels
		) {
			errors.push(`${prefix} multi-mono layout requires exactly ${inputFormat.channels} files`);
		}
		if (inputFormat && job.inputs.spatialAudio.layout === 'interleaved' && inputFormat.channels < 1) {
			errors.push(`${prefix} input format has no channel definition`);
		}
		if (fileProfile && fileProfile.requiresVideo && !job.inputs.video) {
			errors.push(`${prefix} file profile ${fileProfile.id} requires a video input`);
		}
		if (outputFormat && outputFormat.customJson && !job.inputs.customFormatJson) {
			errors.push(`${prefix} custom-json output requires inputs.customFormatJson`);
		}

		for (const file of spatialFiles) {
			const resolved = path.resolve(manifest.baseDirectory, file);
			if (requireFiles && !fs.existsSync(resolved)) {
				errors.push(`${prefix} input does not exist: ${resolved}`);
			}
		}
		for (const [assetName, assetValue] of [
			['staticStereo', job.inputs.staticStereo],
			['video', job.inputs.video],
			['customFormatJson', job.inputs.customFormatJson],
		]) {
			if (!assetValue) continue;
			const assetPath = typeof assetValue === 'string' ? assetValue : assetValue.path;
			if (!assetPath) {
				errors.push(`${prefix}.inputs.${assetName} must contain a path`);
				continue;
			}
			const resolved = path.resolve(manifest.baseDirectory, assetPath);
			if (requireFiles && !fs.existsSync(resolved)) {
				errors.push(`${prefix}.inputs.${assetName} does not exist: ${resolved}`);
			}
		}

		if (outputFormat && fileProfile && spatialFiles.length) {
			const outputPath = resolveOutputPath(job, outputFormat, fileProfile, manifest.baseDirectory);
			if (outputs.has(outputPath)) {
				errors.push(`${prefix} output collides with job ${outputs.get(outputPath)}: ${outputPath}`);
			}
			outputs.set(outputPath, job.id);
			for (const file of spatialFiles) {
				if (path.resolve(manifest.baseDirectory, file) === outputPath) {
					errors.push(`${prefix} output must not overwrite an input`);
				}
			}
		}
	}

	if (errors.length) {
		throw new ManifestValidationError(errors);
	}
	return manifest;
}

function loadManifest(filePath, options = {}) {
	const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	return validateManifest(normalizeManifest(raw, filePath), options);
}

function saveManifest(filePath, manifest) {
	const serializable = {
		...manifest,
		baseDirectory: manifest.baseDirectory || '.',
	};
	fs.writeFileSync(filePath, `${JSON.stringify(serializable, null, 2)}\n`, 'utf8');
}

module.exports = {
	MANIFEST_KIND,
	ManifestValidationError,
	SCHEMA_VERSION,
	createJob,
	createManifest,
	loadManifest,
	normalizeManifest,
	saveManifest,
	validateManifest,
};
