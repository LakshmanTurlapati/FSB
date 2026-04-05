---
phase: 126-content-extraction-reliability
plan: 02
subsystem: content-extraction
tags: [dom-stability, mcp, read-page, spa-support, auto-retry]

requires:
  - phase: 126-01
    provides: findMainContentRoot, maxChars-aware extractPageText, fixed full flag passthrough
provides:
  - Quick-extract-then-retry-if-sparse pattern in readPage handler
  - Automatic DOM stability wait for JS-heavy SPA pages returning sparse content
  - stabilityWaited response flag for MCP caller visibility
affects: [content-extraction-reliability, mcp-tools]

tech-stack:
  added: []
  patterns:
    - "Quick-extract-then-retry: extract first, wait only if sparse (<200 chars on non-trivial DOM)"
    - "Non-fatal stability wait with try/catch -- failures never block response"

key-files:
  created: []
  modified:
    - content/messaging.js

key-decisions:
  - "Sparse threshold 200 chars per D-02 -- matches audit data (Airbnb=0, Booking=173, Kayak=233)"
  - "3s max stability wait per D-03 -- balances SPA hydration time vs MCP caller responsiveness"
  - "Guard childElementCount > 5 prevents waiting on genuinely empty pages like about:blank"
  - "stableTime 300ms and networkQuietTime 200ms (below defaults) for faster response"

patterns-established:
  - "Quick-extract-then-retry-if-sparse: try immediately, wait only when evidence of sparse content on non-trivial DOM"

requirements-completed: [CONT-01, CONT-02, CONT-05]

duration: 2min
completed: 2026-03-31
---

# Phase 126 Plan 02: Content Extraction Auto-Stability Summary

**Quick-extract-then-retry-if-sparse pattern in readPage handler: auto-waits up to 3s for DOM stability on JS-heavy SPA pages returning sparse content**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T11:47:48Z
- **Completed:** 2026-03-31T11:50:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Implemented quick-extract-then-retry-if-sparse pattern in readPage handler per D-01/D-02/D-03/D-04
- JS-heavy SPA sites (Airbnb, Booking.com, Kayak) that returned <200 chars will now auto-wait up to 3s for DOM stability and re-extract
- Fast-loading static sites return immediately with zero delay -- the stability wait only triggers when content is genuinely sparse
- Response includes stabilityWaited boolean flag so MCP callers can see whether retry occurred
- Stability wait failure is non-fatal -- try/catch ensures the handler always returns a response

## Task Commits

Each task was committed atomically:

1. **Task 1: Add quick-extract-then-retry-if-sparse to readPage handler** - `5b4a392` (feat)

## Files Created/Modified
- `content/messaging.js` - Replaced readPage handler with quick-extract-then-retry-if-sparse pattern: extracts immediately, checks sparse threshold (<200 chars + childElementCount > 5), waits for DOM stability via FSB.waitForPageStability if sparse, re-extracts, returns result with stabilityWaited flag

## Decisions Made
- Sparse threshold set at 200 chars per D-02 -- matches audit data where problematic sites returned 0-173 chars
- Maximum stability wait capped at 3 seconds per D-03 -- covers React/Angular/Vue hydration without excessive delay
- Guard condition (childElementCount > 5) prevents unnecessary waiting on genuinely empty pages
- Stability wait params (stableTime: 300ms, networkQuietTime: 200ms) tuned below defaults for faster response
- Stability wait failure is non-fatal per defensive design -- caught in try/catch, handler always responds

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired with no placeholder data.

## Next Phase Readiness
- Phase 126 content extraction reliability is now complete (Plans 01 + 02)
- read_page now handles both fast static pages (immediate return) and JS-heavy SPAs (auto-retry) without separate wait_for_stable calls
- MCP callers get focused, right-sized content on first read_page call

## Self-Check: PASSED

- All 1 modified file verified present on disk
- Task commit (5b4a392) verified in git log

---
*Phase: 126-content-extraction-reliability*
*Completed: 2026-03-31*
