const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  onUpdate: (callback) => {
    ipcRenderer.on('splash:update', (event, data) => {
      if (typeof callback === 'function') {
        callback(data);
      }
    });
  }
});
