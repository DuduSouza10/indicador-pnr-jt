@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo =============================================
echo   Indicador de PNR - J&T Express
echo =============================================
echo.
where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.12 ou superior.
  pause
  exit /b 1
)
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Falha ao instalar dependencias.
  pause
  exit /b 1
)
start "" http://127.0.0.1:5000
python app.py
pause
