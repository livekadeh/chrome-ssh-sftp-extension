#!/usr/bin/env bash
set -e

echo "=================================================="
echo "⚡ LiveKadeh SSH & SFTP Native C++ Desktop Builder"
echo "=================================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Check dependencies
echo "🔍 Checking build prerequisites..."
MISSING_PKGS=()

if ! command -v g++ &> /dev/null; then
    MISSING_PKGS+=("g++")
fi

if ! command -v cmake &> /dev/null; then
    MISSING_PKGS+=("cmake")
fi

if ! command -v pkg-config &> /dev/null; then
    MISSING_PKGS+=("pkg-config")
fi

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo "⚠️ Missing build dependencies: ${MISSING_PKGS[*]}"
    echo "💡 Install them on Ubuntu/Debian via:"
    echo "   sudo apt-get update && sudo apt-get install -y ${MISSING_PKGS[*]} libgtk-3-dev libwebkit2gtk-4.1-dev"
fi

echo "🚀 Building native binary with CMake..."
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release -j$(nproc || echo 2)

echo ""
echo "✔ Native build finished successfully!"
if [ -f "livekadeh-ssh-sftp" ]; then
    strip livekadeh-ssh-sftp || true
    echo "📦 Output binary: $(pwd)/livekadeh-ssh-sftp"
    echo "📊 Binary size: $(du -h livekadeh-ssh-sftp | cut -f1)"
fi
echo "=================================================="

