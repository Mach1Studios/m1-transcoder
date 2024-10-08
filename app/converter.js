// temporarily preventing drag-and-drop from working
document.addEventListener('dragover', event => event.preventDefault())
document.addEventListener('drop', event => event.preventDefault())

$(document).ready(async function() {
	window.inputAudioFiles = [];
	window.inputStereoFiles = [];
	window.inputVideoFiles = [];
	window.inputJsonFiles = [];

	inputVideoEmpty = true;
	inputStereoEmpty = true;
	updateUIInputOptionsDependingOnSelectedFileTypes();

	// Used to indicate if the file needs to trim down first
	// TODO: use pre-processing for this and fromPT detection
	window.trim_to = "";

	$("select, input").change(function() {
		HideMessage();
	});

	document.body.ondragover = () => {
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').show();
		return false;
	};

	document.getElementById('dragAudio').ondragover = () => {
		$('#dragAudio').addClass("hovered");
		$('#dragStereo').removeClass("hovered");
		$('#dragJson').removeClass("hovered");
		$('#dragVideo').removeClass("hovered");
		return false;
	};

	document.getElementById('dragStereo').ondragover = () => {
		$('#dragAudio').removeClass("hovered");
		$('#dragStereo').addClass("hovered");
		$('#dragJson').removeClass("hovered");
		$('#dragVideo').removeClass("hovered");
		return false;
	}

	document.getElementById('dragJson').ondragover = () => {
		$('#dragAudio').removeClass("hovered");
		$('#dragStereo').removeClass("hovered");
		$('#dragJson').addClass("hovered");
		$('#dragVideo').removeClass("hovered");
		return false;
	}

	document.getElementById('dragVideo').ondragover = () => {
		$('#dragAudio').removeClass("hovered");
		$('#dragStereo').removeClass("hovered");
		$('#dragJson').removeClass("hovered");
		$('#dragVideo').addClass("hovered");
		return false;
	};

	document.getElementById('dragAudio').ondragleave = () => {
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		return false;
	};

	document.getElementById('dragStereo').ondragleave = () => {
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		return false;
	};

	document.getElementById('dragJson').ondragleave = () => {
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		return false;
	};

	document.getElementById('dragVideo').ondragleave = () => {
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		return false;
	};

	document.getElementById('dragAudio').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		if (e.dataTransfer.files.length > 0) {
			// TODO: Display indicator for detecting multiple files
			$('#Audio input[type="text"]').val(e.dataTransfer.files[0].path);
		}
		window.inputAudioFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Spatial Audio File: ", f.path)
			window.inputAudioFiles[index] = f.path;
			index++;
		}
		return false;
	};

	document.getElementById('dragStereo').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		if (e.dataTransfer.files.length > 0) {
			$('#StereoAudio input[type="text"]').val(e.dataTransfer.files[0].path);
		}
		window.inputStereoFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Stereo File: ", f.path)
			window.inputStereoFiles[index] = f.path;
			index++;
		}
		return false;
	};	

	document.getElementById('dragJson').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		if (e.dataTransfer.files.length > 0) {
			$('#JsonInput input[type="text"]').val(e.dataTransfer.files[0].path);
		}
		window.inputJsonFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Json File: ", f.path)
			window.inputJsonFiles[index] = f.path;
			index++;
		}
		return false;
	};	

	document.getElementById('dragVideo').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		if (e.dataTransfer.files.length > 0) {
			$('#Video input[type="text"]').val(e.dataTransfer.files[0].path);
		}
		window.inputVideoFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Video File: ", f.path)
			window.inputVideoFiles[index] = f.path;
			index++;
		}
		return false;
	};

	function getChannelCount(audioFilePath) {
		const { execSync } = require('child_process');
		const ffprobeCommand = `ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`;
	
		try {
			const stdout = execSync(ffprobeCommand, { encoding: 'utf8' });
			const channelCount = parseInt(stdout.trim(), 10);
			return channelCount;
		} catch (error) {
			console.error(`Error getting channel count: ${error.stderr}`);
			throw error;
		}
	}
	

	function checkSpatialAudioInput() {
		const exec = require('child_process').execSync;
		const scriptPath = ipcRenderer.sendSync('get-script-path');
		const scriptPathClean = scriptPath.replace(/ /g, '\\ ');
		const isWin = process.platform === "win32";
		const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1/');
		const ffmpeg = '"' + dataPath + (isWin ? "ffmpeg.exe" : "ffmpeg") + '"'; // scriptPathClean + "/../binaries/ffmpeg" + (isWin ? ".exe" : "")

		// Reset vars
		window.trim_to = "";
		var channelCount = 0;
		var re = "";
		var bitdepth = "";
		var encoded_by = "";
		var ext = "";

		for (let filePath of window.inputAudioFiles) {
			// checking channel count
			try {
				exec(ffmpeg + ' -i "' + filePath + '"', function(error, stdout, stderr) {
					log.info('stdout', stdout);
					console.error('stderr', stderr);
					if (error !== null) {
						log.error('exec error: ', error);
					}
				});
			} catch (err) {
				if (err.toString().indexOf("Audio:") >= 0) {
					//re = /(?<=Audio: )[^\ ]+/; // this failed because we cannot support look behinds
					re = /Audio:\s(\w+)/;
					bitdepth = re.exec(err)[1]; // extracting file extension
					log.info("Input BitDepth: " + bitdepth);
					window.OutputBitDepth = bitdepth; // copy the string from ffmpeg input for -c:a call
					log.info("Output BitDepth: " + window.OutputBitDepth);
					window.OutputBitDepthShort = bitdepth.substring(0, bitdepth.length - 2);
					log.info("Output Bitdepth Short: " + window.OutputBitDepthShort);
				}

				if (err.toString().indexOf("encoded_by") >= 0) {
					re = /.*encoded_by[ ]*:[ ]*(.*)[ \r\n]*\n/;
					encoded_by = re.exec(err)[1]; // extracting file extension
					log.info("Encoded By: " + encoded_by);
				}

				if (err.toString().indexOf(", 7.1") >= 0 || err.toString().indexOf(", 8 channels,") >= 0) {
					// var occurenceIndex = err.toString().indexOf("channels");
					// channelCount = err.toString().substr(occurenceIndex - 2, 2);
					channelCount = 8;
					log.info("Input Spatial Audio Channel Count: " + channelCount);
					re = /(?:\.([^.]+))?$/;
					ext = re.exec(filePath)[1]; // extracting file extension
					log.info("Input Spatial Audio Extension: " + ext)

					//Check if ProTools .wav for reorder
					if ((encoded_by == "Pro Tools") && (ext == "wav") && (channelCount == 8)) {
						window.fromProToolsNeedsChannelReOrdering = true; // indicates we should reorder!
						log.info("Input Spatial Audio File was exported from Pro Tools, will use channel re-ordering...");
					} else {
						window.fromProToolsNeedsChannelReOrdering = false;
						log.info("Input Spatial Audio File not from Pro Tools or is .aif...")
					}
				} else if (err.toString().indexOf("hexadecagonal") >= 0 || err.toString().indexOf(" channels") >= 0) {
					if (err.toString().indexOf("hexadecagonal") >= 0) {
						channelCount = 16;
					} else {
						// parse the number before the listed channels
						re = /(\d+) channels/gm;
						channelCount = re.exec(err)[1]; // extracting the number before found channels
					}
					log.info("Channel Count: " + channelCount);

					//Check if ProTools .wav for clipping out extra channels
					if ((encoded_by == "Pro Tools") && (channelCount > 8)) {
						log.info("Input Spatial Audio File was exported from Pro Tools, will remove extra channels...");
						
						// TODO: Allow user selection of input format 
						if (channelCount < 8) {
							window.trim_to = "Mach1Spatial-4";
						} else if (channelCount < 12) {
							window.trim_to = "Mach1Spatial-8"; // assume Mach1Spatial-8
						} else if (channelCount < 14) {
							window.trim_to = "Mach1Spatial-12"; // assume Mach1Spatial-12
						} else if (channelCount > 14) {
							window.trim_to = "Mach1Spatial-14"; // assume Mach1Spatial-14
						}

						log.info("Input Mach1 Spatial Config: " + window.trim_to);
						window.fromProToolsNeedsChannelReOrdering = false;

					} else {
						window.fromProToolsNeedsChannelReOrdering = false;
						log.info("Input Spatial Audio File is from Pro Tools and marked for channel count trimming...")
					}
				} else {
					log.info("Error: Input Spatial Audio channel count not found...");
					log.info(err.toString())
					window.fromProToolsNeedsChannelReOrdering = false;
				}
			}
		}
		log.info("Input Spatial Audio from ProTools and needs channel re-ordering? " + window.fromProToolsNeedsChannelReOrdering);
		HideMessage();
		updateUIInputOptionsDependingOnSelectedFileTypes();
	}

	function preprocessSpatialAudioInput() {
		const exec = require('child_process').execSync;
		const scriptPath = ipcRenderer.sendSync('get-script-path');
		const scriptPathClean = scriptPath.replace(/ /g, '\\ ');
		const isWin = process.platform === "win32";
		const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1/');
		const ffmpeg = '"' + dataPath + (isWin ? "ffmpeg.exe" : "ffmpeg") + '"'; // 

		// get temp dir
		var tempDir = dataPath + 'temp/' // scriptPathClean + "/../.."
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, {
				recursive: true
			});
		}
		tempDir = "\"" + tempDir + "\"";

		if (window.inputAudioFiles.length == 1) {
			if (window.fromProToolsNeedsChannelReOrdering) {
				// TODO: Make if statements based on channelCount
				try {
					exec("cd "+tempDir+" && "+ffmpeg+' -y -i "'+window.inputAudioFiles[0]+'" -map_channel 0.0.0 -c:a '+window.OutputBitDepthShort+'le 000.wav -map_channel 0.0.1 -c:a '+window.OutputBitDepthShort+'le 001.wav -map_channel 0.0.2 -c:a '+window.OutputBitDepthShort+'le 002.wav -map_channel 0.0.3 -c:a '+window.OutputBitDepthShort+'le 003.wav -map_channel 0.0.4 -c:a '+window.OutputBitDepthShort+'le 004.wav -map_channel 0.0.5 -c:a '+window.OutputBitDepthShort+'le 005.wav -map_channel 0.0.6 -c:a '+window.OutputBitDepthShort+'le 006.wav -map_channel 0.0.7 -c:a '+window.OutputBitDepthShort+'le 007.wav', function(error, stdout, stderr) {
						log.info('stdout', stdout);
						console.error('stderr', stderr);
						if (error !== null) {
							log.error('exec error: ', error);
						}
					});
				} catch (err) {
					log.info("[fromProTools] Split 8ch 7.1 PT export into multi-mono");
				}
				try {
					exec("cd "+tempDir+" && "+ffmpeg+' -y -i 000.wav -i 002.wav -i 001.wav -i 006.wav -i 007.wav -i 004.wav -i 005.wav -i 003.wav -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a]amerge=inputs=8[aout]" -map "[aout]" -metadata ICMT="mach1spatial-8" -c:a '+window.OutputBitDepthShort+'le inputspatialaudio.wav', function(error, stdout, stderr) {
						log.info('stdout', stdout);
						console.error('stderr', stderr);
						if (error !== null) {
							log.error('exec error: ', error);
						}
					});
				} catch (err) {
					log.info("[fromProTools] Recombined the multi-mono into a discretely ordered 8ch file");
				}
			}
			if (window.trim_to != "") {
				if (window.trim_to == "Mach1Spatial-8") {
					try {
						exec("cd "+tempDir+" && "+ffmpeg+' -y -i "'+window.inputAudioFiles[0]+'" -c:a '+window.OutputBitDepthShort+'le -af "pan=8c|c0=c0|c1=c1|c2=c2|c3=c3|c4=c4|c5=c5|c6=c6|c7=c7" inputspatialaudio.wav', function(error, stdout, stderr) {
							log.info('stdout', stdout);
							console.error('stderr', stderr);
							if (error !== null) {
								log.error('exec error: ', error);
							}
						});
					} catch (err) {
						log.info("Trimmed number of channels to: " + window.trim_to);
					}
				}
				else if (window.trim_to == "Mach1Spatial-12") {
					try {
						exec("cd "+tempDir+" && "+ffmpeg+' -y -i "'+window.inputAudioFiles[0]+'" -c:a '+window.OutputBitDepthShort+'le -af "pan=12c|c0=c0|c1=c1|c2=c2|c3=c3|c4=c4|c5=c5|c6=c6|c7=c7|c8=c8|c9=c9|c10=c10|c11=c11" inputspatialaudio.wav', function(error, stdout, stderr) {
							log.info('stdout', stdout);
							console.error('stderr', stderr);
							if (error !== null) {
								log.error('exec error: ', error);
							}
						});
					} catch (err) {
						log.info("Trimmed number of channels to: " + window.trim_to);
					}
				}
				else if (window.trim_to == "Mach1Spatial-14") {
					try {
						exec("cd "+tempDir+" && "+ffmpeg+' -y -i "'+window.inputAudioFiles[0]+'" -c:a '+window.OutputBitDepthShort+'le -af "pan=14c|c0=c0|c1=c1|c2=c2|c3=c3|c4=c4|c5=c5|c6=c6|c7=c7|c8=c8|c9=c9|c10=c10|c11=c11|c12=c12|c13=c13" inputspatialaudio.wav', function(error, stdout, stderr) {
							log.info('stdout', stdout);
							console.error('stderr', stderr);
							if (error !== null) {
								log.error('exec error: ', error);
							}
						});
					} catch (err) {
						log.info("Trimmed number of channels to: " + window.trim_to);
					}
				}
			} else {
				// We didnt need to trim and the file wasnt from PT
				try {
					exec("cd "+tempDir+" && "+ffmpeg+' -y -i "'+window.inputAudioFiles[0]+'" -c:a '+window.OutputBitDepthShort+'le inputspatialaudio.wav', function(error, stdout, stderr) {
						log.info('stdout', stdout);
						console.error('stderr', stderr);
						if (error !== null) {
							log.error('exec error: ', error);
						}
					});
				} catch (err) {
					log.info("Trimmed number of channels to: " + window.trim_to);
				}
			}
		}
	}

	function checkStereoAudioInput() {
		$('#StereoAudio input[type="text"]').val(window.inputStereoFiles[0]);
		log.info("Input Stereo File: ", window.inputStereoFiles[0])
		HideMessage();
		updateUIInputOptionsDependingOnSelectedFileTypes();
	}

	function checkJsonInput() {
		$('#JsonInput input[type="text"]').val(window.inputJsonFiles[0]);
		log.info("Input JSON File: ", window.inputJsonFiles[0])
		HideMessage();
		updateUIInputOptionsDependingOnSelectedFileTypes();
	}

	function checkVideoInput() {
		var filePath = window.inputVideoFiles[0];
		$('#Video input[type="text"]').val(filePath);
		log.info("Input Video File: ", filePath)
		var re = /(?:\.([^.]+))?$/;
		var ext = re.exec(filePath)[1]; // extracting file extension
		window.inputVideoExt = ext;
		if ((ext == "mov") || (ext == "MOV")) {
			window.inputVideoMov = true;
			window.inputVideoEmpty = false;
			log.info("Input Video Empty? " + inputVideoEmpty + "; Input Video .mov? " + inputVideoMov);
		} else if ((ext == "mp4") || (ext == "MP4")) {
			window.inputVideoMov = false;
			window.inputVideoEmpty = false;
			log.info("Input Video Empty? " + inputVideoEmpty + "; Input Video .mov? " + inputVideoMov);
		} else {
			window.inputVideoMov = false;
			window.inputVideoEmpty = true;
			log.info("Input Video Empty? " + inputVideoEmpty + "; Input Video .mov? " + inputVideoMov);
		}
		updateUIInputOptionsDependingOnSelectedFileTypes();
		HideMessage();
	}

	function updateUIInputOptionsDependingOnSelectedFileTypes() {
		var selectedOutputType = $('#OutputType option:selected').val();
		var selectedOutputFileType = $('#OutputFileType option:selected').val();

		//live check for input video file
		var inputVideoFilename = window.inputVideoFiles.length > 0 ? window.inputVideoFiles[0] : 'undefined';
		if ((inputVideoFilename == "") || (inputVideoFilename == 'undefined')) {
			window.inputVideoEmpty = true;
		} else {
			window.inputVideoEmpty = false;
		}

		//live check for input static stereo file
		var inputStaticStereoFilename = window.inputStereoFiles.length > 0 ? window.inputStereoFiles[0] : 'undefined';
		if ((inputStaticStereoFilename == "") || (inputStaticStereoFilename == 'undefined')) {
			window.inputStereoEmpty = true;
		} else {
			window.inputStereoEmpty = false;
		}

		//live check for input JSON file
		var inputJsonFilename = window.inputJsonFiles.length > 0 ? window.inputJsonFiles[0] : 'undefined';
		if ((inputJsonFilename == "") || (inputJsonFilename == 'undefined')) {
			window.inputJsonEmpty = true;
		} else {
			window.inputJsonEmpty = false;
			//hide selectedOutputType if JSON input
			$("#OutputType select").find("option").show().not("option[value='99']").hide();
			if (selectedOutputType != 99) {
				$("#OutputType select").val('99');
			}
			//wav output only
			$("#OutputFileType select").find("option").show().not("option[value='2']").hide();
			if (selectedOutputFileType != 2) {
				$("#OutputFileType select").val('2');
			}
		}

		if (window.inputAudioFiles !== undefined && window.inputAudioFiles.length >= 4) {
			$("#OutputType select").find("option").show().not("option[value='3'],option[value='4']").hide();
			if (selectedOutputType != 3 && selectedOutputType != 4) {
				$("#OutputType select").val('3');
			}

			$("#OutputFileType select").find("option").show().not("option[value='3'],option[value='4']").hide();
			if (selectedOutputFileType != 3 && selectedOutputFileType != 4) {
				$("#OutputFileType select").val('3');
			}
		}
		//Turn off horizon pairs multi audio outputs
		else if ((window.inputAudioFiles === undefined || window.inputAudioFiles.length >= 1) && (selectedOutputType == 4)) {
			$("#OutputFileType select").find("option").show().not("option[value='3'], option[value='4']").hide();
			if (selectedOutputFileType != 3 && selectedOutputFileType != 4) {
				$("#OutputFileType select").val('3');
			}
		}
		//switch for blocking AAC if using static-stereo
		//TODO: remove the need for this by figuring out the 10 channel compressed audio solution
		else if ((!window.inputStereoEmpty) && (window.inputVideoEmpty) && (selectedOutputType == 1)) {
			$("#OutputType select").find("option").show().not("option[value=''],option[value='1'],option[value='3'],option[value='4'],option[value='5'],option[value='6']").hide();
			$("#OutputFileType select").find("option").show().not("option[value='2']").hide();
			if (selectedOutputFileType != 2) {
				$("#OutputFileType select").val('2');
			}
		} else if ((!window.inputStereoEmpty) && (selectedOutputType == 1)) {
			$("#OutputType select").find("option").show().not("option[value=''],option[value='1'],option[value='3'],option[value='4'],option[value='5'],option[value='6']").hide();
			$("#OutputFileType select").find("option").show().not("option[value='2'],option[value='4']").hide();
			if (selectedOutputFileType != 2 && selectedOutputFileType != 4) {
				$("#OutputFileType select").val('2');
			}
		} else if ((!window.inputStereoEmpty) && (selectedOutputType == 5) && (window.inputVideoMov)) {
			$("#OutputFileType select").find("option").show().not("option[value='1'],option[value='2'],option[value='3'],option[value='4'],option[value='5'],option[value='6'],option[value='7'],option[value='8'],option[value='9'],option[value='10']").hide();
			if (selectedOutputFileType != 1 && selectedOutputFileType != 2 && selectedOutputFileType != 3 && selectedOutputFileType != 4 && selectedOutputFileType != 5 && selectedOutputFileType != 6 && selectedOutputFileType != 7 && selectedOutputFileType != 8 && selectedOutputFileType != 9 && selectedOutputFileType != 10) {
				$("#OutputFileType select").val('5');
			}
		} else if ((!window.inputStereoEmpty) && (selectedOutputType == 5) && (!window.inputVideoMov)) {
			$("#OutputFileType select").find("option").show().not("option[value='1'],option[value='2'],option[value='3'],option[value='5'],option[value='6'],option[value='7']").hide();
			if (selectedOutputFileType != 1 && selectedOutputFileType != 2 && selectedOutputFileType != 3 && selectedOutputFileType != 5 && selectedOutputFileType != 6 && selectedOutputFileType != 7) {
				$("#OutputFileType select").val('5');
			}
		} else if (!window.inputStereoEmpty && ((selectedOutputType == 23) || (selectedOutputType == 9) || (selectedOutputType == 10) || (selectedOutputType == 11) || (selectedOutputType == 21) || (selectedOutputType == 16) || (selectedOutputType == 22) || (selectedOutputType == 17) || (selectedOutputType == 24) || (selectedOutputType == 12) || (selectedOutputType == 18) || (selectedOutputType == 19) || (selectedOutputType == 20))) {
			$("#OutputType select").find("option").show().not("option[value=''],option[value='1'],option[value='3'],option[value='4'],option[value='5'],option[value='6'],option[value='23'],option[value='9'],option[value='10'],option[value='11'],option[value='21'],option[value='16'],option[value='22'],option[value='17'],option[value='24'],option[value='12'],option[value='18'],option[value='19'],option[value='20']").hide();
			$("#OutputFileType select").find("option").show().not("option[value='2']").hide();
			if (selectedOutputFileType != 2) {
				$("#OutputFileType select").val('2');
			}
		} else if (!window.inputStereoEmpty) {
			$("#OutputType select").find("option").show().not("option[value=''],option[value='1'],option[value='3'],option[value='4'],option[value='5'],option[value='6'],option[value='23'],option[value='9'],option[value='10'],option[value='11'],option[value='21'],option[value='16'],option[value='22'],option[value='17'],option[value='24'],option[value='12'],option[value='18'],option[value='19'],option[value='20']").hide();
			$("#OutputFileType select").find("option").show().not("option[value='1'],option[value='2'],option[value='3'],option[value='4']").hide();
			if (selectedOutputFileType != 1 && selectedOutputFileType != 2 && selectedOutputFileType != 3 && selectedOutputFileType != 4) {
				$("#OutputFileType select").val('3');
			}
		}
		//switch for blocking video encoding until video inputted			
		//allow spatial/horizon/sdk to do codec conversions
		else if (((window.inputVideoEmpty) && (window.inputStereoEmpty)) && ((selectedOutputType == 1) || (selectedOutputType == 2) || (selectedOutputType == 3) || (selectedOutputType == 25))) {
			$("#OutputFileType select").find("option").show().not("option[value='2'],option[value='11']").hide();
			if ( /*selectedOutputFileType != 1 && */ selectedOutputFileType != 2 && selectedOutputFileType != 11) {
				$("#OutputFileType select").val('2');
			}
		}
		//switch for Apple Spatial mp4
		else if ((window.inputAudioFiles === undefined || window.inputAudioFiles.length >= 1) && (selectedOutputType == 27) && window.inputVideoEmpty) {
			$("#OutputFileType select").find("option").show().not("option[value='14']").hide();
			if (selectedOutputFileType != 14) {
				$("#OutputFileType select").val('14');
			}
		} else if ((window.inputAudioFiles === undefined || window.inputAudioFiles.length >= 1) && (selectedOutputType == 27) && !window.inputVideoEmpty) {
			$("#OutputFileType select").find("option").show().not("option[value='3']").hide();
			if (selectedOutputFileType != 3) {
				$("#OutputFileType select").val('3');
			}
		}
		//if not spatial/horizon/sdk only allow wav
		else if (((window.inputVideoEmpty) && (window.inputStereoEmpty)) && !((selectedOutputType == 1) || (selectedOutputType == 2) || (selectedOutputType == 3) || (selectedOutputType == 25))) {
			$("#OutputFileType select").find("option").show().not("option[value='2']").hide();
			if (selectedOutputFileType != 2) {
				$("#OutputFileType select").val('2');
			}
		}
		//switch for FOA Youtube
		else if ((window.inputAudioFiles === undefined || window.inputAudioFiles.length >= 1) && (selectedOutputType == 5) && (window.inputVideoMov)) {
			$("#OutputFileType select").find("option").show().not("option[value='1'],option[value='2'],option[value='3'],option[value='4'],option[value='5'],option[value='6'],option[value='7'],option[value='8'],option[value='9'],option[value='10']").hide();
			if (selectedOutputFileType != 1 && selectedOutputFileType != 2 && selectedOutputFileType != 3 && selectedOutputFileType != 4 && selectedOutputFileType != 5 && selectedOutputFileType != 6 && selectedOutputFileType != 7 && selectedOutputFileType != 8 && selectedOutputFileType != 9 && selectedOutputFileType != 10) {
				$("#OutputFileType select").val('5');
			}
		}
		//switch for mp4 FOA Youtube only
		else if ((window.inputAudioFiles === undefined || window.inputAudioFiles.length >= 1) && (selectedOutputType == 5) && (!window.inputVideoMov)) {
			$("#OutputFileType select").find("option").show().not("option[value='1'],option[value='2'],option[value='3'],option[value='5'],option[value='6'],option[value='7']").hide();
			if (selectedOutputFileType != 1 && selectedOutputFileType != 2 && selectedOutputFileType != 3 && selectedOutputFileType != 5 && selectedOutputFileType != 6 && selectedOutputFileType != 7) {
				$("#OutputFileType select").val('5');
			}
		}
		//switch for audio only conversion
		else if ((window.inputAudioFiles === undefined || window.inputAudioFiles.length >= 1) && (selectedOutputType == 7 || selectedOutputType == 8 || selectedOutputType == 13 || selectedOutputType == 14 || selectedOutputType == 15 || selectedOutputType == 16 || selectedOutputType == 17 || selectedOutputType == 18 || selectedOutputType == 19 || selectedOutputType == 20 || selectedOutputType == 21 || selectedOutputType == 22 || selectedOutputType == 23 || selectedOutputType == 24 || selectedOutputType == 25 || selectedOutputType == 28)) {
			$("#OutputFileType select").find("option").show().not("option[value='2']").hide();
			if (selectedOutputFileType != 2) {
				$("#OutputFileType select").val('2');
			}
		} else {
			$("#OutputType select").find("option").show();
			$("#OutputFileType select").find("option").show().not("option[value='1'],option[value='2'],option[value='3'],option[value='4']").hide();
			if (selectedOutputFileType != 1 && selectedOutputFileType != 2 && selectedOutputFileType != 3 && selectedOutputFileType != 4) {
				$("#OutputFileType select").val('3');
			}
		}
	}

	$('#OutputType select').on('change', function(e) {
		updateUIInputOptionsDependingOnSelectedFileTypes();
	});

	$('#OutputFileType select').on('change', function(e) {
		updateUIInputOptionsDependingOnSelectedFileTypes();
	});

	function ShowProgressbar() {
		$('input, select').attr('disabled', 'disabled');
		$("#progressbarMain").stop(true).css('width', '0%').animate({
				width: "50%"
			}, 20000, "linear",
			function() {
				$(this).animate({
						width: "80%"
					}, 50000, "linear",
					function() {
						$(this).animate({
							width: "100%"
						}, 50000, "linear");
					});
			}
		);
		$("#progressbarDialog").stop(true).css('visibility', 'visible').hide().fadeIn('slow');
	}

	function HideProgressbar() {
		$("#progressbarMain").stop(true).animate({
				width: "100%"
			}, 2000, "linear",
			function() {
				$("#progressbarDialog").stop(true).fadeOut(300);
				$('input, select').removeAttr('disabled');
			}
		);
	}

	function ShowMessage(message, isError = false) {
		HideMessage();

		if (isError) {
			$('#MessageError .input-wrapper span').html(message);
			$('#MessageError').show();
		} else {
			// check output type for preview player
			var selectedOutputType = $('#OutputType option:selected').val();

			// TODO: Remove this when using new M1-Player app
			// if (selectedOutputType == 1 || selectedOutputType == 2 || selectedOutputType == 3 || selectedOutputType == 4 || selectedOutputType == 5) $('#Preview').show();
			// else $('#Preview').hide();
			$('#Preview').hide();

			$('#MessageSuccess span').html(message);
			$('#MessageSuccess').css('display', 'inline'); //.show();
		}
	}

	function HideMessage() {
		$('#MessageSuccess,#MessageError').hide();
	}

	const { ipcRenderer } = require('electron');
	const fs = require('fs');

	function AddOpenFileHandler(selector, extensions, inputFiles, checkFunc) {
		var obj = $(selector + ' input[type="submit"]');
		obj.click(async function() {
			try {
				const filenames = await ipcRenderer.invoke('show-open-dialog', extensions);
				if (typeof filenames != 'undefined') {
					log.info("Number of Input Files: " + filenames.length);
					obj.parent().children('input[type="text"]').val(filenames[0]);
					inputFiles.length = 0;
					var index = 0;
					for (let filePath of filenames) {
						inputFiles[index] = filePath;
						index++;
					}
					checkFunc();
				}
			} catch (error) {
				console.error('Error:', error);
			}
		});
	}

	function SaveFile(obj) {
		var def = new jQuery.Deferred();
		ipcRenderer.invoke('show-save-dialog').then(filename => {
			if (typeof filename != 'undefined') {
				log.info("Output Filename:", filename);
				obj.parent().children('input[type="text"]').val(filename);
				def.resolve();
			}
		}).catch(error => {
			console.error('Error:', error);
			def.reject(error);
		});

		return def.promise();
	}

	AddOpenFileHandler('#Audio', ['aif', 'wav'], window.inputAudioFiles, checkSpatialAudioInput);
	AddOpenFileHandler('#StereoAudio', ['mp3', 'wav', 'aac', 'm4a', 'aif'], window.inputStereoFiles, checkStereoAudioInput);
	AddOpenFileHandler('#JsonInput', ['json'], window.inputJsonFiles, checkJsonInput);
	AddOpenFileHandler('#Video', ['avi', 'mp4', 'mov', 'mkv'], window.inputVideoFiles, checkVideoInput);

	// AddSaveFileHandler 
	$('#OutputVideo input[type="submit"]').click(function() {
		SaveFile($(this));
	});

	$('#Reveal').click(function() {
		const exec = require('child_process').exec; //Sync;
		exec('open -R "' + window.outputFilename + '"', function(error, stdout, stderr) {
			return true;
		});
	});

	// TODO: Update this concept to use the M1-Player app instead
	// $('#Preview').click(function() {
	// 	const exec = require('child_process').exec; //Sync;
	// 	const scriptPath = ipcRenderer.sendSync('get-script-path') ;
	// 	var scriptPathClean = scriptPath.replace(/ /g, '\\ ')
	// 	var player = scriptPathClean + "/binaries/m1previewplayer.app/Contents/MacOS/m1previewplayer";
	// 	// if (!fs.existsSync(player)) {
	// 	//		 player = scriptPathClean + "/../../binaries/m1previewplayerDebug.app/Contents/MacOS/m1previewplayerDebug";
	// 	// }
	// 	// str.substring(0, str.lastIndexOf("/"));
	// 	log.info("window.selectedOutputType:" + window.selectedOutputType);
	// 	if (window.selectedOutputType == 1 || window.selectedOutputType == 2 || window.selectedOutputType == 3 || window.selectedOutputType == 4 || window.selectedOutputType == 5) {
	// 		var command = player + " " + " --inputDir " + escapingPath(scriptPath + "/../../") + " --type " + String(window.selectedOutputType);
	// 		if (window.outputFilename) {
	// 			command += " --video " + escapingPath(window.outputFilename);
	// 		}
	// 		//setup for stereo flagging if not HorizonPairs output
	// 		if (!window.inputStereoEmpty && (window.selectedOutputType == 1 || window.selectedOutputType == 5)) {
	// 			command += " --stereo " + escapingPath(scriptPath + "/../../");
	// 		}
	// 		log.info("Preview Command: " + command);
	// 		exec(command);
	// 	} else {
	// 		alert("not supported yet!");
	// 		log.warn("Preview does not support: FormatType: " + window.selectedOutputType + ", OutputFileType: " + window.selectedOutputFileType);
	// 	}
	// });

	$('#Render').click(function() {
		LogDependencies();

		if ($('#Audio input[type="text"]').val() === "") {
			alert("Choose Input Files");
			return;
		}

		if ($('#OutputType option:selected').val() === "") {
			alert("Choose Spatial Format");
			return;
		}

		// run ffmpeg
		function runTranscode() {
			// TODO: move the clear steps into a new function

			// removing temp files
			const execSync = require('child_process').execSync;
			try {
				const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1/');

				const scriptPath = ipcRenderer.sendSync('get-script-path') ;
				var scriptPathClean = scriptPath.replace(/ /g, '\\ ');
				var tempDir = dataPath + 'temp/' // scriptPathClean + "/../.."

				if (!fs.existsSync(tempDir)) {
					fs.mkdirSync(tempDir, {
						recursive: true
					});
				}

				tempDir = "\"" + tempDir + "\"";
				const isWin = process.platform === "win32";
				(isWin ? "ffmpeg.exe" : "ffmpeg")
				execSync("cd " + tempDir +
					" && " + (isWin ? "del" : "rm -f") + " 1.wav 2.wav 3.wav 4.wav 5.wav 6.wav 7.wav 8.wav 000.wav 001.wav 002.wav 003.wav 004.wav 005.wav 006.wav 007.wav 008.wav 009.wav MERGED.wav MERGED.m4a st1.wav st2.wav st3.wav st4.wav inputspatialaudio.wav outputaudio.wav output_audio.wav output_audio.ac3 videooutput_forinject.mp4",
					function(error, stdout, stderr) {
						return true;
					});
				log.info("..removed temp files successfully..");

				window.fromProToolsNeedsChannelReOrdering = false;
				window.trim_to = "";
				window.processedInputSpatialAudio = "";
				log.info("..reset temp vars successfully..");

			} catch (err) {
				log.error(err);
			}

			// checking inputs
			checkSpatialAudioInput();
			preprocessSpatialAudioInput();
			checkStereoAudioInput();
			checkJsonInput();
			checkVideoInput();

			window.inputAudioFiles[0] = $('#Audio input[type="text"]').val();
			inputAudioFilename = window.inputAudioFiles[0];
			var inputAudioExt = inputAudioFilename.substring(inputAudioFilename.lastIndexOf('.')+1, inputAudioFilename.length) || inputAudioFilename;
			log.info("Input Spatial Audio Path: ", inputAudioExt);

			var inputVideoFilename = $('#Video input[type="text"]').val();
			var outputVideoFilename = $('#OutputVideo input[type="text"]').val();
			var inputStaticStereoFilename = $('#StereoAudio input[type="text"]').val();
			var inputJsonFilename = $('#JsonInput input[type="text"]').val();

			if (typeof inputVideoFilename == 'undefined') inputVideoFilename = "";
			if (typeof outputVideoFilename == 'undefined') outputVideoFilename = "";
			if (typeof inputStaticStereoFilename == 'undefined') inputStaticStereoFilename = "";
			if (typeof inputJsonFilename == 'undefined') inputJsonFilename = "";

			log.info("Input Spatial Audio: " + $('#Audio input[type="text"]').val());
			log.info("Input Stereo Audio: " + $('#StereoAudio input[type="text"]').val());
			log.info("Input JSON Filename: " + $('#JsonInput input[type="text"]').val());
			log.info("Input Video: " + $('#Video input[type="text"]').val());

			log.info("Output: " + $('#OutputVideo input[type="text"]').val());
			log.info("Output Format Type: " + $('#OutputType option:selected').val());
			log.info("Output File Type: " + $('#OutputFileType option:selected').val());

			var selectedOutputType = $('#OutputType option:selected').val();
			var selectedOutputFileType = $('#OutputFileType option:selected').val();

			// TODO: use only this global var
			window.selectedOutputType = selectedOutputType;

			if (outputVideoFilename == "") {
				return false;
			}

			// Output Type Constants
			const OutputTypes = {
				M1SPATIAL: '1',
				M1HORIZON: '2',
				M1HORIZON_PAIRS_SINGLE: '3',
				M1HORIZON_PAIRS_MULTI: '4',
				ACNSN3D: '5',
				FOAFUMA: '6',
				SOAACNSN3D: '7',
				SOAFUMA: '8',
				SURROUND51CINEMA: '9',
				SURROUND51SMPTE: '10',
				SURROUND51DTS: '11',
				SURROUND50: '23',
				SURROUND71: '12',
				SURROUND70: '24',
				FB360TBE: '13',
				ACNSN3D3OA: '14',
				FUMA30A: '15',
				SURROUND512: '16',
				SURROUND502: '21',
				SURROUND514: '17',
				SURROUND504: '22',
				SURROUND71SDDS: '18',
				SURROUND712: '19',
				SURROUND714: '20',
				MACH1SDKUNITYUNREAL: '25',
				M1SPATIALSAMSUNGVR: '26',
				APPLESPATIAL51SIDE: '27',
				ADM712: '28',
				CUSTOMFORMAT: '99'
			};

			// Output File Types for selectedOutputFileType
			const OutputFileTypes = {
				'1': 'M4A',
				'2': 'WAV',
				'3': 'MP4',
				'4': 'MOV',
				'5': 'MP4',
				'6': 'MP4',
				'7': 'MP4',
				'8': 'MOV',
				'9': 'MOV',
				'10': 'MOV',
				'11': 'OGG',
				'12': 'AIF',
				'13': 'OPUS',
				'14': 'MP4',
			};

			// Extension mapping
			const PreferredExtensions = {
				'MP4': 'mp4',
				'MOV': 'mov',
				'M4A': 'm4a',
				'WAV': 'wav',
				'OGG': 'ogg',
				'AIF': 'aif',
				'OPUS': 'opus',
			};

			var outputFileTypeKey = OutputFileTypes[selectedOutputFileType];

			if (!outputFileTypeKey) {
				console.error(`Unknown output file type: ${selectedOutputFileType}`);
				return false;
			}

			var preferredExtension = PreferredExtensions[outputFileTypeKey];

			if (!preferredExtension) {
				console.error(`No preferred extension for output type: ${outputFileTypeKey}`);
				return false;
			}

			var re = /(?:\.([^.]+))?$/;

			var ext = re.exec(outputVideoFilename)[1]; // extracting file extension

			if (ext != undefined) {
				log.info("found extension " + ext + " ... replacing it with " + preferredExtension);
				outputVideoFilename = outputVideoFilename.replace(ext, preferredExtension)
			} else {
				outputVideoFilename = outputVideoFilename.concat("." + preferredExtension);
			}
			window.outputFilename = outputVideoFilename;
			log.info("Output File Type: " + selectedOutputFileType + ", with File Extension: " + preferredExtension)
			log.info("Output File name is " + outputVideoFilename + " now");

			var processingRequest = [];
			log.info("Converting: ", window.inputAudioFiles);

			if (window.inputAudioFiles.length == 4) {
				log.info("inputs are M1Horizon Pairs encoded");
				// Input is 4 pairs 4 files
				switch (selectedOutputType) {
					//M1HorizonPairs (single)
					case OutputTypes.M1HORIZON_PAIRS_SINGLE:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
							//compress to aac
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							//Make fun of user for asking to output the same thing as the input
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							processingRequest.push({
								"process_kind": "ffmpeg-mute",
								"input_video": inputVideoFilename,
								"output_video": "muted-video." + window.inputVideoExt
							});
							processingRequest.push({
								"process_kind": "merge_4_single_files_to_wav",
								"input_filename": window.inputAudioFiles,
								"output_filename": "MERGED.wav"
							});
							processingRequest.push({
								"process_kind": "8_channel_pcm_to_m4a",
								"input_filename": "MERGED.wav",
								"output_filename": "MERGED.m4a"
							});
							processingRequest.push({
								"process_kind": "attach_audio_to_video_hard",
								"input_audio": "MERGED.m4a",
								"input_video": "muted-video." + window.inputVideoExt,
								"output_video": outputVideoFilename
							});
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							processingRequest.push({
								"process_kind": "ffmpeg-mute",
								"input_video": inputVideoFilename,
								"output_video": "muted-video." + window.inputVideoExt
							});
							processingRequest.push({
								"process_kind": "merge_4_single_files_to_wav",
								"input_filename": window.inputAudioFiles,
								"output_filename": "MERGED.wav"
							});
							processingRequest.push({
								"process_kind": "attach_audio_to_video_hard",
								"input_audio": "MERGED.wav",
								"input_video": "muted-video." + window.inputVideoExt,
								"output_video": outputVideoFilename
							});
						}
						break;

						//M1HorizonPairs (multi) 
					case OutputTypes.M1HORIZON_PAIRS_MULTI:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
							//compress to aac
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							//Make fun of user for asking to output the same thing as the input
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							processingRequest.push({
								"process_kind": "ffmpeg-mute",
								"input_video": inputVideoFilename,
								"output_video": "muted-video." + window.inputVideoExt
							});
							processingRequest.push({
								"process_kind": "attach_4x2_audio_to_video_soft",
								"input_filename": window.inputAudioFiles,
								"input_video": "muted-video." + window.inputVideoExt,
								"output_video": outputVideoFilename
							});
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							processingRequest.push({
								"process_kind": "ffmpeg-mute",
								"input_video": inputVideoFilename,
								"output_video": "muted-video." + window.inputVideoExt
							});
							processingRequest.push({
								"process_kind": "attach_4x2_audio_to_video_hard",
								"input_filename": window.inputAudioFiles,
								"input_video": "muted-video." + window.inputVideoExt,
								"output_video": outputVideoFilename
							});
						}
						break;
				}
			} else {
				log.info("Input is M1Spatial encoded")
				switch (selectedOutputType) {
					//M1SPATIAL 
					case OutputTypes.M1SPATIAL:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProToolsNeedsChannelReOrdering == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_pcm",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "inputspatialaudio.wav",
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a",
										"input_filename": "reordered.aif",
										"output_filename": outputVideoFilename
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a",
										"input_filename": "inputspatialaudio.wav",
										"output_filename": outputVideoFilename
									});
								}
							} else {
								//TODO: AAC / VORBIS 10 CHANNEL
								if (window.fromProToolsNeedsChannelReOrdering == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_pcm",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "inputspatialaudio.wav",
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a_plus_stereo",
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								} else {
									// Optional stereo, case 2
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a_plus_stereo",
										"input_filename": "inputspatialaudio.wav",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								}
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg",
									"input_filename": "inputspatialaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								//TODO: AAC / VORBIS 10 CHANNEL
								// Optional stereo, case 2
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg_plus_stereo",
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed opus
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg",
									"input_filename": "inputspatialaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								//TODO: AAC / VORBIS 10 CHANNEL
								// Optional stereo, case 2
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg_plus_stereo",
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_output",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 2
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								try {
									const inputAudioFile = window.inputAudioFiles[0];
									const channelCount = getChannelCount(inputAudioFile);
						
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
						
									if (channelCount === 4) {
										processingRequest.push({
											"process_kind": "4_channel_pcm_to_m4a",
											"input_filename": inputAudioFile,
											"output_filename": "MERGED.m4a"
										});
									} else if (channelCount === 8) {
										processingRequest.push({
											"process_kind": "8_channel_pcm_to_m4a",
											"input_filename": inputAudioFile,
											"output_filename": "MERGED.m4a"
										});
									} else if (channelCount === 12) {
										processingRequest.push({
											"process_kind": "12_channel_pcm_to_m4a",
											"input_filename": inputAudioFile,
											"output_filename": "MERGED.m4a"
										});
									} else if (channelCount === 14) {
										processingRequest.push({
											"process_kind": "14_channel_pcm_to_m4a",
											"input_filename": inputAudioFile,
											"output_filename": "MERGED.m4a"
										});
									} else {
										console.error(`Unsupported number of channels: ${channelCount}`);
										return;
									}
						
									processingRequest.push({
										"process_kind": "attach_audio_to_video_hard",
										"input_audio": "MERGED.m4a",
										"input_video": "muted-video." + window.inputVideoExt,
										"output_video": outputVideoFilename
									});
								} catch (error) {
									console.error("Failed to get channel count:", error);
									// Handle the error as needed
									return;
								}
							} else {
								// Optional stereo, case 2
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 2
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//M1HORIZON
						//TODO: +ST
					case OutputTypes.M1HORIZON:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo
								// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
								// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_ogg",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo
								// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
								// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_ogg_plus_stereo",
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo
								// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
								// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "output_audio.m4a"
								})
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
								// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "output_audio.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
								// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_format": "M1Spatial",
									"output_format": "M1Horizon",
									"output_channelnum": "0",
									"input_filename": "MERGED.wav",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//M1HORIZON PAIRS (SINGLESTREAM) 
						//TODO: +ST
					case OutputTypes.M1HORIZON_PAIRS_SINGLE:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 5
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 6
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 5
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 6
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 5
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 6
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 5
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_output",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 6
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 5
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 5
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//M1HORIZON PAIRS (MULTISTREAM)
					case OutputTypes.M1HORIZON_PAIRS_MULTI:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "make_4x2_audio_to_video",
									"input_filename": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 8
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "make_4x2_audio_to_video",
									"input_filename": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "make_4x2_audio_to_video",
									"input_filename": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "M1HorizonPairs",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "make_4x2_audio_to_video",
									"input_filename": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//FOA: ACNSN3D
					case OutputTypes.ACNSN3D:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_ogg",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_ogg_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								// processingRequest.push({"process_kind": "ffmpeg-gain",
								//												 "input_filename": "MERGED.wav",
								//												 "gain": "0.204",
								//												 "output_filename": "MERGEDgain.wav"});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed 
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_audio": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed MONOSCOPIC
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mp4"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "none",
									"input_filename": "videooutput_forinject.mp4",
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"stereo_filename": inputStaticStereoFilename,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mp4"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "none",
									"input_filename": "videooutput_forinject.mp4",
									"output_video": outputVideoFilename
								});
							}
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed TOP/BOTTOM STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 9
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mp4"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "top-bottom",
									"input_filename": "videooutput_forinject.mp4",
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mp4"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "top-bottom",
									"input_filename": "videooutput_forinject.mp4",
									"output_video": outputVideoFilename
								});
							}
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed LEFT/RIGHT STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mp4"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "left-right",
									"input_filename": "videooutput_forinject.mp4",
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"outputFilename": "MERGED.wav"
								})
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mp4"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "left-right",
									"input_filename": "videooutput_forinject.mp4",
									"output_video": outputVideoFilename
								});
							}
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed MONOSCOPIC
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mov"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "none",
									"input_filename": "videooutput_forinject.mov",
									"output_video": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial+S",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mov"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "none",
									"input_filename": "videooutput_forinject.mov",
									"output_video": outputVideoFilename
								});
							}
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed TOP/BOTTOM STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mov"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "top-bottom",
									"input_filename": "videooutput_forinject.mov",
									"output_video": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial+S",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mov"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "top-bottom",
									"input_filename": "videooutput_forinject.mov",
									"output_video": outputVideoFilename
								});
							}
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (outputFileTypeKey === 'M4A') { // Audio & Video uncompressed LEFT/RIGHT STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 9
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mov"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "left-right",
									"input_filename": "videooutput_forinject.mov",
									"output_video": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial+S",
									"output_format": "ACNSN3D",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": "videooutput_forinject.mov"
								});
								processingRequest.push({
									"process_kind": "youtube-meta",
									"videoScopic": "left-right",
									"input_filename": "videooutput_forinject.mov",
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//FOA: FuMa 
					case OutputTypes.FOAFUMA:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_ogg",
									"input_filename": "output_audio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_ogg_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"outputFilename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								//GAIN UTILITY FOR oFOA
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_m4a_plus_stereo",
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMa",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "4_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "output_audio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "MERGED.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//SOA: ACNSN3D
					case OutputTypes.SOAACNSN3D:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO2A",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO2A",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO2A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO2A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//SOA: FuMa 
					case OutputTypes.SOAFUMA:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMaO2A",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMaO2A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "ffmpeg-gain",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "MERGED.wav",
									"gain": "0.204",
									"output_filename": "MERGEDgain.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGEDgain.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMaO2A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//Surround: 5.1 L,C,R,Ls,Rs,LFE Cinema
					case OutputTypes.SURROUND51CINEMA:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneFilm_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//Surround: 5.1 L,R,C,LFE,Ls,Rs
					case OutputTypes.SURROUND51SMPTE:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//Surround: 5.1 L, R, Ls, Rs, C, LFE
					case OutputTypes.SURROUND51DTS:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// optional stereo
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneDts",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//Surround: 5.0 L,C,R,Ls,Rs
					case OutputTypes.SURROUND50:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOh",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOh",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1 L, C, R, Lss, Rss, Lsr, Rsr, LFE
					case OutputTypes.SURROUND71:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "outputaudio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_ogg",
									"input_filename": "outputaudio.wav",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOnePt_Cinema",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_m4a",
									"input_filename": "output_audio.wav",
									"output_filename": "MERGED.m4a"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "MERGED.m4a",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						break;

						//Surround: 7.0 L, C, R, Lss, Rss, Lsr, Rsr
					case OutputTypes.SURROUND70:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenZero_Cinema",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenZero_Cinema",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//TBE/FB360 
					case OutputTypes.FB360TBE:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1Spatial",
									"output_format": "TBE",
									"output_channelnum": "0",
									"output_filename": "makeTBE.wav"
								});
								var outputVideoFilename = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf('.'))
								log.info("output filename: ", outputVideoFilename)
								processingRequest.push({
									"process_kind": "TBE_copy_to_dir",
									"output_filename": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1Spatial",
									"output_format": "TBE",
									"output_channelnum": "0",
									"output_filename": "makeTBE.wav"
								});
								var outputVideoFilename = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf('.'))
								log.info("output filename: ", outputVideoFilename)
								processingRequest.push({
									"process_kind": "TBE_copy_to_dir_plus_stereo",
									"output_filename": outputVideoFilename,
									"stereo_filename": inputStaticStereoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//ACNSN3D 3oa
					case OutputTypes.ACNSN3D3OA:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
							//TODO: Requires 16channel aac
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO3A",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO3A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "ACNSN3DO3A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//FuMa 3oa
					case OutputTypes.FUMA3OA:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
							//TODO: Requires 16channel aac
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMaO3A",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMaO3A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FuMaO3A",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_soft",
									"input_audio": "output_audio.wav",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//Surround: 5.1.2 Surround (L,C,R,Ls,Rs,LFE,Lts,Rts)
					case OutputTypes.SURROUND512:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneTwo",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneTwo",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 5.0.2 Surround (L,C,R,Ls,Rs,LFE,Lts,Rts)
					case OutputTypes.SURROUND502:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveZeroTwo",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveZeroTwo",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 5.1.4 Surround (L,C,R,Ls,Rs,LFE,FLts,FRts,BLts,BRts)
					case OutputTypes.SURROUND514:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneFour",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneFour",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 5.0.4 Surround (L,C,R,Ls,Rs,LFE,FLts,FRts,BLts,BRts)
					case OutputTypes.SURROUND504:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveZeroFour",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveZeroFour",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1 Surround SDDS (L,C,R,Ls,Rs,LFE,Lts,Rts)
					case OutputTypes.SURROUND71SDDS:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOneSDDS",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOneSDDS",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1.2 Surround (L,C,R,Lss,Rss,Lsr,Rsr,LFE,Lts,Rts)
					case OutputTypes.SURROUND712:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOneTwo",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOneTwo",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1.4 Surround L,C,R,Lss,Rss,Lsr,Rsr,LFE,FLts,FRts,BLts,BRts)
					case OutputTypes.SURROUND714:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "SevenOneFour",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "SevenOneFour",
									"output_channelnum": "0",
									"output_filename": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Mach1 SDK: Unity & Unreal Engine
					case OutputTypes.MACH1SDKUNITYUNREAL:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed aac
							processingRequest.push({
								"process_kind": "8_channel_pcm_to_wav",
								"bitdepth": window.OutputBitDepthShort,
								"input_filename": "inputspatialaudio.wav",
								"output_filename": "MERGED.wav"
							});
							var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
							log.info("output path: ", videoOutputPath)
							processingRequest.push({
								"process_kind": "copy_to_output_dir_m4a",
								"output_dir": videoOutputPath
							});
						}
						if (outputFileTypeKey === 'M4A') { // Audio only compressed ogg
							processingRequest.push({
								"process_kind": "8_channel_pcm_to_wav",
								"bitdepth": window.OutputBitDepthShort,
								"input_filename": "inputspatialaudio.wav",
								"output_filename": "MERGED.wav"
							});
							var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
							log.info("output path: ", videoOutputPath)
							processingRequest.push({
								"process_kind": "copy_to_output_dir_ogg",
								"output_dir": videoOutputPath
							});
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							processingRequest.push({
								"process_kind": "8_channel_pcm_to_wav",
								"bitdepth": window.OutputBitDepthShort,
								"input_filename": "inputspatialaudio.wav",
								"output_filename": "MERGED.wav"
							});
							var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
							log.info("output path: ", videoOutputPath)
							processingRequest.push({
								"process_kind": "copy_to_output_dir_wav",
								"output_dir": videoOutputPath
							});
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//M1SPATIAL multistream for SamsungVR
					case OutputTypes.M1SPATIALSAMSUNGVR:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav"
								});
								processingRequest.push({
									"process_kind": "spatial_to_samsungvr",
									"input_filename": "MERGED.wav",
									"input_video": inputVideoFilename,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav"
								});
								processingRequest.push({
									"process_kind": "spatial_to_samsungvr_plus_stereo",
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"input_video": inputVideoFilename,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav"
								});
								processingRequest.push({
									"process_kind": "spatial_to_samsungvr",
									"input_filename": "MERGED.wav",
									"input_video": inputVideoFilename,
									"output_video": outputVideoFilename
								});
							} else {
								// Optional stereo
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav"
								});
								processingRequest.push({
									"process_kind": "spatial_to_samsungvr_plus_stereo",
									"input_filename": "MERGED.wav",
									"stereo_filename": inputStaticStereoFilename,
									"input_video": inputVideoFilename,
									"output_video": outputVideoFilename
								});
							}
						}
						break;
						//M1SPATIAL to 5.1(side) for Apple Spatial (video)
					case OutputTypes.APPLESPATIAL51SIDE:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_eac3",
									"input_filename": "output_audio.wav",
									"output_filename": "output_audio.ac3"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "output_audio.ac3",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "ffmpeg-mute",
									"input_video": inputVideoFilename,
									"output_video": "muted-video." + window.inputVideoExt
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_eac3",
									"input_filename": "output_audio.wav",
									"output_filename": "output_audio.ac3"
								});
								processingRequest.push({
									"process_kind": "attach_audio_to_video_hard",
									"input_audio": "output_audio.ac3",
									"input_video": "muted-video." + window.inputVideoExt,
									"output_video": outputVideoFilename
								});
							}
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						if (outputFileTypeKey === 'M4A') { // Audio & Video Compressed (generated video)
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_eac3_spawnvideo",
									"input_filename": "output_audio.wav",
									"input_video_image": "../resources/m1blank.png",
									"output_filename": outputVideoFilename
								});
							} else {
								// No optional stereo, case 15
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav_plus_stereo",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "inputspatialaudio.wav",
									"stereo_filename": inputStaticStereoFilename,
									"output_filename": "MERGED.wav"
								});
								processingRequest.push({
									"process_kind": "m1transcode_normalize",
									"master_gain": "0",
									"input_filename": "MERGED.wav",
									"input_format": "M1Spatial+S",
									"output_format": "FiveOneSmpte",
									"output_channelnum": "0",
									"output_filename": "output_audio.wav"
								});
								processingRequest.push({
									"process_kind": "6_channel_pcm_to_eac3_spawnvideo",
									"input_filename": "output_audio.wav",
									"input_video_image": "../resources/m1blank.png",
									"output_filename": outputVideoFilename
								});
							}
						}
						break;
						//M1SPATIAL to 7.1.2 ADM Channel Bed for ADM or Dolby Atmos usage
					case OutputTypes.ADM712:
						if (outputFileTypeKey === 'M4A') { // Audio only compressed
						}
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "m1transcode",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1Spatial",
									"output_filename": outputVideoFilename,
									"output_format": "DolbyAtmosSevenOneTwo",
									"output_channelnum": "0"
								});
							} else {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "m1transcode",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1SpatialS",
									"output_filename": outputVideoFilename,
									"output_format": "DolbyAtmosSevenOneTwo",
									"output_channelnum": "0"
								});
							}
						}
						if (outputFileTypeKey === 'MP4') { // Audio & Video compressed
						}
						if (outputFileTypeKey === 'MOV') { // Audio & Video uncompressed
						}
						break;

						//Custom Format defined by InputJSON file 
					case OutputTypes.CUSTOMFORMAT:
						if (outputFileTypeKey === 'WAV') { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								// No optional stereo, case 1
								processingRequest.push({
									"process_kind": "m1transcode_json",
									"input_filename": "inputspatialaudio.wav",
									"input_format": "M1Spatial",
									"output_Json": inputJsonFilename,
									"output_filename": outputVideoFilename,
									"output_format": "TTPoints",
									"output_channelnum": "0"
								});
							} else {
								//TODO: make a case for static stereo
							}
						}
						break;
				}
			}

			(async () => {
			  try {
				log.info('rendering... ' + new Date());

				ShowProgressbar();
				if (await performSetOfProcesses(processingRequest)) {
					// clear up
					$('#Audio input[type="text"]').val("");
					$('#StereoAudio input[type="text"]').val("");
					$('#JsonInput input[type="text"]').val("");
					$('#Video input[type="text"]').val("");
					$('#OutputVideo input[type="text"]').val("");
					ShowMessage("Rendered successfully!");
				} else {
					ShowMessage("Error: Please submit log.log file.", true);
				}
				HideProgressbar();
				log.info('Render Complete: ' + new Date);
			  } catch (error) {
				console.error('An error occurred:', error);
			  }
			})();
		};

		var outputVideoInput = $('#OutputVideo input[type="text"]');
		if (!outputVideoInput.val()) {
			SaveFile(outputVideoInput).done(function() {
				runTranscode();
			});
		} else {
			runTranscode();
		}
	});
});