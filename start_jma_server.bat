@echo off
cd /d "%~dp0"
echo Installing dependencies (first run needs internet)...
py -m pip install -r requirements.txt
if errorlevel 1 (
  echo Installation failed. Install Python 3 and try again.
  pause
  exit /b 1
)
echo Starting JMA monitoring and Push server on http://127.0.0.1:8039/
py server.py
pause
