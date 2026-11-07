@echo off
cd /d "%~dp0"
echo Kamakura Site v39 - Full Offline Pack
echo Open http://127.0.0.1:8039/ in your browser.
echo First full-city offline pack download requires Internet access.
echo.
py -m http.server 8039
if errorlevel 1 python -m http.server 8039
pause
