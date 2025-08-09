@echo off
echo Finding Git installation path...

where git >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Git found in PATH:
    where git
    echo.
    
    REM Get the directory containing git.exe
    for /f "tokens=*" %%i in ('where git') do (
        set "GIT_PATH=%%i"
        goto :found
    )
    
    :found
    for %%F in ("%GIT_PATH%") do set "GIT_DIR=%%~dpF"
    echo Git directory: %GIT_DIR%
    
    echo.
    echo Your MCP config should include this PATH:
    echo "%GIT_DIR%;C:/Program Files/Git/bin;C:/Program Files/Git/cmd"
    
) else (
    echo ❌ Git not found in PATH.
    echo.
    echo Common Git installation locations:
    echo - C:\Program Files\Git\bin\git.exe
    echo - C:\Program Files (x86)\Git\bin\git.exe
    echo - %USERPROFILE%\AppData\Local\Programs\Git\bin\git.exe
    echo.
    echo Checking common locations...
    
    if exist "C:\Program Files\Git\bin\git.exe" (
        echo ✅ Found at: C:\Program Files\Git\bin\git.exe
        echo Add this to PATH: "C:/Program Files/Git/bin;C:/Program Files/Git/cmd"
    ) else if exist "C:\Program Files (x86)\Git\bin\git.exe" (
        echo ✅ Found at: C:\Program Files (x86)\Git\bin\git.exe
        echo Add this to PATH: "C:/Program Files (x86)/Git/bin;C:/Program Files (x86)/Git/cmd"
    ) else (
        echo ❌ Git not found in common locations.
        echo Please reinstall Git from: https://git-scm.com/download/win
    )
)

echo.
pause
