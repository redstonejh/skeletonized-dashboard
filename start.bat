@echo off
cd /d "%~dp0"
echo Starting Configurable Dashboard Builder...
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
