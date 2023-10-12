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
			$('#Audio input[type="text"]').val(e.dataTransfer.files[0].path);
		}
		window.inputAudioFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Spatial Audio File: ", f.path)
			window.inputAudioFiles[index] = f.path;
			index++;
		}
		checkSpatialAudioInput();
		return false;
	};

	document.getElementById('dragStereo').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		window.inputStereoFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Spatial Audio File: ", f.path)
			window.inputStereoFiles[index] = f.path;
			index++;
		}
		checkStereoAudioInput();
		return false;
	};

	document.getElementById('dragJson').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		window.inputJsonFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Json File: ", f.path)
			window.inputJsonFiles[index] = f.path;
			index++;
		}
		checkJsonInput();
		return false;
	};

	document.getElementById('dragVideo').ondrop = (e) => {
		e.preventDefault();
		$('#dragAudio,#dragStereo,#dragJson,#dragVideo').hide();
		window.inputVideoFiles.length = 0;
		var index = 0;
		for (let f of e.dataTransfer.files) {
			log.info("Input Video File: ", f.path)
			window.inputVideoFiles[index] = f.path;
			index++;
		}
		checkVideoInput();
		return false;
	};

	function checkSpatialAudioInput() {
		const exec = require('child_process').execSync;

		const scriptPath = ipcRenderer.sendSync('get-script-path');
		const scriptPathClean = scriptPath.replace(/ /g, '\\ ');
		const isWin = process.platform === "win32";
		const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1 Spatial System/');
		const ffmpeg = '"' + dataPath + (isWin ? "ffmpeg.exe" : "ffmpeg") + '"'; // scriptPathClean + "/../binaries/ffmpeg" + (isWin ? ".exe" : "")

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
				var bitdepth = "";
				if (err.toString().indexOf("Audio:") >= 0) {
					//var re = /(?<=Audio: )[^\ ]+/; // this failed because we cannot support look behinds
					var re = /Audio:\s(\w+)/;
					bitdepth = re.exec(err)[1]; // extracting file extension
					log.info("Input BitDepth: " + bitdepth);
					window.OutputBitDepth = bitdepth; // copy the string from ffmpeg input for -c:a call
					log.info("Output BitDepth: " + window.OutputBitDepth);
					window.OutputBitDepthShort = bitdepth.substring(0, bitdepth.length - 2);
					log.info("Output Bitdepth Short: " + window.OutputBitDepthShort);
				}

				var encoded_by = "";
				if (err.toString().indexOf("encoded_by") >= 0) {
					var re = /.*encoded_by[ ]*:[ ]*(.*)[ \r\n]*\n/;
					encoded_by = re.exec(err)[1]; // extracting file extension
					log.info("Encoded By: " + encoded_by);
				}

				if (err.toString().indexOf(", 7.1") >= 0) {
					// var occurenceIndex = err.toString().indexOf("channels");
					// var channelCount = err.toString().substr(occurenceIndex - 2, 2);
					var channelCount = 8;
					log.info("Input Spatial Audio Channel Count: " + channelCount);
					var re = /(?:\.([^.]+))?$/;
					var ext = re.exec(filePath)[1]; // extracting file extension
					log.info("Input Spatial Audio Extension: " + ext)
					if ((channelCount == 8) && (ext == "wav")) {
						// log.info("showing message!");
						// ShowMessage("8 Channel .wav files yield different channel orders dependent on DAW/Export software. \
						//	 If you are using Pro Tools HD please use .aif interleaved export option to ensure safe channel ordering", true);
					}

					//Check if ProTools .wav for reorder
					if ((channelCount == 8) && (encoded_by == "Pro Tools") && (ext == "wav")) {
						window.fromProTools = true;
						log.info("Input Spatial Audio File was exported from Pro Tools, will use channel re-ordering...");
					} else {
						window.fromProTools = false;
						log.info("Input Spatial Audio File not from Pro Tools or is .aif...")
					}
				} else {
					log.info("Error: Input Spatial Audio channel count not found...");
					log.info(err.toString())
					window.fromProTools = false;
				}
			}
		}
		log.info("Input Spatial Audio from ProTools? " + window.fromProTools);
		HideMessage();
		updateUIInputOptionsDependingOnSelectedFileTypes();
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
			if (selectedOutputType == 1 || selectedOutputType == 2 || selectedOutputType == 3 || selectedOutputType == 4 || selectedOutputType == 5) $('#Preview').show();
			else $('#Preview').hide();

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

	$('#Preview').click(function() {
		const exec = require('child_process').exec; //Sync;
		const scriptPath = ipcRenderer.sendSync('get-script-path') ;
		var scriptPathClean = scriptPath.replace(/ /g, '\\ ')
		var player = scriptPathClean + "/binaries/m1previewplayer.app/Contents/MacOS/m1previewplayer";
		// if (!fs.existsSync(player)) {
		//		 player = scriptPathClean + "/../../binaries/m1previewplayerDebug.app/Contents/MacOS/m1previewplayerDebug";
		// }
		// str.substring(0, str.lastIndexOf("/"));
		log.info("window.selectedOutputType:" + window.selectedOutputType);
		if (window.selectedOutputType == 1 || window.selectedOutputType == 2 || window.selectedOutputType == 3 || window.selectedOutputType == 4 || window.selectedOutputType == 5) {
			var command = player + " " + " --inputDir " + escapingPath(scriptPath + "/../../") + " --type " + String(window.selectedOutputType);
			if (window.outputFilename) {
				command += " --video " + escapingPath(window.outputFilename);
			}
			//setup for stereo flagging if not HorizonPairs output
			if (!window.inputStereoEmpty && (window.selectedOutputType == 1 || window.selectedOutputType == 5)) {
				command += " --stereo " + escapingPath(scriptPath + "/../../");
			}
			log.info("Preview Command: " + command);
			exec(command);
		} else {
			alert("not supported yet!");
			log.warn("Preview does not support: FormatType: " + window.selectedOutputType + ", OutputFileType: " + window.selectedOutputFileType);
		}
	});

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
			// removing temp files
			const execSync = require('child_process').execSync;
			try {
				const dataPath = path.join(ipcRenderer.sendSync('get-app-data-path'), 'Mach1 Spatial System/');

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
					" && " + (isWin ? "del" : "rm -f") + " 1.wav 2.wav 3.wav 4.wav 5.wav 6.wav 7.wav 8.wav 000.wav 001.wav 002.wav 003.wav 004.wav 005.wav 006.wav 007.wav 008.wav 009.wav MERGED.wav MERGED.m4a st1.wav st2.wav st3.wav st4.wav outputaudio.wav output_audio.wav output_audio.ac3 videooutput_forinject.mp4",
					function(error, stdout, stderr) {
						return true;
					});
				log.info("..removed temp files successfully..");
			} catch (err) {
				log.error(err);
			}

			// checking inputs
			checkSpatialAudioInput();
			checkStereoAudioInput();
			checkJsonInput();
			checkVideoInput();

			window.inputAudioFiles[0] = $('#Audio input[type="text"]').val();
			inputAudioFilename = window.inputAudioFiles[0];
			var inputAudioExt = inputAudioFilename.substr(inputAudioFilename.length - 3);
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

			var re = /(?:\.([^.]+))?$/;

			var ext = re.exec(outputVideoFilename)[1]; // extracting file extension
			var preferredExtension;
			if (selectedOutputFileType == 1) preferredExtension = "m4a";
			if (selectedOutputFileType == 2) preferredExtension = "wav";
			if (selectedOutputFileType == 3) preferredExtension = "mp4";
			if (selectedOutputFileType == 4) preferredExtension = "mov";
			if (selectedOutputFileType == 5) preferredExtension = "mp4";
			if (selectedOutputFileType == 6) preferredExtension = "mp4";
			if (selectedOutputFileType == 7) preferredExtension = "mp4";
			if (selectedOutputFileType == 8) preferredExtension = "mov";
			if (selectedOutputFileType == 9) preferredExtension = "mov";
			if (selectedOutputFileType == 10) preferredExtension = "mov";
			if (selectedOutputFileType == 11) preferredExtension = "ogg";
			if (selectedOutputFileType == 12) preferredExtension = "aif";
			if (selectedOutputFileType == 13) preferredExtension = "opus";
			if (selectedOutputFileType == 14) preferredExtension = "mp4";

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
					case "3":
						if (selectedOutputFileType == 1) { // Audio only compressed
							//compress to aac
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							//Make fun of user for asking to output the same thing as the input
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
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
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
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
					case "4":
						if (selectedOutputFileType == 1) { // Audio only compressed
							//compress to aac
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							//Make fun of user for asking to output the same thing as the input
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
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
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
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
					case "1":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
										"input_filename": inputAudioFilename,
										"output_filename": outputVideoFilename
									});
								}
							} else {
								//TODO: AAC / VORBIS 10 CHANNEL
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
										"input_filename": inputAudioFilename,
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								}
							}
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg",
										"input_filename": "reordered.aif",
										"output_filename": outputVideoFilename
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg",
										"input_filename": inputAudioFilename,
										"output_filename": outputVideoFilename
									});
								}
							} else {
								//TODO: AAC / VORBIS 10 CHANNEL
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg_plus_stereo",
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								} else {
									// Optional stereo, case 2
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg_plus_stereo",
										"input_filename": inputAudioFilename,
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								}
							}
						}
						if (selectedOutputFileType == 13) { // Audio only compressed opus
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg",
										"input_filename": "reordered.aif",
										"output_filename": outputVideoFilename
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg",
										"input_filename": inputAudioFilename,
										"output_filename": outputVideoFilename
									});
								}
							} else {
								//TODO: AAC / VORBIS 10 CHANNEL
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg_plus_stereo",
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								} else {
									// Optional stereo, case 2
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_ogg_plus_stereo",
										"input_filename": inputAudioFilename,
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								}
							}
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									log.info("im converting from ProTools")
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_output",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": outputVideoFilename
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_output",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": outputVideoFilename
									});
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								} else {
									// Optional stereo, case 2
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": outputVideoFilename
									});
								}
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a",
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.m4a"
									});
									processingRequest.push({
										"process_kind": "attach_audio_to_video_hard",
										"input_audio": "MERGED.m4a",
										"input_video": "muted-video." + window.inputVideoExt,
										"output_video": outputVideoFilename
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a",
										"input_filename": inputAudioFilename,
										"output_filename": "MERGED.m4a"
									});
									processingRequest.push({
										"process_kind": "attach_audio_to_video_hard",
										"input_audio": "MERGED.m4a",
										"input_video": "muted-video." + window.inputVideoExt,
										"output_video": outputVideoFilename
									});
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_m4a_plus_stereo",
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": "MERGED.m4a"
									});
									processingRequest.push({
										"process_kind": "attach_audio_to_video_soft",
										"input_audio": "MERGED.m4a",
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
										"process_kind": "8_channel_pcm_to_m4a_plus_stereo",
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "attach_audio_to_video_hard",
										"input_audio": "MERGED.wav",
										"input_video": "muted-video." + window.inputVideoExt,
										"output_video": outputVideoFilename
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "attach_audio_to_video_hard",
										"input_audio": "MERGED.wav",
										"input_video": "muted-video." + window.inputVideoExt,
										"output_video": outputVideoFilename
									});
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//M1HORIZON
						//TODO: +ST
					case "2":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo
									// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
									// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo
									// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
									// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo
									// This case cannot be possible due to conversion issues of Spatial+ST to Horizon without ST
									// Hold or remove this until solution is decided on, Horizon+ST 4+2 channels or 6 channel video
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//M1HORIZON PAIRS (SINGLESTREAM) 
						//TODO: +ST
					case "3":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 5
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo, case 6
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 5
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo, case 6
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 5
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo, case 6
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 5
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_output",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//M1HORIZON PAIRS (MULTISTREAM)
					case "4":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						break;

						//FOA: ACNSN3D
					case "5":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									//GAIN UTILITY FOR oFOA
									processingRequest.push({
										"process_kind": "ffmpeg-gain",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									//GAIN UTILITY FOR oFOA
									processingRequest.push({
										"process_kind": "ffmpeg-gain",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// Optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"output_filename": outputVideoFilename
									});
								} else {
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed 
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (selectedOutputFileType == 5) { // Audio & Video compressed MONOSCOPIC
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"stereo_filename": inputStaticStereoFilename,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (selectedOutputFileType == 6) { // Audio & Video compressed TOP/BOTTOM STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 9
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (selectedOutputFileType == 7) { // Audio & Video compressed LEFT/RIGHT STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": "MERGED.wav"
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
										"input_filename": inputAudioFilename,
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
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (selectedOutputFileType == 8) { // Audio & Video uncompressed MONOSCOPIC
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (selectedOutputFileType == 9) { // Audio & Video uncompressed TOP/BOTTOM STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						//TODO: look into why I need to reorder ACNSN3D to work!?!?!?!?
						if (selectedOutputFileType == 10) { // Audio & Video uncompressed LEFT/RIGHT STEREOSCOPIC 
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 9
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//FOA: FuMa 
					case "6":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//SOA: ACNSN3D
					case "7":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 14
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//SOA: FuMa 
					case "8":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//Surround: 5.1 L,C,R,Ls,Rs,LFE Cinema
					case "9":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//Surround: 5.1 L,R,C,LFE,Ls,Rs
					case "10":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//Surround: 5.1 L, R, Ls, Rs, C, LFE
					case "11":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//Surround: 5.0 L,C,R,Ls,Rs
					case "23":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1 L, C, R, Lss, Rss, Lsr, Rsr, LFE
					case "12":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						break;

						//Surround: 7.0 L, C, R, Lss, Rss, Lsr, Rsr
					case "24":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//TBE/FB360 
					case "13":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
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
								}
							} else {
								// Optional stereo, case 16
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
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
								} else {
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//ACNSN3D 3oa
					case "14":
						if (selectedOutputFileType == 1) { // Audio only compressed
							//TODO: Requires 16channel aac
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
										"input_format": "M1Spatial",
										"output_format": "ACNSN3DO3A",
										"output_channelnum": "0",
										"output_filename": outputVideoFilename
									});
								} else {
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "16_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
										"input_format": "M1Spatial",
										"output_format": "ACNSN3DO3A",
										"output_channelnum": "0",
										"output_filename": outputVideoFilename
									});
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "16_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "16_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//FuMa 3oa
					case "15":
						if (selectedOutputFileType == 1) { // Audio only compressed
							//TODO: Requires 16channel aac
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "16_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "16_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "16_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								// Optional stereo, case 16
								// REMOVE UNTIL VERIFY SUPPORT IN PLAYBACK
							}
						}
						break;

						//Surround: 5.1.2 Surround (L,C,R,Ls,Rs,LFE,Lts,Rts)
					case "16":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 5.0.2 Surround (L,C,R,Ls,Rs,LFE,Lts,Rts)
					case "21":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 5.1.4 Surround (L,C,R,Ls,Rs,LFE,FLts,FRts,BLts,BRts)
					case "17":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 5.0.4 Surround (L,C,R,Ls,Rs,LFE,FLts,FRts,BLts,BRts)
					case "22":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1 Surround SDDS (L,C,R,Ls,Rs,LFE,Lts,Rts)
					case "18":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1.2 Surround (L,C,R,Lss,Rss,Lsr,Rsr,LFE,Lts,Rts)
					case "19":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"stereo_filename": inputStaticStereoFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Surround: 7.1.4 Surround L,C,R,Lss,Rss,Lsr,Rsr,LFE,FLts,FRts,BLts,BRts)
					case "20":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//Mach1 SDK: Unity & Unreal Engine
					case "25":
						if (selectedOutputFileType == 1) { // Audio only compressed aac
							if (window.fromProTools == true) {
								processingRequest.push({
									"process_kind": "8_channel_ProToolsWav_to_aif",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": inputAudioFilename,
									"output_filename": "reordered.aif"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "reordered.aif",
									"output_filename": "MERGED.wav"
								});
								var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
								log.info("output path: ", videoOutputPath)
								processingRequest.push({
									"process_kind": "copy_to_output_dir_m4a",
									"output_dir": videoOutputPath
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": inputAudioFilename,
									"output_filename": "MERGED.wav"
								});
								var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
								log.info("output path: ", videoOutputPath)
								processingRequest.push({
									"process_kind": "copy_to_output_dir_m4a",
									"output_dir": videoOutputPath
								});
							}
						}
						if (selectedOutputFileType == 11) { // Audio only compressed ogg
							if (window.fromProTools == true) {
								processingRequest.push({
									"process_kind": "8_channel_ProToolsWav_to_aif",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": inputAudioFilename,
									"output_filename": "reordered.aif"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "reordered.aif",
									"output_filename": "MERGED.wav"
								});
								var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
								log.info("output path: ", videoOutputPath)
								processingRequest.push({
									"process_kind": "copy_to_output_dir_ogg",
									"output_dir": videoOutputPath
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": inputAudioFilename,
									"output_filename": "MERGED.wav"
								});
								var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
								log.info("output path: ", videoOutputPath)
								processingRequest.push({
									"process_kind": "copy_to_output_dir_ogg",
									"output_dir": videoOutputPath
								});
							}
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (window.fromProTools == true) {
								processingRequest.push({
									"process_kind": "8_channel_ProToolsWav_to_aif",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": inputAudioFilename,
									"output_filename": "reordered.aif"
								});
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": "reordered.aif",
									"output_filename": "MERGED.wav"
								});
								var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
								log.info("output path: ", videoOutputPath)
								processingRequest.push({
									"process_kind": "copy_to_output_dir_wav",
									"output_dir": videoOutputPath
								});
							} else {
								processingRequest.push({
									"process_kind": "8_channel_pcm_to_wav",
									"bitdepth": window.OutputBitDepthShort,
									"input_filename": inputAudioFilename,
									"output_filename": "MERGED.wav"
								});
								var videoOutputPath = outputVideoFilename.substring(0, outputVideoFilename.lastIndexOf("/")) + "/"
								log.info("output path: ", videoOutputPath)
								processingRequest.push({
									"process_kind": "copy_to_output_dir_wav",
									"output_dir": videoOutputPath
								});
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;

						//M1SPATIAL multistream for SamsungVR
					case "26":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "spatial_to_samsungvr",
										"input_filename": "reordered.aif",
										"input_video": inputVideoFilename,
										"output_video": outputVideoFilename
									});
								} else {
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename
									});
									processingRequest.push({
										"process_kind": "spatial_to_samsungvr",
										"input_filename": "MERGED.wav",
										"input_video": inputVideoFilename,
										"output_video": outputVideoFilename
									});
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "spatial_to_samsungvr_plus_stereo",
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"input_video": inputVideoFilename,
										"output_video": outputVideoFilename
									});
								} else {
									// Optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "spatial_to_samsungvr",
										"input_filename": "reordered.aif",
										"input_video": inputVideoFilename,
										"output_video": outputVideoFilename
									});
								} else {
									// No optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename
									});
									processingRequest.push({
										"process_kind": "spatial_to_samsungvr",
										"input_filename": "MERGED.wav",
										"input_video": inputVideoFilename,
										"output_video": outputVideoFilename
									});
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "spatial_to_samsungvr_plus_stereo",
										"input_filename": "reordered.aif",
										"stereo_filename": inputStaticStereoFilename,
										"input_video": inputVideoFilename,
										"output_video": outputVideoFilename
									});
								} else {
									// Optional stereo
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename
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
						}
						break;
						//M1SPATIAL to 5.1(side) for Apple Spatial (video)
					case "27":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
										"input_format": "M1Spatial",
										"output_format": "FiveOneSmpte", // L,R,C,LFE,SL,SR
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "ffmpeg-mute",
										"input_video": inputVideoFilename,
										"output_video": "muted-video." + window.inputVideoExt
									});
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
										"input_filename": inputAudioFilename,
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
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						if (selectedOutputFileType == 14) { // Audio & Video Compressed (generated video)
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
										"output_filename": "MERGED.wav"
									});
									processingRequest.push({
										"process_kind": "m1transcode_normalize",
										"master_gain": "0",
										"input_filename": "MERGED.wav",
										"input_format": "M1Spatial",
										"output_format": "FiveOneSmpte", // L,R,C,LFE,SL,SR
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
										"process_kind": "8_channel_pcm_to_wav",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
								}
							} else {
								if (window.fromProTools == true) {
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": "reordered.aif",
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
								} else {
									// No optional stereo, case 15
									processingRequest.push({
										"process_kind": "8_channel_pcm_to_wav_plus_stereo",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
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
						}
						break;
						//M1SPATIAL to 7.1.2 ADM Channel Bed for ADM or Dolby Atmos usage
					case "28":
						if (selectedOutputFileType == 1) { // Audio only compressed
						}
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									log.info("im converting from ProTools")
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "m1transcode",
										"master_gain": "0",
										"input_filename": "reordered.aif",
										"input_format": "M1Spatial",
										"output_filename": outputVideoFilename,
										"output_format": "DolbyAtmosSevenOneTwo",
										"output_channelnum": "0"
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "m1transcode",
										"input_filename": inputAudioFilename,
										"input_format": "M1Spatial",
										"output_filename": outputVideoFilename,
										"output_format": "DolbyAtmosSevenOneTwo",
										"output_channelnum": "0"
									});
								}
							} else {
								if (window.fromProTools == true) {
									log.info("im converting from ProTools")
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "m1transcode",
										"master_gain": "0",
										"input_filename": "reordered.aif",
										"input_format": "M1SpatialS",
										"output_filename": outputVideoFilename,
										"output_format": "DolbyAtmosSevenOneTwo",
										"output_channelnum": "0"
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "m1transcode",
										"input_filename": inputAudioFilename,
										"input_format": "M1SpatialS",
										"output_filename": outputVideoFilename,
										"output_format": "DolbyAtmosSevenOneTwo",
										"output_channelnum": "0"
									});
								}
							}
						}
						if (selectedOutputFileType == 3) { // Audio & Video compressed
						}
						if (selectedOutputFileType == 4) { // Audio & Video uncompressed
						}
						break;
						//Custom Format defined by InputJSON file 
					case "99":
						if (selectedOutputFileType == 2) { // Audio only uncompressed
							if (inputStaticStereoFilename == "") {
								if (window.fromProTools == true) {
									log.info("im converting from ProTools")
									processingRequest.push({
										"process_kind": "8_channel_ProToolsWav_to_aif",
										"bitdepth": window.OutputBitDepthShort,
										"input_filename": inputAudioFilename,
										"output_filename": "reordered.aif"
									});
									processingRequest.push({
										"process_kind": "m1transcode_json",
										"input_filename": "reordered.aif",
										"input_format": "M1Spatial",
										"output_Json": inputJsonFilename,
										"output_filename": outputVideoFilename,
										"output_format": "TTPoints",
										"output_channelnum": "0"
									});
								} else {
									// No optional stereo, case 1
									processingRequest.push({
										"process_kind": "m1transcode_json",
										"input_filename": inputAudioFilename,
										"input_format": "M1Spatial",
										"output_Json": inputJsonFilename,
										"output_filename": outputVideoFilename,
										"output_format": "TTPoints",
										"output_channelnum": "0"
									});
								}
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