---
phase: 227
plan: 02
baseline_prompt: PROMPT-01
predicted_failure_category: search-result-click
verifies: PASS prompt -- regression check (no false-positive stuck_no_goal_progress)
status: operator-pending
---

# Rerun (Phase 227-02) -- PROMPT-01: Google search and click first organic result

**Phase:** 227 (Target Precision)
**Plan:** 227-02 (Goal-progress unique-state-vector heuristic)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** [../baseline/PROMPT-01.md](../baseline/PROMPT-01.md)
**Status:** operator-pending

## Prompt
Search Google for "wireless mouse" and click the first organic (non-sponsored) result. Wait for the destination page to load and report its title.

## Original Baseline Outcome
See [../baseline/PROMPT-01.md](../baseline/PROMPT-01.md). Baseline PASS within ~29 actions. A regression here would indicate the new windowed unique-state-vector tracker is firing as a false positive on legitimate search-and-navigate flows.

## Phase 227-02 Hypothesis
Expect normal completion with no false-positive `stuck_no_goal_progress` fire. The tracker grows on each new URL (search results page -> destination page) and on each distinct outcome class, so canonical search-then-click PASS prompts never stagnate for 8+ iterations.

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
