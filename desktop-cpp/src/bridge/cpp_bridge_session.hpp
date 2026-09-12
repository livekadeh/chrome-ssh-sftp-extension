#ifndef CPP_BRIDGE_SESSION_HPP
#define CPP_BRIDGE_SESSION_HPP

#include <string>
#include <vector>
#include <map>
#include <memory>
#include <thread>
#include <atomic>
#include <mutex>
#include <iostream>
#include <chrono>
#include <functional>
#include <algorithm>
#include <sstream>
#include <iomanip>
#include <random>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
typedef SOCKET socket_t;
#define CLOSE_SOCKET(s) closesocket(s)
#else
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#include <fcntl.h>
typedef int socket_t;
#define INVALID_SOCKET (-1)
#define SOCKET_ERROR (-1)
#define CLOSE_SOCKET(s) close(s)
#endif

#include "libssh2.h"
#include "libssh2_sftp.h"
#include "nlohmann/json.hpp"
#include "base64.hpp"

namespace bridge {

class BridgeSession {
public:
    using MessageSender = std::function<void(const std::string&)>;

    BridgeSession(unsigned long connId, MessageSender sender)
        : connId_(connId),
          sendMsg_(sender),
          sock_(INVALID_SOCKET),
          sshSession_(nullptr),
          sshChannel_(nullptr),
          sftpSession_(nullptr),
          isConnected_(false),
          readerActive_(false) {
    }

    ~BridgeSession() {
        cleanup();
    }

    unsigned long getConnId() const { return connId_; }
    const std::string& getSessionId() const { return sessionId_; }
    bool isConnected() const { return isConnected_; }

    // Connect socket to remote host and port with timeout and detailed diagnostics
    socket_t connectSocket(const std::string& host, int port, std::string& outError) {
#ifdef _WIN32
        WSADATA wsaData;
        WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
        std::string cleanHost = host;
        // Trim leading and trailing whitespace
        cleanHost.erase(0, cleanHost.find_first_not_of(" \t\r\n"));
        size_t lastNonWs = cleanHost.find_last_not_of(" \t\r\n");
        if (lastNonWs != std::string::npos) {
            cleanHost.erase(lastNonWs + 1);
        }

        std::string portStr = std::to_string(port > 0 ? port : 22);

        // Try IPv4 first (AF_INET), fallback to AF_UNSPEC if needed
        struct addrinfo hints{}, *res = nullptr;
        hints.ai_family = AF_INET;
        hints.ai_socktype = SOCK_STREAM;
        hints.ai_protocol = IPPROTO_TCP;

        int gai_err = getaddrinfo(cleanHost.c_str(), portStr.c_str(), &hints, &res);
        if (gai_err != 0 || !res) {
            memset(&hints, 0, sizeof(hints));
            hints.ai_family = AF_UNSPEC;
            hints.ai_socktype = SOCK_STREAM;
            gai_err = getaddrinfo(cleanHost.c_str(), portStr.c_str(), &hints, &res);
            if (gai_err != 0 || !res) {
                outError = "DNS resolution failed (gai_err: " + std::to_string(gai_err) + ")";
                return INVALID_SOCKET;
            }
        }

        socket_t s = INVALID_SOCKET;
        std::string detailedError = "";

        for (struct addrinfo* p = res; p != nullptr; p = p->ai_next) {
            s = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
            if (s == INVALID_SOCKET) {
#ifdef _WIN32
                detailedError = "socket() failed (code: " + std::to_string(WSAGetLastError()) + ")";
#else
                detailedError = "socket() failed (" + std::string(strerror(errno)) + ")";
#endif
                continue;
            }

            // Set socket non-blocking for asynchronous connect with timeout
#ifdef _WIN32
            u_long nonblock = 1;
            ioctlsocket(s, FIONBIO, &nonblock);
#else
            int flags = fcntl(s, F_GETFL, 0);
            fcntl(s, F_SETFL, flags | O_NONBLOCK);
#endif

            int cr = connect(s, p->ai_addr, (int)p->ai_addrlen);
            bool connected = false;

            if (cr == 0) {
                connected = true;
            } else {
#ifdef _WIN32
                int wsaErr = WSAGetLastError();
                if (wsaErr == WSAEWOULDBLOCK || wsaErr == WSAEINPROGRESS) {
                    fd_set writeSet, errSet;
                    FD_ZERO(&writeSet);
                    FD_ZERO(&errSet);
                    FD_SET(s, &writeSet);
                    FD_SET(s, &errSet);

                    timeval timeout;
                    timeout.tv_sec = 10;
                    timeout.tv_usec = 0;

                    int sel = select(0, nullptr, &writeSet, &errSet, &timeout);
                    if (sel > 0 && FD_ISSET(s, &writeSet) && !FD_ISSET(s, &errSet)) {
                        int sockErr = 0;
                        int sockErrLen = sizeof(sockErr);
                        getsockopt(s, SOL_SOCKET, SO_ERROR, (char*)&sockErr, &sockErrLen);
                        if (sockErr == 0) {
                            connected = true;
                        } else {
                            detailedError = "Connect error (code: " + std::to_string(sockErr) + ")";
                        }
                    } else if (sel == 0) {
                        detailedError = "Connection timed out after 10s";
                    } else {
                        detailedError = "Connection failed on select";
                    }
                } else {
                    detailedError = "Connect failed (code: " + std::to_string(wsaErr) + ")";
                }
#else
                if (errno == EINPROGRESS) {
                    fd_set writeSet;
                    FD_ZERO(&writeSet);
                    FD_SET(s, &writeSet);

                    timeval timeout;
                    timeout.tv_sec = 10;
                    timeout.tv_usec = 0;

                    int sel = select(s + 1, nullptr, &writeSet, nullptr, &timeout);
                    if (sel > 0) {
                        int sockErr = 0;
                        socklen_t sockErrLen = sizeof(sockErr);
                        getsockopt(s, SOL_SOCKET, SO_ERROR, &sockErr, &sockErrLen);
                        if (sockErr == 0) {
                            connected = true;
                        } else {
                            detailedError = "Connect error (" + std::string(strerror(sockErr)) + ")";
                        }
                    } else if (sel == 0) {
                        detailedError = "Connection timed out after 10s";
                    }
                } else {
                    detailedError = "Connect failed (" + std::string(strerror(errno)) + ")";
                }
#endif
            }

            if (connected) {
                // Restore blocking socket mode for libssh2
#ifdef _WIN32
                nonblock = 0;
                ioctlsocket(s, FIONBIO, &nonblock);
#else
                fcntl(s, F_SETFL, flags);
#endif
                break;
            }

            CLOSE_SOCKET(s);
            s = INVALID_SOCKET;
        }
        freeaddrinfo(res);

        if (s == INVALID_SOCKET && outError.empty()) {
            outError = detailedError.empty() ? "Connection failed" : detailedError;
        }
        return s;
    }

    // Authenticate SSH session via password or private key
    bool authenticate(LIBSSH2_SESSION* session,
                      const std::string& username,
                      const std::string& password,
                      const std::string& privateKey,
                      const std::string& passphrase) {
        bool authOk = false;

        if (!password.empty()) {
            int rc = libssh2_userauth_password(session, username.c_str(), password.c_str());
            if (rc == 0) authOk = true;
        }

        if (!authOk && !privateKey.empty()) {
            int rc = libssh2_userauth_publickey_frommemory(
                session,
                username.c_str(),
                username.length(),
                nullptr,
                0,
                privateKey.c_str(),
                privateKey.length(),
                passphrase.c_str()
            );
            if (rc == 0) authOk = true;
        }

        return authOk;
    }

    // Initialize SSH Terminal connection
    void initSsh(const std::string& host, int port,
                 const std::string& username,
                 const std::string& password,
                 const std::string& privateKey,
                 const std::string& passphrase,
                 const std::string& term, int cols, int rows) {
        cleanup();

        sendMsg_(nlohmann::json{
            {"type", "ssh-status"},
            {"status", "connecting"},
            {"message", "Connecting to " + username + "@" + host + ":" + std::to_string(port) + "..."}
        }.dump());

        std::string connErr;
        sock_ = connectSocket(host, port, connErr);
        if (sock_ == INVALID_SOCKET) {
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", "Failed to connect to host: " + host + ":" + std::to_string(port) + " (" + connErr + ")"}
            }.dump());
            return;
        }

        sshSession_ = libssh2_session_init();
        if (!sshSession_) {
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", "Failed to initialize SSH2 session"}
            }.dump());
            cleanup();
            return;
        }

        libssh2_session_set_blocking(sshSession_, 1);
        int rc = libssh2_session_handshake(sshSession_, sock_);
        if (rc != 0) {
            char* err_msg = nullptr;
            libssh2_session_last_error(sshSession_, &err_msg, nullptr, 0);
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", std::string("SSH handshake failed: ") + (err_msg ? err_msg : "Unknown error")}
            }.dump());
            cleanup();
            return;
        }

        if (!authenticate(sshSession_, username, password, privateKey, passphrase)) {
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", "Authentication failed (Invalid password or key)"}
            }.dump());
            cleanup();
            return;
        }

        sendMsg_(nlohmann::json{
            {"type", "ssh-status"},
            {"status", "authenticated"},
            {"message", "SSH Authentication successful. Opening PTY shell..."}
        }.dump());

        sshChannel_ = libssh2_channel_open_session(sshSession_);
        if (!sshChannel_) {
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", "Failed to open SSH channel"}
            }.dump());
            cleanup();
            return;
        }

        std::string terminalType = term.empty() ? "xterm-256color" : term;
        int terminalCols = cols > 0 ? cols : 80;
        int terminalRows = rows > 0 ? rows : 24;

        if (libssh2_channel_request_pty(sshChannel_, terminalType.c_str()) != 0) {
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", "Failed to allocate PTY"}
            }.dump());
            cleanup();
            return;
        }

        libssh2_channel_request_pty_size(sshChannel_, terminalCols, terminalRows);

        if (libssh2_channel_shell(sshChannel_) != 0) {
            sendMsg_(nlohmann::json{
                {"type", "ssh-status"},
                {"status", "error"},
                {"message", "Failed to start interactive shell"}
            }.dump());
            cleanup();
            return;
        }

        isConnected_ = true;
        sendMsg_(nlohmann::json{
            {"type", "ssh-status"},
            {"status", "connected"},
            {"message", "Terminal ready"}
        }.dump());

        // Spawn reader thread for terminal output
        readerActive_ = true;
        readerThread_ = std::thread([this]() {
            try {
                char buffer[8192];
                while (readerActive_ && sshChannel_) {
                    ssize_t n = libssh2_channel_read(sshChannel_, buffer, sizeof(buffer));
                    if (n > 0) {
                        sendMsg_(nlohmann::json{
                            {"type", "ssh-output"},
                            {"data", std::string(buffer, n)}
                        }.dump());
                    } else if (n < 0) {
                        if (n != LIBSSH2_ERROR_EAGAIN) {
                            break;
                        }
                    } else if (n == 0) {
                        if (libssh2_channel_eof(sshChannel_)) {
                            break;
                        }
                    }
                    std::this_thread::sleep_for(std::chrono::milliseconds(2));
                }

                if (isConnected_) {
                    sendMsg_(nlohmann::json{
                        {"type", "ssh-status"},
                        {"status", "disconnected"},
                        {"message", "SSH session disconnected by remote host."}
                    }.dump());
                    isConnected_ = false;
                }
            } catch (...) {}
        });
    }

    // Write terminal user keystrokes to remote shell
    void writeSshInput(const std::string& data) {
        if (sshChannel_ && isConnected_) {
            libssh2_channel_write(sshChannel_, data.data(), data.length());
        }
    }

    // Resize terminal PTY
    void resizeSsh(int cols, int rows) {
        if (sshChannel_ && isConnected_) {
            libssh2_channel_request_pty_size(sshChannel_, cols > 0 ? cols : 80, rows > 0 ? rows : 24);
        }
    }

    // Close SSH session
    void closeSsh() {
        cleanup();
        sendMsg_(nlohmann::json{
            {"type", "ssh-status"},
            {"status", "disconnected"},
            {"message", "Session closed by user."}
        }.dump());
    }

    // Initialize SFTP connection
    void initSftp(const std::string& host, int port,
                  const std::string& username,
                  const std::string& password,
                  const std::string& privateKey,
                  const std::string& passphrase) {
        cleanup();

        sendMsg_(nlohmann::json{
            {"type", "sftp-status"},
            {"status", "connecting"},
            {"message", "Opening SFTP connection to " + username + "@" + host + ":" + std::to_string(port) + "..."}
        }.dump());

        std::string connErr;
        sock_ = connectSocket(host, port, connErr);
        if (sock_ == INVALID_SOCKET) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-status"},
                {"status", "error"},
                {"message", "Failed to connect to host: " + host + ":" + std::to_string(port) + " (" + connErr + ")"}
            }.dump());
            return;
        }

        sshSession_ = libssh2_session_init();
        if (!sshSession_) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-status"},
                {"status", "error"},
                {"message", "Failed to initialize SSH2 session for SFTP"}
            }.dump());
            cleanup();
            return;
        }

        libssh2_session_set_blocking(sshSession_, 1);
        int rc = libssh2_session_handshake(sshSession_, sock_);
        if (rc != 0) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-status"},
                {"status", "error"},
                {"message", "SSH handshake failed"}
            }.dump());
            cleanup();
            return;
        }

        if (!authenticate(sshSession_, username, password, privateKey, passphrase)) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-status"},
                {"status", "error"},
                {"message", "SFTP Authentication failed (Invalid password or key)"}
            }.dump());
            cleanup();
            return;
        }

        sftpSession_ = libssh2_sftp_init(sshSession_);
        if (!sftpSession_) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-status"},
                {"status", "error"},
                {"message", "Unable to initialize SFTP subsystem"}
            }.dump());
            cleanup();
            return;
        }

        sessionId_ = generateSessionId();
        isConnected_ = true;

        sendMsg_(nlohmann::json{
            {"type", "sftp-status"},
            {"status", "connected"},
            {"message", "SFTP Session Established"},
            {"sessionId", sessionId_}
        }.dump());
    }

    // SFTP List directory
    void listDirectory(const std::string& path, const std::string& id) {
        if (!sftpSession_) {
            sendMsg_(nlohmann::json{{"type", "sftp-error"}, {"id", id}, {"message", "SFTP session not active"}}.dump());
            return;
        }

        std::lock_guard<std::mutex> lock(sftpMutex_);
        std::string targetPath = path.empty() ? "." : path;
        LIBSSH2_SFTP_HANDLE* handle = libssh2_sftp_opendir(sftpSession_, targetPath.c_str());
        if (!handle) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-list-res"},
                {"id", id},
                {"success", false},
                {"path", targetPath},
                {"error", "Failed to open directory"}
            }.dump());
            return;
        }

        char mem[1024];
        char longentry[2048];
        LIBSSH2_SFTP_ATTRIBUTES attrs;
        std::vector<nlohmann::json> files;

        while (libssh2_sftp_readdir_ex(handle, mem, sizeof(mem), longentry, sizeof(longentry), &attrs) > 0) {
            std::string filename = mem;
            if (filename == "." || filename == "..") continue;

            bool isDir = (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) && ((attrs.permissions & 0170000) == 0040000);
            bool isLink = (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) && ((attrs.permissions & 0170000) == 0120000);
            bool isFile = (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) && ((attrs.permissions & 0170000) == 0100000);

            char permOctal[16] = "755";
            if (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) {
                snprintf(permOctal, sizeof(permOctal), "%03o", (unsigned int)(attrs.permissions & 0777));
            }

            nlohmann::json item = {
                {"filename", filename},
                {"longname", std::string(longentry)},
                {"attrs", {
                    {"mode", (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) ? attrs.permissions : 0},
                    {"uid", (attrs.flags & LIBSSH2_SFTP_ATTR_UIDGID) ? attrs.uid : 0},
                    {"gid", (attrs.flags & LIBSSH2_SFTP_ATTR_UIDGID) ? attrs.gid : 0},
                    {"size", (attrs.flags & LIBSSH2_SFTP_ATTR_SIZE) ? attrs.filesize : 0},
                    {"atime", (attrs.flags & LIBSSH2_SFTP_ATTR_ACMODTIME) ? attrs.atime : 0},
                    {"mtime", (attrs.flags & LIBSSH2_SFTP_ATTR_ACMODTIME) ? attrs.mtime : 0},
                    {"isDirectory", isDir},
                    {"isSymbolicLink", isLink},
                    {"isFile", isFile},
                    {"permissions", std::string(permOctal)}
                }}
            };
            files.push_back(item);
        }
        libssh2_sftp_closedir(handle);

        // Sort items: directories first, then alphabetically
        std::sort(files.begin(), files.end(), [](const nlohmann::json& a, const nlohmann::json& b) {
            bool aDir = a["attrs"]["isDirectory"].get<bool>();
            bool bDir = b["attrs"]["isDirectory"].get<bool>();
            if (aDir && !bDir) return true;
            if (!aDir && bDir) return false;
            return a["filename"].get<std::string>() < b["filename"].get<std::string>();
        });

        // Resolve absolute real path
        char realPathBuf[4096] = {0};
        int r = libssh2_sftp_realpath(sftpSession_, targetPath.c_str(), realPathBuf, sizeof(realPathBuf));
        std::string resolvedPath = (r > 0 && realPathBuf[0]) ? std::string(realPathBuf) : targetPath;

        sendMsg_(nlohmann::json{
            {"type", "sftp-list-res"},
            {"id", id},
            {"success", true},
            {"path", resolvedPath},
            {"files", files}
        }.dump());
    }

    // SFTP Read file
    void readFile(const std::string& path, const std::string& id, size_t maxBytes) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        LIBSSH2_SFTP_ATTRIBUTES attrs;
        if (libssh2_sftp_stat(sftpSession_, path.c_str(), &attrs) != 0) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-read-res"},
                {"id", id},
                {"success", false},
                {"error", "File not found"}
            }.dump());
            return;
        }

        size_t fileSize = (attrs.flags & LIBSSH2_SFTP_ATTR_SIZE) ? attrs.filesize : 0;
        size_t limit = maxBytes > 0 ? maxBytes : (500 * 1024 * 1024);
        if (fileSize > limit) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-read-res"},
                {"id", id},
                {"success", false},
                {"error", "File exceeds maximum size limit"}
            }.dump());
            return;
        }

        LIBSSH2_SFTP_HANDLE* handle = libssh2_sftp_open(sftpSession_, path.c_str(), LIBSSH2_FXF_READ, 0);
        if (!handle) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-read-res"},
                {"id", id},
                {"success", false},
                {"error", "Could not open file for reading"}
            }.dump());
            return;
        }

        std::vector<unsigned char> data;
        data.reserve(fileSize > 0 ? fileSize : 4096);

        char chunk[32768];
        while (true) {
            ssize_t n = libssh2_sftp_read(handle, chunk, sizeof(chunk));
            if (n > 0) {
                data.insert(data.end(), chunk, chunk + n);
            } else {
                break;
            }
        }
        libssh2_sftp_close(handle);

        // Detect if content is binary
        bool isBinary = false;
        size_t inspectLen = std::min<size_t>(data.size(), 512);
        for (size_t i = 0; i < inspectLen; ++i) {
            if (data[i] == 0) {
                isBinary = true;
                break;
            }
        }

        std::string content = isBinary ?
            base64_encode(data.data(), data.size()) :
            std::string(reinterpret_cast<const char*>(data.data()), data.size());

        sendMsg_(nlohmann::json{
            {"type", "sftp-read-res"},
            {"id", id},
            {"success", true},
            {"path", path},
            {"size", data.size()},
            {"isBinary", isBinary},
            {"content", content}
        }.dump());
    }

    // SFTP Write file
    void writeFile(const std::string& path, const std::string& content, bool isBase64, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        std::vector<unsigned char> bytes;
        if (isBase64) {
            bytes = base64_decode(content);
        } else {
            bytes.assign(content.begin(), content.end());
        }

        LIBSSH2_SFTP_HANDLE* handle = libssh2_sftp_open(
            sftpSession_,
            path.c_str(),
            LIBSSH2_FXF_WRITE | LIBSSH2_FXF_CREAT | LIBSSH2_FXF_TRUNC,
            0644
        );
        if (!handle) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-write-res"},
                {"id", id},
                {"success", false},
                {"error", "Failed to open file for writing"}
            }.dump());
            return;
        }

        size_t total = bytes.size();
        size_t offset = 0;
        bool writeErr = false;

        while (offset < total) {
            size_t chunk = std::min<size_t>(total - offset, 32768);
            ssize_t written = libssh2_sftp_write(handle, reinterpret_cast<const char*>(bytes.data() + offset), chunk);
            if (written > 0) {
                offset += written;
            } else {
                writeErr = true;
                break;
            }
        }
        libssh2_sftp_close(handle);

        nlohmann::json res = {
            {"type", "sftp-write-res"},
            {"id", id},
            {"success", !writeErr},
            {"path", path},
            {"size", offset}
        };
        if (writeErr) res["error"] = "Write stream error";
        sendMsg_(res.dump());
    }

    // SFTP Chunked Upload: Init
    void chunkInit(const std::string& path, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        LIBSSH2_SFTP_HANDLE* handle = libssh2_sftp_open(
            sftpSession_,
            path.c_str(),
            LIBSSH2_FXF_WRITE | LIBSSH2_FXF_CREAT | LIBSSH2_FXF_TRUNC,
            0644
        );
        if (!handle) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-chunk-init-res"},
                {"id", id},
                {"success", false},
                {"error", "Failed to initialize chunk upload"}
            }.dump());
            return;
        }

        {
            std::lock_guard<std::mutex> hlock(handlesMutex_);
            uploadHandles_[id] = handle;
            uploadOffsets_[id] = 0;
            uploadPaths_[id] = path;
        }

        sendMsg_(nlohmann::json{
            {"type", "sftp-chunk-init-res"},
            {"id", id},
            {"success", true},
            {"uploadId", id}
        }.dump());
    }

    // SFTP Chunked Upload: Write chunk
    void chunkWrite(const std::string& uploadId, const std::string& chunkBase64, int64_t offset, const std::string& id) {
        LIBSSH2_SFTP_HANDLE* handle = nullptr;
        int64_t currentOffset = 0;

        {
            std::lock_guard<std::mutex> hlock(handlesMutex_);
            auto it = uploadHandles_.find(uploadId);
            if (it == uploadHandles_.end()) {
                sendMsg_(nlohmann::json{
                    {"type", "sftp-chunk-write-res"},
                    {"id", id},
                    {"success", false},
                    {"error", "Upload handle not found"}
                }.dump());
                return;
            }
            handle = it->second;
            currentOffset = (offset >= 0) ? offset : uploadOffsets_[uploadId];
        }

        std::vector<unsigned char> data = base64_decode(chunkBase64);
        ssize_t written = 0;
        {
            std::lock_guard<std::mutex> lock(sftpMutex_);
            libssh2_sftp_seek64(handle, currentOffset);
            written = libssh2_sftp_write(handle, reinterpret_cast<const char*>(data.data()), data.size());
        }

        if (written > 0) {
            {
                std::lock_guard<std::mutex> hlock(handlesMutex_);
                uploadOffsets_[uploadId] = currentOffset + written;
            }
            sendMsg_(nlohmann::json{
                {"type", "sftp-chunk-write-res"},
                {"id", id},
                {"success", true},
                {"written", written}
            }.dump());
        } else {
            sendMsg_(nlohmann::json{
                {"type", "sftp-chunk-write-res"},
                {"id", id},
                {"success", false},
                {"error", "Write chunk failed"}
            }.dump());
        }
    }

    // SFTP Chunked Upload: End
    void chunkEnd(const std::string& uploadId, const std::string& id) {
        LIBSSH2_SFTP_HANDLE* handle = nullptr;
        std::string path;

        {
            std::lock_guard<std::mutex> hlock(handlesMutex_);
            auto it = uploadHandles_.find(uploadId);
            if (it != uploadHandles_.end()) {
                handle = it->second;
                path = uploadPaths_[uploadId];
                uploadHandles_.erase(it);
                uploadOffsets_.erase(uploadId);
                uploadPaths_.erase(uploadId);
            }
        }

        if (handle) {
            {
                std::lock_guard<std::mutex> lock(sftpMutex_);
                libssh2_sftp_close(handle);
            }
            sendMsg_(nlohmann::json{
                {"type", "sftp-chunk-end-res"},
                {"id", id},
                {"success", true},
                {"path", path}
            }.dump());
        } else {
            sendMsg_(nlohmann::json{
                {"type", "sftp-chunk-end-res"},
                {"id", id},
                {"success", false},
                {"error", "Handle not found"}
            }.dump());
        }
    }

    // SFTP Make Directory
    void makeDirectory(const std::string& path, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);
        int rc = libssh2_sftp_mkdir(sftpSession_, path.c_str(), 0755);
        nlohmann::json res = {
            {"type", "sftp-mkdir-res"},
            {"id", id},
            {"success", (rc == 0)},
            {"path", path}
        };
        if (rc != 0) res["error"] = "Failed to create directory";
        sendMsg_(res.dump());
    }

    // SFTP Unlink (Delete file)
    void unlinkFile(const std::string& path, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);
        int rc = libssh2_sftp_unlink(sftpSession_, path.c_str());
        nlohmann::json res = {
            {"type", "sftp-unlink-res"},
            {"id", id},
            {"success", (rc == 0)},
            {"path", path}
        };
        if (rc != 0) res["error"] = "Failed to delete file";
        sendMsg_(res.dump());
    }

    // Helper: Execute shell command via SSH exec channel
    bool executeCommand(const std::string& cmd, std::string& outOutput) {
        if (!sshSession_) return false;
        LIBSSH2_CHANNEL* ch = libssh2_channel_open_session(sshSession_);
        if (!ch) return false;

        if (libssh2_channel_exec(ch, cmd.c_str()) != 0) {
            libssh2_channel_free(ch);
            return false;
        }

        char buf[1024];
        while (true) {
            ssize_t n = libssh2_channel_read(ch, buf, sizeof(buf));
            if (n > 0) {
                outOutput.append(buf, n);
            } else {
                break;
            }
        }

        libssh2_channel_close(ch);
        int exitCode = libssh2_channel_get_exit_status(ch);
        libssh2_channel_free(ch);
        return (exitCode == 0);
    }

    // SFTP Remove Directory (Recursive)
    void removeDirectory(const std::string& path, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        // Try fast SSH exec command first
        std::string output;
        std::string cmd = "rm -rf -- '" + escapeShell(path) + "'";
        if (executeCommand(cmd, output)) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-rmdir-res"},
                {"id", id},
                {"success", true},
                {"path", path}
            }.dump());
            return;
        }

        // Fallback: SFTP rmdir
        int rc = libssh2_sftp_rmdir(sftpSession_, path.c_str());
        nlohmann::json res = {
            {"type", "sftp-rmdir-res"},
            {"id", id},
            {"success", (rc == 0)},
            {"path", path}
        };
        if (rc != 0) res["error"] = "Failed to remove directory";
        sendMsg_(res.dump());
    }

    // SFTP Rename / Move with multi-tier fallback
    void renameItem(const std::string& oldPath, const std::string& newPath, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        // Strategy 1: Standard SFTP rename
        int rc = libssh2_sftp_rename(sftpSession_, oldPath.c_str(), newPath.c_str());
        if (rc == 0) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-rename-res"},
                {"id", id},
                {"success", true},
                {"oldPath", oldPath},
                {"newPath", newPath}
            }.dump());
            return;
        }

        // Strategy 3: Native SSH shell mv fallback
        std::string output;
        std::string cmd = "mv -f -- '" + escapeShell(oldPath) + "' '" + escapeShell(newPath) + "'";
        if (executeCommand(cmd, output)) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-rename-res"},
                {"id", id},
                {"success", true},
                {"oldPath", oldPath},
                {"newPath", newPath}
            }.dump());
            return;
        }

        sendMsg_(nlohmann::json{
            {"type", "sftp-rename-res"},
            {"id", id},
            {"success", false},
            {"oldPath", oldPath},
            {"newPath", newPath},
            {"error", "Rename operation failed on server"}
        }.dump());
    }

    // SFTP Chmod
    void chmodItem(const std::string& path, const std::string& modeStr, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        unsigned long mode = 0755;
        try {
            mode = std::stoul(modeStr, nullptr, 8);
        } catch (...) {}

        LIBSSH2_SFTP_ATTRIBUTES attrs;
        memset(&attrs, 0, sizeof(attrs));
        attrs.flags = LIBSSH2_SFTP_ATTR_PERMISSIONS;
        attrs.permissions = mode;

        int rc = libssh2_sftp_setstat(sftpSession_, path.c_str(), &attrs);
        nlohmann::json res = {
            {"type", "sftp-chmod-res"},
            {"id", id},
            {"success", (rc == 0)},
            {"path", path},
            {"mode", modeStr}
        };
        if (rc != 0) res["error"] = "Chmod failed";
        sendMsg_(res.dump());
    }

    // SFTP Stat
    void statItem(const std::string& path, const std::string& id) {
        if (!sftpSession_) return;
        std::lock_guard<std::mutex> lock(sftpMutex_);

        LIBSSH2_SFTP_ATTRIBUTES attrs;
        int rc = libssh2_sftp_stat(sftpSession_, path.c_str(), &attrs);
        if (rc != 0) {
            sendMsg_(nlohmann::json{
                {"type", "sftp-stat-res"},
                {"id", id},
                {"success", false},
                {"path", path},
                {"error", "Stat failed"}
            }.dump());
            return;
        }

        bool isDir = (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) && ((attrs.permissions & 0170000) == 0040000);
        char permOctal[16] = "755";
        if (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) {
            snprintf(permOctal, sizeof(permOctal), "%03o", (unsigned int)(attrs.permissions & 0777));
        }

        sendMsg_(nlohmann::json{
            {"type", "sftp-stat-res"},
            {"id", id},
            {"success", true},
            {"path", path},
            {"stats", {
                {"size", (attrs.flags & LIBSSH2_SFTP_ATTR_SIZE) ? attrs.filesize : 0},
                {"mode", (attrs.flags & LIBSSH2_SFTP_ATTR_PERMISSIONS) ? attrs.permissions : 0},
                {"mtime", (attrs.flags & LIBSSH2_SFTP_ATTR_ACMODTIME) ? attrs.mtime : 0},
                {"isDirectory", isDir},
                {"permissions", std::string(permOctal)}
            }}
        }.dump());
    }

    // SFTP Server-side Copy via SSH exec
    void copyItems(const std::string& srcPath, const std::string& destPath, const std::string& id) {
        std::lock_guard<std::mutex> lock(sftpMutex_);
        std::string output;
        std::string cmd = "cp -r -- '" + escapeShell(srcPath) + "' '" + escapeShell(destPath) + "'";
        bool ok = executeCommand(cmd, output);
        nlohmann::json res = {
            {"type", "sftp-copy-res"},
            {"id", id},
            {"success", ok},
            {"count", ok ? 1 : 0}
        };
        if (!ok) res["error"] = "Copy operation failed";
        sendMsg_(res.dump());
    }

    // SFTP Server-side Move via SSH exec
    void moveItems(const std::string& srcPath, const std::string& destPath, const std::string& id) {
        std::lock_guard<std::mutex> lock(sftpMutex_);
        std::string output;
        std::string cmd = "mv -f -- '" + escapeShell(srcPath) + "' '" + escapeShell(destPath) + "'";
        bool ok = executeCommand(cmd, output);
        nlohmann::json res = {
            {"type", "sftp-move-res"},
            {"id", id},
            {"success", ok},
            {"count", ok ? 1 : 0}
        };
        if (!ok) res["error"] = "Move operation failed";
        sendMsg_(res.dump());
    }

private:
    void cleanup() {
        readerActive_ = false;
        if (readerThread_.joinable()) {
            readerThread_.join();
        }

        {
            std::lock_guard<std::mutex> lock(handlesMutex_);
            for (auto& pair : uploadHandles_) {
                if (pair.second) {
                    libssh2_sftp_close(pair.second);
                }
            }
            uploadHandles_.clear();
            uploadOffsets_.clear();
            uploadPaths_.clear();
        }

        if (sftpSession_) {
            libssh2_sftp_shutdown(sftpSession_);
            sftpSession_ = nullptr;
        }

        if (sshChannel_) {
            libssh2_channel_close(sshChannel_);
            libssh2_channel_free(sshChannel_);
            sshChannel_ = nullptr;
        }

        if (sshSession_) {
            libssh2_session_disconnect(sshSession_, "Normal Shutdown");
            libssh2_session_free(sshSession_);
            sshSession_ = nullptr;
        }

        if (sock_ != INVALID_SOCKET) {
            CLOSE_SOCKET(sock_);
            sock_ = INVALID_SOCKET;
        }

        isConnected_ = false;
    }

    std::string generateSessionId() {
        static std::random_device rd;
        static std::mt19937 gen(rd());
        static std::uniform_int_distribution<> dis(0, 15);
        const char* hex = "0123456789abcdef";
        std::string s;
        for (int i = 0; i < 32; ++i) {
            s += hex[dis(gen)];
        }
        return s;
    }

    std::string escapeShell(const std::string& str) {
        std::string res = str;
        size_t pos = 0;
        while ((pos = res.find("'", pos)) != std::string::npos) {
            res.replace(pos, 1, "'\\''");
            pos += 4;
        }
        return res;
    }

    unsigned long connId_;
    MessageSender sendMsg_;
    socket_t sock_;
    LIBSSH2_SESSION* sshSession_;
    LIBSSH2_CHANNEL* sshChannel_;
    LIBSSH2_SFTP* sftpSession_;
    std::string sessionId_;
    std::atomic<bool> isConnected_;
    std::atomic<bool> readerActive_;
    std::thread readerThread_;

    std::mutex sftpMutex_;
    std::mutex handlesMutex_;
    std::map<std::string, LIBSSH2_SFTP_HANDLE*> uploadHandles_;
    std::map<std::string, int64_t> uploadOffsets_;
    std::map<std::string, std::string> uploadPaths_;
};

} // namespace bridge

#endif // CPP_BRIDGE_SESSION_HPP

