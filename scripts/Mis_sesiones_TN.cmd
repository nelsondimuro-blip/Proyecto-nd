@echo off
setlocal
chcp 65001 >nul
title Mis sesiones de trabajo - Grupo TN

rem ===========================================================
rem  Abre Claude Code en la carpeta del proyecto y muestra
rem  las sesiones guardadas para elegir una con las flechas.
rem
rem  Claude Code guarda las sesiones POR CARPETA. Si el .cmd
rem  no logra entrar a la carpeta correcta, --resume no muestra
rem  nada aunque las sesiones existan. Por eso aca se verifica
rem  todo antes de arrancar y la ventana no se cierra sola.
rem ===========================================================

rem --- 1) Buscar la carpeta del proyecto -----------------------
rem  Se prueban varias rutas porque el Escritorio puede estar en
rem  espanol y/o redirigido a OneDrive.
set "CARPETA="
for %%D in (
  "%USERPROFILE%\Desktop\TN TU OP"
  "%USERPROFILE%\Escritorio\TN TU OP"
  "%OneDrive%\Desktop\TN TU OP"
  "%OneDrive%\Escritorio\TN TU OP"
) do if not defined CARPETA if exist "%%~D\" set "CARPETA=%%~D"

if not defined CARPETA (
  echo.
  echo   [ERROR] No encontre la carpeta "TN TU OP".
  echo.
  echo   Busque en:
  echo     %USERPROFILE%\Desktop\TN TU OP
  echo     %USERPROFILE%\Escritorio\TN TU OP
  echo     %OneDrive%\Desktop\TN TU OP
  echo     %OneDrive%\Escritorio\TN TU OP
  echo.
  echo   Si la carpeta esta en otro lado, edita este archivo y
  echo   agrega la ruta correcta a la lista de arriba.
  echo.
  pause
  exit /b 1
)

rem --- 2) Buscar claude.exe ------------------------------------
set "CLAUDE=%USERPROFILE%\.local\bin\claude.exe"
if exist "%CLAUDE%" goto :tengo_claude

for /f "delims=" %%P in ('where claude 2^>nul') do (
  set "CLAUDE=%%P"
  goto :tengo_claude
)

echo.
echo   [ERROR] No encontre claude.exe.
echo.
echo   Busque en:
echo     %USERPROFILE%\.local\bin\claude.exe
echo     y en el PATH del sistema.
echo.
echo   Instalalo desde https://claude.com/claude-code y volve a probar.
echo.
pause
exit /b 1

:tengo_claude

rem --- 3) Entrar a la carpeta ----------------------------------
cd /d "%CARPETA%"
if errorlevel 1 (
  echo.
  echo   [ERROR] No pude entrar a "%CARPETA%".
  echo.
  pause
  exit /b 1
)

rem --- 4) Arrancar ---------------------------------------------
echo.
echo   ================================================
echo    TUS SESIONES DE TRABAJO - GRUPO TN
echo    Elegi una con las flechas y Enter.
echo   ================================================
echo.
echo   Carpeta: %CD%
echo.

"%CLAUDE%" --resume
set "CODIGO=%ERRORLEVEL%"

if not "%CODIGO%"=="0" (
  echo.
  echo   Claude termino con codigo %CODIGO%.
  echo.
  echo   Si el mensaje fue que no hay sesiones para retomar, es
  echo   porque todavia no guardaste ninguna EN ESTA CARPETA.
  echo   Abri una nueva con:   claude
  echo.
  pause
)

exit /b %CODIGO%
