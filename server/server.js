/**
 * Chrome SSH & SFTP Extension - WebSocket Bridge Server
 * Author: livekadeh (https://github.com/livekadeh)
 * High-performance, low-latency bridge between WebSocket clients and SSH2/SFTP
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const cors = require('cors');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'LiveKadeh SSH & SFTP Bridge Server',
    version: '1.4.1',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      websocket: `ws://${req.headers.host || 'localhost:' + PORT}/ws`
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeClients: wss.clients.size
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

console.log(`[Bridge Server] Initializing WebSocket SSH & SFTP Bridge on port ${PORT}...`);

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIp}`);

  let sshClient = null;
  let sshStream = null;
  let sftpSession = null;
  let isConnected = false;
  const uploadHandles = new Map();

  const safeSend = (obj) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  };

  // Heartbeat ping
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 25000);

  const cleanupSSH = () => {
    uploadHandles.forEach((upload) => {
      if (sftpSession && upload.handle) {
        try { sftpSession.close(upload.handle, () => {}); } catch (e) {}
      }
    });
    uploadHandles.clear();

    if (sshStream) {
      try { sshStream.end(); } catch (e) {}
      sshStream = null;
    }
    if (sftpSession) {
      try { sftpSession.end(); } catch (e) {}
      sftpSession = null;
    }
    if (sshClient) {
      try { sshClient.end(); } catch (e) {}
      sshClient = null;
    }
    isConnected = false;
  };

  ws.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message.toString());
    } catch (err) {
      safeSend({ type: 'error', message: 'Invalid JSON payload: ' + err.message });
      return;
    }

    const type = msg.type;

    // --- PING / PONG ---
    if (type === 'ping') {
      safeSend({ type: 'pong', timestamp: Date.now() });
      return;
    }

    // --- SSH INITIALIZATION ---
    if (type === 'ssh-init') {
      cleanupSSH();
      const { host, port = 22, username, password, privateKey, passphrase, term = 'xterm-256color', cols = 80, rows = 24 } = msg;

      if (!host || !username) {
        safeSend({ type: 'ssh-status', status: 'error', message: 'Missing host or username' });
        return;
      }

      safeSend({ type: 'ssh-status', status: 'connecting', message: `Connecting to ${username}@${host}:${port}...` });

      sshClient = new Client();

      sshClient.on('ready', () => {
        isConnected = true;
        safeSend({ type: 'ssh-status', status: 'authenticated', message: 'SSH Authentication successful. Opening PTY shell...' });

        sshClient.shell({
          term: term,
          cols: parseInt(cols, 10) || 80,
          rows: parseInt(rows, 10) || 24
        }, (err, stream) => {
          if (err) {
            safeSend({ type: 'ssh-status', status: 'error', message: 'PTY Shell error: ' + err.message });
            cleanupSSH();
            return;
          }

          sshStream = stream;
          safeSend({ type: 'ssh-status', status: 'connected', message: 'Terminal ready' });

          stream.on('data', (data) => {
            safeSend({ type: 'ssh-output', data: data.toString('utf-8') });
          });

          stream.on('close', () => {
            safeSend({ type: 'ssh-status', status: 'disconnected', message: 'SSH session closed by remote host.' });
            cleanupSSH();
          });

          stream.stderr.on('data', (data) => {
            safeSend({ type: 'ssh-output', data: data.toString('utf-8') });
          });
        });
      });

      sshClient.on('error', (err) => {
        console.error(`[SSH Error] ${host}:`, err.message);
        safeSend({ type: 'ssh-status', status: 'error', message: 'SSH Connection failed: ' + err.message });
        cleanupSSH();
      });

      sshClient.on('close', () => {
        if (isConnected) {
          safeSend({ type: 'ssh-status', status: 'disconnected', message: 'SSH connection terminated.' });
        }
        cleanupSSH();
      });

      sshClient.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        if (password) {
          finish([password]);
        } else {
          finish([]);
        }
      });

      const connectConfig = {
        host,
        port: parseInt(port, 10) || 22,
        username,
        tryKeyboard: true,
        readyTimeout: 20000,
        keepaliveInterval: 10000
      };

      if (privateKey) {
        connectConfig.privateKey = privateKey;
        if (passphrase) connectConfig.passphrase = passphrase;
      } else if (password) {
        connectConfig.password = password;
      }

      try {
        sshClient.connect(connectConfig);
      } catch (err) {
        safeSend({ type: 'ssh-status', status: 'error', message: 'Failed to start SSH client: ' + err.message });
      }
      return;
    }

    // --- SSH INPUT ---
    if (type === 'ssh-input') {
      if (sshStream && sshStream.writable) {
        sshStream.write(msg.data);
      }
      return;
    }

    // --- SSH RESIZE ---
    if (type === 'ssh-resize') {
      if (sshStream && typeof sshStream.setWindow === 'function') {
        const cols = parseInt(msg.cols, 10) || 80;
        const rows = parseInt(msg.rows, 10) || 24;
        sshStream.setWindow(rows, cols, 0, 0);
      }
      return;
    }

    // --- SSH CLOSE ---
    if (type === 'ssh-close') {
      cleanupSSH();
      safeSend({ type: 'ssh-status', status: 'disconnected', message: 'Session closed by user.' });
      return;
    }

    // --- SFTP INITIALIZATION & COMMANDS ---
    if (type === 'sftp-init') {
      cleanupSSH();
      const { host, port = 22, username, password, privateKey, passphrase } = msg;

      safeSend({ type: 'sftp-status', status: 'connecting', message: `Opening SFTP connection to ${username}@${host}:${port}...` });

      sshClient = new Client();

      sshClient.on('ready', () => {
        sshClient.sftp((err, sftp) => {
          if (err) {
            safeSend({ type: 'sftp-status', status: 'error', message: 'SFTP subsystem error: ' + err.message });
            cleanupSSH();
            return;
          }

          sftpSession = sftp;
          isConnected = true;
          safeSend({ type: 'sftp-status', status: 'connected', message: 'SFTP Session Established' });
        });
      });

      sshClient.on('error', (err) => {
        safeSend({ type: 'sftp-status', status: 'error', message: 'SFTP Connection failed: ' + err.message });
        cleanupSSH();
      });

      sshClient.on('close', () => {
        safeSend({ type: 'sftp-status', status: 'disconnected', message: 'SFTP connection closed' });
        cleanupSSH();
      });

      const connectConfig = {
        host,
        port: parseInt(port, 10) || 22,
        username,
        tryKeyboard: true,
        readyTimeout: 20000
      };

      if (privateKey) {
        connectConfig.privateKey = privateKey;
        if (passphrase) connectConfig.passphrase = passphrase;
      } else if (password) {
        connectConfig.password = password;
      }

      try {
        sshClient.connect(connectConfig);
      } catch (err) {
        safeSend({ type: 'sftp-status', status: 'error', message: err.message });
      }
      return;
    }

    // Helper for executing SFTP actions
    const checkSftp = (id) => {
      if (!sftpSession) {
        safeSend({ type: 'sftp-error', id, message: 'SFTP session is not active. Please connect first.' });
        return false;
      }
      return true;
    };

    // --- SFTP LIST DIRECTORY ---
    if (type === 'sftp-list') {
      const { path: dirPath = '.', id } = msg;
      if (!checkSftp(id)) return;

      sftpSession.readdir(dirPath, (err, list) => {
        if (err) {
          safeSend({ type: 'sftp-list-res', id, success: false, path: dirPath, error: err.message });
          return;
        }

        const files = list.map(item => ({
          filename: item.filename,
          longname: item.longname,
          attrs: {
            mode: item.attrs.mode,
            uid: item.attrs.uid,
            gid: item.attrs.gid,
            size: item.attrs.size,
            atime: item.attrs.atime,
            mtime: item.attrs.mtime,
            isDirectory: (item.attrs.mode & 0o40000) === 0o40000,
            isSymbolicLink: (item.attrs.mode & 0o120000) === 0o120000,
            isFile: (item.attrs.mode & 0o100000) === 0o100000,
            permissions: (item.attrs.mode & 0o777).toString(8)
          }
        })).sort((a, b) => {
          if (a.attrs.isDirectory && !b.attrs.isDirectory) return -1;
          if (!a.attrs.isDirectory && b.attrs.isDirectory) return 1;
          return a.filename.localeCompare(b.filename);
        });

        // Resolve absolute real path if needed
        sftpSession.realpath(dirPath, (rErr, realPath) => {
          safeSend({
            type: 'sftp-list-res',
            id,
            success: true,
            path: rErr ? dirPath : realPath,
            files
          });
        });
      });
      return;
    }

    // --- SFTP READ FILE ---
    if (type === 'sftp-read') {
      const { path: filePath, id } = msg;
      const requestedMax = Number(msg.maxBytes) || (50 * 1024 * 1024);
      const maxLimit = Math.min(requestedMax, 150 * 1024 * 1024);
      if (!checkSftp(id)) return;

      sftpSession.stat(filePath, (sErr, stats) => {
        if (sErr) {
          safeSend({ type: 'sftp-read-res', id, success: false, error: sErr.message });
          return;
        }

        const isDir = (stats.mode & 0o170000) === 0o040000;
        if (isDir) {
          safeSend({ type: 'sftp-read-res', id, success: false, isDir: true, error: 'Target is a directory. Please use directory download (Zip).' });
          return;
        }

        if (stats.size > maxLimit) {
          safeSend({ type: 'sftp-read-res', id, success: false, error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Max limit is ${(maxLimit / 1024 / 1024).toFixed(0)} MB.` });
          return;
        }

        const readStream = sftpSession.createReadStream(filePath);
        const chunks = [];

        readStream.on('data', chunk => chunks.push(chunk));
        readStream.on('error', err => {
          safeSend({ type: 'sftp-read-res', id, success: false, error: err.message });
        });
        readStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // Check if file is utf8 text or binary
          let isBinary = false;
          for (let i = 0; i < Math.min(buffer.length, 512); i++) {
            if (buffer[i] === 0) { isBinary = true; break; }
          }

          safeSend({
            type: 'sftp-read-res',
            id,
            success: true,
            path: filePath,
            size: stats.size,
            isBinary,
            content: isBinary ? buffer.toString('base64') : buffer.toString('utf-8')
          });
        });
      });
      return;
    }

    // --- SFTP WRITE / UPLOAD FILE ---
    if (type === 'sftp-write') {
      const { path: filePath, content, isBase64 = false, id } = msg;
      if (!checkSftp(id)) return;

      const buffer = isBase64 ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8');
      const writeStream = sftpSession.createWriteStream(filePath);

      writeStream.on('error', err => {
        safeSend({ type: 'sftp-write-res', id, success: false, error: err.message });
      });

      writeStream.on('close', () => {
        safeSend({ type: 'sftp-write-res', id, success: true, path: filePath, size: buffer.length });
      });

      writeStream.end(buffer);
      return;
    }

    // --- SFTP CHUNKED UPLOAD ---
    if (type === 'sftp-chunk-init') {
      const { path: filePath, id } = msg;
      if (!checkSftp(id)) return;

      sftpSession.open(filePath, 'w', (err, handle) => {
        if (err) {
          safeSend({ type: 'sftp-chunk-init-res', id, success: false, error: err.message });
        } else {
          uploadHandles.set(id, { handle, offset: 0, path: filePath });
          safeSend({ type: 'sftp-chunk-init-res', id, success: true, uploadId: id });
        }
      });
      return;
    }

    if (type === 'sftp-chunk-write') {
      const { uploadId, chunk, offset, id } = msg;
      const upload = uploadHandles.get(uploadId);
      if (!upload) {
        safeSend({ type: 'sftp-chunk-write-res', id, success: false, error: 'Upload handle not found' });
        return;
      }
      const buffer = Buffer.from(chunk, 'base64');
      const pos = (offset !== undefined) ? offset : upload.offset;
      sftpSession.write(upload.handle, buffer, 0, buffer.length, pos, (err) => {
        if (err) {
          safeSend({ type: 'sftp-chunk-write-res', id, success: false, error: err.message });
        } else {
          upload.offset = pos + buffer.length;
          safeSend({ type: 'sftp-chunk-write-res', id, success: true, written: buffer.length });
        }
      });
      return;
    }

    if (type === 'sftp-chunk-end') {
      const { uploadId, id } = msg;
      const upload = uploadHandles.get(uploadId);
      if (!upload) {
        safeSend({ type: 'sftp-chunk-end-res', id, success: false, error: 'Upload handle not found' });
        return;
      }
      sftpSession.close(upload.handle, (err) => {
        uploadHandles.delete(uploadId);
        safeSend({ type: 'sftp-chunk-end-res', id, success: !err, path: upload.path, error: err ? err.message : null });
      });
      return;
    }

    // --- SFTP MKDIR ---
    if (type === 'sftp-mkdir') {
      const { path: dirPath, id } = msg;
      if (!checkSftp(id)) return;

      sftpSession.mkdir(dirPath, err => {
        safeSend({ type: 'sftp-mkdir-res', id, success: !err, path: dirPath, error: err ? err.message : null });
      });
      return;
    }

    // --- SFTP RMDIR (RECURSIVE DIRECTORY DELETION) ---
    if (type === 'sftp-rmdir') {
      const { path: dirPath, id } = msg;
      if (!checkSftp(id)) return;

      const escapeShell = (str) => "'" + str.replace(/'/g, "'\\''") + "'";

      const sftpRmdirRecursive = (targetDir, cb) => {
        sftpSession.readdir(targetDir, (err, list) => {
          if (err) {
            return sftpSession.rmdir(targetDir, cb);
          }

          const items = (list || []).filter(item => item.filename !== '.' && item.filename !== '..');
          if (items.length === 0) {
            return sftpSession.rmdir(targetDir, cb);
          }

          let remaining = items.length;
          let encounteredError = null;

          for (const item of items) {
            const itemPath = (targetDir.endsWith('/') ? targetDir : targetDir + '/') + item.filename;
            const isDir = item.attrs ? ((item.attrs.mode & 0o170000) === 0o040000) : false;

            const onDone = (delErr) => {
              if (delErr && !encounteredError) encounteredError = delErr;
              remaining--;
              if (remaining === 0) {
                if (encounteredError) return cb(encounteredError);
                sftpSession.rmdir(targetDir, cb);
              }
            };

            if (isDir) {
              sftpRmdirRecursive(itemPath, onDone);
            } else {
              sftpSession.unlink(itemPath, onDone);
            }
          }
        });
      };

      if (sshClient && isConnected) {
        const cmd = `rm -rf -- ${escapeShell(dirPath)}`;
        sshClient.exec(cmd, (execErr, stream) => {
          if (execErr) {
            return sftpRmdirRecursive(dirPath, (err) => {
              safeSend({ type: 'sftp-rmdir-res', id, success: !err, path: dirPath, error: err ? err.message : null });
            });
          }
          let stderr = '';
          stream.stderr.on('data', d => { stderr += d.toString(); });
          stream.on('close', code => {
            if (code === 0) {
              safeSend({ type: 'sftp-rmdir-res', id, success: true, path: dirPath, error: null });
            } else {
              sftpRmdirRecursive(dirPath, (err) => {
                safeSend({ type: 'sftp-rmdir-res', id, success: !err, path: dirPath, error: err ? (stderr || err.message) : null });
              });
            }
          });
        });
      } else {
        sftpRmdirRecursive(dirPath, (err) => {
          safeSend({ type: 'sftp-rmdir-res', id, success: !err, path: dirPath, error: err ? err.message : null });
        });
      }
      return;
    }

    // --- SFTP UNLINK (DELETE FILE) ---
    if (type === 'sftp-unlink') {
      const { path: filePath, id } = msg;
      if (!checkSftp(id)) return;

      sftpSession.unlink(filePath, err => {
        safeSend({ type: 'sftp-unlink-res', id, success: !err, path: filePath, error: err ? err.message : null });
      });
      return;
    }

    // --- SFTP RENAME / MOVE ---
    if (type === 'sftp-rename') {
      const { oldPath, newPath, id } = msg;
      if (!checkSftp(id)) return;

      sftpSession.rename(oldPath, newPath, err => {
        safeSend({ type: 'sftp-rename-res', id, success: !err, oldPath, newPath, error: err ? err.message : null });
      });
      return;
    }

    // --- SFTP CHMOD ---
    if (type === 'sftp-chmod') {
      const { path: filePath, mode, id } = msg;
      if (!checkSftp(id)) return;

      const numericMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      sftpSession.chmod(filePath, numericMode, err => {
        safeSend({ type: 'sftp-chmod-res', id, success: !err, path: filePath, mode, error: err ? err.message : null });
      });
      return;
    }

    // --- SFTP DISK USAGE & STATS (DU) ---
    if (type === 'sftp-du') {
      const { path: targetPath, id } = msg;
      if (!checkSftp(id)) return;

      const escapeShell = (str) => "'" + str.replace(/'/g, "'\\''") + "'";

      const sftpDuRecursive = (targetDir, cb) => {
        let totalBytes = 0;
        let fileCount = 0;
        let dirCount = 0;
        let pending = 1;
        let hasError = null;

        function walk(currentDir) {
          sftpSession.readdir(currentDir, (err, list) => {
            if (err) {
              if (!hasError) hasError = err;
              pending--;
              if (pending === 0) cb(hasError, { size: totalBytes, files: fileCount, dirs: dirCount, isDir: true });
              return;
            }
            const items = (list || []).filter(item => item.filename !== '.' && item.filename !== '..');
            for (const item of items) {
              const itemPath = (currentDir.endsWith('/') ? currentDir : currentDir + '/') + item.filename;
              const isDir = item.attrs ? ((item.attrs.mode & 0o170000) === 0o040000) : false;
              if (isDir) {
                dirCount++;
                pending++;
                walk(itemPath);
              } else {
                fileCount++;
                totalBytes += (item.attrs && item.attrs.size) ? item.attrs.size : 0;
              }
            }
            pending--;
            if (pending === 0) {
              cb(hasError, { size: totalBytes, files: fileCount, dirs: dirCount, isDir: true });
            }
          });
        }

        walk(targetDir);
      };

      if (sshClient && isConnected) {
        const escaped = escapeShell(targetPath);
        const cmd = `if [ -d ${escaped} ]; then
  SIZE=$(du -sb -- ${escaped} 2>/dev/null | cut -f1)
  [ -z "$SIZE" ] && SIZE=$(( $(du -sk -- ${escaped} 2>/dev/null | cut -f1) * 1024 ))
  FILES=$(find ${escaped} -type f 2>/dev/null | wc -l)
  DIRS=$(find ${escaped} -mindepth 1 -type d 2>/dev/null | wc -l)
  echo "{\\"size\\":\${SIZE:-0},\\"files\\":\${FILES:-0},\\"dirs\\":\${DIRS:-0},\\"isDir\\":true}"
else
  SIZE=$(du -sb -- ${escaped} 2>/dev/null | cut -f1)
  [ -z "$SIZE" ] && SIZE=$(stat -c %s ${escaped} 2>/dev/null)
  [ -z "$SIZE" ] && SIZE=0
  echo "{\\"size\\":\${SIZE:-0},\\"files\\":1,\\"dirs\\":0,\\"isDir\\":false}"
fi`;
        sshClient.exec(cmd, (execErr, stream) => {
          if (execErr) {
            return sftpDuRecursive(targetPath, (err, stats) => {
              safeSend({ type: 'sftp-du-res', id, success: !err, path: targetPath, data: stats, error: err ? err.message : null });
            });
          }
          let stdout = '';
          let stderr = '';
          stream.on('data', d => { stdout += d.toString(); });
          stream.stderr.on('data', d => { stderr += d.toString(); });
          stream.on('close', code => {
            if (code === 0 && stdout.trim()) {
              try {
                const data = JSON.parse(stdout.trim());
                safeSend({ type: 'sftp-du-res', id, success: true, path: targetPath, data, error: null });
              } catch (e) {
                sftpDuRecursive(targetPath, (err, stats) => {
                  safeSend({ type: 'sftp-du-res', id, success: !err, path: targetPath, data: stats, error: err ? err.message : null });
                });
              }
            } else {
              sftpDuRecursive(targetPath, (err, stats) => {
                safeSend({ type: 'sftp-du-res', id, success: !err, path: targetPath, data: stats, error: err ? err.message : null });
              });
            }
          });
        });
      } else {
        sftpSession.stat(targetPath, (sErr, stats) => {
          if (sErr) {
            safeSend({ type: 'sftp-du-res', id, success: false, path: targetPath, error: sErr.message });
            return;
          }
          const isDir = (stats.mode & 0o170000) === 0o040000;
          if (isDir) {
            sftpDuRecursive(targetPath, (err, duStats) => {
              safeSend({ type: 'sftp-du-res', id, success: !err, path: targetPath, data: duStats, error: err ? err.message : null });
            });
          } else {
            safeSend({
              type: 'sftp-du-res',
              id,
              success: true,
              path: targetPath,
              data: { size: stats.size, files: 1, dirs: 0, isDir: false },
              error: null
            });
          }
        });
      }
      return;
    }

    // --- SFTP EXTRACT ARCHIVE ---
    if (type === 'sftp-extract') {
      const { path: archivePath, dir: destDir, id } = msg;
      if (!sshClient || !isConnected) {
        safeSend({ type: 'sftp-extract-res', id, success: false, error: 'SSH connection not active' });
        return;
      }

      const escapeShell = (str) => "'" + str.replace(/'/g, "'\\''") + "'";
      const targetArchive = escapeShell(archivePath);
      const destination = escapeShell(destDir || '.');
      const lower = archivePath.toLowerCase();
      let cmd = '';

      if (lower.endsWith('.zip')) {
        cmd = `if command -v unzip >/dev/null 2>&1; then unzip -o ${targetArchive} -d ${destination}; elif command -v 7z >/dev/null 2>&1; then 7z x -y -o${destination} ${targetArchive}; elif command -v python3 >/dev/null 2>&1; then python3 -c "import zipfile; zipfile.ZipFile(${targetArchive}).extractall(${destination})"; elif command -v python >/dev/null 2>&1; then python -c "import zipfile; zipfile.ZipFile(${targetArchive}).extractall(${destination})"; else echo "Error: Neither unzip, 7z, nor python is installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
        cmd = `if command -v tar >/dev/null 2>&1; then tar -xzf ${targetArchive} -C ${destination}; else echo "Error: tar is not installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) {
        cmd = `if command -v tar >/dev/null 2>&1; then tar -xjf ${targetArchive} -C ${destination}; else echo "Error: tar is not installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) {
        cmd = `if command -v tar >/dev/null 2>&1; then tar -xJf ${targetArchive} -C ${destination}; else echo "Error: tar is not installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.tar')) {
        cmd = `if command -v tar >/dev/null 2>&1; then tar -xf ${targetArchive} -C ${destination}; else echo "Error: tar is not installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.gz')) {
        cmd = `if command -v gunzip >/dev/null 2>&1; then cd ${destination} && gunzip -k ${targetArchive}; elif command -v gzip >/dev/null 2>&1; then cd ${destination} && gzip -dk ${targetArchive}; else echo "Error: gzip/gunzip is not installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.7z')) {
        cmd = `if command -v 7z >/dev/null 2>&1; then 7z x -y -o${destination} ${targetArchive}; else echo "Error: 7z is not installed on the remote server." >&2; exit 127; fi`;
      } else if (lower.endsWith('.rar')) {
        cmd = `if command -v unrar >/dev/null 2>&1; then unrar x -o+ ${targetArchive} ${destination}; elif command -v 7z >/dev/null 2>&1; then 7z x -y -o${destination} ${targetArchive}; else echo "Error: unrar or 7z is not installed on the remote server." >&2; exit 127; fi`;
      } else {
        safeSend({ type: 'sftp-extract-res', id, success: false, error: 'Unsupported archive format. Supported formats: .zip, .tar, .tar.gz, .tgz, .tar.bz2, .tar.xz, .gz, .7z, .rar' });
        return;
      }

      sshClient.exec(cmd, (err, stream) => {
        if (err) {
          safeSend({ type: 'sftp-extract-res', id, success: false, error: err.message });
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (d) => { stdout += d.toString(); });
        stream.stderr.on('data', (d) => { stderr += d.toString(); });

        stream.on('close', (code) => {
          if (code === 0) {
            safeSend({ type: 'sftp-extract-res', id, success: true, message: 'Archive extracted successfully.', output: stdout });
          } else {
            safeSend({ type: 'sftp-extract-res', id, success: false, error: stderr.trim() || stdout.trim() || `Command exited with code ${code}` });
          }
        });
      });
      return;
    }

    // --- SFTP COMPRESS ARCHIVE ---
    if (type === 'sftp-compress') {
      const { dir: currentDir, files: fileNames, archiveName, format, id } = msg;
      if (!sshClient || !isConnected) {
        safeSend({ type: 'sftp-compress-res', id, success: false, error: 'SSH connection not active' });
        return;
      }

      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        safeSend({ type: 'sftp-compress-res', id, success: false, error: 'No files specified for compression' });
        return;
      }

      const escapeShell = (str) => "'" + str.replace(/'/g, "'\\''") + "'";
      const destDir = escapeShell(currentDir || '.');
      const safeArchive = escapeShell(archiveName);
      const safeFiles = fileNames.map(f => escapeShell(f)).join(' ');

      let cmd = '';
      if (format === 'zip' || (archiveName && archiveName.toLowerCase().endsWith('.zip'))) {
        cmd = `if command -v zip >/dev/null 2>&1; then cd ${destDir} && zip -r ${safeArchive} ${safeFiles}; elif command -v 7z >/dev/null 2>&1; then cd ${destDir} && 7z a ${safeArchive} ${safeFiles}; elif command -v python3 >/dev/null 2>&1; then cd ${destDir} && python3 -c "import zipfile, sys; z = zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED); [z.write(f) for f in sys.argv[2:]]; z.close()" ${safeArchive} ${safeFiles}; else echo "Error: zip or 7z is not installed on the remote server." >&2; exit 127; fi`;
      } else {
        cmd = `if command -v tar >/dev/null 2>&1; then cd ${destDir} && tar -czf ${safeArchive} ${safeFiles}; else echo "Error: tar is not installed on the remote server." >&2; exit 127; fi`;
      }

      sshClient.exec(cmd, (err, stream) => {
        if (err) {
          safeSend({ type: 'sftp-compress-res', id, success: false, error: err.message });
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (d) => { stdout += d.toString(); });
        stream.stderr.on('data', (d) => { stderr += d.toString(); });

        stream.on('close', (code) => {
          if (code === 0) {
            safeSend({ type: 'sftp-compress-res', id, success: true, message: 'Archive created successfully.', output: stdout });
          } else {
            safeSend({ type: 'sftp-compress-res', id, success: false, error: stderr.trim() || stdout.trim() || `Compression failed with code ${code}` });
          }
        });
      });
      return;
    }

    // --- SFTP DOWNLOAD DIRECTORY (AUTO ZIP & DOWNLOAD) ---
    if (type === 'sftp-download-dir') {
      const { path: dirPath, id } = msg;
      if (!checkSftp(id)) return;

      if (!sshClient || !isConnected) {
        safeSend({ type: 'sftp-download-dir-res', id, success: false, error: 'SSH connection not active for directory compression' });
        return;
      }

      const escapeShell = (str) => "'" + str.replace(/'/g, "'\\''") + "'";
      const folderName = path.basename(dirPath) || 'folder';
      const parentDir = path.dirname(dirPath) || '.';
      const randomSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const tempZipBase = `/tmp/sftp_dl_${randomSuffix}`;
      const tempZipPath = `${tempZipBase}.zip`;

      const escapedParent = escapeShell(parentDir);
      const escapedFolder = escapeShell(folderName);
      const escapedZip = escapeShell(tempZipPath);

      const cmd = `if command -v zip >/dev/null 2>&1; then
  cd ${escapedParent} && zip -r -q ${escapedZip} ${escapedFolder} && echo "zip"
elif command -v python3 >/dev/null 2>&1; then
  cd ${escapedParent} && python3 -c "import shutil, sys; shutil.make_archive(sys.argv[1].replace('.zip',''), 'zip', sys.argv[2], sys.argv[3])" ${escapedZip} ${escapedParent} ${escapedFolder} && echo "zip"
elif command -v 7z >/dev/null 2>&1; then
  cd ${escapedParent} && 7z a ${escapedZip} ${escapedFolder} && echo "zip"
else
  cd ${escapedParent} && tar -czf ${escapedZip}.tar.gz ${escapedFolder} && echo "tar"
fi`;

      sshClient.exec(cmd, (execErr, stream) => {
        if (execErr) {
          safeSend({ type: 'sftp-download-dir-res', id, success: false, error: execErr.message });
          return;
        }

        let stdout = '';
        let stderr = '';
        stream.on('data', d => { stdout += d.toString(); });
        stream.stderr.on('data', d => { stderr += d.toString(); });

        stream.on('close', code => {
          if (code !== 0) {
            safeSend({ type: 'sftp-download-dir-res', id, success: false, error: stderr.trim() || `Archiving failed with code ${code}` });
            return;
          }

          const isTar = stdout.trim().includes('tar');
          const finalArchivePath = isTar ? `${tempZipPath}.tar.gz` : tempZipPath;
          const downloadFilename = isTar ? `${folderName}.tar.gz` : `${folderName}.zip`;

          sftpSession.stat(finalArchivePath, (sErr, stats) => {
            if (sErr) {
              safeSend({ type: 'sftp-download-dir-res', id, success: false, error: `Archive not found: ${sErr.message}` });
              return;
            }

            const maxLimit = 200 * 1024 * 1024; // 200MB limit
            if (stats.size > maxLimit) {
              sftpSession.unlink(finalArchivePath, () => {});
              safeSend({ type: 'sftp-download-dir-res', id, success: false, error: `Folder archive exceeds maximum download limit (${(stats.size / 1024 / 1024).toFixed(1)} MB > 200 MB)` });
              return;
            }

            const chunks = [];
            const readStream = sftpSession.createReadStream(finalArchivePath);

            readStream.on('data', chunk => chunks.push(chunk));
            readStream.on('error', readErr => {
              sftpSession.unlink(finalArchivePath, () => {});
              safeSend({ type: 'sftp-download-dir-res', id, success: false, error: readErr.message });
            });

            readStream.on('end', () => {
              const buffer = Buffer.concat(chunks);
              // Clean up temporary archive file
              sftpSession.unlink(finalArchivePath, () => {});

              safeSend({
                type: 'sftp-download-dir-res',
                id,
                success: true,
                filename: downloadFilename,
                size: stats.size,
                content: buffer.toString('base64')
              });
            });
          });
        });
      });
      return;
    }

    // --- SFTP STAT ---
    if (type === 'sftp-stat') {
      const { path: targetPath, id } = msg;
      if (!checkSftp(id)) return;

      sftpSession.stat(targetPath, (err, stats) => {
        if (err) {
          safeSend({ type: 'sftp-stat-res', id, success: false, error: err.message });
          return;
        }
        safeSend({
          type: 'sftp-stat-res',
          id,
          success: true,
          path: targetPath,
          stat: {
            size: stats.size,
            mode: stats.mode,
            permissions: (stats.mode & 0o777).toString(8),
            uid: stats.uid,
            gid: stats.gid,
            atime: stats.atime,
            mtime: stats.mtime,
            isDirectory: (stats.mode & 0o40000) === 0o40000,
            isFile: (stats.mode & 0o100000) === 0o100000
          }
        });
      });
      return;
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected (${clientIp})`);
    clearInterval(pingInterval);
    cleanupSSH();
  });

  ws.on('error', (err) => {
    console.error(`[WS Error] ${clientIp}:`, err.message);
    cleanupSSH();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`🚀 Chrome SSH & SFTP Bridge Server is RUNNING!`);
  console.log(`📡 HTTP Server: http://${HOST}:${PORT}`);
  console.log(`⚡ WebSocket URL: ws://${HOST}:${PORT}/ws`);
  console.log(`====================================================`);
});
