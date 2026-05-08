'use strict';

/**
 * Phase 241 plan 01 task 1 -- agent cap enforcement (POOL-02 / D-03 / D-04).
 *
 * Validates:
 *   - 20-concurrent registerAgent under cap=8 produces exactly 8 successes
 *     and 12 typed AGENT_CAP_REACHED rejections (D-03 atomic cap-check inside
 *     withRegistryLock).
 *   - Default cap is 8 immediately after construction (no setCap call).
 *   - setCap clamping: 0 -> 1, 100 -> 64, NaN -> default 8, 3.7 -> 3.
 *   - Each cap rejection emits a LOG-04 diagnostic with category
 *     'agent-cap-reached' (D-04).
 *
 * Run: node tests/agent-cap.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

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

(async () => {
  console.log('--- Test 1: 20-concurrent registerAgent under cap=8 (POOL-02) ---');
  {
    const fresh = freshRequireRegistry();
    const captured = setupDiagnosticCapture();
    try {
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      const promises = [];
      for (let i = 0; i < 20; i++) promises.push(reg.registerAgent());
      const results = await Promise.all(promises);

      const successes = results.filter(r => r && r.agentId && !r.code);
      const rejections = results.filter(r => r && r.code === 'AGENT_CAP_REACHED');

      assert.strictEqual(successes.length, 8, 'exactly 8 should succeed under cap=8');
      assert.strictEqual(rejections.length, 12, 'exactly 12 should reject');
      rejections.forEach(r => {
        assert.strictEqual(r.code, 'AGENT_CAP_REACHED', 'rejection has code AGENT_CAP_REACHED');
        assert.strictEqual(r.error, 'AGENT_CAP_REACHED', 'rejection has error AGENT_CAP_REACHED');
        assert.strictEqual(r.cap, 8, 'rejection cap === 8');
        assert.strictEqual(r.active, 8, 'rejection active === 8');
      });

      // Test 4 (D-04 LOG-04 emission): at least one capture has agent-cap-reached
      const capReachedEvents = captured.filter(c => c.category === 'agent-cap-reached');
      assert.ok(capReachedEvents.length >= 1, 'at least one agent-cap-reached event emitted');
    } finally {
      teardownDiagnosticCapture();
    }
  }
  console.log('  PASS: 20-concurrent cap invariant + AGENT_CAP_REACHED shape + LOG-04 emission');

  console.log('--- Test 2: default cap is 8 immediately after construction ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    assert.strictEqual(reg.getCap(), 8, 'default cap is 8');
  }
  console.log('  PASS: default cap is 8');

  console.log('--- Test 3: setCap clamping (0 -> 1, 100 -> 64, NaN -> 8, 3.7 -> 3) ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();

    reg.setCap(0);
    assert.strictEqual(reg.getCap(), 1, 'setCap(0) clamps to 1');

    reg.setCap(100);
    assert.strictEqual(reg.getCap(), 64, 'setCap(100) clamps to 64');

    reg.setCap(NaN);
    assert.strictEqual(reg.getCap(), 8, 'setCap(NaN) reverts to default 8');

    reg.setCap(3.7);
    assert.strictEqual(reg.getCap(), 3, 'setCap(3.7) floors to 3');

    reg.setCap('not-a-number');
    assert.strictEqual(reg.getCap(), 8, 'setCap(string) reverts to default 8');

    reg.setCap(-5);
    assert.strictEqual(reg.getCap(), 1, 'setCap(-5) clamps to MIN=1');
  }
  console.log('  PASS: setCap clamping covers all edge cases');

  console.log('--- Test 5: canAcceptNewAgent() reflects cap headroom ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(2);
    assert.strictEqual(reg.canAcceptNewAgent(), true, 'empty registry under cap=2 accepts');
    await reg.registerAgent();
    assert.strictEqual(reg.canAcceptNewAgent(), true, 'one agent under cap=2 still accepts');
    await reg.registerAgent();
    assert.strictEqual(reg.canAcceptNewAgent(), false, 'two agents under cap=2 rejects');
  }
  console.log('  PASS: canAcceptNewAgent reflects pool size vs cap');

  console.log('PASS agent-cap');
})().catch(err => {
  console.error('FAIL agent-cap:', err && err.stack || err);
  process.exit(1);
});
