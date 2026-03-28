---
phase: 27-site-explorer-markdown-snapshot-integration
plan: 01
subsystem: ui
tags: [site-explorer, markdown-snapshot, guide-selectors, research-view]

requires:
  - phase: 26-sheets-snapshot-diagnostic
    provides: guideSelectors threading and getMarkdownSnapshot handler
provides:
  - Markdown snapshot capture in site explorer collectPageData
  - Per-page snapshot display in research detail view with guide name badge
  - Collapsible pre block for snapshot text with dark theme styling
affects: [site-explorer, research-view]

tech-stack:
  added: []
  patterns: [frameId:0 direct chrome.tabs.sendMessage for main-frame targeting]

key-files:
  created: []
  modified:
    - utils/site-explorer.js
    - ui/options.js

key-decisions:
  - "Direct chrome.tabs.sendMessage with frameId:0 instead of sendTabMessage wrapper for main-frame targeting"
  - "Guide resolution via typeof check for getGuideForTask availability in service worker context"

patterns-established:
  - "frameId:0 pattern for getMarkdownSnapshot calls outside background.js"

requirements-completed: [P27-01, P27-02, P27-03, P27-04]

duration: 1min
completed: 2026-03-11
---

# Phase 27 Plan 01: Site Explorer Markdown Snapshot Integration Summary

**Markdown snapshot capture in site explorer with per-page collapsible display, guide name badges, and snapshot stats in research detail view**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-11T07:11:58Z
- **Completed:** 2026-03-11T07:13:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- collectPageData fetches getMarkdownSnapshot with guide selector threading via getGuideForTask
- Research detail view shows per-page guide name, markdown stats, and collapsible snapshot pre block
- Pages without snapshot display "Snapshot unavailable" warning in amber
- Downloaded research JSON automatically includes markdownSnapshot per page

## Task Commits

Each task was committed atomically:

1. **Task 1: Add markdown snapshot capture to collectPageData** - `8dafa8c` (feat)
2. **Task 2: Render per-page markdown snapshot in research detail view** - `c472bbc` (feat)

## Files Created/Modified
- `utils/site-explorer.js` - Added getMarkdownSnapshot fetch with guide resolution, frameId:0, and pageData fields
- `ui/options.js` - Expanded per-page research detail with guide badge, stats line, and collapsible snapshot

## Decisions Made
- Used direct chrome.tabs.sendMessage with { frameId: 0 } instead of sendTabMessage wrapper, matching how background.js calls getMarkdownSnapshot
- Added typeof guard for getGuideForTask to handle cases where site-guides may not be loaded

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Markdown snapshot integration complete for site explorer diagnostic use
- Ready for manual verification: crawl any page and check research detail for snapshot display

---
*Phase: 27-site-explorer-markdown-snapshot-integration*
*Completed: 2026-03-11*
