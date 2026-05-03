# Rerun (Phase 226-01) -- PROMPT-09: Dismiss a cookie banner before interacting with the page

**Phase:** 226 (Prompt Refinement)
**Plan:** 226-01 (System prompt rules)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** [../PROMPT-09.md](../PROMPT-09.md)
**Status:** operator-pending

## Prompt
Open https://www.bbc.com. If a cookie consent banner is shown, click "Reject all" (or the equivalent reject option). Then click the top headline link in the news feed and report the headline text and the destination URL.

## Expected Behavioral Change vs Baseline
NONE. Should still PASS (~7 actions baseline). The cookie-banner + click-headline flow is unaffected by the new rules.

## How to Run
Operator runs `mcp__fsb__run_task` with the prompt above against the Refinements branch with Task 1 edits in place. The gsd-executor agent does NOT have MCP tools -- this scaffold is filled in by the orchestrator post-execution.

---
<!-- BELOW THIS LINE: operator-filled per VERIFY-RECIPE.md -->

## Run Result (operator-filled)

**Run timestamp:**
**Final outcome:**
**Observed category:**
**Root-cause hypothesis:**
**Evidence pointer (log line / range):**
**Notes:**
