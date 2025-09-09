@echo off
echo Starting ParcelApp...
echo.

REM Navigate to the project directory (change this path if needed)
cd %~dp0

REM Check if node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Node.js is not installed or not in PATH!
    echo Please install Node.js and try again.
    pause
    exit /b 1
)

REM Run the React Native start command directly
echo Starting Metro Bundler...
call node ./node_modules/react-native/cli.js start

REM If there's an error, wait before closing
if %ERRORLEVEL% neq 0 (
    echo.
    echo Failed to start the application!
    pause
)

exit /b %ERRORLEVEL%
