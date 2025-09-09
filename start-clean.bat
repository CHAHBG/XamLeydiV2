@echo off
echo Starting ParcelApp with clean Metro cache...
echo.

REM Navigate to the project directory
cd %~dp0

REM Clear the Metro cache
rmdir /s /q "%TEMP%\metro-cache" 2>nul
rmdir /s /q "%TEMP%\metro-bundler-cache" 2>nul
rmdir /s /q "%APPDATA%\Temp\metro-cache" 2>nul
rmdir /s /q "%APPDATA%\Temp\metro-bundler-cache" 2>nul
rmdir /s /q "node_modules\.cache" 2>nul

REM Clear watchman cache if it exists
watchman watch-del-all 2>nul

REM Start the app with Expo
echo Starting app with Expo...
set REACT_NATIVE_MAX_WORKERS=4
call npx expo start --clear

REM If there's an error, wait before closing
if %ERRORLEVEL% neq 0 (
    echo.
    echo Failed to start Metro bundler!
    pause
)

exit /b %ERRORLEVEL%
