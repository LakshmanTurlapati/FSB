---
phase: 227
plan: 02
baseline_prompt: EDGE-11
predicted_failure_category: edge-canvas-spatial
verifies: TARGET prompt -- expect stuck_no_goal_progress OR stuck_action_repetition on canvas-stuck loop
status: operator-pending
---

# Rerun (Phase 227-02) -- EDGE-11: Solitaire canvas drag (7♠ onto 8♥)

**Phase:** 227 (Target Precision)
**Plan:** 227-02 (Goal-progress unique-state-vector heuristic)
**Verifies:** TARGET prompt -- canvas spatial loop where actions vary but no progress
**Baseline reference:** [../baseline/EDGE-11.md](../baseline/EDGE-11.md)
**Status:** operator-pending

## Prompt
Open https://www.solitr.com/. Wait for the game to deal a fresh hand. Find the 7 of Spades on the tableau (one of the seven columns at the bottom). Find the 8 of Hearts. Drag the 7 of Spades onto the 8 of Hearts. Confirm the move was accepted (the 7 should sit beneath the 8 in the same column).

## Original Baseline Outcome
See [../baseline/EDGE-11.md](../baseline/EDGE-11.md). Canvas-rendered cards have no DOM nodes, so autopilot must use vision/coords. Baseline failed with the model issuing many distinct CDP coordinate attempts -- each with a slightly different (x,y) tuple, so the action-repetition fingerprint never matched two iterations in a row, but no goal-progress occurred (URL stayed on solitr.com, no successful drop).

## Phase 227-02 Hypothesis
Expect autopilot to terminate with `outcomeDetails.reason='stuck_no_goal_progress'` within ~10-12 iterations IF the action-repetition signal does not fire. The varying CDP coordinates produce different fingerprints (so 227-01 may not fire) but the same URL and the same outcome class (`drag:ok:fx` or similar) -- exactly the pattern this heuristic targets.

If the action-repetition counter happens to catch a same-coordinate burst, expect `stuck_action_repetition` instead (precedence -- more specific wins).

## How to Run
Operator runs `mcp__fsb__run_task` with the prompt above against the Refinements branch with Plans 227-01 + 227-02 edits in place. The gsd-executor agent does NOT have MCP tools -- this scaffold is filled in by the orchestrator post-execution.

---
<!-- BELOW THIS LINE: operator-filled per VERIFY-RECIPE.md -->

## Run Result (operator-filled via mcp__fsb__run_task)

**Run timestamp:**
**Final outcome:**
**Observed category:**
**actionCount:**
**iterationCount:**
**outcomeDetails.reason:**
**Notes:**

## Pass/Fail Criteria
PASS if EITHER:
  (a) `outcomeDetails.reason in {stuck_no_goal_progress, stuck_action_repetition}` AND actionCount < 50, OR
  (b) `outcomeDetails.reason in {end_turn, success}` with the 7♠ visibly placed under the 8♥ AND actionCount < 50.
FAIL if actionCount >= 50 OR if the session times out without firing either stuck reason code.
