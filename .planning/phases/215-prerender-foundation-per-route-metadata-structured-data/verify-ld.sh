#!/usr/bin/env bash
# Phase 215 LD-01, LD-02, T-LD-01 verification (Plan 03).
# Run after: npm --prefix showcase/angular run build
set -euo pipefail

DIST="showcase/dist/showcase-angular/browser"

echo "[215] LD-01: Organization JSON-LD on every prerendered route"
for r in "" about privacy support; do
  f="$DIST/${r:+$r/}index.html"
  grep -q '"@type":"Organization"' "$f" || { echo "FAIL: Organization missing on /$r"; exit 1; }
done

echo "[215] LD-02: SoftwareApplication exactly once on home, zero elsewhere"
HOME_COUNT=$(grep -c '"@type":"SoftwareApplication"' "$DIST/index.html" || true)
if [ "$HOME_COUNT" != "1" ]; then
  echo "FAIL: expected exactly 1 SoftwareApplication on home, got $HOME_COUNT"
  exit 1
fi
for r in about privacy support; do
  COUNT=$(grep -c '"@type":"SoftwareApplication"' "$DIST/$r/index.html" || true)
  if [ "$COUNT" != "0" ]; then
    echo "FAIL: SoftwareApplication leaked onto /$r (count=$COUNT)"
    exit 1
  fi
done

echo "[215] T-LD-01: JSON-LD script bodies do NOT contain unescaped </"
python3 - "$DIST/index.html" "$DIST/about/index.html" "$DIST/privacy/index.html" "$DIST/support/index.html" <<'PY'
import re, sys
for path in sys.argv[1:]:
    html = open(path, encoding='utf-8').read()
    # Match <script ...type="application/ld+json"...> with any attribute order/extra attrs
    # (Angular Renderer2 injects _ngcontent and data-ld between 'script' and 'type').
    blocks = re.findall(r'<script\b[^>]*\btype="application/ld\+json"[^>]*>(.*?)</script>', html, flags=re.DOTALL)
    for b in blocks:
        if '</' in b:
            print(f"FAIL: unescaped '</' inside JSON-LD body in {path}: {b[:120]}...")
            sys.exit(1)
    print(f"OK: {path} -> {len(blocks)} JSON-LD block(s), all '</' escaped as \\u003c/")
PY

echo "[215] verify-ld.sh: LD-01, LD-02, T-LD-01 ALL PASSED"
