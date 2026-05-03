# Rerun (Phase 226-02) -- PROMPT-10: Select a value from a custom (non-native) dropdown

**Phase:** 226 (Prompt Refinement)
**Plan:** 226-02 (Tool annotations + dropdown two-click pattern)
**Verifies:** TOOL_REGISTRY two-click custom-dropdown pattern in select_option + click descriptions
**Baseline reference:** [../PROMPT-10.md](../PROMPT-10.md)
**Status:** operator-pending

## Prompt
Open https://react-select.com/home. Find the first single-select dropdown at the top of the page (placeholder "Select..."), open it, and choose the option labeled "Green". Report the dropdown's displayed value after selection.

## Expected Behavioral Change vs Baseline
Autopilot opens the dropdown with `click e<dropdown>`, then picks Green with `click e<option>`. Total action count should drop dramatically from baseline 254 to ~10-30. Final outcome `success` with reported value "Green". If still stuck, the trace should show genuinely-distinct attempts at the two-click pattern (not 254 repeats of `select_option` returning no-op).

## How to Run
Operator runs `mcp__fsb__run_task`. Executor agent does not have MCP tools; orchestrator fills the Run Result section post-execution.

---
<!-- BELOW THIS LINE: operator-filled per VERIFY-RECIPE.md -->

## Run Result (operator-filled)

**Run timestamp:**
**Final outcome:**
**Observed category:**
**Root-cause hypothesis:**
**Evidence pointer (log line / range):**
**Notes:**
