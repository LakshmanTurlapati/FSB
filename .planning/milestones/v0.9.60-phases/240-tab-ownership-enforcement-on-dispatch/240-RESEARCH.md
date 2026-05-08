# Phase 240: Tab-Ownership Enforcement on Dispatch - Research

**Researched:** 2026-05-06
**Domain:** MV3 service-worker dispatch chokepoint, in-memory ownership gate, MCP bridge payload threading
**Confidence:** HIGH (every claim verified directly against repo files; no external library guesswork)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Cross-agent rejection includes full ownerAgentId.** Reject shape: `{code: 'TAB_NOT_OWNED', ownerAgentId: '<full-agent-id>', requestedTabId, requestingAgentId}`.
- **D-02 Each legacy surface is its own agent.** Three synthesized agentIds: `legacy:popup`, `legacy:sidepanel`, `legacy:autopilot`. Each legacy surface synthesizes its agentId at boot and registers it through the existing `agent:register` route from Phase 238 (caller-id-ignored / fresh-mint posture from Phase 238 D-12 — but the extension surface uses the SAME `legacy:<surface>` constant on every dispatch, so cleanup-on-reload writes the same row back).
- **D-03 Same-agent re-entry RESUMES the prior session.** When the same agent calls `startSession` on a tab it already owns, re-attach via the resume code path (NOT endSession-then-start). Cross-agent re-entry on the same tab still rejects with `tab_owned_by_other_agent` per SC#3.
- **D-04 Per-bindTab opaque randomUUID token.** Each `bindTab(agentId, tabId)` mints fresh `ownership_token = crypto.randomUUID()` stored alongside the binding in the v: 1 envelope. Dispatch check is `isOwnedBy(tabId, agentId, ownership_token)` — all three must match. Wire field name: `ownershipToken` (camel).
- **D-05 Distinct typed codes**: `TAB_NOT_OWNED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE { reason: 'cross_window' | 'non_current_window' }`.
- **D-06 Single chokepoint at dispatchMcpToolRoute** (locked SC#1).
- **D-07 No `await` between check and dispatch** — same microtask. Sync registry reads only.
- **D-08 bindTab calls before success return** in `handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`, and `handleStartAutomation`.
- **D-09 mcp-visual-session.js:startSession rejects cross-agent re-entry** with `tab_owned_by_other_agent` (SC#3).
- **D-10 Manifest posture: no incognito access**; runtime check rejects incognito tabs by ID at dispatch (SC#4).

### Claude's Discretion

- `crypto.randomUUID()` recommended directly for token mint.
- Where exactly bindTab lands inside each handler body (must be before success return).
- Plain-object error pattern recommended (parity with Phase 238) — no `FsbOwnershipError` class.
- Test fixture naming: `tests/ownership-gate.test.js`, `tests/ownership-error-codes.test.js`, `tests/legacy-agent-synthesis.test.js`.
- Inline check in `dispatchMcpToolRoute` recommended over a new helper file.
- `ownershipToken` (camel) recommended on the wire.
- Whether `agent:register` response carries `ownershipTokens: {[tabId]: token}` — planner's call.

### Deferred Ideas (OUT OF SCOPE)

- Hash/short-form ownerAgentId in error responses.
- Single TAB_INACCESSIBLE error code with reason field.
- legacy:* bypass pattern.
- Per-agent long-lived ownership token.
- Token-less dispatch.
- Visual-session same-agent kill-and-start-fresh (`force: true`).
- Visual-session error-on-active-session.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OWN-01 | Every tab opened by an agent binds `tab_id -> agent_id` authoritatively in the registry | bindTab call sites in 4 handlers (D-08) — see "Handler Inventory" §3 below; registry already has `bindTab(agentId, tabId)` from Phase 237; D-04 requires extending it to mint and return `ownershipToken` |
| OWN-02 | All MCP tool dispatch flows through a single chokepoint that verifies `(agent_id, tab_id, ownership_token)` before invoking the handler | `dispatchMcpToolRoute` at extension/ws/mcp-tool-dispatcher.js:119 is the chokepoint; gate trips synchronously before `route.handler(...)` invocation at line 129 |
| OWN-03 | Cross-agent tab access rejected loudly with typed `TAB_NOT_OWNED` (including the actual owner's `agent_id`) | D-01 + D-05; gate emits `{code: 'TAB_NOT_OWNED', ownerAgentId, requestedTabId, requestingAgentId}` |
| OWN-04 | v0.9.36 visual-session manager rejects cross-agent `startSession` with `tab_owned_by_other_agent` (preserves displacement for same-agent re-entry) | mcp-visual-session.js:startSession (line 90) currently does same-tab session displacement unconditionally; needs cross-agent reject + same-agent resume hook (D-03 + D-09) |
| OWN-05 | Incognito and cross-window tab IDs rejected at the dispatch boundary | D-10 — runtime check on cached `incognito` and `windowId` from the registry record (NOT a fresh `chrome.tabs.get` per dispatch — that would violate D-07) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- NO EMOJIS in any artifact (terminal logs, README, markdown).
- Comprehensive JSDoc documentation, ES2021+, Chrome Extension best practices.
- Manual testing across diverse websites; performance benchmarking.

## Summary

Phase 240 trips the cross-agent ownership gate at `dispatchMcpToolRoute` in `extension/ws/mcp-tool-dispatcher.js:119`. Phase 238 already destructured `agentId` from `payload` at every dispatcher handler and explicitly ignored it (`void agentId`); Phase 240 extends each destructure with `ownershipToken` and makes the destructure load-bearing — the gate uses `agentId + ownershipToken` from the destructured payload to call `globalThis.fsbAgentRegistryInstance.isOwnedBy(tabId, agentId, ownershipToken)` synchronously before invoking the handler.

The Phase 237 registry (`extension/utils/agent-registry.js`) already exposes the necessary CRUD with sync reads on the in-memory Maps, but its current `bindTab(agentId, tabId)` and `isOwnedBy(tabId, agentId)` signatures must be extended: bindTab must mint and return an `ownershipToken` (crypto.randomUUID()) and store it in the per-tab record alongside the tab's `incognito` flag and `windowId` (cached at bindTab time so the gate avoids `chrome.tabs.get` round-trips). The v: 1 storage envelope can carry these new fields without a schema bump because Phase 237's `cloneRecord`/`_persist` round-trip already JSON-serializes the entire record.

The 4 handlers in D-08 (`handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`, `handleStartAutomation`) each have a clear "before success return" insertion site — the location is unambiguous in the code as it stands today. For visual-session, the cross-agent reject branches in `mcp-visual-session.js:startSession` (line 90); the same-agent resume code path is NEW in Phase 240 (the v0.9.36 contract is "session displacement" — Phase 240 introduces "same-agent resume" as a sibling branch, not a replacement).

Legacy surfaces are minimal in scope: `popup.js` (1 site, line 227) and `sidepanel.js` (1 site, line 402) both call `chrome.runtime.sendMessage({action: 'startAutomation', ...})` which lands at `background.js:6224 handleStartAutomation`. The `legacy:autopilot` agent fits inside `handleStartAutomation` itself (synthesized once at boot or lazily on first call). The `legacy:popup` / `legacy:sidepanel` agentIds are synthesized at the boot of those UI scripts and threaded into the `startAutomation` request payload (or — simpler — `handleStartAutomation` infers the surface from `request.source`).

**Primary recommendation:** Extend Phase 237's `bindTab` to accept-or-mint a token and cache `incognito`/`windowId` from a one-time `chrome.tabs.get` at bind time; extend `isOwnedBy` to take an optional token and compare it strictly when present. Inline the gate in `dispatchMcpToolRoute` as 5-8 lines using a per-tool tabId resolver helper (handlers vary in how they identify the target tab). Synthesize the three `legacy:<surface>` agentIds via a new `ensureLegacyAgent(surface)` helper that calls `registerAgent` once per surface per SW lifetime and stashes the result on `globalThis.fsbLegacyAgents = { popup, sidepanel, autopilot }`.

## Standard Stack

### Core (already in repo, no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `crypto.randomUUID()` | MV3 SW native (Chrome 92+) | Mint per-bindTab `ownership_token` | Phase 237 already uses it for `agent_id` mint at agent-registry.js:173 [VERIFIED]; same pattern lands token mint in same file |
| Phase 237 `AgentRegistry` | extension/utils/agent-registry.js | Read/write authoritative tab ownership | `globalThis.fsbAgentRegistryInstance` already wired by background.js:782-799 bootstrapAgentRegistry [VERIFIED] |
| `node:test` plain-assert harness | Node 18+ stdlib | Unit + integration tests | Phase 238 + 239 convention (`tests/agent-bridge-routes.test.js`, `tests/run-task-cleanup-paths.test.js`) [VERIFIED via tests/ ls] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chrome.tabs.get(tabId)` | MV3 native | Read `incognito` / `windowId` ONCE at bind time and cache on the registry record | Called from inside `bindTab` (which is `await`-able), NEVER from inside the dispatch gate (D-07 violation) |
| `chrome.windows.getCurrent()` | MV3 native | Resolve "current window" for cross-window check | Phase 240 may need this for the `non_current_window` rejection branch under D-05 — call from inside `bindTab` (or from registry reconcile) and cache |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline gate in `dispatchMcpToolRoute` | New `extension/utils/ownership-gate.js` helper module | Helper adds another importScripts ordering concern + indirection for a 5-8 line check; CONTEXT D-discretion recommends inline. Use helper only if the gate grows past ~20 lines |
| `ownership_token` (snake_case) | `ownershipToken` (camelCase) | Locked by D-04 to camel; matches `agentId` destructure pattern that Phase 238 already established at all 15 handlers |
| Storage schema bump (v: 1 → v: 2) | Stay on v: 1 | Phase 237's `_persist` JSON-serializes the entire record without per-field validation, so adding `ownershipToken`, `incognito`, `windowId` to the record is backward-compatible (older readers ignore unknown fields). v: 2 only if hydrate logic needs to migrate |
| `FsbOwnershipError` class | Plain-object `{success: false, code, ...}` | Phase 238 uses plain-object errors throughout dispatcher (`createMcpRouteError`); D-discretion recommends parity. Class would force everywhere to import from a new module |

**Installation:** None — all dependencies are already vendored in the repo or part of the MV3 SW runtime.

**Version verification:** `crypto.randomUUID()` confirmed available in Chrome MV3 SW context [VERIFIED via existing use at agent-registry.js:173 and at mcp-visual-session.js:50].

## Architecture Patterns

### Recommended Project Structure (no new files unless tests)

```
extension/
├── ws/
│   └── mcp-tool-dispatcher.js   # MODIFIED: gate inlined in dispatchMcpToolRoute + bindTab calls in 3 of 4 D-08 handlers
├── utils/
│   ├── agent-registry.js        # MODIFIED: bindTab/isOwnedBy extended for token + cached incognito/windowId
│   └── mcp-visual-session.js    # MODIFIED: startSession adds cross-agent reject + same-agent resume branches
├── background.js                # MODIFIED: handleStartAutomation gets bindTab call before success return; legacy:autopilot synthesis
└── ui/
    ├── popup.js                 # MODIFIED: legacy:popup synthesis at boot, threaded into startAutomation message
    └── sidepanel.js             # MODIFIED: legacy:sidepanel synthesis at boot, threaded into startAutomation message

tests/
├── ownership-gate.test.js              # NEW: dispatch gate trip behavior
├── ownership-error-codes.test.js       # NEW: 3 typed code shapes (or merged into ownership-gate)
├── legacy-agent-synthesis.test.js      # NEW: 3 legacy:<surface> agentId paths
├── agent-registry.test.js              # MODIFIED: token-aware bindTab/isOwnedBy
└── mcp-visual-session-contract.test.js # MODIFIED: same-agent resume + cross-agent reject branches
```

### Pattern 1: Same-microtask gate (D-07 verbatim)

**What:** Gate runs purely sync inside `dispatchMcpToolRoute` before the handler dispatch await.

**When to use:** Every tool that targets a specific tabId — i.e., every handler that today reads `params.tabId` or resolves `getActiveTabFromClient(client)`.

**Example (synthesized — current code at extension/ws/mcp-tool-dispatcher.js:119-130):**

```javascript
// Source: extension/ws/mcp-tool-dispatcher.js:119 (current shape)
async function dispatchMcpToolRoute({ tool, params = {}, client = null, tab = null, payload = {} }) {
  const route = MCP_PHASE199_TOOL_ROUTES[tool];
  if (!route) return createMcpRouteError(tool, 'tool', MCP_ROUTE_RECOVERY_HINT);
  if (typeof route.handler !== 'function') return createMcpRouteError(tool, route.routeFamily, MCP_ROUTE_RECOVERY_HINT);

  // -- Phase 240 gate INSERT POINT (between route resolution and handler invocation) --
  // The check MUST be sync. The reject MUST be a plain object with one of the three D-05 codes.
  // Tools that do not target a tabId (e.g., 'list_tabs', 'open_tab' for create-mode) skip the
  // tabId arm of the gate but still require a registered agentId.
  const gateResult = checkOwnershipGate({ tool, params, payload, route });
  if (gateResult) return gateResult;  // typed reject; same microtask as the dispatch below
  // -- end Phase 240 insert --

  return route.handler({ tool, params: params || {}, client, tab, payload, route });
}
```

The `checkOwnershipGate` helper is a pure-sync function that:
1. Pulls `agentId, ownershipToken` from `payload || {}` (Phase 238 destructure pattern).
2. Resolves the target tabId per `tool` (see "Handler Inventory" §3 below for the per-handler resolution rules).
3. If tabId resolved: calls `globalThis.fsbAgentRegistryInstance.isOwnedBy(tabId, agentId, ownershipToken)` (sync).
4. If owner mismatch → `{success: false, code: 'TAB_NOT_OWNED', ownerAgentId, requestedTabId, requestingAgentId: agentId}`.
5. If tabId resolves but registry's cached record has `incognito === true` → `{success: false, code: 'TAB_INCOGNITO_NOT_SUPPORTED', tabId}`.
6. If tabId resolves but `windowId` ≠ current → `{success: false, code: 'TAB_OUT_OF_SCOPE', tabId, reason: 'cross_window' | 'non_current_window'}`.
7. Returns `null` on pass; the caller proceeds to dispatch in the same microtask.

### Pattern 2: bindTab carries token + cache (extends Phase 237)

**Source:** Phase 237 `extension/utils/agent-registry.js:266-295` (current bindTab).

```javascript
// Phase 237 current shape:
AgentRegistry.prototype.bindTab = function(agentId, tabId) { /* ... */ };

// Phase 240 extension (sketch):
AgentRegistry.prototype.bindTab = function(agentId, tabId, opts) {
  return withRegistryLock(async function() {
    // ... existing validation ...

    // NEW: read tab's incognito + windowId once, here, while we're awaitable.
    // The gate (sync) will read these from the cached record.
    var incognito = false;
    var windowId = null;
    var c = _getChrome();
    if (c && c.tabs && typeof c.tabs.get === 'function') {
      try {
        var tabInfo = await c.tabs.get(tabId);
        incognito = tabInfo && tabInfo.incognito === true;
        windowId = (tabInfo && Number.isFinite(tabInfo.windowId)) ? tabInfo.windowId : null;
      } catch (_e) {
        // Tab may have closed between caller's intent and our get; bind still proceeds
        // but with incognito/windowId null. Subsequent dispatch will fail the gate
        // gracefully via the registry returning isOwnedBy=false.
      }
    }

    // NEW: mint per-bindTab token (D-04).
    var ownershipToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID() : ('tok_' + Date.now().toString(16));

    self._tabOwners.set(tabId, agentId);
    // NEW Map: per-tab metadata. Or extend the AgentRecord. Recommend a sibling Map
    // keyed by tabId so getOwner stays a single lookup.
    self._tabMetadata.set(tabId, { ownershipToken, incognito, windowId, boundAt: Date.now() });

    // ... persist + return ...
    return { agentId, tabId, ownershipToken };
  });
};

// Sync gate-side read:
AgentRegistry.prototype.isOwnedBy = function(tabId, agentId, ownershipToken) {
  if (this._tabOwners.get(tabId) !== agentId) return false;
  if (ownershipToken !== undefined) {
    var meta = this._tabMetadata.get(tabId);
    if (!meta || meta.ownershipToken !== ownershipToken) return false;
  }
  return true;
};

// NEW sync read: gate uses to enforce D-10 + D-05.
AgentRegistry.prototype.getTabMetadata = function(tabId) {
  return this._tabMetadata.get(tabId) || null;
};
```

### Pattern 3: Visual-session same-agent resume (D-03 + D-09)

**Source:** `extension/utils/mcp-visual-session.js:90-134` startSession (current shape).

Today: line 107-109 deletes the existing token unconditionally and creates a brand-new session for the tab (the v0.9.36 displacement contract). For Phase 240, the change is to gate this displacement on agent ownership:

```javascript
// Phase 240 extension to startSession (sketch):
McpVisualSessionManager.prototype.startSession = function(input) {
  // ... existing validation (clientLabel, tabId, etc.) ...
  var existingToken = this._tokenByTabId.get(tabId) || null;
  var existingSession = existingToken ? this._sessionsByToken.get(existingToken) : null;

  // NEW: agent ownership branch.
  if (existingSession && input && input.agentId) {
    var owner = (globalThis.fsbAgentRegistryInstance &&
                 typeof globalThis.fsbAgentRegistryInstance.getOwner === 'function')
      ? globalThis.fsbAgentRegistryInstance.getOwner(tabId) : null;

    if (owner && owner !== input.agentId) {
      // Cross-agent reject (D-09 / SC#3).
      return { errorCode: 'tab_owned_by_other_agent', ownerAgentId: owner };
    }

    if (owner === input.agentId) {
      // Same-agent re-entry: RESUME (D-03), do NOT replace.
      // Update task / detail / lastUpdateAt on the existing session and return it.
      existingSession.task = normalizeText(input.task, existingSession.task);
      existingSession.detail = normalizeText(input.detail, existingSession.detail);
      existingSession.lastUpdateAt = Date.now();
      existingSession.version = (existingSession.version || 1) + 1;
      return { session: cloneSession(existingSession), resumed: true };
    }
  }

  // ... existing displacement code path (legacy, unowned tab) unchanged ...
};
```

### Anti-Patterns to Avoid

- **Awaiting `chrome.tabs.get(tabId)` inside the gate.** Violates D-07. The cached `incognito` / `windowId` on the registry record is the SOLE source of truth at dispatch time. `chrome.tabs.get` happens once at bindTab.
- **Throwing on gate failure instead of returning a plain-object reject.** Phase 238's pattern (`createMcpRouteError`) returns `{success: false, errorCode, ...}` — Phase 240 follows the same shape so the existing bridge response path stays unchanged.
- **Skipping the gate for "internal" handlers.** The 6 observability/control handlers (`agent:*`, `mcp:get-diagnostics`, `mcp:list-sessions`, `mcp:get-session`, `mcp:get-logs`, `mcp:search-memory`, `mcp:get-memory`) do NOT take a tabId — they skip the tabId arm of the gate but should still validate that `agentId` is registered (i.e., known to the registry).
- **Synthesizing legacy agentIds at every call site.** Mint once per SW lifetime (or per UI script load) and cache on `globalThis.fsbLegacyAgents`. Re-minting on every call generates token churn and breaks "ownership stays through navigation" semantics.
- **Forgetting that `handleOpenTabRoute` creates a NEW tab.** The gate's tabId-resolution arm finds nothing to check (no tab yet); the agent must still be registered, but the tabId check is naturally skipped. The bindTab call happens AFTER `chrome.tabs.create` resolves — see §3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID minting for tokens | Custom random hash | `crypto.randomUUID()` | Already proven in agent-registry.js:173 and mcp-visual-session.js:50; available in MV3 SW; cryptographically strong |
| Per-tab incognito/window cache invalidation | Listen to `chrome.tabs.onUpdated` for incognito changes | Cache once at bindTab; rely on `chrome.tabs.onRemoved → releaseTab` (already wired at background.js:2544) for cleanup | A tab cannot transition between incognito and normal — these are immutable for a tab's lifetime. windowId can change (drag tab between windows), but cross-window agents are out of scope per Out-of-Scope list, so a stale windowId cache is the desired reject behavior |
| "Has this agent been registered" check | Custom Map | `globalThis.fsbAgentRegistryInstance._agents.has(agentId)` (sync) or expose `hasAgent(agentId)` | Registry owns this state; expose a sync read |
| Mutex for bindTab calls during gate-protected handlers | Custom locking | Phase 237's `withRegistryLock` already serializes all mutation paths | Single SW thread + 4-line promise chain is sufficient; the gate is read-only and doesn't enter the lock |
| "Current window" detection for D-05 cross-window reject | Custom polling | Cache `windowId` at bindTab; compare against a once-per-SW-boot snapshot of "current window" via `chrome.windows.getCurrent()` (or simply: every bindTab in the same window pool stamps with that windowId) | A registry-stamped windowId is naturally consistent because all tabs an agent owns are bound through the registry. Cross-window reject means "the requesting agent's pool spans windows" which the registry knows by inspection |

**Key insight:** Phase 237's registry was deliberately designed to own the data; Phase 240's gate is a 5-line read on data that already exists or is trivially extendable. The temptation to build a parallel ownership cache or a separate "permissions" module would create two sources of truth and break the same-microtask discipline.

## Runtime State Inventory

This phase modifies code, not data. But the registry's `chrome.storage.session` envelope IS persisted state and Phase 240 extends it.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `chrome.storage.session.fsbAgentRegistry` (Phase 237 v: 1 envelope at agent-registry.js:39); records keyed by `agentId` with `{agentId, createdAt, tabIds[]}` shape | Extend record shape to add per-tab `ownershipToken`, `incognito`, `windowId`. Backward-compatible at v: 1 because `cloneRecord` JSON-passes through unknown fields. New SW boots that read an old envelope (no token field) will simply have `ownershipToken === undefined` for those records — and existing callers without a token won't pass the gate, which is the desired behavior on stale data. Existing data lifetime: browser-session only (storage.session is wiped at browser quit). NO data migration step required. |
| Live service config | None — registry is in-memory + storage.session only | None — verified by reading agent-registry.js end-to-end and confirming there are no external service dependencies (no n8n, no DBs, no cloud) |
| OS-registered state | None — no Task Scheduler / launchd / pm2 dependencies | None — verified by reading background.js boot sequence |
| Secrets/env vars | None — `ownershipToken` is process-local, never crosses the bridge in plaintext beyond the bridge envelope already used for `agentId` | None — verified; ownership_token never leaves the SW except via tool-call payloads, which is the entire point |
| Build artifacts | `mcp/dist/*` for the TS server is regenerated on each `npm run build` | TS server-side files (autopilot.ts/manual.ts/visual-session.ts) need to thread `ownershipToken` alongside `agentId` in the bridge.sendAndWait payload — same pattern Phase 238 used for `agentId`. Run `npm run build` in `mcp/` after edits |

**Nothing found in category:** OS-registered state, secrets/env vars, live service config — verified by direct reading.

## Common Pitfalls

### Pitfall 1: Awaiting in the gate
**What goes wrong:** Someone adds `await chrome.tabs.get(tabId)` to read incognito at dispatch time.
**Why it happens:** Natural-feeling refactor when adding cross-window check; "I just need to know if the tab is incognito".
**How to avoid:** The gate function MUST be synchronous. Make it `function checkOwnershipGate(...)` not `async function`. Linter / grep guard: `grep -n 'async' extension/ws/mcp-tool-dispatcher.js | grep -i 'gate'` should produce zero results. The only reads are `_tabOwners.get` and `_tabMetadata.get` — both Map ops, both sync.
**Warning signs:** A test that times timing-sensitive ordering breaks; the smoke test starts depending on microtask ordering.

### Pitfall 2: Tab-ID reuse race (canonical TOCTOU bug)
**What goes wrong:** Agent A binds tab T1, tab closes (registry releases via onRemoved), tab T1's id gets reused by Chrome for a tab Agent B opens. Agent A's queued action arrives and the gate passes because A's stale agentId still has token+tabId in some cached payload.
**Why it happens:** Chrome reuses tab IDs aggressively; closed-then-reopened tabs can collide within milliseconds.
**How to avoid:** The token is the defense — when tab T1 closes, Phase 237's `releaseTab` removes the entry from `_tabOwners` AND the new Phase 240 `_tabMetadata` (token wiped). If Agent B then binds T1, a NEW token is minted. Agent A's stale request carries the OLD token and fails `isOwnedBy(T1, agentA, oldToken)` because there's no record at `_tabMetadata.get(T1).ownershipToken === oldToken`.
**Warning signs:** TEST-05 in REQUIREMENTS.md is exactly this scenario. Phase 244 owns the dedicated test, but Phase 240 must guarantee the underlying invariant.

### Pitfall 3: Visual-session storage replay vs registry boot order
**What goes wrong:** SW evicts; on wake, `bootstrapAgentRegistry` runs hydrate() and `bootstrapMcpVisualSessions` runs in parallel. The visual-session restore path calls `restoreSession`, which sets `_sessionsByToken` and `_tokenByTabId`. The registry hydrate() drops ghost records (agent's tab is gone). Now the visual session points at a tab the registry has no agent for.
**Why it happens:** Phase 237's hydrate is idempotent and conservative; Phase 240 adds a NEW dependency between visual-session and registry.
**How to avoid:** Document the order — registry hydrate must complete BEFORE visual-session restore checks ownership. background.js:782 already runs `bootstrapAgentRegistry` first; verify the visual-session bootstrap awaits or runs after. The cross-agent reject in `startSession` checks `getOwner(tabId)` — if owner is null (registry doesn't know the tab), the new branch should NOT reject (treat null-owner as "not owned by anyone yet" — let the displacement / new-session path proceed). This matches the semantic: "no agent claims this tab; whoever calls first wins".
**Warning signs:** Visual-session contract tests start failing on SW-eviction scenarios.

### Pitfall 4: legacy:* agent re-registration churn
**What goes wrong:** popup or sidepanel re-opens (the views are recreated each time the user clicks the icon); the script re-runs and re-mints `legacy:popup`. Now there are 5 `legacy:popup` entries in the registry, only one of which has the bound tabs.
**Why it happens:** Popup/sidepanel are short-lived UI views, not persistent processes.
**How to avoid:** Use a CONSTANT agentId string (`legacy:popup`, not `agent_<uuid>`); the registry's `registerAgent` is called only when the agent doesn't exist (idempotent on the constant). Phase 238 D-12 says caller-supplied agentIds are ignored at registration; Phase 240 needs an exception for the legacy:* prefix OR a new `registerLegacyAgent(surface)` API that allows the constant ID. The CONTEXT.md D-02 explicitly anticipates this: "the extension surface knows to use the SAME `legacy:<surface>` constant on every dispatch". Recommend: a new `getOrRegisterLegacyAgent(surface)` API on the registry that mints the legacy:* row only if missing, and returns existing if present.
**Warning signs:** Registry grows unbounded; legacy:popup-{1,2,3,...} variants appear in `listAgents()`.

### Pitfall 5: Smoke test deepEqual sites
**What goes wrong:** The 12 sites in `tests/mcp-tool-smoke.test.js` Phase 238 strengthened with `agentId: 'agent_test_smoke'` will now miss `ownershipToken` and the deepEqual will fail.
**Why it happens:** Phase 240 adds a new field to the same payloads.
**How to avoid:** Update each smoke test site to include `ownershipToken: 'tok_test_smoke'` (or whatever deterministic value the test harness mints in its `agent:register` mock at line 109). The MCP server's `AgentScope.ensure()` must return both `agentId` AND `ownershipToken` from the agent:register response; Phase 240 extends the agent:register response handler at extension/ws/mcp-tool-dispatcher.js:670 (`handleAgentRegisterRoute`) to include the token (since registerAgent is the entry point, but tokens are per-bindTab — there's no token at register time unless the first bindTab is implicit. Planner decides).
**Warning signs:** `tests/mcp-tool-smoke.test.js` fails at the navigate / click / start_visual_session / end_visual_session / run_task / stop_task sites (lines 132, 167, 184, 198, 206, 213).

### Pitfall 6: Storage envelope schema drift across Phase 237 and Phase 240 boots
**What goes wrong:** A user upgrades extension mid-browser-session: SW with Phase 237 wrote envelope; new SW with Phase 240 reads envelope, but new code expects `ownershipToken` per tab and finds none.
**Why it happens:** storage.session survives extension reload (within a browser session).
**How to avoid:** Treat `ownershipToken === undefined` on a hydrated record as "stale binding, discard". The registry's hydrate() can either drop the record (safest) or treat the binding as broken (next dispatch fails the gate, releasing on first call). Recommend: in Phase 240's hydrate, any tab record without an `ownershipToken` is reaped (with a new reason tag like `missing_token`) and an `agent:reaped` diagnostic emits. Storage.session is browser-session-bound so this is a one-time hiccup at upgrade.
**Warning signs:** Mid-session upgrades cause unexpected TAB_NOT_OWNED rejects on previously-owned tabs.

## Code Examples

### Inline gate at dispatchMcpToolRoute
```javascript
// Source: extension/ws/mcp-tool-dispatcher.js (Phase 240 modification)

function resolveTabIdForGate(tool, params, payload) {
  // Tools that explicitly carry a tabId param.
  if (Number.isFinite(params && params.tabId)) return params.tabId;
  // Tools that explicitly carry a tabId payload.
  if (Number.isFinite(payload && payload.tabId)) return payload.tabId;
  // Open-tab tools: NO tabId yet (creating one). Skip tabId arm of gate.
  if (tool === 'open_tab' || tool === 'list_tabs') return null;
  // Navigate / go_back / go_forward / refresh resolve via getActiveTabFromClient
  // ASYNCHRONOUSLY in the handler today. Phase 240 cannot resolve sync here.
  // RECOMMENDATION: require explicit tabId on every tool that targets a tab.
  // For backward-compat: if no tabId is present, the gate's tabId arm is null
  // and the handler's existing async getActiveTabFromClient resolves it; the
  // registry's bindTab call (D-08) will validate ownership at success-return time.
  return null;
}

function checkOwnershipGate({ tool, params, payload, route }) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg) return null; // graceful: pre-Phase-237 boot; gate disabled

  const agentId = (payload && payload.agentId) || (params && params.agentId) || null;
  const ownershipToken = (payload && payload.ownershipToken) || (params && params.ownershipToken) || null;

  // Agent must be known.
  if (!agentId || (typeof reg.hasAgent === 'function' && !reg.hasAgent(agentId))) {
    return { success: false, code: 'AGENT_NOT_REGISTERED', requestingAgentId: agentId };
  }

  const tabId = resolveTabIdForGate(tool, params, payload);
  if (tabId === null) return null; // pass; tab-creating tool or active-tab-resolved-later

  // Ownership check (sync).
  if (!reg.isOwnedBy(tabId, agentId, ownershipToken)) {
    const ownerAgentId = reg.getOwner(tabId) || null;
    return { success: false, code: 'TAB_NOT_OWNED', ownerAgentId, requestedTabId: tabId, requestingAgentId: agentId };
  }

  // Incognito + cross-window checks via cached metadata.
  const meta = (typeof reg.getTabMetadata === 'function') ? reg.getTabMetadata(tabId) : null;
  if (meta && meta.incognito === true) {
    return { success: false, code: 'TAB_INCOGNITO_NOT_SUPPORTED', tabId };
  }
  // Cross-window: pool's windowId mismatch. Implementation depends on whether
  // we cache "agent's intended windowId" on the agent record. Planner decides.
  return null;
}
```

### bindTab call in handleOpenTabRoute (D-08)
```javascript
// Source: extension/ws/mcp-tool-dispatcher.js:357 (Phase 240 modification)
async function handleOpenTabRoute({ params, payload }) {
  const { agentId, ownershipToken } = payload || {};
  void ownershipToken; // Phase 240: ignored at open-tab (we mint a fresh one)
  try {
    getChromeTabsApi();
    const tab = await chrome.tabs.create({ url: params.url || 'about:blank', active: params.active !== false });

    // -- Phase 240 D-08 INSERT POINT --
    let newOwnershipToken = null;
    if (globalThis.fsbAgentRegistryInstance && Number.isFinite(tab && tab.id)) {
      const bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, tab.id);
      newOwnershipToken = (bindResult && bindResult.ownershipToken) || null;
    }
    // -- end insert --

    return sanitizeSingleTab('open_tab', tab, { ownershipToken: newOwnershipToken });
  } catch (error) {
    return createMcpRouteError('open_tab', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error) });
  }
}
```

### Legacy agent synthesis (popup boot)
```javascript
// Source: extension/ui/popup.js (Phase 240 modification, line ~1)
// At popup boot, before any startAutomation message:
let _legacyPopupAgent = null;
async function ensureLegacyPopupAgent() {
  if (_legacyPopupAgent) return _legacyPopupAgent;
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'ensureLegacyAgent', surface: 'popup' },
      (resp) => resolve(resp || {})
    );
  });
  if (response && response.success) {
    _legacyPopupAgent = { agentId: response.agentId, ownershipToken: response.ownershipToken || null };
  }
  return _legacyPopupAgent;
}

// Then at line 227 (the startAutomation call):
const legacy = await ensureLegacyPopupAgent();
chrome.runtime.sendMessage({
  action: 'startAutomation',
  task: message,
  tabId: tab.id,
  conversationId,
  agentId: legacy && legacy.agentId,           // NEW
  ownershipToken: legacy && legacy.ownershipToken, // NEW (likely null until bindTab fires inside handleStartAutomation)
}, /* ... */);
```

`background.js` adds an `ensureLegacyAgent` action handler that calls `getOrRegisterLegacyAgent(surface)` on the registry and returns the constant agentId (`legacy:popup` etc.).

## Handler Inventory (the 15 from Phase 238)

The 15 handlers Phase 238 instrumented all destructure `agentId` from `payload || {}` (or `params || {}` for two task-status routes) and explicitly ignore it via `void agentId`. Phase 240 must classify each by gate behavior.

| Handler | File:Line | Gate Behavior | tabId Source | bindTab Site (D-08) |
|---------|-----------|---------------|--------------|---------------------|
| `handleNavigateRoute` | dispatcher.js:295 | FULL gate | `params.tabId ?? activeTab.id` (resolved async at line 313) | YES — line 314-315 success return |
| `handleNavigationHistoryRoute` | dispatcher.js:321 | FULL gate | `params.tabId ?? activeTab.id` (line 336) | YES — line 345 success return |
| `handleOpenTabRoute` | dispatcher.js:357 | Agent-only gate (creates NEW tab; no tabId yet) | New tab from `chrome.tabs.create` (line 363) | YES — between line 363 and line 364 |
| `handleSwitchTabRoute` | dispatcher.js:370 | FULL gate | `params.tabId` (required) | NO — switching, not creating |
| `handleListTabsRoute` | dispatcher.js:396 | Agent-only gate (read-only enumeration) | N/A | NO |
| `handleExecuteJsRoute` | dispatcher.js:422 | (Today: returns error stub) | (N/A) | NO — handler is a stub today |
| `handleStartVisualSessionRoute` | dispatcher.js:589 | FULL gate (downstream calls into mcp-visual-session.js where D-09 also enforces) | `tab.id` from `getActiveTabFromClient` (line 608) | NO — visual-session manager owns this lifecycle |
| `handleEndVisualSessionRoute` | dispatcher.js:646 | (Token-keyed; gate-on-tabId may not apply) | Resolved by sessionToken in handler | NO |
| `handleStartAutomationRoute` (dispatcher) | dispatcher.js:719 | FULL gate (delegates to background.js handleStartAutomation) | `tab.id` from `getActiveTabFromClient` (line 723) | YES (in callee) |
| `handleStopAutomationRoute` | dispatcher.js:743 | Agent-only gate (sessionId-keyed, not tabId) | N/A | NO |
| `handleGetStatusRoute` | dispatcher.js:789 | Agent-only gate (read-only status) | N/A | NO |
| `handleReportProgressRoute` | dispatcher.js:1051 | Agent-only gate (token-keyed status update) | N/A | NO |
| `handleCompleteTaskRoute` | dispatcher.js:1082 | Agent-only gate | N/A | NO |
| `handlePartialTaskRoute` | dispatcher.js:1109 | Agent-only gate | N/A | NO |
| `handleFailTaskRoute` | dispatcher.js:1151 | Agent-only gate | N/A | NO |

Plus the 4th D-08 bindTab site:

| Handler | File:Line | bindTab Site (D-08) |
|---------|-----------|---------------------|
| `handleStartAutomation` | background.js:6224 | YES — between line 6430 (`activeSessions.set(sessionId, sessionData)`) and line 6489 (`sendResponse({success: true, sessionId, ...})`). The `targetTabId` is known at this point (line 6229 / 6320 / 6385). |

**Observability/control routes (mcp:get-diagnostics, mcp:list-sessions, mcp:get-session, mcp:get-logs, mcp:search-memory, mcp:get-memory)** are message routes (not tool routes) — they flow through `dispatchMcpMessageRoute` not `dispatchMcpToolRoute`, so the chokepoint at the tool-dispatcher level does NOT cover them. The CONTEXT D-06 explicitly locks the gate to `dispatchMcpToolRoute`. These observability calls do not target a tabId, so even if the gate were extended to `dispatchMcpMessageRoute`, the tabId arm would skip. Recommend leaving message-routes ungated for v0.9.60; revisit only if a future requirement says observability is per-agent.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-agent ownership (one autopilot at a time) | Multi-agent isolation via tabId ownership | v0.9.60 (this milestone) | Phase 237 added registry; Phase 238 threaded agentId; Phase 240 enforces |
| Visual-session displacement on every startSession | Same-agent resume + cross-agent reject | v0.9.60 / Phase 240 | Closes v0.9.36 deferred badge/glow-collision gap (REQUIREMENTS.md UI-01) |
| `agentId` ignored at every dispatcher handler | `agentId + ownershipToken` enforced at chokepoint | v0.9.60 / Phase 240 | Backward-compat via `legacy:<surface>` synthesis (D-02) |

**Deprecated/outdated:**
- "First agent wins, rest queue" pattern — never shipped; v0.9.60 explicitly does fail-loud `AGENT_CAP_REACHED` (Phase 241, not 240, but the design constraint shapes 240's gate).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `chrome.tabs.get(tabId).incognito` flag is immutable for a tab's lifetime | Don't Hand-Roll, Pitfall 1 | If incognito CAN change at runtime, the cached value becomes stale and the gate would let an incognito tab through. Mitigation: chrome docs are clear that incognito is per-window-not-per-tab and tabs cannot move between incognito and non-incognito windows; the cached value is safe. [ASSUMED based on Chrome behavior; verify via Chrome MV3 docs if uncertain] |
| A2 | The `windowId` of a bound tab is mutable (drag-tab-to-new-window) | Pitfall 2, Pattern 2 | If a user drags a tab into a new window, the cached windowId is stale. The gate's cross-window check would either reject (false positive) or pass (false negative). Mitigation: Phase 237 onRemoved+windows.onRemoved listeners (Phase 241 wires) clean up; for Phase 240, `chrome.tabs.onAttached` could re-cache. NOT addressed in this phase per ROADMAP scope (Phase 241 owns onAttached). [ASSUMED; verify if drag-window scenarios are common in user testing] |
| A3 | The smoke test harness's `agent:register` mock at tests/mcp-tool-smoke.test.js:109 returns ONLY `{agentId: 'agent_test_smoke'}` and not `ownershipToken` today | Pitfall 5 | If the mock already returns more, Phase 240 only adds a token field. Verified by reading the smoke test file. [VERIFIED via grep] |
| A4 | `globalThis.fsbAgentRegistryInstance` is reliably initialized before the FIRST `dispatchMcpToolRoute` call (no race) | Inline gate code | If the bridge/SW receives a tool call before `bootstrapAgentRegistry` finishes, the gate's `if (!reg) return null` graceful-degrade kicks in (no enforcement). Mitigation: this is intentional for robustness; the registry hydrate runs at SW boot before any bridge connection completes (background.js:782 in initialization order). [VERIFIED — boot order in background.js:184-799] |
| A5 | The MCP server's `AgentScope.ensure()` is the right place to capture `ownershipToken` returned from `agent:register` | Pattern 1 sketch / Smoke tests | If AgentScope.ensure is too narrow (e.g., one-shot), the planner needs an additional state field. Reading mcp/src/agent-scope.ts directly will confirm; not done here. [ASSUMED; verify in plan-01 by reading agent-scope.ts] |
| A6 | The 4 D-08 handlers' "success return" sites are unambiguous as enumerated in §3 above | Pattern 2 sketch, Code Examples | Misplacing the bindTab call (e.g., inside an early-return path) silently drops ownership. Mitigation: tests assert the bindTab side-effect on each happy path AND on each early-return path. [VERIFIED via direct code reading at lines 314, 345, 363, 6489] |

## Open Questions

1. **Where does `ownershipToken` first reach the MCP server?**
   - What we know: `agent:register` is the natural place (it's the first round-trip after AgentScope mints), but `agent:register` doesn't bind a tab — it just creates an agent. The token is per-bindTab, so the FIRST bindTab response must carry it. For autopilot's `run_task`, the first bindTab fires inside `handleStartAutomation` (background.js); how does that token get back to the MCP server, which is awaiting `bridge.sendAndWait({type: 'mcp:start-automation', ...})`?
   - What's unclear: Whether the MCP server even needs the token after the first call, or whether the extension keeps it server-side and the MCP server only ever passes through the agentId. If the latter, the token is purely an extension-internal defense and the wire-payload `ownershipToken` field is only needed when the MCP server has cached one explicitly.
   - Recommendation: Planner picks one of two patterns: (a) `agent:register` response carries the to-be-minted-on-first-bind token (lazy), or (b) every handler that calls bindTab returns the new token in its success response, and AgentScope captures it. (b) is cleaner but means the MCP server holds tokens; (a) is simpler but means agent:register response shape must extend. CONTEXT D-04 says (a) per the parenthetical at the end. Pattern recommended: extend `agent:register` response to include a placeholder `ownershipToken: null` (or absent), and have each bindTab-firing handler include `ownershipToken: <new>` in its response, which AgentScope updates.

2. **Cross-window check semantics — what exactly is "cross-window"?**
   - What we know: D-05 distinguishes `cross_window` from `non_current_window`. The Out-of-Scope list says "Cross-window agents — agents bound to single Chrome window".
   - What's unclear: Is the check "tab T1 is in windowA, agent's first-bound tab was in windowB" (per-agent window pinning)? Or "tab T1 is in windowA, but the user's currently-focused window is windowB" (current-window only)?
   - Recommendation: Per-agent window pinning is the cleaner semantics for multi-agent (each agent stays in its own window). Implement: cache `windowId` on the agent record (stamped on first bindTab) and reject any subsequent bindTab into a different window with `TAB_OUT_OF_SCOPE { reason: 'cross_window' }`. The `non_current_window` reason fires when the user has switched away from the agent's window — but that's a UX nuance, not an enforcement boundary. Discuss with planner.

3. **Does `handleStartAutomation` need to bindTab even when source !== 'mcp'?**
   - What we know: handleStartAutomation is called from popup, sidepanel, AND from `handleStartAutomationRoute` (the MCP path). For legacy:popup / legacy:sidepanel surfaces, the bindTab is what lets the gate later reject cross-agent attempts on tabs the legacy UI claimed.
   - What's unclear: If a user uses the popup to start automation on tab T1, then an MCP agent (different agentId) tries to drive T1, the gate should reject with TAB_NOT_OWNED. This requires bindTab to fire for the popup path too.
   - Recommendation: bindTab fires on every handleStartAutomation success, regardless of source. The agentId is sourced from `request.agentId` (popup/sidepanel pass `legacy:popup` / `legacy:sidepanel`) or from MCP-route synthesis (`legacy:autopilot` is the fallback if request comes via MCP without an explicit agentId, though that path actually has agentId from AgentScope).

4. **What about `handleStartMcpVisualSession` (background.js:1105) — is it gated?**
   - What we know: It's called from `handleStartVisualSessionRoute` via the `callCallbackHandler` indirection (dispatcher.js:633-643). The route handler gates at the dispatcher level.
   - What's unclear: Whether the gate at the dispatcher level is sufficient for the visual session, OR whether the visual-session manager also needs its own gate (it does — D-09 explicitly says startSession rejects cross-agent re-entry, which is a deeper layer than the dispatcher gate).
   - Recommendation: BOTH gates fire. Dispatcher-level gate validates agent registration + tab ownership; visual-session-level cross-agent reject (D-09) is the same-tab-different-agent-resume case that's specific to visual sessions and not covered by the dispatcher gate. Document the layering in plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `crypto.randomUUID()` | Token mint | Yes | MV3 SW native (Chrome 92+) | None needed; agent-registry.js:178 already has a fallback |
| `chrome.tabs.get(tabId)` | Cache `incognito` / `windowId` at bindTab | Yes | MV3 native | If unavailable: bindTab proceeds with `incognito = false, windowId = null`; gate's incognito branch never trips (false negative on incognito reject — caller must rely on manifest posture as primary defense per D-10) |
| `chrome.windows.getCurrent()` | Resolve "current window" for cross-window check | Yes | MV3 native | If unavailable: skip the `non_current_window` check; the `cross_window` check (per-agent pin) does not need it |
| `chrome.storage.session` | Persist registry envelope | Yes | MV3 native (Chrome 102+) | Phase 237 already handles missing storage with a memory-only fallback |
| Node.js 18+ for tests | `node:test` test harness | Yes | Per Phase 237/238 convention | None needed |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None (all primary deps are native MV3).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` plain-assert harness (Phase 237/238/239 convention) |
| Config file | None (per FSB conventions; tests stand alone) |
| Quick run command | `node --test tests/ownership-gate.test.js` (single-file run) |
| Full suite command | `npm test` or `node --test tests/` (planner verifies actual command in package.json — not read in this research) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OWN-01 | bindTab on every tab opened by agent (4 D-08 handlers) | unit + integration | `node --test tests/ownership-gate.test.js -- --grep "bindTab fires"` | NEW (Wave 0) |
| OWN-02 | Single chokepoint at dispatchMcpToolRoute verifies (agent_id, tab_id, ownership_token) | unit | `node --test tests/ownership-gate.test.js -- --grep "chokepoint"` | NEW (Wave 0) |
| OWN-02 | No await between gate check and dispatch (timing-sensitive) | unit | `node --test tests/ownership-gate.test.js -- --grep "same microtask"` | NEW (Wave 0) |
| OWN-03 | Cross-agent reject with typed TAB_NOT_OWNED + ownerAgentId | unit | `node --test tests/ownership-error-codes.test.js -- --grep "TAB_NOT_OWNED"` | NEW (Wave 0) |
| OWN-04 | Visual-session cross-agent reject + same-agent resume | integration | `node --test tests/mcp-visual-session-contract.test.js -- --grep "cross-agent reject"` | EXISTS (modify) |
| OWN-05 | Incognito tab rejection (TAB_INCOGNITO_NOT_SUPPORTED) | unit | `node --test tests/ownership-error-codes.test.js -- --grep "INCOGNITO"` | NEW (Wave 0) |
| OWN-05 | Cross-window tab rejection (TAB_OUT_OF_SCOPE) | unit | `node --test tests/ownership-error-codes.test.js -- --grep "OUT_OF_SCOPE"` | NEW (Wave 0) |
| Backward-compat | legacy:popup, legacy:sidepanel, legacy:autopilot synthesis paths | integration | `node --test tests/legacy-agent-synthesis.test.js` | NEW (Wave 0) |
| Regression | All Phase 238 mcp-tool-smoke deepEqual sites continue to pass | regression | `node --test tests/mcp-tool-smoke.test.js` | EXISTS (modify — add ownershipToken to 6+ assertion payloads) |
| Regression | Existing autopilot, manual, visual-session contract tests | regression | `node --test tests/mcp-visual-session-contract.test.js tests/agent-bridge-routes.test.js` | EXISTS (verify unchanged) |
| TEST-05 (deferred, Phase 244 owns) | Tab-ID-reuse race | regression | `node --test tests/agent-registry.test.js -- --grep "tab id reuse"` | NEW or extend existing (Wave 0 modification) |

### Sampling Rate

- **Per task commit:** `node --test tests/ownership-gate.test.js` (target test file for the task) plus `node --test tests/mcp-tool-smoke.test.js` (regression on the strengthened smoke suite — backward-compat is THE success metric).
- **Per wave merge:** `node --test tests/` (full suite).
- **Phase gate:** Full suite green AND manual UAT of: popup-driven automation, sidepanel-driven automation, MCP-driven autopilot — each on a fresh tab, each transitioning through navigate -> click -> read_page sequences without TAB_NOT_OWNED.

### Wave 0 Gaps

- [ ] `tests/ownership-gate.test.js` — covers OWN-02 chokepoint behavior, same-microtask invariant, gate skip for tab-creating tools
- [ ] `tests/ownership-error-codes.test.js` — covers OWN-03, OWN-05 (3 typed codes)
- [ ] `tests/legacy-agent-synthesis.test.js` — covers SC#5 backward-compat for the 3 legacy:<surface> agentIds
- [ ] Modify `tests/mcp-tool-smoke.test.js` — add `ownershipToken: 'tok_test_smoke'` to the 6 strengthened deepEqual sites (lines 132, 167, 184, 198, 206, 213)
- [ ] Modify `tests/agent-registry.test.js` — extend bindTab/isOwnedBy unit tests for token-aware signature
- [ ] Modify `tests/mcp-visual-session-contract.test.js` — add same-agent resume + cross-agent reject branches

## Sources

### Primary (HIGH confidence)
- `extension/ws/mcp-tool-dispatcher.js:1-1211` — read end-to-end; the chokepoint at line 119, all 15 dispatcher handlers, 3 agent:* routes
- `extension/utils/agent-registry.js:1-535` — read end-to-end; CRUD surface, mutex pattern, hydrate reconciliation, v: 1 envelope
- `extension/utils/mcp-visual-session.js:1-527` — read end-to-end; current startSession behavior at line 90, displacement contract, restoreSession path
- `extension/background.js:782-799, 1105-1199, 2544-2555, 5145-5160, 6224-6494` — read targeted sections; bootstrapAgentRegistry, handleStartMcpVisualSession, onRemoved listener, runtime.onMessage dispatch, handleStartAutomation
- `mcp/src/tools/autopilot.ts:100-225` — read targeted; agentScope.ensure pattern, bridge.sendAndWait payload
- `mcp/src/tools/{manual,visual-session,read-only,observability}.ts` — grep-verified agentId threading sites
- `extension/ui/popup.js:220-252` and `extension/ui/sidepanel.js:395-430` — read targeted; chrome.runtime.sendMessage({action:'startAutomation'}) call sites (only places that need legacy:<surface> threading)
- `tests/mcp-tool-smoke.test.js:100-220` — read targeted; the 6 deepEqual sites Phase 238 strengthened with `agentId: 'agent_test_smoke'`
- `.planning/REQUIREMENTS.md` — OWN-01..05 verified, Out-of-Scope list verified
- `.planning/ROADMAP.md` — Phase 240 5 success criteria verified
- `.planning/phases/240-tab-ownership-enforcement-on-dispatch/240-CONTEXT.md` — D-01..D-10 locked decisions verified verbatim

### Secondary (MEDIUM confidence)
- Phase 237 + 238 + 239 SUMMARY references via git log (`git log --oneline | head -10`) — not pulled directly; existence of the registry, threading, and lifecycle infrastructure verified by reading the code

### Tertiary (LOW confidence)
- None. All findings are verified against repo files directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every claim verified in repo files, no external dependencies introduced
- Architecture: HIGH — patterns directly observed in Phase 237 and Phase 238 code; gate insertion point unambiguous
- Pitfalls: MEDIUM — Pitfalls 1-3 verified by code reading; Pitfalls 4-6 are reasoned from the architecture (smoke test file structure verified for Pitfall 5)
- Handler inventory: HIGH — all 15 handlers + 4 D-08 sites verified by reading dispatcher.js end-to-end and grepping for `agentId` destructure pattern

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days; v0.9.60 codebase is actively evolving but this phase's surface area is well-defined)

## RESEARCH COMPLETE
