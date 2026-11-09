@echo off
rem SMARTVISION AI - stop the agent and the site, then shut the database down cleanly
cd /d "%~dp0"
set "PATH=%~dp0.tools\node;%PATH%"
taskkill /fi "WINDOWTITLE eq SmartVision AI agent*" /t /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq SmartVision Site*" /t /f >nul 2>&1
node scripts\db.mjs stop
taskkill /fi "WINDOWTITLE eq SmartVision DB*" /t /f >nul 2>&1
echo Stopped.
