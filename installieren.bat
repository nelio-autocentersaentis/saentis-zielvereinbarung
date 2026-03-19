@echo off
title Autocenter Saentis – Installation
color 0A
echo.
echo  ================================================
echo   AUTOCENTER SAENTIS – Zielvereinbarung 2026
echo   Installation
echo  ================================================
echo.

REM Prüfe Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FEHLER] Node.js nicht gefunden!
    echo.
    echo  Bitte zuerst Node.js installieren:
    echo  https://nodejs.org  (LTS Version herunterladen)
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js gefunden: 
node --version
echo.
echo  Installiere Abhaengigkeiten...
npm install
echo.
echo  ================================================
echo   Installation abgeschlossen!
echo   Starte jetzt: starten.bat
echo  ================================================
echo.
pause
