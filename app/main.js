const {app, dialog, ipcMain, BrowserWindow, Menu, shell} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const util = require('util');

const dataPath = path.join(app.getPath('appData'), 'Mach1 Spatial System/')
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

const log = require('electron-log');
log.catchErrors(options = {});

// Helper
ipcMain.on('get-app-data-path', (event) => {
  event.returnValue = app.getPath('appData');
});

ipcMain.handle('show-open-dialog', async (event, extensions) => {
    try {
        const result = await dialog.showOpenDialog({
            filters: [{
                name: 'text',
                extensions: extensions
            }],
            properties: ['openFile', 'multiSelections']
        });

        if (result.canceled) {
            return undefined;
        }

        return result.filePaths;
    } catch (error) {
        console.error('Error:', error);
        return undefined;
    }
});

ipcMain.handle('show-save-dialog', async () => {
    try {
        const result = await dialog.showSaveDialog({});
        if (result.canceled) {
            return undefined;
        }
        return result.filePath;
    } catch (error) {
        console.error('Error:', error);
        return undefined;
    }
});

ipcMain.on('get-script-path', (event) => {
  const scriptPath = path.dirname(require.main.filename);
  event.returnValue = scriptPath;
});

ipcMain.on('get-download-folder', (event) => {
  const downloadFolder = app.getPath('downloads');
  event.returnValue = downloadFolder;
});

// Check updates
if (fs.existsSync(dataPath + (isWin ? "M1-Notifier/M1-Notifier.exe" : "M1-Notifier.app"))) {
	shell.openPath(dataPath + (isWin ? "M1-Notifier/M1-Notifier.exe" : "M1-Notifier.app"));
}

const DownloadManager = require("electron-download-manager");
DownloadManager.register({
	downloadFolder: dataPath
}); // "binaries"});


ipcMain.on('start-download', (event, url) => {
	DownloadManager.download({url: url, onProgress : (progress, item) => {
		event.sender.send('on-progress', progress);
	}}, (error, info) => {
		if (error) {
		  event.sender.send('download-error', error.message);
		} else {
		  event.sender.send('download-complete', info.filePath);
		}
  });
});

if (!fs.existsSync(dataPath)) {
	fs.mkdirSync(dataPath);
}

// Setup new path for logs to match other Mach1 Spatial System data
log.transports.file.resolvePath = () => dataPath+"logs/M1-Transcoder.log";
log.info("Log Path: "+dataPath+"logs/M1-Transcoder.log");

// Menu Constructor
const menuTemplate = [
	{
        label: 'File',
		submenu: [		
			{
				role: 'quit',
				label: 'Quit',
				click: function() { app.quit() },
				accelerator: 'CmdOrCtrl+Q'
			}
		]
	},
	{
		label: 'View',
		submenu: [
			{
				role: 'reload'
			},
			{
				label: 'Show logs',
				accelerator: 'CmdOrCtrl+L',
				toolTip: 'Use this to send logs to whatsup@mach1.tech for support',
				click: () => { 
					if (fs.existsSync(dataPath+'/logs/M1-Transcoder.log')) {
						shell.showItemInFolder(dataPath+'/logs/M1-Transcoder.log')
					} else {
						shell.showItemInFolder(dataPath+'/logs')
					}
				}
			},
			{
				role: 'toggleDevTools',
				label: 'Toggle Dev Tools',
				accelerator: 'CmdOrCtrl+Shift+I',
				click: () => mainWindow.webContents.toggleDevTools()
			},
			{
				type: 'separator'
			},
			{
				label: 'Show processing folder...',
				click: function() {
					if (fs.existsSync(dataPath+'/temp')) {
						shell.showItemInFolder(dataPath+'/temp')
					} else {
						shell.showItemInFolder(dataPath)
					}
				}
			},
			{
				label: 'Show dependencies folder...',
				click: function() {
					if (fs.existsSync(dataPath)) {
						shell.showItemInFolder(dataPath)
					}
				}
			}
		]
	}
]

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 505,
		height: 635,
		titleBarStyle: 'hidden-inset',
		webPreferences: { nodeIntegration: true, contextIsolation: false }
	})

	// and load the index.html of the app.
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))

	// disable resizing
	mainWindow.setResizable(false);

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null
	})

	mainWindow.webContents.on('did-finish-load', function() {
		// change margins based on OS
		if(isWin) {
			var css = "body { margin-left: 24px; margin-right: 24px; margin-top: 0px; margin-bottom: 0px; } .divider { display: none; }"
			// hide divider to make more space since the top nav bar in windows takes space
		} else {
			var css = "body { margin: 24px; } .divider { display: block; }"
		}
		mainWindow.webContents.insertCSS(css)
	});

	const menu = Menu.buildFromTemplate(menuTemplate)
	Menu.setApplicationMenu(menu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function() {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', function() {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow()
	}
})