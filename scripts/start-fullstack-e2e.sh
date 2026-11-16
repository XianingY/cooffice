#!/usr/bin/env bash
# Start backend + frontend for full-stack E2E, stop both on exit.
set -euo pipefail
cd "$(dirname "$0")/.."

export JWT_SECRET=e2e-fullstack-secret-at-least-32-chars
export PORT=3013
export DATABASE_PATH=./data/e2e-fullstack.db
export CORS_ORIGINS=http://127.0.0.1:5174,http://localhost:5174

(cd server && npx tsx src/index.ts) &
API_PID=$!
VITE_API_BASE_URL=http://127.0.0.1:3013 npx vite --host 127.0.0.1 --port 5174 &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
