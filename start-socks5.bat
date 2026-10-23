@echo off
title LiveKadeh SOCKS5 Proxy over SSH (Port 1080)
cls

echo ========================================================
echo   LiveKadeh SOCKS5 Proxy (Port 1080 ^<--^> 443 WS Bypass)
echo ========================================================
echo.

cd /d "%~dp0"

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1122" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1080" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Starting WebSocket tunnel (port 443) to NL server...
start /B "" "websocat.exe" -b tcp-listen:127.0.0.1:1122 wss://nl.livekadeh.com/ssh-proxy

timeout /t 2 /nobreak >nul

echo [OK] Tunnel active on 127.0.0.1:1122
echo [*] Launching SOCKS5 Proxy on 127.0.0.1:1080 ...
echo ========================================================
echo [OK] SOCKS5 PROXY IS RUNNING:
echo     Host: 127.0.0.1
echo     Port: 1080
echo.
echo Set this in SwitchyOmega / Chrome Proxy extension:
echo     Protocol: SOCKS5
echo     Server:   127.0.0.1
echo     Port:     1080
echo ========================================================
echo Enter SSH password when prompted below:
echo.

ssh -o StrictHostKeyChecking=no -N -D 127.0.0.1:1080 -p 1122 root@127.0.0.1

taskkill /F /IM websocat.exe >nul 2>&1
