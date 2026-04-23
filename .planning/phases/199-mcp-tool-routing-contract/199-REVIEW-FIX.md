---
phase: 199-mcp-tool-routing-contract
fixed_at: 2026-04-23T00:00:23Z
review_path: .planning/phases/199-mcp-tool-routing-contract/199-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 199: Code Review Fix Report

**Fixed at:** 2026-04-23T00:00:23Z
**Source review:** .planning/phases/199-mcp-tool-routing-contract/199-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-01: Session detail exposes raw action params, including typed secrets

**Files modified:** `ws/mcp-tool-dispatcher.js`, `tests/mcp-tool-routing-contract.test.js`
**Commit:** 45f077a
**Applied fix:** Replaced generic action-history sanitization with a dedicated bounded metadata shape that omits raw params and sensitive result fields. Added a regression for `get_session_detail` proving typed text, value, credential, payment, and prompt/raw-response log values are not returned.

### WR-01: `run_task` waits for event names the extension does not emit

**Files modified:** `ws/mcp-bridge-client.js`, `tests/mcp-bridge-client-lifecycle.test.js`
**Commit:** 76bd975
**Applied fix:** Normalized automation runtime events across `message.type` and `message.action`, preserving the MCP progress payload shape and resolving completion/error events emitted by background runtime messages. Added a focused bridge-client regression for `action: "automationProgress"` and `action: "automationComplete"`.

---

_Fixed: 2026-04-23T00:00:23Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
