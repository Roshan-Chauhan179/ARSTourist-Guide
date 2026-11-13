@echo off
setlocal
title ARS Tourist Guide
cd /d "%~dp0"
echo Starting ARS Tourist Guide...
where node >nul 2>&1 || (
  echo Node.js was not found. Install Node.js, then run this file again.
  pause
  exit /b 1
)

REM Reload the server so edits to .env (including the OpenAI key) take effect.
REM Port 3010 is reserved for this project by this launcher.
powershell -NoProfile -Command "$listener = Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue; if ($listener) { $listener | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force } }; Start-Process -FilePath cmd.exe -ArgumentList '/c', 'set PORT=3010&&node server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
ping 127.0.0.1 -n 3 >nul
start "" "http://localhost:3010"
echo ARS Tourist Guide is running at http://localhost:3010
echo You can close this window; the website will keep running.
ping 127.0.0.1 -n 6 >nul
endlocal
