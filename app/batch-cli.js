#!/usr/bin/env node

const path = require('node:path');
const { parseArgs } = require('node:util');
const { BatchRunner } = require('../lib/BatchRunner');
const { loadManifest } = require('../lib/manifest');
const { saveCsvReport, saveJsonReport } = require('../lib/reports/reportIO');
const { DependencyError, resolveToolchain } = require('../lib/toolchain/resolveToolchain');

const EXIT_CODES = Object.freeze({
	SUCCESS: 0,
	USAGE_OR_MANIFEST: 1,
	DEPENDENCY: 2,
	JOB_FAILURE: 3,
	CANCELLED: 4,
});

function usage() {
	return [
		'M1-Transcoder batch runner',
		'',
		'Usage:',
		'  node app/batch-cli.js --batch manifest.json [options]',
		'  M1-Transcoder --batch manifest.json [options]',
		'',
		'Options:',
		'  --report <path>  Save aggregate .json or .csv report',
		'  --dry-run        Validate, probe, and print resolved plans',
		'  --overwrite      Allow replacing existing outputs',
		'  --no-analysis    Skip gain and loudness analysis',
		'  --help           Show this help',
	].join('\n');
}

function parseCliArgs(argv) {
	return parseArgs({
		args: argv,
		options: {
			batch: { type: 'string' },
			report: { type: 'string' },
			'dry-run': { type: 'boolean', default: false },
			overwrite: { type: 'boolean', default: false },
			'no-analysis': { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false },
		},
		allowPositionals: false,
		strict: true,
	}).values;
}

async function runCli(argv, io = process) {
	let values;
	try {
		values = parseCliArgs(argv);
	} catch (error) {
		io.stderr.write(`${error.message}\n\n${usage()}\n`);
		return EXIT_CODES.USAGE_OR_MANIFEST;
	}

	if (values.help) {
		io.stdout.write(`${usage()}\n`);
		return EXIT_CODES.SUCCESS;
	}
	if (!values.batch) {
		io.stderr.write(`--batch is required.\n\n${usage()}\n`);
		return EXIT_CODES.USAGE_OR_MANIFEST;
	}

	const manifestPath = path.resolve(values.batch);
	let runner;
	try {
		const manifest = loadManifest(manifestPath, { allowAutoOrder: false });
		runner = new BatchRunner({
			toolchain: resolveToolchain(),
			onEvent: (event) => {
				if (event.type === 'jobStarted') {
					io.stderr.write(`[${event.jobId}] started\n`);
				}
				if (event.type === 'jobCompleted') {
					io.stderr.write(`[${event.jobId}] ${event.status}\n`);
				}
			},
		});
		const interrupt = () => runner.cancel('Interrupted');
		process.once('SIGINT', interrupt);
		let report;
		try {
			report = await runner.run(manifest, {
				manifestPath,
				dryRun: values['dry-run'],
				overwrite: values.overwrite,
				reports: !values['no-analysis'],
			});
		} finally {
			process.removeListener('SIGINT', interrupt);
		}

		if (values.report) {
			const reportPath = path.resolve(values.report);
			if (path.extname(reportPath).toLowerCase() === '.csv') {
				saveCsvReport(reportPath, report);
			} else {
				saveJsonReport(reportPath, report);
			}
		}
		if (values['dry-run'] || !values.report) {
			io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		}
		if (report.summary.cancelled > 0) return EXIT_CODES.CANCELLED;
		if (report.summary.failed > 0) return EXIT_CODES.JOB_FAILURE;
		return EXIT_CODES.SUCCESS;
	} catch (error) {
		io.stderr.write(`${error.message}\n`);
		if (error instanceof DependencyError) return EXIT_CODES.DEPENDENCY;
		return EXIT_CODES.USAGE_OR_MANIFEST;
	}
}

if (require.main === module) {
	runCli(process.argv.slice(2)).then((code) => {
		process.exitCode = code;
	});
}

module.exports = {
	EXIT_CODES,
	parseCliArgs,
	runCli,
	usage,
};
