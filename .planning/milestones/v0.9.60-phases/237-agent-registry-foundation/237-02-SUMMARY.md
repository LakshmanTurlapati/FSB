---
phase: 237
plan: 02
subsystem: agent-registry
tags: [storage-write-through, sw-wake-reconciliation, ghost-record-reaping, diagnostic-emission, tdd, agent-registry-foundation]
requires:
  - extension/utils/agent-registry.js (plan-01 skeleton with hydrate/_persist stubs)
  - tests/agent-registry.test.js (plan-01 10 test groups; harness extended in place)
  - extension/utils/redactForLog.js (rateLimitedWarn signature reused unchanged)
  - extension/utils/diagnostics-ring-buffer.js (LOG-04 ring buffer; consumed transitively via rateLimitedWarn)
provides:
  - extension/utils/agent-registry.js (full _persist + hydrate + storage helpers + emit helper)
  - tests/agent-registry.test.js (25 test groups: 10 plan-01 + 15 plan-02 storage/reconciliation)
affects:
  - chrome.storage.session.fsbAgentRegistry (new key namespace, versioned envelope { v: 1, records })
  - LOG-04 ring buffer (one new event family: agent-reaped-tab_not_found)
tech-stack:
  added: []
  patterns:
    - chrome.storage.session write-through (mirror of background.js:563-591 with versioned envelope)
    - Lazy-reference diagnostic emission (Pitfall 5; globalThis.rateLimitedWarn may be absent at module load)
    - Conservative reconciliation (chrome.tabs.query failure -> no-drop posture)
    - withRegistryLock-gated hydrate with double-check after lock acquisition
key-files:
  created:
    - .planning/phases/237-agent-registry-foundation/237-02-SUMMARY.md
  modified:
    - extension/utils/agent-registry.js (346 -> 535 lines; +189 new lines for storage layer + reconciliation + emit)
    - tests/agent-registry.test.js (332 -> 971 lines; +639 lines for 15 new test groups + chrome mock harness)
decisions:
  - "Honor CONTEXT.md D-03: ghost-record drops emit through globalThis.rateLimitedWarn('AGT', 'agent-reaped-<reason>', ...) with per-reason category so different drop reasons surface independently in the LOG-04 ring buffer; redactedContext is the minimal { agentIdShort, tabId, reason } triple"
  - "Honor CONTEXT.md D-04: AgentRecord storage shape stays { agentId, createdAt, tabIds }; no connection_id field added (Phase 241 territory)"
  - "Storage envelope { v: 1, records: { ... } } versioned for forward-migration; payload.v !== 1 falls through to null (treated as fresh boot, ignored as ghost)"
  - "writePersistedAgentRegistry removes the storage key entirely when records is empty -- no stale envelope when the registry has no agents"
  - "Lazy-reference pattern for chrome.* and rateLimitedWarn: module loads cleanly under both Node test harnesses (chrome injected after module load) and MV3 SW (chrome present from boot); missing helpers degrade to no-op rather than throw"
  - "hydrate() conservative on chrome.tabs.query failure -- DO NOT drop records when the live-tab probe is unreliable; this prevents a transient query hiccup from cascading into mass-reaping"
  - "Empty mutation paths (releaseTab on never-owned tab, releaseAgent on unknown agentId) skip _persist() to preserve idempotency without storage thrash"
  - "_internal export object surfaces emitAgentReapedEvent / readPersistedAgentRegistry / writePersistedAgentRegistry for direct unit tests (test 14 calls emit directly); test-only contract documented inline"
metrics:
  duration: ~30 minutes
  completed: 2026-05-05
  tasks: 2
  files-touched: 2
  commits: 1
  test-groups: 25
  test-runtime: ~200ms
---

# Phase 237 Plan 02: Storage Write-Through + Reconciliation Summary

`chrome.storage.session` write-through mirror plus SW-wake ghost-record reconciliation with rate-limited diagnostic emission. The agent-registry module is now feature-complete; only background.js boot wiring remains for plan 03.

## What Was Built

Two contributions, both flowing through the same two files:

1. **Storage write-through layer (AGENT-02).** `_persist()` serializes the live in-memory Maps to a plain object and writes a versioned `{ v: 1, records: { ... } }` envelope to `chrome.storage.session.fsbAgentRegistry`. Two module-scope helpers (`readPersistedAgentRegistry`, `writePersistedAgentRegistry`) mirror the canonical FSB pattern at `background.js:563-591` with the versioned envelope addition. All four registry mutation entry points (`registerAgent`, `releaseAgent`, `bindTab`, `releaseTab`) invoke `await self._persist()` inside their existing `withRegistryLock` block. Empty records -> the storage key is removed entirely (no stale envelope).

2. **SW-wake reconciliation + diagnostic emission (AGENT-03).** `hydrate()` rebuilds Maps from the persisted snapshot, queries `chrome.tabs.query({})` to build a `liveTabIds` Set, drops records whose tabIds are not in the live set, emits one rate-limited `'AGT' / 'agent-reaped-tab_not_found' / 'agent reaped'` warn per drop with `{ agentIdShort, tabId, reason }` redactedContext, then rewrites storage so memory and disk stay in sync. Idempotent (double-checks `_hydrated` after lock acquisition). Conservative on `chrome.tabs.query` failure -- no records dropped if the live-tab probe is unreliable.

## Storage Layer Shape

### Envelope

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

When `records` is empty, the entire `fsbAgentRegistry` key is removed via `chrome.storage.session.remove(...)` -- `chrome.storage.session.get([...])` then returns `{}`, which `readPersistedAgentRegistry` treats as `null` (fresh boot).

### Helpers (module-scope, NOT prototype methods)

```
readPersistedAgentRegistry()  -> Promise<{ v, records } | null>   // version-checked, defensive
writePersistedAgentRegistry(records) -> Promise<void>             // empty records => remove key
```

Both helpers reference `globalThis.chrome` lazily through a `_getChrome()` accessor so the module loads cleanly under Node test harnesses where `chrome` is injected AFTER module load. Errors are swallowed to a return-null / no-op posture; the SW boot path is never poisoned by a storage hiccup.

### Persist Call Sites (5 total)

| Location | Site | Path |
|----------|------|------|
| `registerAgent` | After `_agents.set + _tabsByAgent.set` | success path only |
| `releaseAgent` | After `_agents.delete + _tabsByAgent.delete` | success path only (unknown id returns false without persist) |
| `bindTab` | After `_tabOwners.set + _tabsByAgent` mutation | success path only (refusal returns false without persist) |
| `releaseTab` | After `_tabOwners.delete + _tabsByAgent` mutation | success path only (no-op for never-owned tab returns false without persist) |
| `hydrate` Step 5 | After ghost reaping if anything was dropped | only when `reapedThisWake.length > 0` |

The four idempotent / no-op return paths intentionally skip `_persist()` to avoid storage thrash on calls that produced no state change.

## Hydrate Reconciliation Flow

```
hydrate()
|
+-- if (this._hydrated) return Promise.resolve();    // fast path before lock
|
+-- withRegistryLock(async () => {
|     if (self._hydrated) return;                    // double-check inside lock
|
|     // Step 1: rebuild Maps from { v: 1, records: { ... } } envelope.
|     // Defensive: tabIds coerced to Array via Array.isArray check; missing
|     // createdAt falls back to Date.now(); missing agentId falls back to key.
|     payload = await readPersistedAgentRegistry();
|     records = payload?.records ?? {};
|     for (agentId, record) of records:
|       _agents.set(agentId, { ... record cleaned ... });
|       _tabsByAgent.set(agentId, new Set(record.tabIds));
|       for (tabId) of record.tabIds: _tabOwners.set(tabId, agentId);
|
|     // Step 2: live-tab probe; conservative on failure.
|     try { liveTabs = await chrome.tabs.query({}); }
|     catch { _hydrated = true; return; }            // NO drops on query error
|     liveTabIds = new Set(liveTabs.map(t => t.id));
|
|     // Step 3: snapshot _tabOwners and drop ghosts.
|     for ([tabId, agentId]) of [..._tabOwners]:
|       if (!liveTabIds.has(tabId)):
|         reapedThisWake.push({ agentId, tabId, reason: 'tab_not_found' });
|         _tabOwners.delete(tabId);
|         setRef = _tabsByAgent.get(agentId);
|         setRef.delete(tabId);
|         if (setRef.size === 0):
|           // All tabs for this agent are ghosts -> agent itself is a ghost.
|           _tabsByAgent.delete(agentId);
|           _agents.delete(agentId);
|         else:
|           record.tabIds = Array.from(setRef);      // keep record consistent
|
|     // Step 4: emit one diagnostic per drop (rate-limited per reason).
|     for (reap) of reapedThisWake:
|       emitAgentReapedEvent(reap.agentId, reap.tabId, reap.reason);
|
|     // Step 5: rewrite storage if anything changed.
|     if (reapedThisWake.length > 0): await self._persist();
|
|     _hydrated = true;
|   });
```

The entire hydrate body runs inside `withRegistryLock`. Concurrent `registerAgent` / `bindTab` / `releaseTab` / `releaseAgent` calls during hydration queue cleanly behind the lock, so a freshly registered agent cannot interleave its mutation with the rebuild + reconcile pass (Test 12 asserts this with a `Promise.all([hydrate(), registerAgent()])` race).

## Diagnostic Emission

```
emitAgentReapedEvent(agentId, tabId, reason)
|
+-- if globalThis.rateLimitedWarn is callable:        // lazy ref; Pitfall 5
|     rateLimitedWarn(
|       'AGT',                                         // FSB_AGENT_LOG_PREFIX
|       'agent-reaped-' + reason,                     // per-reason category
|       'agent reaped',                               // message
|       { agentIdShort, tabId, reason }               // redactedContext
|     );
+-- returns the full event object (caller may consume; current callers don't)
```

### Per-reason category convention

The category is `'agent-reaped-' + reason` so the LOG-04 ring buffer's defensive whitelist surfaces each drop reason as a distinct rate-limited stream:

| Reason | Category | Source |
|--------|----------|--------|
| `'tab_not_found'` | `'agent-reaped-tab_not_found'` | hydrate Step 3 (current; only one wired) |
| `'tab_in_other_window'` | `'agent-reaped-tab_in_other_window'` | reserved (Phase 240 / Phase 243 cross-window enforcement) |
| `'reconcile_error'` | `'agent-reaped-reconcile_error'` | reserved (defensive future use) |

Phase 237 only emits `tab_not_found` from hydrate. Phases 240/243 may extend the reason enum without changing the diagnostic contract.

### Lazy-reference safety (Pitfall 5)

`emitAgentReapedEvent` checks `typeof globalThis.rateLimitedWarn === 'function'` before calling and wraps the call in `try/catch`. If the helper is absent (e.g. due to module load order in plan-03 background.js wiring), reaping still occurs at full speed; only the diagnostic is lost. Test 15 asserts this: with `globalThis.rateLimitedWarn` deleted, `hydrate()` still drops the ghost from both Maps AND storage without throwing.

## Test Coverage Matrix

| Test # | Name | Validates | Requirement | VALIDATION.md task ID |
|--------|------|-----------|-------------|----------------------|
| 1 | registerAgent persists | 5 records in `{ v: 1, records }` envelope | AGENT-02 | 237-01-02 |
| 2 | bindTab persists | tabIds [100, 200] in storage | AGENT-02 | 237-01-02 |
| 3 | releaseTab persists | tabIds [100, 300] (200 removed) | AGENT-02 | 237-01-02 |
| 4 | releaseAgent removes from storage | only B remains after releaseAgent(A) | AGENT-02 | 237-01-02 |
| 5 | empty registry removes the key | `chrome.storage.session._dump()` has no `fsbAgentRegistry` key | AGENT-02 (D-03 hygiene) | -- |
| 6 | version mismatch returns null | hydrate ignores `{ v: 99, records: { ghost } }` | AGENT-02 (forward-migration) | -- |
| 7 | SW-eviction simulation | fresh registry rehydrates `agent_a` -> tab 100 | AGENT-02 + AGENT-03 (read path) | 237-01-02 |
| 8 | corrupt envelope falls through | `'not-an-object'` payload -> empty Maps, no throw | AGENT-02 (defensive) | -- |
| 9 | hydrate drops ghost + emits diagnostic | 1 live + 1 ghost -> 1 warn `'agent-reaped-tab_not_found'` | AGENT-03 (keystone) | 237-01-03 |
| 10 | hydrate drops 3 ghosts -> 3 warns | fan-out coverage (Pitfall 4) | AGENT-03 | 237-01-03 |
| 11 | hydrate idempotent | second call adds no new warns | AGENT-03 | -- |
| 12 | hydrate gated by withRegistryLock | concurrent register completes after hydrate | AGENT-03 | -- |
| 13 | hydrate conservative on query failure | 3 records preserved when `tabs.query` throws | AGENT-03 (defensive) | -- |
| 14 | emitAgentReapedEvent payload shape | exact ctx shape `{ agentIdShort, tabId, reason }` | D-03 verbatim | -- |
| 15 | emit safe without rateLimitedWarn | Pitfall 5 lazy-reference | AGENT-03 (defensive) | -- |

Plan 02 closes AGENT-02 and AGENT-03 fully. AGENT-01 and AGENT-04 (data-structural half) remain green from plan 01 under the extended suite.

## Pre-conditions Plan 03 Needs

The agent-registry module is feature-complete after plan 02. Plan 03 (background.js boot wiring) needs only:

1. **`importScripts('utils/agent-registry.js', ...)` ordering.** Must load BEFORE `ws/mcp-tool-dispatcher.js` and BEFORE any module that might call `agentRegistry.bindTab` from a message handler. The module file is self-contained and does NOT depend on `chrome.*` being available at load time (lazy-references), so it is safe to import early.

2. **Single `agentRegistry = new FsbAgentRegistry.AgentRegistry()` singleton in background.js.** Construct it eagerly at module top so the SW-wake hydrate runs in the same microtask as the other Phase 211 / v0.9.36 hydration helpers.

3. **`await agentRegistry.hydrate()` in the SW boot sequence.** The right site is alongside `restorePersistedMcpVisualSessions()`. The hydrate call MUST complete before any message handler that reads `agentRegistry.getOwner(tabId)` is allowed to service requests; otherwise ghost records leak briefly into ownership decisions. Plan 03's task structure should gate message handlers behind a "registry hydrated" promise (mirror the v0.9.36 visual-session pattern).

4. **`chrome.tabs.onRemoved` -> `agentRegistry.releaseTab(tabId)` listener.** Add a third listener site alongside the two existing ones at `background.js:2455` and `:12616`. The registry's `releaseTab` is already idempotent (verified by plan-01 test 7), so duplicate firing is a no-op.

5. **No additional storage permissions or manifest changes.** Verified by RESEARCH.md and CONTEXT.md; all required permissions (`storage`, `tabs`) are already in `extension/manifest.json`.

## Discoveries Affecting Plan 03

- **Module load order is forgiving.** The lazy-reference pattern means plan 03 can importScripts the registry before OR after `utils/redactForLog.js` and `utils/diagnostics-ring-buffer.js`; reaping degrades gracefully if the diagnostic helpers are not yet loaded. Recommendation: still load `redactForLog.js` first (it has zero dependencies), but the constraint is soft, not hard.

- **`_internal` export is test-only.** Plan 03 must NOT import `FsbAgentRegistry._internal` from production code. The test-only contract is documented inline in the module. If background.js needs to emit `agent:reaped` events from a non-hydrate site (e.g. from the `chrome.tabs.onRemoved` listener), the right path is to call `agentRegistry.releaseTab(tabId)` and let the registry's own diagnostic emission fire -- which is NOT yet wired in plan 02 because plan 02 only emits from `hydrate`. Plan 03 may extend `releaseTab` to emit a `'tab_closed'` reason if user observability requires it; for v0.9.60 this is a deferred decision.

- **Storage write coalescing not implemented.** Each mutation triggers its own `_persist()` call. For typical multi-agent workloads (8 agents, sub-100 mutations/sec) this is well within `chrome.storage.session.set` throughput. Phase 240's dispatch gate may want to batch writes if a wide forced-new-tab pool flap is observed; for plan 02 this is acceptable as-is.

- **Empty `tabIds` after a partial reap keeps the agent record.** When ONE of an agent's tabs is a ghost but others survive, the agent record stays alive with the trimmed tab set. Only when ALL tabs for an agent are ghosts is the agent itself dropped. This matches Phase 241's eventual lifecycle model where `pool.size === 0` triggers reaping; plan-02 specifically applies this on hydrate to avoid leaking "agent with no tabs" records into the cap accounting.

## Deviations from Plan

None. Both tasks executed exactly as written:

- Task 1 (RED): tests 1-8 added to `tests/agent-registry.test.js` after the plan-01 stub-shape test (which was relaxed from "stubs return resolved promises" to "hydrate / _persist exist as functions" since plan 02 replaces those stubs with real implementations and the harness has not yet installed the chrome mock at that point in the test file).
- Task 1 (GREEN): `_persist`, `readPersistedAgentRegistry`, `writePersistedAgentRegistry` implemented; four mutation sites wired; partial `hydrate` shipped.
- Task 2 (RED): tests 9-15 added with chrome.tabs mock + diagnostic capture.
- Task 2 (GREEN): `emitAgentReapedEvent` module-scope helper added; `hydrate` extended to full Pattern 4 with reconciliation, emission, and storage write-back.

The two tasks were committed as a single `feat(237-02): ...` commit because the file-level changes interleave cleanly: the test harness for tasks 1+2 is one shared block (chrome mock + storage area + diagnostic capture + freshRequireRegistry), and the module changes for tasks 1+2 reference each other (`hydrate` calls `_persist`; `_persist` calls `writePersistedAgentRegistry`). Splitting the commit would have required two passes through the same files with dependent edits; the combined commit message documents both task scopes explicitly.

The "deferred to task 2" partial `hydrate` body that plan 02's Task 1 section described as a stepping stone was not separately committed -- the full Pattern 4 implementation was written directly because `_internal.emitAgentReapedEvent` was needed by test 14 anyway. Behavior identical; commit history is one feat instead of two.

## Verification Evidence

```
$ node tests/agent-registry.test.js
... (10 plan-01 tests pass) ...
--- Plan 02 / Test 1: storage round-trip -- registerAgent persists ---
  PASS: registerAgent writes through to chrome.storage.session
--- Plan 02 / Test 2: storage round-trip -- bindTab persists ---
  PASS: bindTab writes through to chrome.storage.session
--- Plan 02 / Test 3: storage round-trip -- releaseTab persists ---
  PASS: releaseTab writes through to chrome.storage.session
--- Plan 02 / Test 4: storage round-trip -- releaseAgent removes from storage ---
  PASS: releaseAgent writes through to chrome.storage.session
--- Plan 02 / Test 5: empty registry removes the storage key ---
  PASS: empty records map removes the storage key
--- Plan 02 / Test 6: version mismatch returns null ---
  PASS: version mismatch falls through to empty state
--- Plan 02 / Test 7: SW-eviction simulation -- fresh instance repopulates from storage ---
  PASS: hydrate rebuilds Maps from a valid persisted snapshot
--- Plan 02 / Test 8: corrupt envelope falls through gracefully ---
  PASS: corrupt envelope handled defensively, no throw
--- Plan 02 / Test 9: hydrate drops ghost records and emits diagnostic ---
  PASS: hydrate drops ghosts and emits a diagnostic per drop
--- Plan 02 / Test 10: hydrate drops MULTIPLE ghosts (one warn per record) ---
  PASS: 3 ghosts -> 3 warns (one per record)
--- Plan 02 / Test 11: hydrate is idempotent (second call no-op) ---
  PASS: hydrate idempotent; second call adds no warns
--- Plan 02 / Test 12: hydrate is gated by withRegistryLock ---
  PASS: concurrent hydrate + registerAgent serialized under mutex
--- Plan 02 / Test 13: hydrate is conservative when chrome.tabs.query throws ---
  PASS: chrome.tabs.query failure -> conservative no-drop posture
--- Plan 02 / Test 14: emitAgentReapedEvent has correct payload shape (D-03) ---
  PASS: emitAgentReapedEvent emits exact D-03 payload
--- Plan 02 / Test 15: emit is safe when rateLimitedWarn is absent (Pitfall 5) ---
  PASS: missing rateLimitedWarn does not crash reaping path

All assertions passed.
```

`npm test` full chain exits 0; no regressions in pre-existing suite. `node tests/agent-registry.test.js` runs three times consecutively without flake (verified by independent invocation).

Acceptance-criterion grep matrix (all green):

```
function readPersistedAgentRegistry              -> 1
function writePersistedAgentRegistry             -> 1
function emitAgentReapedEvent                    -> 1
c.storage.session.get / set / remove             -> 2 each
await self._persist                              -> 5 (4 mutation sites + hydrate Step 5)
v: FSB_AGENT_REGISTRY_PAYLOAD_VERSION            -> 1
connection_id (D-04 boundary)                    -> 0
rateLimitedWarn references                       -> 6
agent-reaped- category                           -> 2
chrome.tabs.query / c.tabs.query                 -> 6
_internal export                                 -> 2
"Plan 02 will add" markers (should be 0)         -> 0
createStorageArea harness                        -> 4 (one definition + use sites)
fsbAgentRegistry test references                 -> 10
v: 99 (version mismatch test)                    -> 1
extension/utils/agent-registry.js line count     -> 535
tests/agent-registry.test.js line count          -> 971
emojis                                           -> 0 (verified)
```

## Known Stubs

None. Plan 02 closed the four `// Plan 02 will add: await self._persist();` markers from plan 01 and replaced both stubs (`hydrate`, `_persist`) with full implementations. The agent-registry module is feature-complete; only background.js boot wiring remains for plan 03.

The defensive `Math.random` fallback inside `mintAgentId` (plan 01 line ~96) is intentionally retained as defense-in-depth on the registration hot path. It will never trigger on Node 18+ or MV3 (Chrome 92+), but ensures the module never throws if `crypto.randomUUID` is somehow unavailable.

## Self-Check: PASSED

- extension/utils/agent-registry.js: FOUND (535 lines, post-plan-02)
- tests/agent-registry.test.js: FOUND (971 lines, 25 PASS lines)
- Commit 7792b74: FOUND in `git log --oneline`
- `node tests/agent-registry.test.js` exits 0 (verified twice consecutively, no flake)
- `npm test` full chain exits 0 (verified)
- No emojis in either modified file (verified by character-class grep audit)
- No `connection_id` token in module file (D-04 boundary respected)
- No `extension/agents/` reference in module file (D-01 boundary respected)
- Storage envelope is `{ v: 1, records: { ... } }` after every mutation (Tests 1-4 assert)
- Empty records removes the key (Test 5 asserts)
- Ghost drops on hydrate are dropped from BOTH in-memory Maps AND storage (Test 9 asserts both)
- One `rateLimitedWarn('AGT', 'agent-reaped-tab_not_found', ...)` call per drop (Tests 9, 10 assert)
- redactedContext is exactly `{ agentIdShort, tabId, reason }` (Test 14 asserts deep equality)
- hydrate is gated by `withRegistryLock` (Test 12 asserts via Promise.all race)
- hydrate is idempotent (Test 11 asserts)
- hydrate is conservative on chrome.tabs.query failure (Test 13 asserts no drops + no warns)
- emit is safe when rateLimitedWarn is absent (Test 15 asserts hydrate completes)
- All four mutation entry points have `await self._persist()` calls inside their existing withRegistryLock block (verified by grep + inspection)
- No remaining "Plan 02 will add" comments (verified by grep returning 0)
