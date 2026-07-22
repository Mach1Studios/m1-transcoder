const MACH1_SPATIAL_HORIZONTAL_POSITIONS = Object.freeze({
	// Positions run from -1 (left) through 0 (center) to 1 (right).
	4: [-1, 1, -1, 1],
	// Front, left, rear, right, top, bottom face centers.
	6: [0, -1, 0, 1, 0, 0],
	8: [-1, 1, -1, 1, -1, 1, -1, 1],
	// M1Spatial-8 plus head-locked left and right.
	10: [-1, 1, -1, 1, -1, 1, -1, 1, -1, 1],
	// M1Spatial-8 plus front, right, rear, and left face centers.
	12: [-1, 1, -1, 1, -1, 1, -1, 1, 0, 1, 0, -1],
	// M1Spatial-12 plus top and bottom face centers.
	14: [-1, 1, -1, 1, -1, 1, -1, 1, 0, 1, 0, -1, 0, 0],
});

function createStereoFoldDownGains(horizontalPositions) {
	if (!Array.isArray(horizontalPositions) || horizontalPositions.length === 0) {
		throw new Error('Mach1 Spatial horizontal positions must be a non-empty array.');
	}

	const rawGains = horizontalPositions.map((position) => {
		if (!Number.isFinite(position)) {
			throw new Error(`Invalid Mach1 Spatial horizontal position: ${position}`);
		}

		const clampedPosition = Math.max(-1, Math.min(1, position));
		return {
			left: (1 - clampedPosition) / 2,
			right: (1 + clampedPosition) / 2,
		};
	});

	const leftTotal = rawGains.reduce((total, gains) => total + gains.left, 0);
	const rightTotal = rawGains.reduce((total, gains) => total + gains.right, 0);

	return {
		left: rawGains.map((gains) => gains.left / leftTotal),
		right: rawGains.map((gains) => gains.right / rightTotal),
	};
}

function formatCoefficient(value) {
	return Number(value.toFixed(10)).toString();
}

function buildOutputExpression(outputChannel, gains) {
	const terms = gains
		.map((gain, inputChannel) => ({ gain, inputChannel }))
		.filter(({ gain }) => gain > 0)
		.map(({ gain, inputChannel }) => `${formatCoefficient(gain)}*c${inputChannel}`);

	return `c${outputChannel}=${terms.join('+')}`;
}

function getStereoFoldDownGains(channelCount) {
	const normalizedChannelCount = Number(channelCount);
	const horizontalPositions = MACH1_SPATIAL_HORIZONTAL_POSITIONS[normalizedChannelCount];

	if (!horizontalPositions) {
		const supportedCounts = Object.keys(MACH1_SPATIAL_HORIZONTAL_POSITIONS).join(', ');
		throw new Error(
			`Unsupported Mach1 Spatial channel count: ${channelCount}. Supported counts: ${supportedCounts}.`
		);
	}

	return createStereoFoldDownGains(horizontalPositions);
}

function getStereoFoldDownFilter(channelCount) {
	const gains = getStereoFoldDownGains(channelCount);
	return `pan=stereo|${buildOutputExpression(0, gains.left)}|${buildOutputExpression(1, gains.right)}`;
}

module.exports = {
	MACH1_SPATIAL_HORIZONTAL_POSITIONS,
	createStereoFoldDownGains,
	getStereoFoldDownFilter,
	getStereoFoldDownGains,
};
