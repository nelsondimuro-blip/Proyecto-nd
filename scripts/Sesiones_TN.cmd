@echo off
setlocal
chcp 65001 >nul
title Mis conversaciones de Claude - Grupo TN

rem ===========================================================
rem  Doble clic aca para ver TODAS tus conversaciones guardadas
rem  y abrir la carpeta en la que venias trabajando.
rem
rem  IMPORTANTE: este archivo y "sesiones_tn.ps1" tienen que
rem  estar SIEMPRE en la misma carpeta.
rem ===========================================================

set "SCRIPT=%~dp0sesiones_tn.ps1"

if not exist "%SCRIPT%" (
  echo.
  echo   [ERROR] Falta el archivo sesiones_tn.ps1
  echo.
  echo   Tiene que estar en esta misma carpeta:
  echo     %~dp0
  echo.
  echo   Copia los dos archivos juntos y volve a probar.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "CODIGO=%ERRORLEVEL%"

if not "%CODIGO%"=="0" (
  echo.
  echo   Termino con codigo %CODIGO%.
  echo.
  pause
)

exit /b %CODIGO%
