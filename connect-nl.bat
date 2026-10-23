@echo off
title LiveKadeh NL SSH Tunnel
cls

echo ========================================================
echo   LiveKadeh SSH over WebSocket (Port 443 Bypass)
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "websocat.exe" (
    echo [i] websocat.exe not found. Downloading...
    curl -fSL "https://github.com/vi/websocat/releases/download/v1.14.1/websocat.x86_64-pc-windows-gnu.exe" -o websocat.exe
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1122" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Establishing secure WebSocket tunnel (port 443) to NL server...
start /B "" "websocat.exe" -b tcp-listen:127.0.0.1:1122 wss://nl.livekadeh.com/ssh-proxy

timeout /t 2 /nobreak >nul

echo [OK] Tunnel established on 127.0.0.1:1122
echo [*] Connecting SSH...
echo --------------------------------------------------------

ssh -o StrictHostKeyChecking=no -p 1122 root@127.0.0.1

echo.
echo [*] Closing tunnel...
taskkill /F /IM websocat.exe >nul 2>&1
echo [OK] Closed.
