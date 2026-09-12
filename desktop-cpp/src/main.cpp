#include "webview.h"
#include "bridge/cpp_bridge_server.hpp"
#include "bridge_manager.hpp"
#include "polyfills.hpp"

#include <iostream>
#include <string>
#include <filesystem>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#include <limits.h>
#endif

namespace fs = std::filesystem;

// Retrieve the directory where the current executable resides
std::string getExecutableDir() {
#ifdef _WIN32
    char buffer[MAX_PATH];
    GetModuleFileNameA(NULL, buffer, MAX_PATH);
    return fs::path(buffer).parent_path().string();
#elif defined(__APPLE__)
    char buffer[1024];
    uint32_t size = sizeof(buffer);
    if (_NSGetExecutablePath(buffer, &size) == 0) {
        return fs::canonical(buffer).parent_path().string();
    }
    return ".";
#else
    char buffer[PATH_MAX];
    ssize_t count = readlink("/proc/self/exe", buffer, PATH_MAX);
    if (count > 0) {
        buffer[count] = '\0';
        return fs::path(buffer).parent_path().string();
    }
    return ".";
#endif
}

#ifdef _WIN32
int WINAPI WinMain(HINSTANCE /*hInst*/, HINSTANCE /*hPrevInst*/, LPSTR lpCmdLine, int /*nCmdShow*/) {
    int argc = __argc;
    char** argv = __argv;
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
#else
int main(int argc, char** argv) {
#endif
    std::string exeDir = getExecutableDir();
    int port = 3000;
    bool devMode = false;
    std::string targetUrl = "";

    // Parse command line arguments
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--dev" || arg == "-d") {
            devMode = true;
        } else if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        } else if (arg == "--url" && i + 1 < argc) {
            targetUrl = argv[++i];
        }
    }

    std::cout << "==================================================\n";
    std::cout << "⚡ LiveKadeh SSH & SFTP Native C++ Desktop Client\n";
    std::cout << "==================================================\n";

    // Auto-discover local UI assets
    std::string assetsDir = "";
    std::vector<std::string> assetCandidatePaths = {
        exeDir + "/assets",
        exeDir + "/../extension",
        exeDir + "/extension",
        exeDir + "/../../extension"
    };
    for (const auto& cp : assetCandidatePaths) {
        if (fs::exists(cp) && fs::exists(cp + "/app.html")) {
            assetsDir = fs::canonical(cp).string();
            break;
        }
    }

    std::string localAppHtml = "";
    if (!assetsDir.empty()) {
        std::string np = assetsDir + "/app.html";
        for (char& c : np) { if (c == '\\') c = '/'; }
        localAppHtml = "file:///" + np;
    }

    // Initialize Embedded C++ Bridge Server
    bridge::CppBridgeServer embeddedBridge(port, assetsDir);
    std::cout << "[Native Desktop] Launching Embedded C++ Bridge on port " << port << "...\n";
    bool bridgeActive = embeddedBridge.start();

    if (targetUrl.empty()) {
        if (bridgeActive) {
            targetUrl = "http://127.0.0.1:" + std::to_string(port) + "/app/app.html";
        } else if (!localAppHtml.empty()) {
            targetUrl = localAppHtml;
        }
    }

    std::cout << "[Native Desktop] Bridge active: " << (bridgeActive ? "YES" : "NO") << "\n";
    std::cout << "[Native Desktop] Target URL: " << (targetUrl.empty() ? "(Fallback UI)" : targetUrl) << "\n";

    try {
        webview::webview w(devMode, nullptr);

        w.set_title("LiveKadeh SSH & SFTP Pro");
        w.set_size(1280, 800, WEBVIEW_HINT_NONE);

#ifdef _WIN32
        HWND hwnd = static_cast<HWND>(w.window().value());
        if (hwnd) {
            HINSTANCE hInst = GetModuleHandle(NULL);
            HICON hIconBig = (HICON)LoadImageA(hInst, MAKEINTRESOURCEA(1), IMAGE_ICON, 32, 32, LR_DEFAULTCOLOR);
            HICON hIconSmall = (HICON)LoadImageA(hInst, MAKEINTRESOURCEA(1), IMAGE_ICON, 16, 16, LR_DEFAULTCOLOR);
            if (hIconBig) SendMessageA(hwnd, WM_SETICON, ICON_BIG, (LPARAM)hIconBig);
            if (hIconSmall) SendMessageA(hwnd, WM_SETICON, ICON_SMALL, (LPARAM)hIconSmall);
        }
#elif defined(__linux__)
        GtkWindow* gtkWin = GTK_WINDOW(w.window().value());
        if (gtkWin) {
            std::string iconPath = assetsDir + "/icons/icon128.png";
            if (fs::exists(iconPath)) {
                gtk_window_set_icon_from_file(gtkWin, iconPath.c_str(), NULL);
            }
        }
#endif

        // Inject persistent storage and runtime polyfills
        w.init(POLYFILLS_JS);

        // Bind native C++ methods accessible from frontend JavaScript
        w.bind("nativeQuit", [&w](const std::string& /*req*/) -> std::string {
            w.terminate();
            return "true";
        });

        w.bind("nativeGetPlatform", [](const std::string& /*req*/) -> std::string {
#ifdef _WIN32
            return "\"windows-x64\"";
#elif defined(__APPLE__)
            return "\"macos\"";
#else
            return "\"linux-x64\"";
#endif
        });

        w.bind("nativeGetVersion", [](const std::string& /*req*/) -> std::string {
            return "\"1.5.1\"";
        });

        // Navigate to target URL or show graceful fallback
        if (!targetUrl.empty()) {
            w.navigate(targetUrl);
        } else {
            std::string fallbackHtml = R"html(
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  body { background: #0a0e17; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
  .box { background: #131d2e; border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 12px; padding: 36px; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  h2 { color: #00f0ff; margin-top: 0; }
  p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
  code { background: #1e293b; padding: 3px 8px; border-radius: 4px; color: #38bdf8; font-family: monospace; font-size: 13px; }
  .btn { display: inline-block; margin-top: 18px; background: #00f0ff; color: #0a0e17; padding: 10px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; border: none; font-size: 14px; }
</style>
</head>
<body>
<div class="box">
  <h2>⚡ LiveKadeh SSH & SFTP Pro</h2>
  <p>فولدر <code>assets</code> در کنار فایل برنامه یافت نشد یا سرور بریج فعال نیست.</p>
  <p dir="ltr" style="font-size: 12px; color: #64748b;">Please ensure the <code>assets</code> directory is extracted next to <code>LiveKadeh-SSH-SFTP.exe</code>.</p>
  <button class="btn" onclick="location.reload()">تلاش مجدد (Reload)</button>
</div>
</body>
</html>
)html";
            w.set_html(fallbackHtml);
        }

        // Run UI event loop
        w.run();

    } catch (const webview::exception& e) {
        std::cerr << "[Native Desktop] Webview error: " << e.what() << "\n";
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "[Native Desktop] General error: " << e.what() << "\n";
        return 1;
    }

    // Clean up
    embeddedBridge.stop();
#ifdef _WIN32
    WSACleanup();
#endif
    std::cout << "[Native Desktop] Application closed gracefully.\n";
    return 0;
}
