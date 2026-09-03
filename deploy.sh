#!/usr/bin/env bash
set -e

echo "=================================================="
echo "⚡ LiveKadeh Chrome SSH & SFTP Bridge Deployment"
echo "=================================================="

# Navigate to server directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/server"

echo "📦 Installing Node.js dependencies..."
npm install --production

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️ PM2 not found, installing PM2 globally..."
    npm install -g pm2
fi

echo "🚀 Starting / Reloading Bridge Server with PM2..."
pm2 start ecosystem.config.js || pm2 reload ecosystem.config.js
pm2 save

echo ""
echo "✔ Bridge Server deployed and active on port 3000!"
echo "📡 Health check: http://localhost:3000/health"
echo "⚡ WebSocket URL: ws://localhost:3000/ws"
echo "=================================================="
