# ⚡ LiveKadeh SSH & SFTP Native C++ Desktop Client

High-performance, ultra-lightweight standalone desktop client for **LiveKadeh SSH & SFTP Pro** built with **C++17** and OS native Webview (Microsoft Edge WebView2 on Windows, WebKitGTK on Linux, and WebKit on macOS).

---

## 🚀 Key Advantages Over Electron

| Metric | Electron Desktop (Legacy) | Native C++ Desktop (New) | Benefit |
| :--- | :--- | :--- | :--- |
| **Binary Size** | ~87 MB to 130 MB | **~1.5 MB to 3 MB** | **>95% size reduction!** |
| **Memory Footprint (RAM)** | ~150 MB to 250 MB | **~25 MB to 35 MB** | **85% less RAM usage** |
| **Startup Time** | 2 to 3 seconds | **Instant (<0.3s)** | Instantaneous launch |
| **UI & Experience** | Complete | **100% Identical** | Retains all themes, fonts, and BiDi |
| **Bundling Overhead** | Full Chromium + Node runtime | Uses native OS Webview | Zero unnecessary bloat |

---

## 📁 Directory Structure

```text
desktop-cpp/
├── CMakeLists.txt         # Cross-platform CMake build system
├── Makefile               # Direct Linux / macOS Makefile
├── build-linux.sh         # Linux automated build script
├── build-windows.bat      # Windows automated build script
├── README.md              # English documentation
├── README_fa.md           # Persian documentation
└── src/
    ├── main.cpp           # App entry point, window management, native JS bindings
    ├── webview.h          # Standalone amalgamated C++ Webview library header
    ├── bridge_manager.hpp # Process lifecycle and auto-discovery for bridge server
    └── polyfills.hpp      # Polyfills for persistent storage (chrome.storage)
```

---

## 🛠️ Build Instructions

### 1. Windows
Prerequisites:
- **Visual Studio 2019/2022** (with *Desktop development with C++*) or **MinGW-w64**
- **CMake** (3.16+)

Simply run:
```cmd
build-windows.bat
```
The output executable `LiveKadeh-SSH-SFTP.exe` (~1.5 MB) will be generated in `build\Release\`.

### 2. Linux
Prerequisites:
```bash
sudo apt update
sudo apt install -y build-essential cmake pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
```

Build:
```bash
chmod +x build-linux.sh
./build-linux.sh
```

### 3. macOS
```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
```

