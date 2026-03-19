# ================================================
# Autocenter Saentis – Als Windows-Dienst einrichten
# Damit startet der Server automatisch mit Windows
# Als Administrator ausfuehren!
# ================================================

$AppName = "AutocenterSaentis"
$AppDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$Script  = Join-Path $AppDir "server.js"

Write-Host ""
Write-Host " ================================================" -ForegroundColor Cyan
Write-Host "  AUTOCENTER SAENTIS als Windows-Dienst" -ForegroundColor Cyan
Write-Host " ================================================" -ForegroundColor Cyan
Write-Host ""

# Pruefe ob als Admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host " [FEHLER] Bitte als Administrator ausfuehren!" -ForegroundColor Red
    Write-Host " Rechtsklick auf PowerShell -> Als Administrator ausfuehren" -ForegroundColor Yellow
    pause
    exit 1
}

# Pruefe ob nssm verfuegbar (Non-Sucking Service Manager)
$nssmPath = Join-Path $AppDir "nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host " Lade nssm herunter (Service Manager)..." -ForegroundColor Yellow
    try {
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $zipPath = Join-Path $env:TEMP "nssm.zip"
        Invoke-WebRequest -Uri $nssmUrl -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath (Join-Path $env:TEMP "nssm") -Force
        Copy-Item (Join-Path $env:TEMP "nssm\nssm-2.24\win64\nssm.exe") $nssmPath
        Write-Host " [OK] nssm heruntergeladen" -ForegroundColor Green
    } catch {
        Write-Host " [FEHLER] nssm konnte nicht heruntergeladen werden" -ForegroundColor Red
        Write-Host " Bitte manuell von https://nssm.cc herunterladen" -ForegroundColor Yellow
        pause
        exit 1
    }
}

# Dienst installieren
Write-Host " Installiere Windows-Dienst '$AppName'..." -ForegroundColor Yellow
& $nssmPath install $AppName $NodeExe $Script
& $nssmPath set $AppName AppDirectory $AppDir
& $nssmPath set $AppName DisplayName "Autocenter Saentis Zielvereinbarung 2026"
& $nssmPath set $AppName Description "Web-App fuer Verkaufsziele und Bonus-Tracking"
& $nssmPath set $AppName Start SERVICE_AUTO_START

# Dienst starten
Write-Host " Starte Dienst..." -ForegroundColor Yellow
Start-Service -Name $AppName

Write-Host ""
Write-Host " ================================================" -ForegroundColor Green
Write-Host "  Dienst installiert und gestartet!" -ForegroundColor Green
Write-Host ""
Write-Host "  App erreichbar unter:" -ForegroundColor Green
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notmatch 'Loopback'} | Select-Object -First 1).IPAddress
Write-Host "  http://${ip}:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Startet automatisch nach jedem Neustart." -ForegroundColor Green
Write-Host " ================================================" -ForegroundColor Green
Write-Host ""
pause
