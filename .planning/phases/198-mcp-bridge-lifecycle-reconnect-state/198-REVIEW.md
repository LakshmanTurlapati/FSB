---
phase: 198-mcp-bridge-lifecycle-reconnect-state
reviewed: 2026-04-22T17:18:47Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - background.js
  - mcp-server/build/index.js
  - mcp-server/src/bridge.ts
  - mcp-server/src/diagnostics.ts
  - mcp-server/src/http.ts
  - mcp-server/src/index.ts
  - mcp-server/src/types.ts
  - tests/mcp-bridge-client-lifecycle.test.js
  - tests/mcp-bridge-topology.test.js
  - ws/mcp-bridge-client.js
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 198: Code Review Report

**Reviewed:** 2026-04-22T17:18:47Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the MCP bridge lifecycle, relay topology, diagnostics, HTTP entrypoint, extension client reconnect state, background wake hooks, and the new lifecycle/topology tests. The bridge behavior is generally coherent and the targeted tests pass, but the new relay handshake expands the local WebSocket control surface without origin/authentication checks. I also found one runtime guard issue in the background alarm path and one test that currently passes before exercising the promotion behavior it claims to cover.

Verification run:

```bash
node tests/mcp-bridge-client-lifecycle.test.js
node tests/mcp-bridge-topology.test.js
```

Both commands passed.

## Critical Issues

### CR-01: Relay WebSocket Handshake Accepts Untrusted Browser Origins

**File:** `mcp-server/src/bridge.ts:256`

**Issue:** The hub accepts every WebSocket connection and `_handleNewConnection` trusts any first JSON message with `type: "relay:hello"` and an `instanceId` as a relay client. Because browser pages can attempt WebSocket connections to `ws://localhost:7225` and send an `Origin` header, a malicious web origin could impersonate a relay and forward MCP requests to the connected extension. That turns the Phase 198 relay path into an unauthenticated browser-control channel whenever the extension is attached.

**Fix:**

Reject unexpected browser origins before protocol detection, and require an explicit relay authentication mechanism if relays should be trusted beyond same-machine Node clients. For example:

```ts
import type { IncomingMessage } from 'node:http';

private isAllowedWebSocketOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Node relay clients do not send browser Origin.
  return origin.startsWith('chrome-extension://');
}

// In _startAsHub()
this.wss.on('connection', (ws: WsWebSocket, req: IncomingMessage) => {
  if (!this.isAllowedWebSocketOrigin(req)) {
    ws.close(1008, 'Forbidden origin');
    return;
  }
  this._handleNewConnection(ws);
});
```

Prefer a configured extension-origin allowlist and a relay token/shared secret over accepting all `chrome-extension://` origins.

## Warnings

### WR-01: Background Alarm Handler Can Throw If MCP Client Import Fails

**File:** `background.js:11585`

**Issue:** `ws/mcp-bridge-client.js` is imported inside a `try/catch`, so the service worker intentionally continues if that import fails. The alarm listener later references `MCP_RECONNECT_ALARM` unguarded. If the import failed, any alarm event throws a `ReferenceError` before reaching the existing background-agent alarm handling, breaking unrelated scheduled agents too.

**Fix:**

Guard the imported constant the same way `armMcpBridge` guards `mcpBridgeClient`:

```js
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const isMcpReconnectAlarm =
    typeof MCP_RECONNECT_ALARM !== 'undefined' &&
    alarm.name === MCP_RECONNECT_ALARM;

  if (isMcpReconnectAlarm) {
    armMcpBridge('alarm:' + MCP_RECONNECT_ALARM);
    return;
  }

  const agentId = agentScheduler.getAgentIdFromAlarm(alarm.name);
  // ...
});
```

### WR-02: Hub-Exit Promotion Test Passes Before Promotion Is Exercised

**File:** `tests/mcp-bridge-topology.test.js:197`

**Issue:** `runHubExitPromotion` waits for `relay.currentMode === 'hub' || relay.currentMode === 'relay'`, but the relay is already in `relay` mode before `hub.disconnect()` runs. The wait returns immediately, and the assertions accept the original relay mode with the old active hub identity, so the test can pass even if hub loss, promotion, or reconnect handling is broken.

**Fix:**

Wait for the actual expected transition in this one-relay scenario:

```js
hub.disconnect();
await waitFor(
  () => relay.currentMode === 'hub' &&
    relay.topology?.activeHubInstanceId === 'test-relay',
  'hub-exit-promotion',
  1000,
  10
);

assertEqual(relay.currentMode, 'hub', 'relay promotes to hub after original hub exits');
assertEqual(relay.topology?.activeHubInstanceId, 'test-relay', 'promoted relay reports itself as active hub');
```

---

_Reviewed: 2026-04-22T17:18:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
