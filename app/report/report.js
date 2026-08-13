const path = require('node:path');
const { ipcRenderer } = require('electron');

let report = null;
let selectedResult = null;

function number(value, digits = 2) {
	return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function pathCell(value) {
	const cell = document.createElement('td');
	cell.className = 'path';
	cell.title = value || '';
	cell.textContent = value ? path.basename(value) : '—';
	return cell;
}

function measurement(result, side, key) {
	return result.measurements
		&& result.measurements[side]
		&& result.measurements[side].reference
		? result.measurements[side].reference[key]
		: null;
}

function renderSummary() {
	const summary = report.summary || {};
	const values = [
		['Completed', summary.completed || 0],
		['Failed', summary.failed || 0],
		['Review', summary.reviewRequired || 0],
		['Cancelled', summary.cancelled || 0],
		['Total', summary.total || 0],
	];
	document.getElementById('summary').innerHTML = values
		.map(([label, value]) => (
			`<div class="summary-item"><div class="eyebrow">${label}</div><div class="value">${value}</div></div>`
		))
		.join('');
	document.getElementById('reference-note').textContent =
		`Comparable loudness reference: ${report.referenceVersion || 'container fallback'}. Review threshold: |Δ| > 0.5 LU or output ≥ 0 dBTP.`;
}

function renderRows() {
	const body = document.getElementById('result-rows');
	body.innerHTML = '';
	for (const result of report.results || []) {
		const row = document.createElement('tr');
		const status = document.createElement('td');
		status.className = `status ${result.status === 'failed' ? 'failed' : (result.reviewRequired ? 'review' : '')}`;
		status.textContent = result.reviewRequired ? 'Review' : result.status;
		row.append(status, pathCell(result.inputPath), pathCell(result.outputPath));

		const values = [
			measurement(result, 'before', 'integratedLufs'),
			measurement(result, 'after', 'integratedLufs'),
			result.measurements && result.measurements.delta
				? result.measurements.delta.integratedLufs
				: null,
			measurement(result, 'after', 'truePeakDbtp'),
		];
		for (const value of values) {
			const cell = document.createElement('td');
			cell.textContent = number(value);
			row.appendChild(cell);
		}
		row.addEventListener('click', () => selectResult(result, row));
		body.appendChild(row);
	}

	const firstDetailed = (report.results || []).find((result) => result.measurements)
		|| (report.results || [])[0];
	if (firstDetailed) {
		const index = (report.results || []).indexOf(firstDetailed);
		selectResult(firstDetailed, body.children[index]);
	}
}

function renderChannels(elementId, side) {
	const body = document.getElementById(elementId);
	const channels = selectedResult.measurements
		&& selectedResult.measurements[side]
		&& selectedResult.measurements[side].native
		? selectedResult.measurements[side].native.channels
		: [];
	body.innerHTML = channels.map((channel) => (
		`<tr><td>${channel.semanticIndex || channel.index + 1}</td>`
		+ `<td>${number(channel.samplePeakDbfs)}</td>`
		+ `<td>${number(channel.rmsDbfs)}</td></tr>`
	)).join('');
}

function selectResult(result, row) {
	selectedResult = result;
	document.querySelectorAll('.results tbody tr').forEach((element) => element.classList.remove('selected'));
	if (row) row.classList.add('selected');
	const details = document.getElementById('details');
	details.classList.toggle('empty', !result.measurements);
	details.classList.toggle('failed', result.status === 'failed');
	document.getElementById('details-title').textContent = result.jobId || 'Render';
	document.getElementById('review-badge').textContent = result.status === 'failed'
		? 'Render Failed'
		: (result.reviewRequired ? 'Review Required' : '');
	document.getElementById('gain-actions').textContent = result.gainActions
		? `Master gain: ${result.gainActions.masterGainDb} dB · Normalization: ${result.gainActions.normalized ? 'enabled' : 'none'}${result.outputLayout ? ` · Output: ${result.outputLayout}` : ''}`
		: '';
	document.getElementById('error-details').textContent = result.error
		? `${result.error.code ? `${result.error.code}: ` : ''}${result.error.message}`
			+ (result.error.workspace ? `\nWorkspace: ${result.error.workspace}` : '')
		: '';
	document.getElementById('warnings').textContent = (result.warnings || []).join(' ');
	if (result.measurements) {
		renderChannels('before-channels', 'before');
		renderChannels('after-channels', 'after');
	}
}

function render(nextReport) {
	report = nextReport;
	if (!report) return;
	renderSummary();
	renderRows();
}

document.getElementById('save-json').addEventListener('click', () => ipcRenderer.invoke('report:save', 'json'));
document.getElementById('save-csv').addEventListener('click', () => ipcRenderer.invoke('report:save', 'csv'));
document.getElementById('reveal-output').addEventListener('click', () => {
	if (selectedResult && selectedResult.outputPath) {
		ipcRenderer.invoke('shell:reveal', selectedResult.outputPath);
	}
});

ipcRenderer.on('report:updated', (event, nextReport) => render(nextReport));
ipcRenderer.invoke('report:get-latest').then(render);
