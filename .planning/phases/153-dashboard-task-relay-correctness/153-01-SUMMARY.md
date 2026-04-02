---
phase: 153-dashboard-task-relay-correctness
plan: 01
subsystem: dashboard-task-progress
tags: [dashboard, task-relay, websocket, reconnect]
requires: [151-dom-stream-consistency-and-state-sync, 152-remote-control-reliability]
provides:
  - stable per-run dashboard task identity
  - immediate accepted-running payloads
  - run-aware progress and reconnect recovery
affects: [154-end-to-end-verification-hardening]
tech-stack:
  added: []
  patterns: [task-run identity, normalized running payload, run-aware recovery]
key-files:
  created: []
  modified: [background.js, ws/ws-client.js, showcase/js/dashboard.js]
key-decisions:
  - "Every accepted dashboard task now gets a `taskRunId` that travels through progress, completion, stop, and reconnect snapshots."
  - "The extension sends an authoritative running payload immediately on task acceptance instead of waiting for the first throttled progress tick."
patterns-established:
  - "Task relay contract: `taskRunId`, `taskStatus`, `task`, `progress`, `phase`, `elapsed`, `lastAction`, and `updatedAt` are the shared running-state shape."
  - "Dashboard run tracking: the UI tracks the active run explicitly and rejects stale progress from an older run."
requirements-completed: [RLY-01, RLY-02]
duration: 9min
completed: 2026-04-02
---

# Phase 153 Plan 01: Task Run Identity Summary

**Stable per-run task identity, authoritative accepted-running payloads, and run-aware progress/reconnect handling**

## Performance

- **Duration:** 9 min
- **Completed:** 2026-04-02T10:23:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `taskRunId` generation for each accepted dashboard task and carried it through the recoverable task snapshot, live progress messages, stop completion, and reconnect snapshots.
- Sent an immediate normalized `ext:task-progress` payload when a dashboard task is accepted so the dashboard receives authoritative run metadata before the first throttled progress update.
- Updated reconnect snapshots to include `taskRunId` even when the recoverable state comes from an active in-memory session.
- Taught the dashboard to track `activeTaskRunId` and reject stale progress from a previous run instead of relying purely on timestamps.

## Task Commits

The two plan tasks shared the same write set and were delivered together:

1. **Task 1: Add explicit task run identity and accepted-running payloads** - `b45076a` (feat)
2. **Task 2: Normalize running progress payloads with current task context** - `b45076a` (feat)

## Files Created/Modified

- `background.js` - Added task-run id generation, normalized running payload builders, and immediate accepted-running delivery.
- `ws/ws-client.js` - Added `taskRunId` to reconnect snapshots and stop/rejection task payloads.
- `showcase/js/dashboard.js` - Added active/completed task-run tracking and run-aware progress acceptance.

## Decisions Made

- Chose a server-generated `taskRunId` instead of a dashboard-generated optimistic id so the recoverable snapshot and the executing session can share one authoritative run identity.
- Used the same normalized running payload shape for immediate acceptance and later progress so the dashboard does not have to merge two different contracts.
- Layered task-run identity on top of timestamp freshness checks rather than replacing timestamps entirely.

## Issues Encountered

- The previous task relay had no stable per-run identity, which left the dashboard with only timestamps and a local optimistic running state to separate one run from another.
- Reconnect snapshots built from active sessions did not carry enough information to prove that the recovered running state belonged to the same task run as later live progress.

## Next Phase Readiness

- Phase 153-02 can now make terminal outcomes exact per run, because live and recovered running state already share one task identity contract.
- Phase 154 has a concrete `taskRunId` contract to verify during reconnect and stop/completion testing.

## Self-Check: PASSED

- Verified `.planning/phases/153-dashboard-task-relay-correctness/153-01-SUMMARY.md` exists on disk.
- Verified `b45076a` is present in git history and contains the run-aware task relay changes.
