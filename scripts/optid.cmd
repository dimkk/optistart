@echo off
setlocal
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

where bun >nul 2>nul
if errorlevel 1 (
  echo optid error: missing required command: bun 1>&2
  exit /b 1
)

bun "%ROOT_DIR%\scripts\optid-runner.mjs" --root "%ROOT_DIR%" %*
exit /b %errorlevel%
