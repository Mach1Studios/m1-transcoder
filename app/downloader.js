const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');
var mv = require('mv');
var rimraf = require("rimraf");

var isWin = process.platform === "win32";

const scriptPath = ipcRenderer.sendSync('get-script-path')
var scriptPathClean = scriptPath.replace(/ /g, '\\ ')

const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1 Spatial System/');
const ffmpeg = '"' + dataPath + (isWin ? "ffmpeg.exe" : "ffmpeg") + '"'; // scriptPathClean + "/../binaries/ffmpeg" + (isWin ? ".exe" : "")
const FFMPEG_ARCHIVE_URL = (isWin ? "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.1/ffmpeg-4.1-win-64.zip" : "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.1/ffmpeg-4.1.7-osx-64.zip");
const FFMPEG_ARCHIVE_FILENAME = (isWin ? "ffmpeg-4.1-win-64.zip" : "ffmpeg-4.1.7-osx-64.zip");
const m1transcodeDir = '"' + dataPath + (isWin ? "m1-transcode-win-x64/" : "m1-transcode-osx-x64/") + '"';
const m1transcode = '"' + dataPath + (isWin ? "m1-transcode-win-x64/m1-transcode.exe" : "m1-transcode-osx-x64/m1-transcode") + '"';
const M1TRANSCODE_ARCHIVE_URL = (isWin ? "https://mach1-releases.s3.amazonaws.com/1.5.11/transcode/m1-transcode-win-x64.zip" : "https://mach1-releases.s3.amazonaws.com/1.5.11/transcode/m1-transcode-osx-x64.zip");
const M1TRANSCODE_ARCHIVE_FILENAME = (isWin ? "m1-transcode-win-x64.zip" : "m1-transcode-osx-x64.zip");
// const spatialmedia = '"' + dataPath + "spatialmedia" + '"';
// const SPATIALMEDIA_ARCHIVE_URL = "https://github.com/google/spatial-media/archive/refs/heads/master.zip";
// const SPATIALMEDIA_DIR = "spatial-media-master";
// const SPATIALMEDIA_FILENAME = SPATIALMEDIA_DIR + ".zip";
// const spatialmediaDir = '"' + dataPath + SPATIALMEDIA_DIR + '"';

async function CheckForDependenciesAndDownload() {
	
	// check ffmpeg
	if (!fs.existsSync(ffmpeg.split('"').join(''))) {
		// show dialog
		$("#downloader").css("display", "");
		$("#downloader progress").attr('value', 0);

		log.info(FFMPEG_ARCHIVE_FILENAME);

		// download ffmpeg
		const response = await new Promise((resolve, reject) => {
			ipcRenderer.once('download-complete', (event, response) => {
			
				// unzip
				extract(dataPath + path.basename(FFMPEG_ARCHIVE_URL), {
					dir: dataPath
				}, function(err) {
					if (fs.existsSync(ffmpeg.split('"').join(''))) {
						// delete files
						fs.unlink(dataPath + path.basename(FFMPEG_ARCHIVE_FILENAME), function(err) {
							if (err) throw err;
							// if no error, file has been deleted successfully
							log.info(dataPath + path.basename(FFMPEG_ARCHIVE_FILENAME) + ' deleted!');
						});
					}
				});

				// hide dialog
				$("#downloader").css("display", "none");
				log.info("DONE: " + FFMPEG_ARCHIVE_FILENAME);
				
				resolve(response);
			});

			ipcRenderer.once('download-error', (event, response) => {
			  log.error(response);
			  resolve(response);
			});

			ipcRenderer.on('on-progress', (event, progress) => {
			  log.info("progress: " + progress);
			  $("#downloader progress").attr('value', progress);
			});

			ipcRenderer.send('start-download', FFMPEG_ARCHIVE_URL );
		});
	
	}


	// check m1-transcode
	if (!fs.existsSync(m1transcode.split('"').join(''))) {
		// show dialog
		$("#downloader").css("display", "");
		$("#downloader progress").attr('value', 0);

		log.info(M1TRANSCODE_ARCHIVE_FILENAME);

		// download m1-transcode
		const response = await new Promise((resolve, reject) => {
			ipcRenderer.once('download-complete', (event, response) => {
			
				// unzip
				extract(dataPath + path.basename(M1TRANSCODE_ARCHIVE_URL), {
					dir: dataPath
				}, function(err) {
					if (fs.existsSync(ffmpeg.split('"').join(''))) {
						// delete files
						fs.unlink(dataPath + path.basename(M1TRANSCODE_ARCHIVE_FILENAME), function(err) {
							if (err) throw err;
							// if no error, file has been deleted successfully
							log.info(dataPath + path.basename(M1TRANSCODE_ARCHIVE_FILENAME) + ' deleted!');
						});
					}
				});

				// hide dialog
				$("#downloader").css("display", "none");
				log.info("DONE: " + M1TRANSCODE_ARCHIVE_URL);
				
				resolve(response);
			});

			ipcRenderer.once('download-error', (event, response) => {
			  log.error(response);
			  resolve(response);
			});

			ipcRenderer.on('on-progress', (event, progress) => {
			  log.info("progress: " + progress);
			  $("#downloader progress").attr('value', progress);
			});

			ipcRenderer.send('start-download', M1TRANSCODE_ARCHIVE_URL );
		});
	}
}

function LogDependencies() {
	fs.readdirSync(dataPath).forEach(file => {
		if ((String(file) == ".DS_Store") || (String(file) == "temp")) {} else {
			log.info("Dependency: " + dataPath + file);
		}
	});
	fs.readdirSync(m1transcodeDir.split('"').join('')).forEach(file => {
		if ((String(file) == ".DS_Store") || (String(file) == "license")) {} else {
			log.info("Dependency: " + m1transcodeDir.split('"').join('') + file);
		}
	});
}

$(document).ready(async function() {
	CheckForDependenciesAndDownload();
});