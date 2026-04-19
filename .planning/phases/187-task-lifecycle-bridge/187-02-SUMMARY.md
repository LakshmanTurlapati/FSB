---
phase: 187-task-lifecycle-bridge
plan: 02
subsystem: background-websocket
tags: [websocket, dashboard, task-complete, recovery, lifecycle]
dependency_graph:
  requires: [broadcastDashboardProgress-function, dashboard-session-tagging]
  provides: [automationComplete-forwarding, recovery-snapshot-function, ext-task-complete-emission]
  affects: [background.js, ws-client.js-consumers, dashboard.js-receivers]
tech_stack:
  added: []
  patterns: [automationComplete-interception, recovery-snapshot-with-TTL, async-tab-info-lookup]
key_files:
  created: []
  modified:
    - background.js
decisions:
  - automationComplete case placed in main message listener switch before default case
  - async IIFE used for chrome.tabs.get to avoid blocking other message listeners
  - 60-second TTL for recovery snapshot covers critical post-completion reconnect window
  - _getDashboardTaskRecoverySnapshot placed after broadcastDashboardProgress for locality
  - taskStatus maps 'error' to 'failed' to match dashboard expected states
metrics:
  duration: 156s
  completed: 2026-04-19T23:13:25Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 187 Plan 02: Wire Task Completion Forwarding and Recovery Snapshot Summary

Task completion forwarding via ext:task-complete for all four terminal outcomes (success, partial, failed, stopped) plus _getDashboardTaskRecoverySnapshot for WebSocket reconnection resilience.

## What Was Done

### Task 1: Intercept automationComplete and forward ext:task-complete via WebSocket

Added a `case 'automationComplete'` block to the main chrome.runtime.onMessage.addListener switch in background.js (line 4627). When agent-loop.js fires `notifySidepanel` -> `chrome.runtime.sendMessage({ action: 'automationComplete' })`, this case now:

1. Guards on `fsbWebSocket` existence and `connected` state
2. Guards on `completedSession._isDashboardTask` to only forward dashboard-originated tasks
3. Maps `request.outcome` to `taskStatus` (normalizing 'error' to 'failed' for dashboard compatibility)
4. Builds an `ext:task-complete` payload with: success flag, summary (from terminal.resultText), elapsed time, taskRunId, task text, taskStatus, progress (100 for success, calculated otherwise), actionCount, totalCost, finalUrl, pageTitle, stopped flag, error, blocker, nextStep
5. Uses an async IIFE to fetch tab URL/title via `chrome.tabs.get` (wrapped in try/catch per T-187-05 mitigation)
6. Sends the payload via `fsbWebSocket.send('ext:task-complete', ...)`
7. Stores the payload in `_lastDashboardTaskResult` with timestamp for recovery snapshot use
8. Does NOT use `return true` or `sendResponse` -- lets other listeners (sidepanel, popup) handle the message normally

Also added two module-scoped variables near `activeSessions` (line 1167-1168):
- `_lastDashboardTaskResult` -- stores the last completion payload
- `_lastDashboardTaskResultTime` -- stores the timestamp for 60-second TTL

### Task 2: Implement _getDashboardTaskRecoverySnapshot for reconnection resilience

Defined `_getDashboardTaskRecoverySnapshot` as a named function in background.js (line 625), placed after `broadcastDashboardProgress` for locality. The function:

1. First checks for a running dashboard task in `activeSessions` -- returns live progress data if found
2. Then checks for a recently completed task in `_lastDashboardTaskResult` -- returns stored completion payload if within 60-second TTL
3. Clears expired recovery data (beyond 60s) to prevent stale state
4. Returns null when no dashboard task state is available

The function is already called by ws-client.js at two sites:
- `_sendStateSnapshot` (line 327) -- for reconnection recovery
- `_handleStopTask` (line 768) -- for stop-during-disconnect recovery

Both sites use `typeof _getDashboardTaskRecoverySnapshot === 'function'` guards that now resolve to the real function. No changes needed in ws-client.js.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

All plan verification criteria passed:

| Check | Result |
|-------|--------|
| `grep -c "function broadcastDashboardProgress" background.js` returns 1 | PASSED |
| `grep -c "case 'automationComplete'" background.js` returns 1 | PASSED |
| `grep -c "function _getDashboardTaskRecoverySnapshot" background.js` returns 1 | PASSED |
| `grep "ext:task-complete" background.js` shows fsbWebSocket.send call | PASSED (line 4673) |
| `grep -c "_lastDashboardTaskResult" background.js` shows 10 references | PASSED |
| Node.js syntax validation: all three functions exist | PASSED |
| ws-client.js typeof guards at lines 327 and 768 reference the function | CONFIRMED |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ff9dfaf | feat(187-02): intercept automationComplete and forward ext:task-complete via WebSocket |
| 2 | 73f0446 | feat(187-02): implement _getDashboardTaskRecoverySnapshot for reconnection resilience |

## Self-Check: PASSED

- background.js: FOUND
- 187-02-SUMMARY.md: FOUND
- Commit ff9dfaf: FOUND
- Commit 73f0446: FOUND
