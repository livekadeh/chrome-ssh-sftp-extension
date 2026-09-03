/**
 * LiveKadeh SFTP File Manager
 */

class SFTPManager {
  constructor(tableBodyEl, pathInputEl, statusEl, countEl) {
    this.tableBodyEl = tableBodyEl;
    this.pathInputEl = pathInputEl;
    this.statusEl = statusEl;
    this.countEl = countEl;
    
    this.currentPath = '/root';
    this.currentFiles = [];
    this.selectedFiles = new Set();
    this.ws = null;
    this.isConnected = false;
    this.serverConfig = null;
    this.bridgeUrl = null;

    this.pendingCallbacks = new Map();
    this.callbackSeq = 1;
  }

  connect(serverConfig, bridgeUrl, onReady) {
    this.serverConfig = serverConfig;
    this.bridgeUrl = bridgeUrl;
    this.currentPath = serverConfig.defaultPath || '/root';

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    this.updateStatus('در حال اتصال به سرور SFTP...');

    try {
      this.ws = new WebSocket(bridgeUrl);

      this.ws.onopen = () => {
        this.updateStatus('در حال احراز هویت SFTP...');
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
        this.updateStatus('اتصال SFTP قطع شد');
        document.getElementById('sftpEmptyState').style.display = 'flex';
        document.getElementById('sftpTable').style.display = 'none';
      };

      this.ws.onerror = (err) => {
        this.isConnected = false;
        this.updateStatus('خطا در ارتباط با بریج SFTP');
      };

    } catch (e) {
      this.updateStatus('خطای اتصال: ' + e.message);
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
    if (msg.type === 'sftp-status') {
      if (msg.status === 'connected') {
        this.isConnected = true;
        document.getElementById('sftpEmptyState').style.display = 'none';
        document.getElementById('sftpTable').style.display = 'table';
        this.updateStatus('متصل به SFTP ✔');
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
    this.updateStatus(`در حال دریافت لیست فایل‌های ${dirPath}...`);
    try {
      const res = await this.sendRequest({ type: 'sftp-list', path: dirPath });
      this.currentPath = res.path || dirPath;
      this.pathInputEl.value = this.currentPath;
      this.currentFiles = res.files || [];
      this.selectedFiles.clear();
      this.renderFiles(this.currentFiles);
      this.updateStatus(`مسیر فعلی: ${this.currentPath}`);
      this.updateSelectionUI();
    } catch (err) {
      alert(`خطا در باز کردن پوشه: ${err.message}`);
      this.updateStatus(`خطا: ${err.message}`);
    }
  }

  renderFiles(files) {
    this.tableBodyEl.innerHTML = '';
    this.countEl.textContent = `${files.length} آیتم`;

    files.forEach((file) => {
      const tr = document.createElement('tr');
      tr.className = 'sftp-row';
      tr.dataset.name = file.filename;

      const isDir = file.attrs.isDirectory;
      const icon = isDir ? '📁' : this.getFileIcon(file.filename);
      const sizeStr = isDir ? '-' : this.formatBytes(file.attrs.size);
      const perms = file.attrs.permissions || '0755';
      const mtimeStr = file.attrs.mtime ? new Date(file.attrs.mtime * 1000).toLocaleString('fa-IR') : '-';

      tr.innerHTML = `
        <td><input type="checkbox" class="file-chk" data-name="${file.filename}"></td>
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
          <button class="btn-action btn-quick-dl" title="دانلود">📥</button>
          <button class="btn-action btn-quick-edit" title="ویرایش">✏️</button>
          <button class="btn-action btn-quick-del" title="حذف" style="color: #ef4444;">🗑️</button>
        </td>
      `;

      // Row Selection
      tr.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        this.toggleSelect(file.filename, tr);
      });

      // Double Click
      tr.addEventListener('dblclick', () => {
        if (isDir) {
          const next = this.currentPath.endsWith('/') ? this.currentPath + file.filename : this.currentPath + '/' + file.filename;
          this.listDirectory(next);
        } else {
          this.editFile(file.filename);
        }
      });

      // Row Actions
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

      this.tableBodyEl.appendChild(tr);
    });
  }

  toggleSelect(filename, rowEl) {
    if (this.selectedFiles.has(filename)) {
      this.selectedFiles.delete(filename);
      rowEl.classList.remove('selected');
      const chk = rowEl.querySelector('.file-chk');
      if (chk) chk.checked = false;
    } else {
      this.selectedFiles.add(filename);
      rowEl.classList.add('selected');
      const chk = rowEl.querySelector('.file-chk');
      if (chk) chk.checked = true;
    }
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const count = this.selectedFiles.size;
    this.statusEl.textContent = count > 0 ? `${count} آیتم انتخاب شده` : 'هیچ فایلی انتخاب نشده';

    const disabled = count === 0;
    document.getElementById('btnSftpDownload').disabled = disabled;
    document.getElementById('btnSftpEdit').disabled = count !== 1;
    document.getElementById('btnSftpChmod').disabled = disabled;
    document.getElementById('btnSftpDelete').disabled = disabled;
  }

  async uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const progressContainer = document.getElementById('sftpUploadProgressContainer');
    const fileNameEl = document.getElementById('uploadProgressFileName');
    const counterEl = document.getElementById('uploadProgressCounter');
    const percentEl = document.getElementById('uploadProgressPercent');
    const barEl = document.getElementById('uploadProgressBar');
    const sizeEl = document.getElementById('uploadProgressSize');
    const speedEl = document.getElementById('uploadProgressSpeed');

    if (progressContainer) {
      progressContainer.style.display = 'block';
    }

    let totalBytes = 0;
    for (let i = 0; i < fileList.length; i++) {
      totalBytes += fileList[i].size;
    }
    let overallUploadedBytes = 0;
    const startTime = Date.now();

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + file.name;

      if (fileNameEl) fileNameEl.textContent = file.name;
      if (counterEl) counterEl.textContent = `فایل ${i + 1} از ${fileList.length}`;
      this.updateStatus(`در حال آپلود ${file.name} (${i + 1}/${fileList.length})...`);

      const chunkSize = 128 * 1024; // 128 KB chunks

      if (file.size <= chunkSize) {
        // Direct read for small files
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          await this.sendRequest({
            type: 'sftp-write',
            path: targetPath,
            content: base64Data,
            isBase64: true
          });
        } catch (err) {
          alert(`خطا در آپلود ${file.name}: ${err.message}`);
        }

        overallUploadedBytes += file.size;
        const percent = totalBytes > 0 ? Math.round((overallUploadedBytes / totalBytes) * 100) : 100;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
        if (sizeEl) sizeEl.textContent = `${this.formatSize(overallUploadedBytes)} / ${this.formatSize(totalBytes)}`;
      } else {
        // Chunked stream upload for large files
        let initRes;
        try {
          initRes = await this.sendRequest({ type: 'sftp-chunk-init', path: targetPath });
        } catch (e) {
          initRes = null;
        }

        if (initRes && initRes.success && initRes.uploadId) {
          const uploadId = initRes.uploadId;
          for (let offset = 0; offset < file.size; offset += chunkSize) {
            const slice = file.slice(offset, offset + chunkSize);
            const chunkBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result.split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(slice);
            });

            try {
              await this.sendRequest({
                type: 'sftp-chunk-write',
                uploadId: uploadId,
                chunk: chunkBase64,
                offset: offset
              });
            } catch (err) {
              alert(`خطا در آپلود تکه فایل ${file.name}: ${err.message}`);
              break;
            }

            overallUploadedBytes += slice.size;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((overallUploadedBytes / totalBytes) * 100)) : 100;
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? overallUploadedBytes / elapsed : 0;

            if (percentEl) percentEl.textContent = `${percent}%`;
            if (barEl) barEl.style.width = `${percent}%`;
            if (sizeEl) sizeEl.textContent = `${this.formatSize(overallUploadedBytes)} / ${this.formatSize(totalBytes)}`;
            if (speedEl) speedEl.textContent = `${this.formatSize(speed)}/s`;
          }

          try {
            await this.sendRequest({ type: 'sftp-chunk-end', uploadId });
          } catch (e) {}
        } else {
          // Direct write fallback
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          try {
            await this.sendRequest({
              type: 'sftp-write',
              path: targetPath,
              content: base64Data,
              isBase64: true
            });
          } catch (err) {
            alert(`خطا در آپلود ${file.name}: ${err.message}`);
          }

          overallUploadedBytes += file.size;
          const percent = totalBytes > 0 ? Math.round((overallUploadedBytes / totalBytes) * 100) : 100;
          if (percentEl) percentEl.textContent = `${percent}%`;
          if (barEl) barEl.style.width = `${percent}%`;
          if (sizeEl) sizeEl.textContent = `${this.formatSize(overallUploadedBytes)} / ${this.formatSize(totalBytes)}`;
        }
      }
    }

    if (percentEl) percentEl.textContent = '100% ✔';
    if (barEl) barEl.style.width = '100%';
    if (speedEl) speedEl.textContent = 'تکمیل شد';
    this.updateStatus('تمام فایل‌ها با موفقیت آپلود شدند ✔');

    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
      if (barEl) barEl.style.width = '0%';
    }, 1600);

    this.listDirectory(this.currentPath);
  }

  async downloadFile(filename) {
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    this.updateStatus(`در حال دریافت ${filename}...`);

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
      this.updateStatus(`دانلود ${filename} انجام شد ✔`);
    } catch (err) {
      alert(`خطا در دانلود فایل: ${err.message}`);
    }
  }

  async editFile(filename) {
    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    this.updateStatus(`در حال باز کردن ${filename}...`);

    try {
      const res = await this.sendRequest({ type: 'sftp-read', path: targetPath });
      if (res.isBinary) {
        alert('این فایل باینری است و امکان ویرایش متنی آن وجود ندارد.');
        return;
      }

      document.getElementById('editorFilePath').textContent = targetPath;
      document.getElementById('editorTextarea').value = res.content;
      document.getElementById('editorModal').classList.add('active');
    } catch (err) {
      alert(`خطا در باز کردن فایل: ${err.message}`);
    }
  }

  async saveEditedFile() {
    const filePath = document.getElementById('editorFilePath').textContent;
    const content = document.getElementById('editorTextarea').value;

    this.updateStatus(`در حال ذخیره ${filePath}...`);
    try {
      await this.sendRequest({
        type: 'sftp-write',
        path: filePath,
        content: content,
        isBase64: false
      });
      alert('فایل با موفقیت روی سرور ذخیره شد ✔');
      document.getElementById('editorModal').classList.remove('active');
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`خطا در ذخیره فایل: ${err.message}`);
    }
  }

  async createNewFile() {
    const name = prompt('نام فایل جدید را وارد کنید:');
    if (!name) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + name;
    try {
      await this.sendRequest({ type: 'sftp-write', path: targetPath, content: '', isBase64: false });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`خطا: ${err.message}`);
    }
  }

  async createNewFolder() {
    const name = prompt('نام پوشه جدید را وارد کنید:');
    if (!name) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + name;
    try {
      await this.sendRequest({ type: 'sftp-mkdir', path: targetPath });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`خطا: ${err.message}`);
    }
  }

  async deleteItem(filename, isDir) {
    if (!confirm(`آیا از حذف "${filename}" اطمینان دارید؟`)) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    try {
      if (isDir) {
        await this.sendRequest({ type: 'sftp-rmdir', path: targetPath });
      } else {
        await this.sendRequest({ type: 'sftp-unlink', path: targetPath });
      }
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`خطا در حذف: ${err.message}`);
    }
  }

  async changePermissions() {
    if (this.selectedFiles.size === 0) return;
    const filename = Array.from(this.selectedFiles)[0];
    const newPerm = prompt(`مجوز دسترسی جدید را برای ${filename} وارد کنید (مثلاً 0755 یا 0644):`, '0755');
    if (!newPerm) return;

    const targetPath = (this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/') + filename;
    try {
      await this.sendRequest({ type: 'sftp-chmod', path: targetPath, mode: newPerm });
      this.listDirectory(this.currentPath);
    } catch (err) {
      alert(`خطا: ${err.message}`);
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
