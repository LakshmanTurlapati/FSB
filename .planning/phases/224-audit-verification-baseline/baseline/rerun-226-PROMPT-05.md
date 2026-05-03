# Rerun (Phase 226-01) -- PROMPT-05: Scroll an infinite-loading feed and capture posts

**Phase:** 226 (Prompt Refinement)
**Plan:** 226-01 (System prompt rules)
**Verifies:** SCROLL-LOAD pagination decision rule + NO-PROGRESS HEURISTIC
**Baseline reference:** [../PROMPT-05.md](../PROMPT-05.md)
**Status:** operator-pending

## Prompt
Open https://news.ycombinator.com/. Scroll down until at least 30 story rows are loaded into the DOM (HN paginates with a "More" link near the bottom -- clicking it counts as load). Then return the titles of stories 25 through 30 in a numbered list.

## Expected Behavioral Change vs Baseline
After ~30 stories visible, autopilot clicks the "More" link rather than scrolling indefinitely. Even if upstream LLM API timeout still hits, the action history should show `click <More-link-ref>` instead of N consecutive `scroll down` calls. The new SCROLL-LOAD TASKS rule in the TOOL SELECTION GUIDE explicitly cites HN as the canonical example, and the NO-PROGRESS HEURISTIC caps repeat-scroll attempts.

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
