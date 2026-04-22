---
phase: 199-mcp-tool-routing-contract
reviewed: 2026-04-22T23:52:24Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - background.js
  - mcp-server/src/errors.ts
  - package.json
  - tests/mcp-restricted-tab.test.js
  - tests/mcp-tool-routing-contract.test.js
  - ws/mcp-bridge-client.js
  - ws/mcp-tool-dispatcher.js
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 199: Code Review Report

**Reviewed:** 2026-04-22T23:52:24Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 199 MCP route-contract, restricted-tab recovery, error mapping, bridge client, package test wiring, and focused regression tests. Focused Phase 199 verification passed locally after rebuilding the MCP server:

- `npm --prefix mcp-server run build`
- `node tests/mcp-tool-routing-contract.test.js`
- `node tests/mcp-restricted-tab.test.js`

The route allowlist and restricted-tab recovery direction are mostly aligned, but the new observability detail route can expose typed secrets from action history, and the `run_task` bridge path listens for a runtime event shape the extension does not emit.

## Critical Issues

### CR-01: Session detail exposes raw action params, including typed secrets

**File:** `ws/mcp-tool-dispatcher.js:456`

**Issue:** `sanitizeSessionDetail()` returns the last 100 `session.actionHistory` entries by recursively sanitizing keys, but action params are persisted verbatim in `background.js:6195`. Typed values are commonly stored as `params.text` for `type` / `typeWithKeys` actions, and `text` is not considered sensitive by `isSensitiveKey()`. As a result, `get_session_detail` can return passwords, MFA codes, messages, form data, or other user-entered secrets over MCP. A direct harness confirms `params: { selector: "#password", text: "super-secret" }` is returned unchanged.

**Fix:**
```javascript
function sanitizeActionHistoryEntry(action) {
  const params = action?.params || {};
  const result = action?.result || {};
  return {
    tool: action?.tool || null,
    timestamp: action?.timestamp || null,
    iteration: action?.iteration || null,
    selector: boundedString(params.selector, 250) || undefined,
    domain: params.url ? getDomainFromUrl(params.url) : undefined,
    result: {
      success: Boolean(result.success),
      error: result.error ? boundedString(result.error, 500) : undefined
    }
  };
}

sanitized.actionHistory = session.actionHistory
  .slice(-100)
  .map(sanitizeActionHistoryEntry);
```

Add a regression test where a session contains `params.text`, `params.value`, and payment/credential-like result fields, and assert none of those raw values appear in `get_session_detail`.

## Warnings

### WR-01: `run_task` waits for event names the extension does not emit

**File:** `ws/mcp-bridge-client.js:617`

**Issue:** `_handleStartAutomation()` listens for `message.type === 'automationProgress'`, `automationComplete`, and `automationError`, but the reviewed background paths emit Chrome runtime messages with `action: 'automationComplete'` / `action: 'automationError'` instead, for example `background.js:7974`. The listener therefore misses completion/error events, so MCP `run_task` can sit until the five-minute timeout and progress notifications are not delivered with the stable payload shape.

**Fix:** Normalize both message shapes before branching:
```javascript
const eventType = message.type || message.action;
if (eventType === 'automationProgress' && message.sessionId === sessionId) {
  this._sendProgress(mcpMsgId, {
    taskId: sessionId,
    progress: message.progress || 0,
    phase: message.phase || 'executing',
    eta: message.eta || null,
    action: message.actionSummary || message.currentAction || null,
  });
}

if (eventType === 'automationComplete' && message.sessionId === sessionId) {
  clearTimeout(timeout);
  chrome.runtime.onMessage.removeListener(listener);
  resolve({
    sessionId,
    status: message.outcome || (message.partial ? 'partial' : 'completed'),
    result: message.result || {},
  });
}
```

Add a focused bridge-client test that feeds `chrome.runtime.onMessage` an `action: 'automationComplete'` event and asserts `run_task` resolves before timeout.

## Info

### IN-01: Route-contract tests assert presence but not behavior or payload contracts

**File:** `tests/mcp-tool-routing-contract.test.js:237`

**Issue:** The new contract test verifies `hasMcpToolRoute()` / `hasMcpMessageRoute()` for each route, but it does not execute representative handlers or assert payload shapes/redaction. That allowed the `run_task` completion-listener mismatch and session-detail secret exposure to remain outside the focused Phase 199 suite.

**Fix:** Extend the contract suite with behavior cases for at least one route in each family: browser/tab route privacy (`list_tabs`), autopilot progress/completion shape (`run_task`), observability redaction (`get_session_detail`), and restricted read recovery (`read_page` / `get_dom_snapshot`).

---

_Reviewed: 2026-04-22T23:52:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
