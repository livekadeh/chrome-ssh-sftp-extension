@echo off
title LiveKadeh SSH & SFTP Bridge Server
color 0b
echo ================================================================
echo  ⚡ LiveKadeh SSH & SFTP Pro - Local Bridge Server
echo ================================================================
echo.
echo [*] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js not found in PATH. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [*] Starting Local Bridge Server on port 3000...
echo [*] Health Check: http://localhost:3000/health
echo [*] WebSocket URL: ws://localhost:3000/ws
echo.
node server.js
pause
