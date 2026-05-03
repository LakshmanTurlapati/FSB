---
phase: 227
plan: 02
baseline_prompt: PROMPT-10
predicted_failure_category: historical-element
verifies: TARGET prompt -- expect early termination via stuck_no_goal_progress OR stuck_action_repetition
status: operator-pending
---

# Rerun (Phase 227-02) -- PROMPT-10: Custom (non-native) dropdown selection

**Phase:** 227 (Target Precision)
**Plan:** 227-02 (Goal-progress unique-state-vector heuristic)
**Verifies:** TARGET prompt -- canonical varying-selector loop
**Baseline reference:** [../baseline/PROMPT-10.md](../baseline/PROMPT-10.md)
**Status:** operator-pending

## Prompt
Open https://react-select.com/home. Find the first single-select dropdown at the top of the page (placeholder "Select..."), open it, and choose the option labeled "Green". Report the dropdown's displayed value after selection.

## Original Baseline Outcome
Baseline (see [../baseline/PROMPT-10.md](../baseline/PROMPT-10.md)) ran 254 actions before timing out. Plan 227-01's strict consecutive-fingerprint counter targets the same-selector case; Plan 227-02 adds coverage for the varying-selector case where the model alternates between open-dropdown / close-dropdown / scroll / re-open with slightly different selectors.

## Phase 227-02 Hypothesis
Expect autopilot to terminate with `outcomeDetails.reason='stuck_no_goal_progress'` within ~10-12 iterations IF the action-repetition signal (Plan 227-01) does not fire first. If the canonical same-fingerprint loop occurs, expect `stuck_action_repetition` instead (precedence rule -- more specific signal wins). Either reasonCode counts as a SUCCESS attribution.

If the model successfully completes via the two-click pattern (open-dropdown then click option) added by Phase 226-02, that is also a PASS.

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
  (b) `outcomeDetails.reason in {end_turn, success}` with the dropdown successfully set to "Green" AND actionCount < 50.
FAIL if actionCount >= 50 OR if the session times out without firing either stuck reason code.
