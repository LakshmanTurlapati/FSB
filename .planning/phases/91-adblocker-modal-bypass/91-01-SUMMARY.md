---
phase: 91-adblocker-modal-bypass
plan: 01
subsystem: site-guides
tags: [dark-patterns, adblocker, dom-manipulation, css-override, modal-bypass, DARK-05]

# Dependency graph
requires:
  - phase: 90-camouflaged-close
    provides: "DARK-04 camouflaged close button site guide pattern and Utilities category structure"
provides:
  - "adblocker-bypass.js site guide with bypassAdblockerModal workflow for DARK-05 modals with no close button"
  - "DARK-05 guidance documenting adblocker detection methods, DOM removal, CSS override, and re-detection handling"
affects: [91-02-live-mcp-test, dark-pattern-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [DOM removal bypass, CSS override with !important injection, MutationObserver re-detection neutralization, bait element detection identification]

key-files:
  created: [site-guides/utilities/adblocker-bypass.js]
  modified: [background.js]

key-decisions:
  - "DOM removal as primary bypass strategy with CSS override as MutationObserver-resistant alternative"
  - "4 detection library patterns documented: BlockAdBlock, FuckAdBlock, Admiral, custom bait-div"
  - "DARK-05 vs DARK-04 distinction: no close button at all vs camouflaged close button present in DOM"

patterns-established:
  - "Multi-strategy bypass pattern: DOM removal -> CSS override -> fallback chain for dark pattern modals"
  - "Detection method identification before bypass to predict re-detection behavior"

requirements-completed: [DARK-05]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 91 Plan 01: Adblocker Modal Bypass Site Guide Summary

**DARK-05 adblocker modal bypass site guide with 8-step bypassAdblockerModal workflow, DOM removal and CSS override strategies, 4 detection library patterns, and MutationObserver re-detection handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T09:57:14Z
- **Completed:** 2026-03-22T10:00:26Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created adblocker-bypass.js site guide with comprehensive DARK-05 dark pattern avoidance guidance
- Documented 4 adblocker detection methods (bait element, script load, ad request, DOM measurement) and 4 detection libraries (BlockAdBlock, FuckAdBlock, Admiral, custom bait-div)
- Implemented bypassAdblockerModal 8-step workflow: detect modal, identify detection method, confirm no close button, DOM removal, restore interactivity, check re-detection, verify bypass, fallback
- Documented CSS override bypass as MutationObserver-resistant alternative to DOM removal
- Added importScripts registration in background.js Utilities section

## Task Commits

Each task was committed atomically:

1. **Task 1: Create adblocker-bypass.js site guide with bypassAdblockerModal workflow and DARK-05 guidance** - `3d9c1ce` (feat)

## Files Created/Modified
- `site-guides/utilities/adblocker-bypass.js` - DARK-05 adblocker modal bypass site guide with full workflow, selectors, warnings, and tool preferences
- `background.js` - Added importScripts entry for adblocker-bypass.js in Utilities section (line 191, after camouflaged-close.js)

## Decisions Made
- DOM removal as primary bypass strategy (element.remove() or display:none) with CSS override as MutationObserver-resistant alternative (!important injection via style tag)
- 4 detection library patterns documented with specific selectors and detection variables for each: BlockAdBlock (#blockadblock, window.blockAdBlock), FuckAdBlock (window.fuckAdBlock), Admiral (iframe/shadow DOM), custom bait-div (site-specific)
- DARK-05 vs DARK-04 distinction explicitly documented: Step 3 of workflow checks for close buttons and redirects to camouflaged-close.js if any found
- 5 fallback strategies ordered by invasiveness: Escape key, Google Cache, URL parameter, Reader Mode, behind-overlay content extraction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- adblocker-bypass.js site guide ready for Plan 02 live MCP test
- bypassAdblockerModal workflow testable against any site with adblocker detection modal
- Requires finding a target site with adblocker detection that triggers a no-close-button modal

---
*Phase: 91-adblocker-modal-bypass*
*Completed: 2026-03-22*
