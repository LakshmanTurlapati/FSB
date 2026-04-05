---
phase: 131-site-aware-search
plan: 01
subsystem: actions
tags: [dom-heuristics, search, mcp, content-script, site-search]

# Dependency graph
requires:
  - phase: none
    provides: existing searchGoogle tool and FSB namespace
provides:
  - detectSiteSearchInput -- 5-tier DOM heuristic cascade for finding site search inputs
  - tools.siteSearch -- site-aware search with Google fallback
  - MCP search verb routing to siteSearch
affects: [autopilot-prompts, site-guides]

# Tech tracking
tech-stack:
  added: []
  patterns: [tiered-selector-cascade-with-visibility-filtering]

key-files:
  created:
    - tests/site-search.test.js
  modified:
    - content/actions.js
    - mcp-server/src/tools/manual.ts

key-decisions:
  - "5-tier selector cascade order: type=search > role=search > name=q > placeholder/aria-label > form[action*=search]"
  - "Visibility filter: offsetParent check with position:fixed/sticky exception, viewport preference for tie-breaking"
  - "Submit strategy: Enter keydown/keyup first, then submit button fallback via form.querySelector, then form.submit() last resort"
  - "Error recovery: catch block in siteSearch falls back to searchGoogle to guarantee search always works"

patterns-established:
  - "Tiered selector cascade: try selectors in priority order, filter by visibility, prefer viewport-visible"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03, SRCH-04]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 131 Plan 01: Site-Aware Search Summary

**5-tier DOM heuristic cascade detecting site search inputs (type=search, role=search, name=q, placeholder, form action) with visibility filtering and Google fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T12:51:48Z
- **Completed:** 2026-03-31T12:54:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- detectSiteSearchInput implements 5-tier selector cascade with visibility and viewport filtering -- no AI calls
- tools.siteSearch types query into site search input, submits via Enter with submit button fallback, returns site-search or google-fallback method
- MCP search tool routes to siteSearch verb so all AI callers automatically use site-native search

## Task Commits

Each task was committed atomically:

1. **Task 1: Add detectSiteSearchInput and tools.siteSearch** - `aa570a3` (test: RED) -> `bb5c014` (feat: GREEN)
2. **Task 2: Route MCP search tool to siteSearch verb** - `14a725c` (feat)

## Files Created/Modified
- `tests/site-search.test.js` - 6 test cases for detection tiers, visibility filtering, siteSearch success/fallback
- `content/actions.js` - Added detectSiteSearchInput helper (5-tier cascade) and tools.siteSearch (site-aware search with fallback)
- `mcp-server/src/tools/manual.ts` - Changed search tool verb from searchGoogle to siteSearch, updated description

## Decisions Made
- 5-tier selector cascade prioritizes type=search (most explicit) down to form[action*=search] (most general)
- Visibility check uses offsetParent with position:fixed/sticky exception to avoid hiding fixed search bars
- Submit uses Enter keydown+keyup first (matches pressEnter pattern), then submit button fallback via querySelector, then form.submit() as last resort
- Error catch in siteSearch always falls back to searchGoogle so search never fails silently

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Site-aware search is wired end-to-end: MCP search -> siteSearch verb -> content script -> detectSiteSearchInput -> type+submit or Google fallback
- searchGoogle remains untouched as the fallback path
- Ready for manual testing on Amazon, YouTube, GitHub to validate real-world detection

## Self-Check: PASSED

All 3 files confirmed present. All 3 commit hashes (aa570a3, bb5c014, 14a725c) confirmed in git log.

---
*Phase: 131-site-aware-search*
*Completed: 2026-03-31*
