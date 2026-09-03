/**
 * LiveKadeh SSH & SFTP Manager - Popup Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnOpenFull = document.getElementById('btnOpenFull');
  const btnSettings = document.getElementById('btnSettings');
  const btnManageServers = document.getElementById('btnManageServers');
  const btnQuickSSH = document.getElementById('btnQuickSSH');
  const btnQuickSFTP = document.getElementById('btnQuickSFTP');
  
  const quickHost = document.getElementById('quickHost');
  const quickUser = document.getElementById('quickUser');
  const quickPort = document.getElementById('quickPort');
  const quickPass = document.getElementById('quickPass');

  const serversList = document.getElementById('serversList');
  const bridgeDot = document.getElementById('bridgeDot');
  const bridgeStatusText = document.getElementById('bridgeStatusText');

  // Load Servers
  function loadServers() {
    chrome.storage.local.get(['servers', 'bridgeUrl'], (data) => {
      const servers = data.servers || [];
      serversList.innerHTML = '';

      if (servers.length === 0) {
        serversList.innerHTML = '<div style="color: #64748b; font-size: 11px; text-align: center; padding: 10px;">سروری ذخیره نشده است</div>';
        return;
      }

      servers.forEach(srv => {
        const item = document.createElement('div');
        item.className = 'server-item';
        item.innerHTML = `
          <div class="server-info">
            <span class="server-badge" style="background: ${srv.color || '#00f0ff'}; box-shadow: 0 0 8px ${srv.color || '#00f0ff'};"></span>
            <div>
              <div class="server-name">${srv.name}</div>
              <div class="server-host">${srv.username}@${srv.host}:${srv.port || 22}</div>
            </div>
          </div>
          <div class="server-actions">
            <button class="mini-btn btn-srv-ssh" title="ترمینال SSH">⚡</button>
            <button class="mini-btn btn-srv-sftp" title="فایل منیجر SFTP">📁</button>
          </div>
        `;

        item.querySelector('.btn-srv-ssh').addEventListener('click', (e) => {
          e.stopPropagation();
          openAppWithServer(srv, 'ssh');
        });

        item.querySelector('.btn-srv-sftp').addEventListener('click', (e) => {
          e.stopPropagation();
          openAppWithServer(srv, 'sftp');
        });

        item.addEventListener('click', () => {
          openAppWithServer(srv, 'ssh');
        });

        serversList.appendChild(item);
      });

      // Check Bridge Server Health
      checkBridgeStatus(data.bridgeUrl || 'ws://localhost:3000/ws');
    });
  }

  function checkBridgeStatus(wsUrl) {
    try {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        bridgeDot.className = 'status-dot offline';
        bridgeStatusText.textContent = 'بریج: غیرقابل دسترس';
        try { ws.close(); } catch (e) {}
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timer);
        bridgeDot.className = 'status-dot online';
        bridgeStatusText.textContent = 'بریج: متصل و آماده 🚀';
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timer);
        bridgeDot.className = 'status-dot offline';
        bridgeStatusText.textContent = 'بریج: خطا در اتصال';
      };
    } catch (e) {
      bridgeDot.className = 'status-dot offline';
      bridgeStatusText.textContent = 'بریج: خطا';
    }
  }

  function openAppWithServer(serverData, mode = 'ssh') {
    const params = {
      mode: mode,
      host: serverData.host || '',
      port: serverData.port || 22,
      username: serverData.username || 'root',
      password: serverData.password || '',
      name: serverData.name || ''
    };
    chrome.runtime.sendMessage({ action: 'openApp', params });
  }

  // Quick connect buttons
  btnQuickSSH.addEventListener('click', () => {
    const host = quickHost.value.trim();
    if (!host) {
      quickHost.focus();
      return;
    }
    openAppWithServer({
      host,
      port: quickPort.value || 22,
      username: quickUser.value || 'root',
      password: quickPass.value || '',
      name: host
    }, 'ssh');
  });

  btnQuickSFTP.addEventListener('click', () => {
    const host = quickHost.value.trim();
    if (!host) {
      quickHost.focus();
      return;
    }
    openAppWithServer({
      host,
      port: quickPort.value || 22,
      username: quickUser.value || 'root',
      password: quickPass.value || '',
      name: host
    }, 'sftp');
  });

  btnOpenFull.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openApp' });
  });

  btnManageServers.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openApp', params: { tab: 'servers' } });
  });

  btnSettings.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openApp', params: { tab: 'settings' } });
  });

  loadServers();
});
