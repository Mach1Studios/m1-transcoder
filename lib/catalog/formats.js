const INPUT_FORMATS = Object.freeze({
	'm1spatial-4': {
		id: 'm1spatial-4',
		label: 'Mach1Spatial-4',
		cliName: 'M1Horizon',
		channels: 4,
	},
	'm1spatial-8': {
		id: 'm1spatial-8',
		label: 'Mach1Spatial-8',
		cliName: 'M1Spatial',
		channels: 8,
	},
	'm1spatial-12': {
		id: 'm1spatial-12',
		label: 'Mach1Spatial-12',
		cliName: 'M1Spatial',
		channels: 12,
	},
	'm1spatial-14': {
		id: 'm1spatial-14',
		label: 'Mach1Spatial-14',
		cliName: 'M1Spatial',
		channels: 14,
	},
});

const OUTPUT_FORMATS = Object.freeze([
	{ id: 'm1spatial-8', legacyValue: '1', label: 'Mach1Spatial-8', cliName: 'M1Spatial', channels: 8 },
	{ id: 'm1spatial-4', legacyValue: '2', label: 'Mach1Spatial-4', cliName: 'M1Horizon', channels: 4 },
	{ id: 'm1horizon-pairs', legacyValue: '3', label: 'Mach1 Horizon Pairs', cliName: 'M1HorizonPairs', channels: 8 },
	{ id: 'm1horizon-pairs-multi', legacyValue: '4', label: 'Mach1 Horizon Pairs / Quad-Binaural', cliName: 'M1HorizonPairs', channels: 8, packaging: 'multi-stream' },
	{ id: 'foa-acn-sn3d', legacyValue: '5', label: 'First Order Ambisonic ACN/SN3D', cliName: 'ACNSN3D', channels: 4, legacyPreGainLinear: 0.204 },
	{ id: 'foa-fuma', legacyValue: '6', label: 'First Order Ambisonic FuMa', cliName: 'FuMa', channels: 4, legacyPreGainLinear: 0.204 },
	{ id: 'soa-acn-sn3d', legacyValue: '7', label: 'Second Order Ambisonic ACN/SN3D', cliName: 'ACNSN3DO2A', channels: 9, legacyPreGainLinear: 0.204 },
	{ id: 'soa-fuma', legacyValue: '8', label: 'Second Order Ambisonic FuMa', cliName: 'FuMaO2A', channels: 9, legacyPreGainLinear: 0.204 },
	{ id: 'surround-5.1-film', legacyValue: '9', label: '5.1 Surround Film / Cinema', cliName: 'FiveOneFilm_Cinema', channels: 6, legacyNormalize: true },
	{ id: 'surround-5.1-smpte', legacyValue: '10', label: '5.1 Surround SMPTE', cliName: 'FiveOneSmpte', channels: 6, legacyNormalize: true },
	{ id: 'surround-5.1-dts', legacyValue: '11', label: '5.1 Surround DTS', cliName: 'FiveOneDts', channels: 6, legacyNormalize: true },
	{ id: 'surround-7.1', legacyValue: '12', label: '7.1 Surround', cliName: 'SevenOnePt_Cinema', channels: 8, legacyNormalize: true },
	{ id: 'fb360-tbe', legacyValue: '13', label: 'FB360 / TBE', cliName: 'TBE', channels: 8, legacyNormalize: true, packaging: 'tbe' },
	{ id: 'toa-acn-sn3d', legacyValue: '14', label: 'Third Order Ambisonic ACN/SN3D', cliName: 'ACNSN3DO3A', channels: 16 },
	{ id: 'toa-fuma', legacyValue: '15', label: 'Third Order Ambisonic FuMa', cliName: 'FuMaO3A', channels: 16 },
	{ id: 'surround-5.1.2', legacyValue: '16', label: '5.1.2 Surround', cliName: 'FiveOneTwo', channels: 8, legacyNormalize: true },
	{ id: 'surround-5.1.4', legacyValue: '17', label: '5.1.4 Surround', cliName: 'FiveOneFour', channels: 10, legacyNormalize: true },
	{ id: 'surround-7.1-sdds', legacyValue: '18', label: '7.1 Surround SDDS', cliName: 'SevenOneSDDS', channels: 8, legacyNormalize: true },
	{ id: 'surround-7.1.2', legacyValue: '19', label: '7.1.2 Surround', cliName: 'SevenOneTwo', channels: 10, legacyNormalize: true },
	{ id: 'surround-7.1.4', legacyValue: '20', label: '7.1.4 Surround', cliName: 'SevenOneFour', channels: 12, legacyNormalize: true },
	{ id: 'surround-5.0.2', legacyValue: '21', label: '5.0.2 Surround', cliName: 'FiveZeroTwo', channels: 7, legacyNormalize: true },
	{ id: 'surround-5.0.4', legacyValue: '22', label: '5.0.4 Surround', cliName: 'FiveZeroFour', channels: 9, legacyNormalize: true },
	{ id: 'surround-5.0', legacyValue: '23', label: '5.0 Surround', cliName: 'FiveOh', channels: 5, legacyNormalize: true },
	{ id: 'surround-7.0', legacyValue: '24', label: '7.0 Surround', cliName: 'SevenZero_Cinema', channels: 7, legacyNormalize: true },
	{ id: 'm1spatial-sdk-multimono', legacyValue: '25', label: 'Mach1Spatial SDK Multi-Mono', cliName: 'M1Spatial', channels: 8, packaging: 'multi-mono' },
	{ id: 'samsung-vr-4x2', legacyValue: '26', label: 'SamsungVR Sideload 4x2', cliName: 'M1Spatial', channels: 8, packaging: 'multi-stream' },
	{ id: 'apple-spatial-5.1-side', legacyValue: '27', label: 'Apple Spatial 5.1-side', cliName: 'FiveOneSmpte', channels: 6 },
	{ id: 'adm-7.1.2', legacyValue: '28', label: '7.1.2 ADM / Dolby Atmos Bed', cliName: 'DolbyAtmosSevenOneTwo', channels: 10 },
	{ id: 'm1spatial-stereo-fold-down', legacyValue: '29', label: 'Mach1Spatial Stereo Fold-Down', cliName: 'Stereo', channels: 2, packaging: 'fold-down' },
	{ id: 'custom-json', legacyValue: '99', label: 'Custom Multichannel Format', cliName: 'TTPoints', channels: null, customJson: true },
]);

const FILE_PROFILES = Object.freeze([
	{ id: 'm4a', legacyValue: '1', label: 'Audio Only Compressed - .m4a', extension: 'm4a', container: 'm4a', audioCodec: 'aac' },
	{ id: 'wav', legacyValue: '2', label: 'Audio Only Uncompressed - .wav', extension: 'wav', container: 'wav', audioCodec: 'pcm' },
	{ id: 'mp4', legacyValue: '3', label: 'Video & Audio Compressed - .mp4', extension: 'mp4', container: 'mp4', audioCodec: 'aac', requiresVideo: true },
	{ id: 'mov', legacyValue: '4', label: 'Video & Audio Uncompressed - .mov', extension: 'mov', container: 'mov', audioCodec: 'pcm', requiresVideo: true },
	{ id: 'mp4-youtube-mono', legacyValue: '5', label: 'Monoscopic YouTube - .mp4', extension: 'mp4', container: 'mp4', audioCodec: 'aac', requiresVideo: true, projection: 'mono', injectSpatialMetadata: true },
	{ id: 'mp4-youtube-top-bottom', legacyValue: '6', label: 'Top/Bottom YouTube - .mp4', extension: 'mp4', container: 'mp4', audioCodec: 'aac', requiresVideo: true, projection: 'top-bottom', injectSpatialMetadata: true },
	{ id: 'mp4-youtube-left-right', legacyValue: '7', label: 'Left/Right YouTube - .mp4', extension: 'mp4', container: 'mp4', audioCodec: 'aac', requiresVideo: true, projection: 'left-right', injectSpatialMetadata: true },
	{ id: 'mov-youtube-mono', legacyValue: '8', label: 'Monoscopic YouTube - .mov', extension: 'mov', container: 'mov', audioCodec: 'pcm', requiresVideo: true, projection: 'mono', injectSpatialMetadata: true },
	{ id: 'mov-youtube-top-bottom', legacyValue: '9', label: 'Top/Bottom YouTube - .mov', extension: 'mov', container: 'mov', audioCodec: 'pcm', requiresVideo: true, projection: 'top-bottom', injectSpatialMetadata: true },
	{ id: 'mov-youtube-left-right', legacyValue: '10', label: 'Left/Right YouTube - .mov', extension: 'mov', container: 'mov', audioCodec: 'pcm', requiresVideo: true, projection: 'left-right', injectSpatialMetadata: true },
	{ id: 'ogg', legacyValue: '11', label: 'Audio Only Compressed - .ogg', extension: 'ogg', container: 'ogg', audioCodec: 'vorbis' },
	{ id: 'aif', legacyValue: '12', label: 'Audio Only Uncompressed - .aif', extension: 'aif', container: 'aif', audioCodec: 'pcm' },
	{ id: 'opus', legacyValue: '13', label: 'Audio Only Compressed - .opus', extension: 'opus', container: 'opus', audioCodec: 'opus' },
	{ id: 'mp4-generated', legacyValue: '14', label: 'Generated Video & Audio - .mp4', extension: 'mp4', container: 'mp4', audioCodec: 'eac3', generatedVideo: true },
]);

const OUTPUT_BY_ID = new Map(OUTPUT_FORMATS.map((format) => [format.id, format]));
const OUTPUT_BY_LEGACY_VALUE = new Map(OUTPUT_FORMATS.map((format) => [format.legacyValue, format]));
const FILE_BY_ID = new Map(FILE_PROFILES.map((profile) => [profile.id, profile]));
const FILE_BY_LEGACY_VALUE = new Map(FILE_PROFILES.map((profile) => [profile.legacyValue, profile]));

function getInputFormat(id) {
	const format = INPUT_FORMATS[id];
	if (!format) {
		throw new Error(`Unsupported input format: ${id}`);
	}
	return format;
}

function getOutputFormat(id) {
	const format = OUTPUT_BY_ID.get(id);
	if (!format) {
		throw new Error(`Unsupported output format: ${id}`);
	}
	return format;
}

function getFileProfile(id) {
	const profile = FILE_BY_ID.get(id);
	if (!profile) {
		throw new Error(`Unsupported file profile: ${id}`);
	}
	return profile;
}

function getOutputFormatFromLegacyValue(value) {
	return OUTPUT_BY_LEGACY_VALUE.get(String(value)) || null;
}

function getFileProfileFromLegacyValue(value) {
	return FILE_BY_LEGACY_VALUE.get(String(value)) || null;
}

module.exports = {
	FILE_PROFILES,
	INPUT_FORMATS,
	OUTPUT_FORMATS,
	getFileProfile,
	getFileProfileFromLegacyValue,
	getInputFormat,
	getOutputFormat,
	getOutputFormatFromLegacyValue,
};
