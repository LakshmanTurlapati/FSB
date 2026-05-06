'use strict';

/**
 * Phase 241 plan 01 task 2 -- pool-shrink + findAgentByTabId + stampConnectionId
 * (POOL-04 / D-01 / D-10 / A2 scope addition).
 *
 * Validates:
 *   - releaseTab decrements pool; agent record only deleted when pool.size === 0.
 *   - releaseTab is idempotent after agent record is gone (returns false).
 *   - findAgentByTabId synchronous reverse lookup.
 *   - Multi-agent isolation under pool shrink.
 *   - stampConnectionId persistence on the agent record.
 *   - LOCK-04 negative smoke: registry init does not schedule setInterval.
 *
 * Run: node tests/agent-pool-shrink.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

(async () => {
  console.log('--- Test 1: releaseTab releases agent record only when pool drains to 0 (POOL-04) ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const A = (await reg.registerAgent()).agentId;
    await reg.bindTab(A, 100);
    await reg.bindTab(A, 101);
    await reg.bindTab(A, 102);
    assert.strictEqual(reg._tabsByAgent.get(A).size, 3, 'A has 3 tabs');

    const r1 = await reg.releaseTab(100);
    assert.strictEqual(r1, true, 'releaseTab(100) returns true');
    assert.ok(reg._agents.has(A), 'A still in _agents after first release');
    assert.strictEqual(reg._tabsByAgent.get(A).size, 2, 'pool size === 2');

    const r2 = await reg.releaseTab(101);
    assert.strictEqual(r2, true, 'releaseTab(101) returns true');
    assert.ok(reg._agents.has(A), 'A still in _agents after second release');
    assert.strictEqual(reg._tabsByAgent.get(A).size, 1, 'pool size === 1');

    const r3 = await reg.releaseTab(102);
    assert.strictEqual(r3, true, 'releaseTab(102) returns true');
    assert.strictEqual(reg._agents.has(A), false, 'A NO LONGER in _agents (pool drained)');
    assert.strictEqual(reg._tabsByAgent.has(A), false, '_tabsByAgent[A] also gone');
  }
  console.log('  PASS: pool-shrink-to-zero releases the agent record');

  console.log('--- Test 2: releaseTab idempotent after agent release ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const A = (await reg.registerAgent()).agentId;
    await reg.bindTab(A, 102);
    await reg.releaseTab(102);

    // Now agent A is gone. Re-call releaseTab(102): no-op.
    const r = await reg.releaseTab(102);
    assert.strictEqual(r, false, 'second releaseTab(102) returns false');
    assert.strictEqual(reg._agents.has(A), false, 'A still absent');
  }
  console.log('  PASS: releaseTab idempotent after pool-drained release');

  console.log('--- Test 3: findAgentByTabId sync read (D-01) ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const A = (await reg.registerAgent()).agentId;
    await reg.bindTab(A, 200);

    assert.strictEqual(reg.findAgentByTabId(200), A, 'findAgentByTabId(200) === A');
    assert.strictEqual(reg.findAgentByTabId(99999), null, 'unknown tabId returns null');
    assert.strictEqual(reg.findAgentByTabId('not-a-number'), null, 'string returns null');
    assert.strictEqual(reg.findAgentByTabId(NaN), null, 'NaN returns null');
    assert.strictEqual(reg.findAgentByTabId(undefined), null, 'undefined returns null');
    assert.strictEqual(reg.findAgentByTabId(null), null, 'null returns null');

    await reg.releaseTab(200);
    assert.strictEqual(reg.findAgentByTabId(200), null, 'after releaseTab returns null');
  }
  console.log('  PASS: findAgentByTabId sync read covers valid + invalid inputs');

  console.log('--- Test 4: multi-agent isolation under pool shrink ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const A = (await reg.registerAgent()).agentId;
    const B = (await reg.registerAgent()).agentId;
    await reg.bindTab(A, 300);
    await reg.bindTab(B, 301);

    await reg.releaseTab(300);
    assert.strictEqual(reg._agents.has(A), false, 'A released (pool drained)');
    assert.strictEqual(reg._agents.has(B), true, 'B unaffected');
    assert.strictEqual(reg.findAgentByTabId(301), B, 'tab 301 still owned by B');
  }
  console.log('  PASS: multi-agent pool shrink isolates correctly');

  console.log('--- Test 5: stampConnectionId persists on agent record ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const A = (await reg.registerAgent()).agentId;

    const ok = reg.stampConnectionId(A, 'conn-X');
    assert.strictEqual(ok, true, 'stampConnectionId returns true on known agent');
    assert.strictEqual(reg._agents.get(A).connectionId, 'conn-X', 'record.connectionId === conn-X');

    // Unknown agent.
    const bad = reg.stampConnectionId('agent_does-not-exist', 'conn-Y');
    assert.strictEqual(bad, false, 'unknown agent returns false');

    // Non-string args.
    assert.strictEqual(reg.stampConnectionId(A, 123), false, 'non-string connectionId returns false');
    assert.strictEqual(reg.stampConnectionId(123, 'conn-X'), false, 'non-string agentId returns false');
  }
  console.log('  PASS: stampConnectionId stamps + handles invalid inputs');

  console.log('--- Test 6: LOCK-04 negative smoke (registry init schedules no setInterval) ---');
  {
    // Hook setInterval BEFORE constructing the registry to catch any
    // accidental idle reaper. Plan 03 owns the full negative coverage
    // (tests/agent-no-idle.test.js); this test is a registry-side guard.
    const intervalCalls = [];
    const originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = function() {
      intervalCalls.push(Array.from(arguments));
      return originalSetInterval.apply(this, arguments);
    };
    try {
      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      const A = (await reg.registerAgent()).agentId;
      await reg.bindTab(A, 400);
      // Quiet for 50ms - nothing should self-schedule.
      await new Promise((res) => setTimeout(res, 50));
      assert.strictEqual(intervalCalls.length, 0, 'no setInterval scheduled by registry');
      assert.ok(reg._agents.has(A), 'A still present after quiet period');
    } finally {
      globalThis.setInterval = originalSetInterval;
    }
  }
  console.log('  PASS: registry never calls setInterval');

  console.log('PASS pool-shrink');
})().catch(err => {
  console.error('FAIL pool-shrink:', err && err.stack || err);
  process.exit(1);
});
