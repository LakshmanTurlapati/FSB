---
phase: 156-state-foundation
plan: 02
subsystem: state-management
tags: [transcript-store, turn-result, action-history, compaction, token-budget, chrome-mv3]

# Dependency graph
requires:
  - phase: 156-01
    provides: "Typed session factory (createSession) and SessionStateEmitter"
provides:
  - TranscriptStore class with token-budget-aware compaction (append/compact/replay/flush/hydrate)
  - estimateTokens utility (char/4 heuristic) for token estimation
  - createTurnResult factory with 13-field data contract and STOP_REASONS enum
  - summarizeTurnResult and accumulateTurnResults utility functions
  - ActionHistory class with push/getLastN/getByIteration/getToolCounts/getFailures/diff/hydrate/toJSON/clear
  - createActionEvent factory normalizing tool execution events
affects: [157-tool-registry, 158-coordinator-loop, 159-agent-loop-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-budget-aware compaction (80% trigger, keep recent N intact, one-liner summaries)"
    - "Multi-provider message format handling (OpenAI role=tool, Anthropic content arrays, Gemini parts)"
    - "Factory function pattern for data structures (createTurnResult, createActionEvent)"
    - "Queryable event store with diff/filter/aggregate capabilities"

key-files:
  created:
    - ai/transcript-store.js
    - ai/turn-result.js
    - ai/action-history.js
  modified: []

key-decisions:
  - "TranscriptStore uses function/prototype pattern (not class syntax) for importScripts compatibility"
  - "TurnResult is a factory function, not a class, since it is a data structure without stateful behavior"
  - "ActionHistory normalizes events through createActionEvent on push and hydrate for consistency"
  - "STOP_REASONS enum covers 7 stop types including stuck detection and safety limits"

patterns-established:
  - "Token estimation via char/4 heuristic shared between TranscriptStore and agent-loop"
  - "Factory functions with defaults for all fields (defensive coding pattern)"
  - "Queryable history stores with getByIteration, getToolCounts, getFailures, diff"

requirements-completed: [STATE-02, STATE-03, STATE-04]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 156 Plan 02: State Foundation Summary

**TranscriptStore with FSB compaction, TurnResult factory with 7 stop reasons, and ActionHistory with queryable event store**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T12:22:48Z
- **Completed:** 2026-04-02T12:26:07Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- Extracted compactHistory from agent-loop.js into standalone TranscriptStore with append/compact/replay/flush/hydrate/getStats API preserving FSB's token-budget-aware compaction logic
- Created TurnResult factory formalizing per-iteration metadata (tokens, cost, tools, stop reason) into a typed 13-field data contract with accumulation utilities
- Created ActionHistory module replacing ad-hoc session.actionHistory.push() with structured events supporting replay, diff, filtering, and tool counting

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract TranscriptStore class from compactHistory** - `fa4f803` (feat)
2. **Task 2: Create structured TurnResult factory** - `1235d96` (feat)
3. **Task 3: Create structured ActionHistory module** - `780f084` (feat)

## Files Created/Modified
- `ai/transcript-store.js` - TranscriptStore class with token-budget-aware compaction, estimateTokens utility, append/compact/replay/flush/getStats/hydrate API
- `ai/turn-result.js` - createTurnResult factory, STOP_REASONS enum (7 types), summarizeTurnResult and accumulateTurnResults utilities
- `ai/action-history.js` - ActionHistory class with push/getLastN/getByIteration/getToolCounts/getFailures/diff/hydrate/toJSON/clear, createActionEvent factory

## Decisions Made
- TranscriptStore uses function/prototype pattern rather than class syntax for consistency with state-emitter.js and importScripts compatibility
- TurnResult implemented as factory function (not class) per D-05 since it is a data structure without stateful behavior
- ActionHistory.push() normalizes input through createActionEvent when the argument lacks tool+timestamp, but passes through structured events directly for performance
- STOP_REASONS covers 7 types: end_turn, tool_calls, safety_stop, user_stop, error, max_iterations, stuck -- matching all current and anticipated session termination paths

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- TranscriptStore ready to replace inline compactHistory() in agent-loop.js during Phase 159 refactor
- TurnResult ready for agent-loop.js to construct after each API response, replacing ad-hoc usage extraction
- ActionHistory ready to replace session.actionHistory.push({...}) pattern in agent-loop.js
- All three modules are self-contained, Node.js-testable, and Chrome Extension-compatible

## Self-Check: PASSED

All 3 created files exist. All 3 task commits verified (fa4f803, 1235d96, 780f084).

---
*Phase: 156-state-foundation*
*Completed: 2026-04-02*
