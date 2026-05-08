---
phase: 244
plan: 01
subsystem: testing
tags: [multi-agent, regression, agent-registry, test-suite]
requirements: [TEST-01, TEST-02, TEST-03, TEST-04, TEST-05]
dependency-graph:
  requires:
    - extension/utils/agent-registry.js (Phase 237/240/241 production module)
    - tests/fixtures/run-task-harness.js (Phase 239 test harness)
  provides:
    - tests/multi-agent-regression.test.js (six TEST-02..05 named cases)
    - tests/fixtures/multi-agent-regression-helpers.js (simulateSwEviction, recycleTabId)
  affects:
    - Phase 244 plan 03 release-engineering tag-driven publish (consumes the suite green)
tech-stack:
  added: []
  patterns:
    - freshRequireRegistry() per-case isolation (verbatim from tests/agent-cap.test.js)
    - installVirtualClock() for RECONNECT_GRACE_MS time-travel (no real timers)
    - chrome.storage.session envelope pre-seeding for SW-eviction simulation
key-files:
  created:
    - tests/multi-agent-regression.test.js
    - tests/fixtures/multi-agent-regression-helpers.js
  modified: []
decisions:
  - Cases reuse the Phase 239 harness primitives (createStorageArea / installChromeMock / installVirtualClock) re-exported through the regression helpers so the suite has a single import surface.
  - simulateSwEviction calls the existing _resetForTests hook on the registry; no new diagnostic surface introduced (T-244-02 disposition: accept).
  - Case 3 uses cap=16 (not the default 8) so the legacy:popup pre-seed coexists with the 8 fresh agents stamped under conn-A; this lets the case assert legacy-row preservation alongside fresh-agent release.
  - Case 6 verifies that releaseTab also drains the agent record (Phase 241 D-10 pool-drain semantic) before the rebind, so the (agentB, tokA) cross-token assertion is the load-bearing one.
metrics:
  duration: ~25 minutes
  tasks: 3
  test-cases: 6
  test-runtime-ms: ~60
  lines-added: 511
  completed: 2026-05-05
---

# Phase 244 Plan 01: Multi-Agent Regression Suite Summary

Authored the multi-agent regression suite that closes TEST-01..05. Six named cases drive the production extension/utils/agent-registry.js module via plain-Node assert harness; full suite runs in ~60ms; Phase 237-243 regression tests remain green and unchanged.

## Per-Case PASS Lines (verbatim test output)

```
PASS test_case_1_n_parallel_agents_drive_distinct_tabs
PASS test_case_2_n_plus_one_rejects_with_AGENT_CAP_REACHED
PASS test_case_3_all_release_cleanly_on_disconnect
PASS test_case_4_sw_eviction_wake_reconciliation_drops_ghost_records
PASS test_case_5_twenty_concurrent_claim_stress
PASS test_case_6_tab_id_reuse_race_does_not_corrupt_b

6/6 passed
```

## Registry Inspection Techniques (per case)

| Case | Inspection technique | What it proves |
|------|---------------------|----------------|
| 1 | `reg.isOwnedBy(tabId, agentId)` per tab + `reg.getOwner(tabId)` Set-uniqueness check | Eight parallel registerAgent + bindTab calls under cap=8 yield eight distinct (agent, tab) bindings. |
| 2 | Deep-equal slice of `{ error, code, cap, active }` on the 9th register result | Typed AGENT_CAP_REACHED envelope: `{ error: 'AGENT_CAP_REACHED', code: 'AGENT_CAP_REACHED', cap: 8, active: 8 }`. |
| 3 | `reg._agents.has(agentId)` + `reg._stagedReleases.has(connId)` after `clock.advance(60000)` | All 8 fresh agents released after RECONNECT_GRACE_MS; legacy:popup row preserved. |
| 4 | `reg.listAgents().length === 3` + `reg.getOwner(ghostTabId) === null` + `mock.chrome.storage.session._dump()` envelope inspection | Three valid agents survive, two ghosts reaped from both in-memory state AND chrome.storage.session envelope (T-244-03 durable reconciliation). |
| 5 | `Promise.all(20 register calls)` then `.filter(r => r.code === 'AGENT_CAP_REACHED').length === 12` | withRegistryLock atomic-cap-check invariant: exactly 8 successes / 12 rejections, no double-counts. |
| 6 | Four `reg.isOwnedBy(tabId, agentId, token)` permutations (A+tokA, A+tokB, B+tokA, B+tokB) | Per-bindTab fresh ownership_token is the actual authorization gate -- B+tokA returns false even though B owns the recycled tab. |

## Registry Surface Gaps (none surfaced)

The plan flagged a contingency: if `bindTab` did NOT return a per-call `ownershipToken` on success, case 6 would fail loudly and the executor was instructed NOT to modify the registry to make it pass (out of scope for Phase 244). Verified that Phase 240 D-04 already lands `ownershipToken` on the bindTab return shape, so no follow-up is needed.

`AgentRegistry.prototype._resetForTests()` already exists from Phase 237 -- the SW-eviction helper reuses it directly (no new test-only hook added).

## Test Runtime

| Suite | Runtime |
|-------|---------|
| `node tests/multi-agent-regression.test.js` (6 cases) | ~60ms (well under the 5s budget) |

## Phase 237-243 Regression Sweep (sampled)

Confirmed green:
- tests/agent-cap.test.js (PASS agent-cap)
- tests/agent-registry.test.js (All assertions passed)
- tests/agent-grace.test.js (PASS grace -- 13 tests)
- tests/agent-pooling.test.js (PASS pooling)
- tests/agent-pool-shrink.test.js (PASS pool-shrink)
- tests/ownership-gate.test.js (All Phase 240 ownership-gate assertions passed)
- tests/ownership-error-codes.test.js (17 passed, 0 failed)
- tests/run-task-cleanup-paths.test.js (6 passed, 0 failed)
- tests/mcp-tool-smoke.test.js (73 passed, 0 failed)
- tests/mcp-visual-session-contract.test.js (102 passed, 0 failed)

No production code modified -- the regression suite is read-only against the existing agent-registry contract.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8e08b64 | test(244-01): add multi-agent regression test fixtures |
| 2 | f8edb76 | test(244-01): add multi-agent regression suite cases 1, 2, 3, 5 |
| 3 | 648f139 | test(244-01): implement multi-agent regression cases 4 and 6 |

## Deviations from Plan

None -- plan executed exactly as written. Cases 1, 2, 3, 5 landed in task 2 with cases 4 and 6 as failing TBD stubs (per plan's task-2 done criteria); task 3 replaced the stubs with full implementations.

Auth gates: none.

## Self-Check: PASSED

- tests/multi-agent-regression.test.js: FOUND
- tests/fixtures/multi-agent-regression-helpers.js: FOUND
- Commit 8e08b64: FOUND
- Commit f8edb76: FOUND
- Commit 648f139: FOUND
- All 6 named test cases present and PASS via `node tests/multi-agent-regression.test.js`
- Phase 237-243 regression sweep: green and unchanged
