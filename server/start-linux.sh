#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================================"
echo " ⚡ LiveKadeh SSH & SFTP Pro - Local Bridge Server"
echo "================================================================"
echo ""

if [ -f "./livekadeh-bridge-linux-x64" ]; then
    echo "[*] Running standalone Linux executable..."
    chmod +x ./livekadeh-bridge-linux-x64
    ./livekadeh-bridge-linux-x64
else
    echo "[*] Checking Node.js..."
    if ! command -v node &> /dev/null; then
        echo "[!] Node.js not found. Please install Node.js."
        exit 1
    fi
    node server.js
fi
