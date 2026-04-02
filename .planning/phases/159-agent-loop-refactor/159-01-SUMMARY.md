---
phase: 159-agent-loop-refactor
plan: 01
subsystem: ai-engine
tags: [hook-pipeline, cost-tracker, transcript-store, agent-loop, lifecycle-events, module-delegation]

# Dependency graph
requires:
  - phase: 156-state-foundation
    provides: TranscriptStore, ActionHistory, createActionEvent, SessionStateEmitter
  - phase: 157-engine-configuration
    provides: CostTracker, estimateCost, SESSION_DEFAULTS, loadSessionConfig, PermissionContext
  - phase: 158-hook-pipeline
    provides: HookPipeline, LIFECYCLE_EVENTS, safety-hooks, permission-hook, progress-hook factories
provides:
  - Refactored agent-loop.js with module delegation and 10 hook emission points
  - All sendStatus calls replaced with hook emissions
  - Cost estimation delegated to ai/cost-tracker.js
  - History compaction delegated to ai/transcript-store.js
  - Action history creation delegated to ai/action-history.js
  - Safety config initialization delegated to ai/engine-config.js
affects: [159-02-background-wiring, 160-bootstrap-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [hook-driven lifecycle events, module delegation via _al_ prefixed references, fallback inline logic when hooks unavailable]

key-files:
  created: []
  modified: [ai/agent-loop.js]

key-decisions:
  - "Keep checkSafetyBreakers and detectStuck in agent-loop.js as local functions -- hook factories receive them via closure from background.js"
  - "Use TranscriptStore per-iteration (hydrate/compact/replay) rather than persisting instance -- session.messages remains authoritative"
  - "Emit onError hook once at top of catch block rather than per error case -- all error types get one emission"
  - "Keep broadcastDashboardProgress calls -- dashboard WebSocket not yet on SessionStateEmitter"
  - "Keep sendStatus variable declarations but remove all call sites -- zero functional sendStatus calls remain"
  - "Inline stuck detection fallback when hooks pipeline is null (backward compat for sessions without hooks)"

patterns-established:
  - "Hook emission pattern: guard with `if (hooks)` before every `hooks.emit()` call for null-safety"
  - "Permission gating pattern: beforeToolExecution hook returns denial object, caller skips execution and pushes error result"
  - "Fallback pattern: when hooks unavailable, inline logic runs (e.g., detectStuck fallback)"

requirements-completed: [LOOP-01, LOOP-03]

# Metrics
duration: 7min
completed: 2026-04-02
---

# Phase 159 Plan 01: Agent Loop Refactor Summary

**Wired 8 extracted modules (Phases 156-158) into agent-loop.js with 10 hook emission points replacing all inline sendStatus calls, delegating cost/history/safety to extracted modules**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-02T18:46:14Z
- **Completed:** 2026-04-02T18:53:14Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced all inline MODEL_PRICING, estimateCost, estimateTokens, compactHistory with module calls
- Added 10 hook emission points across 7 lifecycle events in runAgentIteration
- Zero sendStatus call sites remain -- all replaced with hook emissions
- Preserved all 4 setTimeout-chaining patterns for MV3 service worker compatibility
- Added permission gating via beforeToolExecution hook with denial handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add module imports and resolve references for 8 new modules** - `3748674` (refactor)
2. **Task 2: Wire hook emissions into runAgentIteration and replace sendStatus/inline code** - `ff026fb` (feat)

## Files Created/Modified
- `ai/agent-loop.js` - Refactored agent loop with 10 importScripts for Phase 156-158 modules, 21 var reference resolvers, 10 hook emission points, module-delegated cost estimation/history compaction/action events

## Decisions Made
- Kept checkSafetyBreakers and detectStuck as local functions in agent-loop.js since hook factories receive them via closure parameters from background.js
- Used TranscriptStore per-iteration (hydrate/compact/replay) rather than persisting a TranscriptStore instance on the session -- session.messages remains the authoritative message array
- Emitted onError hook once at the top of the catch block rather than per error case, so all error types get a single emission
- Kept broadcastDashboardProgress calls since the dashboard WebSocket is not yet migrated to SessionStateEmitter
- Added inline stuck detection fallback (direct detectStuck call) when hooks pipeline is null for backward compatibility with sessions created before Phase 159

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added inline fallback for stuck detection when hooks unavailable**
- **Found during:** Task 2 (Hook emissions wiring)
- **Issue:** If hooks is null (backward compat, sessions without hook pipeline), stuck detection would silently skip
- **Fix:** Added else branch that calls detectStuck directly when hooks is null
- **Files modified:** ai/agent-loop.js
- **Verification:** Code path exists for both hooks and non-hooks scenarios
- **Committed in:** ff026fb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for backward compatibility with pre-Phase 159 sessions. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- agent-loop.js is fully refactored with hook emissions and module delegation
- Phase 159 Plan 02 (background.js wiring) can now instantiate HookPipeline, register safety/permission/progress hooks, and pass the hooks object through options to runAgentLoop
- All hook factories (createSafetyBreakerHook, createStuckDetectionHook, createPermissionHook, progress hooks) are ready to be registered on the pipeline

---
*Phase: 159-agent-loop-refactor*
*Completed: 2026-04-02*
