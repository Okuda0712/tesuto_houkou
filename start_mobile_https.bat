@echo off
cd /d "%~dp0"
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo Cloudflare cloudflared is not installed.
  echo Install with: winget install --id Cloudflare.cloudflared -e
  echo Then reopen this file.
  echo Alternatively use start_mobile_wifi.bat for simple browser viewing.
  pause
  exit /b 1
)
echo Start the local server in a separate window...
start "Kamakura local server" cmd /k "cd /d ""%~dp0"" && (py server.py || python server.py)"
echo.
echo Wait for the temporary https://...trycloudflare.com URL.
echo Open that URL in Safari or Chrome on your phone.
echo Keep both command windows open during testing.
echo This is a PUBLIC temporary URL. Do not put secrets in this folder.
echo.
cloudflared tunnel --url http://127.0.0.1:8039
pause
