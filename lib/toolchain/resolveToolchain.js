const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

class DependencyError extends Error {
	constructor(message) {
		super(message);
		this.name = 'DependencyError';
	}
}

function defaultDataDirectory(platform = process.platform) {
	if (process.env.M1_TRANSCODER_DATA_DIR) {
		return path.resolve(process.env.M1_TRANSCODER_DATA_DIR);
	}
	if (platform === 'win32') {
		return path.join(process.env.APPDATA || os.homedir(), 'Mach1');
	}
	if (platform === 'darwin') {
		return path.join(os.homedir(), 'Library', 'Application Support', 'Mach1');
	}
	return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'Mach1');
}

function resolveToolchain(options = {}) {
	const platform = options.platform || process.platform;
	const dataDirectory = path.resolve(options.dataDirectory || defaultDataDirectory(platform));
	const resourcesDirectory = options.resourcesDirectory
		|| (typeof process.resourcesPath === 'string' ? process.resourcesPath : path.join(__dirname, '..', '..', 'app'));
	const isWindows = platform === 'win32';
	const executable = (name) => (isWindows ? `${name}.exe` : name);

	return {
		dataDirectory,
		tempDirectory: path.resolve(
			options.tempDirectory
			|| process.env.M1_TRANSCODER_TEMP_DIR
			|| path.join(dataDirectory, 'temp')
		),
		ffmpeg: path.resolve(options.ffmpeg || path.join(dataDirectory, executable('ffmpeg'))),
		ffprobe: path.resolve(options.ffprobe || path.join(dataDirectory, executable('ffprobe'))),
		m1Transcode: path.resolve(
			options.m1Transcode
			|| path.join(
				dataDirectory,
				isWindows ? 'm1-transcode-win-x64' : 'm1-transcode-osx-x64',
				executable('m1-transcode')
			)
		),
		spatialMedia: path.resolve(
			options.spatialMedia
			|| path.join(resourcesDirectory, 'extraResources', executable('spatialmedia'))
		),
	};
}

function assertToolchain(toolchain, requirements = ['ffmpeg', 'ffprobe', 'm1Transcode']) {
	const missing = requirements.filter((name) => !fs.existsSync(toolchain[name]));
	if (missing.length) {
		const details = missing.map((name) => `${name}: ${toolchain[name]}`).join('\n');
		throw new DependencyError(
			`Missing transcoder dependencies. Open M1-Transcoder once to install them or set M1_TRANSCODER_DATA_DIR.\n${details}`
		);
	}
	return toolchain;
}

module.exports = {
	DependencyError,
	assertToolchain,
	defaultDataDirectory,
	resolveToolchain,
};
