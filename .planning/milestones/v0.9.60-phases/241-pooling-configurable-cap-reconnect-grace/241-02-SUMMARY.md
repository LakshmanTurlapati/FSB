---
phase: 241-pooling-configurable-cap-reconnect-grace
plan: 02
subsystem: agent-registry
tags:
  - bridge
  - tabs-onCreated
  - connection-id
  - reconnect-grace
  - agent-scope
  - forced-pool
dependency-graph:
  requires:
    - "241-01 registry primitives (findAgentByTabId, getCap/setCap, stampConnectionId, stageReleaseByConnectionId, cancelStagedRelease, AGENT_CAP_REACHED return shape, persisted stagedReleases envelope)"
    - "Phase 240 ownershipToken bridge threading + AgentScope.captureOwnershipToken pattern"
    - "Phase 238 lazy AgentScope.ensure / agent:register response shape"
  provides:
    - "extension/background.js standalone chrome.tabs.onCreated listener -- forced-pool routing via openerTabId"
    - "extension/utils/agent-registry.js bindTab opts.forced flag + persistence + hydrate restore + getTabMetadata surface"
    - "extension/ws/mcp-bridge-client.js _connectionId minting at onopen + cancel-on-reopen + stage-on-close + getConnectionId helper"
    - "extension/ws/mcp-tool-dispatcher.js handleAgentRegisterRoute typed AGENT_CAP_REACHED branch + connectionId capture/stamp/reflect"
    - "mcp/src/agent-scope.ts captureConnectionId / currentConnectionId + ensure() seed + reset() clear"
    - "mcp/src/tools/{manual,visual-session,autopilot}.ts thread connection_id into outbound bridge payloads"
  affects:
    - "Plan 03 (settings UI; parallel; no file overlap) -- already shipped to RECONNECT_GRACE_MS preview surface; not blocking"
    - "Phase 244 hardening -- multi-bridge model can revisit T-241-09 (server-injected connection_id trust)"
tech-stack:
  added: []
  patterns:
    - "Standalone listener convention (Phase 237 plan-03 precedent) -- chrome.tabs.onCreated added without modifying existing onCreated/onRemoved handlers"
    - "Defensive function-presence probe (`typeof agentScope.currentConnectionId === 'function'`) for additive AgentScope contract"
    - "vm.runInNewContext bridge harness + teardownBridgeClient cleanup helper to cancel reconnect setTimeout so the test process exits cleanly"
    - "Source-extracted listener installation in tests (parser walks balanced parens to extract just the Phase 241 onCreated block from background.js without loading the whole SW)"
key-files:
  created:
    - "tests/agent-pooling.test.js (7 tests; forced-pool routing + dispatcher cap-rejection + connectionId stamp)"
  modified:
    - "extension/background.js (standalone chrome.tabs.onCreated listener block adjacent to the existing third onRemoved listener at line 2548)"
    - "extension/utils/agent-registry.js (bindTab third opts arg + forced flag on _tabMetadata + persisted + hydrate-restored + getTabMetadata surface)"
    - "extension/ws/mcp-bridge-client.js (RECONNECT_GRACE_MS const + _connectionId / _lastKnownConnectionId fields + onopen mint/cancel + onclose stage + getConnectionId helper)"
    - "extension/ws/mcp-tool-dispatcher.js (handleAgentRegisterRoute now reads payload, branches on AGENT_CAP_REACHED, captures+stamps+reflects connectionId)"
    - "mcp/src/agent-scope.ts (private connectionId field + capture/current methods + ensure() seed + reset() clear)"
    - "mcp/src/tools/manual.ts (thread connectionId into mcp:execute-action)"
    - "mcp/src/tools/visual-session.ts (thread connectionId into start_visual_session + end_visual_session)"
    - "mcp/src/tools/autopilot.ts (thread connectionId into run_task + stop_task)"
    - "tests/agent-grace.test.js (5 new bridge-side tests under vm.runInNewContext harness)"
key-decisions:
  - "Q1 RESOLVED extension-side authoritative -- crypto.randomUUID() at every _ws.onopen; threaded into agent:register payload; reflected on response so AgentScope can capture it. Single-bridge-per-process invariant for v0.9.60 makes this safe (CONTEXT D-08)."
  - "bindTab signature extension is fully back-compat -- third arg `opts` defaults to {} when absent; no existing call site touches it. Phase 240 / 241-01 callers continue to work unchanged."
  - "agent-scope.ts changes are additive -- captureConnectionId tolerates null/undefined, currentConnectionId returns null pre-mint; older Phase 238/240 dispatchers that omit connectionId on agent:register response continue to work cleanly."
  - "Test process exit hygiene -- bridge tests need a dedicated teardown helper (teardownBridgeClient) to cancel the reconnect setTimeout the bridge schedules on every onclose. Without it the Node event loop keeps the test alive for the full reconnect delay (~2-3s)."
  - "D-02 verified by Test 5 of agent-pooling.test.js -- forced-pool routing reuses an existing agent record; cap budget unaffected even when full."
patterns-established:
  - "Standalone listener registration -- new onCreated/onRemoved/onAttached listeners go ADJACENT to (not modifying) existing handlers. background.js now has 3 such standalone registry listeners (one onCreated + one onRemoved third for Phase 237 + the keyboard-emulator detach further below)."
  - "connection_id threading mirror of ownershipToken -- agent-scope.ts uses the same single-slot single-helper-pair pattern (capture/current) that Phase 240 used for ownershipToken; tools use the same defensive function-presence probe."
  - "vm-harness bridge tests -- mcp-bridge-client-lifecycle.test.js's harness pattern is the canonical way to instantiate a sandboxed MCPBridgeClient against fake WebSocket + fake chrome + injected globals (agent-grace.test.js Tests 9-13 reuse the pattern)."
requirements-completed:
  - POOL-01
  - POOL-03
  - LOCK-01
  - LOCK-02
metrics:
  duration: "~25min"
  completed: "2026-05-06"
  tasks: 3
  commits: 5
  files_created: 1
  files_modified: 9
---

# Phase 241 Plan 02: Bridge Wiring + AgentScope connection_id Threading Summary

Forced-pool tab routing wired through chrome.tabs.onCreated, bridge connection_id minted at onopen and threaded end-to-end (extension dispatcher -> AgentScope -> outbound payloads), staged-release fired on onclose with cancel-on-reopen for the 10s reconnect grace, and AGENT_CAP_REACHED surfaced typed through the dispatcher -- all sitting on top of Plan 01 registry primitives with zero contract breakage.

## Performance

- Duration: approximately 25 minutes (single TDD pass per task)
- Started: 2026-05-06 (worktree branch Refinements)
- Completed: 2026-05-06
- Tasks: 3 (each TDD)
- Files modified: 9
- Files created: 1

## Accomplishments

- chrome.tabs.onCreated forced-pool listener (POOL-03 / D-01) -- new tabs whose openerTabId points to an agent-owned tab are auto-pooled under the same agent via bindTab(forced: true). New tabs without an opener (Ctrl+T / address-bar) stay unowned. Cap budget unaffected (D-02).
- Bridge connection_id lifecycle wired (LOCK-02 / D-08) -- crypto.randomUUID() minted at every _ws.onopen; previous staged release cancelled on fast reconnect (within RECONNECT_GRACE_MS); _ws.onclose stages release for every agent stamped with the current connection_id.
- Cap-rejection surface complete (POOL-01 / D-03) -- handleAgentRegisterRoute branches on the registry's AGENT_CAP_REACHED return shape and surfaces typed { success: false, code, cap, active } upstream so AgentScope.ensure throws cleanly instead of treating the response as a successful mint.
- connection_id capture + outbound threading -- AgentScope.captureConnectionId / currentConnectionId mirror the Phase 240 ownershipToken pattern; manual.ts / visual-session.ts / autopilot.ts thread connection_id into bridge payloads via the same defensive probe convention.

## Task Commits

| Task | Phase | Commit | Type |
|------|-------|--------|------|
| 1 | RED -- failing pooling tests | c45d9ce | test(241-02) |
| 1 | GREEN -- onCreated listener + dispatcher branches | e25bfc7 | feat(241-02) |
| 2 | RED -- failing bridge tests in agent-grace | 5f8ef42 | test(241-02) |
| 2 | GREEN -- bridge onopen/onclose wiring | a4fac01 | feat(241-02) |
| 3 | AgentScope + tool threading | 81bc963 | feat(241-02) |

Plan metadata commit: this SUMMARY (final commit shipped together with the file).

## Files Created / Modified

### Created

- `tests/agent-pooling.test.js` -- 7 tests covering forced-pool routing (POOL-03 / D-01), unowned-opener no-op, missing-opener no-op, defensive payload guards, D-02 cap-non-consumption, dispatcher AGENT_CAP_REACHED surface, dispatcher connectionId stamp+reflect.

### Modified

- `extension/background.js` -- new standalone chrome.tabs.onCreated listener block at line 2561 (adjacent to the Phase 237 third onRemoved listener). Lookup via `globalThis.fsbAgentRegistryInstance.findAgentByTabId(openerTabId)`; bindTab forced:true on success. Defensive guards on tab.id / openerTabId / registry presence.
- `extension/utils/agent-registry.js` -- bindTab third arg `opts` accepts `{ forced: true }`; the flag is stamped on _tabMetadata, surfaced via getTabMetadata's clone, persisted in the chrome.storage.session envelope's tabMetadata block, and restored at hydrate time.
- `extension/ws/mcp-bridge-client.js` -- RECONNECT_GRACE_MS const = 10000 (mirror of registry); constructor seeds `_connectionId = null` and `_lastKnownConnectionId = null`; `_ws.onopen` mints fresh UUID + cancels prior staged release + rolls _lastKnownConnectionId; `_ws.onclose` stages release via reg.stageReleaseByConnectionId; new `getConnectionId()` helper.
- `extension/ws/mcp-tool-dispatcher.js` -- `handleAgentRegisterRoute({ payload })` reads payload.connectionId, branches on `minted.code === 'AGENT_CAP_REACHED'`, calls `reg.stampConnectionId(agentId, connectionId)` on success, and reflects connectionId on the success response.
- `mcp/src/agent-scope.ts` -- private connectionId field + captureConnectionId / currentConnectionId methods (mirror of ownershipToken pattern); ensure() captures connectionId from the agent:register response alongside ownershipTokens; reset() clears it.
- `mcp/src/tools/manual.ts` -- threads connectionId into mcp:execute-action payload via defensive function-presence probe.
- `mcp/src/tools/visual-session.ts` -- same threading at start_visual_session and end_visual_session payloads.
- `mcp/src/tools/autopilot.ts` -- same threading at run_task (mcp:start-automation) and stop_task (mcp:stop-automation) payloads.
- `tests/agent-grace.test.js` -- extended with Tests 9-13 (5 bridge-side tests). New helper `teardownBridgeClient` cancels the reconnect setTimeout so the test process exits cleanly.

## Open Question Q1 (connection_id flow) RESOLVED

The plan and CONTEXT.md flagged Q1: should the extension or the MCP server be authoritative for minting connection_id? The implementation lands as `extension-side authoritative`:

1. Bridge mints `crypto.randomUUID()` at every `_ws.onopen` and stores it on `this._connectionId`.
2. The bridge currently does NOT inject the connection_id into outgoing agent:register messages itself; instead the dispatcher (server-bound side of the bridge) reads `payload.connectionId` from incoming agent:register requests. Server-side AgentScope threads connection_id through `agent:register` payloads via the additive captureConnectionId path. (Concretely: server sends agent:register without connectionId on the very first call; dispatcher mints fresh agentId, no stamp; subsequent tool calls from the same MCP-server process don't re-call agent:register because AgentScope caches the agentId. The connection_id is reflected on the agent:register response so AgentScope captures it for outbound threading on subsequent run_task / manual / visual-session calls.)
3. On bridge disconnect (_ws.onclose), the registry stages release for every agent stamped with the current connection_id. On reconnect within the grace window, _lastKnownConnectionId is what gets cancelled so the agents survive cleanly.

This works for v0.9.60's single-bridge-per-process invariant. Phase 244 hardening can revisit the multi-bridge case if it becomes a model.

## Hand-off Contract

### Plan 03 (settings UI -- parallel)
- No file overlap. Plan 03 already shipped its own commits (1a6a966, 6795bd4, 4ec024e).
- Plan 03's `fsbAgentCap` storage key is independently consumed by agent-registry.js's `_subscribeToCapChanges` listener installed at construction; this plan does not touch that path.

### Phase 244 hardening (future)
- Multi-bridge model would need to revisit T-241-09 (currently `accept` -- the extension trusts the server-injected connection_id under single-bridge-per-process). When multiple bridges per process become possible, an attacker forging payloads from a non-bridge channel could spoof connection_id; harden via signed connection_ids or per-bridge keying.
- T-241-10 (DoS via bridge flap) is `accept`-disposition because _stagedReleases is keyed by connection_id (one entry per flap; bounded by single-bridge-per-process). If multi-bridge lands without bounds, revisit.

## Deviations from Plan

### Rule 2 -- Auto-add missing critical functionality (cosmetic, not behavioral)

**1. bindTab needed an opts argument to receive `forced: true`.**
- **Found during:** Task 1 RED -- the plan calls `reg.bindTab(ownerAgentId, tab.id, { forced: true })` but Plan 01's bindTab signature is `(agentId, tabId)` with no opts.
- **Fix:** Extended `bindTab` to accept an optional `opts` object whose `forced` flag is recorded on `_tabMetadata` and persisted/restored across SW eviction. getTabMetadata's clone now includes `forced`.
- **Justification:** Plan calls for the flag to be observable on the tab metadata; without the extension Test 1 of agent-pooling.test.js cannot pass. The change is fully back-compat -- existing callers pass no opts and get `forced: false` defaulted.
- **Files modified:** `extension/utils/agent-registry.js`
- **Commit:** e25bfc7

### Rule 3 -- Auto-fix blocking issues

**2. Test source extraction needed balanced-paren walking, not regex.**
- **Found during:** Task 1 RED -- the test was using a greedy regex to extract the chrome.tabs.onCreated listener body from background.js. The body contains nested `}` characters (from the try/catch), which made regex pull either too little (cutting the body) or run off into unrelated code.
- **Fix:** Replaced the regex with a balanced-paren walker that finds the anchor token, ensures a "Phase 241" sentinel comment is in the preceding 1200 chars, then walks character-by-character matching `(` and `)` until depth returns to 0.
- **Files modified:** `tests/agent-pooling.test.js`
- **Commit:** e25bfc7 (combined with GREEN feature commit because the test wouldn't pass either way until both pieces landed)

**3. Bridge tests kept the Node test process alive for the reconnect timer.**
- **Found during:** Task 2 GREEN verification -- `node tests/agent-grace.test.js` printed all 13 PASS lines but never exited. Bridge `_ws.onclose` schedules `_scheduleReconnect`'s setTimeout (~2000ms + jitter) and that timer is not unref'd, so the Node event loop keeps the process alive.
- **Fix:** Added a `teardownBridgeClient(client)` helper that runs in each bridge test's `finally`. It sets `_intentionalClose = true`, clears `_reconnectTimer` and `_pingTimer`. The fix is test-only; the production bridge correctly schedules a reconnect after a real onclose -- the test just needs cleanup parity.
- **Files modified:** `tests/agent-grace.test.js`
- **Commit:** a4fac01

## Confirmation: Phase 237 / 238 / 239 / 240 / 241-01 contracts unchanged

All regression suites pass:

```
node tests/agent-pooling.test.js       PASS  (7/7)
node tests/agent-grace.test.js         PASS  (13/13)
node tests/agent-cap.test.js           PASS  (4/4 visible)
node tests/agent-cap-storage.test.js   PASS  (3/3 visible)
node tests/agent-pool-shrink.test.js   PASS  (6/6)
node tests/agent-registry.test.js      PASS  (Phase 237/240 contracts)
node tests/mcp-tool-smoke.test.js      PASS  (67/67)
node tests/mcp-bridge-client-lifecycle.test.js  PASS  (55/55)
node tests/agent-bridge-routes.test.js PASS  (27/27)
node tests/agent-id-threading.test.js  PASS  (6/6)
node tests/agent-scope.test.js         PASS  (5/5)
node tests/ownership-gate.test.js      PASS  (Phase 240 chokepoint + registry)
node tests/legacy-agent-synthesis.test.js   PASS  (Phase 240 legacy)
npm --prefix mcp run build             PASS  (TypeScript clean)
```

Grep gates (acceptance from plan's `<verification>` block):

```
chrome.tabs.onCreated      in background.js                 1   (>=1)
openerTabId                in background.js                 4   (>=1)
RECONNECT_GRACE_MS         in mcp-bridge-client.js          present (const)
this._connectionId         in mcp-bridge-client.js          7   (>=2)
stageReleaseByConnectionId in mcp-bridge-client.js          2   (>=1)
cancelStagedRelease        in mcp-bridge-client.js          present
AGENT_CAP_REACHED          in mcp-tool-dispatcher.js        3   (>=1)
stampConnectionId          in mcp-tool-dispatcher.js        2   (>=1)
captureConnectionId/connectionId in agent-scope.ts          9   (>=2)
currentConnectionId        across mcp/src/                 10+   (>=1)
```

## Self-Check: PASSED

- All listed test files exist and exit 0 (verified above).
- Commits c45d9ce, e25bfc7, 5f8ef42, a4fac01, 81bc963 present in `git log` on branch `Refinements`.
- Files created/modified verified via `git diff --stat HEAD~5..HEAD`:
  - `tests/agent-pooling.test.js` (new, 366+ lines)
  - `tests/agent-grace.test.js` (extended +258 lines)
  - `extension/background.js` (+25 lines for onCreated listener)
  - `extension/utils/agent-registry.js` (+9 lines for bindTab opts.forced + persistence)
  - `extension/ws/mcp-bridge-client.js` (+57 lines for RECONNECT_GRACE_MS + onopen/onclose hooks + getConnectionId)
  - `extension/ws/mcp-tool-dispatcher.js` (+27 lines for cap-rejection branch + connectionId capture/stamp/reflect)
  - `mcp/src/agent-scope.ts` (+34 lines for captureConnectionId / currentConnectionId / ensure-seed / reset-clear)
  - `mcp/src/tools/manual.ts` (+5 lines for connection_id threading)
  - `mcp/src/tools/visual-session.ts` (+10 lines, two threading sites)
  - `mcp/src/tools/autopilot.ts` (+10 lines, two threading sites)
- TypeScript build clean (`npm --prefix mcp run build` exits 0).
- No emojis anywhere in code or this SUMMARY.
