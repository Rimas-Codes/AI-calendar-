#!/bin/bash
# Cadence launcher for Linux
# Make executable: chmod +x start-linux.sh
# Then run: ./start-linux.sh  (or double-click in your file manager)

set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  Cadence - AI Calendar Assistant"
echo "============================================"
echo

# Pick a runtime
if command -v bun >/dev/null 2>&1; then
    RUNNER="bun"
elif command -v npm >/dev/null 2>&1; then
    RUNNER="npm"
else
    echo "Neither bun nor npm was found."
    echo "Install one of them first:"
    echo "  - Bun (recommended): https://bun.sh"
    echo "  - Node.js: https://nodejs.org"
    read -p "Press Enter to close..."
    exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo "First run - installing dependencies..."
    $RUNNER install
    echo
fi

# Initialise the database if it doesn't exist
if [ ! -f "db/custom.db" ]; then
    echo "Initialising database..."
    $RUNNER run db:push
    echo
fi

echo "Starting Cadence on http://localhost:3000"
echo
echo "Keep this Terminal window open while you use the app."
echo "Press Ctrl+C in this window to stop it."
echo

# Try to open the browser (xdg-open on most Linux distros)
( sleep 5 && (xdg-open "http://localhost:3000" >/dev/null 2>&1 || true) ) &

# Start the dev server (foreground)
$RUNNER run dev
