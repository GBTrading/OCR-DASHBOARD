@echo off
echo Setting up Gemini API Key environment variable...

REM Set the environment variable for current session
set GEMINI_API_KEY=AIzaSyDwwiv_ZGUlMqLmz9N_90V-SBbUoVeRRPw

REM Set the environment variable permanently (requires admin privileges)
setx GEMINI_API_KEY "AIzaSyDwwiv_ZGUlMqLmz9N_90V-SBbUoVeRRPw"

echo.
echo Environment variable GEMINI_API_KEY has been set.
echo Please restart Claude Desktop for changes to take effect.
echo.
echo To verify the variable was set, run: echo %GEMINI_API_KEY%
echo.
pause
