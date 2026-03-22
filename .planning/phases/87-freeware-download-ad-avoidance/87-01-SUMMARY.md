---
phase: 87-freeware-download-ad-avoidance
plan: 01
subsystem: site-guides
tags: [dark-patterns, ad-detection, freeware, sourceforge, filehippo, download, dom-analysis]

# Dependency graph
requires:
  - phase: 86-session-expiry
    provides: Utilities site guide category and session-expiry.js structure reference
provides:
  - freeware-download.js site guide with downloadRealFile workflow and DARK-01 ad avoidance guidance
  - 8 ad detection heuristics for DOM-based fake download button identification
  - Selectors for SourceForge, FileHippo, FossHub, MajorGeeks freeware sites
affects: [87-02 live MCP test, future dark pattern edge cases]

# Tech tracking
tech-stack:
  added: []
  patterns: [elimination-based ad detection, href domain verification before click, iframe ancestry check]

key-files:
  created: [site-guides/utilities/freeware-download.js]
  modified: [background.js]

key-decisions:
  - "Elimination strategy for real download identification: exclude all fake ad buttons via 8 heuristics, then verify remaining candidate"
  - "8 ad detection indicators prioritized by speed: iframe first, then href domain, then parent containers, then data-ad attributes, then aria/title"
  - "5 freeware site targets: SourceForge primary, FileHippo secondary, FossHub/MajorGeeks/Ninite fallbacks"

patterns-established:
  - "Elimination-based link identification: exclude fakes first, verify remainder before click"
  - "Multi-indicator ad detection with 8 DOM-based heuristics for fake button discrimination"

requirements-completed: [DARK-01]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 87 Plan 01: Freeware Download Ad Avoidance Summary

**Freeware download site guide with 12-step downloadRealFile workflow, 8 ad detection heuristics, and elimination-based real link identification for DARK-01 dark pattern avoidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T08:31:26Z
- **Completed:** 2026-03-22T08:33:46Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created freeware-download.js site guide with comprehensive DARK-01 dark pattern context explaining fake download button monetization
- Documented 8 ad detection heuristics: ad network domains, iframe wrappers, ad-related CSS classes, data-ad-* attributes, tracking redirect URLs, external domain mismatch, aria/title labels, parent container markers
- Built 12-step downloadRealFile workflow covering navigate, snapshot, iframe check, href domain check, parent containers, data attributes, aria/title, identify real link, verify before click, click, verify download, report
- Added selectors for SourceForge (real download button, project title, file list, ad iframes, ad containers), FileHippo, FossHub, MajorGeeks, plus adNetworkDomains and fakeButtonIndicators selector groups
- Registered importScripts entry in background.js Utilities section after session-expiry.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create freeware-download.js site guide with downloadRealFile workflow and DARK-01 guidance** - `a0d43c4` (feat)

## Files Created/Modified
- `site-guides/utilities/freeware-download.js` - Freeware download ad avoidance site guide with registerSiteGuide call, DARK-01 guidance, 8 heuristics, 12-step workflow, selectors, 5 warnings, toolPreferences
- `background.js` - Added importScripts entry for freeware-download.js in Utilities section (line 187)

## Decisions Made
- Elimination strategy for real download identification: exclude all fake ad buttons via 8 heuristics, then verify remaining candidate before clicking
- 8 ad detection indicators ordered by detection speed: iframe ancestry (fastest), href domain, parent container classes, data-ad-* attributes, tracking redirect URLs, external domain mismatch, aria/title labels, parent container markers
- 5 freeware site targets: SourceForge as primary (most ads, most commonly used), FileHippo secondary, FossHub/MajorGeeks/Ninite as fallbacks with decreasing ad complexity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all selectors, heuristics, workflows, and warnings fully documented as specified.

## Next Phase Readiness
- Site guide ready for Plan 02 live MCP test on SourceForge or FileHippo
- downloadRealFile workflow provides step-by-step elimination process for the AI to follow
- All 8 ad detection heuristics documented with specific DOM attributes and patterns to check

## Self-Check: PASSED

- FOUND: site-guides/utilities/freeware-download.js
- FOUND: .planning/phases/87-freeware-download-ad-avoidance/87-01-SUMMARY.md
- FOUND: a0d43c4 (Task 1 commit)

---
*Phase: 87-freeware-download-ad-avoidance*
*Completed: 2026-03-22*
