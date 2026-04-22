---
phase: 198
slug: mcp-bridge-lifecycle-reconnect-state
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-22
verified: 2026-04-22
auditor: Codex + gsd-security-auditor
---

# Phase 198 - Security

Per-phase security contract for MCP bridge lifecycle and reconnect state. This audit verifies only the threats registered in the Phase 198 plans and the absence of additional summary threat flags.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness -> extension VM | Fake Chrome, alarm, timer, and WebSocket APIs drive extension bridge code without browser privileges. | Non-secret lifecycle test state and assertions. |
| Service-worker event -> bridge client | MV3 lifecycle events wake the worker and can re-arm local MCP bridge connection attempts. | Wake reason, reconnect intent, and live bridge status. |
| Bridge lifecycle -> Chrome storage | Extension bridge state is persisted for live troubleshooting. | Session-scoped status, timestamps, reconnect counters, wake reason, and disconnect class. |
| Local process -> MCP bridge hub port | Local Node clients, relays, and the extension connect to the bridge WebSocket endpoint. | Relay hello/welcome/state messages, MCP requests, and extension socket readiness. |
| Relay MCP host -> hub | Relay hosts forward requests through the active hub and receive topology state from the hub. | Relay identity, active hub identity, extension reachability, relay count, heartbeat, and disconnect reason. |
| Bridge state -> diagnostics/HTTP/status | Bridge topology is exposed to CLI diagnostics and HTTP health. | Metadata only: mode, booleans, counts, instance IDs, timestamps, and disconnect reason. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-198-01 | Information Disclosure | `tests/mcp-bridge-client-lifecycle.test.js` | mitigate | Test asserts lifecycle state is written only to `chrome.storage.session.mcpBridgeState` and omits sensitive field names. | closed | `tests/mcp-bridge-client-lifecycle.test.js:202`, `:218`, `:224`, `:227` |
| T-198-02 | Spoofing | `tests/mcp-bridge-topology.test.js` | mitigate | Topology test uses explicit hub/relay instance IDs and verifies relay handshake is not extension readiness. | closed | `tests/mcp-bridge-topology.test.js:117`, `:125`, `:184`, `:186` |
| T-198-03 | Denial of Service | Fake reconnect timers/alarms | mitigate | Test asserts `MCP_RECONNECT_MAX_MS` is `30000` and reconnect uses one named alarm with `delayInMinutes: 0.5`. | closed | `tests/mcp-bridge-client-lifecycle.test.js:213`, `:225`, `:226` |
| T-198-04 | Tampering | Topology state contract | mitigate | `BridgeTopologyState` keeps `hubConnected` and `extensionConnected` as separate fields. | closed | `mcp-server/src/types.ts:69`, `:72`, `:73`; `mcp-server/src/bridge.ts:213` |
| T-198-05 | Spoofing | `ws/mcp-bridge-client.js` WebSocket endpoint | accept | Phase 198 did not add localhost bridge authentication. Accepted as existing local trust model while this phase avoids secret persistence, preserves narrow routing, and hardens browser-origin relay spoofing. | closed | Accepted risk `AR-198-01`; origin guard evidence `mcp-server/src/bridge.ts:259`, `:270`; regression `tests/mcp-bridge-topology.test.js:233` |
| T-198-06 | Information Disclosure | `chrome.storage.session.mcpBridgeState` | mitigate | `getState()` returns lifecycle metadata only and `_persistState()` writes that state to session storage. | closed | `ws/mcp-bridge-client.js:38`, `:183`, `:193`; no bridge state local write in `ws/mcp-bridge-client.js` |
| T-198-07 | Denial of Service | Reconnect scheduling | mitigate | Single in-memory reconnect timer guard, `MCP_RECONNECT_MAX_MS = 30000`, capped delay, and one named reconnect alarm. | closed | `ws/mcp-bridge-client.js:16`, `:160`, `:166`, `:223` |
| T-198-08 | Tampering | `background.js` wake path arming | mitigate | `runtime.onMessage` rejects non-extension senders before calling `armMcpBridge('runtime.onMessage')`. | closed | `background.js:4096`, `:4098`, `:4104` |
| T-198-09 | Repudiation | Lifecycle state | mitigate | Session state records wake reason, connect attempt time, connected time, and disconnect reason without long-lived history. | closed | `ws/mcp-bridge-client.js:48`, `:49`, `:50`, `:52` |
| T-198-10 | Spoofing | `relay:hello` classification | mitigate | Hub classifies relays only on explicit `relay:hello` with `instanceId`, applies relay topology state, and does not treat relay welcome as extension readiness. | closed | `mcp-server/src/bridge.ts:301`, `:575`, `:586`, `:645` |
| T-198-11 | Tampering | Relay extension readiness | mitigate | Hub builds and broadcasts authoritative `relay:state`; relays apply `extensionConnected` from hub state. | closed | `mcp-server/src/bridge.ts:457`, `:468`, `:653` |
| T-198-12 | Denial of Service | Hub-exit promotion | mitigate | Disconnect clears timers, promotion uses jitter, relay reconnect backs off under `maxReconnectDelayMs`, and the topology test waits for actual promotion. | closed | `mcp-server/src/bridge.ts:95`, `:722`, `:751`; `tests/mcp-bridge-topology.test.js:247`, `:256` |
| T-198-13 | Information Disclosure | Diagnostics and HTTP health | mitigate | Diagnostics and `/health` expose topology metadata only through `BridgeTopologyState`; request payload probes are summarized, not exposed as topology. | closed | `mcp-server/src/types.ts:69`, `mcp-server/src/diagnostics.ts:57`, `mcp-server/src/http.ts:94` |
| T-198-14 | Repudiation | Bridge disconnects | mitigate | Topology state includes `lastExtensionHeartbeatAt` and `lastDisconnectReason`, and status prints disconnect reason. | closed | `mcp-server/src/types.ts:77`, `:78`; `mcp-server/src/index.ts:107` |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-198-01 | T-198-05 | Localhost MCP bridge authentication remains out of scope for Phase 198 and is accepted as part of the existing same-machine bridge trust model. Phase 198 mitigations reduce exposure by keeping lifecycle state non-secret, preserving existing MCP routing scope, and adding browser-origin relay rejection for the newly expanded relay path. | Codex security audit | 2026-04-22 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-22 | 14 | 14 | 0 | Codex + gsd-security-auditor |

No `## Threat Flags` sections were present in the Phase 198 summaries.

---

## Sign-Off

- [x] All threats have a disposition: mitigate or accept.
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-04-22
