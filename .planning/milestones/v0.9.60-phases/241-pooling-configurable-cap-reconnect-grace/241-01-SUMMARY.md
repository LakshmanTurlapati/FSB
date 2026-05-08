---
phase: 241-pooling-configurable-cap-reconnect-grace
plan: 01
subsystem: agent-registry
tags:
  - agent-registry
  - cap
  - mutex
  - storage
  - pool-shrink
  - reconnect-grace
dependency-graph:
  requires:
    - "extension/utils/agent-registry.js (Phase 237/240 substrate: withRegistryLock, _agents/_tabOwners/_tabsByAgent maps, _persist/hydrate envelope, rateLimitedWarn)"
  provides:
    - "AgentRegistry.getCap / setCap / canAcceptNewAgent (POOL-02 / POOL-05)"
    - "AgentRegistry.findAgentByTabId (sync reverse lookup; D-01)"
    - "AgentRegistry.stampConnectionId (D-08-prep carrier)"
    - "AgentRegistry.stageReleaseByConnectionId / cancelStagedRelease (LOCK-02)"
    - "Pool-shrink-to-zero release inside releaseTab (D-10 / POOL-04)"
    - "Persisted stagedReleases envelope sibling field (Q2)"
    - "Hydrate-time staged-release recovery (Pitfall 1)"
  affects:
    - "Plan 02 (bridge wiring): handleAgentRegisterRoute branches on AGENT_CAP_REACHED + calls stampConnectionId; bridge onopen/onclose calls cancelStagedRelease / stageReleaseByConnectionId"
    - "Plan 03 (settings UI): writes chrome.storage.local fsbAgentCap; SW reads via _cachedCap + onChanged"
tech-stack:
  added: []
  patterns:
    - "Cap-check + insert atomic under withRegistryLock (Phase 237 mutex pattern)"
    - "chrome.storage.local cap with sync cached read + onChanged subscriber"
    - "setTimeout-based grace timer (Chrome alarms API 30s floor blocker)"
    - "Persisted stagedReleases envelope with hydrate-time recovery"
    - "Inlined release inside _fireStagedRelease (no mutex re-entry deadlock)"
key-files:
  created:
    - "tests/agent-cap.test.js (5 tests; 20-concurrent claim, default cap, clamping, canAcceptNewAgent)"
    - "tests/agent-cap-storage.test.js (3 tests; round-trip, grandfather, onChanged)"
    - "tests/agent-pool-shrink.test.js (6 tests; pool-shrink, idempotency, findAgentByTabId, multi-agent isolation, stampConnectionId, LOCK-04 negative smoke)"
    - "tests/agent-grace.test.js (8 tests; stage/cancel/expire, stale-timer no-op, LOG-04, hydrate-recover passed/future, multi-agent same conn, empty match, RECONNECT_GRACE_MS default)"
  modified:
    - "extension/utils/agent-registry.js (cap/grace primitives + persisted envelope extensions + hydrate recovery)"
    - "tests/agent-registry.test.js (lift cap to 64 in pre-existing 20-concurrent mutex stress to preserve serialization-only intent under the new default cap=8)"
decisions:
  - "Q2 RESOLVED: Persisted stagedReleases shape is { [connectionId]: { deadline: <ms epoch>, agentIds: [snapshot] } }. timeoutId is intentionally NOT persisted (DOM timer ids do not survive SW eviction). agentIds snapshot is captured AT STAGE TIME so a fresh agent claimed under a different connection_id between stage and expiry is NOT swept up."
  - "Q3 RESOLVED YES: setCap emits one-shot LOG-04 'agent-cap-lowered-grandfathered { previousCap, newCap, activeAtChange }' for operator observability. No eviction; purely diagnostic."
  - "Hydrate-time recovery defers the deadline-passed fire path to a 0ms setTimeout so it runs AFTER hydrate's withRegistryLock releases (calling _fireStagedRelease synchronously from inside hydrate would re-enter the lock and deadlock the chain)."
metrics:
  duration: "10m"
  completed: "2026-05-06"
  tasks: 3
  commits: 6
  files_created: 4
  files_modified: 2
requirements:
  - POOL-02
  - POOL-04
  - POOL-05
  - LOCK-03
---

# Phase 241 Plan 01: Registry Foundation (Cap, Pool-Shrink, Reconnect Grace) Summary

Cap-aware registerAgent with chrome.storage.local persistence, pool-shrink-to-zero agent release in releaseTab, sync findAgentByTabId, connectionId stamping, and setTimeout-based reconnect grace with persisted hydrate-time recovery -- all extending the Phase 237/240 AgentRegistry in place with zero contract breakage.

## Scope

Plan 01 is the lifecycle-correctness foundation for Phase 241. It ships:

1. Atomic cap enforcement with typed AGENT_CAP_REACHED rejection (POOL-02 / D-03).
2. chrome.storage.local-backed configurable cap with onChanged cross-context propagation and grandfather-on-lower-cap behavior (POOL-05 / D-05 / D-06).
3. releaseTab now releases the agent record when its tab pool drains to zero (D-10 / POOL-04 / A2 scope addition).
4. Sync reverse lookup findAgentByTabId for chrome.tabs.onCreated forced-pool routing (D-01).
5. stampConnectionId carrier so Plan 02's bridge wiring can route close events.
6. Stage / cancel / fire / hydrate-recover staged releases keyed by connection_id (LOCK-02 registry side; D-07 / D-08 / D-09).

Plan 02 (bridge wiring) and Plan 03 (settings UI) consume this contract. This plan ships ZERO observable behavior on its own outside the registry -- it is foundation only.

## New AgentRegistry Public API

| Method | Signature | Purpose |
|--------|-----------|---------|
| `findAgentByTabId(tabId)` | sync `tabId -> agentId | null` | Reverse lookup of `_tabOwners`. |
| `getCap()` | sync `() -> number` | Returns clamped `_cachedCap`. |
| `setCap(value)` | sync `(value) -> clamped number` | Clamps to [1, 64]; writes chrome.storage.local; emits LOG-04 grandfather event when M > newCap. |
| `canAcceptNewAgent()` | sync `() -> boolean` | `_agents.size < getCap()`. |
| `stampConnectionId(agentId, connectionId)` | sync `(string, string) -> boolean` | Stamps record.connectionId; fire-and-forget persist. |
| `stageReleaseByConnectionId(connectionId, graceMs?)` | `Promise<boolean>` | Snapshots matching agentIds at stage time; schedules setTimeout; persists deadline. |
| `cancelStagedRelease(connectionId)` | `Promise<boolean>` | Clears timer + persisted entry; idempotent. |

## Persisted Envelope Additions

The chrome.storage.session `fsbAgentRegistry` envelope (v: 1, unchanged) gains two additive fields:

```json
{
  "v": 1,
  "records": {
    "agent_<uuid>": {
      "agentId": "agent_<uuid>",
      "createdAt": 1000,
      "tabIds": [100, 101],
      "connectionId": "conn-uuid"
    }
  },
  "tabMetadata": { /* Phase 240 */ },
  "stagedReleases": {
    "conn-uuid": {
      "deadline": 1799999999000,
      "agentIds": ["agent_<uuid>"]
    }
  }
}
```

Older readers ignore unknown fields; back-compat preserved.

## LOG-04 Events Emitted

| Category | Trigger | Payload |
|----------|---------|---------|
| `agent-cap-reached` | registerAgent rejects when active >= cap (D-04) | `{ cap, active }` |
| `agent-cap-lowered-grandfathered` | setCap(newCap) where newCap < activeAtChange (Q3) | `{ previousCap, newCap, activeAtChange }` |
| `agent-grace-expired` | _fireStagedRelease releases an agent (D-09) | `{ agentId, connectionId, poolSize }` |

All routed through existing `globalThis.rateLimitedWarn` via `FSB_AGENT_LOG_PREFIX = 'AGT'` (matches Phase 237 `agent-reaped-tab_not_found` convention).

## Constants Added

```javascript
FSB_AGENT_CAP_STORAGE_KEY = 'fsbAgentCap'         // chrome.storage.local key
FSB_AGENT_CAP_DEFAULT     = 8
FSB_AGENT_CAP_MIN         = 1
FSB_AGENT_CAP_MAX         = 64
RECONNECT_GRACE_MS        = 10000                  // D-07; setTimeout (Chrome alarms 30s floor blocker)
FSB_AGENT_CAP_REACHED_CATEGORY     = 'agent-cap-reached'
FSB_AGENT_CAP_LOWERED_CATEGORY     = 'agent-cap-lowered-grandfathered'
FSB_AGENT_GRACE_EXPIRED_CATEGORY   = 'agent-grace-expired'
```

## Tests Created (4 new files, all PASS)

| File | Tests | Coverage |
|------|-------|----------|
| `tests/agent-cap.test.js` | 5 | 20-concurrent claim cap invariant; default cap = 8; setCap clamping (0/100/NaN/3.7/string/-5); LOG-04 `agent-cap-reached` emission; canAcceptNewAgent. |
| `tests/agent-cap-storage.test.js` | 3 | chrome.storage.local round-trip + new-instance hydrate; D-06 grandfather (5 agents under cap=8 then setCap(2)) + LOG-04 `agent-cap-lowered-grandfathered`; chrome.storage.onChanged cross-context propagation + clamping + non-numeric ignore + wrong-area ignore. |
| `tests/agent-pool-shrink.test.js` | 6 | Pool-shrink-to-zero releases agent record; releaseTab idempotent post-release; findAgentByTabId sync read with invalid input handling; multi-agent isolation; stampConnectionId persistence; LOCK-04 negative smoke (no setInterval). |
| `tests/agent-grace.test.js` | 8 | Stage + cancel + expire (D-08); stale-timer Pitfall 3 (old timer fires post-fresh-claim); LOG-04 `agent-grace-expired`; hydrate-time recovery for deadline-passed (fires immediately) and deadline-future (reschedules); multi-agent same connection releases all; empty/unknown connection no-ops; RECONNECT_GRACE_MS default = 10000. |

All Phase 237/240 tests still green: agent-registry, ownership-gate, ownership-error-codes, legacy-agent-synthesis, visual-session-reentry, mcp-tool-smoke (67 passed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing 20-concurrent mutex stress test broken by new default cap=8**

- **Found during:** Task 1 GREEN verification (tests/agent-registry.test.js failed after cap-aware registerAgent landed).
- **Issue:** The Phase 237 test "20-concurrent registerAgent mutex serialization stress" fires 20 concurrent registerAgent calls and asserts all 20 succeed with distinct agentIds and `_agents.size === 20`. Under the new default cap=8, the last 12 claims correctly return AGENT_CAP_REACHED, breaking the test's assertions.
- **Fix:** Added a single `if (typeof registry.setCap === 'function') registry.setCap(64);` line to the test's `freshRegistry()` block, lifting the cap above the test's 20-claim load. Test's intent (mutex serialization, zero ID collisions) is preserved; cap-rejection coverage now lives in tests/agent-cap.test.js where it belongs.
- **Files modified:** `tests/agent-registry.test.js` (one-line addition with explanatory comment)
- **Commit:** 380ff7f

**2. [Rule 1 - Bug] RESEARCH §Pattern 4 example called `_fireStagedRelease` directly from hydrate**

- **Found during:** Task 3 implementation (mental simulation before writing code).
- **Issue:** RESEARCH.md §Pattern 4 hydrate-time recovery example shows `self._fireStagedRelease(connectionId).catch(...)` called from inside `hydrate()`'s withRegistryLock turn. This deadlocks: `_fireStagedRelease` itself calls withRegistryLock; the chain becomes `hydrate-lock-acquired -> awaits fire-lock-acquired -> awaits hydrate-lock-released`.
- **Fix:** For deadline-passed entries, defer the fire to a 0ms setTimeout so it runs AFTER hydrate's lock releases. The in-memory `_stagedReleases` entry is rebuilt synchronously so the deferred fire path can locate the snapshot.
- **Files modified:** `extension/utils/agent-registry.js` (`_recoverStagedReleasesFromPayload` method)
- **Commit:** 334800b

**3. [Rule 3 - Blocking] Grep gate `chrome.alarms === 0` violated by explanatory comments**

- **Found during:** Task 3 grep-gate verification.
- **Issue:** Three explanatory comments referenced `chrome.alarms` to document the 30s-floor rationale for choosing setTimeout. The grep gate is strict-equal-zero (no API usage), but the literal token in comments was tripping it.
- **Fix:** Rephrased the three comments to "the Chrome alarms API" prose. Semantic content preserved; literal token removed. Comments still document the design choice clearly.
- **Files modified:** `extension/utils/agent-registry.js` (comments only; zero behavior change)
- **Commit:** 334800b

### Auto-fixed Issues -- not applicable

No Rule 1 (bug), Rule 2 (missing critical functionality), or Rule 4 (architectural ask) deviations beyond the three above. The plan's task spec was executable nearly verbatim.

## Open Questions Resolved

- **Q2 (stagedReleases storage shape):** RESOLVED. Persisted shape is `{ [connectionId]: { deadline, agentIds } }`; timeoutId intentionally not persisted. agentIds is a snapshot at stage time so fresh post-disconnect claims are not swept by old timers.
- **Q3 (setCap diagnostic when M > newCap):** RESOLVED YES. setCap emits one-shot LOG-04 `agent-cap-lowered-grandfathered { previousCap, newCap, activeAtChange }`. No eviction.

## Hand-off Contract

### Plan 02 (bridge wiring) consumes:

- `findAgentByTabId(tabId)` -- chrome.tabs.onCreated forced-pool routing.
- `stampConnectionId(agentId, connectionId)` -- after agent:register, before bridge.sendAndWait threading.
- `stageReleaseByConnectionId(connectionId, RECONNECT_GRACE_MS)` -- bridge `_ws.onclose` handler.
- `cancelStagedRelease(connectionId)` -- bridge `_ws.onopen` handler when reconnecting under same connection_id.
- AGENT_CAP_REACHED branch in `handleAgentRegisterRoute`: when `minted.code === 'AGENT_CAP_REACHED'`, return `{ success: false, code, cap, active }`.

### Plan 03 (settings UI) consumes:

- chrome.storage.local key `fsbAgentCap` -- options page write target. SW's `_cachedCap` mirrors via `_subscribeToCapChanges()` (already installed at construction).
- defaultSettings should include `fsbAgentCap: 8` so first-load reads the default cleanly.

## Self-Check: PASSED

- All four new test files exist and exit 0:
  - `tests/agent-cap.test.js` -> PASS agent-cap (5 tests)
  - `tests/agent-cap-storage.test.js` -> PASS agent-cap-storage (3 tests)
  - `tests/agent-pool-shrink.test.js` -> PASS pool-shrink (6 tests)
  - `tests/agent-grace.test.js` -> PASS grace (8 tests)
- All Phase 237/240 dependent tests still green (agent-registry, ownership-gate, ownership-error-codes, legacy-agent-synthesis, visual-session-reentry, mcp-tool-smoke).
- Grep gates:
  - `AGENT_CAP_REACHED` -> 3 (>=1)
  - `findAgentByTabId` -> 1 (>=1)
  - `fsbAgentCap` -> 5 (>=1)
  - `RECONNECT_GRACE_MS` -> 3 (>=1)
  - `stageReleaseByConnectionId` -> 2 (>=1)
  - `agent-cap-reached|agent-grace-expired|agent-cap-lowered-grandfathered` -> 5 (>=3)
  - `chrome.alarms` -> 0 (negative gate)
  - `stampConnectionId` -> 1 (>=1)
- Commits all present in git log: 719e515 (RED1), 380ff7f (GREEN1), b4f15ee (RED2), e790749 (GREEN2), 35d89f3 (RED3), 334800b (GREEN3).
