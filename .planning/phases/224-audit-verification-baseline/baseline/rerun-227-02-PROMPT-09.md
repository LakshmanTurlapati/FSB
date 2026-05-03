---
phase: 227
plan: 02
baseline_prompt: PROMPT-09
predicted_failure_category: cookie-consent-then-navigate
verifies: PASS prompt -- regression check (no false-positive stuck_no_goal_progress)
status: operator-pending
---

# Rerun (Phase 227-02) -- PROMPT-09: BBC cookie reject + headline click

**Phase:** 227 (Target Precision)
**Plan:** 227-02 (Goal-progress unique-state-vector heuristic)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** [../baseline/PROMPT-09.md](../baseline/PROMPT-09.md)
**Status:** operator-pending

## Prompt
Open https://www.bbc.com. If a cookie consent banner is shown, click "Reject all" (or the equivalent reject option). Then click the top headline link in the news feed and report the headline text and the destination URL.

## Original Baseline Outcome
See [../baseline/PROMPT-09.md](../baseline/PROMPT-09.md). Baseline PASS via consent-then-navigate flow. The URL signal grows when navigating to the headline destination.

## Phase 227-02 Hypothesis
Expect normal completion with no false-positive `stuck_no_goal_progress` fire. Distinct selectors for consent banner vs headline link, plus the destination navigation, all contribute to tracker growth.

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
