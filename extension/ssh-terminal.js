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
    this.fontFamily = "'Vazir Code', 'Cascadia Code', 'Consolas', 'JetBrains Mono', monospace";
    this.themeName = 'cyberpunk';
    this.rtlAlignEnabled = true;
    try {
      document.documentElement.style.setProperty('--terminal-font', this.fontFamily);
    } catch (e) {}

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
        selectionBackground: '#44475a',
        black: '#21222c',
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
      tokyoNight: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        selectionBackground: '#283457',
        black: '#32344a',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#444b6a',
        brightRed: '#ff7a93',
        brightGreen: '#b9f27c',
        brightYellow: '#ff9e64',
        brightBlue: '#7da6ff',
        brightMagenta: '#bb9af7',
        brightCyan: '#0db9d7',
        brightWhite: '#acb0d0'
      },
      matrix: {
        background: '#040d06',
        foreground: '#00ff66',
        cursor: '#00ff66',
        selectionBackground: 'rgba(0, 255, 102, 0.25)',
        black: '#001100',
        red: '#ff3333',
        green: '#00ff66',
        yellow: '#88ff00',
        blue: '#00ccaa',
        magenta: '#00ff88',
        cyan: '#33ffaa',
        white: '#ccffdd'
      },
      monokai: {
        background: '#272822',
        foreground: '#f8f8f2',
        cursor: '#f8f8f0',
        selectionBackground: '#49483e',
        black: '#272822',
        red: '#f92672',
        green: '#a6e22e',
        yellow: '#f4bf75',
        blue: '#66d9ef',
        magenta: '#ae81ff',
        cyan: '#a1efe4',
        white: '#f8f8f2',
        brightBlack: '#75715e',
        brightRed: '#f92672',
        brightGreen: '#a6e22e',
        brightYellow: '#f4bf75',
        brightBlue: '#66d9ef',
        brightMagenta: '#ae81ff',
        brightCyan: '#a1efe4',
        brightWhite: '#f9f8f5'
      },
      nord: {
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#88c0d0',
        selectionBackground: '#434c5e',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#e5e9f0',
        brightBlack: '#4c566a',
        brightRed: '#d08770',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#eceff4'
      },
      gruvbox: {
        background: '#282828',
        foreground: '#ebdbb2',
        cursor: '#ebdbb2',
        selectionBackground: '#504945',
        black: '#282828',
        red: '#cc241d',
        green: '#98971a',
        yellow: '#d79921',
        blue: '#458588',
        magenta: '#b16286',
        cyan: '#689d6a',
        white: '#a89984',
        brightBlack: '#928374',
        brightRed: '#fb4934',
        brightGreen: '#b8bb26',
        brightYellow: '#fabd2f',
        brightBlue: '#83a598',
        brightMagenta: '#d3869b',
        brightCyan: '#8ec07c',
        brightWhite: '#ebdbb2'
      },
      oneDark: {
        background: '#1e2227',
        foreground: '#abb2bf',
        cursor: '#528bff',
        selectionBackground: '#3e4451',
        black: '#1e2227',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf'
      },
      solarizedDark: {
        background: '#002b36',
        foreground: '#839496',
        cursor: '#93a1a1',
        selectionBackground: '#073642',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5'
      },
      catppuccinMocha: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b70',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8'
      },
      materialOcean: {
        background: '#0f111a',
        foreground: '#8f93a2',
        cursor: '#ffcc00',
        selectionBackground: '#1f2233',
        black: '#000000',
        red: '#ff5370',
        green: '#c3e88d',
        yellow: '#ffcb6b',
        blue: '#82aaff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#ffffff',
        brightBlack: '#464b5d',
        brightRed: '#ff5370',
        brightGreen: '#c3e88d',
        brightYellow: '#ffcb6b',
        brightBlue: '#82aaff',
        brightMagenta: '#c792ea',
        brightCyan: '#89ddff',
        brightWhite: '#ffffff'
      },
      githubDark: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      // Light Themes
      githubLight: {
        background: '#ffffff',
        foreground: '#24292e',
        cursor: '#044289',
        cursorAccent: '#ffffff',
        selectionBackground: '#c8e1ff',
        black: '#24292e',
        red: '#d73a49',
        green: '#22863a',
        yellow: '#b08800',
        blue: '#0366d6',
        magenta: '#6f42c1',
        cyan: '#1b7c83',
        white: '#6a737d',
        brightBlack: '#959da5',
        brightRed: '#cb2431',
        brightGreen: '#28a745',
        brightYellow: '#dbab09',
        brightBlue: '#2188ff',
        brightMagenta: '#8a63d2',
        brightCyan: '#3192aa',
        brightWhite: '#d1d5da'
      },
      solarizedLight: {
        background: '#fdf6e3',
        foreground: '#657b83',
        cursor: '#586e75',
        cursorAccent: '#fdf6e3',
        selectionBackground: '#eee8d5',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5',
        brightBlack: '#002b36',
        brightRed: '#cb4b16',
        brightGreen: '#586e75',
        brightYellow: '#657b83',
        brightBlue: '#839496',
        brightMagenta: '#6c71c4',
        brightCyan: '#93a1a1',
        brightWhite: '#fdf6e3'
      },
      oneLight: {
        background: '#fafafa',
        foreground: '#383a42',
        cursor: '#526fff',
        selectionBackground: '#e5e5e6',
        black: '#383a42',
        red: '#e45649',
        green: '#50a14f',
        yellow: '#c18401',
        blue: '#4078f2',
        magenta: '#a626a4',
        cyan: '#0184bc',
        white: '#a0a1a7'
      },
      paperColorLight: {
        background: '#eeeeee',
        foreground: '#444444',
        cursor: '#005f87',
        cursorAccent: '#eeeeee',
        selectionBackground: '#d0d0d0',
        black: '#000000',
        red: '#af0000',
        green: '#008700',
        yellow: '#5f8700',
        blue: '#0087af',
        magenta: '#8787af',
        cyan: '#005f87',
        white: '#444444',
        brightBlack: '#bcbcbc',
        brightRed: '#d70000',
        brightGreen: '#d70087',
        brightYellow: '#8700af',
        brightBlue: '#d75f00',
        brightMagenta: '#d75f00',
        brightCyan: '#005faf',
        brightWhite: '#ffffff'
      }
    };

    window.addEventListener('resize', () => this.fitActive());
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this.fitActive();
      });
    }
  }

  applyAppearance() {
    const activeTheme = this.themes[this.themeName] || this.themes.cyberpunk;
    try {
      document.documentElement.style.setProperty('--terminal-font', this.fontFamily);
      if (this.containerEl) {
        this.containerEl.style.setProperty('--terminal-font', this.fontFamily);
      }
    } catch (e) {}
    this.sessions.forEach((session) => {
      if (session && session.term) {
        session.term.options.fontFamily = this.fontFamily;
        session.term.options.fontSize = this.fontSize;
        session.term.options.theme = activeTheme;
        if (session.fitAddon) {
          try { session.fitAddon.fit(); } catch (e) {}
        }
      }
    });
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
    try {
      termDiv.style.setProperty('--terminal-font', this.fontFamily);
    } catch (e) {}
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

    // Mark Persian rows for natural unicode-bidi presentation
    term.onRender(() => {
      const rows = termDiv.querySelectorAll('.xterm-rows > div');
      rows.forEach(row => {
        if (/[\u0600-\u06FF\uFB50-\uFEFC\u200C]/.test(row.textContent || '')) {
          row.classList.add('persian-line');
        } else {
          row.classList.remove('persian-line');
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
              if (typeof window.updateSessionsDrawer === 'function') {
                window.updateSessionsDrawer();
              }
            } else if (msg.status === 'error') {
              term.writeln(`\r\n\x1b[31m✖ [SSH Error] ${msg.message}\x1b[0m\r\n`);
              session.status = 'error';
              this.updateTabUI(session.id);
              if (typeof window.updateSessionsDrawer === 'function') {
                window.updateSessionsDrawer();
              }
            } else if (msg.status === 'disconnected') {
              term.writeln(`\r\n\x1b[33m⚡ [LiveKadeh] SSH Session disconnected.\x1b[0m\r\n`);
              session.status = 'disconnected';
              this.updateTabUI(session.id);
              if (typeof window.updateSessionsDrawer === 'function') {
                window.updateSessionsDrawer();
              }
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
        if (typeof window.updateSessionsDrawer === 'function') {
          window.updateSessionsDrawer();
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

    if (typeof window.updateSessionsDrawer === 'function') {
      window.updateSessionsDrawer();
    }
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
