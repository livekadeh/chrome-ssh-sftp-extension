@echo off
title LiveKadeh All-in-One Tunnel (SSH 1122 + SOCKS5 1080)
cls

echo ========================================================
echo   LiveKadeh All-in-One Tunnel (Port 443 WS Bypass)
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Download websocat if missing
if not exist "websocat.exe" (
    echo [i] websocat.exe not found. Downloading...
    curl -fSL "https://github.com/vi/websocat/releases/download/v1.14.1/websocat.x86_64-pc-windows-gnu.exe" -o websocat.exe
)

:: 2. Cleanup previous processes on ports 1122 and 1080
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1122" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1080" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. Launch WebSocket tunnel (WS 443 -> Server SSH 1122)
echo [*] Starting WebSocket tunnel (port 443) to NL server...
start /B "" "websocat.exe" -b tcp-listen:127.0.0.1:1122 wss://nl.livekadeh.com/ssh-proxy

timeout /t 2 /nobreak >nul

echo [OK] SSH Tunnel listener ready on 127.0.0.1:1122
echo [*] Starting SOCKS5 Dynamic Proxy on 127.0.0.1:1080 ...
echo.
echo ========================================================
echo [OK] BOTH SERVICES ARE READY:
echo.
echo   1. SSH Access (PuTTY / WinSCP / FileZilla / VS Code):
echo      Host: 127.0.0.1    Port: 1122
echo.
echo   2. SOCKS5 Proxy (Chrome / SwitchyOmega / Telegram):
echo      Host: 127.0.0.1    Port: 1080
echo ========================================================
echo Enter SSH password when prompted below to activate SOCKS5:
echo.

:: 4. Run SSH with Dynamic SOCKS5 forwarding on 1080
ssh -o StrictHostKeyChecking=no -N -D 127.0.0.1:1080 -p 1122 root@127.0.0.1

:: 5. Cleanup on exit
taskkill /F /IM websocat.exe >nul 2>&1
