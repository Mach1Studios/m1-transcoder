const {app, dialog, ipcMain, BrowserWindow, Menu, shell} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const util = require('util');
const {BatchRunner} = require('../lib/BatchRunner')
const {getOutputFormatFromLegacyValue} = require('../lib/catalog/formats')
const {analyzeFilePair} = require('../lib/reports/audioAnalysis')
const {saveCsvReport, saveJsonReport} = require('../lib/reports/reportIO')
const {resolveToolchain} = require('../lib/toolchain/resolveToolchain')

const dataPath = path.join(app.getPath('appData'), 'Mach1/')
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

ipcMain.handle('show-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.on('get-script-path', (event) => {
  const scriptPath = path.dirname(require.main.filename);
  event.returnValue = scriptPath;
});

ipcMain.on('get-resource-path', (event) => {
    event.returnValue = process.resourcesPath;
});

ipcMain.on('get-download-folder', (event) => {
  const downloadFolder = app.getPath('downloads');
  event.returnValue = downloadFolder;
});

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
                label: 'Batch Convert…',
                accelerator: 'CmdOrCtrl+Shift+B',
                click: function() { createBatchWindow() }
            },
            {
                type: 'separator'
            },
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
let batchWindow
let reportWindow
let activeBatchRunner
let latestReport

function createBatchWindow() {
    if (batchWindow && !batchWindow.isDestroyed()) {
        batchWindow.focus()
        return batchWindow
    }
    batchWindow = new BrowserWindow({
        width: 1180,
        height: 720,
        minWidth: 920,
        minHeight: 560,
        title: 'M1-Transcoder — Batch Convert',
        backgroundColor: '#282828',
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    })
    batchWindow.loadFile(path.join(__dirname, 'batch', 'index.html'))
    batchWindow.on('closed', function() {
        batchWindow = null
    })
    return batchWindow
}

function showReportWindow(report) {
    latestReport = report
    if (reportWindow && !reportWindow.isDestroyed()) {
        reportWindow.webContents.send('report:updated', report)
        reportWindow.focus()
        return reportWindow
    }
    reportWindow = new BrowserWindow({
        width: 980,
        height: 720,
        minWidth: 760,
        minHeight: 520,
        title: 'M1-Transcoder — Gain & Loudness Report',
        backgroundColor: '#282828',
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    })
    reportWindow.loadFile(path.join(__dirname, 'report', 'index.html'))
    reportWindow.on('closed', function() {
        reportWindow = null
    })
    return reportWindow
}

ipcMain.handle('batch:run', async (event, rawManifest, options = {}) => {
    if (activeBatchRunner) {
        throw new Error('A batch is already running.')
    }
    const sender = event.sender
    activeBatchRunner = new BatchRunner({
        toolchain: resolveToolchain({resourcesDirectory: process.resourcesPath}),
        onEvent: (batchEvent) => {
            if (!sender.isDestroyed()) sender.send('batch:event', batchEvent)
        }
    })
    try {
        const report = await activeBatchRunner.run(rawManifest, options)
        latestReport = report
        showReportWindow(report)
        return report
    } finally {
        activeBatchRunner = null
    }
})

ipcMain.handle('batch:cancel', async () => {
    if (activeBatchRunner) activeBatchRunner.cancel()
    return Boolean(activeBatchRunner)
})

ipcMain.handle('report:get-latest', async () => latestReport)

ipcMain.handle('report:save', async (event, format) => {
    if (!latestReport) throw new Error('No report is available.')
    const extension = format === 'csv' ? 'csv' : 'json'
    const result = await dialog.showSaveDialog({
        defaultPath: `mach1-transcoder-report.${extension}`,
        filters: [{name: extension.toUpperCase(), extensions: [extension]}]
    })
    if (result.canceled) return null
    return format === 'csv'
        ? saveCsvReport(result.filePath, latestReport)
        : saveJsonReport(result.filePath, latestReport)
})

ipcMain.handle('report:show', async (event, report) => {
    showReportWindow(report)
    return true
})

ipcMain.handle('shell:reveal', async (event, filePath) => {
    if (filePath) shell.showItemInFolder(filePath)
    return true
})

ipcMain.handle('gain-report:analyze-single', async (event, request) => {
    const outputFormat = getOutputFormatFromLegacyValue(request.outputFormatLegacyValue)
    if (!outputFormat) throw new Error(`Unknown legacy output format: ${request.outputFormatLegacyValue}`)
    const measurements = await analyzeFilePair({
        inputPath: request.inputPath,
        outputPath: request.outputPath,
        inputFormat: request.inputFormat || 'm1spatial-8',
        outputFormat: outputFormat.id,
        proToolsOrder: request.proToolsOrder || 'none',
        gainActions: request.gainActions,
        toolchain: resolveToolchain({resourcesDirectory: process.resourcesPath})
    })
    const result = {
        jobId: 'single-render',
        status: 'completed',
        inputPath: request.inputPath,
        outputPath: request.outputPath,
        inputFormat: request.inputFormat || 'm1spatial-8',
        outputFormat: outputFormat.id,
        gainActions: request.gainActions || {masterGainDb: 0, normalized: false},
        measurements,
        reviewRequired: measurements.reviewRequired,
        warnings: measurements.warnings
    }
    const report = {
        kind: 'mach1-transcoder.report',
        schemaVersion: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        referenceVersion: measurements.referenceVersion,
        summary: {
            total: 1,
            completed: 1,
            failed: 0,
            cancelled: 0,
            disabled: 0,
            reviewRequired: result.reviewRequired ? 1 : 0
        },
        results: [result]
    }
    showReportWindow(report)
    return report
})

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 505,
        height: 635,
        titleBarStyle: 'hiddenInset',
        frame: false,
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
const packagedBatchArgumentIndex = process.argv.indexOf('--batch')
if (packagedBatchArgumentIndex >= 0) {
    app.on('ready', async function() {
        const {runCli} = require('./batch-cli')
        const exitCode = await runCli(process.argv.slice(packagedBatchArgumentIndex))
        app.exit(exitCode)
    })
} else {
    app.on('ready', createWindow)
}

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