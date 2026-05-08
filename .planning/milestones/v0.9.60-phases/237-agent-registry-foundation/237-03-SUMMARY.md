---
phase: 237
plan: 03
subsystem: agent-registry
tags: [background-wiring, importscripts-ordering, sw-boot, tab-onremoved, integration, agent-registry-foundation]
requires:
  - extension/utils/agent-registry.js (plan-01 + plan-02; feature-complete registry module with hydrate + persist + reconciliation)
  - extension/background.js (existing visual-session restore site, two onRemoved listeners, importScripts block)
provides:
  - extension/background.js (importScripts wiring + bootstrapAgentRegistry function + boot call site + third onRemoved listener)
  - globalThis.fsbAgentRegistryInstance (canonical singleton handle for downstream phases 238 / 240 / 241 / 243)
affects:
  - SW boot sequence (one new awaited bootstrap step inside restoreSessionsFromStorage)
  - chrome.tabs.onRemoved listener fan-out (two -> three listeners; existing two untouched)
  - importScripts load order (one new line between mcp-visual-session.js and ws/mcp-tool-dispatcher.js)
tech-stack:
  added: []
  patterns:
    - importScripts try/catch + console.error('[FSB] ...') convention parity (matches lines 11, 22, 41, 42, 43)
    - SW-wake bootstrap colocated with restorePersistedMcpVisualSessions (canonical FSB hydrate site)
    - Standalone third onRemoved listener (additive, not consolidating; per CONTEXT.md "do NOT replace v0.9.36 visual-session cleanup")
    - Defensive lazy-reference guards (FsbAgentRegistry, rateLimitedWarn, redactForLog all checked before use)
key-files:
  created:
    - .planning/phases/237-agent-registry-foundation/237-03-SUMMARY.md
  modified:
    - extension/background.js (3 additive sites: importScripts line, bootstrap function + call, third onRemoved listener)
decisions:
  - "Insertion point for importScripts is exactly between mcp-visual-session.js and ws/mcp-tool-dispatcher.js (per RESEARCH.md Pitfall 5); use existing try/catch pattern for parity"
  - "Bootstrap function lives adjacent to restorePersistedMcpVisualSessions (logical grouping; both are SW-wake hydration helpers); call site uses await + .catch defense-in-depth"
  - "Bootstrap is invoked BEFORE restorePersistedMcpVisualSessions in restoreSessionsFromStorage (registry-first; both are independent so ordering is conservative not strict)"
  - "Third onRemoved listener placed immediately after the v0.9.36 session/port-cleanup listener (textual colocation eases future audit); standalone, NOT a modification of the existing two listeners"
  - "No await inside the new onRemoved listener -- chrome.tabs.onRemoved is synchronous-callback; releaseTab fires forward through the registry's internal promise-chain mutex"
  - "Defensive guards at every touch point: typeof checks for FsbAgentRegistry / releaseTab / rateLimitedWarn / redactForLog; outer try/catch on the listener body"
metrics:
  duration: ~15 minutes
  completed: 2026-05-05
  tasks: 3
  files-touched: 1
  commits: 3
---

# Phase 237 Plan 03: Background.js Boot Wiring Summary

Three additive modifications to `extension/background.js` complete the Phase 237 integration: registry module loads via importScripts before the MCP tool dispatcher, a singleton `AgentRegistry` instance hydrates on SW wake adjacent to the v0.9.36 visual-session restore site, and a new third `chrome.tabs.onRemoved` listener releases registry tab bindings idempotently without disturbing the existing two listeners.

## What Was Built

The agent-registry module shipped feature-complete in plans 01 + 02. Plan 03 wires it into the live SW boot path so it actually runs:

1. **importScripts wiring** -- one new `try { importScripts('utils/agent-registry.js'); } catch (...) {}` line inserted between `utils/mcp-visual-session.js` (existing) and `ws/mcp-tool-dispatcher.js` (existing). Matches the surrounding try/catch + `[FSB]` console.error convention exactly.

2. **bootstrapAgentRegistry function + boot call site** -- async function defined immediately after `restorePersistedMcpVisualSessions` constructs `globalThis.fsbAgentRegistryInstance` once per SW lifetime and awaits `hydrate()` under a defensive try/catch that logs failures via `rateLimitedWarn('AGT', 'hydrate-failed', ...)` with `redactForLog`'d error context. Invoked inside `restoreSessionsFromStorage` between `restoreConversationSessions` and `restorePersistedMcpVisualSessions` so the registry is reconciled before any message handler can read `getOwner(tabId)`.

3. **Third standalone chrome.tabs.onRemoved listener** -- new top-level listener calls `globalThis.fsbAgentRegistryInstance.releaseTab(tabId)` fire-and-forget, with defensive guards on the global and the method. Placed immediately after the v0.9.36 session/port-cleanup listener (textually colocated for audit ease). Existing listeners at the new line numbers 2485 (v0.9.36 cleanup) and 12664 (keyboard-emulator detach) are unchanged byte-for-byte.

## Modified Sites in extension/background.js

| Site | Line(s) | Change | Notes |
|------|---------|--------|-------|
| importScripts wiring | 11 | New: `try { importScripts('utils/agent-registry.js'); } catch (e) { console.error('[FSB] Failed to load agent-registry.js:', e.message); }` | Inserted between mcp-visual-session.js (line 10) and ws/mcp-tool-dispatcher.js (line 12) per RESEARCH.md Pitfall 5 |
| bootstrapAgentRegistry definition | 781-799 | New async function (19 lines including comment block) | Adjacent to `restorePersistedMcpVisualSessions` (defined line 723) |
| Boot call site | 2310 | New: `await bootstrapAgentRegistry().catch(() => {});` immediately before `await restorePersistedMcpVisualSessions();` | Inside `restoreSessionsFromStorage`, between `restoreConversationSessions` (line 2309) and the visual-session restore (line 2311) |
| Third onRemoved listener | 2543-2555 | New top-level listener (13 lines including comment block) | Placed right after the v0.9.36 session/port-cleanup listener block ends (line 2536); existing listeners at 2485 and 12664 untouched |

## importScripts Ordering -- Verified Registry-Before-Dispatcher

```
Line 10: importScripts('utils/mcp-visual-session.js');
Line 11: try { importScripts('utils/agent-registry.js'); } catch (e) { ... }     <-- NEW
Line 12: try { importScripts('ws/mcp-tool-dispatcher.js'); } catch (e) { ... }
```

The registry's IIFE export (`global.FsbAgentRegistry = exportsObj`) is synchronous at end-of-file, so by the time line 12 begins evaluation, `globalThis.FsbAgentRegistry.AgentRegistry` is fully populated. Any later module that captures the registry (Phase 238 server bridges, Phase 240 dispatch gate) can rely on it being present. Lazy-reference guards in `bootstrapAgentRegistry` (`if (!globalThis.FsbAgentRegistry...)`) provide defense-in-depth.

## bootstrapAgentRegistry Function and Call Site

### Function (lines 781-799)

```js
async function bootstrapAgentRegistry() {
  if (!globalThis.FsbAgentRegistry || !globalThis.FsbAgentRegistry.AgentRegistry) return;
  if (!globalThis.fsbAgentRegistryInstance) {
    globalThis.fsbAgentRegistryInstance = new globalThis.FsbAgentRegistry.AgentRegistry();
  }
  try {
    await globalThis.fsbAgentRegistryInstance.hydrate();
  } catch (err) {
    if (typeof globalThis.rateLimitedWarn === 'function') {
      globalThis.rateLimitedWarn(
        'AGT',
        'hydrate-failed',
        'agent registry hydrate failed',
        typeof globalThis.redactForLog === 'function' ? globalThis.redactForLog(err) : { kind: 'error' }
      );
    }
  }
}
```

Defensive at every touch point:
- Missing `FsbAgentRegistry`: early return (silent; the importScripts try/catch on line 11 is the only path that can leave it missing).
- Missing `AgentRegistry` constructor: same early return.
- Hydrate throws (storage corruption, query rejects unexpectedly): wrapped in try/catch; rateLimitedWarn at `('AGT', 'hydrate-failed', ...)` category.
- `rateLimitedWarn` not loaded yet (Pitfall 5): typeof guard skips the warn but does NOT skip the swallow, so SW boot continues.
- `redactForLog` not loaded yet: ternary falls back to a minimal `{ kind: 'error' }` placeholder.

Idempotent: re-entry inside the same SW lifetime constructs the singleton once and `hydrate()` itself is idempotent per plan-02 test 11 (second call adds no new warns and does no work).

### Call Site (line 2310)

```js
// Restore conversation session mappings after sessions are restored
await restoreConversationSessions();
// Phase 237 -- hydrate the agent registry adjacent to the visual-session
// restore site so registry ownership is reconciled before any message
// handler can read getOwner(tabId). The bootstrap function swallows its
// own errors, but we still chain a defensive .catch in case construction
// throws so SW boot is never poisoned.
await bootstrapAgentRegistry().catch(() => {});
await restorePersistedMcpVisualSessions();
```

Inside `restoreSessionsFromStorage` (defined line 2231). Both runtime entry points already flow through this single bootstrap site:

1. Top-level fire-and-forget at line 2321: `restoreSessionsFromStorage().catch(...)` runs immediately when the SW evaluates.
2. Lifecycle handler call at line 12831: `await restoreSessionsFromStorage();` -- second entry-point path that also exercises the bootstrap site.

Registry-first ordering: `bootstrapAgentRegistry` is invoked BEFORE `restorePersistedMcpVisualSessions`. Both are independent (no shared state) so the ordering is conservative rather than strict; placing the registry first ensures `globalThis.fsbAgentRegistryInstance` is constructed and hydrated before any visual-session restore log line could conceivably trigger a registry read in future phases.

Defensive `.catch(() => {})` at the call site is double-defense: bootstrapAgentRegistry already swallows hydrate errors, but this catches any synchronous throw from the constructor itself.

## Third onRemoved Listener (lines 2543-2555)

```js
// Phase 237 -- registry tab-release hook.
// Standalone listener (NOT a modification of the two existing onRemoved listeners
// for session/port cleanup above and the keyboard-emulator detach further below).
// releaseTab is idempotent per registry contract (plan-01 task 1 test 7), so
// duplicate fires from listener reordering or future consolidation are no-ops.
chrome.tabs.onRemoved.addListener((tabId) => {
  try {
    if (globalThis.fsbAgentRegistryInstance &&
        typeof globalThis.fsbAgentRegistryInstance.releaseTab === 'function') {
      // Fire-and-forget: releaseTab is internally promise-chain-locked.
      // Matches the non-blocking pattern of the existing v0.9.36 cleanup listeners.
      globalThis.fsbAgentRegistryInstance.releaseTab(tabId);
    }
  } catch (err) {
    // Defensive: never let registry errors stop the existing onRemoved cleanup chain.
  }
});
```

### Listener fan-out (3 total, in source order)

| Line | Listener purpose | Phase | Modified? |
|------|------------------|-------|-----------|
| 2485 | v0.9.36 session/port cleanup + automationComplete broadcast | v0.9.36 | UNCHANGED |
| 2543 | Phase 237 registry releaseTab | 237 | NEW |
| 12664 | Keyboard-emulator detach | (existing pre-237) | UNCHANGED |

`git diff` confirms only ADDITIONS for `chrome.tabs.onRemoved.addListener` lines; the two existing listener bodies are not edited.

### Constraints honored

- Listener body does NOT use `await` -- `chrome.tabs.onRemoved` callbacks fire synchronously. The registry's internal mutex (`withRegistryLock`) serializes correctly in the fire-and-forget pattern.
- Outer `try/catch` catches synchronous throws (e.g., if `releaseTab` is not a function or the global is somehow corrupted); async errors inside the registry mutex are caught by the mutex's internal `.catch(() => {})` and do not propagate.
- Top-level placement: NOT inside any `if`, `async function`, or other conditional/wrapper -- the listener registers during SW boot like the existing two.
- No fourth listener, no shared helper extraction. CONTEXT.md is explicit: "do NOT replace v0.9.36 visual-session cleanup."

## What Downstream Phases Can Rely On

### Canonical reference

- `globalThis.fsbAgentRegistryInstance` -- singleton handle, constructed and hydrated by `bootstrapAgentRegistry` during SW boot. Survives SW eviction within a browser session via the chrome.storage.session write-through layer (plan 02). Defensive lazy-reference: do NOT assume non-null in production code; check before use (the registry construction can fail if importScripts on line 11 throws).

### Public API (locked through plans 01 + 02)

| Method | Purpose | Notes |
|--------|---------|-------|
| `registerAgent(/* opts ignored */)` | Mint a fresh `agent_<full-uuid>` ID; persist; return `{ agentId, agentIdShort }` | AGENT-01: callers cannot supply IDs |
| `releaseAgent(agentId, _reason)` | Reap an agent and all its tab bindings; persist | Returns `false` for unknown agentId without storage thrash |
| `bindTab(agentId, tabId)` | Bind a tab to an agent; refuses on cross-agent contention (returns false) | Phase 240 dispatch gate decides displace-vs-reject |
| `releaseTab(tabId)` | Idempotent on never-owned and double-release; persists on actual change | Wired to chrome.tabs.onRemoved by THIS plan |
| `isOwnedBy(tabId, agentId)` | Sync read; cheap | Phase 240 ownership gate primitive |
| `getOwner(tabId)` | Sync read; returns agentId or null | Phase 240 + Phase 243 badge primitive |
| `getAgentTabs(agentId)` | Sync read; returns tabId array or null | Phase 241 pool inspection |
| `listAgents()` | Returns JSON-clone defensive copies | Cap accounting; future Phase 241 + Phase 243 UI |
| `formatAgentIdForDisplay(agentId)` | Returns `agent_<6-hex>` for valid input, `''` for invalid | D-02 single source of truth; Phase 243 badge label |
| `withRegistryLock(fn)` | Module-scope promise-chain mutex | Direct consumer access; Phase 240 dispatch gate may use to serialize ownership-token verification |

### Storage envelope (plan 02 contract)

```js
chrome.storage.session.fsbAgentRegistry === {
  v: 1,
  records: {
    'agent_<full-rfc-4122-v4-uuid>': {
      agentId:   'agent_<full-rfc-4122-v4-uuid>',
      createdAt: <ms-since-epoch>,
      tabIds:    [<positive-int>, ...]
    },
    ...
  }
}
```

When records is empty the entire `fsbAgentRegistry` key is removed via `chrome.storage.session.remove(...)`.

### Diagnostic emission

Reaping events use the existing Phase 211 LOG-04 ring buffer through `globalThis.rateLimitedWarn`:

| Reason | Category | Emitted from |
|--------|----------|--------------|
| `'tab_not_found'` | `'agent-reaped-tab_not_found'` | hydrate Step 3 (plan 02) |
| (boot failure) | `'hydrate-failed'` | bootstrapAgentRegistry (THIS plan) |
| `'tab_in_other_window'` | `'agent-reaped-tab_in_other_window'` | reserved for Phase 240 / 243 |

`'hydrate-failed'` is the only new diagnostic category introduced by plan 03.

## Phase 237 Open Success Criteria Status (5/5 met)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Module exists at `extension/utils/agent-registry.js` (D-01 path) and loads before mcp-tool-dispatcher.js | DONE | extension/background.js:11 (registry) precedes :12 (dispatcher); plan-01 commit d0ac7ce shipped the module |
| 2 | Storage write-through + hydrate reconciliation against `chrome.tabs.query({})` | DONE | Plan 02 commit 7792b74 shipped `_persist` + `hydrate` + reconciliation; 25-test suite green |
| 3 | `crypto.randomUUID()` mints `agent_<uuid>` IDs; caller-supplied IDs ignored | DONE | Plan-01 module + plan-01 test 3 ("registerAgent ignores caller-supplied agent_id"); plan-02 grandfathered |
| 4 | Unit tests cover CRUD, storage round-trip, simulated SW eviction + ghost-record drop, 20-concurrent-claim mutex stress | DONE | 25 test groups in `tests/agent-registry.test.js` (10 plan-01 + 15 plan-02); all green at ~200ms |
| 5 | `chrome.tabs.onRemoved -> releaseTab(tabId)` wired idempotently; no MCP tool yet rejects on ownership | DONE | Plan 03 commit 7712509 shipped the third standalone listener; ownership-rejection deferred to Phase 240 dispatch gate |

## Manual UAT Instructions (per VALIDATION.md "Manual-Only Verifications")

The structural integration is automated-tested via `npm test` and `node --test tests/agent-registry.test.js`. The end-to-end SW-boot path is observable via the Chrome unpacked-extension flow:

### UAT 1: SW-wake hydrate against pre-populated storage with ghosts

1. Load the extension unpacked at `chrome://extensions` (developer mode).
2. Open the SW console: click "Inspect views: service worker" on the FSB extension card.
3. In the SW console, manually pre-populate ghost records:
   ```js
   await chrome.storage.session.set({
     fsbAgentRegistry: {
       v: 1,
       records: {
         'agent_00000000-0000-4000-8000-000000000001': {
           agentId: 'agent_00000000-0000-4000-8000-000000000001',
           createdAt: Date.now() - 60_000,
           tabIds: [999999999]  // tab id that does not exist
         }
       }
     }
   });
   ```
4. Force SW eviction: `chrome.runtime.reload()` (or wait for chrome to evict idle SW; reload is faster).
5. Reopen the SW console; observe in console history (and via `globalThis.fsbDiagnostics.list()`) a `[FSB AGT] agent-reaped-tab_not_found` warn entry with `redactedContext = { agentIdShort: 'agent_000000', tabId: 999999999, reason: 'tab_not_found' }`.
6. Verify storage is cleaned: `await chrome.storage.session.get(['fsbAgentRegistry'])` returns `{}` (key removed because records map is empty after the ghost drop).
7. Verify the singleton: `globalThis.fsbAgentRegistryInstance.listAgents()` returns `[]`.

### UAT 2: tab close releases registry binding

1. With the extension loaded, open a content tab (e.g., https://example.com).
2. In the SW console, manually register an agent and bind the tab:
   ```js
   const reg = globalThis.fsbAgentRegistryInstance;
   const { agentId } = await reg.registerAgent();
   const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
   await reg.bindTab(agentId, tabs[0].id);
   reg.getOwner(tabs[0].id); // expect agentId
   ```
3. Close the tab in the browser.
4. In the SW console:
   ```js
   reg.getOwner(tabs[0].id); // expect null
   reg.listAgents();         // agent record remains; tabIds is empty (Phase 241 lifecycle territory)
   await chrome.storage.session.get(['fsbAgentRegistry']); // tabIds: [] for this agent
   ```
5. Confirms the third onRemoved listener fired and `releaseTab` propagated through to storage.

Both UATs are informational; the structural integration is fully automated-tested.

## Things Phase 238 / 240 / 241 Should Know

### Phase 238 (AgentScope + Bridge Wiring)

- `globalThis.fsbAgentRegistryInstance.registerAgent({})` is the single-source mint point. The opts argument is ignored per AGENT-01; pass an empty object for forward compatibility.
- The registry does NOT track `connection_id` in Phase 237. Phase 238 server bridges should mint an agent on session start and stash the agentId in the AgentScope; Phase 241 will close the loop with `connection_id` linkage and reconnect grace.
- Trusted-client allowlist labeling (v0.9.36) is orthogonal to agent identity; Phase 238 may pair them in AgentScope.

### Phase 240 (Tab-Ownership Enforcement)

- `globalThis.fsbAgentRegistryInstance.isOwnedBy(tabId, agentId)` and `.getOwner(tabId)` are the canonical ownership-gate primitives. Both are sync reads; no mutex acquisition needed for read-only checks.
- TOCTOU defense: Phase 240's dispatch gate must verify ownership in the SAME microtask as the dispatch, ideally through a `withRegistryLock(() => { check + dispatch })` wrapper to defeat tab-id-reuse + onRemoved race windows.
- `bindTab` currently RETURNS FALSE on cross-agent contention (does NOT throw, does NOT displace). Phase 240 is the right layer to decide displace-vs-reject and to introduce the ownership-token UUID consumption + tombstone semantics.
- Phase 240 may extend the reason enum on `agent:reaped` events without changing the diagnostic contract (`'tab_in_other_window'` and `'reconcile_error'` reasons are reserved).

### Phase 241 (Pooling, Configurable Cap, Reconnect Grace)

- The `_tabsByAgent` Set is the canonical pool source-of-truth. `pool.size === 0` is NOT auto-reaped by Phase 237; Phase 241 owns that lifecycle and should hook into `releaseTab` (or a thin wrapper) to detect "agent has no tabs and connection is dropped -> reap".
- `connection_id` field on AgentRecord is reserved for Phase 241 (D-04 boundary; do not add to Phase 237 storage envelope).
- Configurable cap (1-64, default 8) lives at the dispatch gate, not in the registry. The registry has no cap-enforcement code in Phase 237.

### Phase 243 (Background-Tab Audit + UI/Badge Integration)

- `formatAgentIdForDisplay(agentId)` is the single source of truth for the short-prefix display string. Sidepanel/popup/overlay badges MUST use this helper rather than slicing IDs locally.
- `listAgents()` returns JSON-clone defensive copies; UI surfaces can iterate without fear of corrupting registry state.

## Deviations from Plan

None. All three tasks executed exactly as written:

- Task 1: importScripts line inserted at the precise location per RESEARCH.md Pitfall 5; existing convention preserved; npm test green.
- Task 2: bootstrapAgentRegistry function defined adjacent to `restorePersistedMcpVisualSessions`; call site placed registry-first inside `restoreSessionsFromStorage`. Only ONE call site for `restorePersistedMcpVisualSessions` exists in the file (line 2311 inside `restoreSessionsFromStorage`); the two `restoreSessionsFromStorage` entry points (line 2321 fire-and-forget at SW evaluate, line 12831 awaited in lifecycle handler) both flow through the single bootstrap site. No need for a second bootstrap call.
- Task 3: third standalone listener placed immediately after the v0.9.36 cleanup listener; existing two listeners untouched; releaseTab fire-and-forget under defensive guards.

The plan's note that one `restorePersistedMcpVisualSessions()` call site exists ("there may be more than one") was investigated and confirmed as exactly one. This is consistent with RESEARCH.md.

## Verification Evidence

### Acceptance criterion grep matrix (all green)

```
$ node --check extension/background.js
(exit 0; no parse errors)

$ grep -n "importScripts.'utils/agent-registry.js'" extension/background.js
11:try { importScripts('utils/agent-registry.js'); } catch (e) { console.error('[FSB] Failed to load agent-registry.js:', e.message); }
(exactly one line; between mcp-visual-session.js (10) and ws/mcp-tool-dispatcher.js (12))

$ grep -c "bootstrapAgentRegistry" extension/background.js
2
(definition line + call site line)

$ grep -n "async function bootstrapAgentRegistry\|globalThis.fsbAgentRegistryInstance\|new globalThis.FsbAgentRegistry.AgentRegistry\|hydrate-failed" extension/background.js
781:async function bootstrapAgentRegistry() {
782:  if (!globalThis.FsbAgentRegistry || !globalThis.FsbAgentRegistry.AgentRegistry) return;
783:  if (!globalThis.fsbAgentRegistryInstance) {
784:    globalThis.fsbAgentRegistryInstance = new globalThis.FsbAgentRegistry.AgentRegistry();
790:        'hydrate-failed',
2545:    if (globalThis.fsbAgentRegistryInstance &&
2546:        typeof globalThis.fsbAgentRegistryInstance.releaseTab === 'function') {
2549:      globalThis.fsbAgentRegistryInstance.releaseTab(tabId);

$ grep -c "chrome.tabs.onRemoved.addListener" extension/background.js
3
(two existing + one new)

$ grep -n "chrome.tabs.onRemoved.addListener" extension/background.js
2485:chrome.tabs.onRemoved.addListener((tabId) => {       <-- existing v0.9.36 (UNCHANGED)
2543:chrome.tabs.onRemoved.addListener((tabId) => {       <-- NEW Phase 237
12664:chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {  <-- existing keyboard-emulator (UNCHANGED)

$ git diff HEAD~3 extension/background.js | grep -E "^[-+]chrome\.tabs\.onRemoved\.addListener"
+chrome.tabs.onRemoved.addListener((tabId) => {
(only one ADDITION line; no removals -- existing two listeners are byte-for-byte unchanged)
```

### Test runs (all green)

```
$ npm test
... full chain green ...
All assertions passed.

$ node --test tests/agent-registry.test.js
All assertions passed.
ok 1 - tests/agent-registry.test.js (~57ms)
1..1
# tests 1
# pass 1
# fail 0
```

No regressions. Boot wiring is purely additive.

### Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `b993b85` | `feat(237-03): wire utils/agent-registry.js into background.js importScripts` |
| Task 2 | `d52ce93` | `feat(237-03): add bootstrapAgentRegistry boot site adjacent to visual-session restore` |
| Task 3 | `7712509` | `feat(237-03): add third standalone chrome.tabs.onRemoved listener for registry releaseTab` |

## Known Stubs

None. Plan 03 is the integration step; no new stubs introduced. The two stubs known from earlier plans (`crypto.randomUUID` Math.random fallback in `mintAgentId`, defense-in-depth) are intentionally retained per plan-02 SUMMARY.

## Self-Check: PASSED

- extension/background.js: FOUND (parses cleanly via `node --check`)
- importScripts ordering verified: registry (line 11) BEFORE mcp-tool-dispatcher (line 12)
- bootstrapAgentRegistry function: FOUND at line 781
- Boot call site: FOUND at line 2310 inside `restoreSessionsFromStorage`
- Third onRemoved listener: FOUND at line 2543 (NEW); existing listeners at 2485 and 12664 byte-for-byte unchanged (verified via `git diff`)
- Singleton handle `globalThis.fsbAgentRegistryInstance`: created in bootstrapAgentRegistry (line 784) and read in the new listener (lines 2545, 2546, 2549)
- Failure mode (rateLimitedWarn 'AGT' / 'hydrate-failed'): wired at lines 789-792
- npm test: VERIFIED exit 0
- node --test tests/agent-registry.test.js: VERIFIED exit 0
- No emojis introduced in any commit (verified by inspection)
- No `connection_id` token added (D-04 boundary respected)
- Commit b993b85: FOUND in `git log --oneline`
- Commit d52ce93: FOUND in `git log --oneline`
- Commit 7712509: FOUND in `git log --oneline`
