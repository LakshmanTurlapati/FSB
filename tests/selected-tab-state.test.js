'use strict';

/**
 * No-focus multi-tab selection state.
 *
 * Run: node tests/selected-tab-state.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');
const {
  simulateSwEviction,
  installChromeMock
} = require('./fixtures/multi-agent-regression-helpers.js');

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('bindTab selects the latest bound tab', async () => {
  const chromeMock = installChromeMock({ tabs: [{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }] });
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    const a = await reg.registerAgent();

    await reg.bindTab(a.agentId, 10);
    assert.strictEqual(reg.getSelectedTabId(a.agentId), 10, 'first bind selects tab 10');

    await reg.bindTab(a.agentId, 11);
    assert.strictEqual(reg.getSelectedTabId(a.agentId), 11, 'second bind selects tab 11');
    assert.deepStrictEqual(reg.getAgentTabs(a.agentId).sort((x, y) => x - y), [10, 11], 'agent owns both tabs');
  } finally {
    chromeMock.restore();
  }
});

test('releaseTab adjusts selectedTabId when selected tab is released', async () => {
  const chromeMock = installChromeMock({ tabs: [{ id: 20, windowId: 1 }, { id: 21, windowId: 1 }] });
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    const a = await reg.registerAgent();

    await reg.bindTab(a.agentId, 20);
    await reg.bindTab(a.agentId, 21);
    assert.strictEqual(reg.getSelectedTabId(a.agentId), 21, 'tab 21 selected before release');

    await reg.releaseTab(21);
    assert.strictEqual(reg.getSelectedTabId(a.agentId), 20, 'selection falls back to remaining owned tab');

    await reg.releaseTab(20);
    assert.strictEqual(reg.getSelectedTabId(a.agentId), null, 'selection clears when agent pool drains');
  } finally {
    chromeMock.restore();
  }
});

test('hydrate restores valid selectedTabId', async () => {
  const chromeMock = installChromeMock({ tabs: [{ id: 30, windowId: 1 }, { id: 31, windowId: 1 }] });
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    const a = await reg.registerAgent();

    await reg.bindTab(a.agentId, 30);
    await reg.bindTab(a.agentId, 31);
    simulateSwEviction(reg);
    await reg.hydrate();

    assert.strictEqual(reg.getSelectedTabId(a.agentId), 31, 'selected tab survives storage round-trip');
    assert.deepStrictEqual(reg.getAgentTabs(a.agentId).sort((x, y) => x - y), [30, 31], 'owned tabs survive hydrate');
  } finally {
    chromeMock.restore();
  }
});

test('hydrate clears ghost selectedTabId while preserving live owned tabs', async () => {
  const agentId = 'agent_11111111-1111-1111-1111-111111111111';
  const envelope = {
    v: 1,
    records: {
      [agentId]: {
        agentId,
        createdAt: 1000,
        tabIds: [40, 99],
        selectedTabId: 99
      }
    }
  };
  const chromeMock = installChromeMock({
    tabs: [{ id: 40, windowId: 1 }],
    storage: { session: { fsbAgentRegistry: envelope } }
  });
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    await reg.hydrate();

    assert.deepStrictEqual(reg.getAgentTabs(agentId), [40], 'ghost tab was reaped');
    assert.strictEqual(reg.getSelectedTabId(agentId), null, 'ghost selected tab was not restored');
  } finally {
    chromeMock.restore();
  }
});

(async () => {
  let passed = 0;
  for (const t of tests) {
    await t.fn();
    passed += 1;
    console.log('PASS ' + t.name);
  }
  console.log('\n' + passed + '/' + tests.length + ' passed');
})().catch((err) => {
  console.error('FAIL', err && err.stack ? err.stack : err);
  process.exit(1);
});
