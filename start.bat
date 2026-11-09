@echo off
rem SMARTVISION AI - start everything: database -> site (http://localhost:3000) -> Edge AI agent (if edge\token.txt exists)
cd /d "%~dp0"
set "PATH=%~dp0.tools\node;%PATH%"
start "SmartVision DB" cmd /k node scripts\db.mjs
echo Waiting for PostgreSQL...
timeout /t 6 /nobreak >nul
if not exist ".next\BUILD_ID" (
  echo First run: building the site, this takes several minutes...
  call npx next build || goto :eof
)
start "SmartVision Site" cmd /k npx next start -p 3000
if exist "edge\token.txt" start "SmartVision AI agent" cmd /k "cd /d edge && .venv\Scripts\python.exe -u agent.py"
timeout /t 8 /nobreak >nul
start "" http://localhost:3000