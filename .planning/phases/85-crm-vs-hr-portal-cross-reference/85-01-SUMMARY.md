---
phase: 85-crm-vs-hr-portal-cross-reference
plan: 01
subsystem: site-guides
tags: [multi-tab, crm-hr-cross-reference, context-bloat, open_tab, switch_tab, list_tabs, batch-processing, demoqa, herokuapp]

# Dependency graph
requires:
  - phase: 80-multi-tab-flight-price-compare
    provides: multi-tab workflow pattern (open_tab, switch_tab, list_tabs) established in compareFlightsMultiTab
provides:
  - crossReferenceEmployees workflow (12 steps) for multi-tab CRM-to-HR batch cross-reference
  - CONTEXT-09 guidance section with batch processing and context bloat mitigation for 50-name lookups
  - Selectors for DemoQA webtables and The-Internet herokuapp sortable tables
  - 5 fallback demo targets (jsonplaceholder, reqres, dummyjson) for auth-free employee data
affects: [85-02 live MCP test, future multi-tab cross-system automation workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [batch-of-10 extraction for context bloat mitigation, compact per-name result tracking under 3000 chars, multi-tab CRM-HR switching loop]

key-files:
  created: [site-guides/productivity/crm-hr-cross-ref.js]
  modified: [background.js]

key-decisions:
  - "Batch-of-10 extraction pattern: extract 10 names at a time from CRM, cross-reference batch in HR portal, store compact results, then next batch"
  - "Under-3000-character total context budget for 50 names: {name, crmFound, hrFound, match} records at ~60 chars each"
  - "DemoQA webtables as primary CRM target and The-Internet herokuapp as primary HR portal -- both auth-free with employee data tables"

patterns-established:
  - "Multi-tab batch cross-reference: extract batch from source tab, switch to target tab, cross-reference, switch back for next batch"
  - "Context bloat mitigation for large-N lookups: compact per-record tracking, batch processing, no DOM snapshot retention between batches"
  - "Deduplication via lowercase-normalized name Set to prevent duplicate lookups across pagination overlaps"

requirements-completed: [CONTEXT-09]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 85 Plan 01: CRM HR Cross-Reference Site Guide Summary

**crm-hr-cross-ref.js site guide with crossReferenceEmployees 12-step workflow, CONTEXT-09 batch processing guidance for 50-name CRM-to-HR cross-reference, selectors for DemoQA and herokuapp, 5 auth-free fallback targets**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T07:47:24Z
- **Completed:** 2026-03-22T07:49:11Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created crm-hr-cross-ref.js with registerSiteGuide targeting 5 demo sites (demoqa.com, the-internet.herokuapp.com, jsonplaceholder.typicode.com, reqres.in, dummyjson.com)
- Added CONTEXT-09 guidance with cross-reference strategy, context bloat mitigation for 50-name batch processing (10 per batch, under 3000 chars total), skip-auth expectation, and deduplication
- Added crossReferenceEmployees workflow with 12 steps: setup, batch extraction, HR portal tab open, cross-reference, tab switching loop, result compilation, spot-check verification, context tracking, final report
- Added selectors for demoqa webtables (employeeTable, tableRow, firstName, lastName, searchBox, pagination) and herokuapp sortable tables (table1, table2, tableRow, lastName, firstName)
- Added 5 warnings covering batch sizing, compact results, DemoQA pagination, herokuapp static tables, and auth fallback
- Updated background.js with importScripts entry in Productivity section after pricing-table.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create crm-hr-cross-ref.js site guide with crossReferenceEmployees workflow and CONTEXT-09 guidance** - `2e149ac` (feat)

**Plan metadata:** [pending below]

## Files Created/Modified
- `site-guides/productivity/crm-hr-cross-ref.js` - New site guide with registerSiteGuide call, CONTEXT-09 guidance, selectors for 4 target types, crossReferenceEmployees 12-step workflow, 5 warnings, 8 toolPreferences
- `background.js` - Added importScripts entry for crm-hr-cross-ref.js in Productivity section (line 161)

## Decisions Made
- Batch-of-10 extraction pattern: extract 10 names at a time from CRM, cross-reference in HR portal, then next batch -- prevents context bloat from loading all 50 names simultaneously
- Under-3000-character total context budget: {name, crmFound, hrFound, match} records at approximately 60 chars each, 50 names stays well within budget
- DemoQA webtables as primary CRM (paginated employee table) and The-Internet herokuapp as primary HR portal (static sortable tables) -- both fully auth-free

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all content is complete guidance text, selectors, and workflow steps.

## Next Phase Readiness
- crm-hr-cross-ref.js is complete with CONTEXT-09 workflow and guidance
- Ready for Plan 02 live MCP test to validate the multi-tab CRM-to-HR cross-reference sequence
- All 5 demo targets are auth-free and publicly accessible

---
*Phase: 85-crm-vs-hr-portal-cross-reference*
*Completed: 2026-03-22*

## Self-Check: PASSED
- site-guides/productivity/crm-hr-cross-ref.js: FOUND
- 85-01-SUMMARY.md: FOUND
- commit 2e149ac: FOUND
