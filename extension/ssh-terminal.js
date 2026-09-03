/**
 * LiveKadeh SSH Terminal Manager (xterm.js integration)
 */

class SSHTerminalManager {
  constructor(containerEl, tabsListEl) {
    this.containerEl = containerEl;
    this.tabsListEl = tabsListEl;
    this.sessions = new Map();
    this.activeSessionId = null;
    this.fontSize = 14;
    this.fontFamily = "'Vazirmatn', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace, Tahoma";
    this.themeName = 'cyberpunk';
    this.rtlAlignEnabled = true;

    this.themes = {
      cyberpunk: {
        background: '#05080f',
        foreground: '#00f0ff',
        cursor: '#00ff9d',
        selectionBackground: 'rgba(0, 240, 255, 0.3)',
        black: '#0a0e17',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
      },
      dracula: {
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        selectionBackground: '#44475a'
      },
      tokyoNight: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5'
      },
      matrix: {
        background: '#040d06',
        foreground: '#00ff66',
        cursor: '#00ff66'
      }
    };

    window.addEventListener('resize', () => this.fitActive());
  }

  createSession(serverConfig, bridgeUrl) {
    const sessionId = 'term-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const sessionName = serverConfig.name || `${serverConfig.username}@${serverConfig.host}`;

    // Create container for this terminal
    const termDiv = document.createElement('div');
    termDiv.id = sessionId;
    termDiv.className = 'xterm-instance';
    termDiv.style.width = '100%';
    termDiv.style.height = '100%';
    termDiv.style.display = 'none';
    this.containerEl.appendChild(termDiv);

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      theme: this.themes[this.themeName] || this.themes.cyberpunk,
      allowTransparency: true,
      rows: 24,
      cols: 80
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(termDiv);

    // Apply text-align-last: right on lines containing Persian/Arabic text
    term.onRender(() => {
      const rows = termDiv.querySelectorAll('.xterm-rows > div');
      rows.forEach(row => {
        if (/[\u0600-\u06FF\uFB50-\uFEFC]/.test(row.textContent || '')) {
          row.classList.add('persian-line');
          row.style.setProperty('text-align-last', 'right', 'important');
          row.style.setProperty('text-align', 'right', 'important');
        } else {
          row.classList.remove('persian-line');
          row.style.removeProperty('text-align-last');
          row.style.removeProperty('text-align');
        }
      });
    });

    const session = {
      id: sessionId,
      name: sessionName,
      serverConfig,
      bridgeUrl,
      term,
      fitAddon,
      termDiv,
      ws: null,
      status: 'disconnected'
    };

    termDiv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (typeof window.showTerminalContextMenu === 'function') {
        window.showTerminalContextMenu(e, session);
      }
    });

    this.sessions.set(sessionId, session);
    this.renderTabs();
    this.switchSession(sessionId);

    // Connect WebSocket
    this.connectSession(session);

    return session;
  }

  connectSession(session) {
    const { serverConfig, bridgeUrl, term, fitAddon } = session;

    term.writeln(`\x1b[36m⚡ [LiveKadeh] Connecting to bridge at ${bridgeUrl}...\x1b[0m`);
    session.status = 'connecting';
    this.updateTabUI(session.id);

    const streamBuffer = {
      data: '',
      timer: null,
      feed: (chunk) => {
        streamBuffer.data += chunk;
        if (streamBuffer.data.includes('\n') || streamBuffer.data.includes('\r') || streamBuffer.data.length > 250) {
          streamBuffer.flush();
        } else {
          if (streamBuffer.timer) clearTimeout(streamBuffer.timer);
          streamBuffer.timer = setTimeout(() => streamBuffer.flush(), 10);
        }
      },
      flush: () => {
        if (streamBuffer.timer) {
          clearTimeout(streamBuffer.timer);
          streamBuffer.timer = null;
        }
        if (!streamBuffer.data) return;
        const chunk = streamBuffer.data;
        streamBuffer.data = '';
        const text = typeof processBiDiTerminalText === 'function'
          ? processBiDiTerminalText(chunk, term.cols || 80, this.rtlAlignEnabled)
          : chunk;
        term.write(text);
      }
    };
    session.streamBuffer = streamBuffer;

    try {
      const ws = new WebSocket(bridgeUrl);
      session.ws = ws;

      ws.onopen = () => {
        term.writeln(`\x1b[32m✔ [LiveKadeh] Bridge connected. Requesting SSH session for ${serverConfig.username}@${serverConfig.host}:${serverConfig.port || 22}...\x1b[0m`);
        
        try { fitAddon.fit(); } catch (e) {}

        ws.send(JSON.stringify({
          type: 'ssh-init',
          host: serverConfig.host,
          port: serverConfig.port || 22,
          username: serverConfig.username,
          password: serverConfig.password,
          privateKey: serverConfig.privateKey,
          passphrase: serverConfig.passphrase,
          cols: term.cols || 80,
          rows: term.rows || 24,
          term: 'xterm-256color'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ssh-output') {
            streamBuffer.feed(msg.data);
          } else if (msg.type === 'ssh-status') {
            streamBuffer.flush();
            if (msg.status === 'connected') {
              session.status = 'connected';
              this.updateTabUI(session.id);
              if (window.onGlobalConnectionChange) {
                window.onGlobalConnectionChange('connected', session.name);
              }
            } else if (msg.status === 'error') {
              term.writeln(`\r\n\x1b[31m✖ [SSH Error] ${msg.message}\x1b[0m\r\n`);
              session.status = 'error';
              this.updateTabUI(session.id);
            } else if (msg.status === 'disconnected') {
              term.writeln(`\r\n\x1b[33m⚡ [LiveKadeh] SSH Session disconnected.\x1b[0m\r\n`);
              session.status = 'disconnected';
              this.updateTabUI(session.id);
            }
          }
        } catch (e) {
          streamBuffer.feed(event.data);
        }
      };

      ws.onclose = () => {
        streamBuffer.flush();
        term.writeln(`\r\n\x1b[33m⚡ [LiveKadeh] Bridge connection closed.\x1b[0m\r\n`);
        session.status = 'disconnected';
        this.updateTabUI(session.id);
        if (window.onGlobalConnectionChange) {
          window.onGlobalConnectionChange('disconnected', 'اتصال قطع شد');
        }
      };

      ws.onerror = (err) => {
        streamBuffer.flush();
        term.writeln(`\r\n\x1b[31m✖ [Bridge Error] Failed to connect to WebSocket bridge (${bridgeUrl})\x1b[0m\r\n`);
        session.status = 'error';
        this.updateTabUI(session.id);
      };

      term.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ssh-input', data }));
        }
      });

      term.onResize((size) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ssh-resize', cols: size.cols, rows: size.rows }));
        }
      });

    } catch (err) {
      term.writeln(`\r\n\x1b[31m✖ Connection error: ${err.message}\x1b[0m\r\n`);
    }
  }

  switchSession(sessionId) {
    if (!this.sessions.has(sessionId)) return;

    this.activeSessionId = sessionId;
    
    // Hide empty state and show wrapper
    document.getElementById('terminalEmptyState').style.display = 'none';
    document.getElementById('xtermWrapper').style.display = 'block';

    // Show only the active terminal container
    this.sessions.forEach((session, id) => {
      session.termDiv.style.display = (id === sessionId) ? 'block' : 'none';
    });

    this.renderTabs();
    this.fitActive();

    const active = this.sessions.get(sessionId);
    if (active) {
      active.term.focus();
      if (window.onGlobalConnectionChange) {
        window.onGlobalConnectionChange(active.status, active.name);
      }
    }
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.ws) {
      try { session.ws.close(); } catch (e) {}
    }
    try { session.term.dispose(); } catch (e) {}
    if (session.termDiv && session.termDiv.parentNode) {
      session.termDiv.parentNode.removeChild(session.termDiv);
    }

    this.sessions.delete(sessionId);

    if (this.activeSessionId === sessionId) {
      const nextSession = this.sessions.keys().next().value;
      if (nextSession) {
        this.switchSession(nextSession);
      } else {
        this.activeSessionId = null;
        document.getElementById('terminalEmptyState').style.display = 'flex';
        document.getElementById('xtermWrapper').style.display = 'none';
        if (window.onGlobalConnectionChange) {
          window.onGlobalConnectionChange('disconnected', 'اتصال برقرار نیست');
        }
      }
    }

    this.renderTabs();
  }

  reconnectActive() {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (session) {
      if (session.ws) {
        try { session.ws.close(); } catch (e) {}
      }
      session.term.clear();
      this.connectSession(session);
    }
  }

  clearActive() {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (session) {
      session.term.clear();
    }
  }

  changeFontSize(delta) {
    this.fontSize = Math.max(10, Math.min(28, this.fontSize + delta));
    this.sessions.forEach(session => {
      session.term.options.fontSize = this.fontSize;
      try { session.fitAddon.fit(); } catch (e) {}
    });
  }

  fitActive() {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (session && session.fitAddon) {
      setTimeout(() => {
        try {
          session.fitAddon.fit();
          if (session.ws && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({
              type: 'ssh-resize',
              cols: session.term.cols,
              rows: session.term.rows
            }));
          }
        } catch (e) {}
      }, 50);
    }
  }

  renderTabs() {
    this.tabsListEl.innerHTML = '';
    this.sessions.forEach((session, id) => {
      const tab = document.createElement('div');
      tab.className = `term-tab ${id === this.activeSessionId ? 'active' : ''}`;
      
      let statusIcon = '⚡';
      if (session.status === 'connected') statusIcon = '🟢';
      else if (session.status === 'connecting') statusIcon = '🟡';
      else if (session.status === 'error') statusIcon = '🔴';

      tab.innerHTML = `
        <span class="tab-status">${statusIcon}</span>
        <span class="tab-title">${session.name}</span>
        <span class="term-tab-close">✕</span>
      `;

      tab.addEventListener('click', () => this.switchSession(id));
      tab.querySelector('.term-tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSession(id);
      });

      this.tabsListEl.appendChild(tab);
    });
  }

  updateTabUI(sessionId) {
    this.renderTabs();
  }

  toggleRtl() {
    this.rtlAlignEnabled = !this.rtlAlignEnabled;
    return this.rtlAlignEnabled;
  }

  sendData(data) {
    if (!this.activeSessionId) return false;
    const session = this.sessions.get(this.activeSessionId);
    if (session && session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: 'ssh-input', data }));
      return true;
    }
    return false;
  }

  copySelection() {
    if (!this.activeSessionId) return false;
    const session = this.sessions.get(this.activeSessionId);
    if (session && session.term) {
      const sel = session.term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel);
        return true;
      }
    }
    return false;
  }

  async pasteFromClipboard() {
    if (!this.activeSessionId) return false;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        return this.sendData(text);
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
    return false;
  }

  selectAllActive() {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (session && session.term) {
      session.term.selectAll();
    }
  }

  hasSelection() {
    if (!this.activeSessionId) return false;
    const session = this.sessions.get(this.activeSessionId);
    return session && session.term ? session.term.hasSelection() : false;
  }
}

window.SSHTerminalManager = SSHTerminalManager;
