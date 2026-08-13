const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const APP_DIRECTORY = path.resolve(__dirname, '..', '..', 'app');

function sha256(source) {
	return crypto.createHash('sha256').update(source).digest('hex');
}

function extractCondition(source, pattern, fallback) {
	const match = source.match(pattern);
	return match ? match[1] : fallback;
}

function snapshotLegacyRecipes(source = fs.readFileSync(path.join(APP_DIRECTORY, 'converter.js'), 'utf8')) {
	const recipeRegionMatch = source.match(/const recipes\s*=\s*\[([\s\S]*?)\n\s*\];\s*\n\s*let recipeToExecute/);
	const recipeRegion = recipeRegionMatch ? recipeRegionMatch[1] : source;
	const conditionMatches = [...recipeRegion.matchAll(/conditions:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*recipe:/g)];
	const recipes = conditionMatches.map((match, index) => {
		const conditions = match[1];
		const outputType = extractCondition(
			conditions,
			/selectedOutputType:\s*OutputTypes\.([A-Z0-9_]+)/,
			'ANY'
		);
		const fileType = extractCondition(conditions, /outputFileTypeKey:\s*'([^']+)'/, 'ANY');
		const inputCount = extractCondition(conditions, /inputAudioFilesLength:\s*(\d+)/, 'ANY');
		const stereo = extractCondition(conditions, /hasStereoAudioFile:\s*(true|false)/, 'ANY');
		const video = extractCondition(conditions, /hasVideoFile:\s*(true|false)/, 'ANY');
		const proTools = extractCondition(conditions, /isFromProTools:\s*(true|false)/, 'ANY');
		return {
			id: `legacy-${String(index + 1).padStart(3, '0')}-${outputType.toLowerCase()}-${fileType.toLowerCase()}-${stereo}-${video}-${proTools}`,
			index,
			conditions: {
				inputAudioFilesLength: inputCount === 'ANY' ? inputCount : Number(inputCount),
				selectedOutputType: outputType,
				outputFileTypeKey: fileType,
				hasStereoAudioFile: stereo === 'ANY' ? stereo : stereo === 'true',
				hasVideoFile: video === 'ANY' ? video : video === 'true',
				isFromProTools: proTools === 'ANY' ? proTools : proTools === 'true',
			},
		};
	});
	return {
		count: recipes.length,
		sourceSha256: sha256(source),
		recipes,
	};
}

function snapshotLegacyProcessKinds(
	source = fs.readFileSync(path.join(APP_DIRECTORY, 'convertProcesses.js'), 'utf8')
) {
	const processKinds = [...source.matchAll(/case\s+["']([^"']+)["']\s*:/g)]
		.map((match, index) => ({
			id: `legacy-operation-${String(index + 1).padStart(2, '0')}-${match[1]}`,
			index,
			processKind: match[1],
		}));
	return {
		count: processKinds.length,
		sourceSha256: sha256(source),
		processKinds,
	};
}

function createLegacySnapshot() {
	return {
		snapshotVersion: 1,
		recipes: snapshotLegacyRecipes(),
		processKinds: snapshotLegacyProcessKinds(),
	};
}

module.exports = {
	createLegacySnapshot,
	snapshotLegacyProcessKinds,
	snapshotLegacyRecipes,
};
