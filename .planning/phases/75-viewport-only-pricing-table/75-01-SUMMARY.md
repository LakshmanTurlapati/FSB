---
phase: 75-viewport-only-pricing-table
plan: 01
subsystem: site-guides
tags: [pricing-table, viewport-scroll, deduplication, notion, saas, dom-extraction]

# Dependency graph
requires:
  - phase: 68-paginated-search-scraping
    provides: Amazon site guide with ASIN-based deduplication pattern (referenced for format)
provides:
  - SaaS pricing table site guide with viewport-scroll extraction workflow
  - extractPricingTableRows workflow for SCROLL-09 edge case
  - Generic pricing table selectors applicable across SaaS sites
  - background.js wiring for pricing-table.js
affects: [75-02-live-mcp-test, scroll-edge-cases]

# Tech tracking
tech-stack:
  added: []
  patterns: [viewport-scroll-read-deduplicate cycle, feature-name-keyed deduplication]

key-files:
  created: [site-guides/productivity/pricing-table.js]
  modified: [background.js]

key-decisions:
  - "Feature name text as unique deduplication key for pricing table rows"
  - "400-600px scroll increments to avoid skipping rows in viewport-gated tables"
  - "Notion pricing page as primary target, Airtable pricing as fallback"
  - "2 consecutive empty scrolls as extraction completion signal"

patterns-established:
  - "Scroll-read-deduplicate cycle: scroll small increments, wait for DOM stable, read new rows, deduplicate by text key"
  - "Generic + site-specific selector layers in a single site guide"

requirements-completed: [SCROLL-09]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 75 Plan 01: Viewport-Only Pricing Table Summary

**SaaS pricing table site guide with 15-step scroll-read-deduplicate extraction workflow, 18+ selectors, and Notion/Airtable targeting for SCROLL-09**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T21:48:54Z
- **Completed:** 2026-03-21T21:51:07Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Created pricing-table.js site guide with extractPricingTableRows workflow (15 steps covering navigation, table detection, header extraction, viewport scroll loop, row reading, deduplication, and data assembly)
- Documented SaaS pricing table DOM structure: HTML tables, CSS grids, role=grid, feature rows, plan column headers, checkmark/value cells, sticky headers, billing toggles
- Included 18+ selectors: generic table patterns (pricingTableContainer, featureRow, featureNameCell, planColumnHeader, billingToggle, categoryHeader, checkmarkIndicator, crossIndicator, stickyHeader) plus Notion-specific selectors
- Wired pricing-table.js into background.js Productivity section via importScripts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pricing-table.js site guide** - `6bdf4e1` (feat)
2. **Task 2: Wire pricing-table.js import into background.js** - `350380a` (feat)

## Files Created/Modified
- `site-guides/productivity/pricing-table.js` - SaaS pricing table site guide with viewport-scroll extraction workflow, 6 URL patterns, 18+ selectors, 2 workflows, 8 warnings, tool preferences
- `background.js` - Added importScripts for pricing-table.js in Productivity section after pdf-viewer.js

## Decisions Made
- Feature name text as unique deduplication key -- feature names are more stable than row indices or CSS selectors across scroll cycles
- 400-600px scroll increments -- smaller than typical page scroll to avoid skipping rows in densely packed pricing tables
- Notion as primary target with Airtable fallback -- Notion has the most comprehensive feature comparison table among SaaS pricing pages
- 2 consecutive empty scrolls as completion signal -- single empty scroll could be a false negative from slow lazy-load rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all selectors and workflows are fully specified with cross-site patterns.

## Next Phase Readiness
- Site guide created and wired, ready for Plan 02 live MCP test
- extractPricingTableRows workflow provides step-by-step instructions for the live test
- Notion pricing page (notion.so/pricing) is the primary test target

## Self-Check: PASSED

All artifacts verified:
- site-guides/productivity/pricing-table.js: FOUND
- .planning/phases/75-viewport-only-pricing-table/75-01-SUMMARY.md: FOUND
- Commit 6bdf4e1: FOUND
- Commit 350380a: FOUND
- pricing-table.js import in background.js: FOUND

---
*Phase: 75-viewport-only-pricing-table*
*Completed: 2026-03-21*
