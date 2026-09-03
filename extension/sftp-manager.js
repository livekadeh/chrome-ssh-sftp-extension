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

    this.pendingCallbacks = new Map();
    this.callbackSeq = 1;
    this.isUploadCancelled = false;

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('sftpViewMode', (res) => {
        if (res && res.sftpViewMode) {
          this.viewMode = res.sftpViewMode;
          this.applyViewMode();
        }
      });
    }
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

  connect(serverConfig, bridgeUrl, onReady) {
    this.serverConfig = serverConfig;
    this.bridgeUrl = bridgeUrl;
    this.currentPath = serverConfig.defaultPath || '/root';

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    this.updateStatus(isPersian ? 'در حال اتصال به سرور SFTP...' : 'Connecting to SFTP server...');

    try {
      this.ws = new WebSocket(bridgeUrl);

      this.ws.onopen = () => {
        this.updateStatus(isPersian ? 'در حال احراز هویت SFTP...' : 'Authenticating SFTP...');
        this.ws.send(JSON.stringify({
          type: 'sftp-init',
          host: serverConfig.host,
          port: serverConfig.port || 22,
          username: serverConfig.username,
          password: serverConfig.password,
          privateKey: serverConfig.privateKey,
          passphrase: serverConfig.passphrase
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg, onReady);
        } catch (e) {
          console.error('[SFTP] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.updateStatus(isPersian ? 'اتصال SFTP قطع شد' : 'SFTP connection closed');
        document.getElementById('sftpEmptyState').style.display = 'flex';
        document.getElementById('sftpTable').style.display = 'none';
        if (this.gridContainerEl) this.gridContainerEl.style.display = 'none';
      };

      this.ws.onerror = (err) => {
        this.isConnected = false;
        this.updateStatus(isPersian ? 'خطا در ارتباط با بریج SFTP' : 'Error connecting to SFTP bridge');
      };

    } catch (e) {
      this.updateStatus((isPersian ? 'خطای اتصال: ' : 'Connection error: ') + e.message);
    }
  }

  sendRequest(payload) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('SFTP connection is not open'));
        return;
      }
      const id = 'req-' + (this.callbackSeq++);
      payload.id = id;

      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }

  handleMessage(msg, onReady) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    if (msg.type === 'sftp-status') {
      if (msg.status === 'connected') {
        this.isConnected = true;
        document.getElementById('sftpEmptyState').style.display = 'none';
        this.applyViewMode();
        this.updateStatus(isPersian ? 'متصل به SFTP ✔' : 'SFTP Connected ✔');
        this.listDirectory(this.currentPath);
        if (onReady) onReady();
      } else {
        this.updateStatus(msg.message);
      }
      return;
    }

    if (msg.id && this.pendingCallbacks.has(msg.id)) {
      const { resolve, reject } = this.pendingCallbacks.get(msg.id);
      this.pendingCallbacks.delete(msg.id);
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
      this.renderFiles(this.currentFiles);
      this.updateStatus(isPersian ? `مسیر فعلی: ${this.currentPath}` : `Current directory: ${this.currentPath}`);
      this.updateSelectionUI();
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
        } else {
          this.editFile(file.filename);
        }
      });

      tr.querySelector('.btn-quick-dl').addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadFile(file.filename);
      });

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
    document.getElementById('btnSftpChmod').disabled = disabled;
    document.getElementById('btnSftpDelete').disabled = disabled;

    const btnSftpExtract = document.getElementById('btnSftpExtract');
    if (btnSftpExtract) {
      const isSingleArchive = count === 1 && this.isArchiveFile(Array.from(this.selectedFiles)[0]);
      btnSftpExtract.disabled = !isSingleArchive;
    }

    const btnSftpCompress = document.getElementById('btnSftpCompress');
    if (btnSftpCompress) {
      btnSftpCompress.disabled = count === 0;
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

  async deleteItem(filename, isDir) {
    if (!filename) {
      if (this.selectedFiles.size === 0) return;
      filename = Array.from(this.selectedFiles)[0];
    }
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const confirmMsg = isPersian ? `آیا از حذف "${filename}" اطمینان دارید؟` : `Are you sure you want to delete "${filename}"?`;
    if (!confirm(confirmMsg)) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    try {
      if (isDir) {
        await this.sendRequest({ type: 'sftp-rmdir', path: targetPath });
      } else {
        await this.sendRequest({ type: 'sftp-unlink', path: targetPath });
      }
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`Error deleting: ${err.message}`);
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

  updateStatus(text) {
    this.statusEl.textContent = text;
  }
}

window.SFTPManager = SFTPManager;
