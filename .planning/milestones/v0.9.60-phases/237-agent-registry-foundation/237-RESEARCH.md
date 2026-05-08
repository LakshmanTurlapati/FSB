# Phase 237: Agent Registry Foundation -- Research

**Researched:** 2026-05-05
**Domain:** Chrome MV3 service-worker keystone module + `chrome.storage.session` write-through mirror + promise-chain mutex
**Confidence:** HIGH (every claim anchored to existing FSB code or in-tree docs; zero external library research needed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Module Location -- `extension/utils/agent-registry.js`**
The new keystone module lives at `extension/utils/agent-registry.js`, co-located with `extension/utils/mcp-visual-session.js`. This maximizes pattern parity with the v0.9.36 visual-session manager (storage-keyed, SW-resilient, hydrate-on-wake) and avoids semantic confusion with the deprecated `extension/agents/` directory (which still holds the v0.9.45rc1 sunset background-agent code -- `agent-executor.js`, `agent-manager.js`, `agent-scheduler.js`, `server-sync.js` -- per the "comment-out, not delete" policy).

Loading: imported via `importScripts('utils/agent-registry.js', ...)` in `background.js` BEFORE `ws/mcp-tool-dispatcher.js` so the registry exists by the time any dispatch-related code initializes.

**D-02: `agent_id` Format -- Hybrid (Full UUID Internal, 6-char Short Prefix Surfaced)**
Each agent gets a full UUID internally (`agent_<full-uuid>`), e.g. `agent_550e8400-e29b-41d4-a716-446655440000`. This is the canonical key in every Map and the storage payload. For surfaced contexts (logs, the v0.9.36 trusted-client badge in Phase 243, sidepanel/popup "owned by Agent X" badge, MCP error payloads), the registry exposes a helper that returns a short 6-char prefix (`agent_550e84`). The registry exposes `formatAgentIdForDisplay(agentId)` returning `agent_<first-6-hex-after-prefix>`. All UI/log call sites use this helper rather than slicing IDs locally.

**D-03: Reconciliation Policy -- Drop + Emit Diagnostic**
On SW wake, `hydrate()` iterates persisted records and calls `chrome.tabs.get(tabId)` for each. If the tab no longer resolves (`chrome.runtime.lastError` set, or `tab` undefined), the record is dropped from in-memory Maps AND from the `chrome.storage.session` payload. Each drop emits a structured event: `{ type: 'agent:reaped', agentId, tabId, reason: 'tab_not_found' | 'tab_in_other_window' | 'reconcile_error', timestamp, agentIdShort }`. Distribution: emit through the existing diagnostic ring buffer pattern (Phase 211 LOG-04, `chrome.storage.local.fsb_diagnostics_ring`) with a `[FSB AGT]` prefix and rate-limit (1 warn per category per 10s).

**D-04: AGENT-04 Scope Split**
Phase 237's contribution to AGENT-04 is the registry's connection-agnostic posture: any number of independent `agent_id`s may be registered concurrently with no client-grouping or coupling. The registry does NOT track `connection_id` or any MCP-process notion in this phase. Phase 241 introduces `connection_id` and reconnect-grace lifecycle. **Do NOT add a `connection_id` field to `AgentRecord` in 237.**

### Claude's Discretion

- **Storage key name:** Default to `fsbAgentRegistry` (matches `MCP_VISUAL_SESSION_STORAGE_KEY` casing convention). Versioned payload shape `{ v: 1, records: { ... } }` recommended for forward-migration safety.
- **Mutex implementation:** Promise-chain mutex (`let chain = Promise.resolve(); withRegistryLock = (fn) => (chain = chain.then(fn, fn)).finally(...)`). Single SW thread + no async-mutex lib per research guidance.
- **Test pattern:** `tests/` at repo root, plain Node.js, hand-rolled `chrome.*` mocks. New file: `tests/agent-registry.test.js` covering CRUD, storage round-trip, simulated SW wake reconciliation, and 20-concurrent-claim TOCTOU stress.
- **Public API shape:** Recommended exports `{ registerAgent, releaseAgent, bindTab, releaseTab, isOwnedBy, getOwner, getAgentTabs, listAgents, formatAgentIdForDisplay, withRegistryLock, hydrate, _internal }`. Planner may rename for grep-friendliness.
- **Generation counter on tab tombstones:** Phase 237 may include a stub `generation` field on records but the actual tombstone semantics + ownership-token consumption land in Phase 240 when dispatch enforcement begins.

### Deferred Ideas (OUT OF SCOPE for 237)

- `connection_id` field on AgentRecord (Phase 241)
- Ownership-token UUID consumption + tombstone semantics (Phase 240)
- Telemetry rollup of reaping rate (post-v0.9.60)
- Per-agent rate-limiting / queueing (later milestone)
- Stuck-slot reaping / idle timeout (explicit non-feature for v0.9.60)
- Schema migration tooling (no v0 to migrate from)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-01 | Each new MCP session/task gets a unique `agent_id` minted by FSB via `crypto.randomUUID()`; callers cannot invent IDs | `crypto.randomUUID()` is verified-available in MV3 SWs (Chrome 92+) and is already used in `extension/utils/mcp-visual-session.js:48-53` (`createMcpVisualSessionToken`), `extension/content/actions.js`, `extension/config/secure-config.js`. `registerAgent()` ignores any caller-supplied `agent_id` parameter and unconditionally mints a new one. |
| AGENT-02 | Agent registry mirrored to `chrome.storage.session` (write-through); survives MV3 service-worker eviction within a browser session | Mirrors the v0.9.36 visual-session pattern at `background.js:563-591` (`readPersistedMcpVisualSessions` / `writePersistedMcpVisualSessions`) and the per-session pattern at `background.js:2158-2210`. Storage key `fsbAgentRegistry`, sibling to `MCP_VISUAL_SESSION_STORAGE_KEY = 'fsbMcpVisualSessions'` (`background.js:2053`). |
| AGENT-03 | On service-worker wake, registry hydrates and reconciles against `chrome.tabs.query({})`, dropping ghost records before servicing requests | `hydrate()` runs once at SW startup before any message servicing. For each persisted record, calls `chrome.tabs.get(tabId)` — on rejection (no such tab) drop the record AND emit `agent:reaped` event through the LOG-04 ring buffer. Reconciliation pass is gated by `withRegistryLock` so concurrent message handlers cannot race against it. |
| AGENT-04 | One MCP client may run multiple parallel agents simultaneously, each with its own `agent_id` | Per D-04 above: 237 satisfies the **data-structural** requirement (registry is connection-agnostic; N independent `agent_id`s allowed concurrently with no client-grouping). Phase 241 satisfies the lifecycle requirement (`connection_id` linkage, reconnect grace). |
</phase_requirements>

## Summary

Phase 237 is a **pattern-parity port**, not a research project. Every architectural question this phase faces -- "how do we persist state across SW eviction?", "how do we hydrate cleanly on wake?", "how do we serialize cap-affecting operations?", "how do we mint stable IDs without a new dependency?", "how do we surface diagnostic events?" -- has a **canonical FSB precedent** that is already in production. The work is to mirror `extension/utils/mcp-visual-session.js` shape, reuse the Phase 211 LOG-04 ring buffer for diagnostics, drop a 4-line promise-chain mutex into module scope, and ship a unit test that round-trips through a hand-rolled `chrome.storage.session` mock.

The four LOCKED decisions in CONTEXT.md fully constrain the implementation surface. There are no novel patterns to evaluate, no new dependencies to vet, and no unknown library APIs to research. The single judgement call is the storage payload schema (`{ v: 1, records: { agentId: { ... } } }` with a versioned envelope), and the single TOCTOU risk surface (20-concurrent-claim stress) is mitigated entirely inside `withRegistryLock`.

**Primary recommendation:** Build `extension/utils/agent-registry.js` as a 1:1 structural sibling of `extension/utils/mcp-visual-session.js`, route every mutation through `withRegistryLock`, persist via the same `chrome.storage.session` pattern background.js:563-591 already uses, run `hydrate()` from `background.js` at the same site that calls `restorePersistedMcpVisualSessions()`, and ship `tests/agent-registry.test.js` modeled on `tests/diagnostics-ring-buffer.test.js` + `tests/mcp-bridge-client-lifecycle.test.js` (the latter for its `chrome.storage` mock harness).

## Project Constraints (from CLAUDE.md)

- **Vanilla ES2021+ JavaScript only.** No TypeScript, no transpiler, no build step in `extension/`. The MCP server (`mcp/`) is the ONLY tsc target in the repo. [VERIFIED: `mcp/package.json`, `extension/manifest.json`, no `extension/tsconfig.json`]
- **No emojis in logs, READMEs, or any markdown the agent writes.** This is a global user instruction reinforced project-locally. The `[FSB AGT]` log prefix family follows the existing `[FSB DLG]` / `[FSB BG]` / `[FSB WS]` / `[FSB DOM]` pattern (`extension/utils/redactForLog.js:9-14`). [VERIFIED: `~/.claude/CLAUDE.md` global, `CLAUDE.md` project]
- **Chrome Extension Manifest V3.** Service worker is `background.js`. [VERIFIED: `extension/manifest.json:23-25`]
- **No new manifest permissions.** v0.9.60 is intentionally a zero-permissions-delta milestone. `tabs`, `windows`, `storage`, `alarms`, `webNavigation` are already granted. [VERIFIED: `extension/manifest.json:6-19`, cross-confirmed by `STACK.md`]
- **`extension/agents/` is reserved for sunset code** under the `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines` annotation (`background.js:164-169`). The new live module goes in `extension/utils/`, not `extension/agents/`. [VERIFIED: directory listing shows 4 deprecated files; D-01 codifies this]
- **Branch-locked to `Refinements`.** No git push, no PRs in any phase. [CITED: `.planning/STATE.md` decisions, `.planning/ROADMAP.md` constraints]
- **Test runner is Node.js, not jest.** Tests are plain `node tests/<name>.test.js` invocations chained in `package.json:scripts.test`. `chrome.*` is hand-mocked per test. [VERIFIED: `package.json:scripts.test`, `tests/mcp-bridge-client-lifecycle.test.js:118-146`]

## Standard Stack

This phase introduces ZERO new dependencies. Every primitive is in-tree or in the platform.

### Core (already available, no install)

| API | Use | Confidence |
|-----|-----|------------|
| `crypto.randomUUID()` | Mint `agent_<full-uuid>` IDs | [VERIFIED: in active use at `extension/utils/mcp-visual-session.js:48-53`, `extension/config/secure-config.js`, `extension/content/actions.js`. Available in MV3 SWs since Chrome 92.] |
| `chrome.storage.session` | Write-through mirror of registry state; cleared on browser restart | [VERIFIED: in active use for `MCP_VISUAL_SESSION_STORAGE_KEY` (`background.js:2053`), `fsbConversationSessions` (`background.js:1945-1972`), and per-session persistence (`background.js:2158-2210`). Stable since Chrome 102.] |
| `chrome.tabs.query({})` + `chrome.tabs.get(tabId)` | SW-wake reconciliation -- list live tabs and probe each persisted record | [VERIFIED: `chrome.tabs.get` is the canonical "does this tab still exist?" probe; `chrome.runtime.lastError` set on missing tab. Already used at `background.js:6755` and elsewhere.] |
| `chrome.tabs.onRemoved` | Tab-close hook -> `releaseTab(tabId)` | [VERIFIED: already wired at `background.js:2455` (session/port cleanup) and `background.js:12616` (keyboard-emulator detach). 237 adds a third call site.] |
| `globalThis.fsbDiagnostics` (Phase 211 LOG-04) | Append `agent:reaped` events to the FIFO-100 ring buffer at `chrome.storage.local.fsb_diagnostics_ring` | [VERIFIED: `extension/utils/diagnostics-ring-buffer.js:103-110` exposes `fsbDiagnostics.append({ ts, level, prefix, category, message, redactedContext })`. Defensive whitelist enforced at line 30-38.] |
| `globalThis.rateLimitedWarn` + `globalThis.redactForLog` | One-warn-per-(prefix,category) per 10s with redacted payload | [VERIFIED: `extension/utils/redactForLog.js:69-103`. Auto-appends to `fsbDiagnostics` ring buffer. Used heavily in `extension/ws/ws-client.js`, `extension/content/dom-stream.js`, `extension/background.js`.] |

### Don't add

| Tempting alternative | Reject because |
|----------------------|----------------|
| `async-mutex`, `p-queue`, `p-limit` | The MV3 SW is single-threaded. A 4-line promise-chain serializes cap-affecting ops perfectly. New dep = new Web-Store-review surface for zero benefit. [CITED: `.planning/research/STACK.md` "What NOT to Add" + PITFALLS.md P6.] |
| `uuid` / `nanoid` / `ulid` npm packages | `crypto.randomUUID()` is in-platform, ~3-12x faster, zero deps. Sortability is irrelevant at N=8. [CITED: `STACK.md`.] |
| `chrome.storage.local` for the registry | Wrong semantics. `local` survives browser restart -- but the MCP client is gone after restart, so persisting agent ownership across that boundary creates ghost records bound to dead tab IDs. [CITED: `PITFALLS.md` P1, `STACK.md`.] |
| Separate diagnostic logging stack for `agent:reaped` | The Phase 211 LOG-04 ring buffer with `redactForLog` and rate-limited warn is already the canonical FSB diagnostic path. Inventing a parallel one violates the "do not duplicate infrastructure" rule from CONTEXT.md. |
| `connection_id` on `AgentRecord` | Out of scope per D-04. Belongs in Phase 241. |
| TypeScript / build step in `extension/` | The extension is intentionally vanilla ES2021+ (CLAUDE.md project-level convention). |

**Installation:** None. The module is a single new file plus an `importScripts` line in `background.js`.

**Version verification:** N/A -- no new packages.

## Architecture Patterns

### Recommended Module Layout

```
extension/utils/
  mcp-visual-session.js       <- THE pattern to mirror (already exists)
  agent-registry.js           <- NEW (Phase 237)
  diagnostics-ring-buffer.js  <- LOG-04 ring buffer (already exists; reuse)
  redactForLog.js             <- redactForLog + rateLimitedWarn (already exists; reuse)
```

### Pattern 1: Storage-Keyed Singleton (mirror of v0.9.36 visual-session)

**What:** A single named `chrome.storage.session` key holds the canonical persisted snapshot of all in-memory Maps. The Maps are the authoritative read source during normal operation; storage is the recovery snapshot for SW wake.

**When to use:** Any state that must survive SW eviction within a browser session but should NOT survive a browser restart.

**Reference shape (mirror this exactly):**

```js
// extension/utils/agent-registry.js
(function(global) {
  'use strict';

  // ---- Constants block (mirrors mcp-visual-session.js:4-26) ----
  var FSB_AGENT_REGISTRY_STORAGE_KEY = 'fsbAgentRegistry';
  var FSB_AGENT_REGISTRY_PAYLOAD_VERSION = 1;
  var FSB_AGENT_ID_PREFIX = 'agent_';
  var FSB_AGENT_DISPLAY_HEX_LENGTH = 6;          // for formatAgentIdForDisplay
  var FSB_AGENT_LOG_PREFIX = 'AGT';              // for [FSB AGT] log prefix family
  var FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE = 'agent-reaped'; // category for rateLimitedWarn

  // ---- In-memory Map declarations (mirrors mcp-visual-session.js:85-88) ----
  function AgentRegistry() {
    this._agents      = new Map();   // agentId -> AgentRecord
    this._tabOwners   = new Map();   // tabId -> agentId  (AUTHORITATIVE)
    this._tabsByAgent = new Map();   // agentId -> Set<tabId>
    this._hydrated    = false;
  }

  // ---- Public API ----
  AgentRegistry.prototype.registerAgent      = function(/* opts */) { /* ... */ };
  AgentRegistry.prototype.releaseAgent       = function(agentId, reason) { /* ... */ };
  AgentRegistry.prototype.bindTab            = function(agentId, tabId) { /* ... */ };
  AgentRegistry.prototype.releaseTab         = function(tabId) { /* ... */ };
  AgentRegistry.prototype.isOwnedBy          = function(tabId, agentId) { /* ... */ };
  AgentRegistry.prototype.getOwner           = function(tabId) { /* ... */ };
  AgentRegistry.prototype.getAgentTabs       = function(agentId) { /* ... */ };
  AgentRegistry.prototype.listAgents         = function() { /* ... */ };
  AgentRegistry.prototype.hydrate            = async function() { /* ... */ };
  AgentRegistry.prototype._persist           = async function() { /* ... */ };

  // ---- Display helper (D-02 canonical) ----
  function formatAgentIdForDisplay(agentId) {
    if (typeof agentId !== 'string' || agentId.indexOf(FSB_AGENT_ID_PREFIX) !== 0) return '';
    var hex = agentId.slice(FSB_AGENT_ID_PREFIX.length).replace(/-/g, '');
    return FSB_AGENT_ID_PREFIX + hex.slice(0, FSB_AGENT_DISPLAY_HEX_LENGTH);
  }

  // ---- Promise-chain mutex (D from Claude's discretion) ----
  var _registryChain = Promise.resolve();
  function withRegistryLock(fn) {
    var next = _registryChain.then(function() { return fn(); }, function() { return fn(); });
    _registryChain = next.catch(function() { /* swallow so chain continues */ });
    return next;
  }

  // ---- Export shape (mirrors mcp-visual-session.js:505-527) ----
  var exportsObj = {
    AgentRegistry: AgentRegistry,
    formatAgentIdForDisplay: formatAgentIdForDisplay,
    withRegistryLock: withRegistryLock,
    FSB_AGENT_REGISTRY_STORAGE_KEY: FSB_AGENT_REGISTRY_STORAGE_KEY,
    FSB_AGENT_REGISTRY_PAYLOAD_VERSION: FSB_AGENT_REGISTRY_PAYLOAD_VERSION,
    FSB_AGENT_LOG_PREFIX: FSB_AGENT_LOG_PREFIX
  };

  global.FsbAgentRegistry = exportsObj;
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

[VERIFIED: this layout is a structural copy of `extension/utils/mcp-visual-session.js:1-3,4-17,85-88,505-527`. Reviewer should be able to scan the two files side-by-side and see the same shape.]

### Pattern 2: Storage Read/Write Helpers (mirror of `background.js:563-591`)

**What:** Read returns `{}` on missing/corrupt; write removes the key when records are empty (avoids leaving stale envelopes); errors logged via `automationLogger.warn` not thrown. The registry calls these helpers from `_persist()` and `hydrate()`.

**Reference (verbatim from `background.js:563-591`, adapt for `fsbAgentRegistry`):**

```js
async function readPersistedAgentRegistry() {
  try {
    const stored = await chrome.storage.session.get([FSB_AGENT_REGISTRY_STORAGE_KEY]);
    const payload = stored?.[FSB_AGENT_REGISTRY_STORAGE_KEY];
    if (!payload || typeof payload !== 'object') return null;
    if (payload.v !== FSB_AGENT_REGISTRY_PAYLOAD_VERSION) {
      // Future migration hook; v=1 is current.
      return null;
    }
    return payload;
  } catch (error) {
    // Log via automationLogger or rateLimitedWarn; do not throw.
    return null;
  }
}

async function writePersistedAgentRegistry(records) {
  try {
    const nextRecords = records && typeof records === 'object' ? records : {};
    if (Object.keys(nextRecords).length === 0) {
      await chrome.storage.session.remove(FSB_AGENT_REGISTRY_STORAGE_KEY);
      return;
    }
    await chrome.storage.session.set({
      [FSB_AGENT_REGISTRY_STORAGE_KEY]: {
        v: FSB_AGENT_REGISTRY_PAYLOAD_VERSION,
        records: nextRecords
      }
    });
  } catch (error) {
    // Log via automationLogger or rateLimitedWarn; do not throw.
  }
}
```

[VERIFIED: `background.js:563-591`. Versioned envelope (`{ v: 1, records: { ... } }`) is a planner-recommended addition for forward-migration safety; the existing visual-session uses an unversioned `{ <token>: { ... } }` shape and has been bitten by ad-hoc migrations historically per CONTEXT.md "lessons from prior FSB shape-bumps" reference.] [ASSUMED: future migration tooling absent; if Phase 241 introduces `connection_id`, the version bump path is `v: 1 -> v: 2` with a one-time hydrate-time upgrader.]

### Pattern 3: Promise-Chain Mutex (FSB clean-slate; canonical 4-line pattern)

**What:** Serializes all cap-affecting and registry-mutating operations through a single chained Promise. JS single-threaded execution between `await` points means TWO concurrent claim handlers can each see `count === 7` and both insert -- the chain prevents this by ordering them deterministically.

```js
let _registryChain = Promise.resolve();
function withRegistryLock(fn) {
  // Run regardless of prior failure (.then(fn, fn)) so a thrown handler
  // does not poison the chain. Catch-and-swallow on _registryChain assignment
  // so the chain itself never holds a rejected promise.
  const next = _registryChain.then(fn, fn);
  _registryChain = next.catch(() => {});
  return next;
}
```

**MV3-specific caveats:**
- The chain lives in module scope. SW eviction destroys it. After wake, `_registryChain` is a fresh `Promise.resolve()` -- which is correct because no operations are in-flight on a freshly-spawned SW.
- The chain serializes microtasks but does NOT span macrotask boundaries (e.g., `setTimeout`). All registry ops should be synchronous-or-microtask-only inside the locked function. Avoid putting `setTimeout` or `chrome.alarms` calls inside `withRegistryLock`.
- Cap-check + insert against the in-memory Map MUST happen synchronously inside the locked function before any `await` (e.g., before `_persist()`). Persisting is a post-success side effect, not a precondition. [CITED: `PITFALLS.md` P6 verbatim.]

[VERIFIED: clean-slate -- no existing FSB module uses this pattern. The 4-line shape above is the canonical recipe cited in `PITFALLS.md` P6 and `STACK.md` "Why in-memory Map is sufficient." `extension/ws/ws-client.js` was referenced in CONTEXT.md as having "Promise-chain serialization" but a grep finds no such pattern -- treat the registry's mutex as a clean introduction.]

### Pattern 4: Hydrate-on-Wake with Tab Reconciliation (D-03)

```js
AgentRegistry.prototype.hydrate = async function() {
  if (this._hydrated) return;
  return withRegistryLock(async () => {
    const payload = await readPersistedAgentRegistry();
    const records = payload && payload.records ? payload.records : {};

    // Step 1: rebuild Maps from persisted records.
    for (const [agentId, record] of Object.entries(records)) {
      this._agents.set(agentId, record);
      const tabs = Array.isArray(record.tabIds) ? record.tabIds : [];
      this._tabsByAgent.set(agentId, new Set(tabs));
      for (const tabId of tabs) this._tabOwners.set(tabId, agentId);
    }

    // Step 2: reconcile against live tabs. Drop ghost records.
    const liveTabIds = new Set((await chrome.tabs.query({})).map(t => t.id));
    const reapedThisWake = [];

    for (const [tabId, agentId] of [...this._tabOwners]) {
      if (!liveTabIds.has(tabId)) {
        reapedThisWake.push({ agentId, tabId, reason: 'tab_not_found' });
        this._tabOwners.delete(tabId);
        const set = this._tabsByAgent.get(agentId);
        if (set) {
          set.delete(tabId);
          if (set.size === 0) {
            // No tabs left -> agent is fully reaped.
            this._tabsByAgent.delete(agentId);
            this._agents.delete(agentId);
          }
        }
      }
    }

    // Step 3: emit one diagnostic event per reaped record.
    for (const reap of reapedThisWake) {
      emitAgentReapedEvent(reap.agentId, reap.tabId, reap.reason);
    }

    // Step 4: write the reconciled snapshot back so storage is in sync with memory.
    if (reapedThisWake.length > 0) {
      await this._persist();
    }

    this._hydrated = true;
  });
};
```

[VERIFIED: this is the canonical recipe from `ARCHITECTURE.md` section 5 ("Storage Layer Choice") + `PITFALLS.md` P1 + the `restorePersistedMcpVisualSessions` invocation site at `background.js:563-591`. The reconciliation step is non-negotiable; without it, ghost records leak into the cap accounting silently (P1 warning sign #1).]

### Pattern 5: Diagnostic Event Emission via LOG-04 Ring Buffer (D-03)

`agent:reaped` events flow through the existing Phase 211 LOG-04 path. There are TWO acceptable shapes:

**Option A (recommended) -- via `rateLimitedWarn` (auto-appends to ring buffer + console.warn at most 1/10s):**

```js
function emitAgentReapedEvent(agentId, tabId, reason) {
  const event = {
    type: 'agent:reaped',
    agentId,
    tabId,
    reason,
    timestamp: Date.now(),
    agentIdShort: formatAgentIdForDisplay(agentId)
  };
  if (typeof rateLimitedWarn === 'function') {
    rateLimitedWarn(
      'AGT',                                  // prefix -> [FSB AGT]
      'agent-reaped-' + reason,               // category (per-reason rate limit)
      'agent reaped',                         // message
      typeof redactForLog === 'function'      // redactedContext
        ? { agentIdShort: event.agentIdShort, tabId, reason }
        : {}
    );
  }
}
```

**Option B -- direct `fsbDiagnostics.append` (no rate limit, no console.warn; debug-only):**

```js
if (globalThis.fsbDiagnostics && typeof globalThis.fsbDiagnostics.append === 'function') {
  globalThis.fsbDiagnostics.append({
    ts: Date.now(),
    level: 'warn',
    prefix: 'AGT',
    category: 'agent-reaped',
    message: 'agent reaped: ' + reason,
    redactedContext: { agentIdShort: formatAgentIdForDisplay(agentId), tabId, reason }
  });
}
```

[VERIFIED: `extension/utils/redactForLog.js:69-103` (rateLimitedWarn shape, auto-appends to ring buffer at lines 89-101); `extension/utils/diagnostics-ring-buffer.js:27-65` (append shape, FIFO-100, defensive whitelist). The `[FSB AGT]` prefix slots cleanly into the existing family `DLG`/`DOM`/`BG`/`WS`/`SYNC` documented at `redactForLog.js:9-14`.]

**Recommendation:** Option A. The 1/10s rate limit + console-warn console-visibility is what CONTEXT.md D-03 requires verbatim, and `rateLimitedWarn` already implements both behaviors atomically.

### Anti-Patterns to Avoid

- **Using `chrome.storage.local`.** Wrong semantics; survives browser restart. [PITFALLS.md P1.]
- **Letting hydrate execute concurrently with new claims.** Wrap `hydrate()` in `withRegistryLock`. [P6.]
- **Caching `agents.size` as a number for cap checks.** Always read from the live Map inside the critical section. [P6.]
- **Slicing the UUID for display in any call site outside the registry.** All UI/log code calls `formatAgentIdForDisplay(agentId)`. [D-02.]
- **Adding a `connection_id` field to `AgentRecord`.** Phase 241 territory. [D-04.]
- **Throwing from `hydrate()` or `_persist()`.** Existing pattern (`background.js:568-573`, `586-590`) logs via `automationLogger.warn` and continues; the registry must not poison SW startup with unhandled rejections.
- **Calling `chrome.storage.session.set` inside `withRegistryLock` without a guard against re-entry.** Use a microtask debouncer if multiple mutations land in the same critical section -- coalesce to one write per locked block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID minting | Hand-rolled random hex | `crypto.randomUUID()` | In-platform, faster, zero deps. [STACK.md, VERIFIED in `mcp-visual-session.js:48-53`.] |
| Mutex/semaphore | `async-mutex` npm dep | 4-line promise-chain | MV3 SW is single-threaded; no real lock needed. [STACK.md, PITFALLS.md P6.] |
| Storage envelope serialization | `JSON.stringify` raw Maps | Convert to plain object before `chrome.storage.session.set` -- the API requires JSON-serializable values | Maps and Sets do NOT round-trip through `chrome.storage.*` APIs. [VERIFIED: same conversion done at `mcp-visual-session.js:316-369` (`restoreMcpVisualSessionRecord`).] |
| Diagnostic logging | New `console.warn` discipline | Reuse `rateLimitedWarn('AGT', ...)` + `redactForLog(...)` | Auto-rate-limits, auto-appends to LOG-04 ring buffer, auto-redacts. [VERIFIED: `redactForLog.js:69-103`.] |
| Display formatting of agent IDs | Local string slicing in UI | `formatAgentIdForDisplay()` helper | Single source of truth (D-02). |
| ID format ambiguity | Numeric counter or sequential ID | UUID with `agent_` prefix | Sufficient entropy; matches v0.9.36 `mcpv_*` token format pattern. |
| Tab-existence check | `chrome.tabs.query({})` filtered manually | `chrome.tabs.get(tabId)` per record (or build a `liveTabIds` Set once and probe membership, as Pattern 4 does) | Both work; the Set approach is O(N+M) instead of O(N\*M) for N persisted records and M open tabs. |

**Key insight:** Every primitive Phase 237 needs is in-tree. The work is to mirror, not to invent.

## Runtime State Inventory

> Phase 237 is a NEW-MODULE phase (not a rename/refactor/migration). This section is included for completeness because the registry's `chrome.storage.session` payload is itself a new piece of runtime state -- planners must verify nothing collides with the chosen key.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The new `chrome.storage.session.fsbAgentRegistry` key. No prior FSB code uses this key (verified by grep -- only `fsbMcpVisualSessions`, `fsbConversationSessions`, `mcpBridgeState`, `fsb_diagnostics_ring`, and per-session `mcp:session:*` keys exist). | Document the key in code comments and reserve it. No data migration -- no v0 to migrate from. |
| Live service config | None -- the registry is internal to the extension and does not call any external service. | None. |
| OS-registered state | None -- registry lives entirely inside the SW. | None. |
| Secrets/env vars | None -- `agent_id` UUIDs are not secrets and are minted FSB-side per request. | None. |
| Build artifacts | None -- vanilla JS, no build output. | None. |

**Storage-key namespace audit (verified by grep across `extension/`):**

| Key | Owner | Layer |
|-----|-------|-------|
| `fsbMcpVisualSessions` | v0.9.36 visual sessions (`background.js:2053`) | `chrome.storage.session` |
| `fsbConversationSessions` | conversation routing (`background.js:1949,1964`) | `chrome.storage.session` |
| `mcpBridgeState` | MCP bridge connection (`background.js:2878`) | `chrome.storage.session` |
| `mcp:session:*` (dynamic) | per-session persistence (`background.js:2187`) | `chrome.storage.session` |
| `fsb_diagnostics_ring` | LOG-04 (`diagnostics-ring-buffer.js:13`) | `chrome.storage.local` |
| **`fsbAgentRegistry` (NEW)** | **Phase 237** | **`chrome.storage.session`** |

[VERIFIED: zero collision with existing keys.]

## Common Pitfalls

These are the registry-specific subset of `.planning/research/PITFALLS.md` (P1, P3 groundwork, P6 are the canonical references for this phase):

### Pitfall 1: Registry held only in memory dies with the MV3 service worker (P1)

**What goes wrong:** Naive `Map<agentId, ...>` in module scope is empty after SW eviction (~30s idle). Reconnecting agents either get rejected as unknown or silently re-allocated, leaking the original's tabs into ghost-locked state and corrupting cap accounting.
**Why it happens:** Single-agent FSB has been able to lean on "we'll reload state on next message" because there's exactly one canonical session at a time. Multi-agent introduces N records with referential integrity that must survive eviction.
**How to avoid:** `chrome.storage.session` is the source of truth; in-memory is a write-through cache. Every SW wake runs `hydrate()` BEFORE servicing any new request. `hydrate()` reconciles against `chrome.tabs.query({})` and drops unresolvable records.
**Warning signs:**
- "Cap reached" errors at 4-7 active agents instead of 8 (or whatever the configured cap is when 241 lands)
- After a long Chrome idle window followed by activity, the same agent gets two different `agent_id` values across messages
- `chrome.storage.session.get('fsbAgentRegistry')` returns records whose `tabId` is no longer in `chrome.tabs.query({})`

### Pitfall 2: Cap-check + insert TOCTOU between `await` points (P6)

**What goes wrong:** `if (count >= CAP) reject; await something(); registry.add(agent);` -- two concurrent `claimSlot` calls each see `count===CAP-1`, both pass the check, both add. Cap drifts upward.
**Why it happens:** JS is single-threaded only between `await` points; the granularity is per-microtask, not per-async-function.
**How to avoid:** Cap check + insert against the in-memory Map MUST happen synchronously inside `withRegistryLock(fn)` before any `await`. Persistence is a post-success side effect. (Phase 237 doesn't enforce a cap yet -- 241 does -- but the structural plumbing here must NOT introduce an `await` between size check and insert.)
**Warning signs:**
- Stress test with 20 concurrent `registerAgent()` calls produces more successes than the cap allows
- Logs show `count: 7` -> `count: 8` -> `count: 9` in successive lines

### Pitfall 3: Pool-shrink groundwork (P3 -- Phase 241 territory but data shape decided here)

**What goes wrong (later):** Closing one tab in an agent's pool releases the whole agent (over-release) or fails to update `pool.size` correctly (under-release).
**Why it matters in 237:** The `tabsByAgent` Map's value type is `Set<tabId>` precisely so that Phase 241's `releaseTab` can `delete()` and inspect `set.size === 0` cheaply. Picking `Array<tabId>` instead would force a linear search and create a re-write hazard for 241.
**How to avoid:** Use `Set<tabId>` for `tabsByAgent` values. Phase 241 will add the "release agent only when `pool.size === 0`" semantics; 237's job is to provide the data shape that makes 241 trivial.

### Pitfall 4: Diagnostic event flooding on a wide reaping wave

**What goes wrong:** SW wake after a long Chrome idle finds many ghost records (e.g., user closed 5 tabs while Chrome was suspended). `hydrate()` emits 5 `agent:reaped` events in tight succession; without rate-limiting, this floods the LOG-04 ring buffer (FIFO 100) and pushes useful entries out.
**Why it happens:** The ring buffer is FIFO-100 globally across all FSB diagnostic categories.
**How to avoid:** Use `rateLimitedWarn('AGT', 'agent-reaped-<reason>', ...)` (Pattern 5 Option A). The category is per-reason so different drop reasons surface independently, but each reason is rate-limited to 1/10s. Suppressed counts are surfaced in the warn message ("(suppressed 4 in last 10s)"), preserving observability without flooding.

### Pitfall 5: `importScripts` ordering means the registry is referenced before it's defined

**What goes wrong:** If `agent-registry.js` is imported AFTER `mcp-tool-dispatcher.js` (or after any module that captures a reference to `globalThis.FsbAgentRegistry` at import time), the dispatcher sees `undefined` and fails silently or throws on first use.
**Why it happens:** `importScripts` is synchronous and executes top-to-bottom. The current `background.js:10-11` order is:
```js
importScripts('utils/mcp-visual-session.js');  // line 10
try { importScripts('ws/mcp-tool-dispatcher.js'); } catch (e) { ... }  // line 11
```
**How to avoid:** Insert `importScripts('utils/agent-registry.js');` at line 10.5 (between visual-session and tool-dispatcher). The registry has no dependencies on other FSB modules; it depends only on platform APIs (`chrome.storage.session`, `chrome.tabs`, `crypto.randomUUID`) and on `globalThis.fsbDiagnostics` / `globalThis.rateLimitedWarn` which load LATER (`background.js:41-42`). The lazy-reference pattern in Pattern 5 (`if (typeof rateLimitedWarn === 'function')`) handles this correctly: `hydrate()` runs at SW wake, AFTER all `importScripts` complete, so by the time any reaped event tries to log, both helpers are loaded.

[VERIFIED: `extension/background.js:4-46` for importScripts ordering; `redactForLog.js:88-102` already uses the same lazy-reference defensive pattern (`globalThis.fsbDiagnostics` may not be loaded yet when `rateLimitedWarn` is called).]

### Pitfall 6: `chrome.tabs.onRemoved` double-wire makes `releaseTab` non-idempotent

**What goes wrong:** Two existing `onRemoved` listeners (`background.js:2455`, `:12616`) already fire per tab close. If 237 adds a third call site that ALSO does state mutation, and a future refactor consolidates them, `releaseTab(tabId)` could fire 2-3 times for the same close. A non-idempotent implementation would log spurious "tab not in registry" warnings.
**Why it happens:** MV3 service workers register listeners independently; Chrome calls all of them with no defined ordering relative to other in-flight messages. CONTEXT.md explicitly flags this: "behavior must remain idempotent so duplicate calls are no-ops."
**How to avoid:** `releaseTab(tabId)` -- inside `withRegistryLock` -- first checks `this._tabOwners.has(tabId)`; if false, returns silently (no warn, no diagnostic). Only emit a diagnostic if the tab WAS owned and is being released. Test by calling `releaseTab(99)` twice on a non-existent tab and asserting zero diagnostic events.

**Recommendation:** Add a third standalone listener (do not modify the existing two):
```js
// background.js -- new listener, near line 2455 or in a new block.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (globalThis.FsbAgentRegistry && globalThis.FsbAgentRegistry.releaseTab) {
    globalThis.FsbAgentRegistry.releaseTab(tabId);
  }
});
```

## Code Examples

### Example 1: Registering a new agent (with full UUID + display helper)

```js
AgentRegistry.prototype.registerAgent = function(opts) {
  // D-02: caller cannot supply ID; we always mint.
  // D-04: connection-agnostic -- ignore any clientLabel grouping in 237.
  return withRegistryLock(async () => {
    const agentId = 'agent_' + crypto.randomUUID();
    const record = {
      agentId,
      createdAt: Date.now(),
      tabIds: [],                    // serialized form of the Set in _tabsByAgent
      // generation: 0,              // STUB for Phase 240 ownership-token semantics
      // connection_id: ... ,        // INTENTIONALLY ABSENT; Phase 241 adds this
    };
    this._agents.set(agentId, record);
    this._tabsByAgent.set(agentId, new Set());
    await this._persist();
    return {
      agentId,
      agentIdShort: formatAgentIdForDisplay(agentId)
    };
  });
};
```

### Example 2: SW boot: hydrate at the same site as visual-session restore

```js
// In background.js -- next to existing restorePersistedMcpVisualSessions() invocation.
// (Search the file for that function name to find the canonical site.)
async function bootstrapAgentRegistry() {
  if (!globalThis.FsbAgentRegistry) return;
  const registry = globalThis.fsbAgentRegistryInstance ||
    (globalThis.fsbAgentRegistryInstance = new globalThis.FsbAgentRegistry.AgentRegistry());
  try {
    await registry.hydrate();
  } catch (err) {
    // Don't poison SW startup; log via existing channel.
    if (typeof rateLimitedWarn === 'function') {
      rateLimitedWarn('AGT', 'hydrate-failed', 'agent registry hydrate failed',
        typeof redactForLog === 'function' ? redactForLog(err) : {});
    }
  }
}
// Wire into the SW boot sequence at the same place as visual-session restore.
```

[VERIFIED: pattern derived from `background.js:563-591` storage helpers + the existing visual-session restore call site convention.]

### Example 3: 4-line promise-chain mutex (canonical recipe)

```js
let _registryChain = Promise.resolve();
function withRegistryLock(fn) {
  const next = _registryChain.then(fn, fn);     // run fn whether previous succeeded or failed
  _registryChain = next.catch(() => {});        // chain itself never holds a rejection
  return next;                                  // caller still sees fn's actual result
}
```

[CITED: `.planning/research/PITFALLS.md` P6 "How to avoid"; `.planning/research/STACK.md` "Mitigation: Do all cap-check + insert in one synchronous slice before any await."]

### Example 4: `formatAgentIdForDisplay` (D-02 canonical helper)

```js
// agent_550e8400-e29b-41d4-a716-446655440000  -> agent_550e84
// agent_<full-uuid-no-dashes>                 -> agent_<first-6-hex>
// '' or non-string                            -> ''
function formatAgentIdForDisplay(agentId) {
  if (typeof agentId !== 'string') return '';
  const PREFIX = 'agent_';
  if (agentId.indexOf(PREFIX) !== 0) return '';
  const hex = agentId.slice(PREFIX.length).replace(/-/g, '');
  return PREFIX + hex.slice(0, 6);
}
```

**Validation test:** `formatAgentIdForDisplay('agent_550e8400-e29b-41d4-a716-446655440000') === 'agent_550e84'`. [VERIFIED: matches D-02 spec verbatim.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled random hex IDs | `crypto.randomUUID()` | Available in MV3 SWs since Chrome 92 (~2021) | Zero new deps, faster, RFC-4122 compliant |
| `chrome.storage.local` for SW-resilient state | `chrome.storage.session` (Chrome 102+, ~2022) | v0.9.36 visual-session migration | Right semantics: cleared on browser restart, survives SW eviction |
| `async-mutex` for cap enforcement | 4-line promise-chain mutex | Canonical FSB pattern (this milestone) | Zero deps; matches MV3 single-threaded model |
| Per-module diagnostic console.warn discipline | `rateLimitedWarn` + `redactForLog` + LOG-04 ring buffer | Phase 211 (~2026) | Centralized, exportable, redacted, rate-limited |
| Implicit single-agent invariant | Connection-agnostic agent registry (Phase 237) | v0.9.60 milestone | Foundation for multi-agent enforcement in 240+ |

**Deprecated/outdated patterns to avoid in 237:**
- **`extension/agents/` directory:** reserved for sunset code (`agent-executor.js`, `agent-manager.js`, `agent-scheduler.js`, `server-sync.js`) per v0.9.45rc1 deprecation policy. New live code goes in `extension/utils/`. [VERIFIED: `background.js:164-169` shows the commented-out `importScripts` block.]
- **Direct `console.warn` for diagnostic events:** use `rateLimitedWarn` so events flow into the LOG-04 ring buffer.
- **Non-versioned storage payloads:** prior FSB shape-bumps required ad-hoc migrations. Use `{ v: 1, records: { ... } }` envelope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Versioned payload envelope `{ v: 1, records: { ... } }` is forward-compatible with Phase 241's `connection_id` addition via a `v: 1 -> v: 2` upgrader. | Pattern 2 | Phase 241 may need to break the envelope rather than upgrade it. Low risk -- versioning is a one-line cost in 237 and saves a refactor in 241. |
| A2 | The existing `extension/ws/ws-client.js` does NOT contain a reusable promise-chain mutex despite CONTEXT.md's claim of "existing serialization patterns we can reuse." | Pattern 3 caveats | If a reusable pattern exists elsewhere, 237's clean-slate mutex creates duplication. Verified via grep: no such pattern found. Low risk. |
| A3 | `chrome.storage.session` per-key write-set atomicity holds (one `set({key: value})` call writes the whole `value` atomically; readers either see the old value or the new value, never partial). | Pattern 2, Pitfall 1 | If a write is observably non-atomic, hydrate could read a partially-written payload after SW eviction during a write. Low risk -- `chrome.storage.*` documentation describes set/get as atomic per-key, and FSB has used this pattern since v0.9.36 without observed corruption. |
| A4 | The recommended `importScripts` insertion point (between `mcp-visual-session.js` and `mcp-tool-dispatcher.js`) does not break any existing module that captures a reference at top-level. | Pitfall 5 | If `mcp-tool-dispatcher.js` captures `globalThis.FsbAgentRegistry` at import time (rather than lazily at use time), and the registry doesn't expose its API immediately on import, the capture is `undefined`. Mitigation: registry's `globalThis.FsbAgentRegistry = exportsObj` assignment is synchronous at end of IIFE; tool-dispatcher captures lazily per existing FSB convention. Low risk. |
| A5 | The 1/10s rate limit on `rateLimitedWarn('AGT', 'agent-reaped-<reason>', ...)` is appropriate granularity for the reaping-event use case. | Pattern 5, Pitfall 4 | If reaping events need finer-grained or coarser-grained limiting, the implementation will need a custom rate-limiter. Low risk -- 1/10s matches Phase 211's existing diagnostic warn cadence and CONTEXT.md D-03 specifies it verbatim. |

**If this table is empty:** Most claims are verified-by-code or cited-in-research; the assumptions above are the planner's confirmation surface.

## Open Questions (RESOLVED)

All four questions below have a recommendation that the plans implement. None blocks execution.

1. **Should `hydrate()` be idempotent or one-shot?**
   - What we know: SW boots once per wake, `hydrate()` should run once. The `_hydrated = true` flag in Pattern 4 makes it one-shot.
   - What's unclear: Does any test scenario need to force re-hydration mid-session? (E.g., a contract test that simulates SW eviction without a full process restart.)
   - **RESOLVED:** One-shot with a private `_resetForTests()` helper exposed under `_internal` for test harnesses. Mirrors the `_resetRing()` / `_resetRateLimitTable()` pattern at `diagnostics-ring-buffer.js:99-101` and `redactForLog.js:124-127`. Implemented in Plan 01 task 1.

2. **Should `registerAgent` accept a `clientLabel` parameter for future Phase 241 reconciliation?**
   - What we know: D-04 says NO `connection_id` field on records in 237.
   - What's unclear: Is `clientLabel` (the v0.9.36 trusted-client allowlist value: `Claude`, `Codex`, etc.) different from `connection_id`? CONTEXT.md is silent.
   - **RESOLVED:** Defer. 237's job is connection-agnostic registration. If Phase 241 needs a `clientLabel` to disambiguate reconnects, add it as a `v: 1 -> v: 2` field upgrade. Keep 237's signature minimal: `registerAgent({})` returning `{ agentId, agentIdShort }`. Plans 01..03 honor this minimal signature.

3. **What's the right invocation site for `hydrate()` in `background.js`?**
   - What we know: It must run BEFORE any message servicing on SW wake.
   - What's unclear: Visual-session restore is at `background.js:563-591`. Is there a single canonical "boot orchestration" function the registry should hook into?
   - **RESOLVED:** Place `bootstrapAgentRegistry()` adjacent to `restorePersistedMcpVisualSessions` in the SW-wake handler section. Implemented in Plan 03 task 2.

4. **Does the 20-concurrent-claim TOCTOU stress test need to enforce a cap, or just confirm serialization?**
   - What we know: Phase 237 doesn't enforce a cap (Phase 241 does). But CONTEXT.md mentions "20-concurrent-claim TOCTOU stress" as a 237 deliverable per the success criteria reference.
   - What's unclear: Without a cap, what does the test assert? "All 20 succeeded with distinct `agent_id`s and final `_agents.size === 20` and persisted state matches in-memory state."
   - **RESOLVED:** Test asserts (a) no two `agent_id`s collide, (b) final in-memory `_agents.size === 20`, (c) `chrome.storage.session.get('fsbAgentRegistry')` returns 20 records, (d) registry passed through `withRegistryLock` without losing any insertion. The "cap invariant" wording in CONTEXT.md is forward-looking to Phase 241; in 237 the equivalent invariant is "no claim is silently dropped under concurrent pressure." Implemented in Plan 01 task 1, test 5.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `tests/agent-registry.test.js` | TBD by planner -- check before writing tests | -- | -- |
| `chrome.storage.session` | Registry persistence | Yes (in MV3 runtime) | Chrome 102+ | None needed; runtime is the deploy target |
| `chrome.tabs.query`, `chrome.tabs.get` | `hydrate()` reconciliation | Yes (already-granted `tabs` permission) | Stable | None needed |
| `crypto.randomUUID()` | Agent ID minting | Yes (in MV3 SWs since Chrome 92) | Stable | `mcpv_<timestamp>_<rand>` shape from `mcp-visual-session.js:48-53` exists as a documented fallback but is not needed |
| `globalThis.fsbDiagnostics`, `globalThis.rateLimitedWarn`, `globalThis.redactForLog` | LOG-04 diagnostic emission | Yes (loaded by `background.js:41-42`) | -- | The `if (typeof rateLimitedWarn === 'function')` guard handles missing-helper case gracefully |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — every dependency is in-tree or in-platform.

**Pre-test verification (planner should run before writing the test):**
```bash
node --version
ls /Users/lakshmanturlapati/Desktop/FSB/extension/utils/diagnostics-ring-buffer.js
ls /Users/lakshmanturlapati/Desktop/FSB/extension/utils/redactForLog.js
ls /Users/lakshmanturlapati/Desktop/FSB/extension/utils/mcp-visual-session.js
```

## Validation Architecture

> Per `.planning/config.json` -- `workflow.nyquist_validation` is not set, so it is treated as enabled. This section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Plain Node.js (no jest, no mocha) -- each test file is `node tests/<name>.test.js` |
| Config file | None — orchestration is `package.json:scripts.test` (a sequential `&&` chain of node invocations) |
| Quick run command | `node tests/agent-registry.test.js` |
| Full suite command | `npm test` (runs the full chain in `package.json:scripts.test`) |

The pattern is well-established at `tests/diagnostics-ring-buffer.test.js`, `tests/mcp-bridge-client-lifecycle.test.js`, and `tests/mcp-visual-session-contract.test.js`. The new test must be added to the `package.json:scripts.test` chain.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | `registerAgent()` mints a unique `agent_<uuid>` and ignores any caller-supplied id | unit | `node tests/agent-registry.test.js` (assertion: `agentId.startsWith('agent_')` and is RFC-4122 v4 shape) | Wave 0 |
| AGENT-02 | After 5 `registerAgent` + 3 `bindTab` mutations, `chrome.storage.session.fsbAgentRegistry` payload contains all 5 records with the right `tabIds` set, in the `{ v: 1, records: {...} }` envelope | unit (storage round-trip) | `node tests/agent-registry.test.js` | Wave 0 |
| AGENT-02 | After SW eviction simulation (drop the in-memory instance, re-create from same storage), the rebuilt registry's Maps match the persisted state byte-for-byte for surviving records | unit (eviction sim) | `node tests/agent-registry.test.js` | Wave 0 |
| AGENT-03 | After SW wake with 3 persisted records of which 1 has a tabId not present in `chrome.tabs.query({})`, `hydrate()` drops the ghost record AND emits exactly 1 `agent:reaped` event with `reason: 'tab_not_found'` to the LOG-04 ring buffer | unit (reconciliation) | `node tests/agent-registry.test.js` | Wave 0 |
| AGENT-03 | `hydrate()` is gated by `withRegistryLock` -- a concurrent `registerAgent()` issued during hydration runs AFTER hydrate completes, not interleaved | unit (lock) | `node tests/agent-registry.test.js` | Wave 0 |
| AGENT-04 | 20 concurrent `registerAgent()` calls produce 20 distinct `agent_id`s, final `_agents.size === 20`, persisted state matches in-memory state | unit (TOCTOU stress) | `node tests/agent-registry.test.js` | Wave 0 |
| (D-02 helper) | `formatAgentIdForDisplay('agent_550e8400-e29b-41d4-a716-446655440000') === 'agent_550e84'`; `formatAgentIdForDisplay('')` returns `''`; non-prefixed input returns `''` | unit (helper) | `node tests/agent-registry.test.js` | Wave 0 |
| (Pitfall 6) | `releaseTab(99)` on an unowned tab does not throw and does not emit a diagnostic event; calling `releaseTab(T1)` twice in a row is a no-op the second time | unit (idempotence) | `node tests/agent-registry.test.js` | Wave 0 |
| (Integration smoke) | `chrome.tabs.onRemoved` fires -> registry's listener calls `releaseTab(tabId)` -> tab is removed from `_tabOwners` and the agent's `tabsByAgent` set | unit (listener wiring) | `node tests/agent-registry.test.js` (listener invoked manually via the chrome mock) | Wave 0 |

### Sampling Rate

- **Per task commit:** `node tests/agent-registry.test.js` (single-file, fast)
- **Per wave merge:** `npm test` (full chain — confirms no regression in the existing 50+ tests)
- **Phase gate:** `npm test` green plus a manual UAT step where the planner loads the unpacked extension, opens the background-page console, executes `globalThis.fsbAgentRegistryInstance.registerAgent({})` from the SW devtools and confirms the result + storage payload via `chrome.storage.session.get(null)`.

### Wave 0 Gaps

- [ ] `tests/agent-registry.test.js` — new file covering all rows above. Model on `tests/diagnostics-ring-buffer.test.js` (for ring-buffer interaction) and `tests/mcp-bridge-client-lifecycle.test.js:118-146` (for `chrome.storage` mock harness `createStorageArea` + `createChromeMock`).
- [ ] `package.json:scripts.test` — append `&& node tests/agent-registry.test.js` to the chain.
- [ ] No new framework install; Node.js + the existing hand-rolled chrome mocks are sufficient.

**Reusable test harness assets the planner should copy:**
- `createStorageArea(initial)` from `tests/mcp-bridge-client-lifecycle.test.js:38-72` — gives `get/set/remove/_dump` with the exact `chrome.storage.session` semantics
- `createChromeMock()` from `tests/mcp-bridge-client-lifecycle.test.js:118-146` — full chrome shim with `runtime`, `storage.{session,local}`, `alarms`
- The `assert` / `assertEqual` / `assertDeepEqual` helpers from `tests/mcp-visual-session-contract.test.js:18-34`
- `chrome.tabs.query` and `chrome.tabs.get` mocks need to be added to `createChromeMock()` -- straightforward extension of the existing pattern

## Security Domain

> Phase 237 is a structural plumbing phase with no new external attack surface. `security_enforcement` not set in config -> treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | The registry is internal to the SW; no authentication boundary in 237. Phase 241's `connection_id` is the auth-relevant boundary. |
| V3 Session Management | yes | Agent IDs are session-bound (browser-lifetime), minted via `crypto.randomUUID()` for sufficient entropy. Stored in `chrome.storage.session` (cleared on browser restart -- correct policy). |
| V4 Access Control | no | No cross-agent enforcement in 237. Phase 240 owns the dispatch gate. |
| V5 Input Validation | yes | `registerAgent({})` accepts no untrusted input from a caller in 237 (the `agent_id` is FSB-minted; any caller-supplied `agent_id` is ignored). `bindTab(agentId, tabId)` -- planner should validate `tabId` is a positive integer and `agentId` matches the prefix-and-UUID shape. |
| V6 Cryptography | yes | `crypto.randomUUID()` is the only crypto primitive; it is RFC-4122 v4 with cryptographically-secure entropy in MV3 SWs. Do not hand-roll. |

### Known Threat Patterns for Chrome MV3 SW + chrome.storage.session

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Caller injects pre-made `agent_id` to impersonate another agent | Spoofing | `registerAgent` ignores any caller-supplied `agent_id`; FSB always mints. (D-02 enforces this.) |
| Storage payload corruption (write interrupted by SW eviction) leaves invalid envelope | Tampering | Versioned envelope `{ v: 1, records: {...} }`; `readPersistedAgentRegistry` returns `null` on `payload.v !== 1`, falling back to empty Maps (lossy but safe). |
| Diagnostic events leak agent task content via `redactedContext` | Information Disclosure | Use `redactForLog` -- which redacts strings to `{ kind, length }` and URLs to `{ kind, origin }`; ring buffer's defensive whitelist (`diagnostics-ring-buffer.js:30-38`) further blocks accidental field leakage. |
| Cap-affecting operations race past the limit (Phase 241 territory but the data-shape decision happens here) | Tampering | All cap-affecting ops go through `withRegistryLock`; cap-check + insert is synchronous against the in-memory Map. |
| Tab-ID reuse + onRemoved race (Phase 240 territory but groundwork happens here) | Tampering | `_tabsByAgent` uses `Set<tabId>` for O(1) membership and per-tab tombstone groundwork; Phase 240 adds the `ownershipToken` UUID to fully close the race. |

[VERIFIED against `.planning/research/PITFALLS.md` P1, P2, P3, P6, and the `redactForLog` / `diagnostics-ring-buffer` whitelist code.]

## Sources

### Primary (HIGH confidence)

- **`extension/utils/mcp-visual-session.js`** — line-by-line pattern reference. Constants block 4-26; in-memory Maps 85-88; CRUD 90-219; serialization helpers 312-369; `cloneSession` 288-310; export shape 505-527. THE pattern to mirror.
- **`extension/utils/diagnostics-ring-buffer.js`** — LOG-04 ring buffer at `chrome.storage.local.fsb_diagnostics_ring`; `fsbDiagnostics.append(...)` at 27-65; defensive whitelist 30-38; `_resetRing` test hook 99-101.
- **`extension/utils/redactForLog.js`** — `redactForLog(value, hint)` at 29-63; `rateLimitedWarn(prefix, category, message, redactedContext)` at 69-103 (auto-appends to ring buffer at 89-101, 1/10s rate limit at 67); prefix family `DLG/DOM/BG/WS/SYNC` at lines 9-14.
- **`extension/background.js`** — `importScripts` order at lines 4-46 (insert agent-registry between line 10 and 11); `chrome.tabs.onRemoved` listeners at 2455 and 12616; storage helpers `readPersistedMcpVisualSessions` / `writePersistedMcpVisualSessions` at 563-591; storage key constants at 2053; per-session persistence at 2158-2210.
- **`extension/manifest.json`** — permissions audit at 6-19 (no new perms needed); MV3 service-worker declaration at 23-25.
- **`tests/mcp-bridge-client-lifecycle.test.js:118-146`** — canonical `createChromeMock()` and `createStorageArea()` harness for the new test.
- **`tests/diagnostics-ring-buffer.test.js`** — canonical pattern for testing a `chrome.storage`-backed module without Chrome (in-memory fallback path is what the unit test exercises).
- **`tests/mcp-visual-session-contract.test.js:1-150`** — canonical assert helpers; pattern for testing a Map-based manager class with displacement / replacement semantics.
- **`.planning/research/SUMMARY.md`** — milestone research synthesis; convergence on no-new-deps decision.
- **`.planning/research/STACK.md`** — explicit "What NOT to Add" table; `crypto.randomUUID` justification; `chrome.storage.session` justification.
- **`.planning/research/ARCHITECTURE.md`** — keystone-module + chokepoint design; section 5 (storage layer choice with `_persist` / `hydrate` reference code); section 7 (sequence diagram).
- **`.planning/research/PITFALLS.md`** — P1 (registry-dies-with-SW), P3 (pool over/under-release groundwork), P6 (cap TOCTOU + 4-line mutex recipe).
- **`.planning/ROADMAP.md`** — Phase 237 success criteria (lines 39-50).

### Secondary (MEDIUM confidence)

- Chrome for Developers: `chrome.storage.session` (cited in STACK.md; stable since Chrome 102)
- Chrome for Developers: service-worker lifecycle (cited in STACK.md; 30s idle eviction target)
- Chrome for Developers: `chrome.tabs.query` / `chrome.tabs.get` semantics (`chrome.runtime.lastError` set on missing tab)

### Tertiary (LOW confidence)

- None. Every claim in this research is anchored to verified in-tree code or to in-tree research documents authored 2026-05-05.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive is verified-in-tree or verified-in-platform
- Architecture: HIGH — direct mirror of an existing FSB module (`mcp-visual-session.js`); same shape, same persistence layer, same test pattern
- Pitfalls: HIGH — sourced from `.planning/research/PITFALLS.md` which was authored against verified code anchors

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days; FSB extension surface is stable; only invalidator would be a major MV3 API change or a refactor of the LOG-04 ring buffer)
