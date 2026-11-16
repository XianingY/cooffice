#!/usr/bin/env bash
# Start the built server, verify key endpoints, then stop it.
set -euo pipefail

PORT="${SMOKE_PORT:-3011}"
BASE="http://127.0.0.1:${PORT}"
export JWT_SECRET="${JWT_SECRET:-smoke-test-secret-long-enough-for-hs256}"
export PORT="$PORT"
export DATABASE_PATH="${DATABASE_PATH:-./data/smoke.db}"

node dist/index.js > /tmp/whatif-smoke-server.log 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -sf "$BASE/health" > /dev/null 2>&1; then break; fi
  sleep 0.2
done

echo "health:  $(curl -sf "$BASE/health")"
echo "ready:   $(curl -sf "$BASE/ready")"
REGISTER=$(curl -sf -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@test.dev","password":"password123","displayName":"Smoke"}')
echo "register: $(echo "$REGISTER" | cut -c1-80)..."
echo "SMOKE OK"
