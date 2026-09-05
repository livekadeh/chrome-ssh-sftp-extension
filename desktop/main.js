const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow = null;
let activeBridgePort = 3000;
let activeBridgeUrl = 'ws://127.0.0.1:3000/ws';

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------
// Persistent Storage Manager (JSON file in userData)
// ---------------------------------------------------------
const storageFilePath = path.join(app.getPath('userData'), 'livekadeh-storage.json');
let storageData = {};

function loadStorage() {
  try {
    if (fs.existsSync(storageFilePath)) {
      const raw = fs.readFileSync(storageFilePath, 'utf-8');
      storageData = JSON.parse(raw) || {};
    }
  } catch (err) {
    console.error('[Storage] Error loading storage data:', err.message);
    storageData = {};
  }
}

let saveDebounceTimer = null;
function saveStorage() {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      fs.writeFileSync(storageFilePath, JSON.stringify(storageData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage] Error saving storage data:', err.message);
    }
  }, 100);
}

// IPC Storage Handlers
ipcMain.handle('storage:get', (event, keys) => {
  if (!keys) {
    return { ...storageData };
  }
  if (typeof keys === 'string') {
    return { [keys]: storageData[keys] };
  }
  if (Array.isArray(keys)) {
    const res = {};
    for (const k of keys) {
      res[k] = storageData[k];
    }
    return res;
  }
  if (typeof keys === 'object') {
    const res = {};
    for (const k of Object.keys(keys)) {
      res[k] = storageData[k] !== undefined ? storageData[k] : keys[k];
    }
    return res;
  }
  return {};
});

ipcMain.handle('storage:set', (event, items) => {
  if (items && typeof items === 'object') {
    Object.assign(storageData, items);
    saveStorage();
  }
  return true;
});

ipcMain.handle('storage:remove', (event, keys) => {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const k of keyList) {
    delete storageData[k];
  }
  saveStorage();
  return true;
});

ipcMain.handle('storage:clear', () => {
  storageData = {};
  saveStorage();
  return true;
});

ipcMain.on('bridge:get-sync', (event) => {
  event.returnValue = {
    port: activeBridgePort,
    bridgeUrl: activeBridgeUrl
  };
});

// ---------------------------------------------------------
// Port Discovery & Bridge Server Initialization
// ---------------------------------------------------------
function findAvailablePort(preferredPort = 3000) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
        const altTester = net.createServer()
          .once('listening', () => {
            const port = altTester.address().port;
            altTester.close(() => resolve(port));
          })
          .listen(0, '127.0.0.1');
      })
      .once('listening', () => {
        tester.close(() => resolve(preferredPort));
      })
      .listen(preferredPort, '127.0.0.1');
  });
}

async function startInternalBridge() {
  activeBridgePort = await findAvailablePort(3000);
  activeBridgeUrl = `ws://127.0.0.1:${activeBridgePort}/ws`;

  process.env.PORT = String(activeBridgePort);
  process.env.HOST = '127.0.0.1';

  console.log(`[Desktop] Starting internal WebSocket Bridge on port ${activeBridgePort}...`);

  const serverScriptPath = fs.existsSync(path.join(__dirname, 'server', 'server.js'))
    ? path.join(__dirname, 'server', 'server.js')
    : path.join(__dirname, '..', 'server', 'server.js');

  try {
    require(serverScriptPath);
    console.log(`[Desktop] Bridge server ready at ${activeBridgeUrl}`);
  } catch (err) {
    console.error('[Desktop] Failed to start internal bridge server:', err);
  }
}

// ---------------------------------------------------------
// Browser Window Setup
// ---------------------------------------------------------
function createMainWindow() {
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 650,
    title: 'LiveKadeh SSH & SFTP Pro',
    backgroundColor: '#0a0e17',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const appHtmlPath = fs.existsSync(path.join(__dirname, 'extension', 'app.html'))
    ? path.join(__dirname, 'extension', 'app.html')
    : path.join(__dirname, '..', 'extension', 'app.html');

  mainWindow.loadFile(appHtmlPath);

  // Open external links in user's default web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------
app.whenReady().then(async () => {
  loadStorage();
  await startInternalBridge();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
