---
phase: 206-agent-loop-exit-finalization
plan: "01"
title: "Agent Loop Exit Finalization"
subsystem: ai/agent-loop
tags: [agent-loop, finalization, exit-paths, session-management, sidepanel-notification]
dependency_graph:
  requires: []
  provides:
    - "All 5 broken agent loop exit paths now finalize sessions and notify sidepanel"
    - "Structured termination reason constants (D-01) for diagnostic clarity"
  affects:
    - "sidepanel (automationComplete message now always arrives)"
    - "session state (outcomeDetails.reason always populated)"
tech_stack:
  added: []
  patterns:
    - "mapSafetyReasonToConstant helper for reason string classification"
    - "Blind broadcast pattern for guard clauses without valid session objects"
key_files:
  created: []
  modified:
    - "ai/agent-loop.js"
decisions:
  - "Guard clauses use blind chrome.runtime.sendMessage instead of notifySidepanel because session may be null"
  - "Safety breaker reasons are classified by keyword matching (iteration/cost/time) from human-readable strings"
  - "ON_COMPLETION hook emit preserved only where it already existed (hook pipeline path); not added to other paths"
metrics:
  duration: "3 min"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 206 Plan 01: Agent Loop Exit Finalization Summary

All 5 broken exit paths in ai/agent-loop.js now properly finalize sessions, notify the sidepanel, and record structured termination reasons using the D-01 constant set.

## What Changed

### Task 1: Guard clause exit paths with blind sidepanel broadcast (b95303e)

Split the combined `if (!session || session.status !== 'running')` guard into two separate checks:

- **session_not_found**: When session is null/undefined, sends a blind `automationComplete` broadcast via `chrome.runtime.sendMessage` with `reason: 'session_not_found'`. The sidepanel can match on `sessionId` and reset to idle even without full session data.

- **session_not_running**: When session exists but status is not `'running'`, sends a blind `automationComplete` broadcast with `reason: 'session_not_running'` and includes the current session status in the summary text.

Both payloads replicate the exact message shape from `notifySidepanel()` (lines 1092-1115) for sidepanel compatibility.

### Task 2: Safety breaker and stuck force-stop exit paths with full finalization (d433f8c)

Added `mapSafetyReasonToConstant(reasonString)` helper that classifies human-readable `checkSafetyBreakers()` reason strings into D-01 constants:
- `iteration_limit_exceeded` -- matched by "iteration" + "limit" or "count"
- `cost_limit_exceeded` -- matched by "cost", "budget", or "spending"
- `time_limit_exceeded` -- matched by "duration" or "time"
- Falls back to generic `'safety'` if no pattern matches

Fixed 4 exit paths to use the full 4-step finalization pattern:

1. **Hook pipeline safety breaker** (`beforeIterResult.stopped`): Now calls `createTerminalOutcome` + `applyTerminalOutcome` + `persist` + `finalizeSession`. Preserved existing `ON_COMPLETION` hook emit.

2. **Inline safety fallback** (`safety.shouldStop`): Same 4-step pattern applied.

3. **After-iteration safety breaker** (`afterIterResult.stopped`): Same 4-step pattern applied.

4. **Stuck force-stop** (`stuckCheck.shouldForceStop`): Uses `reason: 'stuck_force_stop'` with stuck hint text (truncated to 200 chars) in the summary.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b95303e | Guard clause exit paths with blind sidepanel broadcast |
| 2 | d433f8c | Safety breaker and stuck force-stop exit paths with full finalization |

## Verification Results

| Check | Result |
|-------|--------|
| All 6 D-01 reason constants present | PASS |
| Combined guard removed | PASS (0 matches) |
| No bare `session.status = 'stopped'` | PASS (0 matches) |
| mapSafetyReasonToConstant defined + called | PASS (4 matches: 1 def + 3 calls) |
| finalizeSession call count increased | PASS (11 total, 4 new) |
| npm test regressions | PASS (agent-loop tests 16/16; pre-existing runtime-contract failures unchanged) |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all exit paths are fully wired with real finalization logic.

## Self-Check: PASSED

- FOUND: ai/agent-loop.js
- FOUND: 206-01-SUMMARY.md
- FOUND: b95303e (Task 1 commit)
- FOUND: d433f8c (Task 2 commit)
