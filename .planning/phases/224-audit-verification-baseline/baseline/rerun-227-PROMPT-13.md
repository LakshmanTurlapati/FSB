---
phase: 227
plan: 01
baseline_prompt: PROMPT-13
predicted_failure_category: extraction
verifies: PASS prompt -- regression check (no false-positive stuck_action_repetition)
status: operator-pending
---

# Rerun (Phase 227-01) -- PROMPT-13: Wikipedia exact-sentence extraction

**Phase:** 227 (Target Precision)
**Plan:** 227-01 (Action-repetition stuck detector + outcome attribution)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** No baseline-PROMPT-13.md scaffold exists in baseline/. Source the prompt from the canonical Phase 224 prompt set, or substitute an equivalent Wikipedia exact-sentence extraction task. See [./rerun-226-PROMPT-13.md](./rerun-226-PROMPT-13.md) for the prior rerun's working prompt.
**Status:** operator-pending

## Prompt
Open https://en.wikipedia.org/wiki/Browser_extension and return the exact text of the first sentence under the "History" section heading.

## Original Baseline Outcome
PASS via simple navigate -> read_page -> done flow. Read-only iterations (read_page) are the read-only sentinel and do not increment the strict counter, so this prompt is structurally immune to false positives from the Phase 227-01 detector.

## Phase 227-01 Hypothesis
Expect normal completion with no false-positive stuck_action_repetition fire (regression check). The read-only sentinel handling explicitly skips read_page from the strict counter (proven by Test 5 in tests/stuck-action-repetition.test.js).

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
