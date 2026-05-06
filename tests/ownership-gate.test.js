'use strict';

/**
 * Phase 240 plan 01 -- Wave 0 RED scaffold for the dispatch ownership gate.
 *
 * This file exercises the registry-contract surface the gate (Plan 02) reads:
 *
 *   - bindTab returns { agentId, tabId, ownershipToken } shape (D-04)
 *   - ownershipToken is a fresh crypto.randomUUID() per bindTab call
 *   - rebind on the same (agent, tab) mints a NEW token (not idempotent on token)
 *   - isOwnedBy(tabId, agentId, ownershipToken) verifies all three
 *   - isOwnedBy(tabId, agentId) without token preserves Phase 237 backward-compat
 *   - getTabMetadata(tabId) returns { ownershipToken, incognito, windowId, boundAt }
 *     synchronously after bindTab; null before bindTab; null after releaseTab
 *   - getOrRegisterLegacyAgent('popup' | 'sidepanel' | 'autopilot') returns the
 *     constant 'legacy:<surface>' agentId; idempotent across calls; arbitrary
 *     surfaces rejected (D-02 carve-out from Phase 238 D-12)
 *   - hasAgent(agentId) returns true after registration (legacy and fresh-mint)
 *   - getAgentWindowId(agentId) is set ONCE on first bindTab; never overwritten
 *     (Open Q2 cross-window enforcement)
 *
 * Run: node tests/ownership-gate.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

// ---- chrome mock harness (mirrors tests/agent-registry.test.js) ------------

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
      if (typeof keys === 'object') {
        const out = {};
        Object.keys(keys).forEach((key) => {
          out[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
        });
        return out;
      }
      return Object.assign({}, store);
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => { delete store[key]; });
    },
    _dump() {
      return Object.assign({}, store);
    }
  };
}

function createChromeTabsMock(initialTabs) {
  let tabs = (initialTabs || []).map((t) => Object.assign({}, t));
  return {
    async query(_filter) { return tabs.slice(); },
    async get(tabId) {
      const found = tabs.find((t) => t.id === tabId);
      if (!found) throw new Error('No tab with id: ' + tabId);
      return found;
    },
    _setTabs(newTabs) { tabs = newTabs.slice(); },
    _addTab(t) { tabs.push(Object.assign({}, t)); },
    _removeTab(tabId) { tabs = tabs.filter((t) => t.id !== tabId); }
  };
}

function setupChromeMock(opts) {
  opts = opts || {};
  const session = createStorageArea(opts.session || {});
  const tabs = createChromeTabsMock(opts.tabs || [
    { id: 100, incognito: false, windowId: 10 },
    { id: 200, incognito: false, windowId: 10 },
    { id: 300, incognito: false, windowId: 20 },
    { id: 99, incognito: true, windowId: 30 }
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

(async () => {
  console.log('--- Phase 240 / ownership-gate / Test 1: bindTab returns ownershipToken ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      const result = await registry.bindTab(reg.agentId, 100);
      assert.ok(result && typeof result === 'object', 'bindTab returns an object on success');
      assert.strictEqual(result.agentId, reg.agentId, 'result.agentId matches');
      assert.strictEqual(result.tabId, 100, 'result.tabId matches');
      assert.ok(typeof result.ownershipToken === 'string', 'ownershipToken is a string');
      assert.ok(UUID_PATTERN.test(result.ownershipToken),
        'ownershipToken is a UUID shape, got: ' + result.ownershipToken);
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: bindTab return shape carries fresh UUID ownershipToken');

  console.log('--- Phase 240 / ownership-gate / Test 2: rebind mints a NEW token ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      const r1 = await registry.bindTab(reg.agentId, 100);
      const r2 = await registry.bindTab(reg.agentId, 100);
      assert.ok(r1 && r2 && r1.ownershipToken && r2.ownershipToken,
        'both binds returned tokens');
      assert.notStrictEqual(r1.ownershipToken, r2.ownershipToken,
        'rebind mints a fresh token; not idempotent on token');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: same-agent rebind on same tab mints fresh token');

  console.log('--- Phase 240 / ownership-gate / Test 3: isOwnedBy 3-arg verification ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      const r1 = await registry.bindTab(reg.agentId, 100);
      const oldToken = r1.ownershipToken;
      // Pass with correct token
      assert.strictEqual(registry.isOwnedBy(100, reg.agentId, oldToken), true,
        'isOwnedBy returns true with matching token');
      // Wrong token -> false
      assert.strictEqual(registry.isOwnedBy(100, reg.agentId, 'wrong-token'), false,
        'isOwnedBy returns false with mismatching token');
      // Backward-compat: undefined token preserves Phase 237 behavior
      assert.strictEqual(registry.isOwnedBy(100, reg.agentId), true,
        'isOwnedBy without token preserves Phase 237 back-compat');
      assert.strictEqual(registry.isOwnedBy(100, reg.agentId, undefined), true,
        'isOwnedBy with undefined token preserves Phase 237 back-compat');
      // After rebind, old token fails; new token wins
      const r2 = await registry.bindTab(reg.agentId, 100);
      assert.strictEqual(registry.isOwnedBy(100, reg.agentId, oldToken), false,
        'after rebind, old token fails verification');
      assert.strictEqual(registry.isOwnedBy(100, reg.agentId, r2.ownershipToken), true,
        'after rebind, new token verifies');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: isOwnedBy validates token presence and rotation');

  console.log('--- Phase 240 / ownership-gate / Test 4: getTabMetadata sync read ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();

      // Before bindTab
      assert.strictEqual(registry.getTabMetadata(100), null,
        'getTabMetadata returns null before bindTab');

      const r = await registry.bindTab(reg.agentId, 100);
      const meta = registry.getTabMetadata(100);
      assert.ok(meta && typeof meta === 'object', 'getTabMetadata returns an object after bindTab');
      assert.strictEqual(meta.ownershipToken, r.ownershipToken, 'meta.ownershipToken matches');
      assert.strictEqual(meta.incognito, false, 'meta.incognito reflects chrome.tabs.get');
      assert.strictEqual(meta.windowId, 10, 'meta.windowId reflects chrome.tabs.get');
      assert.ok(typeof meta.boundAt === 'number' && meta.boundAt > 0,
        'meta.boundAt is a positive number');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: getTabMetadata returns sync metadata after bindTab');

  console.log('--- Phase 240 / ownership-gate / Test 5: getTabMetadata caches incognito ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      // Tab 99 is incognito in the default fixture
      const r = await registry.bindTab(reg.agentId, 99);
      assert.ok(r && r.ownershipToken, 'bindTab on incognito tab still mints token');
      const meta = registry.getTabMetadata(99);
      assert.ok(meta, 'metadata exists for incognito tab');
      assert.strictEqual(meta.incognito, true,
        'meta.incognito === true for tabs marked incognito by chrome.tabs.get');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: getTabMetadata caches incognito flag at bindTab time');

  console.log('--- Phase 240 / ownership-gate / Test 6: releaseTab wipes metadata ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      await registry.bindTab(reg.agentId, 100);
      assert.ok(registry.getTabMetadata(100), 'metadata present before release');
      await registry.releaseTab(100);
      assert.strictEqual(registry.getTabMetadata(100), null,
        'getTabMetadata returns null after releaseTab (Pitfall 2 invariant)');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: releaseTab wipes _tabMetadata entry');

  console.log('--- Phase 240 / ownership-gate / Test 7: getOrRegisterLegacyAgent valid surfaces ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const popup = await registry.getOrRegisterLegacyAgent('popup');
      assert.ok(popup && typeof popup === 'object', 'returns an object for popup');
      assert.strictEqual(popup.agentId, 'legacy:popup', 'popup -> legacy:popup');
      assert.strictEqual(popup.ownershipToken, null,
        'ownershipToken is null at register time (per-bindTab token only)');

      const sp = await registry.getOrRegisterLegacyAgent('sidepanel');
      assert.strictEqual(sp.agentId, 'legacy:sidepanel', 'sidepanel -> legacy:sidepanel');
      assert.strictEqual(sp.ownershipToken, null);

      const ap = await registry.getOrRegisterLegacyAgent('autopilot');
      assert.strictEqual(ap.agentId, 'legacy:autopilot', 'autopilot -> legacy:autopilot');
      assert.strictEqual(ap.ownershipToken, null);

      // Idempotent: second call returns same agentId; registry has only 3 records
      const popup2 = await registry.getOrRegisterLegacyAgent('popup');
      assert.strictEqual(popup2.agentId, 'legacy:popup', 'idempotent: same agentId');
      assert.strictEqual(registry.listAgents().length, 3,
        'exactly 3 legacy records; no churn (Pitfall 4)');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: legacy:popup, legacy:sidepanel, legacy:autopilot synthesized once each');

  console.log('--- Phase 240 / ownership-gate / Test 8: getOrRegisterLegacyAgent rejects unknown surface ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const result = await registry.getOrRegisterLegacyAgent('arbitrary');
      assert.ok(result && result.error === 'unknown_legacy_surface',
        'unknown surface returns { error: "unknown_legacy_surface" }');
      assert.strictEqual(result.surface, 'arbitrary', 'echoes the offending surface');
      assert.strictEqual(registry.listAgents().length, 0,
        'no agent registered for unknown surface');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: arbitrary surface rejected, no enumeration possible');

  console.log('--- Phase 240 / ownership-gate / Test 9: hasAgent for legacy + fresh-mint ids ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      assert.strictEqual(registry.hasAgent('legacy:popup'), false,
        'hasAgent false before registration');
      await registry.getOrRegisterLegacyAgent('popup');
      assert.strictEqual(registry.hasAgent('legacy:popup'), true,
        'hasAgent true after legacy registration');

      const reg = await registry.registerAgent();
      assert.strictEqual(registry.hasAgent(reg.agentId), true,
        'hasAgent true for fresh-mint id');
      assert.strictEqual(registry.hasAgent('agent_does-not-exist'), false,
        'hasAgent false for unknown id');
      assert.strictEqual(registry.hasAgent(null), false, 'hasAgent false for null');
      assert.strictEqual(registry.hasAgent(undefined), false, 'hasAgent false for undefined');
      assert.strictEqual(registry.hasAgent(123), false, 'hasAgent false for non-string');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: hasAgent returns true for known ids only');

  console.log('--- Phase 240 / ownership-gate / Test 10: getAgentWindowId set-once invariant ---');
  {
    setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      const A = reg.agentId;

      // Before any bindTab
      assert.strictEqual(registry.getAgentWindowId(A), null,
        'getAgentWindowId returns null before any bindTab');

      // Bind tab 100 in window 10
      await registry.bindTab(A, 100);
      assert.strictEqual(registry.getAgentWindowId(A), 10,
        'agent windowId stamped on first bindTab (window 10)');

      // Bind tab 200 in window 10 (same window) -- still 10
      await registry.bindTab(A, 200);
      assert.strictEqual(registry.getAgentWindowId(A), 10,
        'second bindTab in same window keeps the pin');

      // Bind tab 300 in window 20 -- pin must NOT change (Open Q2 set-once)
      await registry.bindTab(A, 300);
      assert.strictEqual(registry.getAgentWindowId(A), 10,
        'binding into a different window does NOT overwrite the pin (set-once invariant)');

      // Unknown agent
      assert.strictEqual(registry.getAgentWindowId('agent_unknown'), null,
        'getAgentWindowId returns null for unknown agent');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: getAgentWindowId stamps once, never overwrites');

  console.log('--- Phase 240 / ownership-gate / Test 11: storage envelope round-trips per-tab metadata ---');
  {
    const mock = setupChromeMock();
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      const reg = await registry.registerAgent();
      const r = await registry.bindTab(reg.agentId, 100);
      const dump = mock.session._dump();
      const payload = dump[fresh.FSB_AGENT_REGISTRY_STORAGE_KEY];
      assert.ok(payload, 'envelope present');
      assert.strictEqual(payload.v, 1, 'envelope version unchanged at v: 1');
      assert.ok(payload.tabMetadata && typeof payload.tabMetadata === 'object',
        'envelope carries top-level tabMetadata block');
      assert.ok(payload.tabMetadata['100'], 'metadata persisted for tab 100');
      assert.strictEqual(payload.tabMetadata['100'].ownershipToken, r.ownershipToken,
        'persisted ownershipToken matches in-memory');
      assert.strictEqual(payload.tabMetadata['100'].incognito, false);
      assert.strictEqual(payload.tabMetadata['100'].windowId, 10);
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: storage envelope (v: 1) carries tabMetadata at top level');

  console.log('--- Phase 240 / ownership-gate / Test 12: hydrate restores metadata ---');
  {
    const mock = setupChromeMock({
      session: {
        fsbAgentRegistry: {
          v: 1,
          records: {
            'agent_550e8400-e29b-41d4-a716-446655440000': {
              agentId: 'agent_550e8400-e29b-41d4-a716-446655440000',
              createdAt: 1000,
              tabIds: [100],
              windowId: 10
            }
          },
          tabMetadata: {
            '100': {
              ownershipToken: 'token-aaa-111',
              incognito: false,
              windowId: 10,
              boundAt: 1234
            }
          }
        }
      },
      tabs: [{ id: 100, incognito: false, windowId: 10 }]
    });
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      await registry.hydrate();
      const meta = registry.getTabMetadata(100);
      assert.ok(meta, 'metadata rehydrated for tab 100');
      assert.strictEqual(meta.ownershipToken, 'token-aaa-111',
        'hydrated ownershipToken survives round-trip');
      assert.strictEqual(
        registry.isOwnedBy(100, 'agent_550e8400-e29b-41d4-a716-446655440000', 'token-aaa-111'),
        true,
        'isOwnedBy verifies hydrated token');
      assert.strictEqual(
        registry.getAgentWindowId('agent_550e8400-e29b-41d4-a716-446655440000'),
        10,
        'hydrated agent record carries windowId pin'
      );
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: hydrate rebuilds _tabMetadata + agent windowId pin');

  console.log('--- Phase 240 / ownership-gate / Test 13: stale Phase 237 envelope hydrates safely ---');
  {
    const mock = setupChromeMock({
      session: {
        fsbAgentRegistry: {
          v: 1,
          records: {
            'agent_550e8400-e29b-41d4-a716-446655440000': {
              agentId: 'agent_550e8400-e29b-41d4-a716-446655440000',
              createdAt: 1000,
              tabIds: [100]
            }
          }
          // NO tabMetadata block (Phase 237 envelope shape)
        }
      },
      tabs: [{ id: 100, incognito: false, windowId: 10 }]
    });
    try {
      const fresh = freshRequireRegistry();
      const registry = new fresh.AgentRegistry();
      let threw = false;
      try {
        await registry.hydrate();
      } catch (_e) {
        threw = true;
      }
      assert.strictEqual(threw, false, 'hydrate did not throw on Phase 237 envelope');
      // Stale Phase 237 binding remains in _tabOwners but no metadata -> isOwnedBy
      // with token === undefined returns true (back-compat); with a token it fails
      assert.strictEqual(
        registry.isOwnedBy(100, 'agent_550e8400-e29b-41d4-a716-446655440000'),
        true,
        'back-compat: token-less isOwnedBy still works on stale binding'
      );
      assert.strictEqual(
        registry.isOwnedBy(100, 'agent_550e8400-e29b-41d4-a716-446655440000', 'any-token'),
        false,
        'stale binding without metadata fails token-aware check (Pitfall 6)'
      );
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: Phase 237 stale envelopes hydrate without crash; token-aware fail naturally');

  // ==========================================================================
  // Phase 240 plan 02 -- chokepoint and same-microtask invariant
  //
  // The block below extends the registry-contract assertions above with the
  // dispatcher-level gate behavior added by Plan 02. The gate is inlined into
  // dispatchMcpToolRoute in extension/ws/mcp-tool-dispatcher.js and is read-
  // only on the registry. These tests use a stubbed registry so the gate's
  // sync-discipline (D-07) is observable without chrome.tabs round-trips.
  // ==========================================================================

  const path = require('path');
  const DISPATCHER_PATH = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-tool-dispatcher.js');
  const dispatcher = require(DISPATCHER_PATH);
  const { dispatchMcpToolRoute } = dispatcher;

  function installGateRegistry(mock) {
    globalThis.fsbAgentRegistryInstance = mock;
  }
  function uninstallGateRegistry() {
    delete globalThis.fsbAgentRegistryInstance;
  }

  console.log('--- Phase 240 / chokepoint / Test C1: gate skip for tools without tabId ---');
  {
    let handlerInvoked = false;
    // Build a registry stub that has a known agent and no tabs. list_tabs has
    // no tabId, so the gate should pass (returning null) and the handler
    // should be invoked. The handler itself may fail because chrome.tabs is
    // unavailable, but the gate must not block first.
    const mock = {
      hasAgent: (id) => id === 'agent_known',
      isOwnedBy: () => false,
      getOwner: () => null,
      getTabMetadata: () => null,
      getAgentWindowId: () => null
    };
    installGateRegistry(mock);
    try {
      const result = await dispatchMcpToolRoute({
        tool: 'list_tabs',
        params: { agentId: 'agent_known' }
      });
      // Gate did not short-circuit with a typed code -- the handler ran (and
      // probably hit a chrome.tabs.query error), not blocked at the gate.
      const gateCodes = ['TAB_NOT_OWNED', 'TAB_INCOGNITO_NOT_SUPPORTED', 'TAB_OUT_OF_SCOPE'];
      assert.ok(!gateCodes.includes(result && result.code),
        'list_tabs not blocked at gate by tabId arm; got code=' + (result && result.code));
    } finally {
      uninstallGateRegistry();
    }
  }
  console.log('  PASS: list_tabs (no tabId) passes the gate when agent is registered');

  console.log('--- Phase 240 / chokepoint / Test C2: same-microtask invariant ---');
  {
    // The gate is sync; the handler dispatch is sync (the call to
    // route.handler returns a promise). We assert that route.handler is
    // INVOKED synchronously after the gate check by ordering markers.
    //
    // Strategy: the gate must complete and the handler must be CALLED before
    // any deferred microtask scheduled BEFORE the dispatch fires. We schedule
    // a marker via Promise.resolve().then(); call dispatchMcpToolRoute(...)
    // (without awaiting); the handler itself is async but its FIRST line --
    // a synchronous check -- will execute before the deferred marker because
    // dispatchMcpToolRoute returns route.handler(...) directly (no `await`
    // between gate and handler).
    //
    // We swap the navigate handler's behavior temporarily by stubbing
    // dispatchMcpToolRoute's downstream via a registry that records when
    // gate ran and a synchronous flag set by isOwnedBy as a probe.
    //
    // Simplest concrete probe: assert that the GATE's isOwnedBy lookup runs
    // in the same microtask as the synchronous portion of the dispatch. We
    // schedule a microtask BEFORE calling dispatchMcpToolRoute; the gate's
    // isOwnedBy probe sets order='gate'; the deferred marker sets
    // order='deferred' if the gate did not yet run.
    let gateProbeFired = false;
    let deferredMarker = false;
    const order = [];
    const mock = {
      hasAgent: () => true,
      isOwnedBy: () => {
        gateProbeFired = true;
        order.push('gate');
        return true;
      },
      getOwner: () => null,
      getTabMetadata: () => null,
      getAgentWindowId: () => null
    };
    installGateRegistry(mock);
    try {
      // Schedule a microtask BEFORE the dispatch.
      Promise.resolve().then(() => {
        deferredMarker = true;
        order.push('deferred');
      });
      // Fire the dispatch. Do NOT await yet -- we want the gate's sync work
      // to complete inside the same microtask as our caller frame.
      const dispatchPromise = dispatchMcpToolRoute({
        tool: 'navigate',
        params: { tabId: 100, agentId: 'agent_known', ownershipToken: 'tok-x', url: 'https://x.example' }
      });
      // At this point the gate has run sync (no await between gate check and
      // route.handler call). The deferred marker has NOT yet fired because
      // the queueMicrotask boundary is on the JS event loop; we're still in
      // the same caller frame.
      assert.strictEqual(gateProbeFired, true,
        'gate isOwnedBy probe fired synchronously inside dispatchMcpToolRoute');
      assert.strictEqual(deferredMarker, false,
        'deferred microtask did NOT yet fire (gate is sync, no await before handler)');
      // Now resolve the dispatch promise so the test can clean up.
      await dispatchPromise.catch(() => {}); // handler may throw; we don't care
      // After awaiting, the deferred marker has fired.
      assert.strictEqual(deferredMarker, true,
        'deferred marker fires after dispatch resolves');
      // Sanity: gate ran before deferred marker.
      assert.deepStrictEqual(order, ['gate', 'deferred'],
        'gate runs synchronously before any pre-scheduled microtask; got ' + JSON.stringify(order));
    } finally {
      uninstallGateRegistry();
    }
  }
  console.log('  PASS: gate runs synchronously before any pre-scheduled microtask (D-07)');

  console.log('--- Phase 240 / chokepoint / Test C3: bindTab side-effect on handleNavigate happy path ---');
  {
    // The handler invokes bindTab BEFORE the success return. We spy on
    // bindTab via the registry mock; we mock chrome.tabs to return success.
    const bindCalls = [];
    const mock = {
      hasAgent: () => true,
      isOwnedBy: () => true,
      getOwner: () => 'agent_known',
      getTabMetadata: () => ({ ownershipToken: 'tok-x', incognito: false, windowId: 10, boundAt: 1 }),
      getAgentWindowId: () => 10,
      async bindTab(agentId, tabId) {
        bindCalls.push([agentId, tabId]);
        return { agentId, tabId, ownershipToken: 'tok-newly-minted' };
      }
    };
    installGateRegistry(mock);
    // Mock chrome.tabs.update + chrome.tabs.query so handleNavigateRoute
    // resolves successfully.
    globalThis.chrome = {
      tabs: {
        async update(tabId, _props) { return { id: tabId, url: 'https://example.com' }; },
        async query(_filter) { return [{ id: 100, url: 'about:blank' }]; }
      }
    };
    try {
      const result = await dispatchMcpToolRoute({
        tool: 'navigate',
        params: { tabId: 100, agentId: 'agent_known', ownershipToken: 'tok-x', url: 'https://example.com' }
      });
      assert.ok(result && result.success === true,
        'navigate happy-path returns success === true; got ' + JSON.stringify(result));
      assert.strictEqual(bindCalls.length, 1,
        'bindTab called exactly once in handleNavigate happy path; got ' + bindCalls.length);
      assert.strictEqual(bindCalls[0][0], 'agent_known',
        'bindTab called with the agentId from the gate-validated payload');
      assert.strictEqual(bindCalls[0][1], 100,
        'bindTab called with the navigated tabId');
    } finally {
      uninstallGateRegistry();
      delete globalThis.chrome;
    }
  }
  console.log('  PASS: handleNavigate calls bindTab once before success return');

  console.log('--- Phase 240 / chokepoint / Test C4: bindTab does NOT fire on handleNavigate error path ---');
  {
    const bindCalls = [];
    const mock = {
      hasAgent: () => true,
      isOwnedBy: () => true,
      getOwner: () => 'agent_known',
      getTabMetadata: () => ({ ownershipToken: 'tok-x', incognito: false, windowId: 10, boundAt: 1 }),
      getAgentWindowId: () => 10,
      async bindTab(agentId, tabId) {
        bindCalls.push([agentId, tabId]);
        return { agentId, tabId, ownershipToken: 'tok-x2' };
      }
    };
    installGateRegistry(mock);
    // chrome.tabs.update throws -- handler should hit the catch branch and
    // NOT call bindTab.
    globalThis.chrome = {
      tabs: {
        async update(_tabId, _props) { throw new Error('boom'); },
        async query(_filter) { return [{ id: 100, url: 'about:blank' }]; }
      }
    };
    try {
      const result = await dispatchMcpToolRoute({
        tool: 'navigate',
        params: { tabId: 100, agentId: 'agent_known', ownershipToken: 'tok-x', url: 'https://example.com' }
      });
      assert.ok(result && result.success === false,
        'navigate error path returns success === false');
      assert.strictEqual(bindCalls.length, 0,
        'bindTab NOT called on error path; got ' + bindCalls.length);
    } finally {
      uninstallGateRegistry();
      delete globalThis.chrome;
    }
  }
  console.log('  PASS: handleNavigate error path does NOT call bindTab');

  console.log('\nAll Phase 240 ownership-gate registry-contract + chokepoint assertions passed.');
})().catch((err) => {
  console.error('TEST FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
