const { ipcRenderer } = require('electron');

// Get active internal bridge info from Electron main process
let bridgeInfo = { port: 3000, bridgeUrl: 'ws://127.0.0.1:3000/ws' };
try {
  const syncInfo = ipcRenderer.sendSync('bridge:get-sync');
  if (syncInfo && syncInfo.bridgeUrl) {
    bridgeInfo = syncInfo;
  }
} catch (e) {
  console.warn('[Desktop Preload] Could not get sync bridge info:', e);
}

window.DESKTOP_ENV = true;
window.DESKTOP_BRIDGE_URL = bridgeInfo.bridgeUrl;

// Initialize window.chrome namespace
window.chrome = window.chrome || {};

// Polyfill chrome.storage.local backed by persistent disk storage via Electron IPC
window.chrome.storage = window.chrome.storage || {};
window.chrome.storage.local = {
  get: function (keys, callback) {
    return ipcRenderer.invoke('storage:get', keys).then((data) => {
      const res = data || {};
      // Ensure bridgeUrl defaults to internal desktop bridge if unset
      if (!res.bridgeUrl) {
        if (!keys || keys === 'bridgeUrl' || (Array.isArray(keys) && keys.includes('bridgeUrl'))) {
          res.bridgeUrl = window.DESKTOP_BRIDGE_URL;
        }
      }
      if (typeof callback === 'function') {
        try { callback(res); } catch (err) { console.error(err); }
      }
      return res;
    });
  },

  set: function (items, callback) {
    return ipcRenderer.invoke('storage:set', items).then(() => {
      if (typeof callback === 'function') {
        try { callback(); } catch (err) { console.error(err); }
      }
    });
  },

  remove: function (keys, callback) {
    return ipcRenderer.invoke('storage:remove', keys).then(() => {
      if (typeof callback === 'function') {
        try { callback(); } catch (err) { console.error(err); }
      }
    });
  },

  clear: function (callback) {
    return ipcRenderer.invoke('storage:clear').then(() => {
      if (typeof callback === 'function') {
        try { callback(); } catch (err) { console.error(err); }
      }
    });
  }
};

// Polyfill chrome.runtime
window.chrome.runtime = window.chrome.runtime || {
  getURL: function (path) {
    return path;
  },
  getManifest: function () {
    return {
      version: '1.4.3',
      name: 'LiveKadeh SSH & SFTP Pro'
    };
  },
  sendMessage: function (msg, callback) {
    if (typeof callback === 'function') callback({});
  },
  onInstalled: {
    addListener: function () {}
  },
  onMessage: {
    addListener: function () {}
  }
};

// Polyfill chrome.windows for desktop compatibility
window.chrome.windows = window.chrome.windows || {
  getCurrent: function (cb) {
    if (typeof cb === 'function') cb({ id: 1, focused: true });
  },
  create: function (opts, cb) {
    if (typeof cb === 'function') cb({ id: 2 });
  }
};

// UI adjustments when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Hide popout button since app is already running in standalone window
  const btnPopout = document.getElementById('btnPopoutWindow');
  if (btnPopout) {
    btnPopout.style.display = 'none';
  }
});
