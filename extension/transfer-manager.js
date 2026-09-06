/**
 * LiveKadeh Transfers & Background Tasks Manager
 * Manages concurrent downloads, uploads, native copy/move, cross-server transfers,
 * and archive operations with real-time progress bars, speed calculations, and cancellation.
 */

class TransferManager {
  constructor() {
    this.tasks = new Map();
    this.simulatedTimers = new Map();
    this.drawerEl = null;
    this.backdropEl = null;
    this.floatingTabEl = null;
    this.headerBtnEl = null;
    this.listContainerEl = null;
    this.emptyHintEl = null;
    this.subtitleEl = null;
    this.totalSpeedEl = null;
    this.activeCountEl = null;
    this.floatingBadgeEl = null;
    this.headerBadgeEl = null;
    this.isOpen = false;
    this.renderDebounceTimer = null;
  }

  init() {
    this.drawerEl = document.getElementById('transfersDrawer');
    this.backdropEl = document.getElementById('transfersDrawerBackdrop');
    this.floatingTabEl = document.getElementById('btnFloatingTransfers');
    this.headerBtnEl = document.getElementById('btnHeaderTransfers');
    this.listContainerEl = document.getElementById('transfersListContainer');
    this.emptyHintEl = document.getElementById('transfersEmptyHint');
    this.subtitleEl = document.getElementById('transfersDrawerSubtitle');
    this.totalSpeedEl = document.getElementById('transfersTotalSpeed');
    this.activeCountEl = document.getElementById('transfersActiveCount');
    this.floatingBadgeEl = document.getElementById('floatingTransfersBadge');
    this.headerBadgeEl = document.getElementById('headerTransfersBadge');

    const btnClose = document.getElementById('btnCloseTransfersDrawer');
    if (btnClose) btnClose.addEventListener('click', () => this.closeDrawer());
    if (this.backdropEl) this.backdropEl.addEventListener('click', () => this.closeDrawer());
    if (this.headerBtnEl) this.headerBtnEl.addEventListener('click', () => this.toggleDrawer());

    const btnClearFinished = document.getElementById('btnClearFinishedTransfers');
    if (btnClearFinished) {
      btnClearFinished.addEventListener('click', () => this.clearFinished());
    }

    // Event Delegation for Task Actions (No inline onclick to respect Chrome Extension CSP)
    if (this.listContainerEl) {
      this.listContainerEl.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('.btn-task-cancel');
        if (cancelBtn) {
          e.stopPropagation();
          const card = cancelBtn.closest('.transfer-card');
          if (card && card.dataset.taskId) {
            this.cancelTask(card.dataset.taskId);
          }
          return;
        }

        const removeBtn = e.target.closest('.btn-task-remove');
        if (removeBtn) {
          e.stopPropagation();
          const card = removeBtn.closest('.transfer-card');
          if (card && card.dataset.taskId) {
            this.removeTask(card.dataset.taskId);
          }
          return;
        }
      });
    }

    this.initDraggableFloatingTab();
    this.updateUI();
  }

  initDraggableFloatingTab() {
    if (!this.floatingTabEl) return;

    // Load saved vertical position from chrome storage
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get('floatingTransfersTabTop', (data) => {
          if (data && typeof data.floatingTransfersTabTop === 'number') {
            const tabHeight = this.floatingTabEl.offsetHeight || 38;
            const minTop = 15;
            const maxTop = Math.max(minTop, window.innerHeight - tabHeight - 15);
            const clamped = Math.max(minTop, Math.min(maxTop, data.floatingTransfersTabTop));
            this.floatingTabEl.style.top = `${clamped}px`;
            this.floatingTabEl.style.transform = 'none';
          }
        });
      }
    } catch (e) {}

    let isDraggingTab = false;
    let dragStartY = 0;
    let dragStartTop = 0;
    let hasMovedTab = false;

    this.floatingTabEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isDraggingTab = true;
      hasMovedTab = false;
      dragStartY = e.clientY;
      const rect = this.floatingTabEl.getBoundingClientRect();
      dragStartTop = rect.top;

      try {
        this.floatingTabEl.setPointerCapture(e.pointerId);
      } catch (err) {}
      this.floatingTabEl.classList.add('dragging');
    });

    this.floatingTabEl.addEventListener('pointermove', (e) => {
      if (!isDraggingTab) return;
      const deltaY = e.clientY - dragStartY;
      if (Math.abs(deltaY) > 4) {
        hasMovedTab = true;
      }
      if (hasMovedTab) {
        const tabHeight = this.floatingTabEl.offsetHeight || 38;
        const minTop = 15;
        const maxTop = Math.max(minTop, window.innerHeight - tabHeight - 15);
        const newTop = Math.max(minTop, Math.min(maxTop, dragStartTop + deltaY));
        this.floatingTabEl.style.top = `${newTop}px`;
        this.floatingTabEl.style.transform = 'none';
      }
    });

    const endTabDrag = (e) => {
      if (!isDraggingTab) return;
      isDraggingTab = false;
      this.floatingTabEl.classList.remove('dragging');

      try {
        this.floatingTabEl.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (hasMovedTab) {
        const currentTop = parseInt(this.floatingTabEl.style.top, 10);
        if (!isNaN(currentTop) && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ floatingTransfersTabTop: currentTop });
        }
      } else {
        this.toggleDrawer();
      }
    };

    this.floatingTabEl.addEventListener('pointerup', endTabDrag);
    this.floatingTabEl.addEventListener('pointercancel', endTabDrag);

    this.floatingTabEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleDrawer();
      }
    });
  }

  openDrawer() {
    if (!this.drawerEl) return;
    this.isOpen = true;
    this.drawerEl.classList.add('active');
    if (this.backdropEl) this.backdropEl.classList.add('active');
    this.render();
  }

  closeDrawer() {
    if (!this.drawerEl) return;
    this.isOpen = false;
    this.drawerEl.classList.remove('active');
    if (this.backdropEl) this.backdropEl.classList.remove('active');
  }

  toggleDrawer() {
    if (this.isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  addTask({ id, type = 'download', name = '', totalBytes = 0, statusText = '', canCancel = true, onCancel = null }) {
    const taskId = id || ('transfer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    let defaultStatus = isPersian ? 'در حال پردازش...' : 'Processing...';
    if (type === 'copy') defaultStatus = isPersian ? 'در حال کپی داخلی سیستم‌عامل...' : 'Native OS copy running...';
    else if (type === 'move') defaultStatus = isPersian ? 'در حال انتقال داخلی سیستم‌عامل...' : 'Native OS move running...';
    else if (type === 'download') defaultStatus = isPersian ? 'در حال دریافت فایل...' : 'Downloading...';
    else if (type === 'upload') defaultStatus = isPersian ? 'در حال آپلود...' : 'Uploading...';
    else if (type === 'compress') defaultStatus = isPersian ? 'در حال فشرده‌سازی...' : 'Compressing...';
    else if (type === 'extract') defaultStatus = isPersian ? 'در حال استخراج...' : 'Extracting...';

    const task = {
      id: taskId,
      type,
      name: name || 'unnamed',
      status: 'running',
      percent: 5,
      transferredBytes: 0,
      totalBytes: totalBytes || 0,
      speed: 0,
      statusText: statusText || defaultStatus,
      error: null,
      startTime: Date.now(),
      endTime: null,
      canCancel,
      onCancel
    };

    this.tasks.set(taskId, task);

    // If task has indeterminate progress (e.g. server-side copy/move/archive), start progressive simulated animation
    if (type === 'copy' || type === 'move' || type === 'compress' || type === 'extract') {
      this.startSimulatedProgress(taskId);
    }

    this.scheduleRender();

    if (this.floatingTabEl) {
      this.floatingTabEl.classList.add('has-active-transfers');
    }

    return task;
  }

  startSimulatedProgress(taskId) {
    if (this.simulatedTimers.has(taskId)) return;
    let cur = 15;
    const timer = setInterval(() => {
      const t = this.tasks.get(taskId);
      if (!t || t.status !== 'running') {
        clearInterval(timer);
        this.simulatedTimers.delete(taskId);
        return;
      }
      if (cur < 92) {
        cur += Math.max(1, Math.round((92 - cur) * 0.12));
        t.percent = cur;
        this.scheduleRender();
      }
    }, 400);
    this.simulatedTimers.set(taskId, timer);
  }

  stopSimulatedProgress(taskId) {
    if (this.simulatedTimers.has(taskId)) {
      clearInterval(this.simulatedTimers.get(taskId));
      this.simulatedTimers.delete(taskId);
    }
  }

  updateTask(id, updates = {}) {
    const task = this.tasks.get(id);
    if (!task) return;

    if (updates.percent !== undefined) task.percent = Math.min(100, Math.max(0, updates.percent));
    if (updates.transferredBytes !== undefined) task.transferredBytes = updates.transferredBytes;
    if (updates.totalBytes !== undefined) task.totalBytes = updates.totalBytes;
    if (updates.speed !== undefined) task.speed = updates.speed;
    if (updates.statusText !== undefined) task.statusText = updates.statusText;
    if (updates.status !== undefined) task.status = updates.status;

    if (task.percent >= 100 && task.status === 'running') {
      this.stopSimulatedProgress(id);
      task.status = 'completed';
      task.endTime = Date.now();
      const isPersian = window.i18n && window.i18n.currentLang === 'fa';
      if (!updates.statusText) task.statusText = isPersian ? 'تکمیل شد ✔' : 'Completed ✔';
    }

    this.scheduleRender();
  }

  completeTask(id, message = null) {
    this.stopSimulatedProgress(id);
    const task = this.tasks.get(id);
    if (!task) return;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    task.status = 'completed';
    task.percent = 100;
    task.speed = 0;
    if (task.totalBytes > 0) task.transferredBytes = task.totalBytes;
    task.statusText = message || (isPersian ? 'تکمیل شد ✔' : 'Completed ✔');
    task.endTime = Date.now();
    this.scheduleRender();
  }

  errorTask(id, error = null) {
    this.stopSimulatedProgress(id);
    const task = this.tasks.get(id);
    if (!task) return;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    task.status = 'error';
    task.speed = 0;
    const errString = typeof error === 'string' ? error : (error && error.message ? error.message : (isPersian ? 'خطا در عملیات' : 'Operation error'));
    task.error = errString;
    task.statusText = errString;
    task.endTime = Date.now();
    this.scheduleRender();
  }

  cancelTask(id) {
    this.stopSimulatedProgress(id);
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return;
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    task.status = 'cancelled';
    task.speed = 0;
    task.statusText = isPersian ? 'توسط کاربر لغو شد ✕' : 'Cancelled by user ✕';
    task.endTime = Date.now();

    if (typeof task.onCancel === 'function') {
      try {
        task.onCancel();
      } catch (e) {
        console.error('Task cancel callback error:', e);
      }
    }

    // Also trigger global SFTP cancel if matching
    if (window.sftpManager && typeof window.sftpManager.cancelOperation === 'function') {
      window.sftpManager.cancelOperation();
    }

    this.scheduleRender();
  }

  removeTask(id) {
    this.stopSimulatedProgress(id);
    this.tasks.delete(id);
    this.scheduleRender();
  }

  clearFinished() {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'error') {
        this.stopSimulatedProgress(id);
        this.tasks.delete(id);
      }
    }
    this.scheduleRender();
  }

  scheduleRender() {
    if (this.renderDebounceTimer) return;
    this.renderDebounceTimer = requestAnimationFrame(() => {
      this.renderDebounceTimer = null;
      this.updateUI();
      if (this.isOpen) {
        this.render();
      }
    });
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
    return this.formatBytes(bytesPerSec) + '/s';
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getTaskTypeIcon(type) {
    switch (type) {
      case 'download': return '📥';
      case 'upload': return '📤';
      case 'copy': return '📋';
      case 'move': return '🚚';
      case 'cross_transfer': return '🌐';
      case 'compress': return '🗜️';
      case 'extract': return '📂';
      default: return '⚡';
    }
  }

  getTaskTypeTitle(type) {
    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    switch (type) {
      case 'download': return isPersian ? 'دانلود فایل' : 'Download';
      case 'upload': return isPersian ? 'آپلود فایل' : 'Upload';
      case 'copy': return isPersian ? 'کپی داخلی سیستم‌عامل' : 'Native OS Copy';
      case 'move': return isPersian ? 'انتقال داخلی سیستم‌عامل' : 'Native OS Move';
      case 'cross_transfer': return isPersian ? 'انتقال سرور به سرور' : 'Cross-Server Transfer';
      case 'compress': return isPersian ? 'فشرده‌سازی آرشیو' : 'Compress Archive';
      case 'extract': return isPersian ? 'استخراج آرشیو' : 'Extract Archive';
      default: return isPersian ? 'عملیات' : 'Operation';
    }
  }

  updateUI() {
    let runningCount = 0;
    let totalSpeed = 0;
    const totalTasks = this.tasks.size;

    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        runningCount++;
        totalSpeed += (task.speed || 0);
      }
    }

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';

    // Update Header Badge
    if (this.headerBadgeEl) {
      this.headerBadgeEl.textContent = runningCount > 0 ? runningCount : (totalTasks > 0 ? totalTasks : '0');
    }

    // Update Floating Tab Badge
    if (this.floatingBadgeEl) {
      this.floatingBadgeEl.textContent = runningCount > 0 ? runningCount : (totalTasks > 0 ? totalTasks : '0');
    }

    // Update Floating Tab Activity state
    if (this.floatingTabEl) {
      if (runningCount > 0) {
        this.floatingTabEl.classList.add('has-active-transfers');
      } else {
        this.floatingTabEl.classList.remove('has-active-transfers');
      }
    }

    // Update Subtitle
    if (this.subtitleEl) {
      if (runningCount > 0) {
        this.subtitleEl.textContent = isPersian 
          ? `${runningCount} عملیات در حال اجرا` 
          : `${runningCount} active task(s)`;
      } else if (totalTasks > 0) {
        this.subtitleEl.textContent = isPersian 
          ? `${totalTasks} عملیات در تاریخچه` 
          : `${totalTasks} task(s) in history`;
      } else {
        this.subtitleEl.textContent = isPersian ? '۰ عملیات فعال' : '0 active tasks';
      }
    }

    // Update Footer Summary
    if (this.totalSpeedEl) {
      this.totalSpeedEl.textContent = isPersian 
        ? `سرعت کل: ${this.formatSpeed(totalSpeed)}` 
        : `Total speed: ${this.formatSpeed(totalSpeed)}`;
    }

    if (this.activeCountEl) {
      this.activeCountEl.textContent = isPersian 
        ? `${runningCount} در حال اجرا` 
        : `${runningCount} running`;
    }
  }

  render() {
    if (!this.listContainerEl) return;
    this.updateUI();

    const isPersian = window.i18n && window.i18n.currentLang === 'fa';
    const taskArray = Array.from(this.tasks.values()).reverse();

    if (taskArray.length === 0) {
      this.listContainerEl.innerHTML = `
        <div class="drawer-empty-hint" id="transfersEmptyHint">
          <span class="empty-hint-icon">🚀</span>
          <span>${isPersian ? 'هیچ انتقال یا عملیاتی وجود ندارد' : 'No active transfers or operations'}</span>
        </div>
      `;
      return;
    }

    let html = '';
    for (const task of taskArray) {
      const icon = this.getTaskTypeIcon(task.type);
      const typeTitle = this.getTaskTypeTitle(task.type);
      const isRunning = task.status === 'running';
      const isCompleted = task.status === 'completed';
      const isError = task.status === 'error';
      const isCancelled = task.status === 'cancelled';

      let statusBadgeClass = 'badge-running';
      let statusText = task.statusText;
      if (isCompleted) {
        statusBadgeClass = 'badge-completed';
      } else if (isError) {
        statusBadgeClass = 'badge-error';
      } else if (isCancelled) {
        statusBadgeClass = 'badge-cancelled';
      }

      const percent = Math.round(task.percent || 0);
      let sizeInfo = '';
      if (task.totalBytes > 0) {
        sizeInfo = `${this.formatBytes(task.transferredBytes)} / ${this.formatBytes(task.totalBytes)}`;
      } else if (task.transferredBytes > 0) {
        sizeInfo = this.formatBytes(task.transferredBytes);
      }

      let speedInfo = '';
      if (isRunning && task.speed > 0) {
        speedInfo = `⚡ ${this.formatSpeed(task.speed)}`;
      }

      const isIndeterminate = isRunning && (task.type === 'copy' || task.type === 'move' || task.type === 'compress' || task.type === 'extract');

      html += `
        <div class="transfer-card status-${task.status}" data-task-id="${this.escapeHtml(task.id)}">
          <div class="transfer-card-header">
            <div class="transfer-header-left">
              <div class="transfer-icon ${isRunning ? 'pulse' : ''}">${icon}</div>
              <div class="transfer-title-group">
                <div class="transfer-file-name" title="${this.escapeHtml(task.name)}">${this.escapeHtml(task.name)}</div>
                <div class="transfer-type-tag">${typeTitle}</div>
              </div>
            </div>
            <div class="transfer-header-right">
              <span class="transfer-status-badge ${statusBadgeClass}">${this.escapeHtml(statusText)}</span>
              ${isRunning && task.canCancel ? `
                <button class="btn-task-action btn-task-cancel" title="${isPersian ? 'لغو عملیات' : 'Cancel task'}">✕</button>
              ` : `
                <button class="btn-task-action btn-task-remove" title="${isPersian ? 'حذف از لیست' : 'Remove'}">✕</button>
              `}
            </div>
          </div>

          <div class="transfer-progress-track">
            <div class="transfer-progress-bar ${isIndeterminate ? 'indeterminate' : ''}" style="width: ${percent}%;"></div>
          </div>

          <div class="transfer-card-footer">
            <div class="transfer-footer-left">
              <span class="transfer-percent">${percent}%</span>
              ${sizeInfo ? `<span class="transfer-size">${sizeInfo}</span>` : ''}
            </div>
            <div class="transfer-footer-right">
              ${speedInfo ? `<span class="transfer-speed">${speedInfo}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    this.listContainerEl.innerHTML = html;
  }
}

// Global TransferManager instance
window.transferManager = new TransferManager();
