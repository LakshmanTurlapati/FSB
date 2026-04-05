---
phase: 09-data-pipeline-foundation
plan: 03
subsystem: data-pipeline
tags: [site-guides, career, ats, importScripts, background.js, parser]

requires:
  - phase: 09-01
    provides: Research log parser generating 36 per-company career guides
  - phase: 09-02
    provides: 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo)
provides:
  - Updated background.js with 45 career guide imports in correct priority order
  - Audited and improved 4 existing career guides (generic, indeed, glassdoor, builtin)
  - Fully functional site guide registry with all career guides loaded
affects: [10-single-site-automation, 11-multi-site-orchestration]

tech-stack:
  added: []
  patterns: [import-ordering-by-priority, ats-before-company-before-fallback]

key-files:
  created: []
  modified:
    - background.js
    - site-guides/career/generic.js
    - site-guides/career/indeed.js
    - site-guides/career/glassdoor.js
    - site-guides/career/builtin.js

key-decisions:
  - "Import order: ATS bases -> third-party boards -> company guides (alpha) -> generic.js (last)"
  - "generic.js confidence set to MEDIUM (fallback, not targeted)"
  - "Workday-specific content removed from generic.js -- now references dedicated workday.js"
  - "All 4 existing guides converted to machine-optimized minimal format (no JSDoc headers)"

patterns-established:
  - "Career guide import priority: ATS base -> boards -> company -> generic fallback"
  - "All career guides include confidence, ats, careerUrl, resultsContainer, pagination fields"

duration: 3min
completed: 2026-02-23
---

# Phase 9 Plan 03: Career Guide Integration Summary

**45 career guide imports wired into background.js with priority ordering (ATS first, generic last), plus 4 existing guides audited to new quality bar with confidence/ats/careerUrl fields**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T10:55:26Z
- **Completed:** 2026-02-23T10:58:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Ran research log parser -- 36 company guides generated (30 HIGH, 1 MEDIUM, 5 LOW confidence)
- Updated background.js career import block from 4 lines to 49 lines with correct priority ordering
- Import order ensures ATS base guides register first, then boards, then company-specific, then generic fallback last
- Audited generic.js: removed Workday-specific content, set MEDIUM confidence, added resultsContainer/pagination selectors
- Audited indeed.js, glassdoor.js, builtin.js: added confidence HIGH, ats null, careerUrl, datePosted, resultsContainer, pagination
- Converted all 4 existing guides to machine-optimized minimal format (removed JSDoc headers, condensed guidance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Run parser and update background.js imports** - `0e6563a` (feat)
2. **Task 2: Audit and improve existing 4 career guides** - `25adbfd` (feat)

## Files Created/Modified
- `background.js` - Added 45 career guide importScripts in correct priority order
- `site-guides/career/generic.js` - MEDIUM confidence fallback, removed Workday content, added pagination/resultsContainer
- `site-guides/career/indeed.js` - HIGH confidence, added careerUrl/ats/resultsContainer/pagination
- `site-guides/career/glassdoor.js` - HIGH confidence, added careerUrl/ats/datePosted/resultsContainer/pagination
- `site-guides/career/builtin.js` - HIGH confidence, added careerUrl/ats/datePosted/resultsContainer/pagination

## Decisions Made
- Import priority: ATS base guides first (Workday/Greenhouse/Lever/iCIMS/Taleo), then third-party boards (Indeed/Glassdoor/BuiltIn), then 36 company guides alphabetically, then generic.js last
- generic.js set to MEDIUM confidence since it is a broad fallback, not a targeted guide
- Workday-specific inline guidance removed from generic.js -- now handled by dedicated workday.js
- datePosted selector added to glassdoor.js and builtin.js (missing from original versions)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- All 45 career guides loaded and registered in correct priority order
- Site guide registry fully populated for career category
- Ready for Phase 10 (single-site automation) to use guides for live navigation
- Blocker resolved: generic.js overlapping patterns no longer shadow company-specific guides due to import ordering

## Self-Check: PASSED

---
*Phase: 09-data-pipeline-foundation*
*Completed: 2026-02-23*
