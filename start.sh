#!/bin/bash
# Start both server and client
echo "Starting Market Compass..."

cd "$(dirname "$0")/server" && node --experimental-strip-types src/index.ts &
SERVER_PID=$!
echo "✓ Server started (PID $SERVER_PID) → http://localhost:3001"

cd "$(dirname "$0")/client" && npm run dev &
CLIENT_PID=$!
echo "✓ Client started (PID $CLIENT_PID) → http://localhost:5173"

echo ""
echo "Open http://localhost:5173 in your browser"
echo "Press Ctrl+C to stop"

wait
