/**
 * LiveKadeh SFTP File Manager
 */

class SFTPManager {
  constructor(tableBodyEl, pathInputEl, statusEl, countEl, gridContainerEl) {
    this.tableBodyEl = tableBodyEl;
    this.pathInputEl = pathInputEl;
    this.statusEl = statusEl;
    this.countEl = countEl;
    this.gridContainerEl = gridContainerEl || document.getElementById('sftpGridView');
    this.viewMode = 'list';
    
    this.currentPath = '/root';
    this.currentFiles = [];
    this.selectedFiles = new Set();
    this.ws = null;
    this.isConnected = false;
    this.serverConfig = null;
    this.bridgeUrl = null;

    this.sessions = new Map();
    this.activeSessionId = null;

    this.pendingCallbacks = new Map();
    this.callbackSeq = 1;
    this.isUploadCancelled = false;
    this.activeDownloadController = null;
    this.isDownloadCancelled = false;
    this.isOperationCancelled = false;
    this.currentMediaUrl = null;
    this.clipboard = null;

    this.sortColumn = 'name';
    this.sortDirection = 'asc';

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('sftpViewMode', (res) => {
        if (res && res.sftpViewMode) {
          this.viewMode = res.sftpViewMode;
          this.applyViewMode();
        }
      });
    }

    this.initSorting();
    this.initSelectAll();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.applyViewMode();
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ sftpViewMode: mode });
    }
  }

  applyViewMode() {
    const sftpTable = document.getElementById('sftpTable');
    const sftpGridView = document.getElementById('sftpGridView');
    const btnList = document.getElementById('btnSftpViewList');
    const btnGrid = document.getElementById('btnSftpViewGrid');

    if (this.viewMode === 'grid') {
      if (sftpTable) sftpTable.style.display = 'none';
      if (sftpGridView) sftpGridView.style.display = 'grid';
      if (btnList) btnList.classList.remove('active');
      if (btnGrid) btnGrid.classList.add('active');
    } else {
      if (sftpTable) sftpTable.style.display = 'table';
      if (sftpGridView) sftpGridView.style.display = 'none';
      if (btnList) btnList.classList.add('active');
      if (btnGrid) btnGrid.classList.remove('active');
    }
  }

  initSorting() {
    const ths = document.querySelectorAll('#sftpTable thead th[data-sort]');
    ths.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (col) this.sortFiles(col);
      });
    });
    this.updateSortHeaders();
  }

  initSelectAll() {
    const chkSelectAll = document.getElementById('selectAllFiles');
    if (chkSelectAll) {
      chkSelectAll.addEventListener('change', () => {
        const isChecked = chkSelectAll.checked;
        if (isChecked) {
          this.currentFiles.forEach(f => this.selectedFiles.add(f.filename));
        } else {
          this.selectedFiles.clear();
        }
        this.updateSelectionUI();
        document.querySelectorAll('.file-chk').forEach(c => c.checked = isChecked);
        document.querySelectorAll('.sftp-row, .sftp-grid-card').forEach(el => el.classList.toggle('selected', isChecked));
      });
    }
  }

  sortFiles(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = (column === 'mtime' || column === 'size') ? 'desc' : 'asc';
    }

    this.applySort();
    this.updateSortHeaders();

    const searchInput = document.getElementById('sftpSearchInput');
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (q) {
      const filtered = this.currentFiles.filter(f => f.filename.toLowerCase().includes(q));
      this.renderFiles(filtered);
    } else {
      this.renderFiles(this.currentFiles);
    }
  }

  applySort() {
    const col = this.sortColumn || 'name';
    const dir = this.sortDirection === 'desc' ? -1 : 1;

    this.currentFiles.sort((a, b) => {
      const isDirA = !!(a.attrs && a.attrs.isDirectory);
      const isDirB = !!(b.attrs && b.attrs.isDirectory);

      // Keep directories grouped at top
      if (isDirA && !isDirB) return -1;
      if (!isDirA && isDirB) return 1;

      let res = 0;
      if (col === 'name') {
        res = a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
      } else if (col === 'size') {
        const sizeA = (a.attrs && a.attrs.size) || 0;
        const sizeB = (b.attrs && b.attrs.size) || 0;
        res = sizeA - sizeB;
        if (res === 0) {
          res = a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (col === 'mtime') {
        const mtimeA = (a.attrs && a.attrs.mtime) || 0;
        const mtimeB = (b.attrs && b.attrs.mtime) || 0;
        res = mtimeA - mtimeB;
        if (res === 0) {
          res = a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (col === 'permissions') {
        const permA = (a.attrs && a.attrs.permissions) || '';
        const permB = (b.attrs && b.attrs.permissions) || '';
        res = permA.localeCompare(permB);
        if (res === 0) {
          res = a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
        }
      }

      return res * dir;
    });
  }

  updateSortHeaders() {
    const ths = document.querySelectorAll('#sftpTable thead th[data-sort]');
    ths.forEach(th => {
      const col = th.dataset.sort;
      const indicator = th.querySelector('.sort-indicator');
      if (col === this.sortColumn) {
        th.classList.add('sorted');
        th.classList.toggle('sorted-desc', this.sortDirection === 'desc');
        th.classList.toggle('sorted-asc', this.sortDirection === 'asc');
        if (indicator) {
          indicator.textContent = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
      } else {
        th.classList.remove('sorted', 'sorted-desc', 'sorted-asc');
        if (indicator) {
          indicator.textContent = '';
        }
      }
    });
  }

  connect(serverConfig, bridgeUrl, onReady) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const hostKey = `${serverConfig.username}@${serverConfig.host}:${serverConfig.port || 22}`;

    // Check if session for this server already exists and is alive
    for (const [id, s] of this.sessions) {
      if (s.hostKey === hostKey && s.isConnected && s.ws && s.ws.readyState === WebSocket.OPEN) {
        this.switchSession(id);
        if (onReady) onReady();
        return;
      }
    }

    const sessionId = 'sftp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const sessionName = serverConfig.name || `${serverConfig.username}@${serverConfig.host}`;

    const session = {
      id: sessionId,
      name: sessionName,
      hostKey,
      serverConfig,
      bridgeUrl,
      ws: null,
      isConnected: false,
      currentPath: serverConfig.defaultPath || '/root',
      currentFiles: [],
      selectedFiles: new Set(),
      pendingCallbacks: new Map(),
      callbackSeq: 1
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;
    this.serverConfig = serverConfig;
    this.bridgeUrl = bridgeUrl;
    this.currentPath = session.currentPath;
    this.currentFiles = [];
    this.selectedFiles = session.selectedFiles;

    this.updateStatus(isPersian ? `در حال اتصال به SFTP (${sessionName})...` : `Connecting to SFTP (${sessionName})...`);

    try {
      const ws = new WebSocket(bridgeUrl);
      session.ws = ws;
      this.ws = ws;

      ws.onopen = () => {
        this.updateStatus(isPersian ? `در حال احراز هویت (${sessionName})...` : `Authenticating (${sessionName})...`);
        ws.send(JSON.stringify({
          type: 'sftp-init',
          host: serverConfig.host,
          port: serverConfig.port || 22,
          username: serverConfig.username,
          password: serverConfig.password,
          privateKey: serverConfig.privateKey,
          passphrase: serverConfig.passphrase
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleSessionMessage(session, msg, onReady);
        } catch (e) {
          console.error('[SFTP] Parse error:', e);
        }
      };

      ws.onclose = () => {
        session.isConnected = false;
        if (this.activeSessionId === session.id) {
          this.isConnected = false;
          this.updateStatus(isPersian ? `اتصال SFTP قطع شد: ${sessionName}` : `SFTP connection closed: ${sessionName}`);
          document.getElementById('sftpEmptyState').style.display = 'flex';
          document.getElementById('sftpTable').style.display = 'none';
          if (this.gridContainerEl) this.gridContainerEl.style.display = 'none';
        }
        if (typeof window.updateSessionsDrawer === 'function') {
          window.updateSessionsDrawer();
        }
      };

      ws.onerror = (err) => {
        session.isConnected = false;
        if (this.activeSessionId === session.id) {
          this.isConnected = false;
          this.updateStatus(isPersian ? 'خطا در ارتباط با بریج SFTP' : 'Error connecting to SFTP bridge');
        }
        if (typeof window.updateSessionsDrawer === 'function') {
          window.updateSessionsDrawer();
        }
      };

    } catch (e) {
      this.updateStatus((isPersian ? 'خطای اتصال: ' : 'Connection error: ') + e.message);
    }

    if (typeof window.updateSessionsDrawer === 'function') {
      window.updateSessionsDrawer();
    }
  }

  switchSession(sessionId) {
    if (!this.sessions.has(sessionId)) return;
    this.activeSessionId = sessionId;
    const session = this.sessions.get(sessionId);

    this.serverConfig = session.serverConfig;
    this.bridgeUrl = session.bridgeUrl;
    this.currentPath = session.currentPath;
    this.currentFiles = session.currentFiles;
    this.selectedFiles = session.selectedFiles;
    this.ws = session.ws;
    this.isConnected = session.isConnected;
    this.pendingCallbacks = session.pendingCallbacks;
    this.callbackSeq = session.callbackSeq;

    this.pathInputEl.value = this.currentPath;

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (this.isConnected) {
      document.getElementById('sftpEmptyState').style.display = 'none';
      this.applyViewMode();
      this.applySort();
      this.updateSortHeaders();
      this.renderFiles(this.currentFiles);
      this.updateSelectionUI();
      this.updateStatus(isPersian ? `نشست فعال SFTP: ${session.name}` : `Active SFTP: ${session.name}`);
    } else {
      document.getElementById('sftpEmptyState').style.display = 'flex';
      document.getElementById('sftpTable').style.display = 'none';
      if (this.gridContainerEl) this.gridContainerEl.style.display = 'none';
    }

    if (window.onGlobalConnectionChange) {
      window.onGlobalConnectionChange(session.isConnected ? 'connected' : 'disconnected', session.name);
    }
    if (typeof window.updateSessionsDrawer === 'function') {
      window.updateSessionsDrawer();
    }
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.ws) {
      try { session.ws.close(); } catch (e) {}
    }
    this.sessions.delete(sessionId);

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (this.activeSessionId === sessionId) {
      const remaining = Array.from(this.sessions.keys());
      if (remaining.length > 0) {
        this.switchSession(remaining[remaining.length - 1]);
      } else {
        this.activeSessionId = null;
        this.isConnected = false;
        this.ws = null;
        this.currentFiles = [];
        this.selectedFiles.clear();
        document.getElementById('sftpEmptyState').style.display = 'flex';
        document.getElementById('sftpTable').style.display = 'none';
        if (this.gridContainerEl) this.gridContainerEl.style.display = 'none';
        this.updateStatus(isPersian ? 'اتصال SFTP قطع شد' : 'SFTP connection closed');
        if (window.onGlobalConnectionChange) {
          window.onGlobalConnectionChange('disconnected', isPersian ? 'متصل نیست' : 'Not Connected');
        }
      }
    }

    if (typeof window.updateSessionsDrawer === 'function') {
      window.updateSessionsDrawer();
    }
  }

  sendRequest(payload, options = {}) {
    return this.sendRequestToSession(this.activeSessionId, payload, options);
  }

  sendRequestToSession(sessionId, payload, options = {}) {
    return new Promise((resolve, reject) => {
      const session = sessionId ? this.sessions.get(sessionId) : null;
      const ws = session ? session.ws : this.ws;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('SFTP connection is not open'));
        return;
      }

      let timeoutDuration = 60000;
      let onMessage = null;

      if (typeof options === 'number') {
        timeoutDuration = options;
      } else if (typeof options === 'object' && options !== null) {
        if (typeof options.timeout === 'number') timeoutDuration = options.timeout;
        if (typeof options.onMessage === 'function') onMessage = options.onMessage;
      }

      const callbacks = session ? session.pendingCallbacks : this.pendingCallbacks;
      const id = 'req-' + (session ? (session.callbackSeq++) : (this.callbackSeq++));
      payload.id = id;

      const callbackEntry = {
        resolve,
        reject,
        onMessage,
        timeoutDuration,
        timeoutTimer: null
      };

      const armTimeout = () => {
        if (timeoutDuration > 0) {
          callbackEntry.timeoutTimer = setTimeout(() => {
            if (callbacks.has(id)) {
              callbacks.delete(id);
              reject(new Error('Request timed out'));
            }
          }, timeoutDuration);
        }
      };

      callbackEntry.resetTimeout = () => {
        if (callbackEntry.timeoutTimer) clearTimeout(callbackEntry.timeoutTimer);
        armTimeout();
      };

      armTimeout();
      callbacks.set(id, callbackEntry);
      ws.send(JSON.stringify(payload));
    });
  }

  handleSessionMessage(session, msg, onReady) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (msg.type === 'sftp-status') {
      if (msg.status === 'connected') {
        session.isConnected = true;
        if (msg.sessionId) {
          session.bridgeSessionId = msg.sessionId;
        }
        if (this.activeSessionId === session.id) {
          this.isConnected = true;
          document.getElementById('sftpEmptyState').style.display = 'none';
          this.applyViewMode();
          this.updateStatus(isPersian ? `متصل به SFTP (${session.name}) ✔` : `SFTP Connected (${session.name}) ✔`);
          this.listDirectory(session.currentPath);
          if (onReady) onReady();
        }
      } else {
        session.isConnected = false;
        if (this.activeSessionId === session.id) {
          this.updateStatus(msg.message);
        }
      }
      if (typeof window.updateSessionsDrawer === 'function') {
        window.updateSessionsDrawer();
      }
      return;
    }

    // Handle background external editor auto-sync notification
    if (msg.type === 'sftp-external-synced') {
      this.updateStatus(isPersian ? `فایل "${msg.filename}" به طور خودکار در سرور به‌روزرسانی شد 🟢` : `File "${msg.filename}" auto-synced to server 🟢`);
      const targetFile = this.currentFiles.find(f => f.filename === msg.filename);
      if (targetFile) {
        if (msg.size !== undefined) targetFile.attrs.size = msg.size;
        targetFile.attrs.mtime = Math.floor((msg.mtime || Date.now()) / 1000);
        this.renderFileList();
      }
      return;
    }

    if (msg.id && session.pendingCallbacks.has(msg.id)) {
      const entry = session.pendingCallbacks.get(msg.id);

      // Handle intermediate streaming messages and heartbeats
      const isIntermediate = msg.type === 'sftp-download-dir-chunk' ||
                             msg.type === 'sftp-download-dir-progress' ||
                             msg.type === 'sftp-download-dir-start';

      if (isIntermediate) {
        if (entry.resetTimeout) entry.resetTimeout();
        if (entry.onMessage) entry.onMessage(msg);
        return;
      }

      // Final response completion
      if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
      session.pendingCallbacks.delete(msg.id);

      if (msg.success === false) {
        entry.reject(new Error(msg.error || 'SFTP operation failed'));
      } else {
        if (entry.onMessage) entry.onMessage(msg);
        entry.resolve(msg);
      }
    }
  }

  async listDirectory(dirPath) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? `در حال دریافت لیست فایل‌های ${dirPath}...` : `Listing files in ${dirPath}...`);
    try {
      const res = await this.sendRequest({ type: 'sftp-list', path: dirPath });
      this.currentPath = res.path || dirPath;
      this.pathInputEl.value = this.currentPath;
      this.currentFiles = res.files || [];
      this.selectedFiles.clear();

      this.applySort();
      this.updateSortHeaders();

      const activeSession = this.sessions.get(this.activeSessionId);
      if (activeSession) {
        activeSession.currentPath = this.currentPath;
        activeSession.currentFiles = this.currentFiles;
        activeSession.selectedFiles = this.selectedFiles;
      }

      this.renderFiles(this.currentFiles);
      this.updateStatus(isPersian ? `مسیر فعلی: ${this.currentPath}` : `Current directory: ${this.currentPath}`);
      this.updateSelectionUI();

      if (typeof window.updateSessionsDrawer === 'function') {
        window.updateSessionsDrawer();
      }
    } catch (err) {
      alert((isPersian ? 'خطا در باز کردن پوشه: ' : 'Error opening directory: ') + err.message);
      this.updateStatus((isPersian ? 'خطا: ' : 'Error: ') + err.message);
    }
  }

  renderFiles(files) {
    this.tableBodyEl.innerHTML = '';
    if (this.gridContainerEl) this.gridContainerEl.innerHTML = '';

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.countEl.textContent = isPersian ? `${files.length} آیتم` : `${files.length} items`;

    files.forEach((file) => {
      const isDir = file.attrs.isDirectory;
      const icon = isDir ? '📁' : this.getFileIcon(file.filename);
      const sizeStr = isDir ? '-' : this.formatBytes(file.attrs.size);
      const perms = file.attrs.permissions || '0755';
      const mtimeStr = file.attrs.mtime 
        ? new Date(file.attrs.mtime * 1000).toLocaleString(isPersian ? 'fa-IR' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }) 
        : '-';

      const isCutPending = this.clipboard && this.clipboard.action === 'cut' &&
        this.clipboard.sourceDir === this.currentPath &&
        this.clipboard.files.some(cf => cf.filename === file.filename);

      // 1. Table Row (List View)
      const tr = document.createElement('tr');
      tr.className = 'sftp-row';
      tr.dataset.name = file.filename;
      if (this.selectedFiles.has(file.filename)) tr.classList.add('selected');
      if (isCutPending) tr.classList.add('cut-pending');

      tr.innerHTML = `
        <td><input type="checkbox" class="file-chk" data-name="${file.filename}" ${this.selectedFiles.has(file.filename) ? 'checked' : ''}></td>
        <td>
          <div class="file-name-cell">
            <span class="file-icon">${icon}</span>
            <span class="file-title ${isDir ? 'is-dir' : 'is-file'}">${file.filename}</span>
          </div>
        </td>
        <td class="mono-cell">${sizeStr}</td>
        <td class="mono-cell">${perms}</td>
        <td class="mono-cell" style="font-size: 11px;">${mtimeStr}</td>
        <td style="text-align: center;">
          <button class="btn-action btn-quick-dl" title="${isPersian ? 'دانلود' : 'Download'}">📥</button>
          ${!isDir && this.isMediaFile(file.filename) ? `<button class="btn-action btn-quick-prev" title="${isPersian ? 'نمایش / پخش' : 'Preview / Play'}">${this.isMediaFile(file.filename).type === 'image' ? '🖼️' : (this.isMediaFile(file.filename).type === 'video' ? '🎬' : '🎵')}</button>` : ''}
          <button class="btn-action btn-quick-edit" title="${isPersian ? 'ویرایش' : 'Edit'}">✏️</button>
          <button class="btn-action btn-quick-del" title="${isPersian ? 'حذف' : 'Delete'}" style="color: #ef4444;">🗑️</button>
        </td>
      `;

      const chk = tr.querySelector('.file-chk');
      if (chk) {
        chk.addEventListener('change', (e) => {
          e.stopPropagation();
          this.toggleSelect(file.filename, chk.checked);
        });
      }

      if (tr.firstElementChild) {
        tr.firstElementChild.addEventListener('click', (e) => {
          if (e.target !== chk) {
            e.stopPropagation();
            if (chk) {
              chk.checked = !chk.checked;
              this.toggleSelect(file.filename, chk.checked);
            }
          }
        });
      }

      tr.addEventListener('dblclick', () => {
        if (isDir) {
          const next = this.currentPath.endsWith('/') ? this.currentPath + file.filename : this.currentPath + '/' + file.filename;
          this.listDirectory(next);
        } else if (this.isMediaFile(file.filename)) {
          this.previewMedia(file.filename);
        } else {
          this.editFile(file.filename);
        }
      });

      tr.querySelector('.btn-quick-dl').addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadFile(file.filename);
      });

      const btnQuickPrev = tr.querySelector('.btn-quick-prev');
      if (btnQuickPrev) {
        btnQuickPrev.addEventListener('click', (e) => {
          e.stopPropagation();
          this.previewMedia(file.filename);
        });
      }

      tr.querySelector('.btn-quick-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.editFile(file.filename);
      });

      tr.querySelector('.btn-quick-del').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteItem(file.filename, isDir);
      });

      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!this.selectedFiles.has(file.filename)) {
          this.selectedFiles.clear();
          document.querySelectorAll('.sftp-row, .sftp-grid-card').forEach(r => r.classList.remove('selected'));
          document.querySelectorAll('.file-chk').forEach(c => c.checked = false);
          this.toggleSelect(file.filename, tr);
        }

        if (window.showSftpContextMenu) {
          window.showSftpContextMenu(e.clientX, e.clientY, {
            filename: file.filename,
            isDir: isDir,
            isRow: true
          });
        }
      });

      this.tableBodyEl.appendChild(tr);

      // 2. Grid Card (Grid View)
      if (this.gridContainerEl) {
        const card = document.createElement('div');
        card.className = 'sftp-grid-card';
        card.dataset.name = file.filename;
        if (this.selectedFiles.has(file.filename)) card.classList.add('selected');
        if (isCutPending) card.classList.add('cut-pending');

        card.innerHTML = `
          <input type="checkbox" class="grid-card-chk file-chk" data-name="${file.filename}" ${this.selectedFiles.has(file.filename) ? 'checked' : ''}>
          <div class="grid-card-icon">${icon}</div>
          <div class="grid-card-name ${isDir ? 'is-dir' : 'is-file'}" title="${file.filename}">${file.filename}</div>
          <div class="grid-card-size">${sizeStr}</div>
        `;

        const cardChk = card.querySelector('.file-chk');
        if (cardChk) {
          cardChk.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleSelect(file.filename, cardChk.checked);
          });
          cardChk.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        }

        card.addEventListener('dblclick', () => {
          if (isDir) {
            const next = this.currentPath.endsWith('/') ? this.currentPath + file.filename : this.currentPath + '/' + file.filename;
            this.listDirectory(next);
          } else if (this.isMediaFile(file.filename)) {
            this.previewMedia(file.filename);
          } else {
            this.editFile(file.filename);
          }
        });

        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (!this.selectedFiles.has(file.filename)) {
            this.selectedFiles.clear();
            document.querySelectorAll('.sftp-row, .sftp-grid-card').forEach(r => r.classList.remove('selected'));
            document.querySelectorAll('.file-chk').forEach(c => c.checked = false);
            this.toggleSelect(file.filename, card);
          }

          if (window.showSftpContextMenu) {
            window.showSftpContextMenu(e.clientX, e.clientY, {
              filename: file.filename,
              isDir: isDir,
              isRow: true
            });
          }
        });

        this.gridContainerEl.appendChild(card);
      }
    });

    this.applyViewMode();
  }

  toggleSelect(filename, forceState) {
    const isNowSelected = (typeof forceState === 'boolean') ? forceState : !this.selectedFiles.has(filename);
    if (isNowSelected) {
      this.selectedFiles.add(filename);
    } else {
      this.selectedFiles.delete(filename);
    }

    const matches = document.querySelectorAll(`[data-name="${CSS.escape(filename)}"]`);
    matches.forEach(el => {
      el.classList.toggle('selected', isNowSelected);
      const chk = el.querySelector('.file-chk');
      if (chk) chk.checked = isNowSelected;
    });

    this.updateSelectionUI();
  }

  isMediaFile(filename) {
    if (!filename) return null;
    const ext = filename.split('.').pop().toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'];

    if (imageExts.includes(ext)) {
      const mime = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
      return { type: 'image', mime };
    }
    if (videoExts.includes(ext)) {
      const mime = ext === 'mov' ? 'video/quicktime' : (ext === 'mkv' ? 'video/x-matroska' : `video/${ext}`);
      return { type: 'video', mime };
    }
    if (audioExts.includes(ext)) {
      const mime = ext === 'mp3' ? 'audio/mpeg' : (ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`);
      return { type: 'audio', mime };
    }
    return null;
  }

  isArchiveFile(filename) {
    if (!filename) return false;
    const lower = filename.toLowerCase();
    return lower.endsWith('.zip') ||
           lower.endsWith('.tar') ||
           lower.endsWith('.tar.gz') ||
           lower.endsWith('.tgz') ||
           lower.endsWith('.tar.bz2') ||
           lower.endsWith('.tbz2') ||
           lower.endsWith('.tar.xz') ||
           lower.endsWith('.txz') ||
           lower.endsWith('.gz') ||
           lower.endsWith('.7z') ||
           lower.endsWith('.rar');
  }

  updateSelectionUI() {
    const count = this.selectedFiles.size;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.statusEl.textContent = count > 0 
      ? (isPersian ? `${count} آیتم انتخاب شده` : `${count} item(s) selected`)
      : (isPersian ? 'هیچ فایلی انتخاب نشده' : 'No files selected');

    const disabled = count === 0;
    document.getElementById('btnSftpDownload').disabled = disabled;
    document.getElementById('btnSftpEdit').disabled = count !== 1;

    const btnOpenWith = document.getElementById('btnSftpOpenWith');
    if (btnOpenWith) {
      const isSingle = count === 1;
      const selectedName = isSingle ? Array.from(this.selectedFiles)[0] : null;
      const selectedFile = selectedName ? this.currentFiles.find(f => f.filename === selectedName) : null;
      const isDir = selectedFile ? selectedFile.isDir : false;
      btnOpenWith.disabled = !(isSingle && !isDir);
    }

    const btnDelete = document.getElementById('btnSftpDelete');
    if (btnDelete) {
      btnDelete.disabled = disabled;
      if (count > 1) {
        btnDelete.title = isPersian ? `حذف تمام ${count} مورد انتخاب‌شده` : `Delete all ${count} selected items`;
      } else {
        btnDelete.title = isPersian ? `حذف موارد انتخاب‌شده` : `Delete selected item`;
      }
    }

    const btnSftpPreview = document.getElementById('btnSftpPreview');
    if (btnSftpPreview) {
      const isSingleMedia = count === 1 && !!this.isMediaFile(Array.from(this.selectedFiles)[0]);
      btnSftpPreview.disabled = !isSingleMedia;
    }

    const btnSftpExtract = document.getElementById('btnSftpExtract');
    if (btnSftpExtract) {
      const isSingleArchive = count === 1 && this.isArchiveFile(Array.from(this.selectedFiles)[0]);
      btnSftpExtract.disabled = !isSingleArchive;
    }

    const btnSftpCompress = document.getElementById('btnSftpCompress');
    if (btnSftpCompress) {
      btnSftpCompress.disabled = count === 0;
    }

    const btnCopy = document.getElementById('btnSftpCopy');
    if (btnCopy) btnCopy.disabled = disabled;

    const btnCut = document.getElementById('btnSftpCut');
    if (btnCut) btnCut.disabled = disabled;

    const btnPaste = document.getElementById('btnSftpPaste');
    if (btnPaste) btnPaste.disabled = !this.hasClipboard();

    const btnMove = document.getElementById('btnSftpMove');
    if (btnMove) btnMove.disabled = disabled;

    const chkSelectAll = document.getElementById('selectAllFiles');
    if (chkSelectAll) {
      chkSelectAll.checked = this.currentFiles.length > 0 && this.selectedFiles.size === this.currentFiles.length;
      chkSelectAll.indeterminate = this.selectedFiles.size > 0 && this.selectedFiles.size < this.currentFiles.length;
    }
  }

  async compressSelected(format = 'zip') {
    if (this.selectedFiles.size === 0) return;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const files = Array.from(this.selectedFiles);

    const defaultName = files.length === 1 
      ? files[0].replace(/\.[^/.]+$/, '') + (format === 'zip' ? '.zip' : '.tar.gz')
      : 'archive' + (format === 'zip' ? '.zip' : '.tar.gz');

    const promptMsg = isPersian 
      ? `نام فایل فشرده خروجی را وارد کنید:\n(${files.length} فایل/پوشه انتخاب شده)`
      : `Enter archive filename:\n(${files.length} item(s) selected)`;

    const archiveName = prompt(promptMsg, defaultName);
    if (!archiveName) return;

    this.updateStatus(isPersian ? `در حال فشرده‌سازی ${archiveName}...` : `Compressing into ${archiveName}...`);

    try {
      const res = await this.sendRequest({
        type: 'sftp-compress',
        dir: this.currentPath,
        files: files,
        archiveName: archiveName,
        format: archiveName.toLowerCase().endsWith('.tar.gz') || archiveName.toLowerCase().endsWith('.tgz') ? 'tar.gz' : 'zip'
      });

      if (res && res.success) {
        const succMsg = isPersian ? `فایل "${archiveName}" با موفقیت ایجاد شد ✔` : `Archive "${archiveName}" created successfully ✔`;
        this.updateStatus(succMsg);
        alert(succMsg);
        this.listDirectory(this.currentPath);
      } else {
        const errMsg = res && res.error ? res.error : 'Unknown compression error';
        alert(isPersian ? `خطا در فشرده‌سازی:\n${errMsg}` : `Compression error:\n${errMsg}`);
        this.updateStatus(isPersian ? 'خطا در فشرده‌سازی' : 'Compression failed');
      }
    } catch (err) {
      alert(`Compression error: ${err.message}`);
      this.updateStatus('Compression error');
    }
  }

  async extractArchive(filename) {
    if (!filename) {
      if (this.selectedFiles.size === 0) return;
      filename = Array.from(this.selectedFiles)[0];
    }
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const confirmMsg = isPersian 
      ? `آیا می‌خواهید فایل فشرده "${filename}" در همین مسیر (${this.currentPath}) استخراج (Extract) شود؟`
      : `Extract archive "${filename}" into current directory (${this.currentPath})?`;

    if (!confirm(confirmMsg)) return;

    const base = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
    const archivePath = base + filename;
    const destDir = this.currentPath;

    this.updateStatus(isPersian ? `در حال استخراج ${filename}...` : `Extracting ${filename}...`);

    try {
      const res = await this.sendRequest({
        type: 'sftp-extract',
        path: archivePath,
        dir: destDir
      });

      if (res && res.success) {
        const succMsg = isPersian ? `فایل "${filename}" با موفقیت استخراج شد ✔` : `Archive "${filename}" extracted successfully ✔`;
        this.updateStatus(succMsg);
        alert(succMsg);
        this.listDirectory(this.currentPath);
      } else {
        const errMsg = res && res.error ? res.error : 'Unknown extract error';
        alert(isPersian ? `خطا در استخراج فایل فشرده:\n${errMsg}` : `Extract error:\n${errMsg}`);
        this.updateStatus(isPersian ? 'خطا در استخراج آرشیو' : 'Extract failed');
      }
    } catch (err) {
      alert(`Extract error: ${err.message}`);
      this.updateStatus('Extract error');
    }
  }

  cancelUpload() {
    this.isUploadCancelled = true;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? 'آپلود توسط کاربر متوقف شد ✕' : 'Upload cancelled by user ✕');

    const speedEl = document.getElementById('uploadProgressSpeed');
    if (speedEl) speedEl.textContent = isPersian ? 'لغو شد' : 'Cancelled';

    const percentEl = document.getElementById('uploadProgressPercent');
    if (percentEl) {
      percentEl.textContent = '✕';
      percentEl.style.color = '#ef4444';
    }

    const barEl = document.getElementById('uploadProgressBar');
    if (barEl) barEl.style.background = '#ef4444';

    setTimeout(() => {
      const progressContainer = document.getElementById('sftpUploadProgressContainer');
      if (progressContainer) progressContainer.style.display = 'none';
      if (barEl) barEl.style.background = '';
      if (percentEl) percentEl.style.color = '';
      this.listDirectory(this.currentPath);
    }, 1200);
  }

  async uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    this.isUploadCancelled = false;

    const progressContainer = document.getElementById('sftpUploadProgressContainer');
    const fileNameEl = document.getElementById('uploadProgressFileName');
    const counterEl = document.getElementById('uploadProgressCounter');
    const percentEl = document.getElementById('uploadProgressPercent');
    const barEl = document.getElementById('uploadProgressBar');
    const sizeEl = document.getElementById('uploadProgressSize');
    const speedEl = document.getElementById('uploadProgressSpeed');

    if (progressContainer) {
      progressContainer.style.display = 'block';
      if (barEl) {
        barEl.style.width = '0%';
        barEl.style.background = '';
      }
      if (percentEl) {
        percentEl.textContent = '0%';
        percentEl.style.color = '';
      }
    }

    let totalBytes = 0;
    for (let i = 0; i < fileList.length; i++) {
      totalBytes += fileList[i].size;
    }
    let overallUploadedBytes = 0;
    const startTime = Date.now();

    // Fast arrayBuffer to base64 conversion avoiding FileReader overhead
    const readSliceBase64 = async (blob) => {
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      const STEP = 32768;
      for (let i = 0; i < len; i += STEP) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + STEP, len)));
      }
      return btoa(binary);
    };

    // 512 KB chunk size (4x larger to reduce network round trips)
    const chunkSize = 512 * 1024;
    // Pipelining: up to 3 chunks in flight concurrently to eliminate ping latency
    const CONCURRENCY = 3;

    for (let i = 0; i < fileList.length; i++) {
      if (this.isUploadCancelled) break;

      const file = fileList[i];
      const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + file.name;

      if (fileNameEl) fileNameEl.textContent = file.name;
      if (counterEl) counterEl.textContent = `${i + 1} / ${fileList.length}`;
      this.updateStatus(`در حال آپلود ${file.name} (${i + 1}/${fileList.length})...`);

      if (file.size <= chunkSize) {
        // Fast direct write for small files
        try {
          const base64Data = await readSliceBase64(file);
          if (this.isUploadCancelled) break;
          await this.sendRequest({
            type: 'sftp-write',
            path: targetPath,
            content: base64Data,
            isBase64: true
          });
          overallUploadedBytes += file.size;
        } catch (err) {
          if (!this.isUploadCancelled) alert(`خطا در آپلود ${file.name}: ${err.message}`);
          break;
        }

        const percent = totalBytes > 0 ? Math.round((overallUploadedBytes / totalBytes) * 100) : 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? overallUploadedBytes / elapsed : 0;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
        if (sizeEl) sizeEl.textContent = `${this.formatBytes(overallUploadedBytes)} / ${this.formatBytes(totalBytes)}`;
        if (speedEl) speedEl.textContent = `${this.formatBytes(speed)}/s`;
      } else {
        // High-speed pipelined chunk upload for large files
        let initRes;
        try {
          initRes = await this.sendRequest({ type: 'sftp-chunk-init', path: targetPath });
        } catch (e) {
          initRes = null;
        }

        if (initRes && initRes.success && initRes.uploadId) {
          const uploadId = initRes.uploadId;
          const inFlight = new Set();
          let uploadError = null;

          for (let offset = 0; offset < file.size; offset += chunkSize) {
            if (this.isUploadCancelled || uploadError) break;

            const slice = file.slice(offset, offset + chunkSize);
            const sliceOffset = offset;

            const task = (async () => {
              const chunkBase64 = await readSliceBase64(slice);
              if (this.isUploadCancelled || uploadError) return;

              await this.sendRequest({
                type: 'sftp-chunk-write',
                uploadId: uploadId,
                chunk: chunkBase64,
                offset: sliceOffset
              });

              overallUploadedBytes += slice.size;
              const percent = totalBytes > 0 ? Math.min(100, Math.round((overallUploadedBytes / totalBytes) * 100)) : 100;
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = elapsed > 0 ? overallUploadedBytes / elapsed : 0;

              if (percentEl) percentEl.textContent = `${percent}%`;
              if (barEl) barEl.style.width = `${percent}%`;
              if (sizeEl) sizeEl.textContent = `${this.formatBytes(overallUploadedBytes)} / ${this.formatBytes(totalBytes)}`;
              if (speedEl) speedEl.textContent = `${this.formatBytes(speed)}/s`;
            })().catch(err => {
              uploadError = err;
            });

            inFlight.add(task);
            task.finally(() => inFlight.delete(task));

            if (inFlight.size >= CONCURRENCY) {
              await Promise.race(inFlight);
            }
          }

          await Promise.all(inFlight);

          try {
            await this.sendRequest({ type: 'sftp-chunk-end', uploadId });
          } catch (e) {}

          if (uploadError && !this.isUploadCancelled) {
            alert(`خطا در آپلود ${file.name}: ${uploadError.message}`);
            break;
          }
        } else {
          // Direct write fallback
          try {
            const base64Data = await readSliceBase64(file);
            if (this.isUploadCancelled) break;
            await this.sendRequest({
              type: 'sftp-write',
              path: targetPath,
              content: base64Data,
              isBase64: true
            });
            overallUploadedBytes += file.size;
          } catch (err) {
            if (!this.isUploadCancelled) alert(`خطا در آپلود ${file.name}: ${err.message}`);
            break;
          }
        }
      }
    }

    if (this.isUploadCancelled) {
      return;
    }

    if (percentEl) percentEl.textContent = '100% ✔';
    if (barEl) barEl.style.width = '100%';
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (speedEl) speedEl.textContent = isPersian ? 'تکمیل شد' : 'Complete';
    this.updateStatus(isPersian ? 'تمام فایل‌ها با موفقیت آپلود شدند ✔' : 'All files uploaded successfully ✔');

    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
      if (barEl) barEl.style.width = '0%';
      this.listDirectory(this.currentPath);
    }, 1500);
  }

  cancelDownload() {
    this.cancelOperation();
  }

  cancelOperation() {
    this.isDownloadCancelled = true;
    this.isOperationCancelled = true;
    if (this.activeDownloadController) {
      try { this.activeDownloadController.abort(); } catch (e) {}
      this.activeDownloadController = null;
    }
    const progressContainer = document.getElementById('sftpDownloadProgressContainer');
    if (progressContainer) progressContainer.style.display = 'none';
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? 'عملیات لغو شد ⚠️' : 'Operation cancelled ⚠️');
  }

  async downloadFile(filename, isDir) {
    if (isDir === undefined) {
      const fileObj = this.currentFiles.find(f => f.filename === filename);
      isDir = fileObj ? (fileObj.attrs && fileObj.attrs.isDirectory) : false;
    }

    if (isDir) {
      return this.downloadDirectory(filename);
    }

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const fileObj = this.currentFiles.find(f => f.filename === filename);

    this.isDownloadCancelled = false;
    this.activeDownloadController = new AbortController();
    const signal = this.activeDownloadController.signal;

    // UI Progress Elements
    const progressContainer = document.getElementById('sftpDownloadProgressContainer');
    const uploadContainer = document.getElementById('sftpUploadProgressContainer');
    const pulseIconEl = document.getElementById('downloadProgressPulseIcon');
    const fileNameEl = document.getElementById('downloadProgressFileName');
    const counterEl = document.getElementById('downloadProgressCounter');
    const percentEl = document.getElementById('downloadProgressPercent');
    const barEl = document.getElementById('downloadProgressBar');
    const sizeEl = document.getElementById('downloadProgressSize');
    const speedEl = document.getElementById('downloadProgressSpeed');

    if (pulseIconEl) pulseIconEl.textContent = '📥';

    if (progressContainer) {
      if (uploadContainer && uploadContainer.style.display !== 'none') {
        progressContainer.classList.add('has-upload-active');
      } else {
        progressContainer.classList.remove('has-upload-active');
      }
      progressContainer.style.display = 'block';
    }

    if (fileNameEl) fileNameEl.textContent = filename;
    if (percentEl) percentEl.textContent = '0%';
    if (barEl) barEl.style.width = '0%';
    if (sizeEl) sizeEl.textContent = '0 B / 0 B';
    if (speedEl) speedEl.textContent = '0 KB/s';

    const activeSession = this.activeSessionId ? this.sessions.get(this.activeSessionId) : null;
    const bridgeSessionId = activeSession ? activeSession.bridgeSessionId : null;
    const bridgeUrl = (activeSession && activeSession.bridgeUrl) ? activeSession.bridgeUrl : this.bridgeUrl;

    try {
      if (bridgeSessionId) {
        let base = (bridgeUrl || 'ws://localhost:3000/ws')
          .replace(/^ws:\/\//i, 'http://')
          .replace(/^wss:\/\//i, 'https://')
          .replace(/\/ws\/?$/i, '');
        const streamUrl = `${base}/stream?sessionId=${encodeURIComponent(bridgeSessionId)}&path=${encodeURIComponent(targetPath)}`;

        // Determine total size
        let totalSize = (fileObj && fileObj.attrs && fileObj.attrs.size) ? fileObj.attrs.size : 0;
        if (!totalSize) {
          try {
            const headRes = await fetch(streamUrl, { method: 'HEAD', signal });
            const cl = headRes.headers.get('content-length');
            if (cl) totalSize = parseInt(cl, 10);
          } catch (e) {}
        }

        // Multi-segment configuration
        const numThreads = (totalSize >= 4 * 1024 * 1024) ? 4 : 1;
        if (counterEl) {
          counterEl.textContent = numThreads > 1
            ? (isPersian ? `دانلود پرسرعت (${numThreads} رشته موازی) ⚡` : `Multi-segment (${numThreads} parallel threads) ⚡`)
            : (isPersian ? 'دانلود مستقیم استریم ⚡' : 'High-speed stream ⚡');
        }

        const segments = [];
        if (numThreads > 1 && totalSize > 0) {
          const segSize = Math.ceil(totalSize / numThreads);
          for (let i = 0; i < numThreads; i++) {
            const start = i * segSize;
            const end = Math.min(start + segSize - 1, totalSize - 1);
            segments.push({ start, end });
          }
        } else {
          segments.push({ start: 0, end: totalSize > 0 ? totalSize - 1 : undefined });
        }

        let totalDownloaded = 0;
        let lastTime = Date.now();
        let lastBytes = 0;
        const segmentData = new Array(segments.length);

        const onChunkReceived = (chunkLength) => {
          if (this.isDownloadCancelled) return;
          totalDownloaded += chunkLength;
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.4) {
            const diff = totalDownloaded - lastBytes;
            const speed = diff / elapsed;
            lastTime = now;
            lastBytes = totalDownloaded;
            if (speedEl) speedEl.textContent = `${this.formatBytes(speed)}/s`;
          }

          if (totalSize > 0) {
            const pct = Math.min(99, Math.floor((totalDownloaded / totalSize) * 100));
            if (percentEl) percentEl.textContent = `${pct}%`;
            if (barEl) barEl.style.width = `${pct}%`;
            if (sizeEl) sizeEl.textContent = `${this.formatBytes(totalDownloaded)} / ${this.formatBytes(totalSize)}`;
          } else {
            if (sizeEl) sizeEl.textContent = `${this.formatBytes(totalDownloaded)}`;
          }
        };

        // Fetch segments in parallel
        await Promise.all(segments.map(async (seg, idx) => {
          const headers = (seg.end !== undefined) ? { Range: `bytes=${seg.start}-${seg.end}` } : {};
          const response = await fetch(streamUrl, { headers, signal });
          if (!response.ok && response.status !== 206) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
          }

          const reader = response.body.getReader();
          const chunks = [];
          while (true) {
            if (this.isDownloadCancelled) {
              reader.cancel();
              break;
            }
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            onChunkReceived(value.byteLength);
          }
          segmentData[idx] = chunks;
        }));

        if (this.isDownloadCancelled) return;

        // Concatenate all segments into final Blob
        const allBuffers = segmentData.flat();
        const blob = new Blob(allBuffers, { type: 'application/octet-stream' });

        if (percentEl) percentEl.textContent = '100% ✔';
        if (barEl) barEl.style.width = '100%';
        if (speedEl) speedEl.textContent = isPersian ? 'تکمیل شد' : 'Complete';
        this.updateStatus(isPersian ? `دانلود ${filename} با موفقیت پایان یافت ✔` : `Downloaded ${filename} successfully ✔`);

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        setTimeout(() => {
          if (progressContainer) progressContainer.style.display = 'none';
        }, 1500);
        return;
      }

      // Fallback via WebSocket
      const res = await this.sendRequest({ type: 'sftp-read', path: targetPath, maxBytes: 500 * 1024 * 1024 }, 180000);
      if (this.isDownloadCancelled) return;

      let blob;
      if (res.isBinary) {
        const byteCharacters = atob(res.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/octet-stream' });
      } else {
        blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (percentEl) percentEl.textContent = '100% ✔';
      if (barEl) barEl.style.width = '100%';
      this.updateStatus(isPersian ? `دانلود ${filename} انجام شد ✔` : `Downloaded ${filename} successfully ✔`);
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);

    } catch (err) {
      if (err.name === 'AbortError' || this.isDownloadCancelled) {
        return;
      }
      if (progressContainer) progressContainer.style.display = 'none';
      alert((isPersian ? 'خطا در دانلود فایل: ' : 'Error downloading file: ') + err.message);
      this.updateStatus(`Download error: ${err.message}`);
    } finally {
      this.activeDownloadController = null;
    }
  }

  async downloadDirectory(folderName) {
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + folderName;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? `در حال آماده‌سازی و فشرده‌سازی پوشه "${folderName}" در سرور...` : `Archiving folder "${folderName}" on server...`);

    const chunks = [];
    let totalBytes = 0;
    let downloadFilename = `${folderName}.zip`;

    try {
      await this.sendRequest(
        { type: 'sftp-download-dir', path: targetPath },
        {
          timeout: 300000,
          onMessage: (msg) => {
            if (msg.type === 'sftp-download-dir-progress') {
              this.updateStatus(isPersian ? `در حال فشرده‌سازی پوشه "${folderName}"...` : `Compressing folder "${folderName}" on server...`);
            } else if (msg.type === 'sftp-download-dir-start') {
              totalBytes = msg.totalSize || 0;
              if (msg.filename) downloadFilename = msg.filename;
              this.updateStatus(isPersian 
                ? `دانلود پوشه "${folderName}" (${this.formatBytes(totalBytes)})...` 
                : `Downloading folder "${folderName}" (${this.formatBytes(totalBytes)})...`);
            } else if (msg.type === 'sftp-download-dir-chunk') {
              const binaryString = atob(msg.chunk);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              chunks.push(bytes);

              const current = msg.streamedBytes || 0;
              const pct = totalBytes > 0 ? Math.min(100, Math.round((current / totalBytes) * 100)) : 0;
              this.updateStatus(isPersian 
                ? `در حال دریافت "${folderName}": %${pct} (${this.formatBytes(current)} از ${this.formatBytes(totalBytes)})` 
                : `Downloading "${folderName}": ${pct}% (${this.formatBytes(current)} of ${this.formatBytes(totalBytes)})`);
            }
          }
        }
      );

      if (chunks.length === 0) {
        throw new Error('No data received for folder archive');
      }

      const mimeType = downloadFilename.endsWith('.tar.gz') ? 'application/gzip' : 'application/zip';
      const blob = new Blob(chunks, { type: mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const sizeStr = totalBytes > 0 ? ` (${this.formatBytes(totalBytes)})` : '';
      this.updateStatus(isPersian ? `دانلود پوشه "${folderName}" با موفقیت تکمیل شد${sizeStr} ✔` : `Folder "${folderName}" downloaded successfully${sizeStr} ✔`);
    } catch (err) {
      console.error('Directory download failed:', err);
      alert((isPersian ? 'خطا در دانلود پوشه: ' : 'Error downloading folder: ') + err.message);
      this.updateStatus(isPersian ? 'خطا در دانلود پوشه' : 'Error downloading folder');
    }
  }

  async editFile(filename) {
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? `در حال باز کردن ${filename}...` : `Opening ${filename}...`);

    try {
      const res = await this.sendRequest({ type: 'sftp-read', path: targetPath });
      if (res.isBinary) {
        if (this.isMediaFile(filename)) {
          this.previewMedia(filename);
          return;
        }
        alert(isPersian ? 'این فایل باینری است و امکان ویرایش متنی آن وجود ندارد.' : 'This file is binary and cannot be edited in text editor.');
        return;
      }

      document.getElementById('editorFilePath').textContent = targetPath;
      document.getElementById('editorTextarea').value = res.content;
      document.getElementById('editorModal').classList.add('active');
    } catch (err) {
      alert((isPersian ? 'خطا در باز کردن فایل: ' : 'Error opening file: ') + err.message);
    }
  }

  async previewMedia(filename) {
    if (!filename) return;
    const media = this.isMediaFile(filename);
    if (!media) return;

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;

    const modal = document.getElementById('mediaModal');
    const container = document.getElementById('mediaContainer');
    const pathEl = document.getElementById('mediaFilePath');
    const sizeEl = document.getElementById('mediaFileSize');
    const iconEl = document.getElementById('mediaTypeIcon');
    const btnDl = document.getElementById('btnMediaDownload');

    if (pathEl) pathEl.textContent = filename;
    if (iconEl) iconEl.textContent = media.type === 'image' ? '🖼️' : (media.type === 'video' ? '🎬' : '🎵');

    const fileObj = this.currentFiles.find(f => f.filename === filename);
    if (sizeEl) sizeEl.textContent = fileObj ? this.formatBytes(fileObj.attrs.size) : '';

    if (container) {
      container.innerHTML = `
        <div class="media-loading-spinner">
          <div style="font-size: 36px; animation: spinAudio 2s linear infinite;">⏳</div>
          <div>${isPersian ? 'در حال دریافت و آماده‌سازی فایل رسانه...' : 'Loading media file...'}</div>
        </div>
      `;
    }

    if (modal) modal.classList.add('active');

    if (btnDl) {
      btnDl.onclick = () => this.downloadFile(filename);
    }

    const activeSession = this.activeSessionId ? this.sessions.get(this.activeSessionId) : null;
    const bridgeSessionId = activeSession ? activeSession.bridgeSessionId : null;
    const bridgeUrl = (activeSession && activeSession.bridgeUrl) ? activeSession.bridgeUrl : this.bridgeUrl;

    // Use direct HTTP streaming endpoint if active bridge session is available (unlimited size, instant range seek)
    if (bridgeSessionId) {
      let base = (bridgeUrl || 'ws://localhost:3000/ws')
        .replace(/^ws:\/\//i, 'http://')
        .replace(/^wss:\/\//i, 'https://')
        .replace(/\/ws\/?$/i, '');
      const streamUrl = `${base}/stream?sessionId=${encodeURIComponent(bridgeSessionId)}&path=${encodeURIComponent(targetPath)}`;

      if (this.currentMediaUrl) {
        URL.revokeObjectURL(this.currentMediaUrl);
        this.currentMediaUrl = null;
      }

      if (media.type === 'video') {
        container.innerHTML = `<video src="${streamUrl}" class="media-preview-video" controls autoplay playsinline></video>`;
        this.updateStatus(isPersian ? `پخش زنده استریم ${filename} ✔` : `Streaming ${filename} ✔`);
        return;
      } else if (media.type === 'audio') {
        container.innerHTML = `
          <div class="media-audio-card">
            <div class="media-audio-disc">🎵</div>
            <div style="font-weight: 600; color: var(--text-main); font-size: 15px; margin-bottom: 4px;">${filename}</div>
            <div style="color: #64748b; font-size: 12px; margin-bottom: 14px;">${fileObj ? this.formatBytes(fileObj.attrs.size) : ''}</div>
            <audio src="${streamUrl}" controls autoplay></audio>
          </div>
        `;
        this.updateStatus(isPersian ? `پخش زنده استریم ${filename} ✔` : `Streaming ${filename} ✔`);
        return;
      } else if (media.type === 'image') {
        container.innerHTML = `<img src="${streamUrl}" class="media-preview-img" alt="${filename}">`;
        this.updateStatus(isPersian ? `نمایش ${filename} ✔` : `Previewing ${filename} ✔`);
        return;
      }
    }

    try {
      const res = await this.sendRequest({
        type: 'sftp-read',
        path: targetPath,
        maxBytes: 500 * 1024 * 1024
      });

      if (!res || !res.content) {
        throw new Error(res && res.error ? res.error : 'Empty response');
      }

      let blob;
      if (res.isBinary) {
        const byteCharacters = atob(res.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: media.mime });
      } else {
        blob = new Blob([res.content], { type: media.mime });
      }

      if (this.currentMediaUrl) {
        URL.revokeObjectURL(this.currentMediaUrl);
      }
      this.currentMediaUrl = URL.createObjectURL(blob);

      if (media.type === 'image') {
        container.innerHTML = `<img src="${this.currentMediaUrl}" class="media-preview-img" alt="${filename}">`;
      } else if (media.type === 'video') {
        container.innerHTML = `<video src="${this.currentMediaUrl}" class="media-preview-video" controls autoplay playsinline></video>`;
      } else if (media.type === 'audio') {
        container.innerHTML = `
          <div class="media-audio-card">
            <div class="media-audio-disc">🎵</div>
            <div style="font-weight: 600; color: var(--text-main); font-size: 15px; margin-bottom: 4px;">${filename}</div>
            <div style="color: #64748b; font-size: 12px; margin-bottom: 14px;">${fileObj ? this.formatBytes(fileObj.attrs.size) : ''}</div>
            <audio src="${this.currentMediaUrl}" controls autoplay></audio>
          </div>
        `;
      }

      this.updateStatus(isPersian ? `نمایش ${filename} ✔` : `Previewing ${filename} ✔`);
    } catch (err) {
      alert((isPersian ? 'خطا در بارگذاری رسانه: ' : 'Error loading media: ') + err.message);
      this.closeMediaModal();
    }
  }

  closeMediaModal() {
    const modal = document.getElementById('mediaModal');
    const container = document.getElementById('mediaContainer');
    if (modal) modal.classList.remove('active');
    if (container) container.innerHTML = '';
    if (this.currentMediaUrl) {
      URL.revokeObjectURL(this.currentMediaUrl);
      this.currentMediaUrl = null;
    }
  }

  async saveEditedFile() {
    const filePath = document.getElementById('editorFilePath').textContent;
    const content = document.getElementById('editorTextarea').value;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    this.updateStatus(isPersian ? `در حال ذخیره ${filePath}...` : `Saving ${filePath}...`);
    try {
      await this.sendRequest({
        type: 'sftp-write',
        path: filePath,
        content: content,
        isBase64: false
      });
      alert(isPersian ? 'فایل با موفقیت روی سرور ذخیره شد ✔' : 'File saved successfully on server ✔');
      document.getElementById('editorModal').classList.remove('active');
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert((isPersian ? 'خطا در ذخیره فایل: ' : 'Error saving file: ') + err.message);
    }
  }

  async createNewFile() {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const name = prompt(isPersian ? 'نام فایل جدید را وارد کنید:' : 'Enter new filename:');
    if (!name) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + name;
    try {
      await this.sendRequest({ type: 'sftp-write', path: targetPath, content: '', isBase64: false });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert((isPersian ? 'خطا: ' : 'Error: ') + err.message);
    }
  }

  async createNewFolder() {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const name = prompt(isPersian ? 'نام پوشه جدید را وارد کنید:' : 'Enter new folder name:');
    if (!name) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + name;
    try {
      await this.sendRequest({ type: 'sftp-mkdir', path: targetPath });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert((isPersian ? 'خطا: ' : 'Error: ') + err.message);
    }
  }

  async removeDirectoryRecursive(dirPath) {
    try {
      await this.sendRequest({ type: 'sftp-rmdir', path: dirPath });
    } catch (err) {
      // Client-side fallback: traverse and delete child contents
      try {
        const res = await this.sendRequest({ type: 'sftp-list', path: dirPath });
        const files = res.files || [];
        const base = dirPath.endsWith('/') ? dirPath : dirPath + '/';
        for (const f of files) {
          const childPath = base + f.filename;
          const isDir = f.attrs && f.attrs.isDirectory;
          if (isDir) {
            await this.removeDirectoryRecursive(childPath);
          } else {
            await this.sendRequest({ type: 'sftp-unlink', path: childPath });
          }
        }
        await this.sendRequest({ type: 'sftp-rmdir', path: dirPath });
      } catch (nestedErr) {
        throw new Error(nestedErr.message || err.message);
      }
    }
  }

  async deleteItem(filename, isDir) {
    if (!filename) {
      return this.deleteSelected();
    }
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const confirmMsg = isPersian ? `آیا از حذف "${filename}" اطمینان دارید؟` : `Are you sure you want to delete "${filename}"?`;
    if (!confirm(confirmMsg)) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    try {
      this.updateStatus(isPersian ? `در حال حذف "${filename}"...` : `Deleting "${filename}"...`);
      if (isDir) {
        await this.removeDirectoryRecursive(targetPath);
      } else {
        await this.sendRequest({ type: 'sftp-unlink', path: targetPath });
      }
      this.selectedFiles.delete(filename);
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert((isPersian ? 'خطا در حذف: ' : 'Error deleting: ') + err.message);
      this.updateStatus((isPersian ? 'خطا: ' : 'Error: ') + err.message);
    }
  }

  async deleteSelected() {
    if (this.selectedFiles.size === 0) return;

    const count = this.selectedFiles.size;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    
    let confirmMsg = '';
    if (count === 1) {
      const fname = Array.from(this.selectedFiles)[0];
      confirmMsg = isPersian ? `آیا از حذف "${fname}" اطمینان دارید؟` : `Are you sure you want to delete "${fname}"?`;
    } else {
      confirmMsg = isPersian 
        ? `آیا از حذف تمام ${count} مورد انتخاب‌شده اطمینان دارید؟` 
        : `Are you sure you want to delete all ${count} selected items?`;
    }

    if (!confirm(confirmMsg)) return;

    const itemsToDelete = Array.from(this.selectedFiles).map(name => {
      const found = this.currentFiles.find(f => f.filename === name);
      return {
        filename: name,
        isDir: found && found.attrs ? !!found.attrs.isDirectory : false
      };
    });

    this.updateStatus(isPersian ? `در حال حذف ${count} مورد...` : `Deleting ${count} item(s)...`);

    let failedCount = 0;
    const base = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';

    for (const item of itemsToDelete) {
      const targetPath = base + item.filename;
      try {
        if (item.isDir) {
          await this.removeDirectoryRecursive(targetPath);
        } else {
          await this.sendRequest({ type: 'sftp-unlink', path: targetPath });
        }
        this.selectedFiles.delete(item.filename);
      } catch (err) {
        console.error(`Failed to delete ${item.filename}:`, err);
        failedCount++;
      }
    }

    this.listDirectory(this.currentPath);

    if (failedCount > 0) {
      alert(isPersian 
        ? `خطا: ${failedCount} مورد به دلیل مشکل دسترسی یا خطا حذف نشدند.` 
        : `Warning: ${failedCount} item(s) could not be deleted.`);
    }
  }

  async renameItem(oldFilename) {
    if (!oldFilename) {
      if (this.selectedFiles.size === 0) return;
      oldFilename = Array.from(this.selectedFiles)[0];
    }
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const promptMsg = isPersian ? `نام جدید را برای "${oldFilename}" وارد کنید:` : `Enter new name for "${oldFilename}":`;
    const newFilename = prompt(promptMsg, oldFilename);
    if (!newFilename || newFilename === oldFilename) return;

    const base = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
    const oldPath = base + oldFilename;
    const newPath = base + newFilename;

    try {
      await this.sendRequest({ type: 'sftp-rename', oldPath, newPath });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`Error renaming: ${err.message}`);
    }
  }

  async changePermissions(targetFilename) {
    const filename = targetFilename || (this.selectedFiles.size > 0 ? Array.from(this.selectedFiles)[0] : null);
    if (!filename) return;

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const promptMsg = isPersian 
      ? `مجوز دسترسی جدید (Octal) را برای "${filename}" وارد کنید (مثلاً 0755 یا 0644):`
      : `Enter new permission mode (octal) for "${filename}" (e.g. 0755 or 0644):`;
    const newPerm = prompt(promptMsg, '0755');
    if (!newPerm) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    try {
      await this.sendRequest({ type: 'sftp-chmod', path: targetPath, mode: newPerm });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`Error changing permissions: ${err.message}`);
    }
  }

  hasClipboard() {
    return !!(this.clipboard && this.clipboard.files && this.clipboard.files.length > 0);
  }

  resolveActionTarget(targetFilename) {
    let names = [];
    if (targetFilename) {
      names = [targetFilename];
    } else if (this.selectedFiles.size > 0) {
      names = Array.from(this.selectedFiles);
    }
    if (names.length === 0) return [];

    const base = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
    return names.map(name => {
      const fileObj = this.currentFiles.find(f => f.filename === name);
      const isDir = fileObj ? !!(fileObj.attrs && fileObj.attrs.isDirectory) : false;
      return {
        filename: name,
        fullPath: base + name,
        isDir
      };
    });
  }

  copySelection(targetFilename) {
    const filesToCopy = this.resolveActionTarget(targetFilename);
    if (filesToCopy.length === 0) return;

    const activeSession = this.activeSessionId ? this.sessions.get(this.activeSessionId) : null;
    const sessionName = activeSession ? activeSession.name : 'SFTP';

    this.clipboard = {
      action: 'copy',
      sessionId: this.activeSessionId,
      sessionName: sessionName,
      bridgeUrl: (activeSession && activeSession.bridgeUrl) ? activeSession.bridgeUrl : this.bridgeUrl,
      bridgeSessionId: activeSession ? activeSession.bridgeSessionId : null,
      sourceDir: this.currentPath,
      files: filesToCopy
    };

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const msg = isPersian
      ? `${filesToCopy.length} مورد کپی شد (${sessionName}). به مسیر مقصد رفته و Paste را بزنید.`
      : `${filesToCopy.length} item(s) copied (${sessionName}). Navigate to destination and click Paste.`;
    this.updateStatus(msg);
    this.updateSelectionUI();
    this.renderFiles(this.currentFiles);
  }

  cutSelection(targetFilename) {
    const filesToCut = this.resolveActionTarget(targetFilename);
    if (filesToCut.length === 0) return;

    const activeSession = this.activeSessionId ? this.sessions.get(this.activeSessionId) : null;
    const sessionName = activeSession ? activeSession.name : 'SFTP';

    this.clipboard = {
      action: 'cut',
      sessionId: this.activeSessionId,
      sessionName: sessionName,
      bridgeUrl: (activeSession && activeSession.bridgeUrl) ? activeSession.bridgeUrl : this.bridgeUrl,
      bridgeSessionId: activeSession ? activeSession.bridgeSessionId : null,
      sourceDir: this.currentPath,
      files: filesToCut
    };

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const msg = isPersian
      ? `${filesToCut.length} مورد آماده برش و انتقال (${sessionName}). به مسیر مقصد رفته و Paste را بزنید.`
      : `${filesToCut.length} item(s) cut for move (${sessionName}). Navigate to destination and click Paste.`;
    this.updateStatus(msg);
    this.updateSelectionUI();
    this.renderFiles(this.currentFiles);
  }

  generateCopyName(filename, isDir) {
    const existingNames = new Set(this.currentFiles.map(f => f.filename));

    if (isDir) {
      let candidate = `${filename} (copy)`;
      let count = 2;
      while (existingNames.has(candidate)) {
        candidate = `${filename} (copy ${count++})`;
      }
      return candidate;
    }

    const lastDot = filename.lastIndexOf('.');
    let base = filename;
    let ext = '';
    if (lastDot > 0) {
      base = filename.substring(0, lastDot);
      ext = filename.substring(lastDot);
    }

    let candidate = `${base} (copy)${ext}`;
    let count = 2;
    while (existingNames.has(candidate)) {
      candidate = `${base} (copy ${count++})${ext}`;
    }
    return candidate;
  }

  async pasteClipboard(destDirOverride) {
    if (!this.hasClipboard()) return;

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const destDir = destDirOverride || this.currentPath;
    const destBase = destDir.endsWith('/') ? destDir : destDir + '/';
    const { action, sessionId: srcSessionId, sessionName: srcSessionName, bridgeUrl: srcBridgeUrl, sourceDir, files } = this.clipboard;

    const isCrossServer = srcSessionId && this.activeSessionId && (srcSessionId !== this.activeSessionId);

    // Prevent cutting into same folder on same server
    if (!isCrossServer && action === 'cut' && sourceDir === destDir) {
      this.updateStatus(isPersian ? 'مسیر مبدا و مقصد یکسان است.' : 'Source and destination directories are identical.');
      return;
    }

    const items = files.map(item => {
      let targetName = item.filename;
      if (!isCrossServer && action === 'copy' && sourceDir === destDir) {
        targetName = this.generateCopyName(item.filename, item.isDir);
      }
      return {
        src: item.fullPath,
        dest: destBase + targetName,
        filename: targetName,
        isDir: item.isDir
      };
    });

    // Setup Progress UI
    const progressContainer = document.getElementById('sftpDownloadProgressContainer');
    const uploadContainer = document.getElementById('sftpUploadProgressContainer');
    const pulseIconEl = document.getElementById('downloadProgressPulseIcon');
    const fileNameEl = document.getElementById('downloadProgressFileName');
    const counterEl = document.getElementById('downloadProgressCounter');
    const percentEl = document.getElementById('downloadProgressPercent');
    const barEl = document.getElementById('downloadProgressBar');
    const sizeEl = document.getElementById('downloadProgressSize');
    const speedEl = document.getElementById('downloadProgressSpeed');

    this.isOperationCancelled = false;
    this.activeDownloadController = new AbortController();

    if (progressContainer) {
      if (uploadContainer && uploadContainer.style.display !== 'none') {
        progressContainer.classList.add('has-upload-active');
      } else {
        progressContainer.classList.remove('has-upload-active');
      }
      progressContainer.style.display = 'block';
    }

    try {
      if (!isCrossServer) {
        // --- CASE 1: OS Native Copy/Move on Same Server ---
        if (pulseIconEl) pulseIconEl.textContent = action === 'copy' ? '📋' : '🚚';
        if (fileNameEl) {
          fileNameEl.textContent = items.length === 1 ? items[0].filename : (isPersian ? `${items.length} فایل/پوشه` : `${items.length} items`);
        }
        if (counterEl) {
          counterEl.textContent = action === 'copy'
            ? (isPersian ? 'کپی داخلی سیستم‌عامل (OS Native cp ⚡)' : 'Native OS Fast Copy (cp -r) ⚡')
            : (isPersian ? 'انتقال داخلی سیستم‌عامل (OS Native mv ⚡)' : 'Native OS Fast Move (mv) ⚡');
        }
        if (percentEl) percentEl.textContent = '50%';
        if (barEl) barEl.style.width = '50%';
        if (sizeEl) sizeEl.textContent = isPersian ? `${items.length} مورد در حال پردازش...` : `Processing ${items.length} item(s)...`;
        if (speedEl) speedEl.textContent = isPersian ? 'مستقیم سیستم‌عامل' : 'OS Direct';

        if (action === 'copy') {
          await this.sendRequest({ type: 'sftp-copy', items }, 180000);
        } else {
          await this.sendRequest({ type: 'sftp-move', items }, 180000);
          this.clipboard = null;
        }

        if (percentEl) percentEl.textContent = '100% ✔';
        if (barEl) barEl.style.width = '100%';
        if (sizeEl) sizeEl.textContent = isPersian ? `${items.length} مورد با موفقیت انجام شد` : `${items.length} item(s) completed`;
        if (speedEl) speedEl.textContent = isPersian ? 'تکمیل شد ✔' : 'Completed ✔';

        const successMsg = action === 'copy'
          ? (isPersian ? `${items.length} مورد با دستور داخلی سیستم‌عامل کپی شد ✔` : `${items.length} item(s) copied natively ✔`)
          : (isPersian ? `${items.length} مورد با دستور داخلی سیستم‌عامل منتقل شد ✔` : `${items.length} item(s) moved natively ✔`);
        this.updateStatus(successMsg);

      } else {
        // --- CASE 2: Cross-Server SFTP Transfer ---
        const srcSession = this.sessions.get(srcSessionId);
        const destSession = this.sessions.get(this.activeSessionId);

        if (!srcSession || !srcSession.isConnected) {
          throw new Error(isPersian ? 'نشست سرور مبدا قطع شده است' : 'Source SFTP session is disconnected');
        }

        if (pulseIconEl) pulseIconEl.textContent = '🌐';
        const srcTitle = srcSession.name || 'Server A';
        const destTitle = destSession ? (destSession.name || 'Server B') : 'Server B';
        if (counterEl) {
          counterEl.textContent = isPersian
            ? `انتقال بین دو سرور SFTP (${srcTitle} ➔ ${destTitle}) ⚡`
            : `Cross-Server SFTP Transfer (${srcTitle} ➔ ${destTitle}) ⚡`;
        }

        const srcBase = (srcBridgeUrl || 'ws://localhost:3000/ws')
          .replace(/^ws:\/\//i, 'http://')
          .replace(/^wss:\/\//i, 'https://')
          .replace(/\/ws\/?$/i, '');

        const destBase = (this.bridgeUrl || 'ws://localhost:3000/ws')
          .replace(/^ws:\/\//i, 'http://')
          .replace(/^wss:\/\//i, 'https://')
          .replace(/\/ws\/?$/i, '');

        const activeDestBridgeSessionId = destSession ? destSession.bridgeSessionId : null;

        for (let idx = 0; idx < items.length; idx++) {
          if (this.isOperationCancelled) break;
          const item = items[idx];

          if (fileNameEl) fileNameEl.textContent = `${item.filename} (${idx + 1}/${items.length})`;
          if (percentEl) percentEl.textContent = '0%';
          if (barEl) barEl.style.width = '0%';

          if (item.isDir) {
            await this.sendRequest({ type: 'sftp-mkdir', path: item.dest });
            await this.transferRemoteDirectory(srcSessionId, item.src, item.dest, srcBase, destBase, activeDestBridgeSessionId);
          } else {
            await this.transferRemoteFile(srcSessionId, item.src, item.dest, srcBase, destBase, activeDestBridgeSessionId, (transferred, total, speed) => {
              if (total > 0) {
                const pct = Math.min(99, Math.round((transferred / total) * 100));
                if (percentEl) percentEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
                if (sizeEl) sizeEl.textContent = `${this.formatBytes(transferred)} / ${this.formatBytes(total)}`;
              } else {
                if (sizeEl) sizeEl.textContent = `${this.formatBytes(transferred)}`;
              }
              if (speedEl) speedEl.textContent = `${this.formatBytes(speed)}/s`;
            });
          }

          if (action === 'cut' && !this.isOperationCancelled) {
            try {
              if (item.isDir) {
                await this.sendRequestToSession(srcSessionId, { type: 'sftp-rmdir', path: item.src });
              } else {
                await this.sendRequestToSession(srcSessionId, { type: 'sftp-unlink', path: item.src });
              }
            } catch (e) {}
          }
        }

        if (this.isOperationCancelled) return;

        if (action === 'cut') this.clipboard = null;

        if (percentEl) percentEl.textContent = '100% ✔';
        if (barEl) barEl.style.width = '100%';
        if (speedEl) speedEl.textContent = isPersian ? 'تکمیل شد ✔' : 'Completed ✔';
        this.updateStatus(isPersian ? `انتقال ${items.length} مورد بین سرورها با موفقیت پایان یافت ✔` : `Transferred ${items.length} item(s) between servers successfully ✔`);
      }

      this.listDirectory(this.currentPath);
      this.updateSelectionUI();
    } catch (err) {
      if (this.isOperationCancelled) return;
      alert((isPersian ? 'خطا در عملیات: ' : 'Operation failed: ') + err.message);
      this.updateStatus(`Error: ${err.message}`);
    } finally {
      this.activeDownloadController = null;
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);
    }
  }

  async transferRemoteFile(srcSessionId, srcPath, destPath, srcBase, destBase, destBridgeSessionId, onProgress) {
    const srcSession = this.sessions.get(srcSessionId);
    const srcBridgeSessionId = srcSession ? srcSession.bridgeSessionId : null;
    const signal = this.activeDownloadController ? this.activeDownloadController.signal : null;

    if (srcBridgeSessionId && destBridgeSessionId) {
      const srcUrl = `${srcBase}/stream?sessionId=${encodeURIComponent(srcBridgeSessionId)}&path=${encodeURIComponent(srcPath)}`;
      const destUrl = `${destBase}/stream?sessionId=${encodeURIComponent(destBridgeSessionId)}&path=${encodeURIComponent(destPath)}`;

      const response = await fetch(srcUrl, { signal });
      if (!response.ok) {
        throw new Error(`Source server returned ${response.status}: ${response.statusText}`);
      }

      const cl = response.headers.get('content-length');
      const totalBytes = cl ? parseInt(cl, 10) : 0;

      const reader = response.body.getReader();
      const chunks = [];
      let transferred = 0;
      let lastTime = Date.now();
      let lastBytes = 0;

      while (true) {
        if (this.isOperationCancelled) {
          reader.cancel();
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        transferred += value.byteLength;

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        let speed = 0;
        if (elapsed >= 0.3) {
          speed = (transferred - lastBytes) / elapsed;
          lastTime = now;
          lastBytes = transferred;
        }

        if (onProgress) {
          onProgress(transferred, totalBytes, speed);
        }
      }

      if (this.isOperationCancelled) return;

      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const putRes = await fetch(destUrl, {
        method: 'PUT',
        body: blob,
        signal
      });

      if (!putRes.ok) {
        throw new Error(`Destination server upload failed with status ${putRes.status}`);
      }
      return;
    }

    // Fallback: Read from source via WebSocket and write to destination
    const readRes = await this.sendRequestToSession(srcSessionId, { type: 'sftp-read', path: srcPath, maxBytes: 500 * 1024 * 1024 }, 180000);
    if (this.isOperationCancelled) return;

    await this.sendRequest({
      type: 'sftp-write',
      path: destPath,
      content: readRes.content,
      isBase64: !!readRes.isBinary
    }, 180000);
  }

  async transferRemoteDirectory(srcSessionId, srcDirPath, destDirPath, srcBase, destBase, destBridgeSessionId) {
    const listRes = await this.sendRequestToSession(srcSessionId, { type: 'sftp-list', path: srcDirPath });
    if (!listRes || !listRes.files) return;

    const srcDirClean = srcDirPath.endsWith('/') ? srcDirPath : srcDirPath + '/';
    const destDirClean = destDirPath.endsWith('/') ? destDirPath : destDirPath + '/';

    for (const file of listRes.files) {
      if (file.filename === '.' || file.filename === '..') continue;
      if (this.isOperationCancelled) break;

      const isDir = file.attrs && file.attrs.isDirectory;
      const childSrc = srcDirClean + file.filename;
      const childDest = destDirClean + file.filename;

      if (isDir) {
        await this.sendRequest({ type: 'sftp-mkdir', path: childDest });
        await this.transferRemoteDirectory(srcSessionId, childSrc, childDest, srcBase, destBase, destBridgeSessionId);
      } else {
        await this.transferRemoteFile(srcSessionId, childSrc, childDest, srcBase, destBase, destBridgeSessionId);
      }
    }
  }

  async moveSelectionDialog(targetFilename) {
    const filesToMove = this.resolveActionTarget(targetFilename);
    if (filesToMove.length === 0) return;

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const promptMsg = isPersian
      ? `مسیر کامل پوشه مقصد برای انتقال ${filesToMove.length} مورد را وارد کنید:`
      : `Enter full destination directory path for ${filesToMove.length} item(s):`;

    const destDir = prompt(promptMsg, this.currentPath);
    if (!destDir) return;

    const targetDirClean = destDir.trim();
    if (!targetDirClean || targetDirClean === this.currentPath) {
      return;
    }

    const destBase = targetDirClean.endsWith('/') ? targetDirClean : targetDirClean + '/';
    const items = filesToMove.map(item => ({
      src: item.fullPath,
      dest: destBase + item.filename,
      filename: item.filename,
      isDir: item.isDir
    }));

    const progressContainer = document.getElementById('sftpDownloadProgressContainer');
    const uploadContainer = document.getElementById('sftpUploadProgressContainer');
    const pulseIconEl = document.getElementById('downloadProgressPulseIcon');
    const fileNameEl = document.getElementById('downloadProgressFileName');
    const counterEl = document.getElementById('downloadProgressCounter');
    const percentEl = document.getElementById('downloadProgressPercent');
    const barEl = document.getElementById('downloadProgressBar');
    const sizeEl = document.getElementById('downloadProgressSize');
    const speedEl = document.getElementById('downloadProgressSpeed');

    if (progressContainer) {
      if (uploadContainer && uploadContainer.style.display !== 'none') {
        progressContainer.classList.add('has-upload-active');
      } else {
        progressContainer.classList.remove('has-upload-active');
      }
      progressContainer.style.display = 'block';
    }

    if (pulseIconEl) pulseIconEl.textContent = '🚚';
    if (fileNameEl) fileNameEl.textContent = items.length === 1 ? items[0].filename : (isPersian ? `${items.length} فایل و پوشه` : `${items.length} items`);
    if (counterEl) counterEl.textContent = isPersian ? 'انتقال داخلی سیستم‌عامل (OS Native mv ⚡)' : 'Native OS Fast Move (mv) ⚡';
    if (percentEl) percentEl.textContent = '50%';
    if (barEl) barEl.style.width = '50%';
    if (sizeEl) sizeEl.textContent = isPersian ? `${items.length} مورد در حال انتقال...` : `Moving ${items.length} item(s)...`;
    if (speedEl) speedEl.textContent = isPersian ? 'مستقیم سیستم‌عامل' : 'OS Direct';

    try {
      this.updateStatus(isPersian ? 'در حال انتقال با دستور مستقیم سیستم‌عامل...' : 'Moving with native OS command...');
      await this.sendRequest({ type: 'sftp-move', items }, 180000);

      if (percentEl) percentEl.textContent = '100% ✔';
      if (barEl) barEl.style.width = '100%';
      if (sizeEl) sizeEl.textContent = isPersian ? `${items.length} مورد انجام شد` : `${items.length} item(s) done`;
      if (speedEl) speedEl.textContent = isPersian ? 'تکمیل شد ✔' : 'Completed ✔';

      this.updateStatus(isPersian ? `${items.length} مورد با موفقیت منتقل شد ✔` : `${items.length} item(s) moved successfully ✔`);
      this.listDirectory(this.currentPath);
      this.selectedFiles.clear();
      this.updateSelectionUI();
    } catch (err) {
      alert((isPersian ? 'خطا در انتقال: ' : 'Error moving items: ') + err.message);
      this.updateStatus(`Error: ${err.message}`);
    } finally {
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);
    }
  }

  async copyItemPath(filename) {
    if (!filename) {
      if (this.selectedFiles.size === 0) return;
      filename = Array.from(this.selectedFiles)[0];
    }
    const base = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
    const fullPath = base + filename;
    try {
      await navigator.clipboard.writeText(fullPath);
      const isPersian = window.i18n && window.i18n.currentLang === 'fa';
      this.updateStatus(isPersian ? `مسیر کپی شد: ${fullPath}` : `Path copied: ${fullPath}`);
    } catch (e) {
      console.error('Failed to copy path:', e);
    }
  }

  async copyCurrentPath() {
    try {
      await navigator.clipboard.writeText(this.currentPath);
      const isPersian = window.i18n && window.i18n.currentLang === 'fa';
      this.updateStatus(isPersian ? `مسیر جاری کپی شد: ${this.currentPath}` : `Current path copied: ${this.currentPath}`);
    } catch (e) {
      console.error('Failed to copy current path:', e);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: '🟨', ts: '🟦', json: '📋', html: '🌐', css: '🎨',
      py: '🐍', go: '🔵', sh: '⚙️', txt: '📄', md: '📝',
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🎨',
      zip: '📦', tar: '📦', gz: '📦', deb: '📦',
      log: '📜', yml: '⚙️', yaml: '⚙️', conf: '⚙️'
    };
    return map[ext] || '📄';
  }

  formatPermissions(mode) {
    if (typeof mode !== 'number') return '—';
    const octal = '0' + (mode & 0o777).toString(8);
    const isDir = (mode & 0o170000) === 0o040000;
    const isLink = (mode & 0o170000) === 0o120000;
    let typeChar = '-';
    if (isDir) typeChar = 'd';
    else if (isLink) typeChar = 'l';

    const rwx = [
      (mode & 0o400) ? 'r' : '-',
      (mode & 0o200) ? 'w' : '-',
      (mode & 0o100) ? ((mode & 0o4000) ? 's' : 'x') : ((mode & 0o4000) ? 'S' : '-'),
      (mode & 0o040) ? 'r' : '-',
      (mode & 0o020) ? 'w' : '-',
      (mode & 0o010) ? ((mode & 0o2000) ? 's' : 'x') : ((mode & 0o2000) ? 'S' : '-'),
      (mode & 0o004) ? 'r' : '-',
      (mode & 0o002) ? 'w' : '-',
      (mode & 0o001) ? ((mode & 0o1000) ? 't' : 'x') : ((mode & 0o1000) ? 'T' : '-')
    ].join('');

    return `${octal} (${typeChar}${rwx})`;
  }

  async showInformation(targetFilename, targetIsDir) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    let filename = targetFilename;
    let isDir = targetIsDir;
    let fileObj = null;

    if (filename) {
      fileObj = this.currentFiles.find(f => f.filename === filename);
      if (fileObj && fileObj.attrs) {
        isDir = fileObj.attrs.isDirectory;
      }
    } else if (this.selectedFiles.size === 1) {
      filename = Array.from(this.selectedFiles)[0];
      fileObj = this.currentFiles.find(f => f.filename === filename);
      if (fileObj && fileObj.attrs) {
        isDir = fileObj.attrs.isDirectory;
      }
    }

    const modal = document.getElementById('sftpInfoModal');
    if (!modal) return;

    const iconEl = document.getElementById('infoItemIcon');
    const nameEl = document.getElementById('infoPropName');
    const typeEl = document.getElementById('infoTypeVal');
    const pathEl = document.getElementById('infoPathVal');
    const sizeEl = document.getElementById('infoSizeVal');
    const sizeBytesEl = document.getElementById('infoSizeBytes');
    const containsRow = document.getElementById('infoContainsRow');
    const containsEl = document.getElementById('infoContainsVal');
    const permsEl = document.getElementById('infoPermsVal');
    const ownerEl = document.getElementById('infoOwnerVal');
    const modEl = document.getElementById('infoModifiedVal');

    let fullPath = '';
    let displayName = '';

    if (filename) {
      displayName = filename;
      const base = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
      fullPath = base + filename;
    } else {
      fullPath = this.currentPath || '/';
      displayName = fullPath === '/' ? '/' : fullPath.split('/').filter(Boolean).pop() || '/';
      isDir = true;
    }

    if (iconEl) iconEl.textContent = isDir ? '📁' : this.getFileIcon(displayName);
    if (nameEl) nameEl.textContent = displayName;
    if (typeEl) {
      typeEl.textContent = isDir 
        ? (isPersian ? 'پوشه (Directory)' : 'Folder (Directory)')
        : (isPersian ? 'فایل (File)' : 'File');
    }
    if (pathEl) pathEl.textContent = fullPath;

    const attrs = fileObj ? fileObj.attrs : null;

    if (permsEl) {
      if (attrs && typeof attrs.mode === 'number') {
        permsEl.textContent = this.formatPermissions(attrs.mode);
      } else {
        permsEl.textContent = isDir ? '0755 (drwxr-xr-x)' : '0644 (-rw-r--r--)';
      }
    }

    if (ownerEl) {
      if (attrs && (attrs.uid !== undefined || attrs.gid !== undefined)) {
        ownerEl.textContent = `UID: ${attrs.uid ?? 0} | GID: ${attrs.gid ?? 0}`;
      } else {
        ownerEl.textContent = '—';
      }
    }

    if (modEl) {
      if (attrs && attrs.mtime) {
        modEl.textContent = new Date(attrs.mtime * 1000).toLocaleString();
      } else {
        modEl.textContent = '—';
      }
    }

    modal.classList.add('active');

    if (!isDir && attrs && typeof attrs.size === 'number') {
      if (sizeEl) sizeEl.textContent = this.formatBytes(attrs.size);
      if (sizeBytesEl) sizeBytesEl.textContent = `(${attrs.size.toLocaleString()} bytes)`;
      if (containsRow) containsRow.style.display = 'none';
    } else {
      if (containsRow) {
        containsRow.style.display = 'flex';
        if (containsEl) containsEl.textContent = '...';
      }
      if (sizeEl) {
        sizeEl.innerHTML = `<span class="spinner-inline"></span> <span>${isPersian ? 'در حال محاسبه حجم...' : 'Calculating size...'}</span>`;
      }
      if (sizeBytesEl) sizeBytesEl.textContent = '';

      try {
        const res = await this.sendRequest({ type: 'sftp-du', path: fullPath });
        if (res && res.data) {
          const sz = res.data.size || 0;
          if (sizeEl) sizeEl.textContent = this.formatBytes(sz);
          if (sizeBytesEl) sizeBytesEl.textContent = `(${sz.toLocaleString()} bytes)`;
          if (containsEl) {
            const fCount = (res.data.files || 0).toLocaleString();
            const dCount = (res.data.dirs || 0).toLocaleString();
            containsEl.textContent = isPersian 
              ? `${fCount} فایل، ${dCount} پوشه`
              : `${fCount} files, ${dCount} folders`;
          }
        }
      } catch (err) {
        console.warn('Failed to calculate directory size:', err);
        if (sizeEl) {
          sizeEl.textContent = attrs ? this.formatBytes(attrs.size) : '4 KB';
        }
        if (sizeBytesEl) {
          sizeBytesEl.textContent = isPersian ? '(خطا در محاسبه عمیق)' : '(Recursive scan unavailable)';
        }
        if (containsEl) containsEl.textContent = '—';
      }
    }
  }

  updateStatus(text) {
    this.statusEl.textContent = text;
  }

  // ================= OPEN WITH / EXTERNAL EDITOR =================
  openWith(filename) {
    if (!filename) {
      if (this.selectedFiles.size === 1) {
        filename = Array.from(this.selectedFiles)[0];
      } else {
        return;
      }
    }

    const file = this.currentFiles.find(f => f.filename === filename);
    if (file && file.isDir) {
      return;
    }

    this.activeOpenWithFile = filename;
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    this.activeOpenWithPath = targetPath;

    const modal = document.getElementById('openWithModal');
    const nameEl = document.getElementById('openWithFileName');
    const customRow = document.getElementById('openWithCustomCmdRow');
    const customInput = document.getElementById('openWithCustomCmd');
    const autoSyncChk = document.getElementById('openWithAutoSync');
    const syncBox = document.getElementById('openWithActiveSyncBox');

    if (nameEl) nameEl.textContent = `${filename} (${targetPath})`;
    if (syncBox) syncBox.style.display = 'none';

    // Load saved preferences
    const savedEditor = localStorage.getItem('livekadeh_ext_editor') || 'default';
    const savedCustom = localStorage.getItem('livekadeh_ext_editor_cmd') || '';
    const savedAutoSync = localStorage.getItem('livekadeh_ext_autosync');

    if (autoSyncChk) {
      autoSyncChk.checked = savedAutoSync !== 'false';
    }
    if (customInput) {
      customInput.value = savedCustom;
    }

    // Activate selected app card
    const cards = document.querySelectorAll('#openWithAppsGrid .openwith-app-card');
    cards.forEach(c => {
      const isMatch = c.getAttribute('data-app') === savedEditor;
      c.classList.toggle('active', isMatch);
    });

    // Bridge connection info
    const bridgeUrl = this.bridgeUrl || '';
    const isLocalBridge = bridgeUrl.includes('localhost') || bridgeUrl.includes('127.0.0.1');
    const bridgeText = document.getElementById('openWithBridgeText');
    const remoteNotice = document.getElementById('openWithRemoteNotice');
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    if (bridgeText) {
      bridgeText.textContent = isLocalBridge 
        ? (isPersian ? `بریدج محلی متصل است (${bridgeUrl}) ✔` : `Connected to Local Bridge (${bridgeUrl}) ✔`)
        : (isPersian ? `متصل به بریدج ریموت (${bridgeUrl})` : `Connected to Remote Bridge (${bridgeUrl})`);
      bridgeText.style.color = isLocalBridge ? '#00ff9d' : '#f59e0b';
    }
    if (remoteNotice) {
      remoteNotice.style.display = isLocalBridge ? 'none' : 'block';
    }

    if (customRow) {
      customRow.style.display = (savedEditor === 'custom' || savedEditor === 'notepad++') ? 'block' : 'none';
    }

    if (modal) modal.classList.add('active');
  }

  async launchExternalEditor(targetPath, filename, editorChoice, customCmd, autoSync) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? `در حال آماده‌سازی و باز کردن "${filename}" در ادیتور خارجی...` : `Preparing and launching "${filename}" in external editor...`);

    const syncBox = document.getElementById('openWithActiveSyncBox');
    const syncText = document.getElementById('openWithSyncStatusText');

    try {
      const res = await this.sendRequest({
        type: 'sftp-open-external',
        path: targetPath,
        editor: editorChoice,
        customCommand: customCmd,
        autoSync: !!autoSync
      }, { timeout: 45000 });

      if (res && res.success) {
        if (autoSync && syncBox && syncText) {
          syncBox.style.display = 'block';
          syncText.textContent = isPersian 
            ? `پایش خودکار فعال است. با ذخیره (Ctrl+S) تغییرات روی سرور ذخیره می‌شود.`
            : `Auto-sync active. Changes will upload to server on save (Ctrl+S).`;
        }

        this.updateStatus(isPersian 
          ? `فایل "${filename}" در برنامه سیستم باز شد ✔` 
          : `File "${filename}" launched in system application ✔`);

        setTimeout(() => {
          const modal = document.getElementById('openWithModal');
          if (modal) modal.classList.remove('active');
        }, 1200);
      } else {
        throw new Error(res.error || 'Failed to open file in system application');
      }
    } catch (err) {
      console.error('Launch external editor error:', err);
      const bridgeHost = this.bridgeUrl || '';
      const isRemoteBridge = !bridgeHost.includes('localhost') && !bridgeHost.includes('127.0.0.1');

      let tip = '';
      if (isRemoteBridge) {
        tip = isPersian 
          ? '\n\n💡 نکته: سرور بریدج روی هاست ریموت متصل است. برای باز کردن در برنامه‌های ویندوز یا دسکتاپ، از بریج محلی (Local Bridge) استفاده کنید یا از گزینه‌های «نمایش در برگه جدید» / «ویرایشگر داخلی» بهره ببرید.'
          : '\n\n💡 Tip: Connected to a remote bridge server. To open with local desktop programs, connect to Local Bridge (localhost) or use "Open in New Tab" / "Built-in Editor".';
      }

      alert((isPersian ? 'خطا در اجرای برنامه سیستم: ' : 'Failed to launch system application: ') + err.message + tip);
      this.updateStatus(isPersian ? 'خطا در باز کردن ادیتور سیستم' : 'Error launching external editor');
    }
  }

  async openInNewTab(filename) {
    if (!filename) return;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    this.updateStatus(isPersian ? `در حال باز کردن "${filename}" در برگه جدید...` : `Opening "${filename}" in new tab...`);

    try {
      const lower = filename.toLowerCase();
      let mimeType = 'text/plain; charset=utf-8';
      if (lower.endsWith('.html') || lower.endsWith('.htm')) mimeType = 'text/html; charset=utf-8';
      else if (lower.endsWith('.json')) mimeType = 'application/json; charset=utf-8';
      else if (lower.endsWith('.css')) mimeType = 'text/css; charset=utf-8';
      else if (lower.endsWith('.js') || lower.endsWith('.mjs')) mimeType = 'application/javascript; charset=utf-8';
      else if (lower.endsWith('.xml') || lower.endsWith('.svg')) mimeType = 'text/xml; charset=utf-8';
      else if (lower.endsWith('.md')) mimeType = 'text/markdown; charset=utf-8';
      else if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (lower.endsWith('.png')) mimeType = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (lower.endsWith('.gif')) mimeType = 'image/gif';
      else if (lower.endsWith('.webp')) mimeType = 'image/webp';
      else if (lower.endsWith('.mp4')) mimeType = 'video/mp4';
      else if (lower.endsWith('.mp3')) mimeType = 'audio/mpeg';

      const isBinary = mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/') || mimeType === 'application/pdf';

      if (isBinary) {
        const res = await this.sendRequest({ type: 'sftp-download', path: targetPath });
        const byteCharacters = atob(res.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        const res = await this.sendRequest({ type: 'sftp-read', path: targetPath });
        const blob = new Blob([res.content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }

      const modal = document.getElementById('openWithModal');
      if (modal) modal.classList.remove('active');
      this.updateStatus(isPersian ? `فایل "${filename}" در برگه جدید باز شد ✔` : `Opened "${filename}" in new tab ✔`);
    } catch (err) {
      alert((isPersian ? 'خطا در باز کردن برگه: ' : 'Error opening in new tab: ') + err.message);
    }
  }

  async saveAndSyncWithFilePicker(filename) {
    if (!filename) return;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;

    try {
      if (window.showSaveFilePicker) {
        this.updateStatus(isPersian ? `در حال آماده‌سازی فایل "${filename}"...` : `Preparing file "${filename}"...`);
        const res = await this.sendRequest({ type: 'sftp-read', path: targetPath });
        const handle = await window.showSaveFilePicker({ suggestedName: filename });
        const writable = await handle.createWritable();
        await writable.write(res.content);
        await writable.close();

        this.updateStatus(isPersian ? `فایل "${filename}" در دیسک ذخیره شد ✔` : `Saved "${filename}" to local disk ✔`);
        const modal = document.getElementById('openWithModal');
        if (modal) modal.classList.remove('active');
      } else {
        this.downloadFile(filename);
        const modal = document.getElementById('openWithModal');
        if (modal) modal.classList.remove('active');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert((isPersian ? 'خطا در ذخیره فایل: ' : 'Error saving file: ') + err.message);
      }
    }
  }
}

window.SFTPManager = SFTPManager;
