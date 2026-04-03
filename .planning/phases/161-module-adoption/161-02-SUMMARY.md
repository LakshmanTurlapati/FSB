---
phase: 161-module-adoption
plan: 02
subsystem: ai-engine
tags: [cost-tracker, action-history, turn-result, agent-loop, module-adoption]

# Dependency graph
requires:
  - phase: 156-state-foundation
    provides: session-schema, turn-result, action-history modules
  - phase: 157-engine-configuration
    provides: cost-tracker, engine-config modules
  - phase: 159-agent-loop-refactor
    provides: hook pipeline wiring and module reference resolution in agent-loop.js
provides:
  - CostTracker per-session instantiation with checkBudget in safety breakers
  - ActionHistory per-session instantiation replacing raw array pushes
  - Structured TurnResult at every iteration exit path (end_turn, tool_calls, error)
  - Backward-compatible session field syncing for all adopted modules
affects: [160-bootstrap-pipeline, 161-module-adoption]

# Tech tracking
tech-stack:
  added: []
  patterns: [module-adoption-with-fallback, warm-state-hydration-for-class-instances]

key-files:
  created: []
  modified:
    - ai/agent-loop.js

key-decisions:
  - "CostTracker stored on session._costTracker with fallback else-blocks when class unavailable"
  - "ActionHistory stored on session._actionHistory with backward compat sync to session.actionHistory"
  - "TurnResult written to session.lastTurnResult (overwritten each iteration, not accumulated)"
  - "iterationCost variable bridges CostTracker.record return value to TurnResult cost field"

patterns-established:
  - "Module adoption with fallback: if (session._module) { use module } else { inline fallback } -- ensures graceful degradation"
  - "Warm state hydration: instantiate class then copy accumulated values from session fields before first use"
  - "Backward compat sync: after every module mutation, sync back to raw session properties for downstream consumers"

requirements-completed: [ADOPT-02, ADOPT-03, ADOPT-04]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 161 Plan 02: Module Adoption Summary

**CostTracker, ActionHistory, and TurnResult wired into agent-loop.js with per-session instantiation, budget enforcement via checkBudget, and structured turn metadata at all 3 iteration exit paths**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T00:46:11Z
- **Completed:** 2026-04-03T00:49:34Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- CostTracker instantiated per session in hydrateAgentRunState with warm state hydration from accumulated cost/tokens
- CostTracker.record replaces inline cost math; CostTracker.checkBudget replaces direct totalCost reads in safety breakers
- ActionHistory instantiated per session with hydration from persisted actionHistory array; ActionHistory.push replaces raw array pushes at both action event sites (permission denial + standard tool result)
- Structured TurnResult produced at every runAgentIteration exit: end_turn (with completionMessage), tool_calls (with matchedTools), error (with errorMessage)
- All adoptions include fallback else-blocks for graceful degradation when module classes are unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Instantiate CostTracker and ActionHistory, wire record and checkBudget** - `c9a4a24` (feat)
2. **Task 2: Construct createTurnResult at iteration end** - `4311f61` (feat)

## Files Created/Modified
- `ai/agent-loop.js` - Wired CostTracker, ActionHistory, and TurnResult into hydrateAgentRunState, cost accumulation, safety breakers, action history pushes, and all iteration exit paths

## Decisions Made
- CostTracker instance stored on `session._costTracker` (underscore prefix indicates internal module instance, not part of public session API)
- `iterationCost` variable introduced to bridge CostTracker.record() return value through to TurnResult construction (both end_turn and tool_calls paths need it)
- Single error TurnResult placed after onError hook emit, before error-type branching -- covers all error exit paths (401, 400, 429, network, terminal) with one construction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all module instances are fully wired with real data paths.

## Next Phase Readiness
- ADOPT-02, ADOPT-03, ADOPT-04 gaps closed
- session._costTracker, session._actionHistory, session.lastTurnResult available for downstream consumers
- Remaining ADOPT-01 (createSession) and ADOPT-05 (session.mode) are handled by the companion plan 161-01

## Self-Check: PASSED

- ai/agent-loop.js: FOUND
- 161-02-SUMMARY.md: FOUND
- Commit c9a4a24: FOUND
- Commit 4311f61: FOUND
- All 8 verification grep counts match expected values

---
*Phase: 161-module-adoption*
*Completed: 2026-04-03*
