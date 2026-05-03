---
phase: 227-target-precision
plan: 01
subsystem: extension/ai
tags: [stuck-detection, attribution, autopilot]
requires: []
provides:
  - STUCK_REASONS constant
  - strict consecutive-action-repetition detector
  - per-source stuck reason attribution on outcomeDetails.reason
affects:
  - extension/ai/turn-result.js
  - extension/ai/agent-loop.js
  - extension/ai/hooks/safety-hooks.js
  - tests/tool-executor-readonly.test.js
  - tests/stuck-action-repetition.test.js
  - package.json
key-files:
  created:
    - tests/stuck-action-repetition.test.js
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-01.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-02.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-04.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-05.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-06.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-07.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-09.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-10.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-PROMPT-13.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-227-EDGE-11.md
  modified:
    - extension/ai/turn-result.js
    - extension/ai/agent-loop.js
    - extension/ai/hooks/safety-hooks.js
    - tests/tool-executor-readonly.test.js
    - package.json
decisions:
  - Threshold values warn=3 / force-stop=5 chosen to match the plan contract and to give the model two chances to self-correct after warning
  - Read-only sentinel ('_read_only_') skipped from the strict counter so pure read iterations never increment OR reset the consecutive counter
  - Strict counter takes precedence over the windowed/no-change paths when both fire (more specific reason wins)
  - Reason 'stuck_force_stop' literal removed in the inline path; replaced by reasonCode pulled from detectStuck (defaults to 'stuck_dom_hash' for backward compat)
metrics:
  tasks: 3
  files_modified: 5
  files_created: 11
  duration_min: 25
  completed_date: 2026-05-02
---

# Phase 227 Plan 01: Action-repetition stuck detector + outcome attribution Summary

**One-liner:** Strict consecutive-fingerprint counter (warn@3 / force-stop@5) closes the PROMPT-10 / PROMPT-05 / EDGE-11 looping gap and attributes stuck force-stops via outcomeDetails.reason (stuck_action_repetition vs stuck_dom_hash).

## Threshold Rationale

- `actionRepeatWarnThreshold = 3` -- emits a WARNING hint giving the model an explicit instruction set (alternate selector, execute_js framework events, keyboard navigation, fail_task)
- `actionRepeatForceStopThreshold = 5` -- after two more identical attempts past the warn, force-stop with `outcomeDetails.reason = 'stuck_action_repetition'`
- Independent of the existing windowed `isRepetitive` heuristic (60% match in last-10 window); both can fire and the strict path wins for attribution

## Reason-code Migration

Searched for all `'stuck_force_stop'` literals across `extension/`, `tests/`, and `mcp/src`:
- Only consumer was `extension/ai/agent-loop.js` itself (the inline force-stop path) -- migrated cleanly to `stuckCheck.reasonCode || 'stuck_dom_hash'`.
- Hook-pipeline path (line ~2050) updated to honor `stoppingResult.reasonCode` when `source === 'stuckDetection'`, falling back to the safety-reason mapper otherwise.
- `safety-hooks.js` `createStuckDetectionHook` now forwards `reasonCode` from the detector through the pipeline contract.
- No external consumer pinned on the old literal; no alias entry needed in STUCK_REASONS.

## Test Pass Count

- `tests/stuck-action-repetition.test.js`: 16 / 16 PASS (new)
- `tests/tool-executor-readonly.test.js`: 35 / 35 PASS (updated -- the existing 6x-click warning assertion now reflects warn@3 instead of windowed@6)
- Full `npm test`: GREEN (GUARD-02 satisfied)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing `tests/tool-executor-readonly.test.js` regressed under stricter thresholds**
- **Found during:** Task 1 verification
- **Issue:** The existing test ran 6 identical click(e28) iterations and asserted `shouldForceStop=false`. Under the new strict consecutive counter (warn@3, force-stop@5), iteration 5 force-stops -- breaking the existing assertion.
- **Fix:** Rewrote the assertion to drive only 3 iterations and assert the warn phase (`shouldForceStop=false`, `reasonCode='stuck_action_repetition'`). The downstream "20 iterations -> force-stop" assertion still passes unchanged.
- **Files modified:** tests/tool-executor-readonly.test.js
- **Commit:** 0e3bc9f

**2. [Rule 3 - Blocking] `tests/tool-executor-readonly.test.js` and `tests/stuck-action-repetition.test.js` not registered in `npm test`**
- **Found during:** Task 2
- **Issue:** The existing tool-executor-readonly.test.js was never wired into the npm test script chain. Adding only the new test would still leave detectStuck partially uncovered by `npm test`.
- **Fix:** Appended `node tests/stuck-action-repetition.test.js` to the npm test chain in package.json. (Did NOT add tool-executor-readonly because it relies on Chrome runtime mocks that may flake; left as a manually-invoked guard test for now -- recommend a follow-up plan to harden it.)
- **Files modified:** package.json
- **Commit:** 758f02c

## Reminder for Operator

The 10 rerun scaffolds in `.planning/phases/224-audit-verification-baseline/baseline/rerun-227-*.md` MUST be filled in via MCP `mcp__fsb__run_task` before TARGET-02 can be signed off. The gsd-executor agent does not have MCP tools, so this verification is operator-driven.

Pass/Fail criteria are documented inside each scaffold:
- Target prompts (PROMPT-05, PROMPT-10, EDGE-11): PASS if `outcomeDetails.reason='stuck_action_repetition'` AND actionCount < 50 (or successful completion in <50 actions)
- Regression prompts (PROMPT-01, 02, 04, 06, 07, 09, 13): PASS if normal completion AND no stuck_action_repetition false positive

## Self-Check: PASSED

- [x] extension/ai/turn-result.js exports STUCK_REASONS with 3 codes
- [x] extension/ai/agent-loop.js detectStuck has strict consecutive counter independent of windowed heuristic
- [x] tests/stuck-action-repetition.test.js (16 assertions PASS)
- [x] 10 rerun scaffolds present at .planning/phases/224-audit-verification-baseline/baseline/rerun-227-*.md
- [x] Full `npm test` green (GUARD-02)
- [x] No autopilot tools removed (GUARD-03)
- [x] Commits 0e3bc9f, 758f02c, latest scaffolds commit all in git history
