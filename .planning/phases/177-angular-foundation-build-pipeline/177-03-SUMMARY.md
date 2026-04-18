---
phase: 177-angular-foundation-build-pipeline
plan: 03
title: "Build Pipeline & Express Server Integration"
subsystem: showcase-angular, server
tags: [angular, express, build-pipeline, spa-fallback, redirects]
dependency_graph:
  requires: [177-01, 177-02]
  provides: [angular-dist-serving, spa-fallback, html-redirects]
  affects: [server/server.js, showcase/angular/angular.json]
tech_stack:
  added: []
  patterns: [angular-build-application, express-spa-fallback, legacy-html-redirects]
key_files:
  created:
    - showcase/angular/src/app/pages/about/about-page.component.html
    - showcase/angular/.gitignore
  modified:
    - server/server.js
    - showcase/angular/angular.json
    - tests/showcase-angular-foundation.test.js
decisions:
  - "Used Angular outputPath object format {base, browser} to correctly place dist output at showcase/dist/showcase-angular/browser/ without double-nesting"
  - "Extracted about-page template from vanilla about.html main content (lines 56-1075) to resolve missing templateUrl compilation error"
  - "Updated foundation test to handle object-form outputPath while maintaining the same resolved path contract"
metrics:
  duration: "5 min"
  completed: "2026-04-18T02:23:44Z"
  tasks_completed: 2
  tasks_total: 3
  status: checkpoint-reached
---

# Phase 177 Plan 03: Build Pipeline & Express Server Integration Summary

Express server updated to serve Angular dist output with SPA fallback and legacy .html redirects, full build pipeline verified end-to-end with all 40 foundation assertions passing.

## What Was Done

### Task 1: Express Server Update (823a137)
- Updated `staticPath` logic to prefer Angular dist output (`showcase/dist/showcase-angular/browser/`) over vanilla showcase, with Docker `public/` fallback
- Added legacy `.html` redirects with 301 status codes for `/index.html`, `/about.html`, `/dashboard.html`, `/privacy.html`, `/support.html`
- Replaced dashboard-only SPA fallback with comprehensive route array covering all showcase routes (`/`, `/about`, `/dashboard`, `/privacy`, `/support`)
- Removed duplicate root route handler
- All API routes (`/api/auth`, `/api/agents`, `/api/pair`, `/api/stats`) preserved unchanged

### Task 2: Full Build Pipeline Verification (3a3a506)
- `npm run showcase:install` completed successfully (408 packages)
- `npm run showcase:build` completed successfully after fixing two blocking issues
- Verified `showcase/dist/showcase-angular/browser/index.html` exists and contains `<app-root>`
- All 40 foundation test assertions pass

### Task 3: Visual Verification (CHECKPOINT)
- Awaiting human verification of Angular shell layout, theme toggle, navigation, and responsive behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `index` property in angular.json build options**
- **Found during:** Task 2
- **Issue:** `@angular/build:application` builder requires `index` property in build options. Build failed with schema validation error: `Data path "" must have required property 'index'`
- **Fix:** Added `"index": "src/index.html"` to angular.json build options
- **Files modified:** showcase/angular/angular.json
- **Commit:** 3a3a506

**2. [Rule 3 - Blocking] Double-nested browser directory in build output**
- **Found during:** Task 2
- **Issue:** With string `outputPath: "../dist/showcase-angular/browser"` and `index` property, the builder creates a `browser/` subdirectory under the output path, resulting in `browser/browser/` double nesting
- **Fix:** Changed `outputPath` to object format `{ "base": "../dist/showcase-angular", "browser": "browser" }` so the builder creates files at the expected `showcase/dist/showcase-angular/browser/`
- **Files modified:** showcase/angular/angular.json, tests/showcase-angular-foundation.test.js
- **Commit:** 3a3a506

**3. [Rule 3 - Blocking] Missing about-page.component.html template file**
- **Found during:** Task 2
- **Issue:** `about-page.component.ts` uses `templateUrl: './about-page.component.html'` but the HTML file did not exist. Build failed with `TS-992008: Could not find template file`
- **Fix:** Extracted main content (sections between nav and footer) from vanilla `showcase/about.html` into the Angular template file
- **Files modified:** showcase/angular/src/app/pages/about/about-page.component.html (created)
- **Commit:** 3a3a506

**4. [Rule 2 - Missing functionality] Angular workspace .gitignore**
- **Found during:** Task 2
- **Issue:** `.angular/` cache directory and `node_modules/` were showing as untracked files
- **Fix:** Created `.gitignore` in `showcase/angular/` to ignore `.angular/`, `node_modules/`, and `dist/`
- **Files modified:** showcase/angular/.gitignore (created)
- **Commit:** 3a3a506

## Self-Check: PENDING

Self-check will be completed after checkpoint resolution.
