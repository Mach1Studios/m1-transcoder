const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { BatchRunner, createJob, createManifest } = require('../lib');
const { EIGHT_TO_FOUR_GAIN_MATCH_DB } = require('../lib/planning/buildJobPlan');
const { probeMedia } = require('../lib/probe/ffprobe');
const { resolveToolchain } = require('../lib/toolchain/resolveToolchain');

function executableToolchain() {
	const toolchain = resolveToolchain();
	return ['ffmpeg', 'ffprobe', 'm1Transcode'].every((name) => fs.existsSync(toolchain[name]))
		? toolchain
		: null;
}

function generateInput(toolchain, outputPath, expression) {
	execFileSync(toolchain.ffmpeg, [
		'-y',
		'-f', 'lavfi',
		'-i', `aevalsrc=${expression}:s=48000:d=0.25`,
		'-c:a', 'pcm_s24le',
		outputPath,
	], { stdio: 'ignore' });
}

function audioFrameMd5(toolchain, filePath) {
	return execFileSync(toolchain.ffmpeg, [
		'-v', 'error',
		'-i', filePath,
		'-map', '0:a:0',
		'-f', 'framemd5',
		'-',
	], { encoding: 'utf8' });
}

test('synthetic 8-to-4 renders match the gain-matched Mach1 Transcode API', {
	timeout: 120000,
}, async (context) => {
	const toolchain = executableToolchain();
	if (!toolchain) {
		context.skip('Bundled Mach1/FFmpeg toolchain is not installed.');
		return;
	}

	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'm1-synthetic-test-'));
	const impulse = 'if(eq(n\\,100)\\,0.1\\,0)';
	const cases = {
		impulse: Array(8).fill(impulse).join('|'),
		correlated: Array(8).fill('0.05*sin(2*PI*440*t)').join('|'),
		uncorrelated: [440, 521, 613, 701, 809, 907, 1013, 1151]
			.map((frequency) => `0.05*sin(2*PI*${frequency}*t)`)
			.join('|'),
	};

	try {
		for (const [name, expression] of Object.entries(cases)) {
			const inputPath = path.join(directory, `${name}-8.wav`);
			const outputPath = path.join(directory, `${name}-engine-4.wav`);
			const referencePath = path.join(directory, `${name}-reference-4.wav`);
			generateInput(toolchain, inputPath, expression);

			execFileSync(toolchain.m1Transcode, [
				'm1transcode',
				'-in-file', inputPath,
				'-in-fmt', 'M1Spatial',
				'-out-file', referencePath,
				'-out-fmt', 'M1Horizon',
				'-master-gain', String(EIGHT_TO_FOUR_GAIN_MATCH_DB),
				'-out-file-chans', '0',
			], { stdio: 'ignore' });

			const job = createJob(inputPath, {
				id: name,
				outputPath,
				proToolsOrder: 'none',
				reportsEnabled: false,
			});
			const report = await new BatchRunner({ toolchain }).run(createManifest([job]), {
				reports: false,
				workspaceRoot: directory,
			});
			assert.equal(report.summary.failed, 0);
			assert.equal(report.results[0].status, 'completed');

			const outputProbe = await probeMedia(outputPath, toolchain);
			const stream = outputProbe.audioStreams[0];
			assert.equal(stream.channels, 4);
			assert.equal(stream.sampleRate, 48000);
			assert.equal(stream.bitsPerSample, 24);
			assert.equal(audioFrameMd5(toolchain, outputPath), audioFrameMd5(toolchain, referencePath));
		}
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

test('multi-mono output publishes one mono file per channel and isolates empty inputs', {
	timeout: 120000,
}, async (context) => {
	const toolchain = executableToolchain();
	if (!toolchain) {
		context.skip('Bundled Mach1/FFmpeg toolchain is not installed.');
		return;
	}

	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'm1 output layout test-'));
	const inputPath = path.join(directory, 'valid-8.wav');
	const emptyPath = path.join(directory, 'empty-8.wav');
	const outputPath = path.join(directory, 'multi-mono.wav');
	try {
		generateInput(
			toolchain,
			inputPath,
			Array(8).fill('0.05*sin(2*PI*440*t)').join('|')
		);
		fs.writeFileSync(emptyPath, '');
		const jobs = [
			createJob(inputPath, {
				id: 'multi-mono',
				outputPath,
				outputLayout: 'multi-mono',
				multiMonoIndexBase: 0,
				multiMonoPlacement: 'folder',
				proToolsOrder: 'none',
				reportsEnabled: true,
			}),
			createJob(emptyPath, {
				id: 'empty-input',
				outputPath: path.join(directory, 'empty-output.wav'),
				proToolsOrder: 'none',
				reportsEnabled: false,
			}),
		];
		const report = await new BatchRunner({ toolchain }).run(createManifest(jobs), {
			reports: true,
			workspaceRoot: directory,
		});
		assert.equal(report.summary.completed, 1);
		assert.equal(report.summary.failed, 1);

		const completed = report.results.find((result) => result.jobId === 'multi-mono');
		assert.equal(completed.outputLayout, 'multi-mono');
		assert.equal(completed.outputs.length, 4);
		assert.deepEqual(
			completed.outputs.map((output) => path.basename(output)),
			['multi-mono_00.wav', 'multi-mono_01.wav', 'multi-mono_02.wav', 'multi-mono_03.wav']
		);
		assert.equal(path.dirname(completed.outputs[0]), path.join(directory, 'multi-mono'));
		for (const output of completed.outputs) {
			assert.equal((await probeMedia(output, toolchain)).audioStreams[0].channels, 1);
		}

		const failed = report.results.find((result) => result.jobId === 'empty-input');
		assert.equal(failed.error.code, 'EMPTY_INPUT');
		assert.match(failed.error.message, /Input file is empty/);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
