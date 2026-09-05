# LiveKadeh SSH & SFTP Pro - Standalone Desktop Client

This package wraps the LiveKadeh SSH & SFTP extension and the high-speed WebSocket bridge into a **zero-dependency, single-file standalone Windows executable (`.exe`)** using Electron.

## Features

- **Zero Dependencies**: Does not require Google Chrome, Node.js, or any external bridge installation.
- **Embedded WebSocket Bridge**: Automatically starts the bridge on a free local port (default 3000) inside the app lifecycle.
- **Full Offline Persistence**: Profiles, settings, and keys are stored in a dedicated local file in user app data.
- **Single Portable Executable**: Generates `LiveKadeh-SSH-SFTP-Portable-v1.4.3.exe` for instant launch without an installer.

## Development & Local Run

```bash
cd desktop
npm install
npm start
```

## Building Standalone Windows Executable (.exe)

```bash
cd desktop
npm run build:win
```

The output file will be generated in `dist/`:
`dist/LiveKadeh-SSH-SFTP-Portable-v1.4.3.exe`
