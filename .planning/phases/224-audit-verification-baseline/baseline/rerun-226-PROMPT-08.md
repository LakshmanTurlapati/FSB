# Rerun (Phase 226-01) -- PROMPT-08: Drag-and-drop a list item between columns

**Phase:** 226 (Prompt Refinement)
**Plan:** 226-01 (System prompt rules)
**Verifies:** NO SHORTCUT ESCAPES rule + ACTION-MATCHES-REQUEST self-check
**Baseline reference:** [../PROMPT-08.md](../PROMPT-08.md)
**Status:** operator-pending

## Prompt
Open https://the-internet.herokuapp.com/drag_and_drop. Drag the box labeled "A" onto the box labeled "B" so that their positions swap. Report the final order of the two boxes (left to right).

## Expected Behavioral Change vs Baseline
Autopilot emits `dragdrop e<source> e<target>` (or `drag x1 y1 x2 y2`) instead of `executejs "column.innerHTML = ..."`. Final outcome should be `success` with a real drag, OR a clean `fail` if the drag tool returns no movement -- but NOT a JS-innerHTML escape claiming success. The new NO SHORTCUT ESCAPES rule explicitly forbids the innerHTML substitute, and the ACTION-MATCHES-REQUEST self-check forces autopilot to confirm a drag actually occurred before `done`.

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
