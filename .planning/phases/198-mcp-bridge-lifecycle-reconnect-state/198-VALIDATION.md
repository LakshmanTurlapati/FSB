---
phase: 198
slug: mcp-bridge-lifecycle-reconnect-state
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-22
---

# Phase 198 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node.js assertion scripts plus MCP TypeScript build |
| **Config file** | none - root `package.json` chains individual Node scripts |
| **Quick run command** | `npm --prefix mcp-server run build && node tests/mcp-bridge-client-lifecycle.test.js && node tests/mcp-bridge-topology.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds for focused Phase 198 checks |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix mcp-server run build && node tests/mcp-bridge-client-lifecycle.test.js && node tests/mcp-bridge-topology.test.js`
- **After every plan wave:** Run the focused Phase 198 checks above; run `npm test` only when unrelated known failures are resolved or explicitly required by the plan.
- **Before `$gsd-verify-work`:** Focused Phase 198 checks must be green and manual lifecycle smoke evidence must be captured.
- **Max feedback latency:** 30 seconds for focused automated feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 198-W0-01 | 01 | 0 | BRIDGE-01, BRIDGE-03 | T-198-01 / T-198-03 | Bridge lifecycle state records only non-secret status, timestamps, wake reasons, and disconnect classes | unit | `node tests/mcp-bridge-client-lifecycle.test.js` | No - Wave 0 | pending |
| 198-W0-02 | 01 | 0 | BRIDGE-02, BRIDGE-04 | T-198-02 / T-198-04 | Hub/relay state distinguishes hub reachability from extension reachability | integration | `node tests/mcp-bridge-topology.test.js` | No - Wave 0 | pending |
| 198-BUILD | all | all | BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04 | T-198-05 | MCP TypeScript bridge types and runtime compile after each change | build | `npm --prefix mcp-server run build` | Yes | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/mcp-bridge-client-lifecycle.test.js` - covers browser-first reconnect and service-worker wake re-arming with fake `chrome`, fake `WebSocket`, fake timers/alarms, and storage assertions.
- [ ] `tests/mcp-bridge-topology.test.js` - covers server-first attach and multi-host hub/relay recovery with real `ws` sockets and a configurable test port.
- [ ] `WebSocketBridge` constructor options - enable tests to use ephemeral ports, deterministic instance IDs, short handshake timeouts, and short promotion jitter without changing CLI defaults.
- [ ] Optional `mcpBridgeClient.getState()` / `recordWake()` API - expose deterministic non-secret extension lifecycle state for tests and future diagnostics.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Start `fsb-mcp-server` after Chrome/FSB is already open | BRIDGE-01 | Requires a loaded MV3 extension profile and real service-worker lifecycle | Open Chrome with FSB loaded, confirm no MCP server on port 7225, start `npx -y fsb-mcp-server status --timeout 15000`, and capture extension attachment without extension reload. |
| Start Chrome/FSB after an MCP host is already listening | BRIDGE-02 | Requires real browser startup ordering | Start `npx -y fsb-mcp-server wait-for-extension --timeout 15000`, open Chrome with FSB loaded, and capture successful attachment inside the bounded window. |
| Wake service worker after suspension and re-arm bridge | BRIDGE-03 | Chrome controls service-worker termination timing | Let the service worker idle, trigger extension activity such as sidepanel open or content message, and capture bridge state showing a wake reason plus reconnect attempt. |
| Hub exits while multiple MCP hosts exist | BRIDGE-04 | Multi-process host recovery is partly OS/process-lifecycle dependent | Start two MCP host processes, confirm hub/relay topology, stop the hub process, and capture relay promotion/reconnect plus eventual extension reachability. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing test references.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 30 seconds for focused automated checks.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
