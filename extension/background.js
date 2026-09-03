/**
 * LiveKadeh SSH & SFTP Manager - Background Service Worker
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[LiveKadeh SSH/SFTP] Extension installed/updated:', details.reason);
  
  // Initialize default settings if not set
  chrome.storage.local.get(['bridgeUrl', 'servers'], (result) => {
    if (!result.bridgeUrl) {
      chrome.storage.local.set({ bridgeUrl: 'ws://localhost:3000/ws' });
    }
    if (!result.servers) {
      chrome.storage.local.set({
        servers: [
          {
            id: 'server-demo-local',
            name: 'Local Server (Example)',
            host: '127.0.0.1',
            port: 22,
            username: 'ubuntu',
            authType: 'password',
            color: '#00f0ff',
            defaultPath: '/home/ubuntu',
            createdAt: Date.now()
          }
        ]
      });
    }
  });
});

// Listener to open app in full tab or standalone window
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openApp') {
    const url = chrome.runtime.getURL('app.html' + (message.params ? '?' + new URLSearchParams(message.params).toString() : ''));
    if (message.asWindow) {
      chrome.windows.create({
        url,
        type: 'popup',
        width: 1280,
        height: 820,
        focused: true
      });
    } else {
      chrome.tabs.create({ url });
    }
    sendResponse({ success: true });
  }
  return true;
});
