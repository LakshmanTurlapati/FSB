#!/usr/bin/env bash
# Phase 216 Plan 02 verifier: CRAWL-02 sitemap.xml, CRAWL-04 llms-full.txt,
# CRAWL-05 prebuild script, D-14 version.ts <-> manifest.json equality.
# Run from repo root.
set -euo pipefail

SCRIPT="showcase/angular/scripts/build-crawler-files.mjs"
PKG="showcase/angular/package.json"
SITEMAP="showcase/angular/public/sitemap.xml"
LLMS_FULL="showcase/angular/public/llms-full.txt"
VERSION_TS="showcase/angular/src/app/core/seo/version.ts"
MANIFEST="manifest.json"

echo "[216] CHECK: CRAWL-05-A prebuild script exists and is valid Node ESM"
test -f "$SCRIPT"
node --check "$SCRIPT"

echo "[216] CHECK: CRAWL-05-B prebuild produces all three artifacts when run standalone"
node "$SCRIPT"
test -f "$SITEMAP"
test -f "$LLMS_FULL"
test -f "$VERSION_TS"

echo "[216] CHECK: CRAWL-05-C package.json has the prebuild hook"
grep -q "\"prebuild\": \"node scripts/build-crawler-files.mjs\"" "$PKG"

echo "[216] CHECK: CRAWL-05-D zero new sitemap/markdown deps (deny-list)"
if grep -qE "\"(marked|commonmark|xml2js|xmlbuilder|xmlbuilder2|fast-xml-parser|js-yaml)\":" "$PKG"; then
  echo "[216] forbidden dependency detected in $PKG"
  exit 1
fi

echo "[216] CHECK: CRAWL-02-A sitemap.xml has the XML declaration"
head_chars=$(head -c 19 "$SITEMAP")
if [ "$head_chars" != '<?xml version="1.0"' ]; then
  echo "[216] sitemap.xml does not start with XML declaration: '$head_chars'"
  exit 1
fi

echo "[216] CHECK: CRAWL-02-B sitemap.xml has exactly 4 <loc> entries"
loc_count=$(grep -c '<loc>' "$SITEMAP")
if [ "$loc_count" -ne 4 ]; then
  echo "[216] expected 4 <loc> entries, got $loc_count"
  exit 1
fi

echo "[216] CHECK: CRAWL-02-C all four marketing routes present, /dashboard absent"
for url in \
  "https://full-selfbrowsing.com" \
  "https://full-selfbrowsing.com/about" \
  "https://full-selfbrowsing.com/privacy" \
  "https://full-selfbrowsing.com/support"; do
  if ! grep -q "<loc>$url</loc>" "$SITEMAP"; then
    echo "[216] missing <loc> for $url"
    exit 1
  fi
done
if grep -q "dashboard" "$SITEMAP"; then
  echo "[216] sitemap.xml unexpectedly contains 'dashboard'"
  exit 1
fi

echo "[216] CHECK: CRAWL-02-D lastmod is ISO 8601 short form and identical across entries"
if ! grep -qE "<lastmod>[0-9]{4}-[0-9]{2}-[0-9]{2}</lastmod>" "$SITEMAP"; then
  echo "[216] lastmod ISO 8601 short form not found"
  exit 1
fi
unique_lastmods=$(grep -oE "<lastmod>[0-9]{4}-[0-9]{2}-[0-9]{2}</lastmod>" "$SITEMAP" | sort -u | wc -l | tr -d ' ')
if [ "$unique_lastmods" -ne 1 ]; then
  echo "[216] expected 1 unique lastmod across 4 entries, got $unique_lastmods"
  exit 1
fi

echo "[216] CHECK: CRAWL-04-A llms-full.txt has generated-at header on line 1"
if ! head -1 "$LLMS_FULL" | grep -qE "<!-- generated [0-9]{4}-[0-9]{2}-[0-9]{2} by build-crawler-files\.mjs; edit llms-full\.source\.md -->"; then
  echo "[216] llms-full.txt header missing or malformed"
  exit 1
fi

echo "[216] CHECK: CRAWL-04-B llms-full.txt is under 256000 bytes"
size=$(wc -c < "$LLMS_FULL")
if [ "$size" -ge 256000 ]; then
  echo "[216] llms-full.txt too large: $size bytes (limit 256000)"
  exit 1
fi

echo "[216] CHECK: CRAWL-04-C llms-full.txt mentions all three competitors"
grep -q "Browser Use" "$LLMS_FULL"
grep -q "Project Mariner" "$LLMS_FULL"
grep -q "Operator" "$LLMS_FULL"

echo "[216] CHECK: D-14 version.ts APP_VERSION matches manifest.json .version"
EXPECTED=$(node -e "console.log(require('./$MANIFEST').version)")
if ! grep -q "export const APP_VERSION = '${EXPECTED}'" "$VERSION_TS"; then
  echo "[216] APP_VERSION mismatch; manifest.json says '$EXPECTED'"
  cat "$VERSION_TS"
  exit 1
fi

echo "[216] verify-prebuild.sh: CRAWL-02, CRAWL-04, CRAWL-05, D-14 ALL PASSED"
