@echo off
REM Wrapper to run the PowerShell test script using Windows PowerShell
REM Usage: double-click or run from cmd / PowerShell: tools\run_test_supabase_insert.bat
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%test_supabase_insert.ps1"
endlocal
