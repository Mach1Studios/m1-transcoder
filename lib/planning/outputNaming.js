const path = require('node:path');

function sanitizeSegment(value) {
	return String(value)
		.normalize('NFKD')
		.replace(/[^\w.-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function defaultOutputPath(job, outputFormat, fileProfile, baseDirectory = process.cwd()) {
	const spatialFiles = job.inputs.spatialAudio.files;
	const firstInput = path.resolve(baseDirectory, spatialFiles[0]);
	const inputDirectory = path.dirname(firstInput);
	const inputExtension = path.extname(firstInput);
	const inputStem = path.basename(firstInput, inputExtension);
	const suffix = sanitizeSegment(outputFormat.label);
	const basename = job.output.basename || `${inputStem}_${suffix}`;
	const directory = job.output.directory
		? path.resolve(baseDirectory, job.output.directory)
		: inputDirectory;

	return path.join(directory, `${sanitizeSegment(basename)}.${fileProfile.extension}`);
}

function resolveOutputPath(job, outputFormat, fileProfile, baseDirectory = process.cwd()) {
	if (job.output.path) {
		const requestedPath = path.resolve(baseDirectory, job.output.path);
		const extension = path.extname(requestedPath);
		if (extension.toLowerCase() === `.${fileProfile.extension}`) {
			return requestedPath;
		}
		return `${extension ? requestedPath.slice(0, -extension.length) : requestedPath}.${fileProfile.extension}`;
	}

	return defaultOutputPath(job, outputFormat, fileProfile, baseDirectory);
}

module.exports = {
	defaultOutputPath,
	resolveOutputPath,
	sanitizeSegment,
};
