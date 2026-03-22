---
phase: 92-misleading-premium-highlighting
plan: 01
subsystem: site-guides
tags: [dark-patterns, flight-booking, price-comparison, dom-analysis, airline, DARK-06]

# Dependency graph
requires:
  - phase: 87-fake-download-buttons
    provides: DARK-01 freeware-download.js Utilities site guide structure pattern
  - phase: 91-adblocker-detection-bypass
    provides: DARK-05 adblocker-bypass.js as last Utilities import before premium-highlighting
provides:
  - selectCheapestFlight workflow for numeric price-based flight selection ignoring visual misdirection
  - DARK-06 guidance documenting 7 misleading premium highlighting techniques
  - Airline site result DOM patterns for Google Flights, Kayak, Southwest, United, Expedia
  - Selectors for result containers, price elements, fare class labels, premium indicators
affects: [92-02-live-mcp-test, future-dark-pattern-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [numeric-price-comparison-from-dom-text, visual-misdirection-counter-strategy, multi-site-fare-extraction]

key-files:
  created: [site-guides/utilities/premium-highlighting.js]
  modified: [background.js]

key-decisions:
  - "Numeric price comparison as sole selection criterion -- all visual styling (color, size, badges, position, pre-selection) explicitly ignored"
  - "Documented 7 misleading highlighting techniques with per-technique DOM-based counter-strategies"
  - "Aggregator vs airline direct site distinction -- one-price-per-row vs multi-tier-per-row extraction strategies"

patterns-established:
  - "Price extraction pipeline: get_dom_snapshot -> get_text -> strip currency -> parse float -> find minimum -> click element"
  - "Visual misdirection counter: document dark pattern technique, then document DOM-only counter that ignores the visual trick"

requirements-completed: [DARK-06]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 92 Plan 01: Premium Highlighting Avoidance Summary

**DARK-06 site guide with selectCheapestFlight 8-step workflow using numeric price comparison to defeat 7 misleading premium highlighting techniques across 5 airline sites**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T10:17:58Z
- **Completed:** 2026-03-22T10:20:36Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created premium-highlighting.js site guide with DARK-06 dark pattern avoidance guidance documenting 7 misleading highlighting techniques
- Implemented selectCheapestFlight 8-step workflow: navigate to results, identify structure, extract all prices, ignore visual cues, parse and compare numerically, click cheapest, handle pre-selection override, verify selection
- Documented airline site result DOM patterns for Google Flights (.pIav2d, .YMlIz), Kayak (.nrc6-inner, .f8F1-price-text), Southwest (.fare-button, Wanna Get Away/Anytime/Business Select), United (.app-components-ResultsContainer), and Expedia ([data-test-id="offer-listing"])
- Added 5 targeted warnings about ignoring visual styling, never trusting badges, extracting every price, comparing across fare columns, and overriding pre-selections
- Registered importScripts in background.js Utilities section after adblocker-bypass.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create premium-highlighting.js site guide with selectCheapestFlight workflow and DARK-06 guidance** - `769046b` (feat)

## Files Created/Modified
- `site-guides/utilities/premium-highlighting.js` - DARK-06 site guide with registerSiteGuide call, 21 URL patterns, guidance with 7 technique documentation, price-based selection strategy, airline DOM patterns, selectors, 8-step workflow, 5 warnings, 6 tool preferences
- `background.js` - Added importScripts entry for premium-highlighting.js in Utilities section after adblocker-bypass.js

## Decisions Made
- Numeric price comparison as sole selection criterion -- explicitly documented that all visual styling (color, font size, borders, badges, position, pre-selection state) must be ignored in favor of raw DOM text price extraction
- Documented 7 misleading highlighting techniques (color emphasis, size scaling, badge manipulation, position manipulation, default pre-selection, hidden total pricing, fare class obfuscation) with per-technique counter-strategies
- Aggregator vs airline direct site distinction: aggregators show one price per row (compare across rows), airline direct sites show multiple fare tiers per row (compare across rows AND columns)
- 5-step price-based selection pipeline: extract all prices, parse to numeric, compare and identify minimum, click cheapest, verify selection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- premium-highlighting.js ready for Plan 02 live MCP test
- selectCheapestFlight workflow documents full navigate-extract-parse-compare-click-verify cycle
- Selectors documented for 5 major airline/aggregator sites plus generic fallback patterns
- Background.js registration complete

## Self-Check: PASSED

- FOUND: site-guides/utilities/premium-highlighting.js
- FOUND: .planning/phases/92-misleading-premium-highlighting/92-01-SUMMARY.md
- FOUND: commit 769046b
- FOUND: premium-highlighting in background.js

---
*Phase: 92-misleading-premium-highlighting*
*Completed: 2026-03-22*
