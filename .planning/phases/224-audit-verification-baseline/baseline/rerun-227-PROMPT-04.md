---
phase: 227
plan: 01
baseline_prompt: PROMPT-04
predicted_failure_category: canvas-click
verifies: PASS prompt -- regression check (no false-positive stuck_action_repetition)
status: operator-pending
---

# Rerun (Phase 227-01) -- PROMPT-04: Draw a labeled rectangle on Excalidraw

**Phase:** 227 (Target Precision)
**Plan:** 227-01 (Action-repetition stuck detector + outcome attribution)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** [../baseline/PROMPT-04.md](../baseline/PROMPT-04.md)
**Status:** operator-pending

## Prompt
Open https://excalidraw.com. Select the rectangle tool from the toolbar, then draw a rectangle in the center of the canvas roughly 200x100 pixels. Double-click inside the rectangle and type "Hello FSB". Click outside the rectangle to commit the text. Report whether the rectangle and label are visible.

## Original Baseline Outcome
See [../baseline/PROMPT-04.md](../baseline/PROMPT-04.md). Baseline established as PASS via execute_js mouse-event sequencing on the canvas. Distinct execute_js code blocks produce distinct fingerprints (code-prefix-based fingerprint).

## Phase 227-01 Hypothesis
Expect normal completion with no false-positive stuck_action_repetition fire (regression check). Watch for a regression where execute_js calls with similar code prefixes accidentally collapse to the same fingerprint and trip the counter.

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
PASS if `outcomeDetails.reason in {end_turn, success}` AND no `stuck_action_repetition` fire occurred during the session. FAIL if a stuck_action_repetition force-stop is observed (false positive on a known-PASS prompt).
