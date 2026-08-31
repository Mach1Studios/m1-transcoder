const fs = require('node:fs');
const path = require('node:path');

function normalizeIndexBase(indexBase) {
	const normalized = Number(indexBase);
	if (normalized !== 0 && normalized !== 1) {
		throw new Error(`Multi-mono index base must be 0 or 1, received: ${indexBase}`);
	}
	return normalized;
}

function resolveMultiMonoOutputDirectory(outputPath, useSubfolder = false) {
	if (!outputPath) {
		throw new Error('Multi-mono output path is required.');
	}

	const destinationDirectory = path.dirname(outputPath);
	if (!useSubfolder) return destinationDirectory;

	const outputStem = path.basename(outputPath, path.extname(outputPath));
	if (!outputStem) {
		throw new Error('Multi-mono output path must include a folder name.');
	}
	return path.join(destinationDirectory, outputStem);
}

function createMultiMonoOutputPlan({
	outputPath,
	channelCount,
	extension,
	indexBase = 0,
	useSubfolder = false,
	padWidth = 3,
	outputPrefix = '',
}) {
	const normalizedChannelCount = Number(channelCount);
	if (!Number.isInteger(normalizedChannelCount) || normalizedChannelCount < 1) {
		throw new Error(`Multi-mono channel count must be a positive integer, received: ${channelCount}`);
	}

	const normalizedExtension = String(extension || '').replace(/^\./, '').toLowerCase();
	if (!/^[a-z0-9]+$/.test(normalizedExtension)) {
		throw new Error(`Invalid multi-mono output extension: ${extension}`);
	}

	const normalizedIndexBase = normalizeIndexBase(indexBase);
	const normalizedOutputPrefix = String(outputPrefix);
	const outputDirectory = resolveMultiMonoOutputDirectory(outputPath, useSubfolder);
	const files = Array.from({ length: normalizedChannelCount }, (_, channel) => {
		const sourceIndex = String(channel).padStart(padWidth, '0');
		const outputIndex = String(channel + normalizedIndexBase).padStart(padWidth, '0');
		const outputFileName = `${normalizedOutputPrefix}${outputIndex}.${normalizedExtension}`;
		return {
			sourceFileName: `${sourceIndex}.wav`,
			outputFileName,
			outputPath: path.join(outputDirectory, outputFileName),
		};
	});

	return {
		outputDirectory,
		files,
	};
}

function ensureMultiMonoOutputDirectory(outputDirectory) {
	fs.mkdirSync(outputDirectory, { recursive: true });
}

module.exports = {
	createMultiMonoOutputPlan,
	ensureMultiMonoOutputDirectory,
	normalizeIndexBase,
	resolveMultiMonoOutputDirectory,
};
