---
phase: 227
plan: 02
baseline_prompt: PROMPT-02
predicted_failure_category: form-submission
verifies: PASS prompt -- regression check (form_fill task-type override should kick in)
status: operator-pending
---

# Rerun (Phase 227-02) -- PROMPT-02: Selenium web-form fill + submit

**Phase:** 227 (Target Precision)
**Plan:** 227-02 (Goal-progress unique-state-vector heuristic)
**Verifies:** PASS prompt -- regression check (also exercises form_fill override path)
**Baseline reference:** [../baseline/PROMPT-02.md](../baseline/PROMPT-02.md)
**Status:** operator-pending

## Prompt
Open https://www.selenium.dev/selenium/web/web-form.html and fill the form: set the text input to "Lakshman Turlapati", set the password field to "test1234", set the textarea to "Hello from FSB autopilot baseline", then submit the form. Report the confirmation message shown after submission.

## Original Baseline Outcome
See [../baseline/PROMPT-02.md](../baseline/PROMPT-02.md). Baseline PASS. This prompt is detected as task type `form` by ai-integration.js detectTaskType() so the goal-progress windowSize override of 16 (vs default 8) applies. Even if some field interactions share an outcome class, the larger window should prevent a false positive.

## Phase 227-02 Hypothesis
Expect normal completion with no false-positive `stuck_no_goal_progress` fire. Form-filling adds new focused-element ids (each input has a different selector) and the form_fill override raises the stagnation tolerance to 16 iterations.

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
PASS if `outcomeDetails.reason in {end_turn, success}` AND no `stuck_no_goal_progress` fire occurred during the session. FAIL if a `stuck_no_goal_progress` warning or force-stop is observed (false positive on a known-PASS prompt).
