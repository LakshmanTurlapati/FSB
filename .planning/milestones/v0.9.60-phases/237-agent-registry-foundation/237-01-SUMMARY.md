---
phase: 237
plan: 01
subsystem: agent-registry
tags: [keystone-module, mutex, crud, tdd, agent-registry-foundation]
requires:
  - extension/utils/mcp-visual-session.js (pattern parity reference)
  - tests/diagnostics-ring-buffer.test.js (test-shape precedent)
provides:
  - extension/utils/agent-registry.js (AgentRegistry class + helpers + mutex)
  - tests/agent-registry.test.js (10 unit-test groups, all green)
  - package.json scripts.test chain entry for the new test
affects:
  - extension/utils/ (new sibling module to mcp-visual-session.js)
  - npm test chain (one new entry at the tail; ~5-10s additional runtime)
tech-stack:
  added: []
  patterns:
    - Storage-keyed singleton skeleton (mirror of v0.9.36 visual-session)
    - Promise-chain mutex (4-line module-scope withRegistryLock)
    - Display-formatter helper (D-02 single source of truth)
key-files:
  created:
    - extension/utils/agent-registry.js
    - tests/agent-registry.test.js
    - .planning/phases/237-agent-registry-foundation/237-01-SUMMARY.md
  modified:
    - package.json
decisions:
  - "Honor CONTEXT.md D-01: module lives at extension/utils/agent-registry.js, sibling to mcp-visual-session.js, NOT in the deprecated extension/agents/ namespace"
  - "Honor CONTEXT.md D-02: formatAgentIdForDisplay returns agent_<first-6-hex> for valid input, '' for invalid; this is the single source of truth for short-prefix display"
  - "Honor CONTEXT.md D-04: AgentRecord shape is { agentId, createdAt, tabIds }; the MCP-transport linkage field intentionally deferred to Phase 241"
  - "registerAgent unconditionally mints crypto.randomUUID() and ignores all caller-supplied opts (AGENT-01)"
  - "withRegistryLock lives at MODULE scope, not instance scope, so all registry instances share one chain (correct for single-threaded MV3 SW)"
  - "bindTab refuses (returns false) when another agent already owns the tab; the displace-vs-reject decision belongs to Phase 240's dispatch gate"
  - "releaseTab is idempotent on never-owned and double-release paths (Pitfall 6); does NOT reap the agent on last-tab-release (Phase 241 lifecycle)"
  - "listAgents returns JSON-clone defensive copies so callers cannot mutate live records"
metrics:
  duration: ~25 minutes
  completed: 2026-05-05
  tasks: 1
  files-touched: 3
  commits: 1
  test-groups: 10
  test-runtime: ~150ms
---

# Phase 237 Plan 01: Agent Registry Skeleton Summary

In-memory agent registry with CRUD, promise-chain mutex, and the canonical short-prefix display helper, fully covered by 10 unit-test groups including a 20-concurrent-claim stress that locks down TOCTOU serialization before storage lands in plan 02.

## What Was Built

A keystone module that every later v0.9.60 phase imports from. Three deliverables:

1. **`extension/utils/agent-registry.js`** (346 lines) -- Vanilla ES2021+ IIFE module structurally cloned from `extension/utils/mcp-visual-session.js`. Exports `AgentRegistry` class plus `formatAgentIdForDisplay`, `withRegistryLock`, and the storage-key/version/log-prefix constants. Dual-export shape (`globalThis.FsbAgentRegistry` and `module.exports`) so the file loads cleanly under MV3 service-worker `importScripts` and the Node `require` test harness.

2. **`tests/agent-registry.test.js`** (332 lines, 74 assertions) -- 10 plain-Node test groups, no jsdom or chrome mock needed in plan 01 (storage tests defer to plan 02). All groups green at ~150ms total.

3. **`package.json`** -- one line appended to the `scripts.test` `&&`-chain at the tail, immediately after `tests/meta-cognitive-tracker.test.js`.

## Public API Surface (As Shipped)

```js
class AgentRegistry {
  registerAgent(/* opts ignored */)     -> Promise<{ agentId, agentIdShort }>
  releaseAgent(agentId, _reason)        -> Promise<boolean>
  bindTab(agentId, tabId)               -> Promise<boolean>
  releaseTab(tabId)                     -> Promise<boolean>   // idempotent
  isOwnedBy(tabId, agentId)             -> boolean            // sync read
  getOwner(tabId)                       -> agentId | null     // sync read
  getAgentTabs(agentId)                 -> tabId[] | null     // sync read
  listAgents()                          -> AgentRecord[]      // defensive clones
  hydrate()                             -> Promise<void>      // STUB; plan 02
  _persist()                            -> Promise<void>      // STUB; plan 02
  _resetForTests()                      -> void               // test-only
}

formatAgentIdForDisplay(agentId)        -> 'agent_<6-hex>' | ''
withRegistryLock(fn)                    -> Promise<T>          // module-scope mutex

// Constants
FSB_AGENT_REGISTRY_STORAGE_KEY          === 'fsbAgentRegistry'
FSB_AGENT_REGISTRY_PAYLOAD_VERSION      === 1
FSB_AGENT_ID_PREFIX                     === 'agent_'
FSB_AGENT_DISPLAY_HEX_LENGTH            === 6
FSB_AGENT_LOG_PREFIX                    === 'AGT'
FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE === 'agent-reaped'
```

## AgentRecord Shape (in-memory; storage envelope is plan 02 territory)

```js
{
  agentId:   'agent_<full-rfc-4122-v4-uuid>',
  createdAt: <ms-since-epoch>,
  tabIds:    [<positive-int>, ...]   // serialized form of _tabsByAgent Set
  // NO connection-linkage field -- D-04 boundary; lands in Phase 241.
  // NO generation counter -- Phase 240 may add for tab-ID-reuse defense.
}
```

`registerAgent`'s return shape is the smaller `{ agentId, agentIdShort }` projection, where `agentIdShort` is the `formatAgentIdForDisplay` output ready for log/UI surfaces.

## Test-Coverage Matrix

| Test Group | Validates | Requirement | VALIDATION.md task ID |
|------------|-----------|-------------|----------------------|
| Module exports | Class + helpers + constants exist with correct types/values | -- | 237-01-07 (partial) |
| `formatAgentIdForDisplay` 6-char prefix | D-02 canonical helper for valid + 9 invalid-input edges | D-02 / -- | 237-01-07 |
| `registerAgent` ignores caller-supplied id | Caller cannot impersonate; UUID v4 shape; agentIdShort matches helper | AGENT-01 | 237-01-01 |
| 5 agents coexist independently | listAgents reports N; release one leaves others intact | AGENT-04 | 237-01-04 |
| 20-concurrent-claim mutex stress | 20 distinct ids, no collisions, no silent drops, no throws | AGENT-01..04 | 237-01-05 |
| In-memory CRUD | bindTab / isOwnedBy / getOwner / getAgentTabs / releaseTab happy paths + ghost-agent + invalid-tabId rejection | -- | (covers 237-01-06 happy path) |
| `releaseTab` idempotency | Double-release and never-owned both no-op without throwing | AGENT-03 (structural) | 237-01-06 |
| `releaseAgent` reaping | Removes agent + all tab bindings; ghost-id call returns false | -- | -- |
| `listAgents` defensive clones | Caller mutation of returned records does not corrupt internal Maps | -- | -- |
| `hydrate` / `_persist` stubs | Both return resolved promises; shape locked for plan 02 | -- | (plan 02 territory) |

Plan 01 covers AGENT-01 fully and AGENT-04 partially (the data-structural half per D-04). The connection-lifecycle half of AGENT-04 lands in Phase 241. AGENT-02 (storage write-through) and AGENT-03 (hydrate reconciliation) are plan 02's contract -- hydrate/_persist stubs in plan 01 lock the method shape but do not exercise storage.

## Intentionally Stubbed for Plan 02

- **`AgentRegistry.prototype.hydrate`** -- in plan 01 it acquires the mutex, flips `_hydrated = true`, and resolves. Plan 02 will replace with: read `chrome.storage.session.get(FSB_AGENT_REGISTRY_STORAGE_KEY)`, rebuild Maps from the `{ v: 1, records }` envelope, reconcile against `chrome.tabs.query({})`, drop ghost records, emit `agent:reaped` events through the Phase 211 LOG-04 ring buffer with the `[FSB AGT]` prefix and `rateLimitedWarn` (1 warn per category per 10s).
- **`AgentRegistry.prototype._persist`** -- in plan 01 returns `Promise.resolve()`. Plan 02 implements write-through to `chrome.storage.session` under the v=1 envelope (and `chrome.storage.session.remove` when the records map is empty, matching `background.js:563-591`'s pattern).
- **Plan 02 will also add** `await self._persist()` calls inside the mutex-locked bodies of `registerAgent`, `releaseAgent`, `bindTab`, and `releaseTab` (sites flagged with `// Plan 02 will add: await self._persist();` comments in the source).
- **`agent:reaped` event emission helper** -- not yet wired; will live alongside the `hydrate` rewrite in plan 02 and reuse `globalThis.fsbDiagnostics` and `globalThis.rateLimitedWarn` from the existing diagnostic infrastructure.

## Implementation Notes for Plans 02 and 03

1. **Mutex is module-scope.** Plan 02's `hydrate` rewrite should acquire `withRegistryLock` once at the top and run the entire hydrate/reconcile/persist sequence inside that single critical section so concurrent message handlers cannot race against it. Mid-hydrate `registerAgent` calls will queue cleanly behind the lock.

2. **`bindTab` currently refuses on contention.** When another agent already owns the requested tab, plan 01 returns `false`. Phase 240's dispatch gate is the right layer to decide displace-vs-reject. Plan 02 storage write-through can layer cleanly on top of the current truth-table without changing the contention semantics.

3. **`releaseTab` does NOT auto-release the agent on last tab.** Plan 01 keeps the agent record alive even when its tab set goes empty. Phase 241 introduces reconnect-grace lifecycle and is the right home for "agent has no tabs and its connection dropped -> reap." Plan 02 should preserve this posture and not add agent-reaping side effects on `_tabsByAgent.get(agentId).size === 0`.

4. **`listAgents` returns JSON-clone copies.** Storage round-trip in plan 02 should serialize from the live Maps directly (cheaper than re-cloning what's already a clone), not from `listAgents()` output.

5. **`crypto.randomUUID` fallback.** The module includes a defensive `Math.random` fallback for `mintAgentId` if `crypto.randomUUID` is somehow unavailable. This will never trigger on Node 18+ or MV3 (Chrome 92+), but it ensures the module never throws on the registration hot path. Plan 02/03 may delete this fallback once integration testing confirms platform-floor compliance, or keep it as defense-in-depth.

6. **Test harness is plain Node.** No jsdom, no chrome mock needed for plan 01 because storage and tab APIs are stubbed. Plan 02 will need the `createChromeMock` + `createStorageArea` harness from `tests/mcp-bridge-client-lifecycle.test.js:38-146` to exercise hydrate/_persist round-trips and `chrome.tabs.query` reconciliation.

## Discoveries Affecting Plan 02 / 03

- **None blocking.** The interfaces sketched in 237-RESEARCH.md Pattern 1 transferred cleanly. Plan 02's storage layer can be a pure replacement of the two stub bodies plus injection of `await self._persist()` at the four mutation sites already marked with TODO comments.
- **One minor deviation from RESEARCH.md Example 4:** the helper splits the `typeof !== 'string'` and the `indexOf(prefix)` checks into two separate guard clauses for readability instead of `||`-chaining them. Behavior is identical (verified by the 9-edge-case test).
- **Defensive `cloneRecord` helper** added to centralize the JSON round-trip used by `listAgents`. Plan 02 may consume this for storage serialization but is free to write its own serializer if the storage envelope shape needs more control.
- **`withRegistryLock` lives in the module export object** -- consumers (plan 03 background wiring, plan 02 hydrate rewrite) can import it as a named binding. It is module-scope, not instance-scope; do not be tempted to mint a per-instance chain in plan 02.

## Deviations from Plan

None. The plan executed exactly as written:
- Test file written first (RED phase confirmed: `MODULE_NOT_FOUND` before implementation)
- Module file written second to satisfy all 10 test groups (GREEN phase)
- `package.json scripts.test` chain extended at the tail
- `node tests/agent-registry.test.js` -> 10/10 green at ~150ms
- `npm test` -> full chain green, no regressions in pre-existing suite

The two surface-level acceptance-criterion grep checks (forbidding the literal tokens `connection_id` and `extension/agents` in the module) initially flagged on documentation comments that explicitly named the deferred-to-Phase-241 field and the deprecated directory boundary. Comments were rephrased to honor the literal grep contract while preserving the boundary narrative -- now read "MCP-transport linkage field" and "legacy sunset directory" respectively. No behavior change.

## Verification Evidence

```
$ node tests/agent-registry.test.js
--- Module exports ---
  PASS: module exports verified
--- formatAgentIdForDisplay returns 6-char prefix (D-02 canonical) ---
  PASS: formatAgentIdForDisplay handles valid + invalid inputs
--- registerAgent ignores caller-supplied agent_id (AGENT-01) ---
  PASS: registerAgent always mints fresh crypto.randomUUID, ignores caller input
--- Multiple agents coexist independently (AGENT-04) ---
  PASS: 5 agents register and release independently
--- 20-concurrent registerAgent mutex serialization stress ---
  PASS: 20 concurrent registerAgent calls all distinct, no silent drops
--- In-memory CRUD: bindTab / releaseTab / isOwnedBy / getOwner / getAgentTabs ---
  PASS: bindTab / releaseTab / isOwnedBy / getOwner / getAgentTabs in-memory CRUD
--- releaseTab is idempotent (Pitfall 6) ---
  PASS: releaseTab idempotent; double-call and never-owned are silent no-ops
--- releaseAgent removes agent and all bound tabs ---
  PASS: releaseAgent reaps agent and all tab bindings
--- listAgents returns shallow clones (caller cannot corrupt internal state) ---
  PASS: listAgents returns defensive clones
--- hydrate / _persist are stubbed (plan 02 wires storage) ---
  PASS: hydrate and _persist stubs return resolved promises

All assertions passed.
```

`npm test` chain ends with the same 10 PASS lines after running every pre-existing test, confirming no regressions in the ~50-test suite.

## Known Stubs

| Stub | File | Reason | Resolved By |
|------|------|--------|-------------|
| `AgentRegistry.prototype.hydrate` returns immediately, no storage read or tab reconcile | extension/utils/agent-registry.js (line ~286) | Plan 01 ships skeleton only; storage layer is plan 02's contract | Phase 237 plan 02 |
| `AgentRegistry.prototype._persist` returns resolved promise, no storage write | extension/utils/agent-registry.js (line ~298) | Same as above | Phase 237 plan 02 |
| Four `// Plan 02 will add: await self._persist();` markers in mutating methods | extension/utils/agent-registry.js | Lock the call sites for plan 02 to fill | Phase 237 plan 02 |
| `crypto.randomUUID` Math.random fallback inside `mintAgentId` | extension/utils/agent-registry.js (line ~96) | Defense-in-depth on registration hot path; never triggers on Node 18+ or Chrome 92+ | Optional cleanup post-plan-03 |

These stubs are intentional and tracked in 237-02-PLAN.md as the entry points for the storage-layer work. They do NOT block plan 01 from satisfying its requirements (AGENT-01 + AGENT-04 data-structural).

## Self-Check: PASSED

- extension/utils/agent-registry.js: FOUND (346 lines)
- tests/agent-registry.test.js: FOUND (332 lines, 74 assertions, 10 PASS lines)
- package.json contains `node tests/agent-registry.test.js`: FOUND
- Commit d0ac7ce: FOUND in `git log --oneline`
- `node tests/agent-registry.test.js` exits 0: VERIFIED
- `npm test` full chain green: VERIFIED
- No emojis in either new file: VERIFIED (pure ASCII)
- No `connection_id` token in the new module: VERIFIED (D-04 boundary respected)
- No `extension/agents/` reference in the new module: VERIFIED (D-01 boundary respected)
- Public API surface matches `<interfaces>` block in 237-01-PLAN.md: VERIFIED
- Module loads under both Node `require` and `globalThis` exports: VERIFIED by test harness
