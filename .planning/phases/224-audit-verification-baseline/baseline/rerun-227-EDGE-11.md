---
phase: 227
plan: 01
baseline_prompt: EDGE-11
predicted_failure_category: edge-canvas-spatial
verifies: TARGET prompt -- expect early termination with reason=stuck_action_repetition
status: operator-pending
---

# Rerun (Phase 227-01) -- EDGE-11: Solitaire -- move 7 of Spades onto 8 of Hearts (canvas + spatial)

**Phase:** 227 (Target Precision)
**Plan:** 227-01 (Action-repetition stuck detector + outcome attribution)
**Verifies:** TARGET prompt -- 105+-action baseline loop should now terminate early
**Baseline reference:** [../baseline/EDGE-11.md](../baseline/EDGE-11.md)
**Status:** operator-pending

## Prompt
Open https://www.solitr.com/. Wait for the game to deal a fresh hand. Find the 7 of Spades on the tableau (one of the seven columns at the bottom). Find the 8 of Hearts. Drag the 7 of Spades onto the 8 of Hearts. Confirm the move was accepted (the 7 should sit beneath the 8 in the same column).

## Original Baseline Outcome
Baseline (see [../baseline/EDGE-11.md](../baseline/EDGE-11.md)) ran 105+ actions before timing out. The model repeatedly attempted drag operations on the same canvas region without making progress; the existing DOM-hash detector did not trip because canvas re-renders kept hadEffect=true.

## Phase 227-01 Hypothesis
Expect autopilot to terminate with `outcomeDetails.reason='stuck_action_repetition'` within <50 actions. Canvas-drag retries with identical (tool, code-prefix) fingerprint trip the strict counter at iteration 5.

If the model successfully completes the drag, that is also a PASS -- the goal is to bound the loop, not mandate failure.

## How to Run
Operator runs `mcp__fsb__run_task` with the prompt above against the Refinements branch with Plan 227-01 edits in place. The gsd-executor agent does NOT have MCP tools -- this scaffold is filled in by the orchestrator post-execution.

---
<!-- BELOW THIS LINE: operator-filled per VERIFY-RECIPE.md -->

## Run Result (operator-filled via mcp__fsb__run_task)

**Run timestamp:**
**Final outcome:**
**Observed category:**
**actionCount:**
**outcomeDetails.reason:**
**Notes:**

## Pass/Fail Criteria
PASS if EITHER:
  (a) `outcomeDetails.reason='stuck_action_repetition'` AND actionCount < 50, OR
  (b) `outcomeDetails.reason in {end_turn, success}` with the drag completed AND actionCount < 50.
FAIL if actionCount >= 50 OR if the session times out without firing stuck_action_repetition.
