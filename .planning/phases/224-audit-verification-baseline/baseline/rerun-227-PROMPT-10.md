---
phase: 227
plan: 01
baseline_prompt: PROMPT-10
predicted_failure_category: historical-element
verifies: TARGET prompt -- expect early termination with reason=stuck_action_repetition
status: operator-pending
---

# Rerun (Phase 227-01) -- PROMPT-10: Select a value from a custom (non-native) dropdown

**Phase:** 227 (Target Precision)
**Plan:** 227-01 (Action-repetition stuck detector + outcome attribution)
**Verifies:** TARGET prompt -- 254-action baseline loop should now terminate early
**Baseline reference:** [../baseline/PROMPT-10.md](../baseline/PROMPT-10.md)
**Status:** operator-pending

## Prompt
Open https://react-select.com/home. Find the first single-select dropdown at the top of the page (placeholder "Select..."), open it, and choose the option labeled "Green". Report the dropdown's displayed value after selection.

## Original Baseline Outcome
Baseline (see [../baseline/PROMPT-10.md](../baseline/PROMPT-10.md)) ran 254 actions before timing out. The model repeatedly invoked `select_option` on the same react-select dropdown element; the call returned hadEffect=true (DOM kept changing as the dropdown opened/closed) so the existing DOM-hash detector never tripped.

## Phase 227-01 Hypothesis
Expect autopilot to terminate with `outcomeDetails.reason='stuck_action_repetition'` within <50 actions instead of running 254 actions to time-limit. This is the canonical scenario the strict consecutive-fingerprint counter was designed to catch (Test 6 in the unit test mirrors this exact pattern).

If the model successfully completes via the two-click pattern (open-dropdown then click option) added by Phase 226-02, that is also a PASS.

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
  (b) `outcomeDetails.reason in {end_turn, success}` with the dropdown successfully set to "Green" AND actionCount < 50.
FAIL if actionCount >= 50 OR if the session times out without firing stuck_action_repetition.
