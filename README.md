# ⚡ LiveKadeh SSH & SFTP Pro

[![Persian Version / نسخه فارسی](https://img.shields.io/badge/Language-فارسی-green.svg)](README_fa.md)
[![GitHub Repository](https://img.shields.io/badge/GitHub-livekadeh%2Fchrome--ssh--sftp--extension-00f0ff?style=for-the-badge&logo=github)](https://github.com/livekadeh/chrome-ssh-sftp-extension)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-00ff9d?style=for-the-badge&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![Release v1.4.0](https://img.shields.io/badge/Release-v1.4.0-orange?style=for-the-badge)](https://github.com/livekadeh/chrome-ssh-sftp-extension/releases/tag/v1.4.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

A powerful, modern Google Chrome extension (Pro Edition) that delivers a complete interactive **SSH Terminal (xterm.js with Persian/BiDi shaper and right-click Copy/Paste)** and an advanced **SFTP File Manager (media player, live chunked upload progress, drag & drop, in-browser editor)** powered by a high-speed WebSocket bridge server.

---

## 🌟 Key Features

### ⚡ Interactive SSH Terminal
- **Full xterm-256color emulation**: Full support for ANSI colors, cursor keys, nano, vim, htop, and tmux.
- **Multilingual & Persian / BiDi Engine**: Contextual Arabic/Persian cursive shaping (Presentation Forms-B), intelligent line right-alignment (`text-align-last: right`), and a dedicated Persian command input bar.
- **Right-Click Context Menu**: PuTTY-style right-click context menu with **Copy**, **Paste**, **Select All**, and **Clear Screen** actions, plus standard shortcuts (`Ctrl+Shift+C` and `Ctrl+Shift+V`).
- **Multi-Session Tabs**: Open and switch between multiple concurrent SSH sessions effortlessly.
- **Visual Customization**: Dynamic font sizing and cyberpunk theme presets (Cyberpunk Neon, Dracula, Tokyo Night, Monokai, Matrix).

### 📁 Advanced SFTP File Manager
- **Media Preview & Player**: Natively play and view images, video files (`.mp4`, `.webm`, `.mov`, `.mkv`), and audio music (`.mp3`, `.wav`, `.ogg`, `.flac`) directly in the browser with double click!
- **Grid & List Views**: Easily toggle between detailed table list and visual card grid layouts.
- **Archive Management**: Compress files to `.zip` or `.tar.gz` and extract archives directly on the remote server.
- **Live Chunked Upload Progress**: Real-time progress bar displaying uploaded bytes, transfer rate, and percentage for large files.
- **Drag & Drop Upload**: Simply drop files from your desktop onto the browser window for instant transfer.
- **In-Browser Code Editor**: Edit remote configuration files and scripts directly with instant save (`Ctrl+S`).
- **Complete File Operations**: Create folders/files, rename, delete recursively, and change permissions (`chmod`).
- **Quick Path Bookmarks**: 1-click access to `/root`, `/var/www`, `/home`, `/etc`, and `/var/log`.

### 🖥️ Secure Server Vault
- Save connection profiles (Host, Port, Username, Password, or Private Key with Passphrase).
- Color-coded badges for separating production, staging, and development servers.
- Safe JSON Export and Import for backup and team sharing.

### 🌐 Public Bridges Directory
- Built-in GitHub directory sync: Fetch and connect to verified public bridge servers with 1 click.
- Real-time latency and connectivity testing.

### 📦 Zero-Dependency Local Bridge Packages
- **Windows**: `livekadeh-bridge-windows-x64-portable.zip` bundled with portable `node.exe` and `start-windows.bat` (zero Node.js or software installation required).
- **Linux**: `livekadeh-bridge-linux-x64.tar.gz` with standalone compiled binary and `start-linux.sh`.

---

## 🚀 Installation & Quick Start

### 1. Chrome Extension Installation

1. Download [`livekadeh-ssh-sftp-extension-v1.4.0.zip`](https://github.com/livekadeh/chrome-ssh-sftp-extension/releases/download/v1.4.0/livekadeh-ssh-sftp-extension-v1.4.0.zip) from the latest release.
2. Unzip the file to a local folder.
3. Open Google Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** and select the unzipped folder.
6. The ⚡ **LiveKadeh** icon will appear in your Chrome toolbar!

---

### 2. Running the Bridge Server

#### Option A: Zero-Config Local Runner (No Installation Needed)
- **Windows**: Extract `livekadeh-bridge-windows-x64-portable.zip` and double-click `start-windows.bat`.
- **Linux**: Extract `livekadeh-bridge-linux-x64.tar.gz` and execute `./start-linux.sh`.

#### Option B: Deploy to Remote Linux Server / VPS
```bash
git clone https://github.com/livekadeh/chrome-ssh-sftp-extension.git
cd chrome-ssh-sftp-extension
chmod +x deploy.sh
./deploy.sh
```

---

## 📁 Repository Structure

```text
chrome-ssh-sftp-extension/
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest & permissions
│   ├── popup.html / popup.js      # Quick popup launcher
│   ├── app.html / app.js          # Full dashboard (Terminal, SFTP, Settings)
│   ├── ssh-terminal.js            # Multi-tab SSH manager with xterm.js
│   ├── sftp-manager.js            # SFTP engine with chunked upload & editor
│   ├── lib/
│   │   ├── xterm.js / xterm.css   # Terminal emulator core
│   │   └── persian-bidi-shaper.js # Persian & Arabic BiDi shaper
│   └── icons/                     # Vector cyberpunk badges (16, 48, 128)
├── server/                        # WebSocket Bridge Server
│   ├── server.js                  # SSH2 & SFTP WebSocket gateway
│   ├── start-windows.bat          # 1-click Windows launcher
│   └── start-linux.sh            # 1-click Linux launcher
├── public_bridges.json            # Public community bridges directory
└── README.md                      # English documentation (default)
```

---

## 📜 License
This project is licensed under the **MIT License**.
