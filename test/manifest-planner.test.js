const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
	FILE_PROFILES,
	OUTPUT_FORMATS,
	createJob,
	createManifest,
	getFileProfileFromLegacyValue,
	getOutputFormatFromLegacyValue,
	normalizeManifest,
	resolveOutputPath,
	validateManifest,
} = require('../lib');
const { buildJobPlan, PRO_TOOLS_8_PAN } = require('../lib/planning/buildJobPlan');

function fixture() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'm1-manifest-test-'));
	const inputPath = path.join(directory, 'Spatial Mix.wav');
	fs.writeFileSync(inputPath, '');
	return {
		directory,
		inputPath,
		cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
	};
}

test('default destinations stay beside the input and include the format', () => {
	const files = fixture();
	try {
		const job = createJob(files.inputPath);
		const manifest = validateManifest(normalizeManifest(createManifest([job])));
		const outputFormat = OUTPUT_FORMATS.find((format) => format.id === 'm1spatial-4');
		const fileProfile = FILE_PROFILES.find((profile) => profile.id === 'wav');
		const outputPath = resolveOutputPath(job, outputFormat, fileProfile, manifest.baseDirectory);
		assert.equal(path.dirname(outputPath), files.directory);
		assert.equal(path.basename(outputPath), 'Spatial_Mix_Mach1Spatial-4.wav');
	} finally {
		files.cleanup();
	}
});

test('modern names map to installed legacy CLI aliases', () => {
	assert.equal(OUTPUT_FORMATS.find((format) => format.id === 'm1spatial-8').cliName, 'M1Spatial');
	assert.equal(OUTPUT_FORMATS.find((format) => format.id === 'm1spatial-4').cliName, 'M1Horizon');
	assert.equal(getOutputFormatFromLegacyValue('2').id, 'm1spatial-4');
	assert.equal(getFileProfileFromLegacyValue('14').id, 'mp4-generated');
});

test('manifest validation refuses collisions and missing required assets', () => {
	const files = fixture();
	try {
		const first = createJob(files.inputPath, { id: 'first' });
		const second = createJob(files.inputPath, { id: 'second' });
		assert.throws(
			() => validateManifest(normalizeManifest(createManifest([first, second]))),
			/output collides/
		);

		const videoJob = createJob(files.inputPath, { id: 'video', fileType: 'mp4' });
		assert.throws(
			() => validateManifest(normalizeManifest(createManifest([videoJob]))),
			/requires a video input/
		);

		const invalidMultiMonoJob = createJob(files.inputPath, {
			id: 'invalid-multi-mono',
			outputLayout: 'multi-mono',
		});
		invalidMultiMonoJob.output.multiMono = {
			indexBase: 2,
			placement: 'adjacent',
		};
		assert.throws(
			() => validateManifest(normalizeManifest(createManifest([invalidMultiMonoJob]))),
			/output\.multiMono\.indexBase must be 0 or 1/
		);
	} finally {
		files.cleanup();
	}
});

test('8-to-4 plans use Mach1 Transcode with gain matching and no normalization', () => {
	const files = fixture();
	try {
		const job = createJob(files.inputPath, {
			id: 'gain-safe',
			proToolsOrder: 'pro-tools-8',
		});
		const manifest = validateManifest(normalizeManifest(createManifest([job])));
		const probe = {
			encodedBy: 'Pro Tools',
			audioStreams: [{ channels: 8, sampleRate: 48000, bitsPerSample: 24 }],
		};
		const plan = buildJobPlan(manifest, manifest.jobs[0], probe);
		assert.equal(plan.outputFormat.id, 'm1spatial-4');
		assert.deepEqual(plan.gainActions, {
			masterGainDb: -3.010299956639812,
			normalized: false,
			legacyPreGainLinear: null,
			matrixPolicy: 'mach1-transcode-constant-power-with-minus-3.0103-db-gain-match',
		});
		assert.equal(plan.stages[0].panFilter, PRO_TOOLS_8_PAN);
		assert.equal(plan.stages[1].kind, 'm1-transcode');
		assert.equal(plan.stages[1].inputFormat, 'M1Spatial');
		assert.equal(plan.stages[1].outputFormat, 'M1Horizon');
		assert.equal(plan.stages[1].masterGainDb, -3.010299956639812);
		assert.equal(plan.stages[1].normalize, false);
	} finally {
		files.cleanup();
	}
});

test('output layout plans multichannel or multi-mono packaging explicitly', () => {
	const files = fixture();
	try {
		const multiMonoJob = createJob(files.inputPath, {
			id: 'multi-mono',
			outputLayout: 'multi-mono',
			multiMonoIndexBase: 0,
			multiMonoPlacement: 'folder',
		});
		const manifest = validateManifest(normalizeManifest(createManifest([multiMonoJob])));
		const plan = buildJobPlan(
			manifest,
			manifest.jobs[0],
			{ encodedBy: null, audioStreams: [{ channels: 8, sampleRate: 48000, bitsPerSample: 24 }] }
		);
		assert.equal(plan.outputLayout, 'multi-mono');
		assert.equal(plan.stages.at(-1).outputLayout, 'multi-mono');
		assert.deepEqual(plan.stages.at(-1).multiMono, {
			indexBase: 0,
			placement: 'folder',
		});

		const defaultMultiMonoJob = createJob(files.inputPath, {
			id: 'default-multi-mono',
			outputLayout: 'multi-mono',
		});
		assert.deepEqual(defaultMultiMonoJob.output.multiMono, {
			indexBase: 1,
			placement: 'flat',
		});

		const compressedJob = createJob(files.inputPath, {
			id: 'compressed-multi-mono',
			fileType: 'm4a',
			outputLayout: 'multi-mono',
		});
		assert.throws(
			() => validateManifest(normalizeManifest(createManifest([compressedJob]))),
			/multi-mono output requires an uncompressed WAV or AIF/
		);
	} finally {
		files.cleanup();
	}
});

test('legacy gain and normalization behavior is explicit in shared plans', () => {
	const files = fixture();
	try {
		const ambisonic = createJob(files.inputPath, {
			id: 'ambisonic',
			outputFormat: 'foa-acn-sn3d',
		});
		const surround = createJob(files.inputPath, {
			id: 'surround',
			outputFormat: 'surround-5.1-smpte',
			outputPath: path.join(files.directory, 'surround.wav'),
		});
		for (const job of [ambisonic, surround]) {
			const manifest = validateManifest(normalizeManifest(createManifest([job])));
			const plan = buildJobPlan(
				manifest,
				manifest.jobs[0],
				{ encodedBy: null, audioStreams: [{ channels: 8, bitsPerSample: 24 }] }
			);
			if (job.id === 'ambisonic') {
				assert.equal(plan.gainActions.legacyPreGainLinear, 0.204);
				assert.equal(plan.stages[1].kind, 'legacy-input-gain');
			} else {
				assert.equal(plan.gainActions.normalized, true);
				assert.equal(plan.stages.find((stage) => stage.kind === 'm1-transcode').normalize, true);
			}
		}
	} finally {
		files.cleanup();
	}
});

test('every catalog output produces a stable, unambiguous plan', () => {
	const files = fixture();
	try {
		const recipeIds = new Set();
		for (const format of OUTPUT_FORMATS) {
			const job = createJob(files.inputPath, {
				id: `plan-${format.id}`,
				outputFormat: format.id,
			});
			if (format.customJson) {
				const jsonPath = path.join(files.directory, 'format.json');
				fs.writeFileSync(jsonPath, '{}');
				job.inputs.customFormatJson = jsonPath;
			}
			const manifest = validateManifest(normalizeManifest(createManifest([job])));
			const plan = buildJobPlan(
				manifest,
				manifest.jobs[0],
				{ encodedBy: null, audioStreams: [{ channels: 8, sampleRate: 48000, bitsPerSample: 24 }] }
			);
			assert.ok(plan.recipeId.startsWith(format.id));
			assert.ok(!recipeIds.has(plan.recipeId));
			recipeIds.add(plan.recipeId);
			const formatStage = plan.stages.find((stage) => stage.id === 'transcode-format');
			if (format.packaging === 'fold-down') {
				assert.equal(formatStage.kind, 'fold-down');
			} else if (format.cliName === 'M1Spatial' && !format.customJson) {
				assert.equal(formatStage.kind, 'copy-format');
			} else {
				assert.equal(formatStage.kind, 'm1-transcode');
			}
			assert.equal(plan.stages.at(-1).kind, 'package-output');
		}
		assert.equal(recipeIds.size, OUTPUT_FORMATS.length);
	} finally {
		files.cleanup();
	}
});

test('all output, container, video, static stereo, and custom JSON combinations plan', () => {
	const files = fixture();
	try {
		const stereoPath = path.join(files.directory, 'static-stereo.wav');
		const videoPath = path.join(files.directory, 'picture.mov');
		const jsonPath = path.join(files.directory, 'format.json');
		fs.writeFileSync(stereoPath, '');
		fs.writeFileSync(videoPath, '');
		fs.writeFileSync(jsonPath, '{}');
		const recipeIds = new Set();
		let plannedCount = 0;

		for (const format of OUTPUT_FORMATS) {
			for (const profile of FILE_PROFILES) {
				if (
					format.packaging === 'multi-mono'
					&& !(profile.audioCodec === 'pcm' && ['wav', 'aif'].includes(profile.container))
				) {
					continue;
				}
				for (const withStaticStereo of [false, true]) {
					const id = `${format.id}-${profile.id}-${withStaticStereo ? 'stereo' : 'spatial'}`;
					const job = createJob(files.inputPath, {
						id,
						outputFormat: format.id,
						fileType: profile.id,
						outputPath: path.join(files.directory, `${id}.${profile.extension}`),
					});
					if (withStaticStereo) job.inputs.staticStereo = stereoPath;
					if (profile.requiresVideo) job.inputs.video = videoPath;
					if (format.customJson) job.inputs.customFormatJson = jsonPath;

					const manifest = validateManifest(normalizeManifest(createManifest([job])));
					const plan = buildJobPlan(
						manifest,
						manifest.jobs[0],
						{ encodedBy: null, audioStreams: [{ channels: 8, sampleRate: 48000, bitsPerSample: 24 }] }
					);
					assert.ok(!recipeIds.has(plan.recipeId), `duplicate recipe ID: ${plan.recipeId}`);
					recipeIds.add(plan.recipeId);
					plannedCount += 1;
				}
			}
		}
		assert.equal(recipeIds.size, plannedCount);
	} finally {
		files.cleanup();
	}
});
