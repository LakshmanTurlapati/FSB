# Rerun (Phase 226-01) -- PROMPT-06: Compare prices across three product tabs

**Phase:** 226 (Prompt Refinement)
**Plan:** 226-01 (System prompt rules)
**Verifies:** PASS prompt -- regression check
**Baseline reference:** [../PROMPT-06.md](../PROMPT-06.md)
**Status:** operator-pending

## Prompt
Open three new tabs to these URLs:
1. https://www.amazon.com/dp/B07FZ8S74R
2. https://www.bestbuy.com/site/logitech-mx-master-3s-wireless-laser-mouse-graphite/6509650.p
3. https://www.walmart.com/ip/Logitech-MX-Master-3S/1849623898

For each tab, extract the product price. Then return a markdown table with columns: Retailer, Price, URL. Highlight which retailer has the lowest price.

## Expected Behavioral Change vs Baseline
NONE. Should still PASS (~23 actions baseline). Multi-tab navigation and price extraction are unaffected by the new rules.

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
