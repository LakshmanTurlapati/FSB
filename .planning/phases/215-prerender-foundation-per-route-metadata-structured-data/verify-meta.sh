#!/usr/bin/env bash
# Phase 215 META-01..04 verification (Plan 02).
# Run after: npm --prefix showcase/angular run build
set -euo pipefail

DIST="showcase/dist/showcase-angular/browser"
SRC="showcase/angular"

echo "[215] META-01: each prerendered route has a unique <title>"
TITLES=$(for r in "" about privacy support; do
  f="$DIST/${r:+$r/}index.html"
  grep -oE '<title>[^<]+</title>' "$f" | head -n1
done | sort -u | wc -l | tr -d ' ')
if [ "$TITLES" != "4" ]; then
  echo "FAIL: expected 4 unique titles across (/, /about, /privacy, /support), got $TITLES"
  exit 1
fi

echo "[215] META-02: per-route canonical link present"
for r in "" about privacy support; do
  f="$DIST/${r:+$r/}index.html"
  url="https://full-selfbrowsing.com/${r}"
  url="${url%/}"
  grep -q "rel=\"canonical\" href=\"${url}\"" "$f" || \
    grep -q "rel=\"canonical\"[^>]*href=\"${url}\"" "$f" || \
    { echo "FAIL: canonical missing or wrong on /$r"; exit 1; }
done

echo "[215] META-03: OG + Twitter Card tags present on each prerendered route"
for r in "" about privacy support; do
  f="$DIST/${r:+$r/}index.html"
  for tag in 'og:title' 'og:description' 'og:url' 'og:type' 'og:image' 'og:site_name' 'twitter:card' 'twitter:title' 'twitter:description' 'twitter:image'; do
    grep -q "$tag" "$f" || { echo "FAIL: $tag missing in $f"; exit 1; }
  done
done

echo "[215] META-04: dashboard component sets noindex,nofollow at runtime (source-level grep)"
grep -RqE "noindex,\s*nofollow" "$SRC/src/app/pages/dashboard/" || \
  { echo "FAIL: noindex,nofollow not found in dashboard component source"; exit 1; }

echo "[215] verify-meta.sh: META-01..04 ALL PASSED"
