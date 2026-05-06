'use strict';

/**
 * Phase 239 plan 02 -- chrome.storage.session task-store helper validation.
 *
 * Validates extension/utils/mcp-task-store.js mirrors the agent-registry.js
 * envelope shape and exposes the 5-function public API documented in
 * 239-CONTEXT.md D-03 / D-04 + 239-RESEARCH.md "Pattern 3".
 *
 * Wave 0 (RED): all 10 cases fail because the module does not yet exist.
 * Wave 1 (GREEN): all 10 cases pass once Task 1 lands.
 *
 * Run: node tests/mcp-task-store.test.js
 */

const assert = require('assert');
const path = require('path');
const harness = require('./fixtures/run-task-harness');

const STORE_MODULE_PATH = path.join(__dirname, '..', 'extension', 'utils', 'mcp-task-store.js');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => { passed++; console.log('  PASS:', name); })
    .catch((err) => {
      failed++;
      console.error('  FAIL:', name, '--', err && err.message ? err.message : err);
    });
}

function freshRequireStore() {
  // Drop module cache so the lazy globalThis.chrome reference resolves against
  // the most recently installed mock, not a captured one.
  try { delete require.cache[require.resolve(STORE_MODULE_PATH)]; } catch (_e) { /* not yet exists */ }
  return require(STORE_MODULE_PATH);
}

function makeSnapshot(overrides) {
  return Object.assign({
    task_id: 'task_abc',
    status: 'in_progress',
    started_at: 1000,
    last_heartbeat_at: 1000,
    originating_mcp_call_id: 'mcp_001',
    target_tab_id: 42,
    current_step: 0,
    ai_cycle_count: 0,
    last_dom_hash: null
  }, overrides || {});
}

(async () => {
  console.log('--- Phase 239 plan 02: mcp-task-store ---');

  await runTest('module_exports', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      assert.strictEqual(typeof mod.writeSnapshot, 'function', 'writeSnapshot is a function');
      assert.strictEqual(typeof mod.readSnapshot, 'function', 'readSnapshot is a function');
      assert.strictEqual(typeof mod.deleteSnapshot, 'function', 'deleteSnapshot is a function');
      assert.strictEqual(typeof mod.listInFlightSnapshots, 'function', 'listInFlightSnapshots is a function');
      assert.strictEqual(typeof mod.hydrate, 'function', 'hydrate is a function');
      assert.strictEqual(mod.FSB_RUN_TASK_REGISTRY_STORAGE_KEY, 'fsbRunTaskRegistry', 'storage key is fsbRunTaskRegistry');
      assert.strictEqual(mod.FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, 1, 'payload version is 1');
    } finally {
      mock.restore();
    }
  });

  await runTest('write_envelope_v1', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      const snap = makeSnapshot();
      await mod.writeSnapshot('task_abc', snap);
      const stored = await mock.chrome.storage.session.get(['fsbRunTaskRegistry']);
      assert.deepStrictEqual(stored, {
        fsbRunTaskRegistry: { v: 1, records: { task_abc: snap } }
      }, 'envelope is { v: 1, records: { task_abc: snapshot } }');
    } finally {
      mock.restore();
    }
  });

  await runTest('read_unknown_returns_null', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      const result = await mod.readSnapshot('nonexistent');
      assert.strictEqual(result, null, 'readSnapshot returns null for unknown task');
    } finally {
      mock.restore();
    }
  });

  await runTest('read_round_trip', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      const snap = makeSnapshot({ task_id: 'task_rt', current_step: 7 });
      await mod.writeSnapshot('task_rt', snap);
      const got = await mod.readSnapshot('task_rt');
      assert.deepStrictEqual(got, snap, 'readSnapshot round-trips written value');
    } finally {
      mock.restore();
    }
  });

  await runTest('list_in_flight', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      await mod.writeSnapshot('a', makeSnapshot({ task_id: 'a', status: 'in_progress' }));
      await mod.writeSnapshot('b', makeSnapshot({ task_id: 'b', status: 'complete' }));
      await mod.writeSnapshot('c', makeSnapshot({ task_id: 'c', status: 'partial' }));
      const inFlight = await mod.listInFlightSnapshots();
      assert.strictEqual(inFlight.length, 1, 'exactly one in-flight snapshot');
      assert.strictEqual(inFlight[0].task_id, 'a', 'in-flight snapshot is task a');
    } finally {
      mock.restore();
    }
  });

  await runTest('delete_snapshot_removes_key_when_empty', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      await mod.writeSnapshot('task_del', makeSnapshot({ task_id: 'task_del' }));
      await mod.deleteSnapshot('task_del');
      const stored = await mock.chrome.storage.session.get(['fsbRunTaskRegistry']);
      assert.deepStrictEqual(stored, {}, 'storage key removed when records map is empty');
    } finally {
      mock.restore();
    }
  });

  await runTest('delete_snapshot_keeps_key_when_others_exist', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      await mod.writeSnapshot('keep', makeSnapshot({ task_id: 'keep' }));
      await mod.writeSnapshot('drop', makeSnapshot({ task_id: 'drop' }));
      await mod.deleteSnapshot('drop');
      const stored = await mock.chrome.storage.session.get(['fsbRunTaskRegistry']);
      assert.ok(stored.fsbRunTaskRegistry, 'envelope still present');
      assert.deepStrictEqual(Object.keys(stored.fsbRunTaskRegistry.records), ['keep'], 'only keep remains');
    } finally {
      mock.restore();
    }
  });

  await runTest('hydrate_returns_records', async () => {
    const mock = harness.installChromeMock();
    try {
      const mod = freshRequireStore();
      await mod.writeSnapshot('one', makeSnapshot({ task_id: 'one' }));
      await mod.writeSnapshot('two', makeSnapshot({ task_id: 'two' }));
      const env = await mod.hydrate();
      assert.strictEqual(env.v, 1, 'envelope version is 1');
      assert.deepStrictEqual(Object.keys(env.records).sort(), ['one', 'two'], 'records keys are one + two');
    } finally {
      mock.restore();
    }
  });

  await runTest('version_mismatch_returns_empty', async () => {
    const mock = harness.installChromeMock({
      storage: { session: { fsbRunTaskRegistry: { v: 99, records: { bad: {} } } } }
    });
    try {
      const mod = freshRequireStore();
      const env = await mod.hydrate();
      assert.deepStrictEqual(env, { v: 1, records: {} }, 'wrong version returns canonical empty envelope');
    } finally {
      mock.restore();
    }
  });

  await runTest('chrome_unavailable_no_throw', async () => {
    // Ensure chrome is NOT installed
    const prior = globalThis.chrome;
    delete globalThis.chrome;
    try {
      const mod = freshRequireStore();
      // Best-effort posture: must not throw
      await mod.writeSnapshot('x', { task_id: 'x', status: 'in_progress' });
      const got = await mod.readSnapshot('x');
      assert.strictEqual(got, null, 'readSnapshot returns null with no chrome');
    } finally {
      if (prior !== undefined) globalThis.chrome = prior;
    }
  });

  console.log('\n--- Phase 239 plan 02 mcp-task-store summary ---');
  console.log('  passed:', passed);
  console.log('  failed:', failed);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
