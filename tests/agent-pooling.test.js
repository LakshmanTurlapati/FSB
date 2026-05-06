'use strict';

/**
 * Phase 241 plan 02 task 1 -- chrome.tabs.onCreated forced-pool routing
 * (POOL-03 / D-01 / D-02) + handleAgentRegisterRoute cap-rejection branch
 * (POOL-01 / D-03) + connectionId stamp through dispatcher (D-08).
 *
 * Validates:
 *   - When chrome.tabs.onCreated fires for a new tab whose openerTabId is
 *     owned by an agent, background.js's standalone listener binds the new
 *     tab to that agent via reg.bindTab(agentId, newTabId, { forced: true }).
 *   - Tab metadata for the bound tab carries forced === true.
 *   - Unowned openerTabId does not bind anything (Pitfall 2).
 *   - Missing openerTabId does not bind anything (Ctrl+T case).
 *   - Defensive against non-numeric / undefined / null tab payloads.
 *   - D-02: forced-pool routing does NOT consume cap budget (no new agent
 *     is registered; bindTab on existing agent is reused).
 *   - handleAgentRegisterRoute returns typed
 *     { success:false, code:'AGENT_CAP_REACHED', cap, active } on registry
 *     rejection (D-03).
 *   - handleAgentRegisterRoute reads payload.connectionId, stamps it on the
 *     fresh agent record via reg.stampConnectionId, and reflects it on the
 *     success response (D-08).
 *
 * Run: node tests/agent-pooling.test.js
 */

const assert = require('assert');
const path = require('path');

const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');
const DISPATCHER_PATH = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-tool-dispatcher.js');
const BACKGROUND_PATH = path.resolve(__dirname, '..', 'extension', 'background.js');

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

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
      list.forEach((key) => { delete store[key]; });
    }
  };
}

function setupChromeMock() {
  const session = createStorageArea({});
  const local = createStorageArea({});
  const onCreatedListeners = [];
  const onRemovedListeners = [];
  globalThis.chrome = {
    runtime: { id: 'phase-241-pooling-test', lastError: null },
    storage: {
      session: session,
      local: local,
      onChanged: { addListener() {} }
    },
    tabs: {
      async query() { return []; },
      async get(_id) { throw new Error('no tab'); },
      onCreated: {
        addListener(fn) { onCreatedListeners.push(fn); }
      },
      onRemoved: {
        addListener(fn) { onRemovedListeners.push(fn); }
      }
    }
  };
  return { session, local, onCreatedListeners, onRemovedListeners };
}

function teardownChromeMock() {
  delete globalThis.chrome;
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

// Loads only the listener-registration code for chrome.tabs.onCreated by
// reading background.js as text and extracting the standalone listener block.
// We do NOT load the entire background.js (it has heavy side-effects and
// imports); instead we eval the small slice in a controlled scope where
// globalThis.fsbAgentRegistryInstance is the test registry and chrome is the
// mock. This mirrors the smoke-test convention of testing standalone listeners
// in isolation (Phase 237 plan 03 precedent).
function installPhase241OnCreatedListenerFromSource() {
  const fs = require('fs');
  const source = fs.readFileSync(BACKGROUND_PATH, 'utf8');
  // Find the Phase 241 onCreated block by its sentinel comment.
  const match = source.match(/\/\/ Phase 241[\s\S]*?chrome\.tabs\.onCreated\.addListener\([\s\S]*?\}\);\s*\n/);
  if (!match) {
    throw new Error('phase-241-onCreated-listener-not-found-in-background.js');
  }
  // Evaluate ONLY the matched block under the current globalThis (which has
  // chrome + fsbAgentRegistryInstance installed). Wrapped in eval so the
  // listener registration runs against the test chrome mock.
  // eslint-disable-next-line no-eval
  eval(match[0]);
}

(async () => {
  console.log('--- Test 1: forced-pool routing -- openerTabId owned (POOL-03 / D-01) ---');
  {
    const mock = setupChromeMock();
    setupDiagnosticCapture();
    try {
      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      globalThis.fsbAgentRegistryInstance = reg;

      const A = (await reg.registerAgent()).agentId;
      await reg.bindTab(A, 100);

      installPhase241OnCreatedListenerFromSource();
      assert.ok(mock.onCreatedListeners.length >= 1, 'at least one chrome.tabs.onCreated listener registered');
      const cb = mock.onCreatedListeners[0];

      // Fire the listener as Chrome would.
      cb({ id: 200, openerTabId: 100 });
      // Wait one microtask so the bindTab promise resolves.
      await new Promise((res) => setTimeout(res, 5));

      assert.strictEqual(reg.findAgentByTabId(200), A, 'new tab 200 bound to agent A');
      const meta = reg.getTabMetadata(200);
      assert.ok(meta, 'metadata exists for tab 200');
      assert.strictEqual(meta.forced, true, 'tab metadata for 200 has forced === true');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: forced-pool routes new tab to opener\'s agent with forced flag');

  console.log('--- Test 2: unowned opener -- new tab stays unowned (Pitfall 2) ---');
  {
    const mock = setupChromeMock();
    setupDiagnosticCapture();
    try {
      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      globalThis.fsbAgentRegistryInstance = reg;

      installPhase241OnCreatedListenerFromSource();
      const cb = mock.onCreatedListeners[0];

      cb({ id: 300, openerTabId: 999 });
      await new Promise((res) => setTimeout(res, 5));

      assert.strictEqual(reg.findAgentByTabId(300), null, 'unowned-opener tab is unowned');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: unowned openerTabId is a no-op');

  console.log('--- Test 3: missing openerTabId -- Ctrl+T case unowned ---');
  {
    const mock = setupChromeMock();
    setupDiagnosticCapture();
    try {
      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      globalThis.fsbAgentRegistryInstance = reg;

      installPhase241OnCreatedListenerFromSource();
      const cb = mock.onCreatedListeners[0];

      cb({ id: 400 });
      await new Promise((res) => setTimeout(res, 5));

      assert.strictEqual(reg.findAgentByTabId(400), null, 'no-opener tab is unowned');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: missing openerTabId is a no-op');

  console.log('--- Test 4: defensive payload guards (non-numeric id / null / empty) ---');
  {
    const mock = setupChromeMock();
    setupDiagnosticCapture();
    try {
      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      globalThis.fsbAgentRegistryInstance = reg;

      const A = (await reg.registerAgent()).agentId;
      await reg.bindTab(A, 100);

      installPhase241OnCreatedListenerFromSource();
      const cb = mock.onCreatedListeners[0];

      // None of these may throw.
      assert.doesNotThrow(() => cb({ id: undefined, openerTabId: 100 }), 'undefined id no throw');
      assert.doesNotThrow(() => cb({}), 'empty tab object no throw');
      assert.doesNotThrow(() => cb(null), 'null tab no throw');

      await new Promise((res) => setTimeout(res, 5));
      // Nothing should have been bound under A beyond tab 100.
      const tabs = reg.getAgentTabs(A);
      assert.deepStrictEqual(tabs.sort((a, b) => a - b), [100], 'A still owns only tab 100');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: defensive guards on bad payloads');

  console.log('--- Test 5: D-02 forced-pool does NOT consume cap budget ---');
  {
    const mock = setupChromeMock();
    setupDiagnosticCapture();
    try {
      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(2);
      globalThis.fsbAgentRegistryInstance = reg;

      const A = (await reg.registerAgent()).agentId;
      const B = (await reg.registerAgent()).agentId;
      // Cap=2 is full now.
      await reg.bindTab(A, 100);
      await reg.bindTab(B, 101);
      assert.strictEqual(reg._agents.size, 2, 'cap full at 2 agents');

      installPhase241OnCreatedListenerFromSource();
      const cb = mock.onCreatedListeners[0];

      // New tab opened from A's tab -- pools under A, must NOT count as a new agent.
      cb({ id: 500, openerTabId: 100 });
      await new Promise((res) => setTimeout(res, 5));

      assert.strictEqual(reg._agents.size, 2, 'agent count unchanged (D-02)');
      assert.strictEqual(reg.findAgentByTabId(500), A, 'tab 500 pooled under A');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: forced-pool routing does not increment agent count');

  console.log('--- Test 6: handleAgentRegisterRoute returns typed AGENT_CAP_REACHED (POOL-01 / D-03) ---');
  {
    setupChromeMock();
    setupDiagnosticCapture();
    try {
      delete require.cache[DISPATCHER_PATH];
      const dispatcher = require(DISPATCHER_PATH);
      assert.strictEqual(typeof dispatcher.handleAgentRegisterRoute, 'function',
        'handleAgentRegisterRoute exported');

      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(1);
      globalThis.fsbAgentRegistryInstance = reg;
      globalThis.FsbAgentRegistry = {
        formatAgentIdForDisplay: (id) => (typeof id === 'string' ? id.slice(0, 12) : '')
      };

      // First register: success.
      const r1 = await dispatcher.handleAgentRegisterRoute({ payload: {} });
      assert.strictEqual(r1.success, true, 'first register succeeds');
      assert.ok(typeof r1.agentId === 'string', 'first register returns agentId');

      // Second register: cap reached.
      const r2 = await dispatcher.handleAgentRegisterRoute({ payload: {} });
      assert.strictEqual(r2.success, false, 'second register fails');
      assert.strictEqual(r2.code, 'AGENT_CAP_REACHED', 'code is AGENT_CAP_REACHED');
      assert.strictEqual(r2.cap, 1, 'cap surfaced in response');
      assert.strictEqual(r2.active, 1, 'active count surfaced');
      assert.strictEqual(r2.agentId, undefined, 'no agentId on cap rejection');
      assert.strictEqual(r2.ownershipTokens, undefined, 'no ownershipTokens on cap rejection');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      delete globalThis.FsbAgentRegistry;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: handleAgentRegisterRoute surfaces typed cap rejection');

  console.log('--- Test 7: handleAgentRegisterRoute stamps connectionId and reflects (D-08) ---');
  {
    setupChromeMock();
    setupDiagnosticCapture();
    try {
      delete require.cache[DISPATCHER_PATH];
      const dispatcher = require(DISPATCHER_PATH);

      const fresh = freshRequireRegistry();
      const reg = new fresh.AgentRegistry();
      reg.setCap(8);
      globalThis.fsbAgentRegistryInstance = reg;
      globalThis.FsbAgentRegistry = {
        formatAgentIdForDisplay: (id) => (typeof id === 'string' ? id.slice(0, 12) : '')
      };

      const r = await dispatcher.handleAgentRegisterRoute({
        payload: { connectionId: 'conn-test' }
      });
      assert.strictEqual(r.success, true, 'register succeeds');
      assert.ok(typeof r.agentId === 'string', 'agentId minted');
      assert.strictEqual(r.connectionId, 'conn-test',
        'response reflects payload connectionId');

      const record = reg._agents.get(r.agentId);
      assert.ok(record, 'agent record exists');
      assert.strictEqual(record.connectionId, 'conn-test',
        'connectionId stamped on the agent record');
    } finally {
      delete globalThis.fsbAgentRegistryInstance;
      delete globalThis.FsbAgentRegistry;
      teardownDiagnosticCapture();
      teardownChromeMock();
    }
  }
  console.log('  PASS: handleAgentRegisterRoute stamps + reflects connectionId');

  console.log('PASS pooling');
})().catch((err) => {
  console.error('FAIL pooling:', err && err.stack || err);
  process.exit(1);
});
