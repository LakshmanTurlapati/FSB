---
phase: 227
plan: 02
baseline_prompt: PROMPT-13
predicted_failure_category: extraction
verifies: PASS prompt -- regression check (no false-positive stuck_no_goal_progress)
status: operator-pending
---

# Rerun (Phase 227-02) -- PROMPT-13: Wikipedia exact-sentence extraction

**Phase:** 227 (Target Precision)
**Plan:** 227-02 (Goal-progress unique-state-vector heuristic)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** No baseline-PROMPT-13.md scaffold exists in baseline/. See [./rerun-227-PROMPT-13.md](./rerun-227-PROMPT-13.md) for the canonical Phase 227-01 rerun's working prompt.
**Status:** operator-pending

## Prompt
Open https://en.wikipedia.org/wiki/Browser_extension and return the exact text of the first sentence under the "History" section heading.

## Original Baseline Outcome
PASS via simple navigate -> read_page -> done flow. Read-only iterations contribute to the actionOutcomes signal as a distinct outcome key (e.g. `read_page:ok:nf`), so the tracker grows on the read step and again when scroll/extract introduces new selectors.

## Phase 227-02 Hypothesis
Expect normal completion with no false-positive `stuck_no_goal_progress` fire. The flow visits a single URL but produces multiple distinct outcome keys and (if any selectors are involved) distinct focused-element ids -- and total iterations stay well under the windowSize=8 grace.

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
