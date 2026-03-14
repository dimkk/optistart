@echo off
setlocal
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

where node >nul 2>nul
if errorlevel 1 (
  echo optid error: missing required command: node 1>&2
  exit /b 1
)

node "%ROOT_DIR%\scripts\optid-runner.mjs" --root "%ROOT_DIR%" %*
exit /b %errorlevel%
