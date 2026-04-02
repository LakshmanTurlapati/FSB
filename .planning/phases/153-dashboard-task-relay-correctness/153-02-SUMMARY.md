---
phase: 153-dashboard-task-relay-correctness
plan: 02
subsystem: dashboard-task-terminal-state
tags: [dashboard, task-relay, completion, stop, dedupe]
requires: [153-01]
provides:
  - normalized per-run terminal payloads
  - bounded completion retry instead of dead fallback code
  - dashboard-side duplicate terminal-event rejection
affects: [154-end-to-end-verification-hardening]
tech-stack:
  added: []
  patterns: [normalized terminal payload, bounded completion retry, run-aware terminal dedupe]
key-files:
  created: []
  modified: [background.js, ws/ws-client.js, showcase/js/dashboard.js]
key-decisions:
  - "Success, failure, and stopped outcomes now use the same terminal payload shape."
  - "The old fallback timer is now a bounded retry that only runs when the first terminal send could not be written to the relay."
patterns-established:
  - "Terminal relay contract: every final payload carries `taskRunId`, `taskStatus`, task context fields, and `updatedAt`."
  - "Dashboard terminal dedupe: once a run is completed locally, duplicate or older terminal events for that run are ignored."
requirements-completed: [RLY-03]
duration: 9min
completed: 2026-04-02
---

# Phase 153 Plan 02: Terminal Outcome Summary

**Normalized per-run terminal outcomes, a real bounded completion retry, and dashboard-side rejection of duplicate final events**

## Performance

- **Duration:** 9 min
- **Completed:** 2026-04-02T10:23:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Normalized success, failure, and stopped payloads around one task-run-aware terminal contract including `taskRunId`, `taskStatus`, task context, and `updatedAt`.
- Replaced the old dead completion fallback branch in `startDashboardTask()` with a bounded retry that only fires when the initial terminal send was not actually written to the relay.
- Updated stop completion messages from `ws/ws-client.js` to include `taskRunId`, progress, phase, action, and other terminal context fields.
- Added `lastCompletedTaskRunId` tracking in the dashboard so duplicate or stale terminal events for a completed run are ignored.

## Task Commits

The two plan tasks shared the same write set and were delivered together:

1. **Task 1: Normalize and bound terminal outcome delivery per task run** - `b45076a` (feat)
2. **Task 2: Deduplicate stale or repeated terminal events on the dashboard** - `b45076a` (feat)

## Files Created/Modified

- `background.js` - Added normalized running/terminal payload builders and replaced the dead fallback branch with a bounded retry tied to the current task run.
- `ws/ws-client.js` - Enriched stop and rejection payloads with the run-aware terminal contract.
- `showcase/js/dashboard.js` - Added run-aware terminal acceptance and duplicate final-event rejection.

## Decisions Made

- Kept the completion retry bounded to one re-send from the latest terminal snapshot rather than introducing an open-ended resend loop.
- Let dashboard-side terminal dedupe use both `taskRunId` and `updatedAt` so reconnect recovery can still replace an older final state when it is objectively newer.
- Left immediate rejection payloads without a synthetic accepted run id, since they are not accepted task runs.

## Issues Encountered

- The previous fallback timer in `startDashboardTask()` never executed for the normal completion path because `_completionSent` was set before the fallback branch could matter.
- The dashboard previously had no explicit way to distinguish a duplicate final event for the current run from a stale terminal event from an older run.

## Next Phase Readiness

- Phase 154 can now verify exact stop/success/failure behavior against a concrete per-run terminal contract instead of best-effort timing assumptions.

## Self-Check: PASSED

- Verified `.planning/phases/153-dashboard-task-relay-correctness/153-02-SUMMARY.md` exists on disk.
- Verified `b45076a` is present in git history and contains the normalized terminal relay changes.
