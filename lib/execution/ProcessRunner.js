const { spawn } = require('node:child_process');

class ProcessExecutionError extends Error {
	constructor(executable, args, code, stdout, stderr) {
		super(`${executable} exited with code ${code}: ${stderr.trim() || stdout.trim()}`);
		this.name = 'ProcessExecutionError';
		this.executable = executable;
		this.args = args;
		this.code = code;
		this.stdout = stdout;
		this.stderr = stderr;
	}
}

class ProcessRunner {
	constructor(options = {}) {
		this.onEvent = options.onEvent || (() => {});
		this.activeChild = null;
	}

	async run(executable, args, options = {}) {
		const signal = options.signal;
		if (signal && signal.aborted) {
			throw signal.reason || new Error('Operation cancelled');
		}

		return new Promise((resolve, reject) => {
			let stdout = '';
			let stderr = '';
			let settled = false;
			const child = spawn(executable, args, {
				cwd: options.cwd,
				env: options.env || process.env,
				shell: false,
				windowsHide: true,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			this.activeChild = child;

			this.onEvent({
				type: 'processStarted',
				executable,
				args: [...args],
				pid: child.pid,
				stage: options.stage || null,
			});

			const finish = (callback) => {
				if (settled) return;
				settled = true;
				this.activeChild = null;
				if (signal) signal.removeEventListener('abort', abort);
				callback();
			};

			const abort = () => {
				if (!child.killed) {
					child.kill('SIGTERM');
					setTimeout(() => {
						if (!child.killed) child.kill('SIGKILL');
					}, 5000).unref();
				}
			};

			if (signal) signal.addEventListener('abort', abort, { once: true });

			child.stdout.on('data', (chunk) => {
				const text = chunk.toString();
				stdout += text;
				if (options.onStdout) options.onStdout(text);
			});
			child.stderr.on('data', (chunk) => {
				const text = chunk.toString();
				stderr += text;
				if (options.onStderr) options.onStderr(text);
			});
			child.on('error', (error) => finish(() => reject(error)));
			child.on('close', (code, closeSignal) => {
				finish(() => {
					if (signal && signal.aborted) {
						const error = signal.reason instanceof Error
							? signal.reason
							: new Error('Operation cancelled');
						error.code = 'ABORT_ERR';
						reject(error);
						return;
					}
					if (code !== 0) {
						reject(new ProcessExecutionError(executable, args, code, stdout, stderr));
						return;
					}
					this.onEvent({
						type: 'processCompleted',
						executable,
						code,
						signal: closeSignal,
						stage: options.stage || null,
					});
					resolve({ stdout, stderr, code });
				});
			});
		});
	}

	cancel() {
		if (this.activeChild && !this.activeChild.killed) {
			this.activeChild.kill('SIGTERM');
		}
	}
}

module.exports = {
	ProcessExecutionError,
	ProcessRunner,
};
