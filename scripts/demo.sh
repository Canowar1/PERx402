#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Shadow Proxy — Demo Launch Script
#
# Starts all services + runs the agent demo.
# Usage: bash scripts/demo.sh
# ─────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Run 'npm run fund-devnet' first."
  exit 1
fi
set -a; source .env; set +a

# Cleanup on exit
cleanup() {
  echo ""
  echo "[demo] Shutting down..."
  kill $(lsof -ti:9999) 2>/dev/null || true
  kill $(lsof -ti:3001) 2>/dev/null || true
  kill $(lsof -ti:3000) 2>/dev/null || true
  echo "[demo] Done."
}
trap cleanup EXIT

# Kill any existing instances
kill $(lsof -ti:9999) 2>/dev/null || true
kill $(lsof -ti:3001) 2>/dev/null || true
kill $(lsof -ti:3000) 2>/dev/null || true
sleep 1

echo "========================================="
echo "   Shadow Proxy — Private x402 Demo"
echo "========================================="
echo ""

# 1. Start mock x402 API
echo "[demo] Starting mock x402 API server on :9999..."
npx tsx proxy/src/mock-x402-server.ts &
sleep 2

# 2. Start proxy server
echo "[demo] Starting Shadow Proxy on :3001..."
cd proxy && npx tsx src/server.ts &
cd "$ROOT"
sleep 4

# 3. Start dashboard
echo "[demo] Starting dashboard on :3000..."
cd dashboard && npm run dev -- --port 3000 &
cd "$ROOT"
sleep 3

echo ""
echo "========================================="
echo "   All services running!"
echo "========================================="
echo ""
echo "   Dashboard:  http://localhost:3000"
echo "   Proxy:      http://localhost:3001"
echo "   Mock API:   http://localhost:9999"
echo ""
echo "   Program ID: AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n"
echo "   Proxy:      $PROXY_PUBKEY"
echo "   Agent:      $AGENT_PUBKEY"
echo ""
echo "   Press Ctrl+C to stop all services."
echo "========================================="

# Keep running until Ctrl+C
wait
