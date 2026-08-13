const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createLegacySnapshot } = require('../lib/catalog/legacySnapshot');

const baseline = require('./fixtures/legacy-baseline.json');

test('legacy catalog and all operation kinds have stable unique IDs', () => {
	const snapshot = createLegacySnapshot();
	assert.ok(snapshot.recipes.count >= baseline.recipes.minimumCount);
	assert.equal(snapshot.processKinds.count, baseline.processKinds.count);
	assert.match(baseline.processKinds.sourceSha256, /^[a-f0-9]{64}$/);

	const recipeIds = snapshot.recipes.recipes.map((recipe) => recipe.id);
	const operationIds = snapshot.processKinds.processKinds.map((operation) => operation.id);
	assert.equal(new Set(recipeIds).size, recipeIds.length);
	assert.equal(new Set(operationIds).size, operationIds.length);
});

test('legacy recipe selectors are unambiguous after profile fixes', () => {
	const snapshot = createLegacySnapshot();
	const signatures = snapshot.recipes.recipes.map((recipe) => JSON.stringify(recipe.conditions));
	assert.equal(new Set(signatures).size, signatures.length);
});

test('video profile identities and generated Apple video are independently reachable', () => {
	const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'converter.js'), 'utf8');
	for (const profile of [
		'MP4_YOUTUBE_MONO',
		'MP4_YOUTUBE_TOP_BOTTOM',
		'MP4_YOUTUBE_LEFT_RIGHT',
		'MOV_YOUTUBE_MONO',
		'MOV_YOUTUBE_TOP_BOTTOM',
		'MOV_YOUTUBE_LEFT_RIGHT',
		'MP4_GENERATED',
	]) {
		const occurrences = source.split(profile).length - 1;
		assert.ok(occurrences >= 3, `${profile} must appear in the profile map and recipes`);
	}
	assert.match(source, /input_format:\s*'M1Spatial\+S'/);
	assert.match(source, /output_format:\s*'DolbyAtmosSevenOneTwo'/);
	assert.match(source, /output_format:\s*'FuMaO3A'/);
});
