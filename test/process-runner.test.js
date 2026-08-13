const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ProcessRunner } = require('../lib/execution/ProcessRunner');

test('process arguments are passed literally without shell interpolation', async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'm1-process-test-'));
	const sentinel = path.join(directory, 'must-not-exist');
	const maliciousLookingArgument = `$(touch ${sentinel})`;
	try {
		const runner = new ProcessRunner();
		const result = await runner.run(process.execPath, [
			'-e',
			'process.stdout.write(process.argv[1])',
			maliciousLookingArgument,
		]);
		assert.equal(result.stdout, maliciousLookingArgument);
		assert.equal(fs.existsSync(sentinel), false);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

test('active tools terminate when the abort signal is cancelled', async () => {
	const runner = new ProcessRunner();
	const controller = new AbortController();
	const running = runner.run(process.execPath, [
		'-e',
		'setInterval(() => {}, 1000)',
	], {
		signal: controller.signal,
	});
	setTimeout(() => controller.abort(new Error('test cancellation')), 50);
	await assert.rejects(running, (error) => {
		assert.equal(error.code, 'ABORT_ERR');
		return true;
	});
});
