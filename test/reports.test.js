const assert = require('node:assert/strict');
const test = require('node:test');
const { parseAstats, parseEbur128, reportToCsv } = require('../lib/reports/parsers');

test('FFmpeg 4.1 astats output parses native per-channel levels', () => {
	const parsed = parseAstats(`
[Parsed_astats_0 @ 0x1] Channel: 1
[Parsed_astats_0 @ 0x1] Peak level dB: -1.540000
[Parsed_astats_0 @ 0x1] RMS level dB: -21.960000
[Parsed_astats_0 @ 0x1] Number of samples: 1000
[Parsed_astats_0 @ 0x1] Channel: 2
[Parsed_astats_0 @ 0x1] Peak level dB: -2.000000
[Parsed_astats_0 @ 0x1] RMS level dB: -23.000000
[Parsed_astats_0 @ 0x1] Overall
[Parsed_astats_0 @ 0x1] Peak level dB: -1.540000
[Parsed_astats_0 @ 0x1] RMS level dB: -22.400000
`);
	assert.equal(parsed.channels.length, 2);
	assert.deepEqual(parsed.channels[0], {
		index: 0,
		semanticIndex: 'M01',
		samplePeakDbfs: -1.54,
		rmsDbfs: -21.96,
		sampleCount: 1000,
	});
	assert.equal(parsed.maximumSamplePeakDbfs, -1.54);
	assert.equal(parsed.overall.rmsDbfs, -22.4);
});

test('ebur128 summary parses LUFS, LRA, and true peak', () => {
	const parsed = parseEbur128(`
Summary:
  Integrated loudness:
    I:         -20.7 LUFS
  Loudness range:
    LRA:        14.4 LU
  True peak:
    Peak:       -1.5 dBFS
`);
	assert.deepEqual(parsed, {
		integratedLufs: -20.7,
		loudnessRangeLu: 14.4,
		truePeakDbtp: -1.5,
	});
});

test('CSV reports quote paths and include before/after deltas', () => {
	const csv = reportToCsv({
		results: [{
			jobId: 'one',
			status: 'completed',
			inputPath: '/tmp/a, b.wav',
			outputPath: '/tmp/out.wav',
			reviewRequired: false,
			warnings: [],
			measurements: {
				before: { reference: { integratedLufs: -20.7, rmsDbfs: -23, truePeakDbtp: -1.5 } },
				after: { reference: { integratedLufs: -20.6, rmsDbfs: -22.9, truePeakDbtp: -1.4 } },
				delta: { integratedLufs: 0.1 },
			},
		}],
	});
	assert.match(csv, /"\/tmp\/a, b\.wav"/);
	assert.match(csv, /"-20\.7","-20\.6","0\.1"/);
});
