@echo off
echo Checking if Git is installed...

git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Git is installed!
    git --version
    echo.
    echo You can now use the uvx version of zen-mcp-server.
) else (
    echo ❌ Git is NOT installed.
    echo.
    echo To install Git:
    echo 1. Go to https://git-scm.com/download/win
    echo 2. Download and run the installer
    echo 3. Use default settings during installation
    echo 4. Restart Command Prompt and Claude Desktop
    echo.
    echo Alternative: Try the NPX version (already updated in your config)
)

echo.
pause
