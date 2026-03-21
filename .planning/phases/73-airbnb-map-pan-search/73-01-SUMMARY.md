---
phase: 73-airbnb-map-pan-search
plan: 01
subsystem: site-guides
tags: [airbnb, map-pan, cdp-drag, listing-pins, google-maps, mapbox, site-guide]

# Dependency graph
requires:
  - phase: 49-google-maps-path-tracing
    provides: CDP drag panning pattern for map canvas interaction
provides:
  - Updated Airbnb site guide with panMapForListings workflow for SCROLL-07
  - Map DOM structure documentation (canvas + DOM pin overlays with data-testid selectors)
  - 9 new selectors for map container, canvas, listing pins, price labels, toggle, cookie banner
  - CDP drag panning strategy with step count and delay parameters
affects: [73-02-PLAN, airbnb-map-interaction, scroll-edge-cases]

# Tech tracking
tech-stack:
  added: []
  patterns: [cdp-drag-map-pan, pin-count-verification, search-as-you-move-toggle]

key-files:
  created: []
  modified: [site-guides/travel/airbnb.js]

key-decisions:
  - "Adapted Google Maps CDP drag panning pattern for Airbnb map with adjusted wait times (2000-3000ms vs Google Maps tile loading)"
  - "Used data-testid selectors (map/markers/BasePillMarker) over CSS class selectors for pin detection stability"
  - "Documented both search-as-you-move toggle and manual Search this area button as fallback paths"

patterns-established:
  - "Pin count comparison before/after pan as primary verification strategy"
  - "300-500px minimum pan distance to trigger Airbnb viewport listing refresh"

requirements-completed: [SCROLL-07]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 73 Plan 01: Airbnb Map Pan Site Guide Summary

**Airbnb site guide updated with 11-step panMapForListings workflow, 9 map selectors, CDP drag panning strategy, and pin-count verification for SCROLL-07 edge case**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T21:10:43Z
- **Completed:** 2026-03-21T21:12:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added panMapForListings workflow with 11-step navigate-pan-wait-verify cycle covering the full map interaction flow
- Added 9 new selectors (mapContainer, mapCanvas, listingPin, pinPriceLabel, searchAsMapMoves, searchThisArea, cookieBanner, cookieAccept, resultsCount) while preserving all 7 existing selectors
- Documented Airbnb map DOM structure: Google Maps/Mapbox canvas for tiles with DOM listing pin overlays (price badges) positioned absolutely over the canvas
- Documented CDP drag panning strategy adapted from Google Maps (steps=20, stepDelayMs=25) with 2000-3000ms post-pan wait for Airbnb API response
- Added 6 new warnings about CDP trusted events, pin rendering delays, data-testid preference, and map canvas offset
- Updated toolPreferences with 5 new tools: drag, click_at, wait_for_stable, read_page, get_dom_snapshot

## Task Commits

Each task was committed atomically:

1. **Task 1: Update airbnb.js site guide with map pan workflow, map selectors, and listing pin detection** - `87e7a19` (feat)

## Files Created/Modified
- `site-guides/travel/airbnb.js` - Updated Airbnb site guide with map pan workflow, map selectors, listing pin detection, cookie dismissal, search-as-you-move toggle, and verification strategy

## Decisions Made
- Adapted Google Maps CDP drag panning pattern for Airbnb map with adjusted wait times (2000-3000ms vs Google Maps tile loading) -- Airbnb API response + pin rendering is slower than map tile loading
- Used data-testid selectors (map/markers/BasePillMarker) over CSS class selectors for pin detection -- Airbnb uses hashed/dynamic CSS classes that change between deployments
- Documented both search-as-you-move toggle (auto-refresh on pan) and manual "Search this area" button as fallback -- covers both enabled and disabled toggle states

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Airbnb site guide now has complete map interaction documentation for Plan 02 live MCP test
- panMapForListings workflow provides step-by-step guidance for the MCP manual tools test
- All selectors are research-based (data-testid patterns from Airbnb's React codebase) -- to be validated in Plan 02 live browser test
- Ready for Plan 02: live MCP execution of map pan with listing pin verification

## Self-Check: PASSED

- FOUND: site-guides/travel/airbnb.js
- FOUND: .planning/phases/73-airbnb-map-pan-search/73-01-SUMMARY.md
- FOUND: commit 87e7a19

---
*Phase: 73-airbnb-map-pan-search*
*Completed: 2026-03-21*
