const fs = require('node:fs');
const path = require('node:path');
const {
	normalizeManifest,
	validateManifest,
} = require('./manifest');
const { resolveToolchain, assertToolchain } = require('./toolchain/resolveToolchain');
const { probeMedia } = require('./probe/ffprobe');
const { buildJobPlan } = require('./planning/buildJobPlan');
const { JobExecutor } = require('./execution/JobExecutor');
const { analyzeConversion, REFERENCE_VERSION } = require('./reports/audioAnalysis');

class BatchRunner {
	constructor(options = {}) {
		this.onEvent = options.onEvent || (() => {});
		this.toolchain = options.toolchain || resolveToolchain(options);
		this.abortController = null;
		this.executor = null;
	}

	emit(event) {
		this.onEvent({
			timestamp: new Date().toISOString(),
			...event,
		});
	}

	cancel(reason = 'Batch cancelled') {
		if (this.abortController) {
			const error = new Error(reason);
			error.code = 'ABORT_ERR';
			this.abortController.abort(error);
		}
		if (this.executor) this.executor.cancel();
	}

	async run(rawManifest, options = {}) {
		const manifest = validateManifest(
			normalizeManifest(rawManifest, options.manifestPath || null),
			{ requireFiles: options.requireFiles !== false }
		);
		const requiredTools = options.dryRun
			? ['ffprobe']
			: ['ffmpeg', 'ffprobe', 'm1Transcode'];
		assertToolchain(this.toolchain, requiredTools);
		this.abortController = new AbortController();
		const signal = this.abortController.signal;
		const results = [];
		const report = {
			kind: 'mach1-transcoder.report',
			schemaVersion: 1,
			manifestKind: manifest.kind,
			startedAt: new Date().toISOString(),
			finishedAt: null,
			referenceVersion: REFERENCE_VERSION,
			summary: null,
			results,
		};

		this.emit({ type: 'batchStarted', total: manifest.jobs.filter((job) => job.enabled).length });
		for (const job of manifest.jobs) {
			if (!job.enabled) {
				results.push({
					jobId: job.id,
					status: 'disabled',
					inputPath: job.inputs.spatialAudio.files[0] || null,
					outputPath: null,
				});
				continue;
			}
			if (signal.aborted) {
				results.push({
					jobId: job.id,
					status: 'cancelled',
					inputPath: job.inputs.spatialAudio.files[0] || null,
					outputPath: null,
				});
				continue;
			}

			this.emit({ type: 'jobStarted', jobId: job.id });
			let execution = null;
			let plan = null;
			try {
				const firstInputPath = path.resolve(
					manifest.baseDirectory,
					job.inputs.spatialAudio.files[0]
				);
				if (fs.statSync(firstInputPath).size === 0) {
					const error = new Error(`Input file is empty: ${firstInputPath}`);
					error.code = 'EMPTY_INPUT';
					throw error;
				}
				const sourceProbe = await probeMedia(firstInputPath, this.toolchain, { signal });
				plan = buildJobPlan(manifest, job, sourceProbe);
				if (options.dryRun) {
					results.push({
						jobId: job.id,
						status: 'dry-run',
						recipeId: plan.recipeId,
						inputPath: plan.inputFiles[0],
						outputPath: plan.outputPath,
						plan,
					});
					this.emit({ type: 'jobCompleted', jobId: job.id, status: 'dry-run' });
					continue;
				}

				this.executor = new JobExecutor({
					toolchain: this.toolchain,
					onEvent: (event) => this.emit({ ...event, jobId: event.jobId || job.id }),
					workspaceRoot: options.workspaceRoot,
				});
				execution = await this.executor.execute(plan, {
					signal,
					sourceProbe,
					overwrite: options.overwrite,
				});
				execution.inputCliName = plan.resolvedInput.staticStereoPath
					? `${plan.inputFormat.cliName}+S`
					: plan.inputFormat.cliName;

				let measurements = null;
				if (plan.reportsEnabled && options.reports !== false) {
					measurements = await analyzeConversion({
						plan,
						execution,
						toolchain: this.toolchain,
						signal,
						onEvent: (event) => this.emit(event),
					});
				}
				const result = {
					jobId: job.id,
					status: 'completed',
					recipeId: plan.recipeId,
					inputPath: plan.inputFiles[0],
					outputPath: execution.outputPath,
					outputs: execution.outputs,
					inputFormat: plan.inputFormat.id,
					outputFormat: plan.outputFormat.id,
					fileType: plan.fileProfile.id,
					outputLayout: plan.outputLayout,
					resolvedInput: plan.resolvedInput,
					gainActions: plan.gainActions,
					measurements,
					reviewRequired: measurements ? measurements.reviewRequired : false,
					warnings: measurements ? measurements.warnings : [],
				};
				results.push(result);
				this.emit({
					type: 'jobCompleted',
					jobId: job.id,
					status: result.status,
					reviewRequired: result.reviewRequired,
				});
				this.executor.cleanup(execution);
				execution = null;
			} catch (error) {
				const cancelled = signal.aborted || error.code === 'ABORT_ERR';
				results.push({
					jobId: job.id,
					status: cancelled ? 'cancelled' : 'failed',
					inputPath: job.inputs.spatialAudio.files[0] || null,
					outputPath: plan ? plan.outputPath : null,
					recipeId: plan ? plan.recipeId : null,
					outputLayout: plan ? plan.outputLayout : job.output.layout,
					gainActions: plan ? plan.gainActions : null,
					error: {
						name: error.name,
						code: error.code || null,
						message: error.message,
						workspace: error.workspace || null,
					},
					warnings: [],
					reviewRequired: false,
				});
				this.emit({
					type: 'jobCompleted',
					jobId: job.id,
					status: cancelled ? 'cancelled' : 'failed',
					error: error.message,
				});
				if (execution && !manifest.defaults.keepFailedWorkspace) {
					this.executor.cleanup(execution);
				}
			}
		}

		report.finishedAt = new Date().toISOString();
		report.summary = {
			total: results.length,
			completed: results.filter((result) => result.status === 'completed').length,
			failed: results.filter((result) => result.status === 'failed').length,
			cancelled: results.filter((result) => result.status === 'cancelled').length,
			disabled: results.filter((result) => result.status === 'disabled').length,
			reviewRequired: results.filter((result) => result.reviewRequired).length,
		};
		this.emit({ type: 'batchCompleted', summary: report.summary });
		this.abortController = null;
		this.executor = null;
		return report;
	}
}

module.exports = {
	BatchRunner,
};
