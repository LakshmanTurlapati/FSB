#!/usr/bin/env bash
# Phase 216 Plan 04 verifier: builds the showcase, boots the Express server on
# a dedicated port, and runs scripts/smoke-crawler.mjs against the local
# instance with BASE_URL=http://localhost:$PORT. Exits 0 only when every
# SMOKE-01/SMOKE-02/SMOKE-03 assertion passes end-to-end against the freshly
# built local server. SMOKE-04 (Rich Results / Search Console) stays manual
# per CONTEXT.md D-13.
#
# Port 3217 chosen to avoid collision with verify-server.sh (3216) so the two
# verifiers can run back-to-back without TIME_WAIT. SMOKE_PORT env var override
# supported.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

PORT="${SMOKE_PORT:-3217}"
DIST_DIR="showcase/dist/showcase-angular/browser"
TMP_DIR="$(mktemp -d -t 216-smoke-XXXXXX)"

cleanup() {
  if [ -n "${SRV_PID:-}" ]; then
    kill "$SRV_PID" 2>/dev/null || true
    wait "$SRV_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "[216] verify-smoke.sh starting (port=$PORT)"

# 1. PRECONDITION -- ensure dist exists; build if missing.
if [ ! -f "$DIST_DIR/index.html" ] || [ ! -f "$DIST_DIR/about/index.html" ] \
   || [ ! -f "$DIST_DIR/robots.txt" ] || [ ! -f "$DIST_DIR/sitemap.xml" ] \
   || [ ! -f "$DIST_DIR/llms.txt" ]   || [ ! -f "$DIST_DIR/llms-full.txt" ]; then
  echo "[216] dist missing or incomplete -- running showcase build"
  npm --prefix showcase/angular install >/dev/null 2>&1 || true
  npm --prefix showcase/angular run build
fi
echo "[216] CHECK: dist artifacts present"

# 2. Sanity-check the smoke script itself before booting anything.
node --check showcase/angular/scripts/smoke-crawler.mjs
echo "[216] CHECK: smoke-crawler.mjs syntax OK"

# 3. BOOT SERVER on $PORT.
PORT="$PORT" node server/server.js > "$TMP_DIR/server.log" 2>&1 &
SRV_PID=$!

# 4. Wait up to 10s for the server to bind.
READY=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 1 "http://localhost:$PORT/" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done
if [ "$READY" -ne 1 ]; then
  echo "[216] FAIL: server did not bind on port $PORT within 10s"
  echo "--- server.log ---"
  cat "$TMP_DIR/server.log"
  exit 1
fi
echo "[216] CHECK: server bound on port $PORT (pid=$SRV_PID)"

# 5. RUN SMOKE -- BASE_URL points at the local server.
echo "[216] CHECK: invoking npm run smoke:crawler against http://localhost:$PORT"
set +e
BASE_URL="http://localhost:$PORT" npm --prefix showcase/angular run smoke:crawler \
  > "$TMP_DIR/smoke.log" 2>&1
SMOKE_EXIT=$?
set -e

cat "$TMP_DIR/smoke.log"

if [ "$SMOKE_EXIT" -ne 0 ]; then
  echo "[216] FAIL: smoke-crawler.mjs exited with code $SMOKE_EXIT"
  exit 1
fi

if ! grep -q "\[smoke-crawler\] all assertions passed" "$TMP_DIR/smoke.log"; then
  echo "[216] FAIL: smoke-crawler.mjs did not print success line"
  exit 1
fi

# 6. CLEANUP via trap.
echo "[216] verify-smoke.sh: SMOKE-01, SMOKE-02, SMOKE-03 ALL PASSED"
