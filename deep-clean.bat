@echo off
echo Deep cleaning project...
echo.

REM Remove all generated folders and files
echo Removing node_modules...
rmdir /s /q node_modules
echo Removing package-lock.json...
del /f /q package-lock.json
echo Cleaning yarn cache...
rmdir /s /q "%LOCALAPPDATA%\Yarn\Cache" 2>nul
echo Cleaning npm cache...
call npm cache clean --force
echo Cleaning metro cache...
rmdir /s /q "%TEMP%\metro-cache" 2>nul
rmdir /s /q "%TEMP%\metro-bundler-cache" 2>nul
rmdir /s /q "%APPDATA%\Temp\metro-cache" 2>nul
rmdir /s /q "%APPDATA%\Temp\metro-bundler-cache" 2>nul
rmdir /s /q "node_modules\.cache" 2>nul

echo.
echo Reinstalling dependencies...
call npm install --legacy-peer-deps
call npx expo install

echo.
echo Deep clean complete!
echo You can now run start-clean.bat to start the app.
pause
