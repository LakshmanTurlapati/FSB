#!/usr/bin/env bash
# Phase 216 Plan 03 verifier: boots the Express server, curls every relevant
# route, asserts route-specific HTML for marketing routes, SPA-shell behavior
# for /dashboard exact-match, correct Content-Type + Cache-Control on crawler
# files, and the T-216-01 no-shadowing invariant.
#
# Local-only. Production validation lives in Plan 04 (smoke-crawler.mjs).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

PORT="${PORT:-3216}"
DIST_DIR="showcase/dist/showcase-angular/browser"
TMP_DIR="$(mktemp -d -t 216-srv-XXXXXX)"

cleanup() {
  if [ -n "${SRV_PID:-}" ]; then
    kill "$SRV_PID" 2>/dev/null || true
    wait "$SRV_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "[216] verify-server.sh starting (port=$PORT)"

# 1. PRECONDITION -- ensure dist exists; build if missing.
if [ ! -f "$DIST_DIR/index.html" ] || [ ! -f "$DIST_DIR/about/index.html" ] \
   || [ ! -f "$DIST_DIR/robots.txt" ] || [ ! -f "$DIST_DIR/sitemap.xml" ] \
   || [ ! -f "$DIST_DIR/llms.txt" ]   || [ ! -f "$DIST_DIR/llms-full.txt" ]; then
  echo "[216] dist missing or incomplete -- running showcase build"
  npm --prefix showcase/angular install >/dev/null 2>&1 || true
  npm --prefix showcase/angular run build
fi
echo "[216] CHECK: dist artifacts present"

# 2. BOOT SERVER on $PORT.
PORT="$PORT" node server/server.js > "$TMP_DIR/server.log" 2>&1 &
SRV_PID=$!

# 3. Wait up to 10s for the server to bind.
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

CURL="curl -fsS --max-time 5"

# Helper: assert a route returns 200 with substring + canonical.
assert_route() {
  local path="$1"
  local title_substr="$2"
  local canonical="$3"
  local label="$4"
  local body="$TMP_DIR/$(echo "$label" | tr '/' '_').html"
  $CURL "http://localhost:$PORT$path" > "$body"
  if ! grep -q "$title_substr" "$body"; then
    echo "[216] FAIL: $label -- title substring '$title_substr' not found in $path"
    grep -o '<title>[^<]*</title>' "$body" || true
    exit 1
  fi
  if [ -n "$canonical" ]; then
    if ! grep -qF "rel=\"canonical\" href=\"$canonical\"" "$body"; then
      echo "[216] FAIL: $label -- canonical '$canonical' not found in $path"
      grep -oE 'rel="canonical"[^>]*' "$body" || true
      exit 1
    fi
  fi
  echo "[216] CHECK: $label ($path)"
}

# 4. SRV-01-A -- /about route-specific HTML.
assert_route "/about"   "About</title>"   "https://full-selfbrowsing.com/about"   "SRV-01-A /about"

# 5. SRV-01-B -- /privacy.
assert_route "/privacy" "Privacy</title>" "https://full-selfbrowsing.com/privacy" "SRV-01-B /privacy"

# 6. SRV-01-C -- /support.
assert_route "/support" "Support</title>" "https://full-selfbrowsing.com/support" "SRV-01-C /support"

# 7. SRV-01-D -- root home page; canonical is bare host (Phase 215 D-02).
assert_route "/" "Full Self-Browsing</title>" "https://full-selfbrowsing.com" "SRV-01-D /"

# Home must also include a SoftwareApplication JSON-LD block (LD-02).
if ! grep -q '<script type="application/ld+json"' "$TMP_DIR/SRV-01-D _.html"; then
  echo "[216] FAIL: SRV-01-D / -- LD-02 SoftwareApplication JSON-LD block missing"
  exit 1
fi
echo "[216] CHECK: SRV-01-D LD-02 JSON-LD present on /"

# 8. SRV-02-A -- /dashboard returns 200 with the SPA shell (matches '<app-root'
# without a closing '>' because the prerendered tag carries ng-version attrs).
DASH_BODY="$TMP_DIR/dashboard.html"
$CURL "http://localhost:$PORT/dashboard" > "$DASH_BODY"
if ! grep -q '<app-root' "$DASH_BODY"; then
  echo "[216] FAIL: SRV-02-A /dashboard -- expected <app-root in body (SPA shell)"
  exit 1
fi
# Phase 215 deliberately omits a /dashboard canonical; assert it is NOT there.
if grep -qF 'rel="canonical" href="https://full-selfbrowsing.com/dashboard"' "$DASH_BODY"; then
  echo "[216] FAIL: SRV-02-A /dashboard -- per-route /dashboard canonical present (should not be)"
  exit 1
fi
echo "[216] CHECK: SRV-02-A /dashboard returns SPA shell with no /dashboard canonical"

# 9. SRV-02-B -- /dashboard/foo MUST 404 (D-10 exact-match).
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$PORT/dashboard/foo")
if [ "$STATUS" != "404" ]; then
  echo "[216] FAIL: SRV-02-B /dashboard/foo expected 404, got $STATUS (D-10 prefix-match prohibition)"
  exit 1
fi
echo "[216] CHECK: SRV-02-B /dashboard/foo -> 404"

# 10. SRV-02-C -- unknown apex route MUST 404.
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$PORT/nonexistent-marketing-route")
if [ "$STATUS" != "404" ]; then
  echo "[216] FAIL: SRV-02-C /nonexistent-marketing-route expected 404, got $STATUS"
  exit 1
fi
echo "[216] CHECK: SRV-02-C /nonexistent-marketing-route -> 404"

# Helper: assert a crawler file returns expected Content-Type + Cache-Control.
assert_crawler_headers() {
  local path="$1"
  local content_type_re="$2"
  local label="$3"
  local headers
  headers=$($CURL -D - -o /dev/null "http://localhost:$PORT$path")
  if ! echo "$headers" | grep -qiE "^Content-Type: $content_type_re"; then
    echo "[216] FAIL: $label -- Content-Type does not match /$content_type_re/"
    echo "$headers" | grep -i "^Content-Type" || true
    exit 1
  fi
  if ! echo "$headers" | grep -qiE "^Cache-Control: public, max-age=3600"; then
    echo "[216] FAIL: $label -- Cache-Control: public, max-age=3600 missing"
    echo "$headers" | grep -i "^Cache-Control" || true
    exit 1
  fi
  echo "[216] CHECK: $label ($path) headers correct"
}

# 11-14. SRV-03-A..D -- crawler file headers.
assert_crawler_headers "/robots.txt"    "text/plain"   "SRV-03-A robots.txt"
assert_crawler_headers "/sitemap.xml"   "(application|text)/xml" "SRV-03-B sitemap.xml"
assert_crawler_headers "/llms.txt"      "text/plain"   "SRV-03-C llms.txt"
assert_crawler_headers "/llms-full.txt" "text/plain"   "SRV-03-D llms-full.txt"

# 15. T-216-01 (CRITICAL) -- crawler file bodies MUST NOT be HTML.
for FILE in robots.txt sitemap.xml llms.txt llms-full.txt; do
  BODY_FILE="$TMP_DIR/crawler-$FILE"
  $CURL "http://localhost:$PORT/$FILE" > "$BODY_FILE"
  if grep -qi "<html" "$BODY_FILE"; then
    echo "[216] T-216-01 FAIL: /$FILE shadowed by SPA HTML (<html found in body)"
    head -c 300 "$BODY_FILE"; echo
    exit 1
  fi
  if grep -qi "<app-root" "$BODY_FILE"; then
    echo "[216] T-216-01 FAIL: /$FILE shadowed by SPA HTML (<app-root found in body)"
    head -c 300 "$BODY_FILE"; echo
    exit 1
  fi
done
echo "[216] CHECK: T-216-01 crawler files NOT shadowed by SPA fallback"

# 16. SRV-03-E -- regression: any served .js retains no-cache, must-revalidate.
JS_FILE=$(ls "$DIST_DIR"/main-*.js 2>/dev/null | head -1)
if [ -n "$JS_FILE" ]; then
  JS_BASENAME=$(basename "$JS_FILE")
  HEADERS=$($CURL -D - -o /dev/null "http://localhost:$PORT/$JS_BASENAME")
  if ! echo "$HEADERS" | grep -qiE "^Cache-Control: no-cache, must-revalidate"; then
    echo "[216] FAIL: SRV-03-E /$JS_BASENAME -- existing no-cache, must-revalidate policy missing"
    echo "$HEADERS" | grep -i "^Cache-Control" || true
    exit 1
  fi
  echo "[216] CHECK: SRV-03-E /$JS_BASENAME retains no-cache, must-revalidate"
else
  echo "[216] WARN: SRV-03-E -- no main-*.js found in dist; skipping regression check"
fi

# 17. CLEANUP done by trap.
echo "[216] verify-server.sh: SRV-01, SRV-02, SRV-03, T-216-01 ALL PASSED"
