@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo ⚡ LiveKadeh SSH & SFTP Native C++ Windows Builder
echo ==================================================

cd /d "%~dp0"

echo [1/3] Configuring CMake project...
if not exist build mkdir build
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 (
    echo.
    echo ❌ CMake configuration failed. Please ensure CMake and Visual Studio C++ build tools are installed.
    pause
    exit /b 1
)

echo.
echo [2/3] Compiling native executable...
cmake --build build --config Release
if errorlevel 1 (
    echo.
    echo ❌ Compilation failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Build complete!
echo ==================================================
if exist "build\Release\LiveKadeh-SSH-SFTP.exe" (
    echo ✔ Executable: build\Release\LiveKadeh-SSH-SFTP.exe
    for %%I in ("build\Release\LiveKadeh-SSH-SFTP.exe") do (
        echo 📊 Final size: %%~zI bytes (~!echo %%~zI / 1048576! MB)
    )
) else if exist "build\LiveKadeh-SSH-SFTP.exe" (
    echo ✔ Executable: build\LiveKadeh-SSH-SFTP.exe
)
echo ==================================================
echo Ready to run. Double-click LiveKadeh-SSH-SFTP.exe to launch.
pause

