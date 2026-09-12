#ifndef CPP_BRIDGE_SERVER_HPP
#define CPP_BRIDGE_SERVER_HPP

#include <string>
#include <vector>
#include <map>
#include <queue>
#include <memory>
#include <thread>
#include <atomic>
#include <mutex>
#include <iostream>
#include <filesystem>
#include <chrono>

#include "mongoose.h"
#include "nlohmann/json.hpp"
#include "cpp_bridge_session.hpp"

namespace fs = std::filesystem;

namespace bridge {

class CppBridgeServer {
public:
    CppBridgeServer(int port = 3000, const std::string& assetsPath = "")
        : port_(port),
          assetsPath_(assetsPath),
          running_(false),
          serverThread_() {
#ifdef _WIN32
        WSADATA wsaData;
        WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
        libssh2_init(0);
    }

    ~CppBridgeServer() {
        stop();
        libssh2_exit();
#ifdef _WIN32
        WSACleanup();
#endif
    }

    bool start() {
        if (running_) return true;

        mg_mgr_init(&mgr_);
        mgr_.userdata = this;

        std::string listenUrl = "http://127.0.0.1:" + std::to_string(port_);
        struct mg_connection* c = mg_http_listen(&mgr_, listenUrl.c_str(), onMongooseEvent, this);
        if (!c) {
            std::cerr << "[CppBridgeServer] Failed to listen on " << listenUrl << "\n";
            mg_mgr_free(&mgr_);
            return false;
        }

        std::cout << "[CppBridgeServer] Embedded C++ Bridge listening on " << listenUrl << "\n";
        running_ = true;

        serverThread_ = std::thread([this]() {
            while (running_) {
                mg_mgr_poll(&mgr_, 5);
                flushOutboundQueues();
            }
            mg_mgr_free(&mgr_);
        });

        return true;
    }

    void stop() {
        if (!running_) return;
        running_ = false;

        if (serverThread_.joinable()) {
            serverThread_.join();
        }

        {
            std::lock_guard<std::mutex> lock(sessionsMutex_);
            sessions_.clear();
        }

        {
            std::lock_guard<std::mutex> lock(queueMutex_);
            outboundQueues_.clear();
        }
        std::cout << "[CppBridgeServer] Embedded Bridge stopped.\n";
    }

    int getPort() const { return port_; }
    void setAssetsPath(const std::string& p) { assetsPath_ = p; }
    const std::string& getAssetsPath() const { return assetsPath_; }

    void enqueueMessage(unsigned long connId, const std::string& message) {
        std::lock_guard<std::mutex> lock(queueMutex_);
        outboundQueues_[connId].push(message);
    }

private:
    static void onMongooseEvent(struct mg_connection* c, int ev, void* ev_data) {
        CppBridgeServer* self = static_cast<CppBridgeServer*>(c->mgr->userdata);
        if (!self) return;

        if (ev == MG_EV_HTTP_MSG) {
            struct mg_http_message* hm = static_cast<struct mg_http_message*>(ev_data);
            self->handleHttpRequest(c, hm);
        } else if (ev == MG_EV_WS_MSG) {
            struct mg_ws_message* wm = static_cast<struct mg_ws_message*>(ev_data);
            self->handleWsMessage(c, wm);
        } else if (ev == MG_EV_CLOSE) {
            self->handleConnectionClose(c->id);
        }
    }

    void handleHttpRequest(struct mg_connection* c, struct mg_http_message* hm) {
        // Upgrade WebSocket connection
        if (mg_match(hm->uri, mg_str("/ws"), nullptr)) {
            mg_ws_upgrade(c, hm, nullptr);
            createSession(c->id);
            return;
        }

        // Health check endpoint
        if (mg_match(hm->uri, mg_str("/health"), nullptr) || mg_match(hm->uri, mg_str("/api/health"), nullptr)) {
            std::string reply = "{\"status\":\"online\",\"service\":\"LiveKadeh Embedded C++ Bridge Server\",\"version\":\"1.5.1\"}\n";
            mg_http_reply(c, 200, "Content-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n", "%s", reply.c_str());
            return;
        }

        // Base directory for assets
        struct mg_http_serve_opts opts = { 0 };
        opts.root_dir = assetsPath_.c_str();
        opts.extra_headers = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Range, Content-Type\r\n";

        // Serve default root to app.html
        if (mg_match(hm->uri, mg_str("/"), nullptr) || mg_match(hm->uri, mg_str("/index.html"), nullptr)) {
            std::string appHtml = assetsPath_ + "/app.html";
            mg_http_serve_file(c, hm, appHtml.c_str(), &opts);
            return;
        }

        // Rewrite /app/ or /static/ URL prefixes
        if (hm->uri.len >= 5 && memcmp(hm->uri.buf, "/app/", 5) == 0) {
            hm->uri.buf += 4;
            hm->uri.len -= 4;
        } else if (hm->uri.len >= 8 && memcmp(hm->uri.buf, "/static/", 8) == 0) {
            hm->uri.buf += 7;
            hm->uri.len -= 7;
        }

        mg_http_serve_dir(c, hm, &opts);
    }

    void handleWsMessage(struct mg_connection* c, struct mg_ws_message* wm) {
        std::string raw(wm->data.buf, wm->data.len);
        nlohmann::json msg;
        try {
            msg = nlohmann::json::parse(raw);
        } catch (...) {
            return;
        }

        std::string type = msg.value("type", "");
        if (type.empty()) return;

        // Ping / Pong
        if (type == "ping") {
            enqueueMessage(c->id, nlohmann::json{
                {"type", "pong"},
                {"timestamp", std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count()}
            }.dump());
            return;
        }

        std::shared_ptr<BridgeSession> session = getSession(c->id);
        if (!session) {
            session = createSession(c->id);
        }

        // SSH Terminal actions
        if (type == "ssh-init") {
            std::string host = msg.value("host", "");
            int port = 22;
            if (msg.contains("port")) {
                if (msg["port"].is_number()) port = msg["port"].get<int>();
                else if (msg["port"].is_string()) { try { port = std::stoi(msg["port"].get<std::string>()); } catch (...) { port = 22; } }
            }
            std::string username = msg.value("username", "");
            std::string password = msg.value("password", "");
            std::string privateKey = msg.value("privateKey", "");
            std::string passphrase = msg.value("passphrase", "");
            std::string term = msg.value("term", "xterm-256color");
            int cols = 80;
            if (msg.contains("cols")) {
                if (msg["cols"].is_number()) cols = msg["cols"].get<int>();
                else if (msg["cols"].is_string()) { try { cols = std::stoi(msg["cols"].get<std::string>()); } catch (...) { cols = 80; } }
            }
            int rows = 24;
            if (msg.contains("rows")) {
                if (msg["rows"].is_number()) rows = msg["rows"].get<int>();
                else if (msg["rows"].is_string()) { try { rows = std::stoi(msg["rows"].get<std::string>()); } catch (...) { rows = 24; } }
            }

            std::thread([session, host, port, username, password, privateKey, passphrase, term, cols, rows]() {
                try {
                    session->initSsh(host, port, username, password, privateKey, passphrase, term, cols, rows);
                } catch (const std::exception& e) {
                    std::cerr << "initSsh error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "ssh-input") {
            std::string data = msg.value("data", "");
            session->writeSshInput(data);
            return;
        }

        if (type == "ssh-resize") {
            int cols = 80;
            if (msg.contains("cols")) {
                if (msg["cols"].is_number()) cols = msg["cols"].get<int>();
                else if (msg["cols"].is_string()) { try { cols = std::stoi(msg["cols"].get<std::string>()); } catch (...) { cols = 80; } }
            }
            int rows = 24;
            if (msg.contains("rows")) {
                if (msg["rows"].is_number()) rows = msg["rows"].get<int>();
                else if (msg["rows"].is_string()) { try { rows = std::stoi(msg["rows"].get<std::string>()); } catch (...) { rows = 24; } }
            }
            session->resizeSsh(cols, rows);
            return;
        }

        if (type == "ssh-close") {
            session->closeSsh();
            return;
        }

        // SFTP actions
        if (type == "sftp-init") {
            std::string host = msg.value("host", "");
            int port = 22;
            if (msg.contains("port")) {
                if (msg["port"].is_number()) port = msg["port"].get<int>();
                else if (msg["port"].is_string()) { try { port = std::stoi(msg["port"].get<std::string>()); } catch (...) { port = 22; } }
            }
            std::string username = msg.value("username", "");
            std::string password = msg.value("password", "");
            std::string privateKey = msg.value("privateKey", "");
            std::string passphrase = msg.value("passphrase", "");

            std::thread([session, host, port, username, password, privateKey, passphrase]() {
                try {
                    session->initSftp(host, port, username, password, privateKey, passphrase);
                } catch (const std::exception& e) {
                    std::cerr << "initSftp error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-list") {
            std::string path = msg.value("path", ".");
            std::string id = msg.value("id", "");
            std::thread([session, path, id]() {
                try {
                    session->listDirectory(path, id);
                } catch (const std::exception& e) {
                    std::cerr << "listDirectory error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-read") {
            std::string path = msg.value("path", "");
            std::string id = msg.value("id", "");
            size_t maxBytes = msg.value("maxBytes", (size_t)0);
            std::thread([session, path, id, maxBytes]() {
                try {
                    session->readFile(path, id, maxBytes);
                } catch (const std::exception& e) {
                    std::cerr << "readFile error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-write") {
            std::string path = msg.value("path", "");
            std::string content = msg.value("content", "");
            bool isBase64 = msg.value("isBase64", false);
            std::string id = msg.value("id", "");
            std::thread([session, path, content, isBase64, id]() {
                try {
                    session->writeFile(path, content, isBase64, id);
                } catch (const std::exception& e) {
                    std::cerr << "writeFile error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-chunk-init") {
            std::string path = msg.value("path", "");
            std::string id = msg.value("id", "");
            std::thread([session, path, id]() {
                try {
                    session->chunkInit(path, id);
                } catch (const std::exception& e) {
                    std::cerr << "chunkInit error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-chunk-write") {
            std::string uploadId = msg.value("uploadId", "");
            std::string chunk = msg.value("chunk", "");
            int64_t offset = msg.value("offset", (int64_t)-1);
            std::string id = msg.value("id", "");
            std::thread([session, uploadId, chunk, offset, id]() {
                try {
                    session->chunkWrite(uploadId, chunk, offset, id);
                } catch (const std::exception& e) {
                    std::cerr << "chunkWrite error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-chunk-end") {
            std::string uploadId = msg.value("uploadId", "");
            std::string id = msg.value("id", "");
            std::thread([session, uploadId, id]() {
                try {
                    session->chunkEnd(uploadId, id);
                } catch (const std::exception& e) {
                    std::cerr << "chunkEnd error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-mkdir") {
            std::string path = msg.value("path", "");
            std::string id = msg.value("id", "");
            std::thread([session, path, id]() {
                try {
                    session->makeDirectory(path, id);
                } catch (const std::exception& e) {
                    std::cerr << "makeDirectory error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-unlink") {
            std::string path = msg.value("path", "");
            std::string id = msg.value("id", "");
            std::thread([session, path, id]() {
                try {
                    session->unlinkFile(path, id);
                } catch (const std::exception& e) {
                    std::cerr << "unlinkFile error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-rmdir") {
            std::string path = msg.value("path", "");
            std::string id = msg.value("id", "");
            std::thread([session, path, id]() {
                try {
                    session->removeDirectory(path, id);
                } catch (const std::exception& e) {
                    std::cerr << "removeDirectory error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-rename") {
            std::string oldPath = msg.value("oldPath", "");
            std::string newPath = msg.value("newPath", "");
            std::string id = msg.value("id", "");
            std::thread([session, oldPath, newPath, id]() {
                try {
                    session->renameItem(oldPath, newPath, id);
                } catch (const std::exception& e) {
                    std::cerr << "renameItem error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-chmod") {
            std::string path = msg.value("path", "");
            std::string mode = msg.value("mode", "");
            std::string id = msg.value("id", "");
            std::thread([session, path, mode, id]() {
                try {
                    session->chmodItem(path, mode, id);
                } catch (const std::exception& e) {
                    std::cerr << "chmodItem error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-stat") {
            std::string path = msg.value("path", "");
            std::string id = msg.value("id", "");
            std::thread([session, path, id]() {
                try {
                    session->statItem(path, id);
                } catch (const std::exception& e) {
                    std::cerr << "statItem error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-copy") {
            std::string srcPath = msg.value("srcPath", "");
            std::string destPath = msg.value("destPath", "");
            std::string id = msg.value("id", "");
            std::thread([session, srcPath, destPath, id]() {
                try {
                    session->copyItems(srcPath, destPath, id);
                } catch (const std::exception& e) {
                    std::cerr << "copyItems error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }

        if (type == "sftp-move") {
            std::string srcPath = msg.value("srcPath", "");
            std::string destPath = msg.value("destPath", "");
            std::string id = msg.value("id", "");
            std::thread([session, srcPath, destPath, id]() {
                try {
                    session->moveItems(srcPath, destPath, id);
                } catch (const std::exception& e) {
                    std::cerr << "moveItems error: " << e.what() << std::endl;
                } catch (...) {}
            }).detach();
            return;
        }
    }

    void handleConnectionClose(unsigned long connId) {
        {
            std::lock_guard<std::mutex> lock(sessionsMutex_);
            sessions_.erase(connId);
        }
        {
            std::lock_guard<std::mutex> lock(queueMutex_);
            outboundQueues_.erase(connId);
        }
    }

    std::shared_ptr<BridgeSession> createSession(unsigned long connId) {
        std::lock_guard<std::mutex> lock(sessionsMutex_);
        auto session = std::make_shared<BridgeSession>(connId, [this, connId](const std::string& msg) {
            enqueueMessage(connId, msg);
        });
        sessions_[connId] = session;
        return session;
    }

    std::shared_ptr<BridgeSession> getSession(unsigned long connId) {
        std::lock_guard<std::mutex> lock(sessionsMutex_);
        auto it = sessions_.find(connId);
        if (it != sessions_.end()) {
            return it->second;
        }
        return nullptr;
    }

    void flushOutboundQueues() {
        std::lock_guard<std::mutex> lock(queueMutex_);
        for (auto it = outboundQueues_.begin(); it != outboundQueues_.end(); ) {
            unsigned long cid = it->first;
            struct mg_connection* target = nullptr;
            for (struct mg_connection* c = mgr_.conns; c != nullptr; c = c->next) {
                if (c->id == cid) {
                    target = c;
                    break;
                }
            }

            if (!target) {
                it = outboundQueues_.erase(it);
                continue;
            }

            auto& q = it->second;
            while (!q.empty()) {
                std::string msg = q.front();
                q.pop();
                mg_ws_send(target, msg.data(), msg.length(), WEBSOCKET_OP_TEXT);
            }
            ++it;
        }
    }

    int port_;
    std::string assetsPath_;
    std::atomic<bool> running_;
    std::thread serverThread_;
    struct mg_mgr mgr_;

    std::mutex sessionsMutex_;
    std::map<unsigned long, std::shared_ptr<BridgeSession>> sessions_;

    std::mutex queueMutex_;
    std::map<unsigned long, std::queue<std::string>> outboundQueues_;
};

} // namespace bridge

#endif // CPP_BRIDGE_SERVER_HPP
