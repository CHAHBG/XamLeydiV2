@echo off
echo Updating dependencies...
echo.

REM Update expo dependencies
call npx expo install

echo.
echo Done! You can now start the app with start-clean.bat
pause
