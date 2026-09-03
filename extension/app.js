/**
 * LiveKadeh SSH & SFTP Dashboard Main Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Global elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewPanels = document.querySelectorAll('.view-panel');
  const globalStatusDot = document.getElementById('globalStatusDot');
  const globalServerName = document.getElementById('globalServerName');
  const btnConnectModal = document.getElementById('btnConnectModal');
  const connectModal = document.getElementById('connectModal');
  const btnCloseConnectModal = document.getElementById('btnCloseConnectModal');

  // Terminal elements
  const terminalTabsList = document.getElementById('terminalTabsList');
  const xtermWrapper = document.getElementById('xtermWrapper');
  const btnNewTerminalTab = document.getElementById('btnNewTerminalTab');
  const btnTermReconnect = document.getElementById('btnTermReconnect');
  const btnTermClear = document.getElementById('btnTermClear');
  const btnFontPlus = document.getElementById('btnFontPlus');
  const btnFontMinus = document.getElementById('btnFontMinus');

  // SFTP elements
  const sftpTableBody = document.getElementById('sftpTableBody');
  const sftpCurrentPath = document.getElementById('sftpCurrentPath');
  const sftpSelectedInfo = document.getElementById('sftpSelectedInfo');
  const sftpItemCount = document.getElementById('sftpItemCount');
  const btnSftpUp = document.getElementById('btnSftpUp');
  const btnSftpRefresh = document.getElementById('btnSftpRefresh');
  const btnGoPath = document.getElementById('btnGoPath');
  const sftpSearchInput = document.getElementById('sftpSearchInput');
  const sftpFileInput = document.getElementById('sftpFileInput');
  const sftpDropZone = document.getElementById('sftpDropZone');
  const dragDropOverlay = document.getElementById('dragDropOverlay');
  const btnSftpNewFile = document.getElementById('btnSftpNewFile');
  const btnSftpNewFolder = document.getElementById('btnSftpNewFolder');
  const btnSftpDownload = document.getElementById('btnSftpDownload');
  const btnSftpEdit = document.getElementById('btnSftpEdit');
  const btnSftpChmod = document.getElementById('btnSftpChmod');
  const btnSftpDelete = document.getElementById('btnSftpDelete');
  const btnEditorSave = document.getElementById('btnEditorSave');
  const btnCloseEditorModal = document.getElementById('btnCloseEditorModal');
  const editorModal = document.getElementById('editorModal');

  // Servers elements
  const serversGrid = document.getElementById('serversGrid');
  const btnAddServerCard = document.getElementById('btnAddServerCard');
  const btnExportServers = document.getElementById('btnExportServers');
  const btnImportServers = document.getElementById('btnImportServers');

  // Settings elements
  const settingBridgeUrl = document.getElementById('settingBridgeUrl');
  const settingFontFamily = document.getElementById('settingFontFamily');
  const settingFontSize = document.getElementById('settingFontSize');
  const settingTerminalTheme = document.getElementById('settingTerminalTheme');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnTestBridge = document.getElementById('btnTestBridge');
  const bridgeTestResult = document.getElementById('bridgeTestResult');

  // Connect form elements
  const connectForm = document.getElementById('connectForm');
  const modalTitle = document.getElementById('modalTitle');
  const modalServerId = document.getElementById('modalServerId');
  const serverName = document.getElementById('serverName');
  const serverHost = document.getElementById('serverHost');
  const serverPort = document.getElementById('serverPort');
  const serverUser = document.getElementById('serverUser');
  const serverColor = document.getElementById('serverColor');
  const serverAuthType = document.getElementById('serverAuthType');
  const serverPass = document.getElementById('serverPass');
  const serverPrivateKey = document.getElementById('serverPrivateKey');
  const passAuthRow = document.getElementById('passAuthRow');
  const keyAuthRow = document.getElementById('keyAuthRow');
  const saveServerCheck = document.getElementById('saveServerCheck');
  const btnLaunchSSH = document.getElementById('btnLaunchSSH');
  const btnLaunchSFTP = document.getElementById('btnLaunchSFTP');

  // Instantiate Managers
  const termManager = new SSHTerminalManager(xtermWrapper, terminalTabsList);
  const sftpManager = new SFTPManager(sftpTableBody, sftpCurrentPath, sftpSelectedInfo, sftpItemCount);

  // Global Connection Callback
  window.onGlobalConnectionChange = (status, name) => {
    globalStatusDot.className = 'status-indicator ' + status;
    globalServerName.textContent = name || 'اتصال برقرار نیست';
  };

  // Switch Navigation Tabs
  function switchView(viewName) {
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.view === viewName));
    viewPanels.forEach(p => p.classList.toggle('active', p.id === `view${viewName.toUpperCase()}` || p.id.toLowerCase() === `view${viewName.toLowerCase()}`));
    
    if (viewName === 'ssh') {
      termManager.fitActive();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  document.querySelectorAll('.btn-open-connect').forEach(btn => {
    btn.addEventListener('click', () => openConnectModal());
  });

  // Modal handlers
  function openConnectModal(serverData = null) {
    if (serverData) {
      modalTitle.textContent = 'ویرایش سرور';
      modalServerId.value = serverData.id || '';
      serverName.value = serverData.name || '';
      serverHost.value = serverData.host || '';
      serverPort.value = serverData.port || 22;
      serverUser.value = serverData.username || 'root';
      serverColor.value = serverData.color || '#00f0ff';
      serverAuthType.value = serverData.authType || 'password';
      serverPass.value = serverData.password || '';
      serverPrivateKey.value = serverData.privateKey || '';
    } else {
      modalTitle.textContent = 'اتصال به سرور جدید';
      modalServerId.value = '';
      serverName.value = '';
      serverHost.value = '';
      serverPort.value = 22;
      serverUser.value = 'root';
      serverColor.value = '#00f0ff';
      serverAuthType.value = 'password';
      serverPass.value = '';
      serverPrivateKey.value = '';
    }
    toggleAuthFields();
    connectModal.classList.add('active');
  }

  function closeConnectModal() {
    connectModal.classList.remove('active');
  }

  function toggleAuthFields() {
    if (serverAuthType.value === 'password') {
      passAuthRow.style.display = 'flex';
      keyAuthRow.style.display = 'none';
    } else {
      passAuthRow.style.display = 'none';
      keyAuthRow.style.display = 'flex';
    }
  }

  serverAuthType.addEventListener('change', toggleAuthFields);
  btnConnectModal.addEventListener('click', () => openConnectModal());
  btnCloseConnectModal.addEventListener('click', closeConnectModal);
  btnAddServerCard.addEventListener('click', () => openConnectModal());

  // Connect form launch SSH & SFTP
  async function getFormDataAndSave() {
    const host = serverHost.value.trim();
    if (!host) {
      alert('لطفاً آدرس سرور را وارد نمایید.');
      serverHost.focus();
      return null;
    }

    const srv = {
      id: modalServerId.value || 'srv-' + Date.now(),
      name: serverName.value.trim() || `${serverUser.value}@${host}`,
      host: host,
      port: parseInt(serverPort.value, 10) || 22,
      username: serverUser.value.trim() || 'root',
      color: serverColor.value || '#00f0ff',
      authType: serverAuthType.value,
      password: serverPass.value,
      privateKey: serverPrivateKey.value,
      defaultPath: '/root',
      updatedAt: Date.now()
    };

    if (saveServerCheck.checked) {
      const { servers = [] } = await chrome.storage.local.get('servers');
      const idx = servers.findIndex(s => s.id === srv.id);
      if (idx >= 0) {
        servers[idx] = srv;
      } else {
        servers.push(srv);
      }
      await chrome.storage.local.set({ servers });
      loadServersList();
    }

    return srv;
  }

  btnLaunchSSH.addEventListener('click', async () => {
    const srv = await getFormDataAndSave();
    if (!srv) return;
    closeConnectModal();
    const { bridgeUrl = 'ws://localhost:3000/ws' } = await chrome.storage.local.get('bridgeUrl');
    switchView('ssh');
    termManager.createSession(srv, bridgeUrl);
  });

  btnLaunchSFTP.addEventListener('click', async () => {
    const srv = await getFormDataAndSave();
    if (!srv) return;
    closeConnectModal();
    const { bridgeUrl = 'ws://localhost:3000/ws' } = await chrome.storage.local.get('bridgeUrl');
    switchView('sftp');
    sftpManager.connect(srv, bridgeUrl, () => {
      window.onGlobalConnectionChange('connected', srv.name);
    });
  });

  // Terminal Controls
  btnNewTerminalTab.addEventListener('click', () => openConnectModal());
  btnTermReconnect.addEventListener('click', () => termManager.reconnectActive());
  btnTermClear.addEventListener('click', () => termManager.clearActive());
  btnFontPlus.addEventListener('click', () => termManager.changeFontSize(1));
  btnFontMinus.addEventListener('click', () => termManager.changeFontSize(-1));

  // SFTP Navigation Controls
  btnSftpUp.addEventListener('click', () => {
    let p = sftpManager.currentPath.replace(/\/$/, '');
    const lastSlash = p.lastIndexOf('/');
    const parentPath = lastSlash <= 0 ? '/' : p.substring(0, lastSlash);
    sftpManager.listDirectory(parentPath);
  });

  btnSftpRefresh.addEventListener('click', () => sftpManager.listDirectory(sftpManager.currentPath));

  btnGoPath.addEventListener('click', () => {
    const target = sftpCurrentPath.value.trim();
    if (target) sftpManager.listDirectory(target);
  });

  sftpCurrentPath.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const target = sftpCurrentPath.value.trim();
      if (target) sftpManager.listDirectory(target);
    }
  });

  document.querySelectorAll('.quick-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.path;
      if (p) sftpManager.listDirectory(p);
    });
  });

  // SFTP Search Filter
  sftpSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = sftpManager.currentFiles.filter(f => f.filename.toLowerCase().includes(q));
    sftpManager.renderFiles(filtered);
  });

  // SFTP File Uploads
  sftpFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      sftpManager.uploadFiles(e.target.files);
      sftpFileInput.value = '';
    }
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(name => {
    sftpDropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dragDropOverlay.style.display = 'flex';
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    sftpDropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dragDropOverlay.style.display = 'none';
    });
  });

  sftpDropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      sftpManager.uploadFiles(e.dataTransfer.files);
    }
  });

  // SFTP Action Toolbar
  btnSftpNewFile.addEventListener('click', () => sftpManager.createNewFile());
  btnSftpNewFolder.addEventListener('click', () => sftpManager.createNewFolder());
  btnSftpDownload.addEventListener('click', () => {
    sftpManager.selectedFiles.forEach(f => sftpManager.downloadFile(f));
  });
  btnSftpEdit.addEventListener('click', () => {
    if (sftpManager.selectedFiles.size === 1) {
      sftpManager.editFile(Array.from(sftpManager.selectedFiles)[0]);
    }
  });
  btnSftpChmod.addEventListener('click', () => sftpManager.changePermissions());
  btnSftpDelete.addEventListener('click', () => {
    sftpManager.selectedFiles.forEach(f => {
      const item = sftpManager.currentFiles.find(x => x.filename === f);
      sftpManager.deleteItem(f, item ? item.attrs.isDirectory : false);
    });
  });

  // Editor Modal
  btnEditorSave.addEventListener('click', () => sftpManager.saveEditedFile());
  btnCloseEditorModal.addEventListener('click', () => editorModal.classList.remove('active'));

  // Keyboard shortcut for Editor Save (Ctrl+S)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (editorModal.classList.contains('active')) {
        e.preventDefault();
        sftpManager.saveEditedFile();
      }
    }
  });

  // Servers View Loading
  async function loadServersList() {
    const { servers = [] } = await chrome.storage.local.get('servers');
    serversGrid.innerHTML = '';

    if (servers.length === 0) {
      serversGrid.innerHTML = '<div style="color: #64748b; padding: 20px; grid-column: 1/-1; text-align: center;">هیچ سروری ذخیره نشده است. با کلیک بر روی «سرور جدید +» اولین سرور خود را اضافه کنید.</div>';
      return;
    }

    servers.forEach(srv => {
      const card = document.createElement('div');
      card.className = 'server-card';
      card.style.setProperty('--server-color', srv.color || '#00f0ff');

      card.innerHTML = `
        <div class="server-card-top">
          <div class="card-title-group">
            <h4>${srv.name}</h4>
            <div class="card-host">${srv.username}@${srv.host}:${srv.port || 22}</div>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon-sm btn-edit-srv" title="ویرایش">✏️</button>
            <button class="btn-icon-sm btn-del-srv" title="حذف" style="color: #ef4444;">🗑️</button>
          </div>
        </div>
        <div class="server-card-actions">
          <button class="btn btn-sm btn-cyan btn-connect-ssh-card" style="flex: 1;">⚡ ترمینال SSH</button>
          <button class="btn btn-sm btn-secondary btn-connect-sftp-card" style="flex: 1;">📁 فایل منیجر SFTP</button>
        </div>
      `;

      card.querySelector('.btn-edit-srv').addEventListener('click', () => openConnectModal(srv));
      card.querySelector('.btn-del-srv').addEventListener('click', async () => {
        if (confirm(`آیا از حذف سرور "${srv.name}" اطمینان دارید؟`)) {
          const { servers: cur = [] } = await chrome.storage.local.get('servers');
          const updated = cur.filter(s => s.id !== srv.id);
          await chrome.storage.local.set({ servers: updated });
          loadServersList();
        }
      });

      card.querySelector('.btn-connect-ssh-card').addEventListener('click', async () => {
        const { bridgeUrl = 'ws://localhost:3000/ws' } = await chrome.storage.local.get('bridgeUrl');
        switchView('ssh');
        termManager.createSession(srv, bridgeUrl);
      });

      card.querySelector('.btn-connect-sftp-card').addEventListener('click', async () => {
        const { bridgeUrl = 'ws://localhost:3000/ws' } = await chrome.storage.local.get('bridgeUrl');
        switchView('sftp');
        sftpManager.connect(srv, bridgeUrl, () => {
          window.onGlobalConnectionChange('connected', srv.name);
        });
      });

      serversGrid.appendChild(card);
    });
  }

  // Export / Import
  btnExportServers.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['servers', 'bridgeUrl']);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livekadeh-servers-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnImportServers.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const json = JSON.parse(reader.result);
          if (json.servers) {
            await chrome.storage.local.set({ servers: json.servers });
            if (json.bridgeUrl) await chrome.storage.local.set({ bridgeUrl: json.bridgeUrl });
            alert('اطلاعات با موفقیت بازیابی شد ✔');
            loadServersList();
          }
        } catch (err) {
          alert('فایل وارد شده معتبر نمی‌باشد: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Settings Loading & Saving
  async function loadSettings() {
    const data = await chrome.storage.local.get(['bridgeUrl', 'fontFamily', 'fontSize', 'terminalTheme']);
    if (data.bridgeUrl) settingBridgeUrl.value = data.bridgeUrl;
    if (data.fontFamily) settingFontFamily.value = data.fontFamily;
    if (data.fontSize) settingFontSize.value = data.fontSize;
    if (data.terminalTheme) settingTerminalTheme.value = data.terminalTheme;
  }

  btnSaveSettings.addEventListener('click', async () => {
    const bridgeUrl = settingBridgeUrl.value.trim();
    const fontFamily = settingFontFamily.value;
    const fontSize = parseInt(settingFontSize.value, 10) || 14;
    const terminalTheme = settingTerminalTheme.value;

    await chrome.storage.local.set({ bridgeUrl, fontFamily, fontSize, terminalTheme });
    termManager.fontFamily = fontFamily;
    termManager.fontSize = fontSize;
    termManager.themeName = terminalTheme;

    alert('تنظیمات با موفقیت ذخیره گردید ✔');
  });

  btnTestBridge.addEventListener('click', () => {
    const url = settingBridgeUrl.value.trim();
    bridgeTestResult.textContent = 'در حال تست...';
    bridgeTestResult.style.color = '#f59e0b';

    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        bridgeTestResult.textContent = 'خطا: عدم پاسخگویی در مدت زمان تعیین شده';
        bridgeTestResult.style.color = '#ef4444';
        try { ws.close(); } catch (e) {}
      }, 4000);

      ws.onopen = () => {
        clearTimeout(timer);
        bridgeTestResult.textContent = 'ارتباط با موفقیت برقرار شد 🚀';
        bridgeTestResult.style.color = '#00ff9d';
        ws.close();
      };

      ws.onerror = (e) => {
        clearTimeout(timer);
        bridgeTestResult.textContent = 'خطا در برقراری ارتباط با وب‌سوکت';
        bridgeTestResult.style.color = '#ef4444';
      };
    } catch (e) {
      bridgeTestResult.textContent = 'خطا: ' + e.message;
      bridgeTestResult.style.color = '#ef4444';
    }
  });

  // URL Parameters Auto-connect
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const host = urlParams.get('host');
  const targetTab = urlParams.get('tab');

  if (targetTab) {
    switchView(targetTab);
  }

  if (host) {
    const { bridgeUrl = 'ws://localhost:3000/ws' } = await chrome.storage.local.get('bridgeUrl');
    const srv = {
      host,
      port: parseInt(urlParams.get('port') || 22, 10),
      username: urlParams.get('username') || 'root',
      password: urlParams.get('password') || '',
      name: urlParams.get('name') || host
    };

    if (mode === 'sftp') {
      switchView('sftp');
      sftpManager.connect(srv, bridgeUrl, () => {
        window.onGlobalConnectionChange('connected', srv.name);
      });
    } else {
      switchView('ssh');
      termManager.createSession(srv, bridgeUrl);
    }
  }

  // Initial loads
  await loadSettings();
  await loadServersList();
});
