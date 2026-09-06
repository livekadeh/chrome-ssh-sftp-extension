const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

const APP_VERSION = '1.5.0';

let splashWindow = null;
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
// Splash Screen Management
// ---------------------------------------------------------
function createSplashWindow() {
  const iconPath = path.join(__dirname, 'icon.png');

  splashWindow = new BrowserWindow({
    width: 460,
    height: 310,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    show: true,
    backgroundColor: '#00000000',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'splash-preload.js')
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function updateSplash(message, progress) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:update', { message, progress });
  }
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
// Port Discovery & Version Verification
// ---------------------------------------------------------
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true); // Port is occupied
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false); // Port is free
    });

    socket.connect(port, host);
  });
}

function checkLiveKadehBridgeVersion(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 600 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.service && json.service.includes('LiveKadeh')) {
            resolve({ isBridge: true, version: json.version || '0.0.0' });
          } else {
            resolve({ isBridge: false, version: null });
          }
        } catch (e) {
          resolve({ isBridge: false, version: null });
        }
      });
    });

    req.on('error', () => resolve({ isBridge: false, version: null }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ isBridge: false, version: null });
    });
  });
}

function findFreePort(startPort = 3000) {
  return new Promise((resolve) => {
    const testNext = (currentPort) => {
      const server = net.createServer();
      server.once('error', () => {
        testNext(currentPort + 1);
      });
      server.once('listening', () => {
        server.close(() => resolve(currentPort));
      });
      server.listen(currentPort, '127.0.0.1');
    };
    testNext(startPort);
  });
}

async function resolveOptimalBridgePort() {
  updateSplash('Checking network ports & bridge...', 30);

  const defaultPort = 3000;
  const inUse = await isPortInUse(defaultPort);

  if (!inUse) {
    console.log(`[Desktop] Port ${defaultPort} is free. Using default port.`);
    return defaultPort;
  }

  // Port 3000 is in use: Inspect who is using it
  updateSplash('Inspecting port 3000 activity...', 40);
  const bridgeCheck = await checkLiveKadehBridgeVersion(defaultPort);

  if (bridgeCheck.isBridge) {
    console.log(`[Desktop] Port ${defaultPort} has an active LiveKadeh Bridge (version: ${bridgeCheck.version}).`);
    // If an older or external instance is detected, start a dedicated isolated port for this desktop app
    console.log(`[Desktop] Spawning dedicated fresh port for desktop session to prevent conflicts...`);
  } else {
    console.log(`[Desktop] Port ${defaultPort} is occupied by an external service. Finding next available port...`);
  }

  updateSplash('Finding clean isolated port...', 50);
  const freshPort = await findFreePort(3001);
  console.log(`[Desktop] Selected clean bridge port: ${freshPort}`);
  return freshPort;
}

async function startInternalBridge() {
  activeBridgePort = await resolveOptimalBridgePort();
  activeBridgeUrl = `ws://127.0.0.1:${activeBridgePort}/ws`;

  process.env.PORT = String(activeBridgePort);
  process.env.HOST = '127.0.0.1';

  updateSplash(`Starting Bridge Engine on port ${activeBridgePort}...`, 65);
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
// Main Browser Window Setup
// ---------------------------------------------------------
function createMainWindow() {
  updateSplash('Loading UI Workspace...', 85);

  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 650,
    show: false, // Keep hidden until fully loaded
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

  // Smooth transition from Splash to Main Window when DOM and scripts are ready
  mainWindow.webContents.once('did-finish-load', () => {
    updateSplash('Ready!', 100);
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.show();
      }
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
        splashWindow = null;
      }
    }, 400);
  });

  // Safety fallback timeout: Show window after 8s even if did-finish-load stalled
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
        splashWindow = null;
      }
    }
  }, 8000);

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
app.whenReady().then(() => {
  // Show splash window instantly as first priority
  createSplashWindow();

  // Defer storage and network operations to next tick so splash renders without blocking
  setImmediate(async () => {
    updateSplash('Initializing Desktop Core...', 15);
    loadStorage();
    await startInternalBridge();
    createMainWindow();
  });

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
