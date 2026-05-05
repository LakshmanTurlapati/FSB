'use strict';

/**
 * Phase 237 plan 01 -- agent registry CRUD + helpers + mutex.
 *
 * Validates:
 *   - Module export shape (constants + class + helpers)
 *   - formatAgentIdForDisplay (D-02 canonical 6-char prefix helper)
 *   - registerAgent ID minting (AGENT-01: caller-supplied ids ignored)
 *   - Multi-agent independence (AGENT-04 data-structural)
 *   - 20-concurrent-claim mutex serialization (TOCTOU groundwork for Phase 241)
 *   - In-memory CRUD (bindTab / releaseTab / isOwnedBy / getOwner / getAgentTabs)
 *   - releaseTab idempotency (Pitfall 6)
 *   - releaseAgent removes agent and all bound tabs
 *
 * Storage round-trip and hydrate reconciliation are covered in plan 02.
 *
 * Run: node tests/agent-registry.test.js
 */

const assert = require('assert');
const reg = require('../extension/utils/agent-registry.js');
const {
  AgentRegistry,
  formatAgentIdForDisplay,
  withRegistryLock,
  FSB_AGENT_REGISTRY_STORAGE_KEY,
  FSB_AGENT_REGISTRY_PAYLOAD_VERSION,
  FSB_AGENT_LOG_PREFIX,
  FSB_AGENT_ID_PREFIX
} = reg;

// ---- helpers ---------------------------------------------------------------

function freshRegistry() {
  const registry = new AgentRegistry();
  if (typeof registry._resetForTests === 'function') {
    registry._resetForTests();
  }
  return registry;
}

const UUID_PATTERN = /^agent_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---- main ------------------------------------------------------------------

(async () => {
  console.log('--- Module exports ---');
  assert.strictEqual(typeof AgentRegistry, 'function', 'AgentRegistry is a constructor');
  assert.strictEqual(typeof formatAgentIdForDisplay, 'function', 'formatAgentIdForDisplay is a function');
  assert.strictEqual(typeof withRegistryLock, 'function', 'withRegistryLock is a function');
  assert.strictEqual(FSB_AGENT_REGISTRY_STORAGE_KEY, 'fsbAgentRegistry', 'storage key is fsbAgentRegistry');
  assert.strictEqual(FSB_AGENT_REGISTRY_PAYLOAD_VERSION, 1, 'payload version is 1');
  assert.strictEqual(FSB_AGENT_LOG_PREFIX, 'AGT', 'log prefix is AGT');
  assert.strictEqual(FSB_AGENT_ID_PREFIX, 'agent_', 'id prefix is agent_');
  console.log('  PASS: module exports verified');

  console.log('--- formatAgentIdForDisplay returns 6-char prefix (D-02 canonical) ---');
  assert.strictEqual(
    formatAgentIdForDisplay('agent_550e8400-e29b-41d4-a716-446655440000'),
    'agent_550e84',
    'full uuid -> first 6 hex'
  );
  assert.strictEqual(
    formatAgentIdForDisplay('agent_abcdef12-3456-7890-abcd-ef1234567890'),
    'agent_abcdef',
    'second uuid -> first 6 hex'
  );
  assert.strictEqual(formatAgentIdForDisplay(''), '', 'empty string -> empty');
  assert.strictEqual(formatAgentIdForDisplay(null), '', 'null -> empty');
  assert.strictEqual(formatAgentIdForDisplay(undefined), '', 'undefined -> empty');
  assert.strictEqual(formatAgentIdForDisplay(12345), '', 'number -> empty');
  assert.strictEqual(formatAgentIdForDisplay({}), '', 'object -> empty');
  assert.strictEqual(formatAgentIdForDisplay([]), '', 'array -> empty');
  assert.strictEqual(
    formatAgentIdForDisplay('not-prefixed-uuid'),
    '',
    'no agent_ prefix -> empty'
  );
  assert.strictEqual(
    formatAgentIdForDisplay('agent_abc'),
    'agent_abc',
    'short input -> slice without padding'
  );
  assert.strictEqual(
    formatAgentIdForDisplay('agent_'),
    'agent_',
    'bare prefix -> bare prefix'
  );
  console.log('  PASS: formatAgentIdForDisplay handles valid + invalid inputs');

  console.log('--- registerAgent ignores caller-supplied agent_id (AGENT-01) ---');
  {
    const registry = freshRegistry();
    const r1 = await registry.registerAgent({ agent_id: 'agent_pre-supplied' });
    assert.notStrictEqual(r1.agentId, 'agent_pre-supplied', 'caller-supplied agent_id ignored');
    assert.ok(r1.agentId.startsWith('agent_'), 'agentId starts with agent_');
    assert.ok(UUID_PATTERN.test(r1.agentId), 'agentId is agent_<rfc4122-v4>');
    assert.strictEqual(
      r1.agentIdShort,
      formatAgentIdForDisplay(r1.agentId),
      'agentIdShort matches formatAgentIdForDisplay output'
    );
    assert.strictEqual(
      r1.agentIdShort.length,
      'agent_'.length + 6,
      'agentIdShort is exactly 6 hex chars after the agent_ prefix'
    );

    // Even with no opts at all, minting works.
    const r2 = await registry.registerAgent();
    assert.ok(UUID_PATTERN.test(r2.agentId), 'no-opts call mints valid agentId');
    assert.notStrictEqual(r2.agentId, r1.agentId, 'second call mints a distinct id');

    // Even with arbitrary garbage, opts are ignored.
    const r3 = await registry.registerAgent({ agentId: 'evil', tabIds: [1, 2, 3] });
    assert.ok(UUID_PATTERN.test(r3.agentId), 'garbage opts produce valid agentId');
    assert.notStrictEqual(r3.agentId, 'evil', 'agentId field on opts ignored');
  }
  console.log('  PASS: registerAgent always mints fresh crypto.randomUUID, ignores caller input');

  console.log('--- Multiple agents coexist independently (AGENT-04) ---');
  {
    const registry = freshRegistry();
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const r = await registry.registerAgent();
      ids.push(r.agentId);
    }
    assert.strictEqual(new Set(ids).size, 5, 'all 5 agentIds distinct');
    assert.strictEqual(registry.listAgents().length, 5, 'listAgents reports 5 agents');

    // Release one; the others remain.
    const released = registry.releaseAgent(ids[2], 'test');
    // releaseAgent is gated by the mutex; await
    const releaseResult = (released && typeof released.then === 'function')
      ? await released
      : released;
    assert.strictEqual(releaseResult, true, 'releaseAgent returns true on existing id');
    assert.strictEqual(registry.listAgents().length, 4, 'one fewer agent after release');
    assert.ok(
      registry.listAgents().every(record => record.agentId !== ids[2]),
      'released agent no longer in listAgents'
    );

    // Other agents still present and untouched.
    for (let i = 0; i < 5; i++) {
      if (i === 2) continue;
      assert.ok(
        registry.listAgents().some(record => record.agentId === ids[i]),
        'sibling agent ' + i + ' still present'
      );
    }
  }
  console.log('  PASS: 5 agents register and release independently');

  console.log('--- 20-concurrent registerAgent mutex serialization stress ---');
  {
    const registry = freshRegistry();
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(registry.registerAgent({}));
    }
    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 20, '20 registrations resolved');
    const seen = new Set();
    for (const r of results) {
      assert.ok(UUID_PATTERN.test(r.agentId), 'concurrent agentId valid: ' + r.agentId);
      seen.add(r.agentId);
    }
    assert.strictEqual(seen.size, 20, 'no agentId collisions across 20 concurrent claims');
    assert.strictEqual(registry.listAgents().length, 20, '_agents.size === 20 (mutex held)');
  }
  console.log('  PASS: 20 concurrent registerAgent calls all distinct, no silent drops');

  console.log('--- In-memory CRUD: bindTab / releaseTab / isOwnedBy / getOwner / getAgentTabs ---');
  {
    const registry = freshRegistry();
    const r = await registry.registerAgent();
    const A = r.agentId;

    // bindTab is gated by withRegistryLock; methods may return promises.
    const b1 = registry.bindTab(A, 100);
    const b1Result = (b1 && typeof b1.then === 'function') ? await b1 : b1;
    assert.strictEqual(b1Result, true, 'bindTab(A, 100) returns true');

    const b2 = registry.bindTab(A, 200);
    const b2Result = (b2 && typeof b2.then === 'function') ? await b2 : b2;
    assert.strictEqual(b2Result, true, 'bindTab(A, 200) returns true');

    assert.strictEqual(registry.isOwnedBy(100, A), true, 'isOwnedBy(100, A) === true');
    assert.strictEqual(
      registry.isOwnedBy(100, 'agent_other'),
      false,
      'isOwnedBy(100, other) === false'
    );
    assert.strictEqual(registry.getOwner(100), A, 'getOwner(100) === A');
    assert.strictEqual(registry.getOwner(999), null, 'getOwner(unowned) === null');

    const tabs = registry.getAgentTabs(A);
    assert.ok(Array.isArray(tabs), 'getAgentTabs returns an array');
    assert.strictEqual(tabs.length, 2, 'agent A owns 2 tabs');
    assert.ok(tabs.includes(100) && tabs.includes(200), 'agent A owns 100 and 200');

    // bindTab on unknown agent -> false (no throw)
    const bGhost = registry.bindTab('agent_does-not-exist', 300);
    const bGhostResult = (bGhost && typeof bGhost.then === 'function') ? await bGhost : bGhost;
    assert.strictEqual(bGhostResult, false, 'bindTab on unknown agent returns false');

    // bindTab with invalid tabId -> false
    const bBad = registry.bindTab(A, -1);
    const bBadResult = (bBad && typeof bBad.then === 'function') ? await bBad : bBad;
    assert.strictEqual(bBadResult, false, 'bindTab with invalid tabId returns false');

    // releaseTab(100) removes binding
    const rel1 = registry.releaseTab(100);
    const rel1Result = (rel1 && typeof rel1.then === 'function') ? await rel1 : rel1;
    assert.strictEqual(rel1Result, true, 'releaseTab(100) returns true');
    assert.strictEqual(registry.getOwner(100), null, 'after releaseTab(100), getOwner(100) === null');
    const tabsAfter = registry.getAgentTabs(A);
    assert.strictEqual(tabsAfter.length, 1, 'agent A now owns 1 tab');
    assert.strictEqual(tabsAfter[0], 200, 'remaining tab is 200');
  }
  console.log('  PASS: bindTab / releaseTab / isOwnedBy / getOwner / getAgentTabs in-memory CRUD');

  console.log('--- releaseTab is idempotent (Pitfall 6) ---');
  {
    const registry = freshRegistry();
    const r = await registry.registerAgent();
    const A = r.agentId;
    const b1 = registry.bindTab(A, 100);
    if (b1 && typeof b1.then === 'function') await b1;

    const first = registry.releaseTab(100);
    const firstResult = (first && typeof first.then === 'function') ? await first : first;
    assert.strictEqual(firstResult, true, 'first releaseTab(100) returns true');

    let secondThrew = false;
    let second;
    try {
      second = registry.releaseTab(100);
      if (second && typeof second.then === 'function') second = await second;
    } catch (err) {
      secondThrew = true;
    }
    assert.strictEqual(secondThrew, false, 'second releaseTab(100) does not throw');
    assert.strictEqual(second, false, 'second releaseTab(100) returns false (no-op)');

    let neverThrew = false;
    let never;
    try {
      never = registry.releaseTab(99999);
      if (never && typeof never.then === 'function') never = await never;
    } catch (err) {
      neverThrew = true;
    }
    assert.strictEqual(neverThrew, false, 'releaseTab on never-owned tab does not throw');
    assert.strictEqual(never, false, 'releaseTab on never-owned tab returns false');
  }
  console.log('  PASS: releaseTab idempotent; double-call and never-owned are silent no-ops');

  console.log('--- releaseAgent removes agent and all bound tabs ---');
  {
    const registry = freshRegistry();
    const r = await registry.registerAgent();
    const A = r.agentId;

    for (const tabId of [100, 200, 300]) {
      const b = registry.bindTab(A, tabId);
      if (b && typeof b.then === 'function') await b;
    }
    assert.strictEqual(registry.getAgentTabs(A).length, 3, 'A owns 3 tabs before release');

    const rel = registry.releaseAgent(A, 'test');
    const relResult = (rel && typeof rel.then === 'function') ? await rel : rel;
    assert.strictEqual(relResult, true, 'releaseAgent returns true on existing agent');

    assert.ok(
      registry.listAgents().every(record => record.agentId !== A),
      'released agent removed from listAgents'
    );
    assert.strictEqual(registry.getOwner(100), null, 'tab 100 unowned after agent release');
    assert.strictEqual(registry.getOwner(200), null, 'tab 200 unowned after agent release');
    assert.strictEqual(registry.getOwner(300), null, 'tab 300 unowned after agent release');

    const ghostTabs = registry.getAgentTabs(A);
    assert.ok(
      ghostTabs === null || (Array.isArray(ghostTabs) && ghostTabs.length === 0),
      'getAgentTabs on released agent returns null or empty array'
    );

    // releaseAgent on unknown agent -> false (no throw)
    const ghost = registry.releaseAgent('agent_does-not-exist', 'test');
    const ghostResult = (ghost && typeof ghost.then === 'function') ? await ghost : ghost;
    assert.strictEqual(ghostResult, false, 'releaseAgent on unknown agent returns false');
  }
  console.log('  PASS: releaseAgent reaps agent and all tab bindings');

  console.log('--- listAgents returns shallow clones (caller cannot corrupt internal state) ---');
  {
    const registry = freshRegistry();
    const r = await registry.registerAgent();
    const before = registry.listAgents();
    assert.strictEqual(before.length, 1, 'listAgents returns one record');
    // Mutate the returned record.
    before[0].agentId = 'agent_corrupted';
    before[0].tabIds.push(99999);
    const after = registry.listAgents();
    assert.strictEqual(after[0].agentId, r.agentId, 'internal agentId not mutated');
    assert.strictEqual(after[0].tabIds.length, 0, 'internal tabIds not mutated');
  }
  console.log('  PASS: listAgents returns defensive clones');

  console.log('--- hydrate / _persist are stubbed (plan 02 wires storage) ---');
  {
    const registry = freshRegistry();
    assert.strictEqual(typeof registry.hydrate, 'function', 'hydrate exists');
    assert.strictEqual(typeof registry._persist, 'function', '_persist exists');
    const hyd = registry.hydrate();
    assert.ok(hyd && typeof hyd.then === 'function', 'hydrate returns a promise');
    await hyd;
    const per = registry._persist();
    assert.ok(per && typeof per.then === 'function', '_persist returns a promise');
    await per;
  }
  console.log('  PASS: hydrate and _persist stubs return resolved promises');

  console.log('\nAll assertions passed.');
})().catch((err) => {
  console.error('TEST FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
