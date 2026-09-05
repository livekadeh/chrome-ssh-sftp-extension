/**
 * LiveKadeh SSH & SFTP Dashboard Main Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n (default: English)
  if (window.i18n) {
    await window.i18n.init();
  }

  // Global elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewPanels = document.querySelectorAll('.view-panel');
  const globalStatusDot = document.getElementById('globalStatusDot');
  const globalServerName = document.getElementById('globalServerName');
  const btnConnectModal = document.getElementById('btnConnectModal');
  const connectModal = document.getElementById('connectModal');
  const btnCloseConnectModal = document.getElementById('btnCloseConnectModal');
  const btnLangToggle = document.getElementById('btnLangToggle');
  const settingLanguage = document.getElementById('settingLanguage');

  const onLanguageChanged = () => {
    loadServersList();
    if (sftpManager && sftpManager.currentFiles && sftpManager.currentFiles.length > 0) {
      sftpManager.updateSortHeaders();
      sftpManager.renderFiles(sftpManager.currentFiles);
    }
  };

  if (settingLanguage && window.i18n) {
    settingLanguage.value = window.i18n.currentLang;
    settingLanguage.addEventListener('change', async () => {
      await window.i18n.setLanguage(settingLanguage.value);
      onLanguageChanged();
    });
  }

  if (btnLangToggle && window.i18n) {
    btnLangToggle.addEventListener('click', async () => {
      const nextLang = await window.i18n.toggleLanguage();
      if (settingLanguage) settingLanguage.value = nextLang;
      onLanguageChanged();
    });
  }

  // Standalone App Window Pop-out
  function launchStandaloneWindow() {
    if (chrome && chrome.windows) {
      chrome.windows.create({
        url: window.location.href,
        type: 'popup',
        width: Math.min(1400, Math.max(1024, window.screen.availWidth - 100)),
        height: Math.min(900, Math.max(700, window.screen.availHeight - 100)),
        focused: true
      }, () => {
        window.close();
      });
    }
  }

  const btnPopoutWindow = document.getElementById('btnPopoutWindow');
  if (btnPopoutWindow) {
    btnPopoutWindow.addEventListener('click', launchStandaloneWindow);
  }

  const btnAboutLaunchWindow = document.getElementById('btnAboutLaunchWindow');
  if (btnAboutLaunchWindow) {
    btnAboutLaunchWindow.addEventListener('click', launchStandaloneWindow);
  }

  // Hide popout button if already in a standalone window
  if (chrome && chrome.windows) {
    chrome.windows.getCurrent((win) => {
      if (win && win.type === 'popup') {
        if (btnPopoutWindow) btnPopoutWindow.style.display = 'none';
      }
    });
  }

  // Terminal elements
  const terminalTabsList = document.getElementById('terminalTabsList');
  const xtermWrapper = document.getElementById('xtermWrapper');
  const btnNewTerminalTab = document.getElementById('btnNewTerminalTab');
  const btnToggleRtl = document.getElementById('btnToggleRtl');
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
  const sftpGridView = document.getElementById('sftpGridView');
  const termManager = new SSHTerminalManager(xtermWrapper, terminalTabsList);
  const sftpManager = new SFTPManager(sftpTableBody, sftpCurrentPath, sftpSelectedInfo, sftpItemCount, sftpGridView);

  // Global Connection Callback
  window.onGlobalConnectionChange = (status, name) => {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    globalStatusDot.className = 'status-indicator ' + status;
    globalServerName.textContent = name || (isPersian ? 'اتصال برقرار نیست' : 'Not Connected');
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
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (serverData) {
      modalTitle.textContent = isPersian ? 'ویرایش سرور' : 'Edit Server';
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
      modalTitle.textContent = isPersian ? 'اتصال به سرور جدید' : 'New Server Connection';
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
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (!host) {
      alert(isPersian ? 'لطفاً آدرس سرور را وارد نمایید.' : 'Please enter a server host address.');
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
  if (btnToggleRtl) {
    btnToggleRtl.addEventListener('click', () => {
      const isRtl = termManager.toggleRtl();
      btnToggleRtl.classList.toggle('active-rtl', isRtl);
      btnToggleRtl.style.borderColor = isRtl ? '#00f0ff' : 'var(--border-glass)';
      btnToggleRtl.style.color = isRtl ? '#00f0ff' : 'var(--text-muted)';
    });
  }
  btnTermReconnect.addEventListener('click', () => termManager.reconnectActive());
  btnTermClear.addEventListener('click', () => termManager.clearActive());
  btnFontPlus.addEventListener('click', () => termManager.changeFontSize(1));
  btnFontMinus.addEventListener('click', () => termManager.changeFontSize(-1));

  // Persian Terminal Input Helper
  const terminalPersianInput = document.getElementById('terminalPersianInput');
  const btnSendPersianInput = document.getElementById('btnSendPersianInput');
  const commandHistory = [];
  let historyIndex = -1;

  function sendPersianCommand() {
    if (!terminalPersianInput) return;
    const text = terminalPersianInput.value;
    if (!text && text !== '') return;

    termManager.sendData(text + '\r');
    if (text.trim()) {
      commandHistory.push(text);
      historyIndex = commandHistory.length;
    }
    terminalPersianInput.value = '';
  }

  if (btnSendPersianInput) {
    btnSendPersianInput.addEventListener('click', sendPersianCommand);
  }

  if (terminalPersianInput) {
    terminalPersianInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendPersianCommand();
      } else if (e.key === 'ArrowUp') {
        if (historyIndex > 0) {
          historyIndex--;
          terminalPersianInput.value = commandHistory[historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          terminalPersianInput.value = commandHistory[historyIndex];
        } else {
          historyIndex = commandHistory.length;
          terminalPersianInput.value = '';
        }
      }
    });
  }

  // Terminal Context Menu (Right-Click Copy / Paste)
  const terminalContextMenu = document.getElementById('terminalContextMenu');
  const ctxCopy = document.getElementById('ctxCopy');
  const ctxPaste = document.getElementById('ctxPaste');
  const ctxSelectAll = document.getElementById('ctxSelectAll');
  const ctxClear = document.getElementById('ctxClear');

  window.showTerminalContextMenu = (e, session) => {
    if (!terminalContextMenu) return;

    const hasSel = session && session.term && session.term.hasSelection();
    if (ctxCopy) {
      if (hasSel) {
        ctxCopy.classList.remove('disabled');
      } else {
        ctxCopy.classList.add('disabled');
      }
    }

    terminalContextMenu.style.display = 'block';
    const menuWidth = terminalContextMenu.offsetWidth || 200;
    const menuHeight = terminalContextMenu.offsetHeight || 150;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    terminalContextMenu.style.left = `${Math.max(10, x)}px`;
    terminalContextMenu.style.top = `${Math.max(10, y)}px`;
  };

  function hideTerminalContextMenu() {
    if (terminalContextMenu) {
      terminalContextMenu.style.display = 'none';
    }
  }

  document.addEventListener('click', hideTerminalContextMenu);
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.xterm') && !e.target.closest('#terminalContainer')) {
      hideTerminalContextMenu();
    }
  });

  if (ctxCopy) {
    ctxCopy.addEventListener('click', () => {
      termManager.copySelection();
      hideTerminalContextMenu();
    });
  }

  if (ctxPaste) {
    ctxPaste.addEventListener('click', async () => {
      await termManager.pasteFromClipboard();
      hideTerminalContextMenu();
    });
  }

  if (ctxSelectAll) {
    ctxSelectAll.addEventListener('click', () => {
      termManager.selectAllActive();
      hideTerminalContextMenu();
    });
  }

  if (ctxClear) {
    ctxClear.addEventListener('click', () => {
      termManager.clearActive();
      hideTerminalContextMenu();
    });
  }

  // Keyboard shortcuts: Ctrl+Shift+C / Ctrl+Shift+V
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      if (termManager.hasSelection()) {
        e.preventDefault();
        termManager.copySelection();
      }
    } else if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
      const activeTerm = document.querySelector('#viewTerminal.active');
      if (activeTerm) {
        e.preventDefault();
        await termManager.pasteFromClipboard();
      }
    }
  });

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

  const btnCancelUpload = document.getElementById('btnCancelUpload');
  if (btnCancelUpload) {
    btnCancelUpload.addEventListener('click', () => sftpManager.cancelUpload());
  }

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
  const btnSftpOpenWith = document.getElementById('btnSftpOpenWith');
  if (btnSftpOpenWith) {
    btnSftpOpenWith.addEventListener('click', () => {
      sftpManager.openWith();
    });
  }
  const btnSftpExtract = document.getElementById('btnSftpExtract');
  if (btnSftpExtract) {
    btnSftpExtract.addEventListener('click', () => {
      if (sftpManager.selectedFiles.size > 0) {
        sftpManager.extractArchive(Array.from(sftpManager.selectedFiles)[0]);
      }
    });
  }
  const btnSftpCompress = document.getElementById('btnSftpCompress');
  if (btnSftpCompress) {
    btnSftpCompress.addEventListener('click', () => {
      sftpManager.compressSelected('zip');
    });
  }
  const btnSftpPreview = document.getElementById('btnSftpPreview');
  if (btnSftpPreview) {
    btnSftpPreview.addEventListener('click', () => {
      const selected = Array.from(sftpManager.selectedFiles);
      if (selected.length === 1) {
        sftpManager.previewMedia(selected[0]);
      }
    });
  }
  const btnSftpViewList = document.getElementById('btnSftpViewList');
  const btnSftpViewGrid = document.getElementById('btnSftpViewGrid');
  if (btnSftpViewList) {
    btnSftpViewList.addEventListener('click', () => {
      sftpManager.setViewMode('list');
    });
  }
  if (btnSftpViewGrid) {
    btnSftpViewGrid.addEventListener('click', () => {
      sftpManager.setViewMode('grid');
    });
  }
  btnSftpChmod.addEventListener('click', () => sftpManager.changePermissions());
  btnSftpDelete.addEventListener('click', () => {
    sftpManager.deleteSelected();
  });

  // ================= SFTP CONTEXT MENU =================
  const sftpContextMenu = document.getElementById('sftpContextMenu');
  const sftpCtxOpen = document.getElementById('sftpCtxOpen');
  const sftpCtxDownload = document.getElementById('sftpCtxDownload');
  const sftpCtxOpenWith = document.getElementById('sftpCtxOpenWith');
  const sftpCtxPreview = document.getElementById('sftpCtxPreview');
  const sftpCtxEdit = document.getElementById('sftpCtxEdit');
  const sftpCtxExtract = document.getElementById('sftpCtxExtract');
  const sftpCtxCompress = document.getElementById('sftpCtxCompress');
  const sftpCtxRename = document.getElementById('sftpCtxRename');
  const sftpCtxChmod = document.getElementById('sftpCtxChmod');
  const sftpCtxInfo = document.getElementById('sftpCtxInfo');
  const sftpCtxCopyPath = document.getElementById('sftpCtxCopyPath');
  const sftpCtxDelete = document.getElementById('sftpCtxDelete');
  const sftpCtxDivider = document.getElementById('sftpCtxDivider');
  const sftpCtxDirInfo = document.getElementById('sftpCtxDirInfo');
  const sftpCtxUpload = document.getElementById('sftpCtxUpload');
  const sftpCtxNewFolder = document.getElementById('sftpCtxNewFolder');
  const sftpCtxNewFile = document.getElementById('sftpCtxNewFile');
  const sftpCtxCopyDir = document.getElementById('sftpCtxCopyDir');
  const sftpCtxParentDir = document.getElementById('sftpCtxParentDir');
  const sftpCtxRefresh = document.getElementById('sftpCtxRefresh');

  let sftpContextTarget = null;

  window.showSftpContextMenu = (x, y, target) => {
    if (!sftpContextMenu) return;
    sftpContextTarget = target;

    const isRow = target && target.isRow;
    const isDir = target && target.isDir;
    const isArchive = !isDir && target && target.filename && sftpManager.isArchiveFile(target.filename);
    const isMedia = !isDir && target && target.filename && !!sftpManager.isMediaFile(target.filename);

    if (isRow) {
      if (sftpCtxOpen) sftpCtxOpen.style.display = isDir ? 'flex' : 'none';
      if (sftpCtxDownload) {
        sftpCtxDownload.style.display = 'flex';
        const isPersian = window.i18n && window.i18n.currentLang === 'fa';
        const dlLabel = sftpCtxDownload.querySelector('.ctx-label');
        if (dlLabel) {
          if (isDir) {
            dlLabel.textContent = isPersian ? 'دانلود پوشه (Zip)' : 'Download Folder (Zip)';
          } else {
            dlLabel.textContent = isPersian ? 'دانلود' : 'Download';
          }
        }
      }
      if (sftpCtxOpenWith) sftpCtxOpenWith.style.display = isDir ? 'none' : 'flex';
      if (sftpCtxPreview) sftpCtxPreview.style.display = isMedia ? 'flex' : 'none';
      if (sftpCtxEdit) sftpCtxEdit.style.display = isDir ? 'none' : 'flex';
      if (sftpCtxExtract) sftpCtxExtract.style.display = isArchive ? 'flex' : 'none';
      if (sftpCtxCompress) sftpCtxCompress.style.display = 'flex';
      if (sftpCtxRename) sftpCtxRename.style.display = 'flex';
      if (sftpCtxChmod) sftpCtxChmod.style.display = 'flex';
      if (sftpCtxInfo) sftpCtxInfo.style.display = 'flex';
      if (sftpCtxCopyPath) sftpCtxCopyPath.style.display = 'flex';
      if (sftpCtxDelete) {
        sftpCtxDelete.style.display = 'flex';
        const isPersian = window.i18n && window.i18n.currentLang === 'fa';
        const lbl = sftpCtxDelete.querySelector('.ctx-label');
        if (lbl) {
          const count = sftpManager.selectedFiles.size;
          if (count > 1) {
            lbl.textContent = isPersian ? `حذف همه (${count} مورد)` : `Delete All (${count} items)`;
          } else {
            lbl.textContent = isPersian ? 'حذف' : 'Delete';
          }
        }
      }
      if (sftpCtxDivider) sftpCtxDivider.style.display = 'block';
      if (sftpCtxDirInfo) sftpCtxDirInfo.style.display = 'none';
    } else {
      if (sftpCtxOpen) sftpCtxOpen.style.display = 'none';
      if (sftpCtxDownload) sftpCtxDownload.style.display = 'none';
      if (sftpCtxOpenWith) sftpCtxOpenWith.style.display = 'none';
      if (sftpCtxPreview) sftpCtxPreview.style.display = 'none';
      if (sftpCtxEdit) sftpCtxEdit.style.display = 'none';
      if (sftpCtxExtract) sftpCtxExtract.style.display = 'none';
      if (sftpCtxCompress) sftpCtxCompress.style.display = sftpManager.selectedFiles.size > 0 ? 'flex' : 'none';
      if (sftpCtxRename) sftpCtxRename.style.display = 'none';
      if (sftpCtxChmod) sftpCtxChmod.style.display = 'none';
      if (sftpCtxInfo) sftpCtxInfo.style.display = 'none';
      if (sftpCtxCopyPath) sftpCtxCopyPath.style.display = 'none';
      if (sftpCtxDelete) sftpCtxDelete.style.display = 'none';
      if (sftpCtxDivider) sftpCtxDivider.style.display = 'none';
      if (sftpCtxDirInfo) sftpCtxDirInfo.style.display = 'flex';
    }

    sftpContextMenu.style.display = 'block';
    const menuWidth = sftpContextMenu.offsetWidth || 210;
    const menuHeight = sftpContextMenu.offsetHeight || 300;

    let posX = x;
    let posY = y;
    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    sftpContextMenu.style.left = `${Math.max(10, posX)}px`;
    sftpContextMenu.style.top = `${Math.max(10, posY)}px`;
  };

  function hideSftpContextMenu() {
    if (sftpContextMenu) {
      sftpContextMenu.style.display = 'none';
    }
  }

  document.addEventListener('click', hideSftpContextMenu);
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('#viewSFTP')) {
      hideSftpContextMenu();
    }
  });

  if (sftpDropZone) {
    sftpDropZone.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.sftp-row') && !e.target.closest('.sftp-grid-card')) {
        e.preventDefault();
        window.showSftpContextMenu(e.clientX, e.clientY, {
          filename: null,
          isDir: false,
          isRow: false
        });
      }
    });
  }

  if (sftpCtxOpen) {
    sftpCtxOpen.addEventListener('click', () => {
      hideSftpContextMenu();
      if (sftpContextTarget && sftpContextTarget.filename) {
        const next = sftpManager.currentPath.endsWith('/') 
          ? sftpManager.currentPath + sftpContextTarget.filename 
          : sftpManager.currentPath + '/' + sftpContextTarget.filename;
        sftpManager.listDirectory(next);
      }
    });
  }

  if (sftpCtxDownload) {
    sftpCtxDownload.addEventListener('click', () => {
      hideSftpContextMenu();
      if (sftpContextTarget && sftpContextTarget.filename) {
        sftpManager.downloadFile(sftpContextTarget.filename, sftpContextTarget.isDir);
      }
    });
  }

  if (sftpCtxOpenWith) {
    sftpCtxOpenWith.addEventListener('click', () => {
      hideSftpContextMenu();
      const targetName = sftpContextTarget ? sftpContextTarget.filename : Array.from(sftpManager.selectedFiles)[0];
      if (targetName) {
        sftpManager.openWith(targetName);
      }
    });
  }

  if (sftpCtxPreview) {
    sftpCtxPreview.addEventListener('click', () => {
      hideSftpContextMenu();
      const filename = sftpContextTarget ? sftpContextTarget.filename : Array.from(sftpManager.selectedFiles)[0];
      if (filename) {
        sftpManager.previewMedia(filename);
      }
    });
  }

  if (sftpCtxEdit) {
    sftpCtxEdit.addEventListener('click', () => {
      hideSftpContextMenu();
      if (sftpContextTarget && sftpContextTarget.filename) {
        sftpManager.editFile(sftpContextTarget.filename);
      }
    });
  }

  if (sftpCtxExtract) {
    sftpCtxExtract.addEventListener('click', () => {
      hideSftpContextMenu();
      if (sftpContextTarget && sftpContextTarget.filename) {
        sftpManager.extractArchive(sftpContextTarget.filename);
      }
    });
  }

  if (sftpCtxCompress) {
    sftpCtxCompress.addEventListener('click', () => {
      hideSftpContextMenu();
      sftpManager.compressSelected('zip');
    });
  }

  if (sftpCtxRename) {
    sftpCtxRename.addEventListener('click', () => {
      hideSftpContextMenu();
      const targetName = sftpContextTarget ? sftpContextTarget.filename : null;
      sftpManager.renameItem(targetName);
    });
  }

  if (sftpCtxChmod) {
    sftpCtxChmod.addEventListener('click', () => {
      hideSftpContextMenu();
      const targetName = sftpContextTarget ? sftpContextTarget.filename : null;
      sftpManager.changePermissions(targetName);
    });
  }

  if (sftpCtxInfo) {
    sftpCtxInfo.addEventListener('click', () => {
      hideSftpContextMenu();
      const targetName = sftpContextTarget ? sftpContextTarget.filename : null;
      const targetIsDir = sftpContextTarget ? sftpContextTarget.isDir : false;
      sftpManager.showInformation(targetName, targetIsDir);
    });
  }

  if (sftpCtxDirInfo) {
    sftpCtxDirInfo.addEventListener('click', () => {
      hideSftpContextMenu();
      sftpManager.showInformation(null, true);
    });
  }

  if (sftpCtxCopyPath) {
    sftpCtxCopyPath.addEventListener('click', () => {
      hideSftpContextMenu();
      const targetName = sftpContextTarget ? sftpContextTarget.filename : null;
      sftpManager.copyItemPath(targetName);
    });
  }

  if (sftpCtxDelete) {
    sftpCtxDelete.addEventListener('click', () => {
      hideSftpContextMenu();
      if (sftpManager.selectedFiles.size > 1) {
        sftpManager.deleteSelected();
      } else if (sftpContextTarget && sftpContextTarget.filename) {
        sftpManager.deleteItem(sftpContextTarget.filename, sftpContextTarget.isDir);
      } else {
        sftpManager.deleteSelected();
      }
    });
  }

  if (sftpCtxUpload) {
    sftpCtxUpload.addEventListener('click', () => {
      hideSftpContextMenu();
      if (sftpFileInput) sftpFileInput.click();
    });
  }

  if (sftpCtxNewFolder) {
    sftpCtxNewFolder.addEventListener('click', () => {
      hideSftpContextMenu();
      sftpManager.createNewFolder();
    });
  }

  if (sftpCtxNewFile) {
    sftpCtxNewFile.addEventListener('click', () => {
      hideSftpContextMenu();
      sftpManager.createNewFile();
    });
  }

  if (sftpCtxCopyDir) {
    sftpCtxCopyDir.addEventListener('click', () => {
      hideSftpContextMenu();
      sftpManager.copyCurrentPath();
    });
  }

  if (sftpCtxParentDir) {
    sftpCtxParentDir.addEventListener('click', () => {
      hideSftpContextMenu();
      btnSftpUp.click();
    });
  }

  if (sftpCtxRefresh) {
    sftpCtxRefresh.addEventListener('click', () => {
      hideSftpContextMenu();
      sftpManager.listDirectory(sftpManager.currentPath);
    });
  }

  // Keyboard shortcuts in SFTP view (F2: Rename, Delete: Delete, Alt+I: Info)
  window.addEventListener('keydown', (e) => {
    const sftpActive = document.querySelector('.nav-tab[data-view="sftp"].active');
    if (!sftpActive) return;
    if (editorModal && editorModal.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'F2') {
      e.preventDefault();
      sftpManager.renameItem();
    } else if (e.key === 'Delete' || e.key === 'Del') {
      e.preventDefault();
      btnSftpDelete.click();
    } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      const targetName = sftpManager.selectedFiles.size > 0 ? Array.from(sftpManager.selectedFiles)[0] : null;
      sftpManager.showInformation(targetName);
    }
  });

  // Editor Modal
  btnEditorSave.addEventListener('click', () => sftpManager.saveEditedFile());
  btnCloseEditorModal.addEventListener('click', () => editorModal.classList.remove('active'));
  const btnEditorOpenWith = document.getElementById('btnEditorOpenWith');
  if (btnEditorOpenWith) {
    btnEditorOpenWith.addEventListener('click', () => {
      const editorFilePath = document.getElementById('editorFilePath').textContent;
      const filename = editorFilePath.split('/').pop();
      editorModal.classList.remove('active');
      sftpManager.openWith(filename);
    });
  }

  // Media Preview Modal
  const mediaModal = document.getElementById('mediaModal');
  const btnCloseMediaModal = document.getElementById('btnCloseMediaModal');
  if (btnCloseMediaModal) {
    btnCloseMediaModal.addEventListener('click', () => sftpManager.closeMediaModal());
  }
  if (mediaModal) {
    mediaModal.addEventListener('click', (e) => {
      if (e.target === mediaModal) sftpManager.closeMediaModal();
    });
  }

  // Information Modal
  const sftpInfoModal = document.getElementById('sftpInfoModal');
  const btnCloseInfoModal = document.getElementById('btnCloseInfoModal');
  const btnInfoClose = document.getElementById('btnInfoClose');
  const btnInfoCopyPath = document.getElementById('btnInfoCopyPath');
  if (btnCloseInfoModal) {
    btnCloseInfoModal.addEventListener('click', () => {
      if (sftpInfoModal) sftpInfoModal.classList.remove('active');
    });
  }
  if (btnInfoClose) {
    btnInfoClose.addEventListener('click', () => {
      if (sftpInfoModal) sftpInfoModal.classList.remove('active');
    });
  }
  if (sftpInfoModal) {
    sftpInfoModal.addEventListener('click', (e) => {
      if (e.target === sftpInfoModal) sftpInfoModal.classList.remove('active');
    });
  }

  // Open With Modal
  const openWithModal = document.getElementById('openWithModal');
  const btnCloseOpenWithModal = document.getElementById('btnCloseOpenWithModal');
  const btnLaunchExternalEditor = document.getElementById('btnLaunchExternalEditor');
  const btnOpenWithNewTab = document.getElementById('btnOpenWithNewTab');
  const btnOpenWithBuiltinEditor = document.getElementById('btnOpenWithBuiltinEditor');
  const btnOpenWithFilePicker = document.getElementById('btnOpenWithFilePicker');
  const openWithAppsGrid = document.getElementById('openWithAppsGrid');
  const openWithCustomCmdRow = document.getElementById('openWithCustomCmdRow');
  const openWithCustomCmd = document.getElementById('openWithCustomCmd');
  const openWithAutoSync = document.getElementById('openWithAutoSync');

  if (btnCloseOpenWithModal) {
    btnCloseOpenWithModal.addEventListener('click', () => {
      if (openWithModal) openWithModal.classList.remove('active');
    });
  }
  if (openWithModal) {
    openWithModal.addEventListener('click', (e) => {
      if (e.target === openWithModal) openWithModal.classList.remove('active');
    });
  }

  const btnSwitchLocalBridge = document.getElementById('btnSwitchLocalBridge');
  if (btnSwitchLocalBridge) {
    btnSwitchLocalBridge.addEventListener('click', () => {
      const localUrl = 'ws://localhost:3000/ws';
      const settingBridgeUrl = document.getElementById('settingBridgeUrl');
      if (settingBridgeUrl) settingBridgeUrl.value = localUrl;
      chrome.storage.local.set({ bridgeUrl: localUrl });
      sftpManager.bridgeUrl = localUrl;
      const isPersian = window.i18n && window.i18n.currentLang === 'fa';
      alert(isPersian ? 'آدرس بریدج به ws://localhost:3000/ws تغییر یافت. لطفاً اطمینان حاصل کنید فایل start-windows.bat روی سیستم شما در حال اجراست.' : 'Bridge URL set to ws://localhost:3000/ws. Make sure start-windows.bat is running on your machine.');
      const bridgeText = document.getElementById('openWithBridgeText');
      const remoteNotice = document.getElementById('openWithRemoteNotice');
      if (bridgeText) {
        bridgeText.textContent = `Local Bridge: ${localUrl}`;
        bridgeText.style.color = '#00ff9d';
      }
      if (remoteNotice) remoteNotice.style.display = 'none';
    });
  }

  if (openWithAppsGrid) {
    openWithAppsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.openwith-app-card');
      if (!card) return;
      const app = card.getAttribute('data-app');
      document.querySelectorAll('#openWithAppsGrid .openwith-app-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const isPersian = window.i18n && window.i18n.currentLang === 'fa';
      const labelEl = document.querySelector('label[data-i18n="openwith_custom_label"]');

      if (openWithCustomCmdRow) {
        if (app === 'custom') {
          openWithCustomCmdRow.style.display = 'block';
          if (labelEl) labelEl.textContent = isPersian ? 'دستور یا آدرس کامل برنامه:' : 'Command or Path to Executable:';
          if (openWithCustomCmd) {
            openWithCustomCmd.placeholder = 'e.g. cursor, kate, nvim, /usr/bin/gedit, C:\\Program Files\\...';
            openWithCustomCmd.focus();
          }
        } else if (app === 'notepad++') {
          openWithCustomCmdRow.style.display = 'block';
          if (labelEl) labelEl.textContent = isPersian ? 'مسیر اختصاصی notepad++.exe (اختیاری - خالی بگذارید برای تشخیص خودکار):' : 'Custom path to notepad++.exe (Optional - leave empty for auto-detect):';
          if (openWithCustomCmd) {
            openWithCustomCmd.placeholder = 'C:\\Program Files\\Notepad++\\notepad++.exe';
          }
        } else {
          openWithCustomCmdRow.style.display = 'none';
        }
      }
    });
  }

  if (btnLaunchExternalEditor) {
    btnLaunchExternalEditor.addEventListener('click', () => {
      const activeCard = document.querySelector('#openWithAppsGrid .openwith-app-card.active');
      const editorChoice = activeCard ? activeCard.getAttribute('data-app') : 'default';
      const customCmd = openWithCustomCmd ? openWithCustomCmd.value.trim() : '';
      const autoSync = openWithAutoSync ? openWithAutoSync.checked : true;

      localStorage.setItem('livekadeh_ext_editor', editorChoice);
      if (customCmd) localStorage.setItem('livekadeh_ext_editor_cmd', customCmd);
      localStorage.setItem('livekadeh_ext_autosync', autoSync ? 'true' : 'false');

      sftpManager.launchExternalEditor(
        sftpManager.activeOpenWithPath,
        sftpManager.activeOpenWithFile,
        editorChoice,
        customCmd,
        autoSync
      );
    });
  }

  if (btnOpenWithNewTab) {
    btnOpenWithNewTab.addEventListener('click', () => {
      sftpManager.openInNewTab(sftpManager.activeOpenWithFile);
    });
  }

  if (btnOpenWithBuiltinEditor) {
    btnOpenWithBuiltinEditor.addEventListener('click', () => {
      if (openWithModal) openWithModal.classList.remove('active');
      sftpManager.editFile(sftpManager.activeOpenWithFile);
    });
  }

  if (btnOpenWithFilePicker) {
    btnOpenWithFilePicker.addEventListener('click', () => {
      sftpManager.saveAndSyncWithFilePicker(sftpManager.activeOpenWithFile);
    });
  }
  if (btnInfoCopyPath) {
    btnInfoCopyPath.addEventListener('click', async () => {
      const pathEl = document.getElementById('infoPathVal');
      if (pathEl && pathEl.textContent) {
        try {
          await navigator.clipboard.writeText(pathEl.textContent);
          const originalText = btnInfoCopyPath.textContent;
          btnInfoCopyPath.textContent = '✔';
          setTimeout(() => { btnInfoCopyPath.textContent = originalText; }, 1500);
        } catch (err) {
          console.error('Failed to copy path from info modal:', err);
        }
      }
    });
  }

  // Keyboard shortcut for Editor Save (Ctrl+S) and Modal Close (Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (editorModal.classList.contains('active')) {
        e.preventDefault();
        sftpManager.saveEditedFile();
      }
    } else if (e.key === 'Escape') {
      if (sftpInfoModal && sftpInfoModal.classList.contains('active')) {
        sftpInfoModal.classList.remove('active');
      } else if (mediaModal && mediaModal.classList.contains('active')) {
        sftpManager.closeMediaModal();
      } else if (editorModal && editorModal.classList.contains('active')) {
        editorModal.classList.remove('active');
      }
    }
  });

  // Servers View Loading
  async function loadServersList() {
    const { servers = [] } = await chrome.storage.local.get('servers');
    serversGrid.innerHTML = '';
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    if (servers.length === 0) {
      const emptyMsg = isPersian
        ? 'هیچ سروری ذخیره نشده است. با کلیک بر روی «سرور جدید +» اولین سرور خود را اضافه کنید.'
        : 'No servers saved yet. Click "+ Add Server" to configure your first server.';
      serversGrid.innerHTML = `<div style="color: #64748b; padding: 20px; grid-column: 1/-1; text-align: center;">${emptyMsg}</div>`;
      return;
    }

    const sshLabel = isPersian ? '⚡ ترمینال SSH' : '⚡ SSH Terminal';
    const sftpLabel = isPersian ? '📁 فایل منیجر SFTP' : '📁 SFTP Manager';
    const editTitle = isPersian ? 'ویرایش' : 'Edit';
    const delTitle = isPersian ? 'حذف' : 'Delete';

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
            <button class="btn-icon-sm btn-edit-srv" title="${editTitle}">✏️</button>
            <button class="btn-icon-sm btn-del-srv" title="${delTitle}" style="color: #ef4444;">🗑️</button>
          </div>
        </div>
        <div class="server-card-actions">
          <button class="btn btn-sm btn-cyan btn-connect-ssh-card" style="flex: 1;">${sshLabel}</button>
          <button class="btn btn-sm btn-secondary btn-connect-sftp-card" style="flex: 1;">${sftpLabel}</button>
        </div>
      `;

      card.querySelector('.btn-edit-srv').addEventListener('click', () => openConnectModal(srv));
      card.querySelector('.btn-del-srv').addEventListener('click', async () => {
        const confirmMsg = isPersian 
          ? `آیا از حذف سرور "${srv.name}" اطمینان دارید؟`
          : `Are you sure you want to delete server "${srv.name}"?`;
        if (confirm(confirmMsg)) {
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
    const { servers = [], bridgeUrl = 'ws://localhost:3000/ws' } = await chrome.storage.local.get(['servers', 'bridgeUrl']);
    const exportData = {
      version: (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.4.2',
      exportedAt: new Date().toISOString(),
      bridgeUrl,
      servers
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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
      const isPersian = window.i18n && window.i18n.currentLang === 'fa';
      reader.onload = async () => {
        try {
          const json = JSON.parse(reader.result);
          if (json.servers) {
            await chrome.storage.local.set({ servers: json.servers });
            if (json.bridgeUrl) await chrome.storage.local.set({ bridgeUrl: json.bridgeUrl });
            alert(isPersian ? 'اطلاعات با موفقیت بازیابی شد ✔' : 'Servers imported successfully ✔');
            loadServersList();
          }
        } catch (err) {
          alert((isPersian ? 'فایل وارد شده معتبر نمی‌باشد: ' : 'Invalid backup file: ') + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Settings Loading & Saving
  const settingDefaultExtEditor = document.getElementById('settingDefaultExtEditor');
  const settingCustomEditorRow = document.getElementById('settingCustomEditorRow');
  const settingCustomEditorCmd = document.getElementById('settingCustomEditorCmd');
  const settingExtAutoSync = document.getElementById('settingExtAutoSync');

  if (settingDefaultExtEditor) {
    settingDefaultExtEditor.addEventListener('change', () => {
      if (settingCustomEditorRow) {
        settingCustomEditorRow.style.display = settingDefaultExtEditor.value === 'custom' ? 'block' : 'none';
      }
    });
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get(['bridgeUrl', 'fontFamily', 'fontSize', 'terminalTheme']);
    if (data.bridgeUrl) settingBridgeUrl.value = data.bridgeUrl;
    if (data.fontFamily) settingFontFamily.value = data.fontFamily;
    if (data.fontSize) settingFontSize.value = data.fontSize;
    if (data.terminalTheme) settingTerminalTheme.value = data.terminalTheme;

    const extEditor = localStorage.getItem('livekadeh_ext_editor') || 'default';
    const extEditorCmd = localStorage.getItem('livekadeh_ext_editor_cmd') || '';
    const extAutoSync = localStorage.getItem('livekadeh_ext_autosync');

    if (settingDefaultExtEditor) {
      settingDefaultExtEditor.value = extEditor;
      if (settingCustomEditorRow) settingCustomEditorRow.style.display = extEditor === 'custom' ? 'block' : 'none';
    }
    if (settingCustomEditorCmd) settingCustomEditorCmd.value = extEditorCmd;
    if (settingExtAutoSync) settingExtAutoSync.checked = extAutoSync !== 'false';
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

    if (settingDefaultExtEditor) {
      localStorage.setItem('livekadeh_ext_editor', settingDefaultExtEditor.value);
      localStorage.setItem('livekadeh_ext_editor_cmd', settingCustomEditorCmd ? settingCustomEditorCmd.value.trim() : '');
      localStorage.setItem('livekadeh_ext_autosync', settingExtAutoSync ? (settingExtAutoSync.checked ? 'true' : 'false') : 'true');
    }

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    alert(isPersian ? 'تنظیمات با موفقیت ذخیره گردید ✔' : 'Settings saved successfully ✔');
  });

  btnTestBridge.addEventListener('click', () => {
    const url = settingBridgeUrl.value.trim();
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    bridgeTestResult.textContent = isPersian ? 'در حال تست...' : 'Testing connection...';
    bridgeTestResult.style.color = '#f59e0b';

    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        bridgeTestResult.textContent = isPersian ? 'خطا: عدم پاسخگویی در مدت زمان تعیین شده' : 'Error: Connection timed out';
        bridgeTestResult.style.color = '#ef4444';
        try { ws.close(); } catch (e) {}
      }, 4000);

      ws.onopen = () => {
        clearTimeout(timer);
        bridgeTestResult.textContent = isPersian ? 'ارتباط با موفقیت برقرار شد 🚀' : 'Bridge connected successfully 🚀';
        bridgeTestResult.style.color = '#00ff9d';
        ws.close();
      };

      ws.onerror = (e) => {
        clearTimeout(timer);
        bridgeTestResult.textContent = isPersian ? 'خطا در برقراری ارتباط با وب‌سوکت' : 'WebSocket connection failed';
        bridgeTestResult.style.color = '#ef4444';
      };
    } catch (e) {
      bridgeTestResult.textContent = (isPersian ? 'خطا: ' : 'Error: ') + e.message;
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

  // Public Bridges List
  const btnFetchPublicBridges = document.getElementById('btnFetchPublicBridges');
  const publicBridgesContainer = document.getElementById('publicBridgesContainer');

  const FALLBACK_PUBLIC_BRIDGES = [
    {
      id: "nl-official",
      name: "LiveKadeh Netherlands Core (Official)",
      url: "wss://nl.livekadeh.com/ws",
      region: "🇳🇱 Netherlands (Europe)",
      status: "online",
      speed: "Ultra Fast",
      verified: true,
      maintainer: "@livekadeh"
    },
    {
      id: "local-dev",
      name: "Localhost Development Bridge",
      url: "ws://localhost:3000/ws",
      region: "💻 Local Machine",
      status: "online",
      speed: "Instant (0ms)",
      verified: true,
      maintainer: "Local User"
    }
  ];

  async function loadPublicBridges() {
    if (!publicBridgesContainer) return;
    publicBridgesContainer.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px;">در حال دریافت آخرین لیست از گیت‌هاب...</div>';

    let bridges = FALLBACK_PUBLIC_BRIDGES;
    try {
      const res = await fetch('https://raw.githubusercontent.com/livekadeh/chrome-ssh-sftp-extension/main/public_bridges.json?t=' + Date.now());
      if (res.ok) {
        bridges = await res.json();
      }
    } catch (e) {
      console.warn('Using fallback public bridges:', e);
    }

    renderPublicBridges(bridges);
  }

  function renderPublicBridges(bridges) {
    if (!publicBridgesContainer) return;
    publicBridgesContainer.innerHTML = '';

    bridges.forEach(b => {
      const item = document.createElement('div');
      item.className = 'public-bridge-item';
      item.innerHTML = `
        <div class="public-bridge-info">
          <div class="public-bridge-name">
            <span>${b.name}</span>
            ${b.verified ? '<span class="badge-verified">تأیید شده ✔</span>' : ''}
          </div>
          <div class="public-bridge-url">${b.url}</div>
          <div class="public-bridge-meta">
            <span>📍 ${b.region || 'نامشخص'}</span>
            <span>⚡ ${b.speed || 'عادی'}</span>
            <span>👤 ${b.maintainer || 'Community'}</span>
          </div>
        </div>
        <div class="public-bridge-actions">
          <button class="btn btn-sm btn-cyan btn-select-bridge" data-url="${b.url}">انتخاب و تنظیم ⚡</button>
        </div>
      `;

      item.querySelector('.btn-select-bridge').addEventListener('click', async () => {
        settingBridgeUrl.value = b.url;
        await chrome.storage.local.set({ bridgeUrl: b.url });
        btnTestBridge.click();
      });

      publicBridgesContainer.appendChild(item);
    });
  }

  if (btnFetchPublicBridges) {
    btnFetchPublicBridges.addEventListener('click', () => loadPublicBridges());
  }

  // ================= ABOUT & UPDATE CHECKER =================
  const btnCheckUpdate = document.getElementById('btnCheckUpdate');
  const updateResultBox = document.getElementById('updateResultBox');
  const aboutUpdateBadge = document.getElementById('aboutUpdateBadge');
  const aboutVersionLabel = document.getElementById('aboutVersionLabel');

  const currentManifestVersion = (chrome.runtime && chrome.runtime.getManifest) 
    ? chrome.runtime.getManifest().version 
    : '1.4.2';

  if (aboutVersionLabel) {
    aboutVersionLabel.textContent = `v${currentManifestVersion}`;
  }

  function compareSemVer(v1, v2) {
    const p1 = String(v1).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const p2 = String(v2).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(p1.length, p2.length);
    for (let i = 0; i < maxLen; i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  async function checkForUpdates() {
    if (!btnCheckUpdate || !updateResultBox) return;

    updateResultBox.className = 'update-result-box checking';
    updateResultBox.style.display = 'flex';
    updateResultBox.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>${window.i18n ? window.i18n.t('about_checking') : 'Checking GitHub for updates...'}</span>
    `;

    try {
      let latestTag = '';
      let releaseUrl = 'https://github.com/livekadeh/chrome-ssh-sftp-extension/releases';
      let directDownloadUrl = null;

      try {
        const res = await fetch('https://api.github.com/repos/livekadeh/chrome-ssh-sftp-extension/releases/latest');
        if (res.ok) {
          const release = await res.json();
          latestTag = release.tag_name || '';
          releaseUrl = release.html_url || releaseUrl;
          const assets = Array.isArray(release.assets) ? release.assets : [];
          const zipAsset = assets.find(a => a.name && a.name.includes('extension') && a.name.endsWith('.zip'));
          if (zipAsset) {
            directDownloadUrl = zipAsset.browser_download_url;
          }
        }
      } catch (apiErr) {
        console.warn('GitHub API release fetch failed, trying raw manifest fallback:', apiErr);
      }

      // Fallback to raw manifest if GitHub API had rate limiting or network issue
      if (!latestTag) {
        const rawRes = await fetch('https://raw.githubusercontent.com/livekadeh/chrome-ssh-sftp-extension/main/extension/manifest.json?t=' + Date.now());
        if (rawRes.ok) {
          const rawManifest = await rawRes.json();
          if (rawManifest && rawManifest.version) {
            latestTag = 'v' + rawManifest.version;
          }
        }
      }

      if (!latestTag) {
        throw new Error('Unable to check for updates at this moment. Please check GitHub releases directly.');
      }

      const latestVer = latestTag.replace(/^v/, '');
      const hasUpdate = compareSemVer(latestVer, currentManifestVersion) > 0;

      if (!hasUpdate) {
        updateResultBox.className = 'update-result-box up-to-date';
        const upToDateMsg = window.i18n 
          ? window.i18n.t('about_up_to_date', { ver: `v${currentManifestVersion}` }) 
          : `You are using the latest version (v${currentManifestVersion}) ✔`;
        updateResultBox.innerHTML = `
          <span style="font-size: 15px;">✔</span>
          <span>${escapeHtml(upToDateMsg)}</span>
        `;
        if (aboutUpdateBadge) aboutUpdateBadge.textContent = `Latest v${currentManifestVersion}`;
      } else {
        updateResultBox.className = 'update-result-box new-available';
        const titleText = window.i18n ? window.i18n.t('about_update_available') : 'New version available:';
        const downloadZipText = window.i18n ? window.i18n.t('about_direct_download') : 'Download Extension (.zip) 📥';
        const releaseNotesText = window.i18n ? window.i18n.t('about_release_notes') : 'Release Notes 📄';
        const instructionsText = window.i18n ? window.i18n.t('about_update_instructions') : 'Extract ZIP and click reload in chrome://extensions';

        let actionButtonsHtml = '';
        if (directDownloadUrl) {
          actionButtonsHtml += `<a href="${escapeHtml(directDownloadUrl)}" target="_blank" class="btn btn-sm btn-cyan">${escapeHtml(downloadZipText)}</a>`;
        }
        actionButtonsHtml += `<a href="${escapeHtml(releaseUrl)}" target="_blank" class="btn btn-sm btn-secondary">${escapeHtml(releaseNotesText)}</a>`;

        updateResultBox.innerHTML = `
          <span style="font-size: 18px;">⚡</span>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <strong>${escapeHtml(titleText)} ${escapeHtml(latestTag)}</strong>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">${actionButtonsHtml}</div>
            </div>
            <div style="font-size: 11px; opacity: 0.85;">💡 ${escapeHtml(instructionsText)}</div>
          </div>
        `;
        if (aboutUpdateBadge) aboutUpdateBadge.textContent = `Update: ${latestTag}`;
      }
    } catch (err) {
      updateResultBox.className = 'update-result-box';
      updateResultBox.style.color = '#ef4444';
      updateResultBox.innerHTML = `⚠️ ${escapeHtml(err.message || 'Error checking for updates')}`;
    }
  }

  if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', checkForUpdates);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ================= ACTIVE SESSIONS DRAWER CONTROLLER =================
  const btnFloatingSessions = document.getElementById('btnFloatingSessions');
  const btnHeaderSessions = document.getElementById('btnHeaderSessions');
  const sessionsDrawerBackdrop = document.getElementById('sessionsDrawerBackdrop');
  const sessionsDrawer = document.getElementById('sessionsDrawer');
  const btnCloseSessionsDrawer = document.getElementById('btnCloseSessionsDrawer');
  const drawerActiveSubtitle = document.getElementById('drawerActiveSubtitle');
  const floatingSessionsBadge = document.getElementById('floatingSessionsBadge');
  const headerSessionsBadge = document.getElementById('headerSessionsBadge');
  const sftpSessionsCountBadge = document.getElementById('sftpSessionsCountBadge');
  const sshSessionsCountBadge = document.getElementById('sshSessionsCountBadge');
  const drawerSftpList = document.getElementById('drawerSftpList');
  const drawerSshList = document.getElementById('drawerSshList');
  const drawerSavedServersList = document.getElementById('drawerSavedServersList');
  const btnDrawerNewConn = document.getElementById('btnDrawerNewConn');

  function openSessionsDrawer() {
    if (!sessionsDrawer) return;
    sessionsDrawer.classList.add('active');
    if (sessionsDrawerBackdrop) sessionsDrawerBackdrop.classList.add('active');
    renderSessionsDrawer();
  }

  function closeSessionsDrawer() {
    if (!sessionsDrawer) return;
    sessionsDrawer.classList.remove('active');
    if (sessionsDrawerBackdrop) sessionsDrawerBackdrop.classList.remove('active');
  }

  if (btnFloatingSessions) btnFloatingSessions.addEventListener('click', openSessionsDrawer);
  if (btnHeaderSessions) btnHeaderSessions.addEventListener('click', openSessionsDrawer);
  if (btnCloseSessionsDrawer) btnCloseSessionsDrawer.addEventListener('click', closeSessionsDrawer);
  if (sessionsDrawerBackdrop) sessionsDrawerBackdrop.addEventListener('click', closeSessionsDrawer);
  if (btnDrawerNewConn) {
    btnDrawerNewConn.addEventListener('click', () => {
      closeSessionsDrawer();
      openConnectModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sessionsDrawer && sessionsDrawer.classList.contains('active')) {
        closeSessionsDrawer();
      }
    }
  });

  async function renderSessionsDrawer() {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const sftpSessions = sftpManager ? Array.from(sftpManager.sessions.values()) : [];
    const sshSessions = termManager ? Array.from(termManager.sessions.values()) : [];
    const totalCount = sftpSessions.length + sshSessions.length;

    // Update badges
    if (floatingSessionsBadge) floatingSessionsBadge.textContent = totalCount;
    if (headerSessionsBadge) headerSessionsBadge.textContent = totalCount;
    if (sftpSessionsCountBadge) sftpSessionsCountBadge.textContent = sftpSessions.length;
    if (sshSessionsCountBadge) sshSessionsCountBadge.textContent = sshSessions.length;
    if (drawerActiveSubtitle) {
      drawerActiveSubtitle.textContent = isPersian 
        ? `${totalCount} نشست سرور فعال` 
        : `${totalCount} active session(s)`;
    }

    // Render SFTP List
    if (drawerSftpList) {
      if (sftpSessions.length === 0) {
        drawerSftpList.innerHTML = `<div class="drawer-empty-hint">${isPersian ? 'هیچ نشست فعال SFTP وجود ندارد' : 'No active SFTP session connected'}</div>`;
      } else {
        drawerSftpList.innerHTML = '';
        sftpSessions.forEach(session => {
          const isActive = (sftpManager.activeSessionId === session.id);
          const color = (session.serverConfig && session.serverConfig.color) || '#00f0ff';
          const card = document.createElement('div');
          card.className = `drawer-session-card ${isActive ? 'active' : ''}`;
          card.innerHTML = `
            <div class="session-card-main">
              <span class="session-card-badge" style="background: ${color};"></span>
              <div class="session-card-details">
                <div class="session-card-name">${escapeHtml(session.name)}</div>
                <div class="session-card-host">${escapeHtml(session.serverConfig ? session.serverConfig.username : '')}@${escapeHtml(session.serverConfig ? session.serverConfig.host : '')}</div>
                <div class="session-card-path">📂 ${escapeHtml(session.currentPath || '/root')}</div>
              </div>
              <span class="session-status-dot ${session.isConnected ? 'online' : 'offline'}" title="${session.isConnected ? 'Connected' : 'Disconnected'}"></span>
            </div>
            <div class="session-card-actions">
              <button class="btn btn-xs btn-cyan btn-switch-sftp">${isPersian ? 'ورود به SFTP 📁' : 'Open SFTP 📁'}</button>
              <button class="btn btn-xs btn-secondary btn-switch-ssh">${isPersian ? 'ترمینال ⚡' : 'Terminal ⚡'}</button>
              <button class="btn btn-xs btn-danger-icon btn-close-sftp" title="${isPersian ? 'قطع اتصال' : 'Disconnect'}">✕</button>
            </div>
          `;

          // Switch to this SFTP session
          card.querySelector('.btn-switch-sftp').addEventListener('click', () => {
            sftpManager.switchSession(session.id);
            switchView('sftp');
            closeSessionsDrawer();
          });

          // Connect / Switch to SSH for this server
          card.querySelector('.btn-switch-ssh').addEventListener('click', async () => {
            const hostKey = `${session.serverConfig.username}@${session.serverConfig.host}:${session.serverConfig.port || 22}`;
            let existingSSH = null;
            for (const [id, s] of termManager.sessions) {
              const sKey = `${s.serverConfig.username}@${s.serverConfig.host}:${s.serverConfig.port || 22}`;
              if (sKey === hostKey) {
                existingSSH = s;
                break;
              }
            }
            if (existingSSH) {
              termManager.switchSession(existingSSH.id);
            } else {
              const bridgeUrl = (await chrome.storage.local.get('bridgeUrl')).bridgeUrl || 'ws://localhost:3000/ws';
              termManager.createSession(session.serverConfig, bridgeUrl);
            }
            switchView('ssh');
            closeSessionsDrawer();
          });

          // Close this SFTP session
          card.querySelector('.btn-close-sftp').addEventListener('click', (e) => {
            e.stopPropagation();
            sftpManager.closeSession(session.id);
            renderSessionsDrawer();
          });

          drawerSftpList.appendChild(card);
        });
      }
    }

    // Render SSH List
    if (drawerSshList) {
      if (sshSessions.length === 0) {
        drawerSshList.innerHTML = `<div class="drawer-empty-hint">${isPersian ? 'هیچ ترمینال SSH باز نیست' : 'No active SSH terminal open'}</div>`;
      } else {
        drawerSshList.innerHTML = '';
        sshSessions.forEach(session => {
          const isActive = (termManager.activeSessionId === session.id);
          const color = (session.serverConfig && session.serverConfig.color) || '#00f0ff';
          const card = document.createElement('div');
          card.className = `drawer-session-card ${isActive ? 'active' : ''}`;
          card.innerHTML = `
            <div class="session-card-main">
              <span class="session-card-badge" style="background: ${color};"></span>
              <div class="session-card-details">
                <div class="session-card-name">${escapeHtml(session.name)}</div>
                <div class="session-card-host">${escapeHtml(session.serverConfig ? session.serverConfig.username : '')}@${escapeHtml(session.serverConfig ? session.serverConfig.host : '')}</div>
              </div>
              <span class="session-status-dot ${session.status === 'connected' ? 'online' : 'offline'}" title="${session.status}"></span>
            </div>
            <div class="session-card-actions">
              <button class="btn btn-xs btn-cyan btn-switch-ssh">${isPersian ? 'نمایش ترمینال ⚡' : 'Open Terminal ⚡'}</button>
              <button class="btn btn-xs btn-secondary btn-switch-sftp">${isPersian ? 'فایل SFTP 📁' : 'SFTP Files 📁'}</button>
              <button class="btn btn-xs btn-danger-icon btn-close-ssh" title="${isPersian ? 'بستن نشست' : 'Close Tab'}">✕</button>
            </div>
          `;

          // Switch to this SSH terminal
          card.querySelector('.btn-switch-ssh').addEventListener('click', () => {
            termManager.switchSession(session.id);
            switchView('ssh');
            closeSessionsDrawer();
          });

          // Connect / Switch to SFTP for this server
          card.querySelector('.btn-switch-sftp').addEventListener('click', async () => {
            const bridgeUrl = (await chrome.storage.local.get('bridgeUrl')).bridgeUrl || 'ws://localhost:3000/ws';
            sftpManager.connect(session.serverConfig, bridgeUrl);
            switchView('sftp');
            closeSessionsDrawer();
          });

          // Close this SSH session
          card.querySelector('.btn-close-ssh').addEventListener('click', (e) => {
            e.stopPropagation();
            termManager.closeSession(session.id);
            renderSessionsDrawer();
          });

          drawerSshList.appendChild(card);
        });
      }
    }

    // Render Saved Servers Quick Connect List
    if (drawerSavedServersList) {
      const { servers = [] } = await chrome.storage.local.get('servers');
      if (servers.length === 0) {
        drawerSavedServersList.innerHTML = `<div class="drawer-empty-hint">${isPersian ? 'سروری ذخیره نشده است' : 'No saved servers'}</div>`;
      } else {
        drawerSavedServersList.innerHTML = '';
        servers.slice(0, 8).forEach(srv => {
          const item = document.createElement('div');
          item.className = 'drawer-saved-item';
          item.innerHTML = `
            <div class="drawer-saved-info">
              <span class="session-card-badge" style="background: ${srv.color || '#00f0ff'};"></span>
              <span class="drawer-saved-name">${escapeHtml(srv.name || srv.host)}</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-xs btn-cyan btn-launch-drawer-ssh" title="SSH">⚡</button>
              <button class="btn btn-xs btn-secondary btn-launch-drawer-sftp" title="SFTP">📁</button>
            </div>
          `;

          item.querySelector('.btn-launch-drawer-ssh').addEventListener('click', async () => {
            const bridgeUrl = (await chrome.storage.local.get('bridgeUrl')).bridgeUrl || 'ws://localhost:3000/ws';
            termManager.createSession(srv, bridgeUrl);
            switchView('ssh');
            closeSessionsDrawer();
          });

          item.querySelector('.btn-launch-drawer-sftp').addEventListener('click', async () => {
            const bridgeUrl = (await chrome.storage.local.get('bridgeUrl')).bridgeUrl || 'ws://localhost:3000/ws';
            sftpManager.connect(srv, bridgeUrl);
            switchView('sftp');
            closeSessionsDrawer();
          });

          drawerSavedServersList.appendChild(item);
        });
      }
    }
  }

  window.updateSessionsDrawer = renderSessionsDrawer;

  // Initial loads
  await loadSettings();
  await loadServersList();
  await loadPublicBridges();
  await renderSessionsDrawer();
});
