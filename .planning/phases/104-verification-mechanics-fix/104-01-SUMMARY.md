---
phase: 104-verification-mechanics-fix
plan: 01
subsystem: automation
tags: [cdp, chrome-debugger, background-script, action-dispatch]

# Dependency graph
requires:
  - phase: 97-tool-parity
    provides: CDP tool names registered in CLI command table
provides:
  - Direct CDP tool routing in background automation loop bypassing content script round-trip
  - executeCDPToolDirect function handling all 5 CDP tools
affects: [104-02, validation, autopilot-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns: [background-direct-cdp-dispatch, try-finally-debugger-cleanup]

key-files:
  created: []
  modified: [background.js]

key-decisions:
  - "Replicated existing CDP handler logic exactly in executeCDPToolDirect rather than refactoring shared code -- minimizes risk of breaking content-script CDP path"
  - "Used ease-in-out speed curve from handleCDPMouseDragVariableSpeed (steps/minDelayMs/maxDelayMs) instead of waypoints pattern from plan -- matches actual existing handler"

patterns-established:
  - "cdpBackgroundTools routing: CDP tools dispatch directly in background like multiTabActions and backgroundDataTools"
  - "try/finally debugger.detach: guaranteed cleanup pattern for all direct CDP calls"

requirements-completed: [VMFIX-01]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 104 Plan 01: CDP Direct Routing Summary

**Direct CDP tool dispatch in background automation loop, bypassing broken nested content-to-background message round-trip that caused 100% false failure reporting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T16:35:18Z
- **Completed:** 2026-03-23T16:38:18Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added cdpBackgroundTools routing branch in automation loop action dispatch, matching existing multiTabActions/backgroundDataTools pattern
- Created executeCDPToolDirect function with all 5 CDP tools (cdpClickAt, cdpClickAndHold, cdpDrag, cdpDragVariableSpeed, cdpScrollAt)
- Each tool replicates exact CDP dispatch logic from existing handlers but returns results directly instead of via sendResponse callback
- Guaranteed debugger cleanup via try/finally pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Route CDP tools directly in background automation loop** - `7441251` (feat)

## Files Created/Modified
- `background.js` - Added cdpBackgroundTools array, routing branch in automation loop, and executeCDPToolDirect function with 5 CDP tool cases

## Decisions Made
- Matched existing handleCDPMouseDragVariableSpeed logic (steps/minDelayMs/maxDelayMs with ease-in-out curve) instead of plan's waypoints pattern, since the actual handler uses the former
- Included `buttons: 1` in mouseMoved events for cdpDrag/cdpDragVariableSpeed to match existing handlers (canvas apps need this to register drag intent)
- Added Math.round() to interpolated coordinates in drag operations to match existing handler precision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cdpDragVariableSpeed parameter mismatch**
- **Found during:** Task 1
- **Issue:** Plan specified waypoints-based API for cdpDragVariableSpeed, but existing handleCDPMouseDragVariableSpeed uses steps/minDelayMs/maxDelayMs with ease-in-out quadratic curve
- **Fix:** Used steps/minDelayMs/maxDelayMs parameters matching actual handler logic
- **Files modified:** background.js
- **Verification:** Code matches handleCDPMouseDragVariableSpeed pattern exactly
- **Committed in:** 7441251

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness -- using wrong parameter API would break variable speed drag.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CDP tools now report success=true when CDP dispatch completes without error
- Ready for 104-02 (completion detection and session lifecycle fixes)
- Validation re-run should show improved action verification pass rate

---
*Phase: 104-verification-mechanics-fix*
*Completed: 2026-03-23*
