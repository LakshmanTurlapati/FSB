---
phase: "08"
plan: "03"
subsystem: "site-guides"
tags: ["per-site-guides", "data-restructuring", "career", "gaming", "productivity", "background-js", "cleanup"]
dependency-graph:
  requires:
    - "08-01 (registry enhancement, _shared.js files, per-site pattern)"
    - "08-02 (finance, travel, email, coding per-site splits)"
  provides:
    - "10 per-site guide files for career, gaming, and productivity categories"
    - "Updated background.js loading new per-site file structure"
    - "Removal of 9 old monolithic category files"
  affects:
    - "08-04 (viewer UI reads from new per-site registry)"
    - "08-05 (AI integration update uses new flat selectors)"
tech-stack:
  added: []
  patterns:
    - "Per-site registration with flat selectors (same pattern from 08-01)"
key-files:
  created:
    - "site-guides/career/indeed.js"
    - "site-guides/career/glassdoor.js"
    - "site-guides/career/builtin.js"
    - "site-guides/career/generic.js"
    - "site-guides/gaming/steam.js"
    - "site-guides/gaming/epic-games.js"
    - "site-guides/gaming/gog.js"
    - "site-guides/gaming/humble-bundle.js"
    - "site-guides/productivity/google-sheets.js"
    - "site-guides/productivity/google-docs.js"
  modified:
    - "background.js"
  deleted:
    - "site-guides/ecommerce.js"
    - "site-guides/social.js"
    - "site-guides/coding.js"
    - "site-guides/travel.js"
    - "site-guides/finance.js"
    - "site-guides/email.js"
    - "site-guides/gaming-platforms.js"
    - "site-guides/career.js"
    - "site-guides/productivity.js"
decisions: []
metrics:
  duration: "4m 46s"
  completed: "2026-02-21"
---

# Phase 8 Plan 03: Career, Gaming, Productivity Splits + Background.js Update Summary

Split career.js, gaming-platforms.js, and productivity.js into 10 per-site files, updated background.js to load the new per-site structure, and deleted all 9 old monolithic category files.

## What Was Done

### Task 1: Split Career, Gaming, and Productivity into Per-Site Files
- Created 4 career per-site files: indeed.js, glassdoor.js, builtin.js, generic.js
  - generic.js covers ATS platforms (Lever, Greenhouse, Ashby, Workday, iCIMS, Jobvite) and generic career page patterns
  - indeed.js includes dual-field search (What + Where) and side-panel job detail handling
  - glassdoor.js includes salary estimate extraction and login-wall awareness
- Created 4 gaming per-site files: steam.js, epic-games.js, gog.js, humble-bundle.js
  - steam.js includes critical warning about hashed/dynamic CSS classes and XPath-based selectors
  - epic-games.js includes free games section and React-specific wait guidance
  - gog.js notes DRM-free pricing differences from Steam
  - humble-bundle.js covers bundle tier pricing and charity components
- Created 2 productivity per-site files: google-sheets.js, google-docs.js
  - google-sheets.js includes detailed Name Box navigation for canvas-based grid
  - google-docs.js includes comprehensive toolbar selectors and canvas-based text editing guidance
- All files use flat selectors and registerSiteGuide() pattern from Plan 01

### Task 2: Update background.js and Delete Old Files
- Replaced 9 old category file imports in background.js with structured per-site imports
  - index.js loads first, then 9 _shared.js files, then 43 per-site files grouped by category
- Deleted 9 old monolithic category files via git rm: ecommerce.js, social.js, coding.js, travel.js, finance.js, email.js, gaming-platforms.js, career.js, productivity.js
- Only index.js remains in site-guides root directory
- Verified no references to old file paths remain in background.js

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Split career, gaming, productivity into per-site files | ea60dc6 | 4 career + 4 gaming + 2 productivity per-site files |
| 2 | Update background.js and delete old category files | 574e920 | background.js updated, 9 old files deleted |

## Decisions Made

None -- followed the exact same pattern established in Plans 01 and 02.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- All 9 category subdirectories have _shared.js + per-site files: PASSED
- background.js importScripts has no references to old file paths: PASSED
- No old category files exist in site-guides/ root (only index.js remains): PASSED
- Total per-site files: 43 across 9 categories: PASSED
- Total JS files in site-guides: 53 (1 index + 9 shared + 43 per-site): PASSED

## Next Phase Readiness

Plans 08-04 and 08-05 can proceed. The data restructuring is complete:
- All 43 per-site files registered with flat selectors
- All 9 _shared.js files registered with category metadata
- background.js loads the new structure
- Old monolithic files removed

## Self-Check: PASSED
