@echo off
title LiveKadeh SSH & SFTP Bridge Server
color 0b
echo ================================================================
echo  ⚡ LiveKadeh SSH & SFTP Pro - Local Bridge Server (Zero Config)
echo ================================================================
echo.
echo [*] Starting Local Bridge Server on port 3000...
echo [*] WebSocket URL: ws://localhost:3000/ws
echo [*] Health Check: http://localhost:3000/health
echo.

if exist "%~dp0bin\node.exe" (
    "%~dp0bin\node.exe" "%~dp0server.js"
) else (
    where node >nul 2>nul
    if %errorlevel% neq 0 (
        echo [!] Node.js not found. Please install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
    node "%~dp0server.js"
)
pause
