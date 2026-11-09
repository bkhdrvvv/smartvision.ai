@echo off
rem SMARTVISION Edge AI agent launcher (Windows)
rem Usage: start.bat            (uses edge\token.txt and cameras from the dashboard)
rem        start.bat --source "Cam 01=samples\vtest.avi"
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Creating Python environment...
  py -m venv .venv || python -m venv .venv
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)
".venv\Scripts\python.exe" agent.py %*
pause
