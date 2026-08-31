const fs = require('node:fs');
const path = require('node:path');
const { ipcRenderer } = require('electron');
const {
	FILE_PROFILES,
	INPUT_FORMATS,
	OUTPUT_FORMATS,
	createJob,
	createManifest,
	normalizeManifest,
	resolveOutputPath,
} = require('../../lib');
const { isProToolsEightChannel, probeMedia } = require('../../lib/probe/ffprobe');
const { resolveToolchain } = require('../../lib/toolchain/resolveToolchain');

let jobs = [];
let selectedIds = new Set();
let expandedIds = new Set();
let statuses = new Map();
let statusMessages = new Map();
let running = false;
let lastReport = null;

const body = document.getElementById('matrix-body');
const dropZone = document.getElementById('drop-zone');
const dropMessage = document.getElementById('drop-message');
const inputFormatOptions = Object.values(INPUT_FORMATS);
const outputLayoutOptions = [
	{ id: 'multichannel', label: 'Multichannel' },
	{ id: 'multi-mono', label: 'Multi-Mono' },
];

function optionMarkup(options, selected, valueKey = 'id') {
	return options.map((option) => {
		const value = option[valueKey];
		const isSelected = value === selected ? ' selected' : '';
		return `<option value="${value}"${isSelected}>${option.label}</option>`;
	}).join('');
}

function currentManifest() {
	return createManifest(jobs, {
		baseDirectory: process.cwd(),
		keepFailedWorkspace: true,
	});
}

function outputPathFor(job) {
	const outputFormat = OUTPUT_FORMATS.find((format) => format.id === job.output.format);
	const fileProfile = FILE_PROFILES.find((profile) => profile.id === job.output.fileType);
	return resolveOutputPath(job, outputFormat, fileProfile, process.cwd());
}

function isMultiMonoJob(job) {
	const outputFormat = OUTPUT_FORMATS.find((format) => format.id === job.output.format);
	return job.output.layout === 'multi-mono'
		|| (outputFormat && outputFormat.packaging === 'multi-mono');
}

function setBatchState(text, isRunning = false) {
	const state = document.getElementById('batch-state');
	state.textContent = text;
	state.classList.toggle('running', isRunning);
}

function addFiles(files) {
	for (const file of files) {
		const inputPath = file.path || file;
		if (!inputPath) continue;
		const job = createJob(inputPath, {
			id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		});
		jobs.push(job);
		selectedIds.add(job.id);
		probeMedia(inputPath, resolveToolchain())
			.then((probe) => {
				job.inputs.spatialAudio.proToolsOrder = isProToolsEightChannel(probe)
					? 'pro-tools-8'
					: 'none';
				render();
			})
			.catch(() => {
				job.inputs.spatialAudio.proToolsOrder = 'none';
			});
	}
	render();
}

function updateJob(jobId, updater) {
	const job = jobs.find((candidate) => candidate.id === jobId);
	if (!job) return;
	updater(job);
	render();
}

function fieldValue(value) {
	if (!value) return '';
	return typeof value === 'string' ? value : value.path || '';
}

function renderInspector(job) {
	const fragment = document.getElementById('inspector-template').content.cloneNode(true);
	const row = fragment.querySelector('tr');
	row.dataset.jobId = job.id;
	const bindings = {
		layout: ['select', () => job.inputs.spatialAudio.layout, (value) => { job.inputs.spatialAudio.layout = value; }],
		'pro-tools-order': ['select', () => job.inputs.spatialAudio.proToolsOrder, (value) => { job.inputs.spatialAudio.proToolsOrder = value; }],
		'static-stereo': ['input', () => fieldValue(job.inputs.staticStereo), (value) => { job.inputs.staticStereo = value || null; }],
		'custom-json': ['input', () => fieldValue(job.inputs.customFormatJson), (value) => { job.inputs.customFormatJson = value || null; }],
		video: ['input', () => fieldValue(job.inputs.video), (value) => { job.inputs.video = value || null; }],
		collision: ['select', () => job.output.collision, (value) => { job.output.collision = value; }],
		'multi-mono-index': ['select', () => job.output.multiMono.indexBase, (value) => { job.output.multiMono.indexBase = Number(value); }],
		'multi-mono-placement': ['select', () => job.output.multiMono.placement, (value) => { job.output.multiMono.placement = value; }],
	};
	for (const [field, [, getter, setter]] of Object.entries(bindings)) {
		const control = row.querySelector(`[data-field="${field}"]`);
		control.value = getter();
		control.addEventListener('change', () => setter(control.value));
	}
	for (const control of row.querySelectorAll('[data-multi-mono-only]')) {
		control.hidden = !isMultiMonoJob(job);
	}
	return fragment;
}

function render() {
	body.innerHTML = '';
	dropMessage.style.display = jobs.length ? 'none' : 'grid';
	for (const job of jobs) {
		const row = document.createElement('tr');
		row.className = `job-row${selectedIds.has(job.id) ? ' selected' : ''}`;
		row.dataset.jobId = job.id;
		const status = statuses.get(job.id) || 'pending';
		const files = job.inputs.spatialAudio.files;
		const inputLabel = files.length === 1
			? path.basename(files[0])
			: path.basename(files[0]) + ` + ${files.length - 1}`;
		row.innerHTML = `
			<td class="center"><input data-field="enabled" type="checkbox"${job.enabled ? ' checked' : ''}></td>
			<td><div class="file-cell"><span class="file-name" title="${files.join('\n')}">${inputLabel}</span>${files.length > 1 ? `<span class="group-count">${files.length}</span>` : ''}</div></td>
			<td><select data-field="input-format">${optionMarkup(inputFormatOptions, job.inputs.spatialAudio.format)}</select></td>
			<td><select data-field="output-format">${optionMarkup(OUTPUT_FORMATS, job.output.format)}</select></td>
			<td><select data-field="file-type">${optionMarkup(FILE_PROFILES, job.output.fileType)}</select></td>
			<td><select data-field="output-layout">${optionMarkup(outputLayoutOptions, job.output.layout)}</select></td>
			<td><input data-field="output-path" type="text" value="${outputPathFor(job)}" title="${outputPathFor(job)}"></td>
			<td class="center"><input data-field="report" type="checkbox"${job.reports.enabled ? ' checked' : ''}></td>
			<td class="status ${status}">${status}</td>
			<td><button class="expand" title="Optional assets and settings">${expandedIds.has(job.id) ? '−' : '+'}</button></td>
		`;
		row.querySelector('.status').title = statusMessages.get(job.id) || '';
		row.addEventListener('click', (event) => {
			if (event.target.closest('input, select, button')) return;
			if (event.metaKey || event.ctrlKey) {
				if (selectedIds.has(job.id)) selectedIds.delete(job.id);
				else selectedIds.add(job.id);
			} else {
				selectedIds = new Set([job.id]);
			}
			render();
		});
		row.querySelector('[data-field="enabled"]').addEventListener('change', (event) => {
			job.enabled = event.target.checked;
		});
		row.querySelector('[data-field="input-format"]').addEventListener('change', (event) => {
			job.inputs.spatialAudio.format = event.target.value;
		});
		row.querySelector('[data-field="output-format"]').addEventListener('change', (event) => {
			job.output.format = event.target.value;
			const format = OUTPUT_FORMATS.find((candidate) => candidate.id === job.output.format);
			if (format && format.packaging === 'multi-mono') {
				job.output.layout = 'multi-mono';
				job.output.fileType = 'wav';
			}
			job.output.path = null;
			render();
		});
		row.querySelector('[data-field="file-type"]').addEventListener('change', (event) => {
			job.output.fileType = event.target.value;
			const profile = FILE_PROFILES.find((candidate) => candidate.id === job.output.fileType);
			if (
				job.output.layout === 'multi-mono'
				&& profile
				&& !(profile.audioCodec === 'pcm' && ['wav', 'aif'].includes(profile.container))
			) {
				job.output.layout = 'multichannel';
			}
			job.output.path = null;
			render();
		});
		row.querySelector('[data-field="output-layout"]').addEventListener('change', (event) => {
			job.output.layout = event.target.value;
			if (job.output.layout === 'multi-mono') {
				const profile = FILE_PROFILES.find((candidate) => candidate.id === job.output.fileType);
				if (!profile || profile.audioCodec !== 'pcm' || !['wav', 'aif'].includes(profile.container)) {
					job.output.fileType = 'wav';
				}
			}
			job.output.path = null;
			render();
		});
		row.querySelector('[data-field="output-path"]').addEventListener('change', (event) => {
			job.output.path = event.target.value;
			job.output.directory = null;
		});
		row.querySelector('[data-field="report"]').addEventListener('change', (event) => {
			job.reports.enabled = event.target.checked;
		});
		row.querySelector('.expand').addEventListener('click', () => {
			if (expandedIds.has(job.id)) expandedIds.delete(job.id);
			else expandedIds.add(job.id);
			render();
		});
		body.appendChild(row);
		if (expandedIds.has(job.id)) body.appendChild(renderInspector(job));
	}
}

function groupSelectedAsHorizon() {
	const selectedJobs = jobs.filter((job) => selectedIds.has(job.id));
	if (selectedJobs.length !== 4 || selectedJobs.some((job) => job.inputs.spatialAudio.files.length !== 1)) {
		setBatchState('Select exactly four single-file rows');
		return;
	}
	const grouped = createJob(selectedJobs[0].inputs.spatialAudio.files[0], {
		id: `horizon-${Date.now()}`,
		inputFormat: 'm1spatial-8',
		outputFormat: 'm1horizon-pairs',
	});
	grouped.inputs.spatialAudio.files = selectedJobs.map((job) => job.inputs.spatialAudio.files[0]);
	grouped.inputs.spatialAudio.layout = 'horizon-four-stereo';
	jobs = jobs.filter((job) => !selectedIds.has(job.id));
	jobs.push(grouped);
	selectedIds = new Set([grouped.id]);
	render();
}

async function chooseInputs() {
	const files = await ipcRenderer.invoke('show-open-dialog', ['wav', 'aif', 'aiff', 'flac', 'm4a']);
	if (files) addFiles(files);
}

async function loadManifest() {
	const files = await ipcRenderer.invoke('show-open-dialog', ['json']);
	if (!files || !files[0]) return;
	try {
		const raw = JSON.parse(fs.readFileSync(files[0], 'utf8'));
		const manifest = normalizeManifest(raw, files[0]);
		jobs = manifest.jobs;
		selectedIds = new Set(jobs.map((job) => job.id));
		statuses.clear();
		statusMessages.clear();
		render();
		setBatchState(`Loaded ${jobs.length} jobs`);
	} catch (error) {
		setBatchState(error.message);
	}
}

async function saveManifest() {
	if (jobs.some((job) => job.inputs.spatialAudio.proToolsOrder === 'auto')) {
		setBatchState('Resolve every channel order before saving');
		return;
	}
	let filePath = await ipcRenderer.invoke('show-save-dialog');
	if (!filePath) return;
	if (path.extname(filePath).toLowerCase() !== '.json') filePath += '.json';
	fs.writeFileSync(filePath, `${JSON.stringify(currentManifest(), null, 2)}\n`, 'utf8');
	setBatchState(`Saved ${path.basename(filePath)}`);
}

async function applyFolder() {
	const folder = await ipcRenderer.invoke('show-folder-dialog');
	if (!folder) return;
	for (const job of jobs) {
		if (!selectedIds.has(job.id)) continue;
		job.output.directory = folder;
		job.output.path = null;
	}
	render();
}

function applyFormat() {
	const format = document.getElementById('apply-format').value;
	for (const job of jobs) {
		if (!selectedIds.has(job.id)) continue;
		job.output.format = format;
		const outputFormat = OUTPUT_FORMATS.find((candidate) => candidate.id === format);
		if (outputFormat && outputFormat.packaging === 'multi-mono') {
			job.output.layout = 'multi-mono';
			job.output.fileType = 'wav';
		}
		job.output.path = null;
	}
	render();
}

function applyOutputLayout() {
	const layout = document.getElementById('apply-output-layout').value;
	for (const job of jobs) {
		if (!selectedIds.has(job.id)) continue;
		job.output.layout = layout;
		if (layout === 'multi-mono') {
			const profile = FILE_PROFILES.find((candidate) => candidate.id === job.output.fileType);
			if (!profile || profile.audioCodec !== 'pcm' || !['wav', 'aif'].includes(profile.container)) {
				job.output.fileType = 'wav';
			}
		}
		job.output.path = null;
	}
	render();
}

function applyMultiMonoSettings() {
	const indexBase = Number(document.getElementById('apply-multi-mono-index').value);
	const placement = document.getElementById('apply-multi-mono-placement').value;
	let updated = 0;

	for (const job of jobs) {
		if (!selectedIds.has(job.id) || !isMultiMonoJob(job)) continue;
		job.output.multiMono.indexBase = indexBase;
		job.output.multiMono.placement = placement;
		updated += 1;
	}

	if (!updated) {
		setBatchState('Select at least one multi-mono row');
	}
	render();
}

function setRunning(value) {
	running = value;
	document.getElementById('run').disabled = value;
	document.getElementById('cancel').disabled = !value;
	document.getElementById('add-files').disabled = value;
	if (value) setBatchState('Running', true);
}

async function runBatch() {
	if (!jobs.length || running) return;
	setRunning(true);
	statuses = new Map(jobs.map((job) => [job.id, job.enabled ? 'queued' : 'disabled']));
	statusMessages.clear();
	render();
	try {
		lastReport = await ipcRenderer.invoke('batch:run', currentManifest(), {});
		document.getElementById('show-report').disabled = false;
		const failed = lastReport.summary.failed;
		setBatchState(failed ? `Complete · ${failed} failed` : 'Complete');
	} catch (error) {
		setBatchState(error.message);
	} finally {
		setRunning(false);
		render();
	}
}

ipcRenderer.on('batch:event', (event, batchEvent) => {
	if (batchEvent.jobId) {
		if (batchEvent.type === 'jobStarted') statuses.set(batchEvent.jobId, 'running');
		if (batchEvent.type === 'analysisStarted') statuses.set(batchEvent.jobId, 'analyzing');
		if (batchEvent.type === 'jobCompleted') {
			statuses.set(
				batchEvent.jobId,
				batchEvent.reviewRequired ? 'review' : batchEvent.status
			);
			if (batchEvent.error) statusMessages.set(batchEvent.jobId, batchEvent.error);
		}
		render();
	}
});

dropZone.addEventListener('dragover', (event) => {
	event.preventDefault();
	dropZone.classList.add('dragging');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => {
	event.preventDefault();
	dropZone.classList.remove('dragging');
	addFiles([...event.dataTransfer.files]);
});

document.getElementById('apply-format').innerHTML = optionMarkup(OUTPUT_FORMATS, 'm1spatial-4');
document.getElementById('add-files').addEventListener('click', chooseInputs);
document.getElementById('group-horizon').addEventListener('click', groupSelectedAsHorizon);
document.getElementById('load-manifest').addEventListener('click', loadManifest);
document.getElementById('save-manifest').addEventListener('click', saveManifest);
document.getElementById('apply-folder').addEventListener('click', applyFolder);
document.getElementById('apply-format-button').addEventListener('click', applyFormat);
document.getElementById('apply-output-layout-button').addEventListener('click', applyOutputLayout);
document.getElementById('apply-multi-mono-settings').addEventListener('click', applyMultiMonoSettings);
document.getElementById('run').addEventListener('click', runBatch);
document.getElementById('cancel').addEventListener('click', () => ipcRenderer.invoke('batch:cancel'));
document.getElementById('clear-completed').addEventListener('click', () => {
	jobs = jobs.filter((job) => !['completed', 'review', 'disabled'].includes(statuses.get(job.id)));
	selectedIds = new Set(jobs.map((job) => job.id));
	render();
});
document.getElementById('show-report').addEventListener('click', () => {
	if (lastReport) ipcRenderer.invoke('report:show', lastReport);
});

render();
