---
phase: 198-mcp-bridge-lifecycle-reconnect-state
fixed_at: 2026-04-22T17:32:15Z
review_path: .planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 198: Code Review Fix Report

**Fixed at:** 2026-04-22T17:32:15Z
**Source review:** .planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Relay WebSocket Handshake Accepts Untrusted Browser Origins

**Files modified:** `mcp-server/src/bridge.ts`, `mcp-server/src/types.ts`, `tests/mcp-bridge-topology.test.js`
**Commit:** 4707397
**Applied fix:** Added WebSocket Origin validation for hub connections, allowed local Node relay clients without an Origin, allowed configured browser-origin prefixes, and added a topology regression that rejects a hostile browser-origin relay handshake with close code 1008.

### WR-01: Background Alarm Handler Can Throw If MCP Client Import Fails

**Files modified:** `background.js`
**Commit:** 7ee7d47
**Applied fix:** Guarded the MCP reconnect alarm comparison with `typeof MCP_RECONNECT_ALARM !== 'undefined'` so failed MCP client imports cannot throw before background-agent alarm handling.

### WR-02: Hub-Exit Promotion Test Passes Before Promotion Is Exercised

**Files modified:** `tests/mcp-bridge-topology.test.js`
**Commit:** 87ffa15
**Applied fix:** Updated the hub-exit promotion test to wait until the relay becomes `hub` and reports itself as `activeHubInstanceId`, then assert that exact promoted state.

## Verification

- `node --check background.js`
- `npm --prefix mcp-server run build`
- `node tests/mcp-bridge-client-lifecycle.test.js`
- `node tests/mcp-bridge-topology.test.js`

All verification commands passed. Generated build drift from `mcp-server/ai/tool-definitions.cjs`, `mcp-server/build/version.d.ts`, and `mcp-server/build/version.js` was restored after build verification.

---

_Fixed: 2026-04-22T17:32:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
