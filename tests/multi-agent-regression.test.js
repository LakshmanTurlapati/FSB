'use strict';

/**
 * Phase 244 plan 01 -- multi-agent regression suite (TEST-01..05).
 *
 * Six named test cases drive the production extension/utils/agent-registry.js
 * module via the freshRequireRegistry() pattern (verbatim from
 * tests/agent-cap.test.js). Plain-Node assert harness; no test-runner
 * framework; no real wall-clock sleeps; no real Chrome.
 *
 *   1. test_case_1_n_parallel_agents_drive_distinct_tabs
 *   2. test_case_2_n_plus_one_rejects_with_AGENT_CAP_REACHED
 *   3. test_case_3_all_release_cleanly_on_disconnect
 *   4. test_case_4_sw_eviction_wake_reconciliation_drops_ghost_records
 *   5. test_case_5_twenty_concurrent_claim_stress
 *   6. test_case_6_tab_id_reuse_race_does_not_corrupt_b
 *
 * Run: node tests/multi-agent-regression.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');
const {
  simulateSwEviction,
  recycleTabId,
  createStorageArea,
  installChromeMock,
  installVirtualClock
} = require('./fixtures/multi-agent-regression-helpers.js');

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

function setupDiagnosticCapture() {
  const captured = [];
  globalThis.rateLimitedWarn = function(prefix, category, message, ctx) {
    captured.push({ prefix: prefix, category: category, message: message, ctx: ctx });
  };
  globalThis.redactForLog = function(v) { return { kind: typeof v }; };
  return captured;
}

function teardownDiagnosticCapture() {
  delete globalThis.rateLimitedWarn;
  delete globalThis.redactForLog;
}

const cases = [];
function test(name, fn) { cases.push({ name: name, fn: fn }); }

// =============================================================================
// Case 1: N parallel agents drive distinct tabs
// =============================================================================
test('test_case_1_n_parallel_agents_drive_distinct_tabs', async () => {
  const N = 8;
  const tabsList = [];
  for (let i = 0; i < N; i++) tabsList.push({ id: 1000 + i, incognito: false, windowId: 1 });
  const mock = installChromeMock({ tabs: tabsList });
  setupDiagnosticCapture();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(N);

    // Register N agents in parallel.
    const regPromises = [];
    for (let i = 0; i < N; i++) regPromises.push(reg.registerAgent());
    const regResults = await Promise.all(regPromises);

    const successes = regResults.filter(function(r) { return r && r.agentId && !r.code; });
    assert.strictEqual(successes.length, N, 'all 8 registrations succeed under cap=8');

    // Bind a distinct tab to each agent in parallel.
    const bindPromises = successes.map(function(r, i) {
      return reg.bindTab(r.agentId, 1000 + i);
    });
    const binds = await Promise.all(bindPromises);

    binds.forEach(function(b, i) {
      assert.ok(b && b.ownershipToken, 'bind ' + i + ' returns ownershipToken');
      assert.strictEqual(b.tabId, 1000 + i, 'bind ' + i + ' carries the requested tabId');
    });

    // isOwnedBy returns true for every (tabId, agentId) pair.
    for (let i = 0; i < N; i++) {
      const owns = reg.isOwnedBy(1000 + i, successes[i].agentId);
      assert.strictEqual(owns, true, 'agent ' + i + ' owns tab ' + (1000 + i));
    }

    // Exactly one agentId per tabId.
    const ownerSet = new Set();
    for (let i = 0; i < N; i++) {
      const owner = reg.getOwner(1000 + i);
      assert.ok(owner, 'tab ' + (1000 + i) + ' has an owner');
      ownerSet.add(owner);
    }
    assert.strictEqual(ownerSet.size, N, 'N distinct agents own N tabs');
  } finally {
    teardownDiagnosticCapture();
    mock.restore();
  }
});

// =============================================================================
// Case 2: (N+1)th claim rejects with AGENT_CAP_REACHED
// =============================================================================
test('test_case_2_n_plus_one_rejects_with_AGENT_CAP_REACHED', async () => {
  const mock = installChromeMock({ tabs: [] });
  setupDiagnosticCapture();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);

    // Saturate to 8.
    for (let i = 0; i < 8; i++) {
      const r = await reg.registerAgent();
      assert.ok(r && r.agentId, 'agent ' + i + ' registered');
    }

    // 9th attempt rejects with the typed error envelope.
    const ninth = await reg.registerAgent();
    assert.strictEqual(ninth.ok, undefined, 'no boolean ok on the typed reject envelope');
    // Slice the four contract fields and deep-equal them.
    const slice = {
      error: ninth.error,
      code: ninth.code,
      cap: ninth.cap,
      active: ninth.active
    };
    assert.deepStrictEqual(slice, {
      error: 'AGENT_CAP_REACHED',
      code: 'AGENT_CAP_REACHED',
      cap: 8,
      active: 8
    }, '9th registerAgent returns AGENT_CAP_REACHED with cap:8 active:8');
  } finally {
    teardownDiagnosticCapture();
    mock.restore();
  }
});

// =============================================================================
// Case 3: All release cleanly on disconnect (stagedRelease + grace expiry)
// =============================================================================
test('test_case_3_all_release_cleanly_on_disconnect', async () => {
  const mock = installChromeMock({ tabs: [] });
  setupDiagnosticCapture();
  const clock = installVirtualClock();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    // Cap=16 so legacy:popup + 8 fresh agents all fit comfortably.
    reg.setCap(16);

    // Pre-seed a legacy:* row to assert it is NOT swept up by stagedRelease.
    const legacyResult = await reg.getOrRegisterLegacyAgent('popup');
    assert.strictEqual(legacyResult.agentId, 'legacy:popup', 'legacy popup row seeded');

    // Register 8 agents stamped with connectionId 'conn-A'.
    const agentIds = [];
    for (let i = 0; i < 8; i++) {
      const r = await reg.registerAgent();
      assert.ok(r && r.agentId, 'fresh agent ' + i + ' registered');
      reg.stampConnectionId(r.agentId, 'conn-A');
      agentIds.push(r.agentId);
    }

    assert.strictEqual(reg._agents.size, 9, 'legacy + 8 fresh = 9 agents pre-stage');

    // Stage release for conn-A.
    const staged = await reg.stageReleaseByConnectionId('conn-A');
    assert.strictEqual(staged, true, 'stageReleaseByConnectionId returns true');
    assert.strictEqual(reg._agents.size, 9,
      'all agents still present immediately after stage (within grace window)');

    // Advance the virtual clock past RECONNECT_GRACE_MS (10000ms default;
    // 60000ms is well past the safety margin).
    clock.advance(60000);

    // Allow the microtask queue to drain so the staged-release lock can run.
    // installVirtualClock fires the timer body synchronously; the body schedules
    // an async withRegistryLock turn that resolves on the next microtask.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // All 8 agent_<uuid> records gone; legacy:popup untouched.
    agentIds.forEach(function(id) {
      assert.strictEqual(reg._agents.has(id), false,
        'fresh agent ' + id + ' released after grace expiry');
    });
    assert.strictEqual(reg._agents.has('legacy:popup'), true,
      'legacy:popup preserved -- staged release did not sweep legacy rows');
    assert.strictEqual(reg._agents.size, 1, 'only legacy:popup remains');
    assert.strictEqual(reg._stagedReleases.has('conn-A'), false,
      'staged entry cleared on expiry');
  } finally {
    clock.restore();
    teardownDiagnosticCapture();
    mock.restore();
  }
});

// =============================================================================
// Case 4: SW eviction + wake reconciliation drops ghost records
// =============================================================================
test('test_case_4_sw_eviction_wake_reconciliation_drops_ghost_records', async () => {
  // Pre-build the persisted envelope: 5 agent records (3 valid + 2 ghosts).
  const a1 = 'agent_11111111-1111-1111-1111-111111111111';
  const a2 = 'agent_22222222-2222-2222-2222-222222222222';
  const a3 = 'agent_33333333-3333-3333-3333-333333333333';
  const g1 = 'agent_99999999-9999-9999-9999-999999999991';
  const g2 = 'agent_99999999-9999-9999-9999-999999999992';

  const envelope = {
    v: 1,
    records: {
      [a1]: { agentId: a1, createdAt: 1000, tabIds: [101] },
      [a2]: { agentId: a2, createdAt: 2000, tabIds: [102] },
      [a3]: { agentId: a3, createdAt: 3000, tabIds: [103] },
      [g1]: { agentId: g1, createdAt: 4000, tabIds: [901] },
      [g2]: { agentId: g2, createdAt: 5000, tabIds: [902] }
    }
  };

  // Tab 101/102/103 resolve in chrome.tabs.query; 901/902 do not -- those two
  // are the ghosts that Phase 237 D-09 reconciliation should reap.
  const mock = installChromeMock({
    tabs: [{ id: 101 }, { id: 102 }, { id: 103 }],
    storage: { session: { fsbAgentRegistry: envelope } }
  });
  setupDiagnosticCapture();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();

    // Phase 244 D-01: simulate SW eviction. The persisted envelope above is
    // already on disk (chrome.storage.session); the fresh registry instance
    // has empty Maps. simulateSwEviction is a no-op in this case (the Maps
    // are already empty), but we exercise the helper to lock its contract.
    simulateSwEviction(reg);
    assert.strictEqual(reg.listAgents().length, 0, 'in-memory Maps empty post-eviction');

    // Wake reconciliation: hydrate() rebuilds from disk and reaps ghosts.
    await reg.hydrate();

    // The 3 valid agents survive.
    assert.strictEqual(reg._agents.has(a1), true, 'a1 valid agent rehydrated');
    assert.strictEqual(reg._agents.has(a2), true, 'a2 valid agent rehydrated');
    assert.strictEqual(reg._agents.has(a3), true, 'a3 valid agent rehydrated');

    // The 2 ghost agents reaped.
    assert.strictEqual(reg._agents.has(g1), false, 'g1 ghost reaped');
    assert.strictEqual(reg._agents.has(g2), false, 'g2 ghost reaped');
    assert.strictEqual(reg.listAgents().length, 3, 'exactly 3 agents post-reconciliation');

    // Tab ownership reflects only live tabs.
    assert.strictEqual(reg.getOwner(101), a1, 'tab 101 owned by a1');
    assert.strictEqual(reg.getOwner(102), a2, 'tab 102 owned by a2');
    assert.strictEqual(reg.getOwner(103), a3, 'tab 103 owned by a3');
    assert.strictEqual(reg.getOwner(901), null, 'ghost tab 901 has no owner');
    assert.strictEqual(reg.getOwner(902), null, 'ghost tab 902 has no owner');

    // T-244-03: persisted envelope itself was pruned (durable reconciliation,
    // not just an in-memory drop). A subsequent SW wake stays clean.
    const persistedAfter = mock.chrome.storage.session._dump()[fresh.FSB_AGENT_REGISTRY_STORAGE_KEY];
    assert.ok(persistedAfter && persistedAfter.records, 'envelope still present');
    assert.ok(!(g1 in persistedAfter.records), 'g1 pruned from storage');
    assert.ok(!(g2 in persistedAfter.records), 'g2 pruned from storage');
    assert.ok(a1 in persistedAfter.records, 'a1 retained in storage');
    assert.ok(a2 in persistedAfter.records, 'a2 retained in storage');
    assert.ok(a3 in persistedAfter.records, 'a3 retained in storage');
  } finally {
    teardownDiagnosticCapture();
    mock.restore();
  }
});

// =============================================================================
// Case 5: 20 concurrent claims under cap=8 -> exactly 8 successes + 12 rejects
// =============================================================================
test('test_case_5_twenty_concurrent_claim_stress', async () => {
  const mock = installChromeMock({ tabs: [] });
  setupDiagnosticCapture();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);

    const promises = [];
    for (let i = 0; i < 20; i++) promises.push(reg.registerAgent());
    const results = await Promise.all(promises);

    const successes = results.filter(function(r) { return r && r.agentId && !r.code; });
    const rejections = results.filter(function(r) { return r && r.code === 'AGENT_CAP_REACHED'; });

    assert.strictEqual(successes.length, 8, 'exactly 8 successes under cap=8');
    assert.strictEqual(rejections.length, 12, 'exactly 12 AGENT_CAP_REACHED rejections');

    // Each rejection carries the typed contract.
    rejections.forEach(function(r) {
      assert.strictEqual(r.code, 'AGENT_CAP_REACHED', 'reject code AGENT_CAP_REACHED');
      assert.strictEqual(r.cap, 8, 'reject cap === 8');
      assert.strictEqual(r.active, 8, 'reject active === 8');
    });

    // The 8 successes all have unique agentIds.
    const idSet = new Set(successes.map(function(s) { return s.agentId; }));
    assert.strictEqual(idSet.size, 8, '8 successes have 8 distinct agentIds');

    // All 8 are present in _agents (proves withRegistryLock atomic-cap-check).
    successes.forEach(function(s) {
      assert.strictEqual(reg._agents.has(s.agentId), true,
        'success agent ' + s.agentId + ' present in _agents');
    });
  } finally {
    teardownDiagnosticCapture();
    mock.restore();
  }
});

// =============================================================================
// Case 6: Tab-ID reuse race -- agent A's stale token cannot corrupt agent B
// =============================================================================
test('test_case_6_tab_id_reuse_race_does_not_corrupt_b', async () => {
  // chrome.tabs.get must resolve for both bindTab calls -- tab 1001 exists
  // before A binds, gets closed (Chrome OS-assigned id is freed), and is
  // re-created with the same integer id when B opens a new tab. The mock's
  // tabs list stays { id: 1001 } across both binds; the registry treats the
  // close+reopen as a fresh ownership stamp via per-bindTab tokens.
  const tabFixtures = [{ id: 1001, incognito: false, windowId: 1 }];
  const mock = installChromeMock({ tabs: tabFixtures });
  setupDiagnosticCapture();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);

    // Register two agents under the cap.
    const regA = await reg.registerAgent();
    const regB = await reg.registerAgent();
    assert.ok(regA && regA.agentId, 'agent A registered');
    assert.ok(regB && regB.agentId, 'agent B registered');
    const agentA = regA.agentId;
    const agentB = regB.agentId;

    // bindTab(A, 1001) -> tokA. Phase 240 D-04 requires ownershipToken on the
    // bind result; if absent, this assertion fails LOUDLY and we do NOT
    // mutate the registry to make it pass (out of scope for Phase 244).
    const bindA = await reg.bindTab(agentA, 1001);
    assert.ok(bindA && typeof bindA === 'object',
      'bindTab(A, 1001) returns an object (not boolean false)');
    assert.ok(bindA.ownershipToken,
      'bindTab(A, 1001) returns a non-empty ownershipToken (Phase 240 D-04 contract)');
    const tokA = bindA.ownershipToken;

    // Recycle: Chrome closed tab 1001. The recycleTabId helper releases the
    // binding (idempotent) and returns a thunk for the second bind plus the
    // prior token for cross-check.
    const recycle = await recycleTabId(reg, 1001);
    assert.strictEqual(recycle.priorToken, tokA,
      'recycle helper observed the prior ownershipToken');

    // releaseTab wipes per-tab metadata (Phase 240 Pitfall 2) AND the agent
    // record itself if its pool drained to zero (Phase 241 D-10). agentA
    // had only this one tab, so it should be gone now -- verify so the
    // race scenario is faithfully modeled.
    assert.strictEqual(reg._agents.has(agentA), false,
      'agentA released after its only tab closed (Phase 241 D-10 pool-drain)');

    // Re-register A so we can test the stale-token-from-A path. (In the real
    // race scenario A's queued action carries tokA even though A is gone;
    // we model this by keeping tokA referenced in the test scope.)
    // We do NOT need to re-register A for the assertion to be meaningful --
    // isOwnedBy returns false on unknown agents, and the (B, tokA) cross-token
    // case is the load-bearing assertion.

    // bindTab(B, 1001) -> tokB. Per Phase 240 D-04, bindTab mints a fresh
    // ownership_token unconditionally so tokA cannot match the new metadata.
    const bindB = await recycle.rebind(agentB);
    assert.ok(bindB && typeof bindB === 'object',
      'rebind(B, 1001) returns an object');
    assert.ok(bindB.ownershipToken,
      'rebind(B, 1001) returns a fresh ownershipToken');
    const tokB = bindB.ownershipToken;

    assert.notStrictEqual(tokA, tokB,
      'tokA !== tokB -- per-bindTab fresh ownership_token (Phase 240 D-04)');

    // Four isOwnedBy permutations exercise the per-bindTab token gate.
    // The (agentB, tokA) cross-token case is the load-bearing assertion: even
    // though B legitimately owns 1001 now, A's queued action carrying tokA
    // CANNOT pass the dispatch gate.
    assert.strictEqual(reg.isOwnedBy(1001, agentA, tokA), false,
      'A + tokA: stale -- the tab no longer belongs to A');
    assert.strictEqual(reg.isOwnedBy(1001, agentA, tokB), false,
      'A + tokB: agentA does not own the tab regardless of token');
    assert.strictEqual(reg.isOwnedBy(1001, agentB, tokA), false,
      'B + tokA: B owns the tab but tokA is not the live token (the corruption gate)');
    assert.strictEqual(reg.isOwnedBy(1001, agentB, tokB), true,
      'B + tokB: the only authorized pair');

    // Phase 237 token-less back-compat path (omit ownershipToken arg): pair-only
    // ownership says B owns it, A does not.
    assert.strictEqual(reg.isOwnedBy(1001, agentB), true,
      'B owns 1001 in the token-less back-compat path');
    assert.strictEqual(reg.isOwnedBy(1001, agentA), false,
      'A does not own 1001 in the token-less back-compat path');
  } finally {
    teardownDiagnosticCapture();
    mock.restore();
  }
});

// =============================================================================
// Test runner
// =============================================================================
(async () => {
  let failed = 0;
  for (const c of cases) {
    try {
      await c.fn();
      console.log('PASS', c.name);
    } catch (e) {
      failed++;
      console.error('FAIL', c.name, e && e.message, e && e.stack);
    }
  }
  console.log('\n' + (cases.length - failed) + '/' + cases.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
