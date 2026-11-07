@echo off
cd /d "%~dp0"
echo =========================================
echo  Kamakura Site v39 - Smartphone Wi-Fi Test
echo =========================================
echo Connect PC and phone to the SAME Wi-Fi.
echo Find the PC IPv4 address below (e.g. 192.168.1.10).
echo Open http://YOUR-PC-IP:8039/ on the phone.
echo.
ipconfig | findstr /i "IPv4"
echo.
echo Windows Firewall may ask for permission. Allow Private networks.
echo NOTE: HTTP over LAN may block GPS, PWA installation and offline caching.
echo For full PWA testing, use start_mobile_https.bat instead.
echo.
py -m http.server 8039 --bind 0.0.0.0
if errorlevel 1 python -m http.server 8039 --bind 0.0.0.0
pause
