# Phase 241: Pooling, Configurable Cap, Reconnect Grace - Research

**Researched:** 2026-05-05
**Domain:** Chrome Extension MV3 service worker — multi-agent registry lifecycle (cap enforcement, forced-tab pooling, bridge-disconnect grace)
**Confidence:** HIGH (all insertion sites and conventions verified in-tree; one external claim — chrome.alarms 30s minimum — verified via Chrome docs)

## Summary

Phase 241 is the lifecycle-correctness phase for the v0.9.60 multi-agent registry. The substrate is already in place: Phase 237 shipped `extension/utils/agent-registry.js` with the `withRegistryLock` promise-chain mutex, sync read APIs, and `chrome.storage.session` write-through; Phase 240 layered ownership-token-aware `bindTab` / `isOwnedBy` and the dispatch-gate chokepoint. Phase 241 lays a fourth layer on top: forced-pool routing for `chrome.tabs.onCreated`, atomic cap-check-plus-insert under the existing mutex, a `chrome.storage.local`-backed configurable cap UI, and a `connection_id`-keyed reconnect grace window driven from `mcp-bridge-client.js` `onopen` / `onclose`.

The exact insertion sites are determined and documented below. **One non-trivial finding:** `chrome.alarms` enforces a 30-second minimum delay (Chrome 120+) [VERIFIED: developer.chrome.com/docs/extensions/reference/api/alarms]. The decided 10-second `RECONNECT_GRACE_MS` therefore **cannot** use `chrome.alarms` and must use `setTimeout`. The tradeoff is that an SW eviction during the 10s window cancels the pending grace (the timer dies); on wake, the agent is still in storage but no expiry will fire. Plan needs to pick an explicit posture (recommended: on hydrate, scan persisted `staged_release` entries and either fire the release immediately or honor any remaining deadline via a fresh setTimeout from current `Date.now()`).

**Primary recommendation:** Extend `extension/utils/agent-registry.js` in-place with five new public APIs (`findAgentByTabId`, `getCap` / `setCap`, `canAcceptNewAgent` for the cap gate, and `stageRelease` / `cancelStagedRelease` for the grace window). Add one new `chrome.tabs.onCreated` listener in `background.js` adjacent to the existing third `onRemoved` listener (line 2548). Hook `connection_id` mint at `_ws.onopen` (line 91) and stage-release at `_ws.onclose` (line 112) of `mcp-bridge-client.js`. Add an "Agent Concurrency" card to `extension/ui/control_panel.html` Advanced Settings (line 333), mirroring the Element Cache Size pattern (preset dropdown + custom numeric input).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pooling (POOL-01..POOL-06):**

- **D-01 chrome.tabs.onCreated openerTabId pooling.** When `openerTabId` is set on the new tab, look up the opener's owning agent via `globalThis.fsbAgentRegistryInstance.findAgentByTabId(openerTabId)` (sync registry read; new method needed). If found: `bindTab(agentId, newTabId, { forced: true })` — pools the new tab under the same agent without minting a new agentId. The forced flag is stored on the tab metadata so observability/audit can distinguish forced binds from explicit ones.
- **D-02 Cap counts agents, not tabs.** The cap is on distinct agents. A pool with multiple tabs counts as ONE agent. The (N+1)th DISTINCT agent claim is rejected with AGENT_CAP_REACHED.

**Cap enforcement (POOL-02, POOL-03):**

- **D-03 AGENT_CAP_REACHED { code, cap, active }.** Typed error per SC#2. Cap-check + insert is synchronous under withRegistryLock (Phase 237 mutex pattern). Verified by 20-concurrent-claim test producing exactly N successes.
- **D-04 LOG-04 emission on cap rejection.** Each rejection emits a single rate-limited diagnostic event family `agent-cap-reached` with shape `{cap, active, requestingClient}`. Operators can spot saturation in the LOG-04 ring buffer (Phase 237 diagnostics surface).
- **D-05 Configurable cap in options.html Advanced Settings.** Numeric input, range 1-64, integer-validated, default 8, reset-to-default button. Stored in chrome.storage.local under `fsbAgentCap` (NOT chrome.storage.session — this preference survives SW restart). Registry reads this on each cap-check (no caching needed; the SW context already serializes claims under withRegistryLock so reads are cheap).
- **D-06 Lower-cap grandfathering.** When operator lowers the cap while M > newCap agents are active: changes apply at NEXT claim only; existing agents stay (no forced eviction). New claims rejected with AGENT_CAP_REACHED until M drops below newCap. This matches SC#3.

**Reconnect grace (LOCK-01, LOCK-02):**

- **D-07 RECONNECT_GRACE_MS = 10000 (10 seconds).** Default per SC#4.
- **D-08 connection_id is a per-bridge-connect randomUUID.** Stamped at bridge `onopen` time. Threaded through every bridge.sendAndWait payload as a separate field. When the bridge `onclose` fires, the registry stages the agent's pool for release at now() + RECONNECT_GRACE_MS, keyed by connection_id. A subsequent `onopen` with the SAME connection_id within the grace window cancels the staged release. Expiry fully releases the pool.
- **D-09 Grace-window release behavior.** On expiry: full pool release (every tab in the agent's pool gets `releaseTab`, then the agent record deletes). Emits a single LOG-04 event `agent-grace-expired { agentId, connectionId, poolSize }`.

**Tab/window close semantics (LOCK-03, LOCK-04):**

- **D-10 Per-tab onRemoved drives pool shrink.** chrome.tabs.onRemoved listener calls `releaseTab(tabId)` synchronously. Registry decrements the agent's pool; when pool.size === 0, the agent record is released (synchronous; no grace window — explicit close is intentional).
- **D-11 Window close iterates per-tab via existing onRemoved.** chrome.windows.onRemoved handler (if exists) just lets each tab's onRemoved fire naturally — no separate window-aware logic in the registry.
- **D-12 finalizeSession releases cleanly.** When a task/session ends via finalizeSession, releaseTab fires for every owned tab in the pool; pool drains to 0; agent record releases.
- **D-13 No idle timeout.**

### Claude's Discretion

- Implementation file placement for the new cap/grace logic — recommend extending `extension/utils/agent-registry.js` rather than splitting into a sibling module.
- options.html UI exact element structure — planner picks; numeric input + reset button is the spec.
- The metric ring-buffer event family names ('agent-cap-reached', 'agent-grace-expired') match Phase 237's `agent-reaped-tab_not_found` style.
- Whether `connection_id` extends Phase 238 D-10's status response shape — yes, the agent:status response now also returns the active connectionId.
- Test framework: plain-Node assert per existing convention.

### Deferred Ideas (OUT OF SCOPE)

- User-configurable RECONNECT_GRACE_MS — Phase 244 hardening.
- Per-agent grace window (different agents could have different grace).
- Forced eviction when cap is lowered — explicitly rejected per SC#3.
- Rate-limit / metering on agent claim attempts (DoS protection) — Phase 244.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POOL-01 | Concurrency cap (default 8, configurable 1-64) enforced via promise-chain mutex; cap-check + insert atomic against in-memory registry | "Cap-Check-Plus-Insert Under Mutex" pattern; existing `withRegistryLock` semantics in agent-registry.js:147-151 |
| POOL-02 | (N+1)th claim rejects with typed `AGENT_CAP_REACHED { cap, active }` — fail-loud, no silent queueing | "Typed Error Shape Pattern"; mirrors `TAB_NOT_OWNED` / `AGENT_NOT_REGISTERED` shape in mcp-tool-dispatcher.js:152-161 |
| POOL-03 | New tabs opened by an owning agent (`chrome.tabs.onCreated` + `openerTabId`) auto-pool under that agent | "Forced-Pool Routing" pattern; new chrome.tabs.onCreated listener in background.js |
| POOL-04 | Pool of multiple tabs stays locked together; closing one tab shrinks the pool; agent only fully released when `pool.size === 0` | "Pool-Shrink-To-Zero Release" pattern; existing third `chrome.tabs.onRemoved` listener at background.js:2548 already calls `releaseTab` (idempotent); Phase 237 `releaseTab` in agent-registry.js:439-464 already shrinks per-tab |
| POOL-05 | Concurrency cap configurable in options.html → Advanced Settings; persisted to chrome.storage.local; grandfathered | "Settings Persistence" pattern; existing `saveSettings()` in options.js:806-844 |
| POOL-06 | Cap setting validated on save (clamped 1-64, integer); invalid rejected; reset-to-default available | Mirror existing maxIterations / elementCacheSize validation pattern in options.js |
| LOCK-01 | Lock released when task/session ends via existing `finalizeSession` path | Already covered by existing `releaseTab` semantics; no new code needed (existing onRemoved listener at line 2548 handles this) |
| LOCK-02 | Lock released when MCP client disconnects, after `RECONNECT_GRACE_MS` window keyed by `connection_id` | "connection_id Mint + Stage-Release" pattern in mcp-bridge-client.js onopen/onclose hooks |
| LOCK-03 | Lock released when user closes the tab; idempotent + commutative | Existing `releaseTab` is idempotent (agent-registry.js:441-444 returns false on no-op); window close handled by per-tab onRemoved iteration (D-11) |
| LOCK-04 | No idle timeout — agents stay locked indefinitely while active | NEGATIVE requirement: phase asserts no scheduling code is added beyond grace timer |

## Project Constraints (from CLAUDE.md)

- **No emojis** in markdowns, terminal logs, or anywhere [VERIFIED: ./CLAUDE.md user global + project CLAUDE.md].
- ES2021+ JavaScript with proper error handling.
- Comprehensive JSDoc documentation.
- Chrome Extension best practices.
- Security-first design principles.
- camelCase functions; SCREAMING_SNAKE_CASE constants; PascalCase classes [VERIFIED: .planning/codebase/CONVENTIONS.md].
- Single quotes for strings; semicolons mandatory.
- importScripts ordering matters — agent-registry.js loads BEFORE mcp-tool-dispatcher.js BEFORE mcp-bridge-client.js [VERIFIED: extension/background.js:11-24].
- Branch-locked to `Refinements`. No git push, no PRs.
- `.planning/` is gitignored — phase commits via `gsd-tools commit` will return `skipped_gitignored` (expected).

## Standard Stack

### Core (extending in-place; no new packages)

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `extension/utils/agent-registry.js` | Phase 237/240 | In-memory + storage-mirrored registry with mutex | Single source of truth; D-12 from Phase 237 [VERIFIED: file exists, read in full] |
| `extension/ws/mcp-bridge-client.js` | Phase 240 | WebSocket bridge; onopen/onclose hooks for connection_id mint and grace stage | Existing connection lifecycle [VERIFIED: lines 91-127 read] |
| `extension/ws/mcp-tool-dispatcher.js` | Phase 240 | Dispatch chokepoint; cap-rejection emission point for agent-creating routes | `handleAgentRegisterRoute` at line 793 is the single cap-gate site [VERIFIED] |
| `extension/background.js` | Phase 237/240 | SW boot site; chrome.tabs.onCreated and onRemoved listeners | New onCreated listener placed adjacent to existing third onRemoved at line 2548 [VERIFIED] |
| `extension/ui/control_panel.html` | v0.9.50 | Options page (Manifest `options_page: "ui/control_panel.html"`); Advanced Settings section at line 333 | UI cap input lives here [VERIFIED: manifest.json:41, control_panel.html:333-340] |
| `extension/ui/options.js` | v0.9.50 | Settings load/save via chrome.storage.local | `saveSettings()` at line 806; `loadSettings()` at line 672 [VERIFIED] |
| `mcp/src/agent-scope.ts` | Phase 240 | Per-process agent scope; captures connection_id from agent:register response | Existing token-capture pattern at line 121 (`captureOwnershipToken`) extends naturally to `captureConnectionId` [VERIFIED] |

### No new npm dependencies

Per ROADMAP constraint: "No new npm dependencies in `mcp/` other than the `@modelcontextprotocol/sdk` minor bump." [VERIFIED: ROADMAP.md:24]. Phase 241 adds zero packages.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setTimeout` for grace timer | `chrome.alarms.create` | Rejected — chrome.alarms minimum is 30s [VERIFIED: developer.chrome.com/docs/extensions/reference/api/alarms]; the 10s grace is below the floor. setTimeout is the only Chrome-MV3 mechanism that fires reliably under 30s. Tradeoff: setTimeout dies on SW eviction; chrome.alarms survives. We accept the tradeoff and add a hydrate-time scan to fire any expired staged releases on wake (see Pitfall 1). |
| Sibling module `cap-and-grace.js` | Extend agent-registry.js | Rejected per CONTEXT.md Claude's Discretion — keep registry as single source of truth. |
| Cache cap value in registry | Read from storage on every check | Rejected per D-05 — sync registry reads under withRegistryLock are cheap; caching introduces invalidation complexity for grandfather behavior. |
| Track connection_id per agent | Track per-bridge globally | Decided per D-08 — connection_id is per-bridge-connect (one bridge connection serves all agents on this client). Multiple agents from same client share one connection_id; on disconnect, ALL their pools stage release together. |

**Installation:** None. Phase 241 modifies existing files only.

**Version verification:** No version checks needed — no packages added.

## Architecture Patterns

### Recommended File Structure (delta only)

```
extension/
├── utils/
│   └── agent-registry.js        # EXTEND: add findAgentByTabId, getCap/setCap,
│                                #         canAcceptNewAgent, stageRelease,
│                                #         cancelStagedRelease, expireStagedRelease;
│                                #         add cap-check-plus-insert wrapper
│                                #         around registerAgent
├── ws/
│   ├── mcp-bridge-client.js     # EXTEND: mint connection_id at onopen (line 91);
│                                #         call stageRelease at onclose (line 112);
│                                #         thread connection_id into outbound payloads
│   └── mcp-tool-dispatcher.js   # EXTEND: handleAgentRegisterRoute returns
│                                #         AGENT_CAP_REACHED on cap fail; capture
│                                #         connection_id from agent:register payload
│                                #         and stamp on agent record
├── background.js                # ADD: chrome.tabs.onCreated listener (forced-pool
│                                #      bind via openerTabId) — adjacent to line 2548
└── ui/
    ├── control_panel.html       # ADD: "Agent Concurrency" settings card in Advanced
    │                            #      Settings section (line 333), mirroring the
    │                            #      Element Cache Size pattern
    └── options.js               # EXTEND: defaultSettings.fsbAgentCap = 8;
                                  #         saveSettings clamps 1-64; reset-to-default;
                                  #         load handler populates input

mcp/
└── src/
    └── agent-scope.ts           # EXTEND: capture connection_id from agent:register
                                  #         response; thread into outbound payloads
                                  #         alongside ownershipToken
```

### Pattern 1: Cap-Check-Plus-Insert Under Mutex (POOL-01, POOL-02)

**What:** Wrap the agent insertion inside the existing `withRegistryLock` so cap-check and insert are atomic.

**When to use:** Every place that creates a new (non-legacy, non-forced-pool) agent record.

**Where:** `extension/utils/agent-registry.js` `registerAgent` method (currently line 238).

**Example:**

```javascript
// Source: extending pattern at extension/utils/agent-registry.js:238-255
AgentRegistry.prototype.registerAgent = function(/* opts ignored */) {
  var self = this;
  return withRegistryLock(async function() {
    // Phase 241 D-03: cap-check happens INSIDE the lock, BEFORE insert.
    // No await between the count and the set — same microtask semantics.
    var cap = self.getCap();        // sync read (uses cached value mirrored from chrome.storage.local)
    var active = self._agents.size; // sync read
    if (active >= cap) {
      // Emit LOG-04 diagnostic (D-04) — fire-and-forget, never throw.
      _emitCapReachedDiagnostic(cap, active);
      // Returning the typed error shape rather than throwing matches the
      // dispatcher's existing return-shape contract (Phase 240 gate uses
      // { success: false, code, ... } — see mcp-tool-dispatcher.js:152-161).
      return { error: 'AGENT_CAP_REACHED', code: 'AGENT_CAP_REACHED', cap: cap, active: active };
    }
    var agentId = mintAgentId();
    var record = { agentId: agentId, createdAt: Date.now(), tabIds: [] };
    self._agents.set(agentId, record);
    self._tabsByAgent.set(agentId, new Set());
    await self._persist();
    return { agentId: agentId, agentIdShort: formatAgentIdForDisplay(agentId) };
  });
};
```

**Why this works under TOCTOU pressure:** `withRegistryLock` serializes all callers via a promise chain (agent-registry.js:147). Within one mutex turn, nothing else can mutate `_agents`. The 20-concurrent-claim test pushes 20 promises into the chain; they execute strictly serially; exactly N succeed, 20-N return `AGENT_CAP_REACHED`. [VERIFIED: existing 20-concurrent-claim test in tests/agent-registry.test.js per its docstring]

**Caller adaptation:** `handleAgentRegisterRoute` in mcp-tool-dispatcher.js:793 currently destructures `minted.agentId`. It must check for the new error-return shape and forward it as the route response:

```javascript
// Source: extending mcp-tool-dispatcher.js:793-812
async function handleAgentRegisterRoute({ payload } = {}) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.registerAgent !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable', error: 'AgentRegistry not initialized' };
  }
  const minted = await reg.registerAgent();
  // Phase 241 D-03: cap-rejection branch.
  if (minted && minted.code === 'AGENT_CAP_REACHED') {
    return { success: false, code: 'AGENT_CAP_REACHED', cap: minted.cap, active: minted.active };
  }
  // ... existing success path ...
  // Phase 241 D-08: capture connection_id if caller threaded it.
  const connectionId = (payload && payload.connectionId) || null;
  if (connectionId && typeof reg.stampConnectionId === 'function') {
    reg.stampConnectionId(minted.agentId, connectionId);
  }
  return { success: true, agentId: minted.agentId, agentIdShort: minted.agentIdShort, ownershipTokens: {}, connectionId };
}
```

### Pattern 2: Forced-Pool Routing via chrome.tabs.onCreated (POOL-03, POOL-04)

**What:** When Chrome opens a new tab via `window.open` / `target="_blank"` from an existing agent-owned tab, the new tab inherits the opener's agent.

**Where:** New chrome.tabs.onCreated listener in `background.js`, placed adjacent to the existing third `onRemoved` listener (line 2548-2559).

**Example:**

```javascript
// Source: new code, mirroring the existing Phase 237 onRemoved listener
// pattern at extension/background.js:2548-2559
chrome.tabs.onCreated.addListener((tab) => {
  try {
    if (!tab || typeof tab.id !== 'number') return;
    // openerTabId is undefined for tabs opened via Ctrl+T or
    // chrome.tabs.create({}) without an opener context. Such tabs are
    // intentionally treated as unowned (registered as new agents on first
    // tool call). See "Common Pitfalls — openerTabId is optional".
    if (typeof tab.openerTabId !== 'number') return;
    var reg = globalThis.fsbAgentRegistryInstance;
    if (!reg || typeof reg.findAgentByTabId !== 'function') return;
    var ownerAgentId = reg.findAgentByTabId(tab.openerTabId);
    if (!ownerAgentId) return; // opener is unowned; new tab is unowned too
    // bindTab is internally promise-chain-locked. Pass forced:true so the
    // metadata block records the bind type for observability.
    if (typeof reg.bindTab === 'function') {
      reg.bindTab(ownerAgentId, tab.id, { forced: true });
    }
  } catch (err) {
    // Defensive: never let registry errors stop other onCreated listeners.
  }
});
```

**Why a NEW listener (not modify existing):** Phase 237 plan-03 established the convention of standalone listeners adjacent to other onRemoved listeners (see comment at background.js:2544 — "Standalone listener (NOT a modification of the two existing onRemoved listeners…)"). Phase 241 follows that pattern.

**`bindTab` signature change:** Currently `bindTab(agentId, tabId)`. Phase 241 extends to `bindTab(agentId, tabId, { forced: false })` and stores `forced` in the per-tab metadata block. Back-compat: omitting the third arg defaults to `forced: false` (the existing call sites in mcp-tool-dispatcher.js:399, 482 do not need to change).

### Pattern 3: connection_id Mint + Stage-Release (LOCK-02, D-08)

**What:** Bridge `onopen` mints a fresh UUID; bridge `onclose` stages the release; bridge `onopen` with the same id within 10s cancels the staging.

**Where:** `extension/ws/mcp-bridge-client.js` `_ws.onopen` (line 91) and `_ws.onclose` (line 112).

**Example:**

```javascript
// Source: extending extension/ws/mcp-bridge-client.js:91-127
this._ws.onopen = () => {
  console.log('[FSB MCP Bridge] Connected to local MCP bridge');
  this._connected = true;
  this._status = 'connected';
  this._reconnectDelay = MCP_RECONNECT_BASE_MS;
  this._nextReconnectAt = null;
  this._lastConnectedAt = this._timestamp();
  this._lastDisconnectReason = null;
  this._clearReconnectAlarm();

  // Phase 241 D-08: mint connection_id at onopen. Persists for the lifetime
  // of THIS WebSocket connection. A reconnect mints a fresh id (so the
  // grace-cancel test relies on the test harness reusing the id explicitly).
  this._connectionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10));

  // Phase 241 D-08: cancel any in-flight staged release for this connection_id.
  // The ID stays the SAME across a flap that happens within 10s ONLY if the
  // server sends back the same id (typical bridge contract: server tracks
  // connection_id; on reconnect within grace, server hands the same id back).
  // For v0.9.60 the simpler invariant: cancel ALL staged releases on this
  // bridge's last-known connection_id. (Multi-bridge-per-process is out of
  // scope for v0.9.60.)
  try {
    var reg = globalThis.fsbAgentRegistryInstance;
    if (reg && typeof reg.cancelStagedRelease === 'function' && this._lastKnownConnectionId) {
      reg.cancelStagedRelease(this._lastKnownConnectionId);
    }
    this._lastKnownConnectionId = this._connectionId;
  } catch (_e) { /* best-effort */ }

  this._persistState();
  this._startPing();
  try { this._reconcileInFlightTasksOnConnect(); } catch (_e) { /* best-effort */ }
};

this._ws.onclose = () => {
  console.log('[FSB MCP Bridge] Disconnected from local MCP bridge');
  this._connected = false;
  this._status = 'disconnected';
  this._lastDisconnectedAt = this._timestamp();
  this._lastDisconnectReason = this._intentionalClose
    ? 'intentional_close'
    : (this._lastDisconnectReason === 'socket_error' ? 'socket_error' : 'socket_close');

  // Phase 241 D-08: stage release for ALL agents currently associated with
  // this connection_id. Registry handles iteration; bridge just calls.
  try {
    var reg = globalThis.fsbAgentRegistryInstance;
    if (reg && typeof reg.stageReleaseByConnectionId === 'function' && this._connectionId) {
      reg.stageReleaseByConnectionId(this._connectionId, RECONNECT_GRACE_MS);
    }
  } catch (_e) { /* best-effort */ }

  this._inFlightTasksReconciled = false;
  this._persistState();
  this._stopPing();
  if (!this._intentionalClose) {
    this._scheduleReconnect();
  }
};
```

**Threading connection_id outbound:** Currently the bridge has no per-payload threading helper. Phase 241 is the first phase that needs to attach connection_id to outbound MCP messages. The cleanest place is `mcp/src/agent-scope.ts` — extend the `ensure()` flow to capture `connectionId` from the `agent:register` response (alongside `agentId` and `ownershipTokens`), then expose `currentConnectionId()` for tool sites to thread into `bridge.sendAndWait` payloads. Mirror the existing `captureOwnershipToken` / `currentOwnershipToken` pattern at agent-scope.ts:121-137.

### Pattern 4: Grace Timer with Hydrate-Time Recovery (LOCK-02, Pitfall 1)

**What:** Use `setTimeout` for the 10s grace (chrome.alarms can't go below 30s). Persist the staged-release deadline in chrome.storage.session so SW eviction does not silently strand agents.

**Where:** `extension/utils/agent-registry.js` — new `_stagedReleases` Map keyed by connection_id; new `stageReleaseByConnectionId`, `cancelStagedRelease`, `_fireStagedRelease` methods. Hydrate-time scan added to `hydrate()` (line 577).

**Example:**

```javascript
// Source: new code in extension/utils/agent-registry.js
// Module-scope constant per D-07
var RECONNECT_GRACE_MS = 10000;

// Per-instance Map: connectionId -> { deadline, timeoutId, agentIds }
// _stagedReleases is initialized in the constructor adjacent to _agents et al.

AgentRegistry.prototype.stageReleaseByConnectionId = function(connectionId, graceMs) {
  var self = this;
  return withRegistryLock(async function() {
    if (typeof connectionId !== 'string' || !connectionId) return false;
    var ms = (typeof graceMs === 'number' && graceMs > 0) ? graceMs : RECONNECT_GRACE_MS;
    var agentIds = [];
    self._agents.forEach(function(record, agentId) {
      if (record.connectionId === connectionId) agentIds.push(agentId);
    });
    if (agentIds.length === 0) return false;
    var deadline = Date.now() + ms;
    // setTimeout is the only Chrome-MV3 mechanism for sub-30s scheduling.
    // chrome.alarms minimum is 30s [VERIFIED: developer.chrome.com/docs/extensions/reference/api/alarms]
    var timeoutId = setTimeout(function() {
      self._fireStagedRelease(connectionId).catch(function() { /* best-effort */ });
    }, ms);
    self._stagedReleases.set(connectionId, { deadline: deadline, timeoutId: timeoutId, agentIds: agentIds });
    await self._persist(); // persists deadline to chrome.storage.session for SW-eviction recovery
    return true;
  });
};

AgentRegistry.prototype.cancelStagedRelease = function(connectionId) {
  var self = this;
  return withRegistryLock(async function() {
    var staged = self._stagedReleases.get(connectionId);
    if (!staged) return false;
    if (staged.timeoutId) clearTimeout(staged.timeoutId);
    self._stagedReleases.delete(connectionId);
    await self._persist();
    return true;
  });
};

AgentRegistry.prototype._fireStagedRelease = function(connectionId) {
  var self = this;
  return withRegistryLock(async function() {
    var staged = self._stagedReleases.get(connectionId);
    if (!staged) return false;
    var releasedCount = 0;
    var totalPoolSize = 0;
    staged.agentIds.forEach(function(agentId) {
      var ownedTabs = self._tabsByAgent.get(agentId);
      if (ownedTabs) totalPoolSize += ownedTabs.size;
      // Inline the releaseAgent steps (we hold the lock; calling releaseAgent
      // would re-enter and deadlock on the promise chain).
      if (ownedTabs) {
        ownedTabs.forEach(function(tabId) {
          if (self._tabOwners.get(tabId) === agentId) {
            self._tabOwners.delete(tabId);
            self._tabMetadata.delete(tabId);
          }
        });
      }
      self._tabsByAgent.delete(agentId);
      self._agents.delete(agentId);
      releasedCount++;
    });
    self._stagedReleases.delete(connectionId);
    _emitGraceExpiredDiagnostic(connectionId, releasedCount, totalPoolSize); // D-09 LOG-04
    await self._persist();
    return true;
  });
};
```

**Hydrate-time recovery (Pitfall 1):**

```javascript
// At the end of hydrate() in agent-registry.js, after the existing reap pass
// (around line 695), scan persisted staged_releases:
var persistedStaged = (payload && payload.stagedReleases && typeof payload.stagedReleases === 'object')
  ? payload.stagedReleases : {};
var now = Date.now();
Object.keys(persistedStaged).forEach(function(connectionId) {
  var entry = persistedStaged[connectionId];
  if (!entry || typeof entry.deadline !== 'number') return;
  if (entry.deadline <= now) {
    // Deadline already passed during SW eviction. Fire immediately.
    self._fireStagedRelease(connectionId).catch(function() { /* best-effort */ });
  } else {
    // Deadline in the future — schedule the remaining time.
    var remaining = entry.deadline - now;
    var timeoutId = setTimeout(function() {
      self._fireStagedRelease(connectionId).catch(function() { /* best-effort */ });
    }, remaining);
    self._stagedReleases.set(connectionId, {
      deadline: entry.deadline,
      timeoutId: timeoutId,
      agentIds: Array.isArray(entry.agentIds) ? entry.agentIds.slice() : []
    });
  }
});
```

### Pattern 5: chrome.storage.local Cap with Sync Cached Read (POOL-05)

**What:** The cap is read on every claim. Persist to chrome.storage.local (survives SW restart). Cache in memory; refresh on chrome.storage.onChanged for cross-context updates.

**Where:** `extension/utils/agent-registry.js` — new `_cachedCap` instance field, `getCap()` / `setCap()` methods, `_subscribeToCapChanges()` called from constructor.

**Example:**

```javascript
// Source: new code in extension/utils/agent-registry.js
var FSB_AGENT_CAP_STORAGE_KEY = 'fsbAgentCap';
var FSB_AGENT_CAP_DEFAULT = 8;
var FSB_AGENT_CAP_MIN = 1;
var FSB_AGENT_CAP_MAX = 64;

// In AgentRegistry constructor:
//   this._cachedCap = FSB_AGENT_CAP_DEFAULT;
//   this._subscribeToCapChanges();

// Hydrate-time read (call from hydrate() before serving requests):
AgentRegistry.prototype._loadCapFromStorage = async function() {
  var c = _getChrome();
  if (!c || !c.storage || !c.storage.local) return;
  try {
    var stored = await c.storage.local.get([FSB_AGENT_CAP_STORAGE_KEY]);
    var raw = stored && stored[FSB_AGENT_CAP_STORAGE_KEY];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      this._cachedCap = _clampCap(raw);
    }
  } catch (_e) { /* keep default */ }
};

AgentRegistry.prototype.getCap = function() {
  return _clampCap(this._cachedCap);
};

AgentRegistry.prototype.setCap = function(value) {
  var clamped = _clampCap(value);
  this._cachedCap = clamped;
  var c = _getChrome();
  if (c && c.storage && c.storage.local && typeof c.storage.local.set === 'function') {
    var payload = {};
    payload[FSB_AGENT_CAP_STORAGE_KEY] = clamped;
    c.storage.local.set(payload).catch(function() { /* best-effort */ });
  }
  return clamped;
};

AgentRegistry.prototype._subscribeToCapChanges = function() {
  // chrome.storage.onChanged fires for ALL extension contexts (background,
  // options page, sidepanel). When the user saves the new cap from the
  // options UI, this listener updates the SW's in-memory cache.
  var self = this;
  var c = _getChrome();
  if (!c || !c.storage || !c.storage.onChanged || typeof c.storage.onChanged.addListener !== 'function') return;
  c.storage.onChanged.addListener(function(changes, area) {
    if (area !== 'local') return;
    if (!changes[FSB_AGENT_CAP_STORAGE_KEY]) return;
    var next = changes[FSB_AGENT_CAP_STORAGE_KEY].newValue;
    if (typeof next === 'number' && Number.isFinite(next)) {
      self._cachedCap = _clampCap(next);
    }
  });
};

function _clampCap(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return FSB_AGENT_CAP_DEFAULT;
  var i = Math.floor(v);
  if (i < FSB_AGENT_CAP_MIN) return FSB_AGENT_CAP_MIN;
  if (i > FSB_AGENT_CAP_MAX) return FSB_AGENT_CAP_MAX;
  return i;
}
```

### Pattern 6: Settings UI Card (POOL-05, POOL-06)

**What:** Add an "Agent Concurrency" card to the Advanced Settings section in control_panel.html, mirroring the existing Element Cache Size pattern (preset dropdown + custom number input + reset).

**Where:** `extension/ui/control_panel.html` — new card in the `<div class="advanced-settings-grid">` block at line 341, between "DOM Analysis" (line 367) and "Performance" (line 410).

**Example:**

```html
<!-- Source: new card in extension/ui/control_panel.html, between line 407 and 410 -->
<!-- Mirrors the Automation Limits / DOM Analysis card pattern (lines 343-407) -->
<div class="settings-card">
  <div class="settings-card-header">
    <div class="settings-card-icon">
      <i class="fas fa-users"></i>
    </div>
    <div class="settings-card-title">
      <h3>Agent Concurrency</h3>
      <p>Maximum simultaneous agents</p>
    </div>
  </div>
  <div class="settings-card-content">
    <div class="setting-item">
      <div class="setting-label">
        <span>Concurrency Cap</span>
        <span class="setting-value-display" id="fsbAgentCapDisplay">8</span>
      </div>
      <input type="number" id="fsbAgentCap" class="form-input"
             min="1" max="64" step="1" value="8">
      <button type="button" class="form-secondary-btn" id="fsbAgentCapReset">
        Reset to default (8)
      </button>
      <div class="setting-hint">
        Default 8. Range 1-64. Lowering this value while agents are active does
        not evict them; new claims past the new cap are rejected.
      </div>
    </div>
  </div>
</div>
```

```javascript
// Source: extending extension/ui/options.js
// Add to defaultSettings (line 4):
//   fsbAgentCap: 8,
//
// Add to cacheElements() (line ~138 region):
//   elements.fsbAgentCap = document.getElementById('fsbAgentCap');
//   elements.fsbAgentCapDisplay = document.getElementById('fsbAgentCapDisplay');
//   elements.fsbAgentCapReset = document.getElementById('fsbAgentCapReset');
//
// Add to setupEventListeners() (~line 236):
if (elements.fsbAgentCap) {
  elements.fsbAgentCap.addEventListener('input', (e) => {
    var raw = parseInt(e.target.value, 10);
    if (!Number.isFinite(raw)) raw = 8;
    if (raw < 1) raw = 1;
    if (raw > 64) raw = 64;
    if (e.target.value !== String(raw)) e.target.value = String(raw);
    if (elements.fsbAgentCapDisplay) elements.fsbAgentCapDisplay.textContent = String(raw);
    markUnsavedChanges();
  });
}
if (elements.fsbAgentCapReset) {
  elements.fsbAgentCapReset.addEventListener('click', () => {
    elements.fsbAgentCap.value = '8';
    if (elements.fsbAgentCapDisplay) elements.fsbAgentCapDisplay.textContent = '8';
    markUnsavedChanges();
  });
}
//
// Add to saveSettings() (~line 806) settings object literal:
//   fsbAgentCap: parseInt(elements.fsbAgentCap?.value, 10) || 8,
// (clamping happens in the registry's setCap on the SW side via storage.onChanged)
//
// Add to loadSettings() (~line 672) data handler:
//   if (elements.fsbAgentCap) {
//     var v = (typeof data.fsbAgentCap === 'number') ? data.fsbAgentCap : 8;
//     elements.fsbAgentCap.value = String(v);
//     if (elements.fsbAgentCapDisplay) elements.fsbAgentCapDisplay.textContent = String(v);
//   }
```

### Anti-Patterns to Avoid

- **Don't read cap from chrome.storage.local synchronously inside `registerAgent`.** Storage reads are async; the cap-check must be sync (under the mutex). Use the in-memory `_cachedCap` populated at hydrate-time and kept fresh via `chrome.storage.onChanged`.
- **Don't use chrome.alarms for the 10s grace.** chrome.alarms minimum is 30s [VERIFIED]. setTimeout is correct here despite SW-eviction tradeoff.
- **Don't call `releaseAgent` from inside `_fireStagedRelease`.** `releaseAgent` re-enters `withRegistryLock` and deadlocks on the promise chain. Inline the steps as shown in Pattern 4.
- **Don't add a chrome.windows.onRemoved handler.** Per D-11, window close is handled by per-tab onRemoved firing naturally. A separate window-aware handler would create commutativity bugs.
- **Don't forget to wipe `_tabMetadata` on stage-release expiry.** The releaseAgent path at line 273-277 already does this; the inlined version in `_fireStagedRelease` must too.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom UUID | `crypto.randomUUID()` | Already in use at agent-registry.js:183-184; native to MV3 SW. |
| Mutex / semaphore | Counter-based mutex | Existing `withRegistryLock` (agent-registry.js:147) | Phase 237 already proved the promise-chain pattern under 20-concurrent-claim. |
| Storage round-trip helper | Roll your own | Existing `readPersistedAgentRegistry` / `writePersistedAgentRegistry` (agent-registry.js:57-104) | Already handles versioned envelope, error swallow, key removal on empty. |
| Diagnostic emission | Roll your own ring buffer | Existing `globalThis.rateLimitedWarn` via diagnostics-ring-buffer.js | Phase 211 LOG-04 ring is the single observability surface; agent-reaped-* family established at agent-registry.js:112-132. |
| Settings persistence pattern | Custom save/load | Mirror `saveSettings` / `loadSettings` in options.js:672/806 | All other settings cards use this exact shape; consistency reduces review friction. |
| Cross-context settings sync | postMessage / runtime.sendMessage | `chrome.storage.onChanged` listener | The options UI saves to chrome.storage.local; the SW's onChanged listener hydrates the cache automatically. |

**Key insight:** Almost every primitive Phase 241 needs already exists in the v0.9.60 substrate. The phase is wiring + 2 new mechanisms (cap-check inside mutex, grace timer) — not new infrastructure.

## Runtime State Inventory

This is a feature/lifecycle phase, not a rename/refactor. Substrate-level inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) chrome.storage.session under `fsbAgentRegistry` (versioned envelope `{ v: 1, records: { ... }, tabMetadata: { ... } }`) — Phase 237/240 owns the format; Phase 241 ADDS a new top-level field `stagedReleases: { [connectionId]: { deadline, agentIds } }`. (b) chrome.storage.local under `fsbAgentCap` (numeric, integer, 1-64) — NEW key introduced by Phase 241. | (a) Extend `_persist` to include the staged_releases block; extend `hydrate` to consume it (Pattern 4). (b) Add to `defaultSettings` in options.js so existing users get 8 on first read. |
| Live service config | None — no external services have agent-registry-keyed state outside the SW. | None. |
| OS-registered state | None — agent registry is a pure in-memory + browser-storage construct. | None. |
| Secrets/env vars | None changed — connection_id is a per-bridge UUID, not a secret. The bridge URL `ws://localhost:7225` and existing API keys are unchanged. | None. |
| Build artifacts | None — Phase 241 modifies source files only. mcp/ TypeScript will need recompile (Phase 240 already compiled its agent-scope.ts; Phase 241 just adds new fields to the existing flow). | Run existing mcp build (`npm run build` in mcp/) after agent-scope.ts changes. |

**Nothing found in category:** Items above marked "None" are explicit — verified by inspecting agent-registry.js, mcp-bridge-client.js, manifest.json, and grep across the extension.

## Common Pitfalls

### Pitfall 1: SW eviction during the 10s grace window strands agents

**What goes wrong:** setTimeout dies when the SW is evicted. If the bridge disconnects, `stageReleaseByConnectionId` schedules a 10s setTimeout, then the SW is evicted at the 5s mark. On wake, the agent is still in `_agents` (rebuilt from chrome.storage.session) but no setTimeout exists to fire `_fireStagedRelease`. The agent is leaked.

**Why it happens:** chrome.alarms can't go below 30s [VERIFIED]; setTimeout is the only sub-30s mechanism; setTimeout doesn't survive SW eviction.

**How to avoid:** Persist the deadline to chrome.storage.session at stage-time (extend the agent registry envelope with a top-level `stagedReleases: { [connectionId]: { deadline: <ms epoch>, agentIds: [...] } }` block — sibling to `records` and `tabMetadata`). On `hydrate()`, scan the block: if `deadline <= Date.now()` fire `_fireStagedRelease` immediately; otherwise schedule a fresh setTimeout for `deadline - Date.now()`. Pattern 4 above shows the exact code.

**Warning signs:** UAT Phase 244 reports "phantom agents" that survive bridge disconnect; cap shows higher `active` count than expected; agent:status returns agents whose connection is long-gone.

### Pitfall 2: openerTabId is undefined for many tab-creation paths

**What goes wrong:** Plan assumes every new tab inherits ownership. In reality, `chrome.tabs.onCreated` fires with `tab.openerTabId === undefined` for: (a) Ctrl+T (user opens new tab manually); (b) `chrome.tabs.create({})` calls without `opener` context; (c) tabs restored from session; (d) tabs opened from the address bar; (e) tabs opened from a non-agent-owned tab.

**Why it happens:** `openerTabId` is a Chrome-platform-defined optional field, only set when the new tab was opened from an existing tab via `window.open` / `target="_blank"`.

**How to avoid:** Pattern 2 already guards with `if (typeof tab.openerTabId !== 'number') return;`. Document explicitly in code comments and in the test plan that this is INTENDED behavior — such tabs are unowned and become new agents on first tool call. Don't try to "fix" by pooling all new tabs under the most recently active agent (that would be a security regression — Phase 240 just shipped strict ownership).

**Warning signs:** Test "user opens new Chrome tab while agent active" expects pool growth; correct behavior is no pool change. Test must assert `findAgentByTabId` returns null for the new unowned tab.

### Pitfall 3: connection_id race — old timer fires after fresh agent claim

**What goes wrong:** Bridge disconnects with connection_id A → stages release at +10s. Bridge reconnects with new connection_id B (different bridge process restart) → mints fresh agent under B. At T+10s, the A timer fires and tries to release — but B's agent has nothing to do with A.

**Why this is actually fine:** `_fireStagedRelease` filters by connection_id (`record.connectionId === connectionId`). A's timer iterates through `_agents` looking for `connectionId === A`; if A's old agents are gone (released earlier or never re-stamped to A), the filter returns nothing. B's agents have `connectionId === B` and are untouched. **No bug — but document this explicitly so the tests cover it.**

**How to avoid:** Test case in concurrency suite — "old grace timer fires after fresh agent claim under new connection_id; only A's pool released, B's preserved." Pattern 4's `agentIds` array is a snapshot at stage time — if any of those agents are gone by fire time, `_fireStagedRelease` should skip them (not throw). Defensive check inside the agentIds.forEach loop.

### Pitfall 4: chrome.storage.onChanged double-fires across contexts

**What goes wrong:** When the options UI calls `chrome.storage.local.set({ fsbAgentCap: 12 })`, ALL contexts (background SW, popup, sidepanel) receive the onChanged event — including the options page that initiated the change. If the listener naively re-saves on every event, infinite loop.

**Why it happens:** chrome.storage.onChanged is broadcast to all contexts for cross-context state propagation.

**How to avoid:** The SW listener is read-only (it updates `this._cachedCap`, doesn't write back). The options page does NOT listen to onChanged for `fsbAgentCap` (it only reads on load and writes on save). No loop possible.

**Warning signs:** Cap value oscillates after save; multiple "Settings saved" toasts for one save click.

### Pitfall 5: Race between bindTab and onCreated for forced-pool

**What goes wrong:** Tool opens tab T2 from agent A (e.g., `open_tab` MCP call). `chrome.tabs.create({ openerTabId: T1 })` returns; the tool calls `bindTab(A, T2)`; meanwhile `chrome.tabs.onCreated` fires asynchronously and ALSO tries `bindTab(A, T2, { forced: true })`. Both calls go through the mutex — order depends on chain insertion.

**Why this is actually fine:** `bindTab` (agent-registry.js:354-427) checks `currentOwner = self._tabOwners.get(tabId)` and returns false if another agent already owns it. If A owns it from the explicit bind, the forced re-bind by onCreated returns false (same agent) — but the metadata `forced` flag is NOT set. Conversely, if onCreated fires first, the explicit bind returns false too.

**How to avoid:** Decide the resolution: either (a) explicit bind wins (recommended — it carries the deliberate ownership intent and `forced: false` for accurate audit), or (b) treat both as the same agent and idempotently no-op when same-agent. Recommend (a). Test case must cover same-tab double-bind ordering.

**Warning signs:** Tab metadata's `forced` field disagrees with the bind path that actually happened first; observability dashboard shows misleading bind-type stats.

### Pitfall 6: Cap rejection at agent:register but ownershipTokens map left empty

**What goes wrong:** Cap-rejection returns `{ success: false, code: 'AGENT_CAP_REACHED' }`. The MCP server's `AgentScope.ensure()` (agent-scope.ts:43) checks `result.success !== true` and throws — which is correct. But if the consumer doesn't catch the typed code, the user sees a generic error.

**How to avoid:** Extend AgentScope.ensure's error path to detect `code === 'AGENT_CAP_REACHED'` and surface a typed thrown error (e.g., `new AgentCapReachedError(cap, active)`). Tool implementations that call `agentScope.ensure(bridge)` should let the typed error bubble; the MCP framework returns it as a structured tool error to the host. CHANGELOG and tool descriptions in Phase 244 must document the AGENT_CAP_REACHED error code in user-facing terms.

**Warning signs:** UAT reports "the AI tried to do work and failed silently" — typically means the error wasn't surfaced through the chain.

## Code Examples

### Example 1: findAgentByTabId (sync registry read)

```javascript
// Source: new code in extension/utils/agent-registry.js, adjacent to getOwner (line 488)
/**
 * Phase 241 D-01: Sync read — given a tabId, return its owning agentId or null.
 * Wraps the existing _tabOwners reverse map. Provides API parity with
 * findOwnerByTabId callers from chrome.tabs.onCreated (which does not have
 * the agentId in hand).
 */
AgentRegistry.prototype.findAgentByTabId = function(tabId) {
  if (typeof tabId !== 'number' || !Number.isFinite(tabId)) return null;
  return this._tabOwners.get(tabId) || null;
};
```

### Example 2: 20-concurrent-claim cap-check test

```javascript
// Source: new test in tests/agent-registry.test.js (or new file tests/agent-cap.test.js)
const assert = require('assert');
const { AgentRegistry } = require('../extension/utils/agent-registry.js');

(async () => {
  const reg = new AgentRegistry();
  reg.setCap(8); // explicit cap

  // Fire 20 concurrent registerAgent calls.
  const promises = [];
  for (var i = 0; i < 20; i++) {
    promises.push(reg.registerAgent());
  }
  const results = await Promise.all(promises);

  const successes = results.filter(r => r && r.agentId);
  const rejections = results.filter(r => r && r.code === 'AGENT_CAP_REACHED');

  assert.strictEqual(successes.length, 8, 'exactly 8 should succeed under cap=8');
  assert.strictEqual(rejections.length, 12, 'exactly 12 should reject');
  rejections.forEach(r => {
    assert.strictEqual(r.cap, 8);
    assert.strictEqual(r.active, 8);
  });
  console.log('PASS 20-concurrent-claim cap invariant under cap=8');
})();
```

### Example 3: Grace-window cancel-on-reconnect test

```javascript
// Source: new test in tests/agent-grace.test.js
const assert = require('assert');
const { AgentRegistry } = require('../extension/utils/agent-registry.js');

(async () => {
  const reg = new AgentRegistry();
  const { agentId } = await reg.registerAgent();
  reg.stampConnectionId(agentId, 'conn-A');
  await reg.bindTab(agentId, 100);

  // Stage release with a long timeout so the test can cancel synchronously.
  await reg.stageReleaseByConnectionId('conn-A', 60000);
  assert.ok(reg._agents.has(agentId), 'agent still present during grace');

  // Reconnect with same connection_id cancels.
  await reg.cancelStagedRelease('conn-A');
  assert.ok(reg._agents.has(agentId), 'agent preserved after cancel');

  // Re-stage with very short timeout to verify expiry path.
  await reg.stageReleaseByConnectionId('conn-A', 50);
  await new Promise(r => setTimeout(r, 100));
  assert.ok(!reg._agents.has(agentId), 'agent released after grace expiry');
  console.log('PASS grace-window cancel-on-reconnect + expiry');
})();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| (Phase 237) bindTab signature `bindTab(agentId, tabId)` returning boolean/object | (Phase 241) bindTab `bindTab(agentId, tabId, { forced: false })` with metadata `forced` flag | Phase 241 Plan | Backward-compatible — third arg defaults to `{ forced: false }`. Existing call sites at mcp-tool-dispatcher.js:399, 482 don't change. |
| (Phase 237) registerAgent always succeeds | (Phase 241) registerAgent can return `{ code: 'AGENT_CAP_REACHED', cap, active }` | Phase 241 Plan | Caller (`handleAgentRegisterRoute`) must branch on the new error shape. |
| (Phase 240) agent:register response: `{ success, agentId, agentIdShort, ownershipTokens }` | (Phase 241) adds `connectionId` field | Phase 241 Plan | AgentScope.ensure captures `connectionId` alongside `ownershipTokens`. Stale Phase 240 servers omit the field; AgentScope handles missing `connectionId` gracefully. |
| (Phase 237) agent record fields: `{ agentId, createdAt, tabIds, windowId?, legacy? }` | (Phase 241) adds `connectionId?` field | Phase 241 Plan | Persisted envelope hydrates the field on wake; older envelopes without it pass through unchanged. |
| (Phase 237) `chrome.storage.session` envelope `{ v: 1, records, tabMetadata? }` | (Phase 241) adds `stagedReleases?` top-level sibling | Phase 241 Plan | Version stays at v: 1 (older readers ignore unknown fields per agent-registry.js:90-95 comment). |

**Deprecated/outdated:** None. Phase 241 is purely additive on the substrate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bridge clients reuse the same `connection_id` across a flap-and-reconnect within 10s ONLY if the server explicitly hands the same id back. v0.9.60 ships single-bridge-per-process so `_lastKnownConnectionId` is sufficient. | Pattern 3 | If the bridge actually generates a fresh UUID on EVERY reconnect (server-side decision), reconnect-within-grace will NOT cancel the staged release — the user will see all their agents released after a 2-second flap. Mitigation: planner must verify bridge contract; if server doesn't echo, the plan must move connection_id minting to the SERVER side and have the extension RECEIVE it. |
| A2 | Existing `chrome.tabs.onRemoved` listener at background.js:2548 already correctly handles pool-shrink-to-zero release per Phase 237 plan-03. | Pattern 4, LOCK-03 | If this listener does NOT release the agent when pool reaches zero, Phase 241 needs to add that logic to `releaseTab`. **Verify by reading agent-registry.js:439-464 and the test** — the registry's `releaseTab` only releases the tab binding, NOT the agent. So Phase 241 DOES need to add agent-release-when-pool-empty logic to either `releaseTab` or a new sibling. **This raises the scope.** |
| A3 | mcp/src/agent-scope.ts can be extended additively without breaking the published `fsb-mcp-server@0.7.x` contract. | Pattern 3, Phase 244 release | Phase 244 ships `fsb-mcp-server@0.8.0`, so additive changes ride that release. Risk only if Phase 241 ships independently of 244 (out-of-band). Per ROADMAP, this won't happen. |
| A4 | The `forced` metadata flag is observability-only and does NOT affect dispatch-gate decisions. | Pattern 2 | Confirmed by reading mcp-tool-dispatcher.js:143-180 — gate consumes `meta.incognito` and `meta.windowId`, but not forced. Safe to add as audit-only. |
| A5 | chrome.storage.onChanged fires reliably across MV3 SW boundaries (events queue if SW is asleep and replay on wake). | Pattern 5 | Standard MV3 behavior. If onChanged doesn't fire on wake, the cap cache could be stale. Mitigation: registry calls `_loadCapFromStorage()` from inside `hydrate()` so SW wake always reads fresh. |

**Note on A2:** This is the only assumption that, if wrong, increases scope. The planner MUST verify by reading the existing third onRemoved listener in conjunction with agent-registry.js:releaseTab and the integration test.

## Open Questions

1. **Does the MCP bridge server echo connection_id on reconnect, or does each connect mint fresh?**
   - What we know: The extension-side bridge (`mcp-bridge-client.js`) currently does NOT thread connection_id at all. The phase introduces the field.
   - What's unclear: Whether the SERVER (`mcp/src/bridge.ts`) tracks per-connection state and re-issues the same id, or whether the id is simply "what the extension stamped at onopen."
   - Recommendation: Treat connection_id as **extension-side authoritative** — extension mints at onopen, threads outbound to server, server reflects in agent:register response. On reconnect, extension mints fresh; the server has no state to preserve. This is simpler and avoids server-side bookkeeping. **Tradeoff:** A bridge flap that reconnects within 10s will mint a NEW connection_id — so the cancel-on-reconnect mechanism only works if the extension's `_lastKnownConnectionId` matches. For v0.9.60 single-bridge-per-process, `_lastKnownConnectionId` is reliable.

2. **What's the exact storage shape for `stagedReleases`?**
   - What we know: We need {deadline, agentIds} per connection_id.
   - What's unclear: Should we also persist the timeoutId (no — DOM timer ids don't survive SW eviction)? Should the agentIds be a snapshot (yes — agents added after stage time should NOT be released by an earlier stage).
   - Recommendation: `{ [connectionId]: { deadline: <ms epoch>, agentIds: [...snapshot at stage time...] } }`. Plan 02 owns the test that proves the snapshot semantics.

3. **Should `setCap(value)` on the registry RE-CHECK the active count and emit a diagnostic if `active > newCap`?**
   - What we know: D-06 says no eviction.
   - What's unclear: Should we surface a "cap lowered while M agents active — grandfather mode" diagnostic for operator visibility?
   - Recommendation: Yes — emit a one-shot LOG-04 `agent-cap-lowered-grandfathered { previousCap, newCap, activeAtChange }` so operators can correlate UI changes with later cap-rejections. Low cost, high observability value.

## Environment Availability

> Skip — Phase 241 is purely code/config changes within the existing extension codebase. No external tools or services beyond what Phase 237/240 already established (Chrome APIs, Node test harness).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | plain-Node `assert` (no jest/mocha) [VERIFIED: tests/agent-registry.test.js:30 uses `require('assert')`] |
| Config file | None — each test is `node tests/<name>.test.js` |
| Quick run command | `node tests/agent-registry.test.js && node tests/agent-cap.test.js && node tests/agent-grace.test.js` |
| Full suite command | `for f in tests/*.test.js; do node "$f" || exit 1; done` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POOL-01 | Cap-check + insert atomic under mutex | unit | `node tests/agent-cap.test.js` (new) — extends 20-concurrent-claim from agent-registry.test.js | NEW (Wave 0) |
| POOL-02 | (N+1)th claim returns AGENT_CAP_REACHED with cap/active | unit | `node tests/agent-cap.test.js` | NEW (Wave 0) |
| POOL-03 | onCreated.openerTabId pools new tab under owning agent | integration (chrome mock) | `node tests/agent-pooling.test.js` (new) — drives chrome.tabs.onCreated mock and asserts bindTab called with forced:true | NEW (Wave 0) |
| POOL-04 | Pool-shrink-to-zero releases agent (via existing onRemoved) | integration | `node tests/agent-pool-shrink.test.js` (new) | NEW (Wave 0) |
| POOL-05 | Cap setting persists to chrome.storage.local; grandfathered | unit (chrome.storage.local mock) | `node tests/agent-cap-storage.test.js` (new) | NEW (Wave 0) |
| POOL-06 | Cap UI clamps to 1-64; rejects non-integer; reset works | DOM unit (jsdom or harness already in tree) | `node tests/agent-cap-ui.test.js` (new) — load options.js with stub DOM | NEW (Wave 0) |
| LOCK-01 | finalizeSession releases pool cleanly | regression (existing path) | `node tests/agent-registry.test.js` (existing) — extend "releaseAgent" tests with finalizeSession scenario | EXISTS (extend) |
| LOCK-02 | Bridge onclose stages release; onopen-with-same-id cancels; expiry releases | unit (registry-only, no real WebSocket) | `node tests/agent-grace.test.js` (new) — uses synthetic timer | NEW (Wave 0) |
| LOCK-03 | onRemoved is idempotent + commutative; tab-ID reuse safe | regression | `node tests/agent-registry.test.js` (existing covers idempotency); ADD commutativity test | EXISTS (extend) |
| LOCK-04 | No idle timeout — agent persists across long quiet | NEGATIVE assertion test | `node tests/agent-no-idle.test.js` (new) — lock SetImmediate, assert agent still present after 60s simulated quiet | NEW (Wave 0) |

**Regression suite (existing tests must stay green):**

- `tests/agent-registry.test.js` — Phase 237 substrate
- `tests/ownership-gate.test.js` — Phase 240 dispatch gate
- `tests/ownership-error-codes.test.js` — Phase 240 typed errors
- `tests/legacy-agent-synthesis.test.js` — Phase 240 legacy carve-out
- `tests/visual-session-reentry.test.js` — Phase 240 same-agent re-entry
- `tests/mcp-tool-smoke.test.js` — Phase 240 dispatcher smoke
- `tests/mcp-visual-session-contract.test.js` — v0.9.36 contract preservation
- `tests/agent-bridge-routes.test.js` — Phase 238 bridge route handlers
- `tests/agent-id-threading.test.js` — Phase 238 agent_id threading
- `tests/agent-scope.test.js` — Phase 238 AgentScope
- `tests/mcp-bridge-client-lifecycle.test.js` — Phase 239 bridge lifecycle

### Sampling Rate

- **Per task commit:** Run only the test files modified by that commit (e.g., add cap test → run agent-registry + agent-cap; modify bridge → run mcp-bridge-client-lifecycle + agent-grace). Average ~3-5 tests per commit, < 30 seconds total.
- **Per wave merge:** Full registry + bridge + dispatcher + UI test surface — `node tests/agent-registry.test.js && node tests/agent-cap.test.js && node tests/agent-pooling.test.js && node tests/agent-pool-shrink.test.js && node tests/agent-cap-storage.test.js && node tests/agent-cap-ui.test.js && node tests/agent-grace.test.js && node tests/agent-no-idle.test.js && node tests/ownership-gate.test.js && node tests/ownership-error-codes.test.js && node tests/legacy-agent-synthesis.test.js && node tests/visual-session-reentry.test.js && node tests/mcp-tool-smoke.test.js && node tests/agent-bridge-routes.test.js && node tests/agent-id-threading.test.js && node tests/mcp-bridge-client-lifecycle.test.js` (~ 30-60 seconds).
- **Phase gate:** Full suite green — `for f in tests/*.test.js; do node "$f" || exit 1; done`. Plus: 5x manual UAT cap-saturation runs in real Chrome (load extension, drive 8 agents to cap, attempt 9th, observe AGENT_CAP_REACHED in logs and LOG-04 ring buffer).

### Wave 0 Gaps

- [ ] `tests/agent-cap.test.js` — covers POOL-01, POOL-02 (cap-check under mutex; 20-concurrent stress)
- [ ] `tests/agent-pooling.test.js` — covers POOL-03 (chrome.tabs.onCreated forced-pool routing with chrome mock)
- [ ] `tests/agent-pool-shrink.test.js` — covers POOL-04 (pool shrinks; agent released only at pool.size===0; tab-ID reuse safety)
- [ ] `tests/agent-cap-storage.test.js` — covers POOL-05 (chrome.storage.local round-trip; storage.onChanged hydration; grandfather behavior)
- [ ] `tests/agent-cap-ui.test.js` — covers POOL-06 (input clamping, non-integer rejection, reset-to-default)
- [ ] `tests/agent-grace.test.js` — covers LOCK-02 (stage / cancel / expire / hydrate-time recovery)
- [ ] `tests/agent-no-idle.test.js` — covers LOCK-04 (negative assertion: no idle reaper exists)
- [ ] Extension to existing `tests/agent-registry.test.js` — covers LOCK-01 / LOCK-03 commutativity addendum

**Framework install:** None — plain-Node assert is the existing convention; no installs required.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 240 already gates dispatch via (agent_id, tab_id, ownership_token) triple; Phase 241 doesn't change auth |
| V3 Session Management | yes | connection_id is a session-keying primitive; mints via crypto.randomUUID (cryptographically random) [VERIFIED: agent-registry.js:183 uses crypto.randomUUID] |
| V4 Access Control | yes | Cap-rejection prevents resource exhaustion; ownership preserved across grace via Phase 240 token check |
| V5 Input Validation | yes | Cap UI clamps to 1-64 (integer); options.js validation; setCap re-clamps server-side |
| V6 Cryptography | no | Use existing crypto.randomUUID — never hand-roll |
| V11 Business Logic | yes | Grandfather behavior on cap-lower is a business-logic decision; documented and tested |

### Known Threat Patterns for Chrome Extension MV3 + multi-agent registry

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Resource exhaustion via unbounded agent claims | Denial of Service | Cap (default 8, max 64); cap-rejection at agent:register |
| Agent ID guessing / spoofing | Spoofing | Phase 240 ownership_token defense-in-depth (already in place); Phase 241 doesn't weaken this |
| TOCTOU on cap-check (claim N+1 under racing ops) | Tampering | Atomic cap-check + insert under withRegistryLock (POOL-01); 20-concurrent test proves invariant |
| Stale connection_id replay (old conn_id pinned to fresh agent) | Tampering | connection_id stamped per-agent at agent:register; pool release iterates by connection_id field — old timer firing finds no agents matching old id, no-ops |
| Tab-ID reuse during grace window | Tampering | Pre-existing Phase 237/240 defense — tab metadata wiped on releaseTab; rebound tabs get fresh ownership_token |
| Storage poisoning of cap value (manual chrome.storage.local edit) | Tampering | setCap clamps on read AND write; out-of-range values revert to default 8 |
| Cap UI XSS via numeric input | Tampering | type="number" enforces; parseInt with NaN guard; values written via setting.textContent (not innerHTML) |
| Grace timer leak (setTimeout never fires due to SW eviction) | Denial of Service (resource leak) | Hydrate-time scan persists deadline + recovers on wake (Pitfall 1) |

## Sources

### Primary (HIGH confidence — VERIFIED in tree)

- `/Users/lakshmanturlapati/Desktop/FSB/extension/utils/agent-registry.js` lines 1-795 — full Phase 237/240 substrate read
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ws/mcp-bridge-client.js` lines 1-230 + tail — bridge onopen/onclose hooks identified at lines 91, 112
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ws/mcp-tool-dispatcher.js` lines 60-200, 780-870 — agent:register handler and dispatch gate
- `/Users/lakshmanturlapati/Desktop/FSB/extension/background.js` lines 1-50, 2480-2560, 2300-2316, 12750-12790 — importScripts ordering, onRemoved listeners, bootstrapAgentRegistry boot site
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ui/control_panel.html` lines 333-565 — Advanced Settings section structure
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ui/options.js` lines 1-80, 230-280, 670-845 — defaultSettings, cacheElements, loadSettings, saveSettings patterns
- `/Users/lakshmanturlapati/Desktop/FSB/extension/manifest.json` line 41 — `"options_page": "ui/control_panel.html"` confirms the actual options HTML path
- `/Users/lakshmanturlapati/Desktop/FSB/mcp/src/agent-scope.ts` lines 1-150 — AgentScope class and ownershipToken capture pattern
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/REQUIREMENTS.md` POOL-01..06, LOCK-01..04
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/phases/241-pooling-configurable-cap-reconnect-grace/241-CONTEXT.md` D-01..D-13
- `/Users/lakshmanturlapati/Desktop/FSB/tests/agent-registry.test.js` (test framework convention)

### Secondary (MEDIUM-HIGH confidence — official Chrome docs)

- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) — minimum delay 30s confirmed (Chrome 120+)
- [Service Worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 30s eviction floor; setTimeout dies on eviction

### Tertiary (LOW — none)

No claim in this RESEARCH.md depends solely on WebSearch results.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all files read in full, no version uncertainty since no new packages.
- Architecture patterns: HIGH — every pattern is grounded in an existing in-tree code site that I read (line numbers cited).
- Pitfalls: HIGH — chrome.alarms 30s floor is verified via official Chrome docs; the SW-eviction-during-setTimeout is well-known MV3 behavior.
- Validation: HIGH — test framework convention verified by reading existing tests/agent-registry.test.js header.
- Security: HIGH — STRIDE map grounded in existing Phase 237/240 defenses; no new attack surface introduced beyond cap-induced DoS resistance (which IS the defense).

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days; the substrate is stable post-Phase-240 ship)

## RESEARCH COMPLETE
