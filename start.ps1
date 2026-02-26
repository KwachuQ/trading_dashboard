# start.ps1 — Trading Dashboard one-click launcher
#
# Right-click this file -> "Run with PowerShell"
# Starts the backend and frontend in separate windows,
# then opens the dashboard in your default browser.

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"

# -----------------------------------------------------------------------
# Backend window
# -----------------------------------------------------------------------
$backendCmd = @"
cd '$BACKEND'
if (Test-Path '.\venv\Scripts\Activate.ps1') {
    & '.\venv\Scripts\Activate.ps1'
}
python main.py
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

# Allow backend a moment to start before launching the frontend
Start-Sleep -Seconds 2

# -----------------------------------------------------------------------
# Frontend window
# -----------------------------------------------------------------------
$frontendCmd = @"
cd '$FRONTEND'
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

# Allow Vite a moment to compile before opening the browser
Start-Sleep -Seconds 3

# -----------------------------------------------------------------------
# Open dashboard in default browser
# -----------------------------------------------------------------------
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Trading Dashboard is starting..."
Write-Host "  Backend  -> http://localhost:8000"
Write-Host "  Frontend -> http://localhost:5173"
Write-Host ""
Write-Host "Close the backend and frontend windows to stop the app."
