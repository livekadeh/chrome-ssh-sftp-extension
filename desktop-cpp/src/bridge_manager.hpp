#ifndef BRIDGE_MANAGER_HPP
#define BRIDGE_MANAGER_HPP

#include <iostream>
#include <string>
#include <chrono>
#include <thread>
#include <filesystem>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#else
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>
#endif

namespace fs = std::filesystem;

class BridgeManager {
public:
    BridgeManager(int port = 3000, const std::string& host = "127.0.0.1")
        : port_(port), host_(host), spawnedPid_(0), bridgeSpawnedByUs_(false) {
#ifdef _WIN32
        WSADATA wsaData;
        WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
    }

    ~BridgeManager() {
        stopBridge();
#ifdef _WIN32
        WSACleanup();
#endif
    }

    // Check if the bridge port is already accepting TCP connections
    bool isPortOpen() {
#ifdef _WIN32
        SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (sock == INVALID_SOCKET) return false;

        u_long mode = 1;
        ioctlsocket(sock, FIONBIO, &mode);

        sockaddr_in addr;
        addr.sin_family = AF_INET;
        addr.sin_port = htons(port_);
        inet_pton(AF_INET, host_.c_str(), &addr.sin_addr);

        int res = connect(sock, (struct sockaddr*)&addr, sizeof(addr));
        bool connected = false;
        if (res == 0) {
            connected = true;
        } else {
            fd_set writeSet;
            FD_ZERO(&writeSet);
            FD_SET(sock, &writeSet);
            timeval timeout;
            timeout.tv_sec = 0;
            timeout.tv_usec = 200000; // 200ms
            if (select(0, nullptr, &writeSet, nullptr, &timeout) > 0) {
                connected = true;
            }
        }
        closesocket(sock);
        return connected;
#else
        int sock = socket(AF_INET, SOCK_STREAM, 0);
        if (sock < 0) return false;

        struct timeval timeout;
        timeout.tv_sec = 0;
        timeout.tv_usec = 200000; // 200ms
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
        setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&timeout, sizeof(timeout));

        struct sockaddr_in addr;
        addr.sin_family = AF_INET;
        addr.sin_port = htons(port_);
        inet_pton(AF_INET, host_.c_str(), &addr.sin_addr);

        int res = connect(sock, (struct sockaddr*)&addr, sizeof(addr));
        close(sock);
        return (res == 0);
#endif
    }

    // Ensure the bridge is running; if not, spawn it from detected binaries or scripts
    bool ensureBridgeRunning(const std::string& appDir) {
        if (isPortOpen()) {
            std::cout << "[BridgeManager] Existing bridge server detected on port " << port_ << ".\n";
            return true;
        }

        std::cout << "[BridgeManager] Port " << port_ << " is not active. Attempting to launch local bridge...\n";

        std::string serverDir = appDir + "/../server";
        if (!fs::exists(serverDir)) {
            serverDir = appDir + "/server";
        }

#ifdef _WIN32
        std::string batPath = serverDir + "/start-windows.bat";
        std::string exePath = serverDir + "/livekadeh-bridge-windows-x64.exe";
        std::string nodeScript = serverDir + "/server.js";

        std::string cmd;
        if (fs::exists(exePath)) {
            cmd = "\"" + exePath + "\"";
        } else if (fs::exists(nodeScript)) {
            cmd = "node \"" + nodeScript + "\"";
        } else if (fs::exists(batPath)) {
            cmd = "cmd.exe /c \"" + batPath + "\"";
        }

        if (!cmd.empty()) {
            STARTUPINFOA si;
            PROCESS_INFORMATION pi;
            ZeroMemory(&si, sizeof(si));
            si.cb = sizeof(si);
            si.dwFlags |= STARTF_USESHOWWINDOW;
            si.wShowWindow = SW_HIDE;
            ZeroMemory(&pi, sizeof(pi));

            char cmdBuf[1024];
            strncpy_s(cmdBuf, cmd.c_str(), sizeof(cmdBuf));

            if (CreateProcessA(nullptr, cmdBuf, nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, serverDir.c_str(), &si, &pi)) {
                spawnedProcess_ = pi.hProcess;
                spawnedPid_ = pi.dwProcessId;
                CloseHandle(pi.hThread);
                bridgeSpawnedByUs_ = true;
            }
        }
#else
        std::string binPath = serverDir + "/livekadeh-bridge-linux-x64";
        std::string jsPath = serverDir + "/server.js";

        pid_t pid = fork();
        if (pid == 0) {
            // Child process
            chdir(serverDir.c_str());
            if (fs::exists(binPath)) {
                execl(binPath.c_str(), binPath.c_str(), (char*)nullptr);
            } else if (fs::exists(jsPath)) {
                execlp("node", "node", jsPath.c_str(), (char*)nullptr);
            }
            _exit(1);
        } else if (pid > 0) {
            spawnedPid_ = pid;
            bridgeSpawnedByUs_ = true;
        }
#endif

        // Wait for bridge to become ready
        for (int i = 0; i < 40; ++i) { // up to 4 seconds
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            if (isPortOpen()) {
                std::cout << "[BridgeManager] Bridge server successfully started and listening on port " << port_ << ".\n";
                return true;
            }
        }

        std::cerr << "[BridgeManager] Warning: Timed out waiting for bridge server on port " << port_ << ".\n";
        return false;
    }

    void stopBridge() {
        if (!bridgeSpawnedByUs_ || spawnedPid_ == 0) return;

#ifdef _WIN32
        if (spawnedProcess_ != nullptr) {
            TerminateProcess(spawnedProcess_, 0);
            CloseHandle(spawnedProcess_);
            spawnedProcess_ = nullptr;
        }
#else
        if (spawnedPid_ > 0) {
            kill(spawnedPid_, SIGTERM);
            int status = 0;
            waitpid(spawnedPid_, &status, WNOHANG);
        }
#endif
        bridgeSpawnedByUs_ = false;
        spawnedPid_ = 0;
        std::cout << "[BridgeManager] Cleaned up child bridge process.\n";
    }

    int getPort() const { return port_; }
    std::string getHost() const { return host_; }

private:
    int port_;
    std::string host_;
    int spawnedPid_;
    bool bridgeSpawnedByUs_;

#ifdef _WIN32
    HANDLE spawnedProcess_ = nullptr;
#endif
};

#endif // BRIDGE_MANAGER_HPP

