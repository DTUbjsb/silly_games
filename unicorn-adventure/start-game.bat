@echo off
setlocal
cd /d "%~dp0"

echo Unicorn Adventure will be available at http://127.0.0.1:8781/
echo Keep this window open while you play. Press Ctrl+C to stop the server.
echo.
py -m http.server 8781 --bind 127.0.0.1
