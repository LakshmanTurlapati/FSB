---
phase: 119-replay-intelligence
plan: 01
subsystem: agents
tags: [replay, timing, retry, cost-tracking]

requires:
  - phase: none
    provides: existing agent-executor.js with replay infrastructure
provides:
  - Smart replay timing using recorded originalDuration with 200ms-5000ms clamp
  - Step-level retry (2 retries with 500ms backoff) before AI fallback
  - Accurate cost savings using real estimatedCostPerRun (no 0.002 fallback)
affects: [119-02, agent-replay, background-agents]

tech-stack:
  added: []
  patterns: [duration-clamped-delay, step-retry-loop]

key-files:
  created: []
  modified: [agents/agent-executor.js]

key-decisions:
  - "Keep delayAfter as fallback when originalDuration is 0 or missing"
  - "Report costSaved as 0 (not 0.002) when no real cost data exists"

patterns-established:
  - "Clamped replay delay: Math.max(200, Math.min(originalDuration, 5000)) with delayAfter fallback"
  - "Step retry loop: attempt 0..MAX_STEP_RETRIES with 500ms backoff between retries"

requirements-completed: [REPLAY-01, REPLAY-02, REPLAY-04]

duration: 2min
completed: 2026-03-28
---

# Phase 119 Plan 01: Smart Replay Timing Summary

**Duration-aware replay timing with 200-5000ms clamp, per-step retry (2 retries, 500ms backoff), and real cost savings tracking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T10:13:29Z
- **Completed:** 2026-03-28T10:15:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replay steps now use recorded originalDuration (clamped 200ms-5000ms) instead of hardcoded delayAfter values
- Failing replay steps retry up to 2 times with 500ms backoff before reporting failure to AI fallback
- Cost savings use real estimatedCostPerRun from recorded script; report 0 when no data exists instead of fabricated 0.002

## Task Commits

Each task was committed atomically:

1. **Task 1: Smart replay timing and step-level retry** - `b68f96e` (feat)

## Files Created/Modified
- `agents/agent-executor.js` - Updated _executeReplayScript with smart timing + retry loop, fixed cost fallback in execute()

## Decisions Made
- Keep delayAfter as fallback when originalDuration is 0 or missing -- ensures backward compatibility with scripts recorded before duration tracking
- Report costSaved as 0 (not 0.002) when no real cost data -- honest reporting over flattering estimates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan's automated verification script checks for absence of `|| 0.002` globally in the file, but `_extractRecordedScript` still uses `|| 0.002` for initial script recording (as the plan explicitly states "Do NOT change _extractRecordedScript"). The verification regex is overly broad but the actual code change is correct -- only the replay success path was modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- agent-executor.js has smart timing and retry -- ready for 119-02 (per-step success rate tracking)
- The retriesUsed field in failure results enables downstream analytics

## Self-Check: PASSED

- FOUND: agents/agent-executor.js
- FOUND: 119-01-SUMMARY.md
- FOUND: b68f96e (task 1 commit)

---
*Phase: 119-replay-intelligence*
*Completed: 2026-03-28*
