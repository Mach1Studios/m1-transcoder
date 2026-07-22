const assert = require('node:assert/strict');
const test = require('node:test');

const {
	createStereoFoldDownGains,
	getStereoFoldDownFilter,
	getStereoFoldDownGains,
} = require('./stereoFoldDown');

const SUPPORTED_CHANNEL_COUNTS = [4, 6, 8, 10, 12, 14];

function sum(values) {
	return values.reduce((total, value) => total + value, 0);
}

test('every supported layout is normalized for peak-safe output', () => {
	for (const channelCount of SUPPORTED_CHANNEL_COUNTS) {
		const gains = getStereoFoldDownGains(channelCount);

		assert.ok(Math.abs(sum(gains.left) - 1) < 1e-10);
		assert.ok(Math.abs(sum(gains.right) - 1) < 1e-10);
		assert.equal(gains.left.length, channelCount);
		assert.equal(gains.right.length, channelCount);
	}
});

test('M1Spatial-8 preserves the even-left and odd-right channel mapping', () => {
	const gains = getStereoFoldDownGains(8);

	assert.deepEqual(gains.left, [0.25, 0, 0.25, 0, 0.25, 0, 0.25, 0]);
	assert.deepEqual(gains.right, [0, 0.25, 0, 0.25, 0, 0.25, 0, 0.25]);
});

test('center channels in M1Spatial-12 and M1Spatial-14 split equally', () => {
	const spatial12 = getStereoFoldDownGains(12);
	const spatial14 = getStereoFoldDownGains(14);

	for (const channel of [8, 10]) {
		assert.equal(spatial12.left[channel], spatial12.right[channel]);
	}

	for (const channel of [8, 10, 12, 13]) {
		assert.equal(spatial14.left[channel], spatial14.right[channel]);
	}
});

test('intermediate positions retain their left/right proximity ratio', () => {
	const gains = createStereoFoldDownGains([-1, -0.5, 0, 0.5, 1]);

	assert.ok(Math.abs(gains.left[1] / gains.right[1] - 3) < 1e-10);
	assert.ok(Math.abs(gains.right[3] / gains.left[3] - 3) < 1e-10);
	assert.equal(gains.left[2], gains.right[2]);
});

test('generated filters use the requested number of input channels', () => {
	for (const channelCount of SUPPORTED_CHANNEL_COUNTS) {
		const filter = getStereoFoldDownFilter(channelCount);

		assert.match(filter, /^pan=stereo\|c0=.+\|c1=.+$/);
		assert.ok(filter.includes(`c${channelCount - 1}`));
		assert.ok(!filter.includes(`c${channelCount}`));
	}
});

test('unsupported layouts fail instead of applying a wrong matrix', () => {
	assert.throws(
		() => getStereoFoldDownFilter(9),
		/Unsupported Mach1 Spatial channel count: 9/
	);
});
