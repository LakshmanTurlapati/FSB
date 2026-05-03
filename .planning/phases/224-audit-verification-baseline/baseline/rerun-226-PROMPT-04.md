# Rerun (Phase 226-01) -- PROMPT-04: Draw a labeled rectangle on Excalidraw

**Phase:** 226 (Prompt Refinement)
**Plan:** 226-01 (System prompt rules)
**Verifies:** PASS prompt -- regression check (canvas task -- ensure DRAG TASKS rule does not break canvas drawing)
**Baseline reference:** [../PROMPT-04.md](../PROMPT-04.md)
**Status:** operator-pending

## Prompt
Open https://excalidraw.com. Select the rectangle tool from the toolbar, then draw a rectangle in the center of the canvas roughly 200x100 pixels. Double-click inside the rectangle and type "Hello FSB". Click outside the rectangle to commit the text. Report whether the rectangle and label are visible.

## Expected Behavioral Change vs Baseline
NONE. Should still PASS. Canvas-drawing `drag` calls (CDP coords) are explicitly allowed by the new DRAG TASKS rule and the canvas PRIORITY TOOLS block already steers toward CDP coordinate tools. The new rule forbids `executejs innerHTML` substitutes for drag, NOT legitimate CDP `drag` on a canvas.

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
