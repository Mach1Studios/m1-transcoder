const fs = require('node:fs');
const path = require('node:path');
const { reportToCsv } = require('./parsers');

function ensureParent(filePath) {
	fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function saveJsonReport(filePath, report) {
	ensureParent(filePath);
	fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	return path.resolve(filePath);
}

function saveCsvReport(filePath, report) {
	ensureParent(filePath);
	fs.writeFileSync(filePath, reportToCsv(report), 'utf8');
	return path.resolve(filePath);
}

module.exports = {
	saveCsvReport,
	saveJsonReport,
};
