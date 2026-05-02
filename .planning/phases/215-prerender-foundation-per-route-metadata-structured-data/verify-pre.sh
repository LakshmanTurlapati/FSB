#!/usr/bin/env bash
# Phase 215 PRE-01..05 verification (Plan 01 only).
# Run from repo root after: npm --prefix showcase/angular run build
set -euo pipefail

DIST="showcase/dist/showcase-angular/browser"
SRC="showcase/angular"

echo "[215] PRE-01: @angular/ssr installed"
grep -q '"@angular/ssr"' "$SRC/package.json"

echo "[215] PRE-02: angular.json outputMode + prerender wired"
grep -q '"outputMode": "static"' "$SRC/angular.json"
grep -q '"routesFile": "prerender-routes.txt"' "$SRC/angular.json"
grep -q '"discoverRoutes": false' "$SRC/angular.json"

echo "[215] PRE-03: prerender-routes.txt has exactly 4 marketing routes"
diff <(printf '/\n/about\n/privacy\n/support\n') "$SRC/prerender-routes.txt"

echo "[215] PRE-04: localStorage typeof guard present in index.html"
grep -q "typeof localStorage !== 'undefined'" "$SRC/src/index.html"

echo "[215] PRE-05: build output present for marketing routes; /dashboard absent"
test -f "$DIST/index.html"
test -f "$DIST/about/index.html"
test -f "$DIST/privacy/index.html"
test -f "$DIST/support/index.html"
test ! -e "$DIST/dashboard/index.html"

echo "[215] verify-pre.sh: PRE-01..05 ALL PASSED"
