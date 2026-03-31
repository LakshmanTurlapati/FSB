---
phase: 128-viewport-aware-interaction
plan: 01
subsystem: interaction
tags: [scroll, viewport, fixed-header, sticky, click, hover, elementFromPoint]

requires:
  - phase: none
    provides: "standalone enhancement to existing accessibility pipeline"
provides:
  - "getStickyHeaderHeight helper for detecting fixed/sticky top-anchored headers"
  - "header-compensated scrollIntoViewIfNeeded that clears fixed headers after scroll"
  - "fixed-header obstruction detection in checkElementReceivesEvents"
  - "up-to-2-retry header-clearing scroll in ensureElementReady"
  - "header-aware viewport check in performQuickReadinessCheck"
affects: [content-actions, mcp-tools, automation-loop]

tech-stack:
  added: []
  patterns: ["fixed/sticky header detection via getComputedStyle + getBoundingClientRect", "obstruction recovery retry loop in readiness pipeline"]

key-files:
  created: []
  modified: ["content/accessibility.js"]

key-decisions:
  - "getStickyHeaderHeight queries 7 selectors (header, nav, role=banner, class*=header/navbar/topbar/app-bar) and filters by position fixed/sticky + top < 10px"
  - "Post-scroll header compensation uses window.scrollBy with negative offset to push element below header"
  - "checkElementReceivesEvents marks obscuredByFixedHeader but does not scroll (sync function) -- retry logic lives in async ensureElementReady"
  - "performQuickReadinessCheck uses getStickyHeaderHeight to prevent false fast-path approval for elements behind headers"

patterns-established:
  - "Fixed-header detection pattern: query common selectors, filter by computed position + top offset"
  - "Obstruction recovery pattern: flag in sync check, retry with scroll in async pipeline"

requirements-completed: [INTR-01, INTR-02, INTR-04]

duration: 2min
completed: 2026-03-31
---

# Phase 128 Plan 01: Viewport-Aware Interaction Summary

**Header-aware scroll pipeline with fixed/sticky detection, post-scroll compensation, obstruction recovery retries, and accurate fast-path viewport checks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T12:16:57Z
- **Completed:** 2026-03-31T12:19:45Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Elements behind fixed/sticky headers are now detected as needing scroll, not falsely treated as "fully visible"
- After scrollIntoView, header height is measured and compensated so clicks land on the target, not the header
- ensureElementReady retries scroll up to 2 times when obstruction is from a fixed/sticky element, with actionable error messages on failure
- performQuickReadinessCheck prevents false fast-path approval for elements behind headers

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getStickyHeaderHeight helper and enhance scrollIntoViewIfNeeded** - `dfef363` (feat)
2. **Task 2: Enhance checkElementReceivesEvents with obstruction recovery** - `0cc3343` (feat)

## Files Created/Modified
- `content/accessibility.js` - Added getStickyHeaderHeight helper, enhanced scrollIntoViewIfNeeded with header compensation, enhanced checkElementReceivesEvents with fixed-header detection, enhanced ensureElementReady with retry logic, enhanced performQuickReadinessCheck with header-aware viewport check, exported getStickyHeaderHeight on FSB namespace

## Decisions Made
- getStickyHeaderHeight queries 7 CSS selectors covering common header/nav patterns and filters by `position: fixed|sticky` plus `rect.top < 10` to exclude sticky footers/sidebars
- Post-scroll compensation scrolls page upward (negative scrollBy) to push element below the header with 16px breathing room
- checkElementReceivesEvents detects obstruction source via getComputedStyle + ancestor walk but does not scroll (sync function) -- sets `obscuredByFixedHeader` flag for the async ensureElementReady to handle
- performQuickReadinessCheck uses getStickyHeaderHeight in its inViewport check to prevent false fast-path approval

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Viewport-aware interaction pipeline is complete
- Improvements propagate automatically through smartEnsureReady to all click/hover/type actions in actions.js
- No changes needed in actions.js or any consumer

## Self-Check: PASSED

- content/accessibility.js: FOUND
- 128-01-SUMMARY.md: FOUND
- Commit dfef363: FOUND
- Commit 0cc3343: FOUND

---
*Phase: 128-viewport-aware-interaction*
*Completed: 2026-03-31*
