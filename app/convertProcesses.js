const { ipcRenderer } = require('electron')
const util = require('util');
const exec = util.promisify(require('child_process').exec);
var child_process = require('child_process');
const log = require('electron-log');
log.catchErrors(options = {});

// $(document).ready(function() {
function escapingPath(par) {
	if (Array.isArray(par)) {
		for (var i in par) {
			if (par[i]) par[i] = escapeShell(par[i].toString().trim());
		}
	} else {
		if (par) par = escapeShell(par.toString().trim());
	}
	return par;
}

// Adapted from ruby shellwords
function escapeShell(str) {
	return str.replace(/([^A-Za-z0-9_\-.,:\/@\n])/g, '\\$1');
};

function unescapingPath(par) {
	return (par.match(/"?(.*?)"?$/))[1];
}

async function runExec(callString) {
	try {
	  const { stdout } = await exec(callString, { encoding: 'utf-8' });
	  console.log('Command executed successfully:', stdout);
	  return true;
	} catch (error) {
	  console.error('Failed!');
	  console.error(error.message);
	  return false;
	}
}

function runProcess(processData) {
	const {
		execFile
	} = require('child_process');
	const isWin = process.platform === "win32";
	const exe_type = (isWin ? ".exe" : "");
	const scriptPath = ipcRenderer.sendSync('get-script-path');
	const scriptPathClean = scriptPath.replace(/ /g, '\\ ');
	const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1/');
	const ffmpeg = '"' + dataPath + (isWin ? "ffmpeg.exe" : "ffmpeg") + '"'; // scriptPathClean + "/../binaries/ffmpeg" + (isWin ? ".exe" : "")
	const m1transcode = '"' + dataPath + (isWin ? "m1-transcode-win-x64/m1-transcode.exe" : "m1-transcode-osx-x64/m1-transcode") + '"';
	const ytmeta = path.join(ipcRenderer.sendSync('get-resource-path'), "extraResources", "spatialmedia", exe_type);

	//macOS temp dir setup
	let tempDir = dataPath + 'temp/' // scriptPathClean + "/../.."

	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, {
			recursive: true
		});
	}

	// if (fs.existsSync(m1transcode.split('"').join(''))) {
	// 	log.info("Using: " + m1transcode)
	// } else {
	// 	log.error("Error: Unable to find m1-transcode: " + m1transcode)
	// }
	// if (fs.existsSync(ffmpeg.split('"').join(''))) {
	// 	log.info("Using: " + ffmpeg)
	// } else {
	// 	log.error("Error: Unable to find ffmpeg: " + ffmpeg)
	// }
	// if (fs.existsSync(ytmeta.split('"').join(''))) {
	// 	log.info("Using: " + ytmeta)
	// } else {
	// 	log.error("Error: Unable to find spatialmedia: " + ytmeta)
	// }

	tempDir_notEscaped = tempDir
	tempDir = "\"" + tempDir + "\"";

	processData["input_filename"] = escapingPath(processData["input_filename"]);
	processData["stereo_filename"] = escapingPath(processData["stereo_filename"]);
	processData["input_video"] = escapingPath(processData["input_video"]);
	processData["output_filename"] = escapingPath(processData["output_filename"]);
	processData["output_video"] = escapingPath(processData["output_video"]);
	//processData["output_dir"] = escapingPath(processData["output_dir"]);

	switch (processData["process_kind"]) {

		//
		/*
		-------------------------------------------------------------
		CODEC CONVERTERS
		-------------------------------------------------------------
		*/
		//

		/* input -> m4a */
		case "14_channel_pcm_to_m4a":
    		log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"],
				" -map_channel 0.0.0 000.wav",
				" -map_channel 0.0.1 001.wav",
				" -map_channel 0.0.2 002.wav",
				" -map_channel 0.0.3 003.wav",
				" -map_channel 0.0.4 004.wav",
				" -map_channel 0.0.5 005.wav",
				" -map_channel 0.0.6 006.wav",
				" -map_channel 0.0.7 007.wav",
				" -map_channel 0.0.8 008.wav",
				" -map_channel 0.0.9 009.wav",
				" -map_channel 0.0.10 010.wav",
				" -map_channel 0.0.11 011.wav",
				" -map_channel 0.0.12 012.wav",
				" -map_channel 0.0.13 013.wav",
				"&&",
				ffmpeg, " -y -i 006.wav -i 000.wav -i 001.wav -i 007.wav",
				" -i 004.wav -i 005.wav -i 002.wav -i 003.wav -i 008.wav -i 009.wav -i 010.wav -i 011.wav -i 012.wav -i 013.wav",
				" -filter_complex \"aevalsrc=0|0[anull];",
				"[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a][10:a][11:a][12:a][13:a][anull]",
				"amerge=inputs=15[aout]\"",
				" -map [aout] -shortest MERGED.wav",
				"&&",
				ffmpeg, " -y -i MERGED.wav -metadata comment='mach1spatial-14'",
				" -c:a aac -b:a 2048k", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;
			
		case "12_channel_pcm_to_m4a":
			log.info(" executing " + processData["process_kind"]);
			
			var call = [
				"cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"],
				' -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav -map_channel 0.0.8 008.wav -map_channel 0.0.9 009.wav -map_channel 0.0.10 010.wav -map_channel 0.0.11 011.wav',
				"&&",
				ffmpeg, ' -y -i 006.wav -i 000.wav -i 001.wav -i 007.wav -i 004.wav -i 005.wav -i 002.wav -i 003.wav -i 008.wav -i 009.wav -i 010.wav -i 011.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a][10:a][11:a]amerge=inputs=12[aout]" -map [aout] MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -c:a eac3 -b:a 1536k -f mp4 ", processData["output_filename"]
			];
			var callString = call.join(' ');
			
			return runExec(callString);
			break;

		case "9_channel_pcm_to_m4a":
			log.info(" executing " + processData["process_kind"]);
	
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -c:a aac -b:a 1152k", processData["output_filename"]
			];
			var callString = call.join(' ');
	
			return runExec(callString);
			break;

		case "8_channel_pcm_to_m4a":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], ' -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav',
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 006.wav -i 007.wav -i 004.wav -i 005.wav -i 002.wav -i 003.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map [aout] MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -metadata comment='mach1spatial-8' -c:a aac -b:a 1024k", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_m4a":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]amerge=inputs=6[aout]" -map "[aout]" MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -c:a aac -b:a 384k", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_m4a":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -filter_complex "[0:a][1:a][2:a][3:a]amerge=inputs=4[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: figure out if -channel_layout quad is needed??!
				ffmpeg, " -y -i MERGED.wav -metadata comment='mach1horizon-4' -c:a aac -b:a 512k", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

			/* input -> opus */
		case "16_channel_pcm_to_opus":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -c:a libopus -mapping_family:a 255 -application:a audio -b:a 768K ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "9_channel_pcm_to_opus":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -c:a libopus -mapping_family:a 255 -application:a audio -b:a 432K ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "8_channel_pcm_to_opus":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, ' -y -i 002.wav -i 000.wav -i 001.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]join=inputs=8:channel_layout=octagonal[a]" -map "[a]" MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -metadata spatial-audio='mach1spatial-8' -c:a libopus -mapping_family:a 255 -application:a audio -b:a 384K ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_opus": // filters lfe channel
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 002.wav -i 001.wav -i 005.wav -i 003.wav -i 004.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]amerge=inputs=6[aout]" -map "[aout]" MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -c:a libopus -application:a audio -b:a 288K ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_opus":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i MERGED.wav -metadata spatial-audio='mach1horizon-4' -c:a libopus -mapping_family:a 255 -application:a audio -b:a 192K ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

			/* input -> ogg */
		case "16_channel_pcm_to_ogg":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "9_channel_pcm_to_ogg":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "8_channel_pcm_to_ogg":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 002.wav -i 001.wav -i 007.wav -i 005.wav -i 006.wav -i 003.wav -i 004.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -metadata spatial-audio='mach1spatial-8' -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_ogg": // filters lfe channel
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 002.wav -i 001.wav -i 005.wav -i 003.wav -i 004.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]join=inputs=6:channel_layout=hexagonal[a]" -map "[a]" MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_ogg":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i MERGED.wav -metadata spatial-audio='mach1horizon-4' -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

			/* input -> wav */
		case "16_channel_pcm_to_wav":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav -map_channel 0.0.6", " -c:a ", processData["bitdepth"] + "le 006.wav -map_channel 0.0.7", " -c:a ", processData["bitdepth"] + "le 007.wav -map_channel 0.0.8", " -c:a ", processData["bitdepth"] + "le 008.wav -map_channel 0.0.9", " -c:a ", processData["bitdepth"] + "le 009.wav -map_channel 0.0.10", " -c:a ", processData["bitdepth"] + "le 010.wav -map_channel 0.0.11", " -c:a ", processData["bitdepth"] + "le 011.wav -map_channel 0.0.12", " -c:a ", processData["bitdepth"] + "le 012.wav -map_channel 0.0.13", " -c:a ", processData["bitdepth"] + "le 013.wav -map_channel 0.0.14", " -c:a ", processData["bitdepth"] + "le 014.wav -map_channel 0.0.15", " -c:a ", processData["bitdepth"] + "le 015.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -i 008.wav -i 009.wav -i 010.wav -i 011.wav -i 012.wav -i 013.wav -i 014.wav -i 015.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a][10:a][11:a][12:a][13:a][14:a][15:a]amerge=inputs=16[aout]" -map "[aout]" -c:a ' + processData["bitdepth"] + 'le MERGED.wav'
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "9_channel_pcm_to_wav":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav -map_channel 0.0.6", " -c:a ", processData["bitdepth"] + "le 006.wav -map_channel 0.0.7", " -c:a ", processData["bitdepth"] + "le 007.wav -map_channel 0.0.8", " -c:a ", processData["bitdepth"] + "le 008.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -i 008.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a]amerge=inputs=9[aout]" -map "[aout]" -c:a ' + processData["bitdepth"] + 'le MERGED.wav'
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "8_channel_pcm_to_wav":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav -map_channel 0.0.6", " -c:a ", processData["bitdepth"] + "le 006.wav -map_channel 0.0.7", " -c:a ", processData["bitdepth"] + "le 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 006.wav -i 007.wav -i 004.wav -i 005.wav -i 002.wav -i 003.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" -c:a ' + processData["bitdepth"] + 'le MERGED.wav'
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "8_channel_pcm_to_wav_output":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 -c:a " + processData["bitdepth"] + "le 000.wav -map_channel 0.0.1 -c:a " + processData["bitdepth"] + "le 001.wav -map_channel 0.0.2 -c:a " + processData["bitdepth"] + "le 002.wav -map_channel 0.0.3 -c:a " + processData["bitdepth"] + "le 003.wav -map_channel 0.0.4 -c:a " + processData["bitdepth"] + "le 004.wav -map_channel 0.0.5 -c:a " + processData["bitdepth"] + "le 005.wav -map_channel 0.0.6 -c:a " + processData["bitdepth"] + "le 006.wav -map_channel 0.0.7 -c:a " + processData["bitdepth"] + "le 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" -metadata ICMT="mach1spatial-8" -c:a ' + processData["bitdepth"] + 'le ' + processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_wav":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]amerge=inputs=6[aout]" -map "[aout]" -c:a ' + processData["bitdepth"] + 'le MERGED.wav'
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_wav":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -filter_complex "[0:a][1:a][2:a][3:a]amerge=inputs=4[aout]" -map "[aout]" -metadata ICMT="mach1horizon-4" -c:a ' + processData["bitdepth"] + 'le MERGED.wav'
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

			/* input + stereo -> m4a */

		case "8_channel_pcm_to_m4a_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0 008.wav -map_channel 0.0.1 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a]amerge=inputs=10[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -metadata comment='mach1spatial-8' -c:a aac -b:a 640k -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_m4a_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0 008.wav -map_channel 0.0.1 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -c:a aac -b:a 640k -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_m4a_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0 008.wav -map_channel 0.0.1 009.wav",
				"&&",
				ffmpeg, ' -y -i 001.wav -i 002.wav -i 000.wav -i 009.wav -i 003.wav -i 008.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]amerge=inputs=6[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -metadata comment='mach1horizon-4' -c:a aac -b:a 640k -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

			/* input + stereo -> ogg */

		case "8_channel_pcm_to_ogg_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0 008.wav -map_channel 0.0.1 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a]amerge=inputs=10[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -metadata spatial-audio='mach1spatial-8' -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_ogg_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0 008.wav -map_channel 0.0.1 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_ogg_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0 008.wav -map_channel 0.0.1 009.wav",
				"&&",
				ffmpeg, ' -y -i 001.wav -i 002.wav -i 000.wav -i 009.wav -i 003.wav -i 008.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]amerge=inputs=6[aout]" -map "[aout]" MERGED.wav',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -metadata spatial-audio='mach1horizon-4' -c:a libvorbis -q:a 10 ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

			/* input + stereo -> wav */

		case "8_channel_pcm_to_wav_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav -map_channel 0.0.6", " -c:a ", processData["bitdepth"] + "le 006.wav -map_channel 0.0.7", " -c:a ", processData["bitdepth"] + "le 007.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 008.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 006.wav -i 007.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a]amerge=inputs=10[aout]" -map "[aout]" -metadata ICMT="mach1spatial-8" -c:a ' + processData["bitdepth"] + 'le ' + processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_wav_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 008.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 004.wav -i 005.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" ', processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "4_channel_pcm_to_wav_plus_stereo":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav",
				"&&",
				ffmpeg, " -y -i ", processData["stereo_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 008.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 009.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 003.wav -i 008.wav -i 009.wav -filter_complex "[0:a][1:a][2:a][3:a][8:a][9:a]amerge=inputs=6[aout]" -map "[aout]" -metadata ICMT="mach1horizon-4" -c:a ' + processData["bitdepth"] + 'le ' + processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "6_channel_pcm_to_eac3":
			log.info(" executing " + processData["process_kind"]);

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 002.wav -i 001.wav -i 005.wav -i 003.wav -i 004.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]join=inputs=6:channel_layout=5.1(side)[a]" -map "[a]" MERGED.wav',
				"&&",
				ffmpeg, " -y -i MERGED.wav -c:a eac3 -ab 768k ", processData["output_filename"]
			];
			var callString = call.join(' ');

			return runExec(callString);
			break;
		
		//
		/*
		-------------------------------------------------------------
		FORMAT CONVERTERS
		-------------------------------------------------------------
		*/
		//
		
		case "m1transcode_spatial2horizon":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				m1transcode, 'm1transcode -in-file "', processData["input_filename"], '" -in-fmt M1Spatial -out-file ', processData["output_filename"], "-out-fmt M1Horizon"
			];

			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "m1transcode_spatial2horizon_plus_stereo":
			log.info(" executing " + processData["process_kind"]);
			var call = [m1transcode, 'm1transcode -in-file "', processData["input_filename"], " ", processData["stereo_filename"], '" -in-fmt M1Spatial_S -out-file output_audio.wav -out-fmt M1HorizonPairs',
				"&&",
				ffmpeg, " -y -i output_audio.wav -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav ",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -i 002.wav -i 007.wav -i 005.wav -i 006.wav -i 003.wav -i 004.wav -filter_complex ', '"join=inputs=8:channel_layout=7.1"', ' MERGED.wav ',
				"&&",
				//TODO: check this channel order
				ffmpeg, " -y -i MERGED.wav -c:a aac -b:a 512k -q:a 10 MERGED.m4a"
			];

			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "m1transcode":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				" && ",
				m1transcode, ' m1transcode -in-file "', processData["input_filename"], '" -in-fmt ', processData["input_format"], ' -out-file ', processData["output_filename"], ' -out-fmt ', processData["output_format"], ' -master-gain ', processData["master_gain"], ' -out-file-chans ', processData["output_channelnum"],
			];
			var callString = call.join('');

			return runExec(callString);
			break;

		case "m1transcode_normalize":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				" && ",
				m1transcode, ' m1transcode -in-file "', processData["input_filename"], '" -in-fmt ', processData["input_format"], ' -out-file ', processData["output_filename"], ' -out-fmt ', processData["output_format"], ' -master-gain ', processData["master_gain"], ' -normalize -out-file-chans ', processData["output_channelnum"],
			];
			var callString = call.join('');

			return runExec(callString);
			break;

		case "m1transcode_json":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				" && ",
				m1transcode, ' m1transcode -in-file "', processData["input_filename"], '" -in-fmt ', processData["input_format"], ' -out-json ', processData["output_Json"], ' -out-file ', processData["output_filename"], ' -out-fmt ', processData["output_format"], ' -out-file-chans ', processData["output_channelnum"],
			];
			var callString = call.join('');

			return runExec(callString);
			break;

		//
		/*
		-------------------------------------------------------------
		EXTRA/UTILITY
		-------------------------------------------------------------
		*/
		//

		case "TBE_copy_to_dir":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				"mv makeTBE.wav ", processData["output_filename"] + "_3D.wav"
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "TBE_copy_to_dir_plus_stereo":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				"mv makeTBE.wav ", processData["output_filename"] + "_3D.wav",
				"&&",
				"cp " + processData["stereo_filename"] + " " + processData["output_filename"] + "_ST.wav"
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "copy_to_output_dir_wav":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				"mv 000.wav ", escapingPath(processData["output_dir"] + "000.wav"),
				"&&",
				"mv 001.wav ", escapingPath(processData["output_dir"] + "001.wav"),
				"&&",
				"mv 002.wav ", escapingPath(processData["output_dir"] + "002.wav"),
				"&&",
				"mv 003.wav ", escapingPath(processData["output_dir"] + "003.wav"),
				"&&",
				"mv 004.wav ", escapingPath(processData["output_dir"] + "004.wav"),
				"&&",
				"mv 005.wav ", escapingPath(processData["output_dir"] + "005.wav"),
				"&&",
				"mv 006.wav ", escapingPath(processData["output_dir"] + "006.wav"),
				"&&",
				"mv 007.wav ", escapingPath(processData["output_dir"] + "007.wav")
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "copy_to_output_dir_m4a":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, "-i 000.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "000.m4a"),
				"&&",
				ffmpeg, "-i 001.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "001.m4a"),
				"&&",
				ffmpeg, "-i 002.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "002.m4a"),
				"&&",
				ffmpeg, "-i 003.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "003.m4a"),
				"&&",
				ffmpeg, "-i 004.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "004.m4a"),
				"&&",
				ffmpeg, "-i 005.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "005.m4a"),
				"&&",
				ffmpeg, "-i 006.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "006.m4a"),
				"&&",
				ffmpeg, "-i 007.wav -c:a aac -b:a 128k -q:a 10 ", escapingPath(processData["output_dir"] + "007.m4a")
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "copy_to_output_dir_ogg":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, "-i 000.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "000.ogg"),
				"&&",
				ffmpeg, "-i 001.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "001.ogg"),
				"&&",
				ffmpeg, "-i 002.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "002.ogg"),
				"&&",
				ffmpeg, "-i 003.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "003.ogg"),
				"&&",
				ffmpeg, "-i 004.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "004.ogg"),
				"&&",
				ffmpeg, "-i 005.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "005.ogg"),
				"&&",
				ffmpeg, "-i 006.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "006.ogg"),
				"&&",
				ffmpeg, "-i 007.wav -c:a libvorbis -q:a 10 ", escapingPath(processData["output_dir"] + "007.ogg")
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "8_channel_ProToolsWav_to_pcm":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0", " -c:a ", processData["bitdepth"] + "le 000.wav -map_channel 0.0.1", " -c:a ", processData["bitdepth"] + "le 001.wav -map_channel 0.0.2", " -c:a ", processData["bitdepth"] + "le 002.wav -map_channel 0.0.3", " -c:a ", processData["bitdepth"] + "le 003.wav -map_channel 0.0.4", " -c:a ", processData["bitdepth"] + "le 004.wav -map_channel 0.0.5", " -c:a ", processData["bitdepth"] + "le 005.wav -map_channel 0.0.6", " -c:a ", processData["bitdepth"] + "le 006.wav -map_channel 0.0.7", " -c:a ", processData["bitdepth"] + "le 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 002.wav -i 001.wav -i 006.wav -i 007.wav -i 004.wav -i 005.wav -i 003.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" -metadata ICMT="mach1spatial-8" -c:a ' + processData["bitdepth"] + 'le ' + processData["output_filename"]
			];
			var callString = call.join(' ');
			log.info("call: " + callString);
			return runExec(callString);
			break;

		case "spatial_to_samsungvr":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st1.wav',
				"&&",
				ffmpeg, ' -y -i 002.wav -i 003.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st2.wav',
				"&&",
				ffmpeg, ' -y -i 004.wav -i 005.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st3.wav',
				"&&",
				ffmpeg, ' -y -i 006.wav -i 007.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st4.wav',
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i st1.wav -i st2.wav -i st3.wav -i st4.wav -vcodec copy -map 0:0 -map 1:0 -map 2:0 -map 3:0 -map 4:0 ", processData["output_video"]
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "spatial_to_samsungvr_plus_stereo":
			log.info(" executing " + processData["process_kind"]);
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st1.wav',
				"&&",
				ffmpeg, ' -y -i 002.wav -i 003.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st2.wav',
				"&&",
				ffmpeg, ' -y -i 004.wav -i 005.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st3.wav',
				"&&",
				ffmpeg, ' -y -i 006.wav -i 007.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st4.wav',
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i st1.wav -i st2.wav -i st3.wav -i st4.wav -i ", processData["stereo_filename"], " -vcodec copy -map 0:0 -map 1:0 -map 2:0 -map 3:0 -map 4:0 -map 5:0 ", processData["output_video"]
			];
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "youtube-meta":
			var call = [
				ytmeta, " -i --stereo=" + processData["videoScopic"], "--spatial-audio ", escapingPath(tempDir_notEscaped+processData["input_filename"]), " ", escapingPath(processData["output_video"])
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			log.info("the exact call is:" + callString);
			return runExec(callString);
			break;

		case "ffmpeg-gain":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"],
				' -c:a ' + processData["bitdepth"] + 'le -af "volume=', processData["gain"], '" ', processData["output_filename"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "ffmpeg-trim-to-8ch":
			var call = ["cd ", tempDir, 
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"],
				' -c:a ' + processData["bitdepth"] + 'le -af pan=8c|c0=c0|c1=c1|c2=c2|c3=c3|c4=c4|c5=c5|c6=c6|c7=c7', processData["output_filename"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "ffmpeg-trim-to-12ch":
			var call = ["cd ", tempDir, 
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"],
				' -c:a ' + processData["bitdepth"] + 'le -af pan=12c|c0=c0|c1=c1|c2=c2|c3=c3|c4=c4|c5=c5|c6=c6|c7=c7|c8=c8|c9=c9|c10=c10|c11=c11', processData["output_filename"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "ffmpeg-trim-to-14ch":
			var call = ["cd ", tempDir, 
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"],
				' -c:a ' + processData["bitdepth"] + 'le -af pan=14c|c0=c0|c1=c1|c2=c2|c3=c3|c4=c4|c5=c5|c6=c6|c7=c7|c8=c8|c9=c9|c10=c10|c11=c11|c12=c12|c13=c13', processData["output_filename"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "ffmpeg-mute":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -vcodec copy -an ", processData["output_video"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			log.info("call: " + callString);
			return runExec(callString);
			break;

		case "6_channel_pcm_to_eac3_spawnvideo":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 002.wav -i 001.wav -i 005.wav -i 003.wav -i 004.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a]join=inputs=6:channel_layout=5.1(side)[a]" -map "[a]" MERGED.wav',
				"&&",
				ffmpeg, " -y -loop 1 -i ", processData["input_video_image"], " -i MERGED.wav -c:v libx264 -pix_fmt yuv420p -r 24 -b:v 277k -tune stillimage -shortest -c:a eac3 -b:a 768k ", processData["output_filename"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			log.info("call: " + callString);
			return runExec(callString);
			break;

		case "attach_audio_to_video_hard":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i ", processData["input_audio"], " -vcodec copy -acodec copy -metadata comment='mach1spatial-8' ", processData["output_video"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			log.info("call: " + callString);
			return runExec(callString);
			break;

		case "merge_4_single_files_to_wav":
			var filenames = processData["input_filename"];
			log.info("merging 4 files to wav: " + filenames)
			var actualFiles = ["", "", "", ""];

			for (var i in filenames) {
				if (filenames[i].search("000") != -1) actualFiles[0] = filenames[i];
				if (filenames[i].search("090") != -1) actualFiles[1] = filenames[i];
				if (filenames[i].search("180") != -1) actualFiles[2] = filenames[i];
				if (filenames[i].search("270") != -1) actualFiles[3] = filenames[i];
			}

			for (var i in actualFiles) {
				if (actualFiles[i] == "") {
					log.info("didn't find the correct files inside ", filenames);
					return false;
				}
			}

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", actualFiles[0], " -map_channel 0.0.0 1.wav -map_channel 0.0.1 2.wav",
				"&&",
				ffmpeg, " -y -i ", actualFiles[1], " -map_channel 0.0.0 3.wav -map_channel 0.0.1 4.wav",
				"&&",
				ffmpeg, " -y -i ", actualFiles[2], " -map_channel 0.0.0 5.wav -map_channel 0.0.1 6.wav",
				"&&",
				ffmpeg, " -y -i ", actualFiles[3], " -map_channel 0.0.0 7.wav -map_channel 0.0.1 8.wav",
				"&&",
				ffmpeg, ' -y -i 1.wav -i 2.wav -i 3.wav -i 4.wav -i 5.wav -i 6.wav -i 7.wav -i 8.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" MERGED.wav'
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "attach_audio_to_video_soft":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i ", processData["input_audio"], " -c:v copy -metadata comment='mach1spatial-8' ", processData["output_video"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "attach_4x2_audio_to_video_hard":
			var filenames = processData["input_filename"];
			var actualFiles = ["", "", "", ""];

			for (var i in filenames) {
				if (filenames[i].search("000") != -1) actualFiles[0] = filenames[i];
				if (filenames[i].search("090") != -1) actualFiles[1] = filenames[i];
				if (filenames[i].search("180") != -1) actualFiles[2] = filenames[i];
				if (filenames[i].search("270") != -1) actualFiles[3] = filenames[i];
			}

			for (var i in actualFiles) {
				if (filenames[i] == "") {
					log.info(is);
					return false;
				}
			}

			for (var i in actualFiles) {
				if (filenames[i] == "") {
					log.info("didn't find the correct files inside ", filenames);
					return false;
				}
			}

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i ", actualFiles[0], " -i ", actualFiles[1], " -i ", actualFiles[2], " -i ", actualFiles[3], " -vcodec copy -acodec copy -map 0:0 -map 1:0 -map 2:0 -map 3:0 -map 4:0 ", processData["output_video"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			return runExec(callString);
			break;

		case "attach_4x2_audio_to_video_soft":
			var filenames = processData["input_filename"];
			var actualFiles = ["", "", "", ""];

			for (var i in filenames) {
				if (filenames[i].search("000") != -1) actualFiles[0] = filenames[i];
				if (filenames[i].search("090") != -1) actualFiles[1] = filenames[i];
				if (filenames[i].search("180") != -1) actualFiles[2] = filenames[i];
				if (filenames[i].search("270") != -1) actualFiles[3] = filenames[i];
			}

			for (var i in actualFiles) {
				if (filenames[i] == "") {
					log.info(is);
					return false;
				}
			}

			for (var i in actualFiles) {
				if (i == "") {
					log.info("didn't find the correct files inside ", filenames);
					return false;
				}
			}

			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i ", actualFiles[0], " -i ", actualFiles[1], " -i ", actualFiles[2], " -i ", actualFiles[3], " -c:v copy -map 0:0 -map 1:0 -map 2:0 -map 3:0 -map 4:0 ", processData["output_video"]
			];

			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');

			return runExec(callString);
			break;

		case "make_4x2_audio_to_video":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st1.wav',
				"&&",
				ffmpeg, ' -y -i 002.wav -i 003.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st2.wav',
				"&&",
				ffmpeg, ' -y -i 004.wav -i 005.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st3.wav',
				"&&",
				ffmpeg, ' -y -i 006.wav -i 007.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" st4.wav',
				"&&",
				ffmpeg, " -y -i ", processData["input_video"],
				" -i st1.wav -i st2.wav -i st3.wav -i st4.wav -vcodec copy -map 0:0 -map 1:0 -map 2:0 -map 3:0 -map 4:0 ", processData["output_video"]
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			log.info("call: " + callString);
			return runExec(callString);
			break;

		case "make_4x2_audio":
			var call = ["cd ", tempDir,
				"&&",
				ffmpeg, " -y -i ", processData["input_filename"], " -map_channel 0.0.0 000.wav -map_channel 0.0.1 001.wav -map_channel 0.0.2 002.wav -map_channel 0.0.3 003.wav -map_channel 0.0.4 004.wav -map_channel 0.0.5 005.wav -map_channel 0.0.6 006.wav -map_channel 0.0.7 007.wav",
				"&&",
				ffmpeg, ' -y -i 000.wav -i 001.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" ', processData["output_filename"], "_st1",
				"&&",
				ffmpeg, ' -y -i 002.wav -i 003.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" ', processData["output_filename"], "_st2",
				"&&",
				ffmpeg, ' -y -i 004.wav -i 005.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" ', processData["output_filename"], "_st3",
				"&&",
				ffmpeg, ' -y -i 006.wav -i 007.wav -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" ', processData["output_filename"], "_st4"
			];
			log.info(" executing " + processData["process_kind"]);
			var callString = call.join(' ');
			log.info("call: " + callString);
			return runExec(callString);
			break;
	}
	return false;
};

async function performSetOfProcesses(data) {
	for (var i = 0; i < data.length; i++) {
		log.info("process " + i + " - " + data[i]["process_kind"]);

		var processResult = await runProcess(data[i]);

		if (!processResult) {
			log.error("failed at process " + i);
			return false;
		}
	}

	log.info("finished successfully");

	return true;
}

//});