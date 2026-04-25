---
phase: 207-background-session-lifecycle-hardening
plan: "01"
title: "Session Lifecycle Hardening"
subsystem: background
tags: [session-management, lifecycle, tab-close, service-worker, stale-cleanup, sidepanel-notification]
dependency_graph:
  requires:
    - phase: 206-agent-loop-exit-finalization
      provides: "Phase 206 blind broadcast automationComplete message shape (14-field contract)"
  provides:
    - "Stale cleanup explicitly skips running sessions (LIFE-01)"
    - "Tab close handler notifies sidepanel with automationComplete before session deletion (LIFE-02)"
    - "Service worker wake notifies sidepanel of unresumable restored running sessions (LIFE-03)"
  affects:
    - "sidepanel (now receives automationComplete on tab close and SW wake)"
    - "overlay lifecycle (endSessionOverlays called on tab close)"
tech_stack:
  added: []
  patterns:
    - "Running-session guard pattern at top of cleanup loops"
    - "Blind broadcast automationComplete for tab-close and SW-wake edge cases"
key_files:
  created: []
  modified:
    - "background.js"
decisions:
  - "Stale cleanup running guard added at loop top AND in tab-gone catch block for defense in depth"
  - "Tab close handler calls endSessionOverlays wrapped in try/catch since the tab is already gone"
  - "SW-wake notification only fires for running sessions, not idle (idle are legitimately resumable)"
  - "Restored running sessions persist stopped status to prevent re-notification on next SW wake"
patterns-established:
  - "Running-session guard: always check session.status === 'running' before cleanup deletion"
  - "Phase 206 message shape reuse: all automationComplete messages use the same 14-field contract"
requirements-completed: [LIFE-01, LIFE-02, LIFE-03]
metrics:
  duration: 2min
  completed: 2026-04-25
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 207 Plan 01: Session Lifecycle Hardening Summary

**Stale cleanup, tab close, and service worker wake now notify the sidepanel via automationComplete instead of silently dropping sessions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-25T04:12:43Z
- **Completed:** 2026-04-25T04:14:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Stale session cleanup explicitly skips running sessions at both the loop-level guard and the tab-gone catch block (LIFE-01)
- Tab close handler sends full automationComplete with reason 'tab_closed', calls endSessionOverlays, and calls removePersistedSession before deleting from activeSessions (LIFE-02)
- Service worker wake detects previously-running restored sessions, notifies sidepanel with reason 'service_worker_restart', sets status to stopped, and persists the stopped status to prevent re-notification (LIFE-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Stale cleanup running-session guard and tab-close notification (LIFE-01, LIFE-02)** - `742f11c` (feat)
2. **Task 2: Service worker wake notification for unresumable sessions (LIFE-03)** - `7dbea56` (feat)

## Files Created/Modified
- `background.js` - Added running-session guards in stale cleanup, automationComplete notifications in tab-close handler and restoreSessionsFromStorage

## Decisions Made
- Running guard placed at both loop top (early skip) and tab-gone catch block (defense in depth) for LIFE-01
- endSessionOverlays call in tab-close handler wrapped in try/catch since the tab is already gone and overlay send may fail
- SW-wake notification scoped only to running sessions; idle sessions are legitimately resumable and left untouched
- Restored running sessions persist stopped status so the next SW wake does not re-notify

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| tab_closed count >= 3 | PASS (3) |
| service_worker_restart count >= 2 | PASS (2) |
| running guard in stale cleanup | PASS (lines 2228, 2244) |
| npm test regressions | PASS (agent-loop 16/16; pre-existing runtime-contract failures unchanged) |

## Known Stubs

None -- all notification paths are fully wired with real automationComplete messages.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three LIFE-xx requirements satisfied
- Sidepanel now receives automationComplete for all session termination edge cases
- Phase 207 Plan 02 (if any) can build on these notification contracts

## Self-Check: PASSED

- FOUND: background.js
- FOUND: 207-01-SUMMARY.md
- FOUND: 742f11c (Task 1 commit)
- FOUND: 7dbea56 (Task 2 commit)

---
*Phase: 207-background-session-lifecycle-hardening*
*Completed: 2026-04-25*
