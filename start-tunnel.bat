@echo off
title LiveKadeh NL SSH Tunnel (Background Service)
cls

echo ========================================================
echo   LiveKadeh SSH Tunnel Listener (Port 1122 ^<--^> 443 WS)
echo ========================================================
echo.

cd /d "%~dp0"

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1122" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Starting persistent tunnel on 127.0.0.1:1122 ...
echo [*] Connected via: wss://nl.livekadeh.com/ssh-proxy (Port 443 HTTPS)
echo.
echo ========================================================
echo [OK] TUNNEL IS READY AND LISTENING!
echo.
echo You can now connect from ANY app:
echo   - PuTTY / MobaXterm: Host 127.0.0.1  Port 1122
echo   - FileZilla / WinSCP: Host 127.0.0.1  Port 1122
echo   - VS Code / Terminal: ssh root@127.0.0.1 -p 1122
echo.
echo Press Ctrl+C or close this window to stop the tunnel.
echo ========================================================
echo.

websocat.exe -b tcp-listen:127.0.0.1:1122 wss://YOURsERVERiP/ssh-proxy
