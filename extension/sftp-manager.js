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
    this.currentMediaUrl = null;

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

  sendRequest(payload) {
    return new Promise((resolve, reject) => {
      const activeSession = this.sessions.get(this.activeSessionId);
      const ws = activeSession ? activeSession.ws : this.ws;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('SFTP connection is not open'));
        return;
      }

      const callbacks = activeSession ? activeSession.pendingCallbacks : this.pendingCallbacks;
      const id = 'req-' + (activeSession ? (activeSession.callbackSeq++) : (this.callbackSeq++));
      payload.id = id;

      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify(payload));

      // Timeout after 30s
      setTimeout(() => {
        if (callbacks.has(id)) {
          callbacks.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }

  handleSessionMessage(session, msg, onReady) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (msg.type === 'sftp-status') {
      if (msg.status === 'connected') {
        session.isConnected = true;
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

    if (msg.id && session.pendingCallbacks.has(msg.id)) {
      const { resolve, reject } = session.pendingCallbacks.get(msg.id);
      session.pendingCallbacks.delete(msg.id);
      if (msg.success === false) {
        reject(new Error(msg.error || 'SFTP operation failed'));
      } else {
        resolve(msg);
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

      // 1. Table Row (List View)
      const tr = document.createElement('tr');
      tr.className = 'sftp-row';
      tr.dataset.name = file.filename;
      if (this.selectedFiles.has(file.filename)) tr.classList.add('selected');

      tr.innerHTML = `
        <td><input type="checkbox" class="file-chk" data-name="${file.filename}" ${this.selectedFiles.has(file.filename) ? 'checked' : ''}></td>
        <td>
          <div class="file-name-cell">
            <span class="file-icon">${icon}</span>
            <span class="file-title" style="font-weight: ${isDir ? '700' : '400'}; color: ${isDir ? '#00f0ff' : '#f8fafc'};">${file.filename}</span>
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

      tr.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        this.toggleSelect(file.filename, tr);
      });

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

        card.innerHTML = `
          <input type="checkbox" class="grid-card-chk file-chk" data-name="${file.filename}" ${this.selectedFiles.has(file.filename) ? 'checked' : ''}>
          <div class="grid-card-icon">${icon}</div>
          <div class="grid-card-name" title="${file.filename}" style="color: ${isDir ? '#00f0ff' : '#f8fafc'}; font-weight: ${isDir ? '700' : '400'};">${file.filename}</div>
          <div class="grid-card-size">${sizeStr}</div>
        `;

        card.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT') return;
          this.toggleSelect(file.filename, card);
        });

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

  toggleSelect(filename) {
    const isNowSelected = !this.selectedFiles.has(filename);
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
    const btnDelete = document.getElementById('btnSftpDelete');
    if (btnDelete) {
      btnDelete.disabled = disabled;
      if (count > 1) {
        btnDelete.innerHTML = isPersian ? `🗑️ حذف همه (${count})` : `🗑️ Delete All (${count})`;
        btnDelete.title = isPersian ? `حذف تمام ${count} مورد انتخاب‌شده` : `Delete all ${count} selected items`;
      } else {
        btnDelete.innerHTML = isPersian ? `🗑️ حذف` : `🗑️ Delete`;
        btnDelete.title = isPersian ? `حذف مورد انتخاب‌شده` : `Delete selected item`;
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

  async downloadFile(filename) {
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? `در حال دریافت ${filename}...` : `Downloading ${filename}...`);

    try {
      const res = await this.sendRequest({ type: 'sftp-read', path: targetPath });
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
      this.updateStatus(isPersian ? `دانلود ${filename} انجام شد ✔` : `Downloaded ${filename} successfully ✔`);
    } catch (err) {
      alert((isPersian ? 'خطا در دانلود فایل: ' : 'Error downloading file: ') + err.message);
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

    this.updateStatus(isPersian ? `در حال بارگذاری ${filename}...` : `Loading media ${filename}...`);

    try {
      const res = await this.sendRequest({
        type: 'sftp-read',
        path: targetPath,
        maxBytes: 100 * 1024 * 1024
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
            <div style="font-weight: 600; color: #f8fafc; font-size: 15px; margin-bottom: 4px;">${filename}</div>
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
}

window.SFTPManager = SFTPManager;
