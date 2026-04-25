---
phase: 208-sidepanel-orphan-recovery
plan: "01"
subsystem: ui/sidepanel, background
tags: [orphan-recovery, liveness-poll, session-management, sidepanel]
dependency_graph:
  requires: []
  provides: [sidepanel-orphan-recovery, checkSessionAlive-handler]
  affects: [ui/sidepanel.js, background.js]
tech_stack:
  added: []
  patterns: [setInterval liveness poll, grace-period consecutive-failure detection]
key_files:
  created: []
  modified:
    - ui/sidepanel.js
    - background.js
decisions:
  - "10-second poll interval balances detection speed with overhead (D-01)"
  - "2 consecutive failures required before recovery to avoid false positives during brief SW suspension"
  - "Interval started in setRunningState (after existing logic) and cleared in setIdleState (before isRunning=false) to match lifecycle"
  - "checkSessionAlive returns alive:true only when session has status 'running', not just existence in activeSessions"
metrics:
  duration_minutes: 2
  completed: "2026-04-25T05:28:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 208 Plan 01: Sidepanel Orphan Recovery Summary

Liveness poll on 10-second interval detects orphaned running state when upstream notifications are lost, with 2-failure grace period and automatic idle recovery.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add liveness poll and orphan recovery to sidepanel.js | a849f9a | ui/sidepanel.js |
| 2 | Add checkSessionAlive handler to background.js | 4bd0fa8 | background.js |

## Changes Made

### Task 1: Liveness poll in sidepanel.js

- Added `livenessInterval` and `livenessFailCount` global variables
- Added `checkSessionLiveness()` function that pings background via `chrome.runtime.sendMessage({ action: 'checkSessionAlive' })`
- Poll starts with `setInterval(checkSessionLiveness, 10000)` at end of `setRunningState()`
- Poll cleared at start of `setIdleState()` before `isRunning = false`
- Guard in `setRunningState` prevents interval accumulation (clearInterval before new setInterval)
- Grace period: 2 consecutive failures required before triggering recovery
- On orphan detection: shows "Session ended unexpectedly. Ready for your next task." via `addMessage(msg, 'error')` then calls `setIdleState()`
- Diagnostic `console.warn` on each failure with sessionId, failCount, error, alive status

### Task 2: checkSessionAlive handler in background.js

- Added `case 'checkSessionAlive'` in the message handler switch block (after getStatus, before testAPI)
- Looks up session via `activeSessions.get(sessionId)`
- Returns `alive: true` only when session exists AND has `status === 'running'`
- Returns session status string for sidepanel diagnostic logging
- Synchronous response pattern (no `return true`) matching getStatus/getPerformanceReport cases

## Decisions Made

1. **Grace period of 2 failures** -- Avoids false positives during brief service worker suspensions where the background momentarily becomes unreachable
2. **alive requires running status** -- A session that exists but is idle/stopped should not be treated as alive from the sidepanel's perspective
3. **Diagnostic logging with console.warn** -- Includes sessionId, failCount, error message, alive state, and status for debugging without adding automationLogger dependency

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Mitigations Applied

- **T-208-02 (DoS - interval accumulation):** Mitigated. `clearInterval` guard in `setRunningState` before new `setInterval`, plus cleanup in `setIdleState` with null assignment. Cannot accumulate multiple intervals.

## Self-Check: PASSED

All files exist, both commits verified, key content confirmed in both modified files.
