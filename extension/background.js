/**
 * LiveKadeh SSH & SFTP Manager - Background Service Worker
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[LiveKadeh SSH/SFTP] Extension installed/updated:', details.reason);
  
  // Initialize default settings if not set
  chrome.storage.local.get(['bridgeUrl', 'servers'], (result) => {
    if (!result.bridgeUrl) {
      chrome.storage.local.set({ bridgeUrl: 'ws://nl.livekadeh.com:3000/ws' });
    }
    if (!result.servers) {
      chrome.storage.local.set({
        servers: [
          {
            id: 'server-nl-demo',
            name: 'Netherlands Core (nl.livekadeh.com)',
            host: 'nl.livekadeh.com',
            port: 22,
            username: 'root',
            authType: 'password',
            color: '#00f0ff',
            defaultPath: '/root',
            createdAt: Date.now()
          }
        ]
      });
    }
  });
});

// Listener to open app in full tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openApp') {
    const url = chrome.runtime.getURL('app.html' + (message.params ? '?' + new URLSearchParams(message.params).toString() : ''));
    chrome.tabs.create({ url });
    sendResponse({ success: true });
  }
  return true;
});
