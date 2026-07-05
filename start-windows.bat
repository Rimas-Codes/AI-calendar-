@echo off
REM Cadence launcher for Windows - rewritten for reliability
REM Double-click this file to start Cadence and open it in your browser.
REM The window stays open even on error so you can read what went wrong.

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Cadence - AI Calendar Assistant
echo ============================================
echo.

REM Figure out which runtime to use. We use goto-based logic because
REM nested if/else in batch is notoriously unreliable.
set "RUNNER="

where bun >nul 2>nul
if %errorlevel%==0 (
    set "RUNNER=bun"
    goto :found_runner
)

where npm >nul 2>nul
if %errorlevel%==0 (
    set "RUNNER=npm"
    goto :found_runner
)

echo.
echo ERROR: Neither bun nor npm was found on your PATH.
echo.
echo You installed Node.js, but npm (which comes with Node) is not in your PATH.
echo Try one of these:
echo   1. Close this window, open a NEW Command Prompt, and run "npm --version"
echo      If that works, the issue is that this script can't see npm. Run the
echo      manual commands from the README instead.
echo   2. Restart your computer (sometimes PATH updates need a restart).
echo   3. Reinstall Node.js from https://nodejs.org (choose the LTS version).
echo.
goto :pause_end

:found_runner
echo Using runtime: %RUNNER%
echo.

REM Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo Step 1 of 3: Installing dependencies ^(this takes a few minutes on first run^)...
    echo.
    call %RUNNER% install
    if !errorlevel! neq 0 (
        echo.
        echo Standard install hit a dependency conflict. Retrying with --legacy-peer-deps...
        echo This is normal for npm when peer deps don't perfectly match.
        echo.
        call %RUNNER% install --legacy-peer-deps
        if !errorlevel! neq 0 (
            echo.
            echo ERROR: Dependency installation failed even with --legacy-peer-deps.
            echo Common fixes:
            echo   - Make sure you have an internet connection
            echo   - Try deleting the "node_modules" folder and the lockfile, then re-run
            echo   - Try installing Bun instead: https://bun.sh
            goto :pause_end
        )
    )
    echo.
    echo Dependencies installed successfully.
    echo.
) else (
    echo Step 1 of 3: Dependencies already installed.
    echo.
)

REM Always sync the database schema and generate the Prisma client.
REM db:push is idempotent — safe to run every time. This ensures the
REM Setting and PushSubscription tables exist even if the user is upgrading
REM from an older version of Cadence.
echo Step 2 of 3: Syncing database schema...
call %RUNNER% run db:push
if !errorlevel! neq 0 (
    echo.
    echo ERROR: Database sync failed ^(see error above^).
    echo This is usually because the database file is locked or corrupted.
    echo Try deleting the "db" folder and running this script again.
    goto :pause_end
)
echo.
echo Database ready.
echo.

echo Step 3 of 3: Starting Cadence on http://localhost:3000
echo.
echo ============================================================
echo   Cadence is starting. Keep this window open.
echo   Your browser will open automatically in a few seconds.
echo   To stop Cadence, close this window or press Ctrl+C.
echo ============================================================
echo.

REM Open the browser after the server has had time to start
start "" /b cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:3000"

REM Start the dev server (foreground). This blocks until the user closes the window.
call %RUNNER% run dev

REM If we get here, the server exited (user pressed Ctrl+C or it crashed)
echo.
echo Cadence has stopped.
echo.

:pause_end
echo.
echo Press any key to close this window...
pause >nul
