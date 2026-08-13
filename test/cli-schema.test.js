const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { EXIT_CODES, parseCliArgs, runCli } = require('../app/batch-cli');

test('headless CLI parses all documented switches', () => {
	const values = parseCliArgs([
		'--batch', 'batch.json',
		'--report', 'report.csv',
		'--dry-run',
		'--overwrite',
		'--no-analysis',
	]);
	assert.equal(values.batch, 'batch.json');
	assert.equal(values.report, 'report.csv');
	assert.equal(values['dry-run'], true);
	assert.equal(values.overwrite, true);
	assert.equal(values['no-analysis'], true);
});

test('headless CLI has deterministic usage exit codes', async () => {
	let stdout = '';
	let stderr = '';
	const io = {
		stdout: { write: (value) => { stdout += value; } },
		stderr: { write: (value) => { stderr += value; } },
	};
	assert.equal(await runCli(['--help'], io), EXIT_CODES.SUCCESS);
	assert.match(stdout, /--batch/);
	assert.equal(await runCli([], io), EXIT_CODES.USAGE_OR_MANIFEST);
	assert.match(stderr, /--batch is required/);
});

test('checked-in manifest schema and example remain valid JSON', () => {
	const schema = JSON.parse(fs.readFileSync(
		path.join(__dirname, '..', 'schemas', 'batch-manifest-v1.schema.json'),
		'utf8'
	));
	const example = JSON.parse(fs.readFileSync(
		path.join(__dirname, '..', 'examples', 'batch-m1spatial-8-to-4.json'),
		'utf8'
	));
	assert.equal(schema.properties.kind.const, example.kind);
	assert.equal(example.schemaVersion, 1);
	assert.equal(example.jobs[0].inputs.spatialAudio.proToolsOrder, 'pro-tools-8');
});
