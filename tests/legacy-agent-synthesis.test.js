'use strict';

/**
 * Phase 240 plan 03 -- Wave 0 RED scaffold for legacy:<surface> synthesis.
 *
 * Validates the three legacy-surface paths (popup, sidepanel, autopilot) per
 * D-02. The popup/sidepanel surfaces synthesize their constant agentIds via
 * a new chrome.runtime.sendMessage({action: 'ensureLegacyAgent', surface})
 * runtime action handler in background.js that delegates to Plan 01's
 * fsbAgentRegistryInstance.getOrRegisterLegacyAgent. The autopilot surface
 * is covered by handleStartAutomation's fallback when request.agentId is
 * absent.
 *
 * Tests the registry contract directly (the runtime action handler is a thin
 * adapter; its routing is exercised by the visual-session-reentry suite and
 * the regression smoke). The 7 cases below mirror the assertions Plan 03's
 * <done> criteria call out.
 *
 * Run: node tests/legacy-agent-synthesis.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

function createStorageArea(initial) {
  const store = Object.assign({}, initial || {});
  return {
    async get(keys) {
      if (keys == null) return Object.assign({}, store);
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys)
          ? { [keys]: store[keys] }
          : {};
      }
      return Object.assign({}, store);
    },
    async set(values) { Object.assign(store, values); },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((k) => { delete store[k]; });
    },
    _dump() { return Object.assign({}, store); }
  };
}

function createChromeTabsMock(initial) {
  let tabs = (initial || []).map((t) => Object.assign({}, t));
  return {
    async query() { return tabs.slice(); },
    async get(tabId) {
      const found = tabs.find((t) => t.id === tabId);
      if (!found) throw new Error('No tab with id: ' + tabId);
      return found;
    }
  };
}

function setupChromeMock() {
  const session = createStorageArea();
  const tabs = createChromeTabsMock([
    { id: 100, incognito: false, windowId: 10 },
    { id: 200, incognito: false, windowId: 10 },
    { id: 300, incognito: false, windowId: 20 }
  ]);
  globalThis.chrome = {
    runtime: { id: 'phase-240-test', lastError: null },
    storage: { session },
    tabs
  };
  return { session, tabs };
}

function teardownChromeMock() {
  delete globalThis.chrome;
}

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

// ---- Runtime-action adapter shim ------------------------------------------
//
// Plan 03 wires a 'ensureLegacyAgent' case in background.js's
// chrome.runtime.onMessage dispatcher. The handler shape is:
//
//   case 'ensureLegacyAgent': {
//     fsbAgentRegistryInstance.getOrRegisterLegacyAgent(surface)
//       .then(result => result.error
//         ? sendResponse({success: false, error: result.error, surface: result.surface})
//         : sendResponse({success: true, agentId: result.agentId, ownershipToken: result.ownershipToken || null}))
//       .catch(err => sendResponse({success: false, error: err.message || String(err)}));
//     return true;
//   }
//
// We re-implement the adapter inline so the test exercises the SAME shape
// the production handler returns, without booting background.js (which
// would pull in 200+ dependencies). The shim is intentionally thin so any
// drift between the test shape and the production handler is obvious.

function ensureLegacyAgentAdapter(registry, surface) {
  return registry.getOrRegisterLegacyAgent(surface).then(function(result) {
    if (result && result.error) {
      return { success: false, error: result.error, surface: result.surface || surface };
    }
    return {
      success: true,
      agentId: result.agentId,
      ownershipToken: (result && result.ownershipToken) || null
    };
  });
}

(async () => {
  console.log('--- Phase 240 / legacy-agent-synthesis / Test 1: popup surface synthesizes legacy:popup ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const resp = await ensureLegacyAgentAdapter(registry, 'popup');
      assert.strictEqual(resp.success, true, 'success: true');
      assert.strictEqual(resp.agentId, 'legacy:popup', 'agentId is constant legacy:popup');
      assert.strictEqual(resp.ownershipToken, null,
        'ownershipToken null at register time (per Plan 01 contract)');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: popup -> legacy:popup, ownershipToken null');

  console.log('--- Phase 240 / legacy-agent-synthesis / Test 2: sidepanel surface synthesizes legacy:sidepanel ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const resp = await ensureLegacyAgentAdapter(registry, 'sidepanel');
      assert.strictEqual(resp.success, true);
      assert.strictEqual(resp.agentId, 'legacy:sidepanel');
      assert.strictEqual(resp.ownershipToken, null);
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: sidepanel -> legacy:sidepanel');

  console.log('--- Phase 240 / legacy-agent-synthesis / Test 3: autopilot surface synthesizes legacy:autopilot ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const resp = await ensureLegacyAgentAdapter(registry, 'autopilot');
      assert.strictEqual(resp.success, true);
      assert.strictEqual(resp.agentId, 'legacy:autopilot');
      assert.strictEqual(resp.ownershipToken, null);
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: autopilot -> legacy:autopilot');

  console.log('--- Phase 240 / legacy-agent-synthesis / Test 4: idempotent across SW lifetime ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const r1 = await ensureLegacyAgentAdapter(registry, 'popup');
      const r2 = await ensureLegacyAgentAdapter(registry, 'popup');
      assert.strictEqual(r1.agentId, r2.agentId,
        'second call returns the SAME agentId (idempotent)');
      assert.strictEqual(registry.listAgents().length, 1,
        'registry holds exactly 1 record (no churn -- Pitfall 4 mitigation)');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: idempotent on repeat call; no record churn');

  console.log('--- Phase 240 / legacy-agent-synthesis / Test 5: cross-surface tab isolation ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const popup = await ensureLegacyAgentAdapter(registry, 'popup');
      const sp = await ensureLegacyAgentAdapter(registry, 'sidepanel');
      // Bind tab 100 under legacy:popup; assert legacy:sidepanel does NOT own it
      const bind = await registry.bindTab(popup.agentId, 100);
      assert.ok(bind && bind.ownershipToken, 'legacy:popup bindTab succeeded');
      assert.strictEqual(registry.isOwnedBy(100, popup.agentId), true,
        'legacy:popup owns tab 100');
      assert.strictEqual(registry.isOwnedBy(100, sp.agentId), false,
        'legacy:sidepanel does NOT own tab 100 (cross-surface isolation)');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: cross-surface isolation -- popup tabs not visible to sidepanel');

  console.log('--- Phase 240 / legacy-agent-synthesis / Test 6: unknown surface rejected ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const resp = await ensureLegacyAgentAdapter(registry, 'options');
      assert.strictEqual(resp.success, false, 'unknown surface returns success: false');
      assert.strictEqual(resp.error, 'unknown_legacy_surface',
        'error code propagates from registry');
      assert.strictEqual(resp.surface, 'options', 'surface echoed back for diagnostics');
      assert.strictEqual(registry.listAgents().length, 0,
        'no agent created for unknown surface');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: unknown surface rejected with typed error');

  console.log('--- Phase 240 / legacy-agent-synthesis / Test 7: handleStartAutomation autopilot fallback ---');
  {
    // This test simulates the D-08 4th site fallback: when request.agentId is
    // undefined, handleStartAutomation calls getOrRegisterLegacyAgent('autopilot')
    // and bindTabs the resolved agent. The fallback must (a) return a valid
    // agentId, (b) bindTab returns a fresh ownershipToken, (c) the resulting
    // tab is owned by legacy:autopilot.
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      // Simulate handleStartAutomation's fallback path
      let resolvedAgentId = undefined; // request.agentId not supplied
      if (!resolvedAgentId) {
        const fallback = await registry.getOrRegisterLegacyAgent('autopilot');
        resolvedAgentId = fallback && fallback.agentId;
      }
      assert.strictEqual(resolvedAgentId, 'legacy:autopilot',
        'fallback resolves to legacy:autopilot');
      const targetTabId = 200;
      const bindResult = await registry.bindTab(resolvedAgentId, targetTabId);
      assert.ok(bindResult && bindResult.ownershipToken,
        'bindTab returns fresh ownershipToken');
      assert.strictEqual(registry.isOwnedBy(targetTabId, resolvedAgentId), true,
        'tab is now owned by legacy:autopilot');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: handleStartAutomation autopilot fallback wires bindTab');

  console.log('\nAll Phase 240 legacy-agent-synthesis assertions passed.');
})().catch((err) => {
  console.error('TEST FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
