@echo off
cd /d "%~dp0"
echo Kamakura Site v14
echo Open http://127.0.0.1:8014/ in your browser.
echo Keep this window open.
echo.
py -m http.server 8014
if errorlevel 1 python -m http.server 8014
pause
