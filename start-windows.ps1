# Cadence launcher for Windows (PowerShell version - more reliable than .bat)
# Right-click this file -> Run with PowerShell
# OR open PowerShell and run:  .\start-windows.ps1
# If you get an execution policy error, run this first:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Cadence - AI Calendar Assistant" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Figure out which runtime to use
$runner = $null
if (Get-Command bun -ErrorAction SilentlyContinue) {
    $runner = "bun"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $runner = "npm"
} else {
    Write-Host "ERROR: Neither bun nor npm was found." -ForegroundColor Red
    Write-Host ""
    Write-Host "You installed Node.js, but npm (which comes with Node) is not on your PATH."
    Write-Host "Try these fixes:"
    Write-Host "  1. Restart your computer (PATH updates sometimes need a restart)"
    Write-Host "  2. Reinstall Node.js from https://nodejs.org (LTS version)"
    Write-Host "  3. Open a new PowerShell window and run:  npm --version"
    Write-Host "     If that works, run Cadence manually (see README.md)"
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Using runtime: $runner" -ForegroundColor Green
Write-Host ""

# Step 1: Install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Step 1 of 3: Installing dependencies (this takes a few minutes)..." -ForegroundColor Yellow
    & $runner install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Standard install hit a dependency conflict. Retrying with --legacy-peer-deps..." -ForegroundColor Yellow
        & $runner install --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "ERROR: Dependency installation failed even with --legacy-peer-deps." -ForegroundColor Red
            Read-Host "Press Enter to close"
            exit 1
        }
    }
    Write-Host "Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "Step 1 of 3: Dependencies already installed." -ForegroundColor Green
}
Write-Host ""

# Step 2: Always sync the database schema and generate the Prisma client.
# db:push is idempotent — safe to run every time. This ensures the
# Setting and PushSubscription tables exist even if upgrading from an older version.
Write-Host "Step 2 of 3: Syncing database schema..." -ForegroundColor Yellow
& $runner run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Database sync failed. Try deleting the 'db' folder and re-running." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}
Write-Host "Database ready." -ForegroundColor Green
Write-Host ""

# Step 3: Start the server
Write-Host "Step 3 of 3: Starting Cadence on http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Cadence is starting. Keep this window open." -ForegroundColor White
Write-Host "  Your browser will open automatically in a few seconds." -ForegroundColor White
Write-Host "  To stop Cadence, close this window or press Ctrl+C." -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Open the browser after the server has had time to start
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 8
    Start-Process "http://localhost:3000"
} | Out-Null

# Start the dev server (blocks until Ctrl+C)
& $runner run dev

Write-Host ""
Write-Host "Cadence has stopped." -ForegroundColor Yellow
Read-Host "Press Enter to close"
