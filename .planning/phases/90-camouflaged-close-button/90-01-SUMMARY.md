---
phase: 90-camouflaged-close-button
plan: 01
subsystem: site-guides
tags: [dark-patterns, popup, overlay, close-button, dom-analysis, camouflage, DARK-04]

# Dependency graph
requires:
  - phase: 89-shuffled-cancel-flow
    provides: Previous DARK pattern site guide in Utilities category
provides:
  - camouflaged-close.js site guide with closePopupAd workflow and DARK-04 guidance
  - DOM-based close button detection strategy with 3-tier signal ranking
  - 5 ad platform close button DOM patterns
  - 5 fallback dismissal strategies
affects: [90-camouflaged-close-button plan 02 live MCP test]

# Tech tracking
tech-stack:
  added: []
  patterns: [3-tier close button detection (attributes/content/fallback), decoy filtering, delayed appearance handling, iframe close button detection]

key-files:
  created: [site-guides/utilities/camouflaged-close.js]
  modified: [background.js]

key-decisions:
  - "DOM attribute analysis as primary close button detection since AI has no vision"
  - "3-tier detection ranking: Tier 1 attributes (aria-label, data-dismiss, id/class), Tier 2 content (SVG paths, onclick handlers, position), Tier 3 fallback (text content, href patterns, opacity)"
  - "5 fallback dismissal strategies in priority order: Escape key, backdrop click, DOM removal, cookie set, coordinate click"

patterns-established:
  - "DARK-04 dark pattern avoidance: DOM-based close button detection on camouflaged pop-up ad overlays"
  - "Decoy close button filtering: check onclick/href/target before clicking any X element"
  - "Delayed close button rescanning: up to 10 seconds with 2-3 second intervals before fallback"

requirements-completed: [DARK-04]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 90 Plan 01: Camouflaged Close Button Site Guide Summary

**DARK-04 closePopupAd workflow with 3-tier DOM-based close button detection, decoy filtering, iframe handling, and 5 fallback dismissal strategies for camouflaged pop-up ad overlays**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T09:35:09Z
- **Completed:** 2026-03-22T09:38:04Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created camouflaged-close.js site guide with comprehensive DARK-04 guidance documenting 8 close button camouflage techniques (color matching, low opacity, tiny hit target, off-boundary positioning, delayed appearance, countdown timer, decoy button, iframe nesting)
- Implemented 3-tier DOM-based close button detection strategy: Tier 1 attributes (aria-label, data-dismiss, id/class), Tier 2 content (SVG paths, onclick handlers, small elements, absolute positioning), Tier 3 fallback (text content, href patterns, low opacity)
- Documented 5 ad platform close button DOM patterns: Google Ad Manager, AdSense, Taboola/Outbrain native ads, newsletter modals (OptinMonster/Sumo/Privy), video pre-roll overlays
- Created 8-step closePopupAd workflow: detect overlay, scan by attributes, scan by content, filter decoys, check iframe, click close, verify dismissal, fallback and report
- Added background.js importScripts entry for camouflaged-close.js in Utilities section

## Task Commits

Each task was committed atomically:

1. **Task 1: Create camouflaged-close.js site guide with closePopupAd workflow and DARK-04 guidance** - `2268524` (feat)

## Files Created/Modified
- `site-guides/utilities/camouflaged-close.js` - DARK-04 site guide with closePopupAd workflow, 3-tier detection, selectors, 5 warnings, 7 tool preferences
- `background.js` - Added importScripts entry for camouflaged-close.js after shuffled-cancel.js in Utilities section

## Decisions Made
- DOM attribute analysis as primary close button detection since AI has no vision -- even invisible close buttons are present in DOM with identifiable attributes
- 3-tier detection ranking by confidence: attributes (highest) > content/position (medium) > text/href/opacity (lowest)
- 5 fallback strategies ordered by invasiveness: Escape (least) > backdrop click > DOM removal > cookie set > coordinate click (most)
- Decoy detection before clicking: check onclick/href/target attributes to avoid fake X buttons that open ads

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Site guide ready for Plan 02 live MCP test
- closePopupAd workflow documents full detect-scan-filter-click-verify cycle
- All selectors and detection strategies ready for validation against real pop-up ad overlays

---
*Phase: 90-camouflaged-close-button*
*Completed: 2026-03-22*
