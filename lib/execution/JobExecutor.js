const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getStereoFoldDownFilter } = require('../../app/stereoFoldDown');
const { ProcessRunner } = require('./ProcessRunner');
const {
	createMultiMonoOutputPlan,
	ensureMultiMonoOutputDirectory,
} = require('../planning/multiMonoOutput');

function pcmCodecForBits(bitsPerSample, container = 'wav') {
	const bits = [16, 24, 32].includes(Number(bitsPerSample)) ? Number(bitsPerSample) : 24;
	const endian = container === 'aif' ? 'be' : 'le';
	return `pcm_s${bits}${endian}`;
}

function stagePathFor(outputPath, jobId) {
	const extension = path.extname(outputPath);
	const stem = path.basename(outputPath, extension);
	return path.join(path.dirname(outputPath), `.${stem}.${jobId}.partial${extension}`);
}

function replaceFile(sourcePath, outputPath, overwrite) {
	if (fs.existsSync(outputPath)) {
		if (!overwrite) {
			const error = new Error(`Output already exists: ${outputPath}`);
			error.code = 'OUTPUT_EXISTS';
			throw error;
		}
		fs.rmSync(outputPath, { force: true });
	}
	fs.renameSync(sourcePath, outputPath);
}

function inputArguments(inputFiles) {
	return inputFiles.flatMap((file) => ['-i', file]);
}

function mergeFilter(inputCount) {
	const inputs = Array.from({ length: inputCount }, (_, index) => `[${index}:a]`).join('');
	return `${inputs}amerge=inputs=${inputCount}[merged]`;
}

class JobExecutor {
	constructor(options) {
		this.toolchain = options.toolchain;
		this.onEvent = options.onEvent || (() => {});
		this.runner = options.runner || new ProcessRunner({ onEvent: this.onEvent });
		this.workspaceRoot = options.workspaceRoot || this.toolchain.tempDirectory || os.tmpdir();
	}

	async prepareInput(stage, workspace, bitsPerSample, signal) {
		const firstPassPath = path.join(workspace, 'input-spatial.wav');
		const preparedPath = path.join(workspace, 'input-prepared.wav');
		const codec = pcmCodecForBits(bitsPerSample);
		let args = ['-y', ...inputArguments(stage.inputFiles)];

		if (stage.layout === 'interleaved') {
			args.push('-map', '0:a:0');
			if (stage.panFilter) args.push('-af', stage.panFilter);
		} else {
			args.push(
				'-filter_complex', mergeFilter(stage.inputFiles.length),
				'-map', '[merged]',
				'-ac', String(stage.expectedChannels)
			);
		}
		args.push('-c:a', codec, firstPassPath);
		await this.runner.run(this.toolchain.ffmpeg, args, {
			cwd: workspace,
			signal,
			stage: stage.id,
		});

		if (!stage.staticStereoPath) return firstPassPath;

		await this.runner.run(this.toolchain.ffmpeg, [
			'-y',
			'-i', firstPassPath,
			'-i', stage.staticStereoPath,
			'-filter_complex', '[0:a][1:a]amerge=inputs=2[merged]',
			'-map', '[merged]',
			'-ac', String(stage.expectedChannels + 2),
			'-c:a', codec,
			preparedPath,
		], {
			cwd: workspace,
			signal,
			stage: stage.id,
		});
		return preparedPath;
	}

	async convertFormat(stage, inputPath, workspace, bitsPerSample, signal) {
		const convertedPath = path.join(workspace, 'format-output.wav');
		if (stage.kind === 'copy-format') {
			fs.copyFileSync(inputPath, convertedPath);
			return convertedPath;
		}
		if (stage.kind === 'fold-down') {
			await this.runner.run(this.toolchain.ffmpeg, [
				'-y',
				'-i', inputPath,
				'-af', getStereoFoldDownFilter(stage.inputChannels),
				'-c:a', pcmCodecForBits(bitsPerSample),
				convertedPath,
			], {
				cwd: workspace,
				signal,
				stage: stage.id,
			});
			return convertedPath;
		}

		const cliInputPath = path.basename(inputPath);
		const cliOutputPath = path.basename(convertedPath);
		const args = [
			'm1transcode',
			'-in-file', cliInputPath,
			'-in-fmt', stage.inputFormat,
			'-out-file', cliOutputPath,
			'-out-fmt', stage.outputFormat,
			'-master-gain', String(stage.masterGainDb),
			'-out-file-chans', '0',
		];
		if (stage.normalize) {
			args.push('-normalize');
		}
		if (stage.customFormatJsonPath) {
			args.push('-out-json', stage.customFormatJsonPath);
		}
		await this.runner.run(this.toolchain.m1Transcode, args, {
			cwd: workspace,
			signal,
			stage: stage.id,
		});
		return convertedPath;
	}

	async applyLegacyInputGain(stage, inputPath, workspace, bitsPerSample, signal) {
		const outputPath = path.join(workspace, 'legacy-gain-output.wav');
		await this.runner.run(this.toolchain.ffmpeg, [
			'-y',
			'-i', inputPath,
			'-af', `volume=${stage.gainLinear}`,
			'-c:a', pcmCodecForBits(bitsPerSample),
			outputPath,
		], {
			cwd: workspace,
			signal,
			stage: stage.id,
		});
		return outputPath;
	}

	async packageMultiMono(stage, inputPath, workspace, bitsPerSample, signal, overwrite) {
		const outputExtension = stage.fileProfile.extension === 'aif' ? 'aif' : 'wav';
		const outputStem = path.basename(stage.outputPath, path.extname(stage.outputPath));
		const channelCount = stage.outputFormat.channels || 8;
		const settings = {
			indexBase: 1,
			placement: 'flat',
			...(stage.multiMono || {}),
		};
		const outputPlan = createMultiMonoOutputPlan({
			outputPath: stage.outputPath,
			channelCount,
			extension: outputExtension,
			indexBase: settings.indexBase,
			useSubfolder: settings.placement === 'folder',
			padWidth: 2,
			outputPrefix: `${outputStem}_`,
		});
		ensureMultiMonoOutputDirectory(outputPlan.outputDirectory);
		const stagedOutputs = [];

		for (let channel = 0; channel < channelCount; channel += 1) {
			const finalPath = outputPlan.files[channel].outputPath;
			const stagedPath = stagePathFor(finalPath, `${channel + settings.indexBase}`);
			if (fs.existsSync(finalPath) && !overwrite) {
				const error = new Error(`Output already exists: ${finalPath}`);
				error.code = 'OUTPUT_EXISTS';
				throw error;
			}
			await this.runner.run(this.toolchain.ffmpeg, [
				'-y',
				'-i', inputPath,
				'-map_channel', `0.0.${channel}`,
				'-c:a', pcmCodecForBits(bitsPerSample, outputExtension),
				stagedPath,
			], {
				cwd: workspace,
				signal,
				stage: stage.id,
			});
			stagedOutputs.push({ stagedPath, finalPath });
		}

		for (const output of stagedOutputs) {
			replaceFile(output.stagedPath, output.finalPath, overwrite);
		}
		return stagedOutputs.map((output) => output.finalPath);
	}

	async packagePairFiles(stage, inputPath, workspace, bitsPerSample, signal, overwrite) {
		const outputStem = path.basename(stage.outputPath, path.extname(stage.outputPath));
		const outputDirectory = path.dirname(stage.outputPath);
		const stagedOutputs = [];

		for (let pair = 0; pair < 4; pair += 1) {
			const finalPath = path.join(outputDirectory, `${outputStem}_pair-${pair + 1}.wav`);
			const stagedPath = stagePathFor(finalPath, `pair-${pair + 1}`);
			const left = pair * 2;
			const right = left + 1;
			await this.runner.run(this.toolchain.ffmpeg, [
				'-y',
				'-i', inputPath,
				'-af', `pan=stereo|c0=c${left}|c1=c${right}`,
				'-c:a', pcmCodecForBits(bitsPerSample),
				stagedPath,
			], {
				cwd: workspace,
				signal,
				stage: stage.id,
			});
			stagedOutputs.push({ stagedPath, finalPath });
		}
		for (const output of stagedOutputs) {
			replaceFile(output.stagedPath, output.finalPath, overwrite);
		}
		return stagedOutputs.map((output) => output.finalPath);
	}

	async packageTbe(stage, inputPath, workspace, bitsPerSample, signal, overwrite) {
		const extension = path.extname(stage.outputPath);
		const stemPath = stage.outputPath.slice(0, -extension.length);
		const destinations = [
			{
				source: inputPath,
				finalPath: `${stemPath}_3D.wav`,
				channels: 8,
			},
		];
		if (stage.staticStereoPath) {
			destinations.push({
				source: stage.staticStereoPath,
				finalPath: `${stemPath}_ST.wav`,
				channels: 2,
			});
		}
		const stagedOutputs = [];
		for (const destination of destinations) {
			const stagedPath = stagePathFor(destination.finalPath, path.basename(workspace));
			if (fs.existsSync(destination.finalPath) && !overwrite) {
				const error = new Error(`Output already exists: ${destination.finalPath}`);
				error.code = 'OUTPUT_EXISTS';
				throw error;
			}
			await this.runner.run(this.toolchain.ffmpeg, [
				'-y',
				'-i', destination.source,
				'-map', '0:a:0',
				'-c:a', pcmCodecForBits(bitsPerSample),
				stagedPath,
			], {
				cwd: workspace,
				signal,
				stage: stage.id,
			});
			stagedOutputs.push({ stagedPath, finalPath: destination.finalPath });
		}
		for (const output of stagedOutputs) {
			replaceFile(output.stagedPath, output.finalPath, overwrite);
		}
		return stagedOutputs.map((output) => output.finalPath);
	}

	async packageMultiStreamVideo(stage, inputPath, stagedPath, workspace, signal) {
		const audioCodec = stage.fileProfile.audioCodec === 'pcm' ? 'pcm_s24le' : 'aac';
		const args = [
			'-y',
			'-i', stage.videoPath,
			'-i', inputPath,
			'-filter_complex',
			'[1:a]asplit=4[a0][a1][a2][a3];'
				+ '[a0]pan=stereo|c0=c0|c1=c1[p0];'
				+ '[a1]pan=stereo|c0=c2|c1=c3[p1];'
				+ '[a2]pan=stereo|c0=c4|c1=c5[p2];'
				+ '[a3]pan=stereo|c0=c6|c1=c7[p3]',
			'-map', '0:v:0',
			'-map', '[p0]',
			'-map', '[p1]',
			'-map', '[p2]',
			'-map', '[p3]',
			'-c:v', 'copy',
			'-c:a', audioCodec,
		];
		if (audioCodec === 'aac') args.push('-b:a', '256k');
		args.push('-shortest', stagedPath);
		await this.runner.run(this.toolchain.ffmpeg, args, {
			cwd: workspace,
			signal,
			stage: stage.id,
		});
	}

	async injectSpatialMetadata(stage, sourcePath, outputPath, workspace, signal) {
		if (!stage.fileProfile.injectSpatialMetadata) {
			fs.renameSync(sourcePath, outputPath);
			return;
		}
		const spatialTool = this.toolchain.spatialMedia;
		if (!fs.existsSync(spatialTool)) {
			throw new Error(`Spatial metadata tool not found: ${spatialTool}`);
		}
		const stereoMode = stage.fileProfile.projection || 'mono';
		await this.runner.run(spatialTool, [
			'-i',
			`--stereo=${stereoMode}`,
			'--spatial-audio',
			sourcePath,
			outputPath,
		], {
			cwd: workspace,
			signal,
			stage: 'inject-spatial-metadata',
		});
		fs.rmSync(sourcePath, { force: true });
	}

	async packageRegular(stage, inputPath, stagedPath, workspace, bitsPerSample, signal) {
		const profile = stage.fileProfile;
		const packagedAudioCodec = stage.outputFormat.id === 'apple-spatial-5.1-side'
			? 'eac3'
			: profile.audioCodec;
		const metadata = stage.outputFormat.id.startsWith('m1spatial-')
			? stage.outputFormat.id.replace('m1spatial-', 'mach1spatial-')
			: `mach1:${stage.outputFormat.id}`;
		let args = ['-y'];

		if (profile.generatedVideo) {
			args.push(
				'-f', 'lavfi',
				'-i', 'color=c=black:s=1920x1080:r=30',
				'-i', inputPath,
				'-map', '0:v:0',
				'-map', '1:a:0',
				'-c:v', 'libx264',
				'-pix_fmt', 'yuv420p',
				'-preset', 'medium',
				'-c:a', packagedAudioCodec === 'eac3' ? 'eac3' : 'aac',
				'-shortest'
			);
		} else if (profile.requiresVideo) {
			args.push(
				'-i', stage.videoPath,
				'-i', inputPath,
				'-map', '0:v:0',
				'-map', '1:a:0',
				'-c:v', 'copy',
				'-c:a', packagedAudioCodec === 'pcm'
					? pcmCodecForBits(bitsPerSample)
					: packagedAudioCodec
			);
			if (packagedAudioCodec === 'aac') args.push('-b:a', '512k');
			if (packagedAudioCodec === 'eac3') args.push('-b:a', '1024k');
			args.push('-shortest');
		} else {
			args.push('-i', inputPath, '-map', '0:a:0');
			if (profile.audioCodec === 'pcm') {
				args.push('-c:a', pcmCodecForBits(bitsPerSample, profile.container));
			} else if (profile.audioCodec === 'aac') {
				args.push('-c:a', 'aac', '-b:a', '512k');
			} else if (profile.audioCodec === 'vorbis') {
				args.push('-c:a', 'libvorbis', '-q:a', '8');
			} else if (profile.audioCodec === 'opus') {
				args.push('-c:a', 'libopus', '-b:a', '384k');
			}
		}

		args.push(
			'-metadata', `comment=${metadata}`,
			'-metadata', `ICMT=${metadata}`,
			stagedPath
		);
		await this.runner.run(this.toolchain.ffmpeg, args, {
			cwd: workspace,
			signal,
			stage: stage.id,
		});
	}

	async packageOutput(stage, inputPath, workspace, bitsPerSample, signal, overwrite) {
		fs.mkdirSync(path.dirname(stage.outputPath), { recursive: true });

		if (stage.outputLayout === 'multi-mono') {
			return this.packageMultiMono(stage, inputPath, workspace, bitsPerSample, signal, overwrite);
		}
		if (stage.outputFormat.packaging === 'tbe') {
			return this.packageTbe(stage, inputPath, workspace, bitsPerSample, signal, overwrite);
		}
		if (stage.outputFormat.packaging === 'multi-stream' && !stage.videoPath) {
			return this.packagePairFiles(stage, inputPath, workspace, bitsPerSample, signal, overwrite);
		}

		if (fs.existsSync(stage.outputPath) && !overwrite) {
			const error = new Error(`Output already exists: ${stage.outputPath}`);
			error.code = 'OUTPUT_EXISTS';
			throw error;
		}

		const stagedPath = stagePathFor(stage.outputPath, path.basename(workspace));
		const metadataStagedPath = stage.fileProfile.injectSpatialMetadata
			? stagePathFor(stage.outputPath, `${path.basename(workspace)}.metadata`)
			: stagedPath;

		if (stage.outputFormat.packaging === 'multi-stream') {
			await this.packageMultiStreamVideo(stage, inputPath, stagedPath, workspace, signal);
		} else {
			await this.packageRegular(stage, inputPath, stagedPath, workspace, bitsPerSample, signal);
		}

		if (stage.fileProfile.injectSpatialMetadata) {
			await this.injectSpatialMetadata(stage, stagedPath, metadataStagedPath, workspace, signal);
		}
		replaceFile(metadataStagedPath, stage.outputPath, overwrite);
		return [stage.outputPath];
	}

	async execute(plan, options = {}) {
		const signal = options.signal;
		const overwrite = options.overwrite || plan.stages.at(-1).collision === 'overwrite';
		const sourceAudio = options.sourceProbe.audioStreams[0] || {};
		const bitsPerSample = sourceAudio.bitsPerSample
			|| (String(sourceAudio.sampleFormat || '').includes('s32') ? 24 : 16);
		fs.mkdirSync(this.workspaceRoot, { recursive: true });
		const workspace = fs.mkdtempSync(path.join(this.workspaceRoot, `job-${plan.id}-`));
		let preparedPath;
		let convertedPath;

		try {
			for (const stage of plan.stages) {
				this.onEvent({ type: 'stageStarted', jobId: plan.id, stageId: stage.id });
				if (stage.kind === 'prepare-input') {
					preparedPath = await this.prepareInput(stage, workspace, bitsPerSample, signal);
				} else if (stage.kind === 'legacy-input-gain') {
					preparedPath = await this.applyLegacyInputGain(
						stage,
						preparedPath,
						workspace,
						bitsPerSample,
						signal
					);
				} else if (['copy-format', 'fold-down', 'm1-transcode'].includes(stage.kind)) {
					convertedPath = await this.convertFormat(stage, preparedPath, workspace, bitsPerSample, signal);
				} else if (stage.kind === 'package-output') {
					const outputs = await this.packageOutput(
						stage,
						convertedPath,
						workspace,
						bitsPerSample,
						signal,
						overwrite
					);
					this.onEvent({ type: 'stageCompleted', jobId: plan.id, stageId: stage.id });
					return {
						workspace,
						preparedInputPath: preparedPath,
						convertedPath,
						outputPath: outputs[0],
						outputs,
						bitsPerSample,
					};
				}
				this.onEvent({ type: 'stageCompleted', jobId: plan.id, stageId: stage.id });
			}
			throw new Error(`Plan ${plan.id} did not publish an output`);
		} catch (error) {
			error.workspace = workspace;
			throw error;
		}
	}

	cleanup(result) {
		if (result && result.workspace && fs.existsSync(result.workspace)) {
			fs.rmSync(result.workspace, { recursive: true, force: true });
		}
	}

	cancel() {
		this.runner.cancel();
	}
}

module.exports = {
	JobExecutor,
	pcmCodecForBits,
	replaceFile,
	stagePathFor,
};
