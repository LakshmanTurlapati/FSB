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
// Case 4: SW eviction + wake reconciliation drops ghost records (stub -- task 3)
// =============================================================================
test('test_case_4_sw_eviction_wake_reconciliation_drops_ghost_records', async () => {
  throw new Error('TBD task 3');
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
// Case 6: Tab-ID reuse race -- agent A's stale token cannot corrupt agent B (stub -- task 3)
// =============================================================================
test('test_case_6_tab_id_reuse_race_does_not_corrupt_b', async () => {
  throw new Error('TBD task 3');
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
