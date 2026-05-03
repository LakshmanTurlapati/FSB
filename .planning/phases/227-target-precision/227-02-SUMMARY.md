---
phase: 227-target-precision
plan: 02
subsystem: autopilot/stuck-detection
tags:
  - autopilot
  - stuck-detection
  - goal-progress
  - heuristic
requirements:
  - TARGET-02
  - GUARD-01
  - GUARD-02
  - GUARD-03
dependency-graph:
  requires:
    - 227-01 (action-repetition detector + STUCK_REASONS + reasonCode plumbing)
  provides:
    - "GoalProgressTracker module exposing windowed unique-state-vector heuristic"
    - "stuck_no_goal_progress reasonCode wired into detectStuck (after action-repetition precedence)"
    - "Per-task-type override hook (form_fill=16, data_entry=12, default=8)"
  affects:
    - "extension/ai/agent-loop.js detectStuck()"
    - "session lifecycle (lazy session.goalProgressTracker init)"
tech-stack:
  added: []
  patterns:
    - "Mirrors extension/ai/action-history.js style (CommonJS + Chrome global attachment)"
    - "Lazy session-attached tracker, no schema migration required"
    - "Precedence rule: action-repetition fires first; goal-progress only on the no-fire path"
key-files:
  created:
    - extension/ai/goal-progress-tracker.js
    - tests/goal-progress-tracker.test.js
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-01.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-02.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-04.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-06.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-07.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-09.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-10.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-PROMPT-13.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-02-EDGE-11.md
  modified:
    - extension/ai/agent-loop.js
    - package.json
decisions:
  - "WindowSize default 8 iterations: matches plan spec; provides ~8 iter grace before WARN, +1 more before force-stop."
  - "form_fill / form override = 16: large forms have many similar (input:ok:fx) outcome classes; override prevents false positives on long form-filling sessions."
  - "data_entry override = 12: middle-ground for sheet/CSV style data entry."
  - "Precedence: action-repetition wins -- it is the more specific signal; goal-progress only evaluated on the no-fire path."
  - "Force-stop on 2nd consecutive goalStuck hit (not 1st): the windowSize itself already provides 8 iterations of grace, so a 1-iteration WARN before force-stop is sufficient."
  - "Session-restore rehydration: GoalProgressTracker.fromJSON exists in the module but is NOT yet wired into transcript-store.js / session-schema.js restore paths. Deferred -- in-memory case (new sessions) is the primary verification path. See Open Items."
metrics:
  duration: ~25min
  completed: 2026-05-03
---

# Phase 227 Plan 02: Goal-Progress Heuristic Summary

One-liner: Adds a windowed unique-state-vector tracker (URLs, focused-element ids, action-outcome classes) that fires `stuck_no_goal_progress` when actions vary but no semantic progress is made -- catches the canonical react-select / canvas-spatial loops the same-fingerprint detector misses.

## What Was Built

1. **`extension/ai/goal-progress-tracker.js`** -- new module exposing:
   - `GoalProgressTracker` class with `record()`, `hasProgressed(currentIteration, windowSize)`, `toJSON()`
   - `GoalProgressTracker.fromJSON(o)` static rehydrator
   - `getOverrideThreshold(taskType)` -- returns 16 (form_fill/form), 12 (data_entry), 8 (default)
   - Module attaches `window.GoalProgressTracker` and `window.getGoalProgressOverrideThreshold` for Chrome-context access (mirrors action-history.js style)

2. **`extension/ai/agent-loop.js`** -- detectStuck() integration:
   - Added `_al_goalProgress` require + `_al_GoalProgressTracker` / `_al_getGoalProgressOverrideThreshold` resolved references
   - Added `importScripts('ai/goal-progress-tracker.js')` for Chrome MV3 service worker context
   - Lazy `session.goalProgressTracker` init inside detectStuck()
   - Per-iteration record of (url, focusedElementId, actionOutcomeKey):
     - **url**: `session.lastKnownUrl`, falling back to a toolResult `result.url` / `result.currentUrl` / `args.url`
     - **focusedElementId**: selector / elementId / element_id of the LAST mutation toolResult (read-only tools skipped)
     - **actionOutcomeKey**: `${tool}:${ok|err}:${fx|nf}` of the last mutation toolResult
   - Goal-progress check runs AFTER the action-repetition precedence block -- when both would fire, ACTION_REPETITION wins (more specific signal)
   - Warn at 1st goalStuck hit, force-stop at 2nd consecutive (windowSize already bakes in 8-iter grace)
   - Reset `state.goalProgressWarningCount` on actual progress

3. **`tests/goal-progress-tracker.test.js`** -- 38 tests, all passing:
   - Tests 1-7: tracker construction, growth detection, stagnation threshold, URL-reset, override map, toJSON/fromJSON round-trip
   - Integration Tests 1-5: varying-selector loop fires NO_GOAL_PROGRESS, action-repetition precedence wins, URL-reset prevents fire, form_fill override raises threshold, normal varied task does not false-positive

4. **9 rerun scaffolds** for operator MCP verification (PROMPT-01, 02, 04, 06, 07, 09, 10, 13 + EDGE-11).

## WindowSize Defaults & Rationale

| Task type | windowSize | Rationale |
| --- | --- | --- |
| `form_fill` (alias `form`) | 16 | Large forms have many similar `input:ok:fx` outcome classes; default 8 would false-positive |
| `data_entry` | 12 | Middle-ground for spreadsheet / CSV-style entry |
| default | 8 | Matches plan spec; ~8-iter grace then WARN, +1 more before force-stop |

## Precedence Confirmation

Action-repetition wins. Verified by `Integration Test 2` in tests/goal-progress-tracker.test.js: 6 iterations of identical `click(#dropdown)` results yield `reasonCode = STUCK_REASONS.ACTION_REPETITION` (not NO_GOAL_PROGRESS), even though the goal-progress tracker also detects stagnation.

## Test Results

- `tests/goal-progress-tracker.test.js`: **38 passed, 0 failed**
- `tests/stuck-action-repetition.test.js` (Plan 227-01 regression): all PASS preserved
- `npm test` exit code 0 -- GUARD-02 satisfied

## Deviations from Plan

### Auto-fixed Issues

**[Rule 2 - Critical functionality] Added importScripts and Chrome global attachment**
- **Found during:** Task 2
- **Issue:** Plan only specified Node `require()` wiring. agent-loop.js follows a dual-context pattern (Node + Chrome MV3 service worker via importScripts). Without the importScripts line and `window.GoalProgressTracker` attachment, the tracker would silently degrade to a 8-default windowSize in the extension runtime.
- **Fix:** Added `importScripts('ai/goal-progress-tracker.js')` to the existing importScripts try-block, plus `window.GoalProgressTracker` / `window.getGoalProgressOverrideThreshold` exports inside the module.
- **Files modified:** extension/ai/agent-loop.js, extension/ai/goal-progress-tracker.js
- **Commit:** 78409d0

**[Rule 2 - Critical functionality] Wired new test file into npm test script**
- **Found during:** Task 2 verification
- **Issue:** GUARD-02 requires `npm test` green; if the new test file is not in the script chain, regressions would be invisible to CI.
- **Fix:** Appended `&& node tests/goal-progress-tracker.test.js` to the test script in package.json.
- **Files modified:** package.json
- **Commit:** 78409d0

## Open Items

- **Session-restore rehydration deferred.** `GoalProgressTracker.fromJSON` exists in the module but is NOT yet wired into transcript-store.js / session-schema.js restore paths. The in-memory path (fresh session, no restore) is the primary verification target and works correctly. A future plan should walk the session-restore path and call `GoalProgressTracker.fromJSON` to rehydrate `session.goalProgressTracker` from persisted JSON. Documented per plan Action item 5.
- **Operator must run the 9 rerun scaffolds** via `mcp__fsb__run_task` and update VERIFICATION.md attribution-matrix gap C-1 (completion attribution closed). The gsd-executor agent does not have MCP tools.

## Commits

- `ed96cfd` -- feat(227-02): add GoalProgressTracker module with unit tests
- `78409d0` -- feat(227-02): integrate goal-progress check into detectStuck
- `7a854d1` -- docs(227-02): add 9 rerun scaffolds for goal-progress verification

## Self-Check: PASSED

Verified:
- extension/ai/goal-progress-tracker.js exists
- extension/ai/agent-loop.js modified (require + importScripts + detectStuck integration)
- tests/goal-progress-tracker.test.js exists -- 38/38 PASS
- All 9 rerun-227-02-* scaffolds present in baseline/
- All 3 commits (ed96cfd, 78409d0, 7a854d1) present in git log
- `npm test` exit 0 (GUARD-02)
