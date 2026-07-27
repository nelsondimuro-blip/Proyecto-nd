@echo off
setlocal
chcp 65001 >nul
title Informe de la carpeta TN TU OP

rem ===========================================================
rem  Doble clic aca para generar un informe de la carpeta
rem  "TN TU OP": que archivos tiene, si es repo git, y cuantas
rem  conversaciones de Claude apuntan a ella.
rem
rem  Deja un archivo "Informe_TN_TU_OP.txt" en el Escritorio
rem  que se puede adjuntar en el chat.
rem
rem  IMPORTANTE: este archivo y "revisar_tn_tu_op.ps1" tienen
rem  que estar SIEMPRE en la misma carpeta.
rem ===========================================================

set "SCRIPT=%~dp0revisar_tn_tu_op.ps1"

if not exist "%SCRIPT%" (
  echo.
  echo   [ERROR] Falta el archivo revisar_tn_tu_op.ps1
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
