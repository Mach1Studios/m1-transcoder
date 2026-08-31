const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
	createMultiMonoOutputPlan,
	ensureMultiMonoOutputDirectory,
} = require('../lib/planning/multiMonoOutput');

test('multi-mono naming can start at zero or one without changing temp names', () => {
	const outputPath = path.join(os.tmpdir(), 'Mach1 Mix.wav');
	const zeroBased = createMultiMonoOutputPlan({
		outputPath,
		channelCount: 2,
		extension: 'wav',
		indexBase: 0,
	});
	const oneBased = createMultiMonoOutputPlan({
		outputPath,
		channelCount: 2,
		extension: 'wav',
		indexBase: 1,
	});

	assert.deepEqual(zeroBased.files.map((file) => file.outputFileName), ['000.wav', '001.wav']);
	assert.deepEqual(oneBased.files.map((file) => file.outputFileName), ['001.wav', '002.wav']);
	assert.deepEqual(oneBased.files.map((file) => file.sourceFileName), ['000.wav', '001.wav']);
});

test('multi-mono files can be flat or placed in a destination-named folder', () => {
	const destination = path.join(os.tmpdir(), 'exports', 'Mach1 Mix.ogg');
	const flat = createMultiMonoOutputPlan({
		outputPath: destination,
		channelCount: 1,
		extension: 'ogg',
	});
	const folder = createMultiMonoOutputPlan({
		outputPath: destination,
		channelCount: 1,
		extension: 'ogg',
		useSubfolder: true,
	});

	assert.equal(flat.outputDirectory, path.join(os.tmpdir(), 'exports'));
	assert.equal(flat.files[0].outputPath, path.join(os.tmpdir(), 'exports', '000.ogg'));
	assert.equal(folder.outputDirectory, path.join(os.tmpdir(), 'exports', 'Mach1 Mix'));
	assert.equal(folder.files[0].outputPath, path.join(os.tmpdir(), 'exports', 'Mach1 Mix', '000.ogg'));
});

test('multi-mono plans support batch-style stems and two-digit indices', () => {
	const outputPath = path.join(os.tmpdir(), 'exports', 'Mach1 Mix.wav');
	const plan = createMultiMonoOutputPlan({
		outputPath,
		channelCount: 2,
		extension: 'wav',
		indexBase: 1,
		useSubfolder: true,
		padWidth: 2,
		outputPrefix: 'Mach1 Mix_',
	});

	assert.equal(plan.outputDirectory, path.join(os.tmpdir(), 'exports', 'Mach1 Mix'));
	assert.deepEqual(
		plan.files.map((file) => file.outputFileName),
		['Mach1 Mix_01.wav', 'Mach1 Mix_02.wav']
	);
});

test('multi-mono output directory creation supports nested destination folders', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm1-multi-mono-test-'));
	const outputDirectory = path.join(root, 'nested', 'Mix');

	try {
		ensureMultiMonoOutputDirectory(outputDirectory);
		assert.equal(fs.statSync(outputDirectory).isDirectory(), true);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('multi-mono output rejects unsupported index bases', () => {
	assert.throws(
		() => createMultiMonoOutputPlan({
			outputPath: 'Mix.wav',
			channelCount: 8,
			extension: 'wav',
			indexBase: 2,
		}),
		/index base must be 0 or 1/
	);
});
