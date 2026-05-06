'use strict';

/**
 * Phase 240 plan 03 -- Wave 0 RED scaffold for the visual-session same-agent
 * resume + cross-agent reject branches in mcp-visual-session.js startSession.
 *
 * Validates D-03 (same-agent resume) + D-09 (cross-agent reject) on top of the
 * existing v0.9.36 displacement contract (preserved for unowned tabs):
 *
 *   - Setup: register agent A, bindTab A on tab T1; first startSession returns
 *     a fresh session at version 1.
 *   - Same-agent re-entry RESUMES (D-03): mutates the existing session in
 *     place, increments version, preserves sessionToken, returns
 *     { session, resumed: true }.
 *   - Cross-agent re-entry REJECTS (D-09): returns
 *     { errorCode: 'tab_owned_by_other_agent', ownerAgentId } and leaves the
 *     existing session UNCHANGED (no version bump).
 *   - Unowned-tab path PRESERVED: when no agent claims the tab,
 *     startSession falls through to the legacy displacement code path
 *     (v0.9.36 idempotent contract).
 *   - Token preservation: same-agent resume returns the SAME sessionToken
 *     getTokenForTab returned before the resume call.
 *
 * Run: node tests/visual-session-reentry.test.js
 */

const assert = require('assert');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');
const VISUAL_SESSION_PATH = require.resolve('../extension/utils/mcp-visual-session.js');

function createStorageArea() {
  const store = {};
  return {
    async get(keys) {
      if (keys == null) return Object.assign({}, store);
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((k) => {
          if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = store[k];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
      }
      return Object.assign({}, store);
    },
    async set(values) { Object.assign(store, values); },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((k) => { delete store[k]; });
    }
  };
}

function createTabsMock() {
  const tabs = [
    { id: 100, incognito: false, windowId: 10 },
    { id: 200, incognito: false, windowId: 10 }
  ];
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
  globalThis.chrome = {
    runtime: { id: 'phase-240-test', lastError: null },
    storage: { session: createStorageArea() },
    tabs: createTabsMock()
  };
}

function teardownChromeMock() {
  delete globalThis.chrome;
  delete globalThis.fsbAgentRegistryInstance;
}

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

function freshRequireVisualSession() {
  delete require.cache[VISUAL_SESSION_PATH];
  return require(VISUAL_SESSION_PATH);
}

(async () => {
  console.log('--- Phase 240 / visual-session-reentry / Test 1: same-agent re-entry resumes ---');
  {
    setupChromeMock();
    try {
      const regMod = freshRequireRegistry();
      const registry = new regMod.AgentRegistry();
      // Plan 03 visual-session reads globalThis.fsbAgentRegistryInstance.getOwner
      globalThis.fsbAgentRegistryInstance = registry;

      const agentA = await registry.registerAgent();
      const bind = await registry.bindTab(agentA.agentId, 100);
      assert.ok(bind && bind.ownershipToken, 'bindTab succeeded for agent A');

      const vs = freshRequireVisualSession();
      const manager = new vs.McpVisualSessionManager();

      const first = manager.startSession({
        clientLabel: 'codex',
        tabId: 100,
        agentId: agentA.agentId,
        task: 'first task',
        detail: 'initial detail',
        now: 1000
      });
      assert.ok(first && first.session, 'first startSession returns a session');
      assert.strictEqual(first.session.version, 1, 'first version is 1');
      assert.strictEqual(first.resumed, undefined,
        'first call is NOT a resume (no prior session)');
      const firstToken = first.session.sessionToken;

      // Same-agent re-entry: must RESUME (D-03)
      const resumed = manager.startSession({
        clientLabel: 'codex',
        tabId: 100,
        agentId: agentA.agentId,
        task: 'second task',
        detail: 'updated detail',
        now: 2000
      });
      assert.strictEqual(resumed.resumed, true,
        'second call returns { resumed: true } for same agent');
      assert.ok(resumed.session, 'session is returned on resume');
      assert.strictEqual(resumed.session.sessionToken, firstToken,
        'sessionToken PRESERVED across same-agent resume (NOT a fresh token)');
      assert.strictEqual(resumed.session.version, 2,
        'version incremented from 1 to 2');
      assert.strictEqual(resumed.session.task, 'second task',
        'task updated to new value');
      assert.strictEqual(resumed.session.lastUpdateAt, 2000,
        'lastUpdateAt updated to now');
      // getTokenForTab still returns the same token after resume
      assert.strictEqual(manager.getTokenForTab(100), firstToken,
        'getTokenForTab returns the SAME token before and after resume');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: same-agent re-entry resumes existing session, preserves token');

  console.log('--- Phase 240 / visual-session-reentry / Test 2: cross-agent re-entry rejects ---');
  {
    setupChromeMock();
    try {
      const regMod = freshRequireRegistry();
      const registry = new regMod.AgentRegistry();
      globalThis.fsbAgentRegistryInstance = registry;

      const agentA = await registry.registerAgent();
      const agentB = await registry.registerAgent();
      await registry.bindTab(agentA.agentId, 100);

      const vs = freshRequireVisualSession();
      const manager = new vs.McpVisualSessionManager();

      const first = manager.startSession({
        clientLabel: 'codex',
        tabId: 100,
        agentId: agentA.agentId,
        task: 'A task',
        now: 1000
      });
      assert.ok(first.session, 'agent A started a session');
      const aToken = first.session.sessionToken;
      const aVersion = first.session.version;

      // Cross-agent attempt: must REJECT (D-09)
      const rejected = manager.startSession({
        clientLabel: 'claude',
        tabId: 100,
        agentId: agentB.agentId,
        task: 'B invasion',
        now: 2000
      });
      assert.strictEqual(rejected.errorCode, 'tab_owned_by_other_agent',
        'cross-agent re-entry rejects with errorCode tab_owned_by_other_agent');
      assert.strictEqual(rejected.ownerAgentId, agentA.agentId,
        'reject payload includes the actual owner agentId');
      assert.strictEqual(rejected.session, undefined,
        'no session returned on cross-agent reject');

      // Existing session UNCHANGED -- no version bump, same token
      assert.strictEqual(manager.getTokenForTab(100), aToken,
        'agent A session token unchanged after cross-agent reject');
      const stillA = manager.getSession(aToken);
      assert.ok(stillA, 'agent A session still present');
      assert.strictEqual(stillA.version, aVersion,
        'agent A session version not bumped by failed cross-agent attempt');
      assert.strictEqual(stillA.task, 'A task',
        'agent A session task unchanged by failed cross-agent attempt');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: cross-agent re-entry rejected; existing session untouched');

  console.log('--- Phase 240 / visual-session-reentry / Test 3: unowned tab displacement preserved ---');
  {
    setupChromeMock();
    try {
      const regMod = freshRequireRegistry();
      const registry = new regMod.AgentRegistry();
      globalThis.fsbAgentRegistryInstance = registry;

      const vs = freshRequireVisualSession();
      const manager = new vs.McpVisualSessionManager();

      // Tab 200 has NO agent owner in registry. The legacy displacement code
      // path must continue to fire (v0.9.36 idempotent-startSession contract).
      const first = manager.startSession({
        clientLabel: 'codex',
        tabId: 200,
        task: 'unowned first',
        now: 1000
      });
      assert.ok(first.session, 'unowned-tab first session created');
      assert.strictEqual(first.errorCode, undefined,
        'no error -- unowned path falls through to displacement');

      // Second call WITHOUT agentId -- legacy displacement (replacement)
      const second = manager.startSession({
        clientLabel: 'codex',
        tabId: 200,
        task: 'unowned second',
        now: 2000
      });
      assert.ok(second.session, 'second unowned session created');
      assert.notStrictEqual(second.session.sessionToken, first.session.sessionToken,
        'unowned displacement mints a NEW token (legacy v0.9.36 contract)');
      assert.ok(second.replacedSession, 'replacedSession returned per Phase 238 contract');
      assert.strictEqual(second.replacedSession.sessionToken, first.session.sessionToken,
        'replacedSession matches the old session');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: unowned-tab displacement code path preserved');

  console.log('--- Phase 240 / visual-session-reentry / Test 4: same-agent resume preserves session token ---');
  {
    setupChromeMock();
    try {
      const regMod = freshRequireRegistry();
      const registry = new regMod.AgentRegistry();
      globalThis.fsbAgentRegistryInstance = registry;

      const agentA = await registry.registerAgent();
      await registry.bindTab(agentA.agentId, 100);

      const vs = freshRequireVisualSession();
      const manager = new vs.McpVisualSessionManager();

      const first = manager.startSession({
        clientLabel: 'codex',
        tabId: 100,
        agentId: agentA.agentId,
        task: 'first',
        now: 1000
      });
      const tokenBefore = manager.getTokenForTab(100);
      assert.strictEqual(tokenBefore, first.session.sessionToken,
        'token before resume matches first session');

      const resumed = manager.startSession({
        clientLabel: 'codex',
        tabId: 100,
        agentId: agentA.agentId,
        task: 'second',
        now: 2000
      });
      const tokenAfter = manager.getTokenForTab(100);
      assert.strictEqual(tokenAfter, tokenBefore,
        'token after resume identical to before (idempotent contract)');
      assert.strictEqual(resumed.session.sessionToken, tokenBefore,
        'resumed.session.sessionToken matches the original');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: token preserved across same-agent resume');

  console.log('--- Phase 240 / visual-session-reentry / Test 5: version monotonic across resume ---');
  {
    setupChromeMock();
    try {
      const regMod = freshRequireRegistry();
      const registry = new regMod.AgentRegistry();
      globalThis.fsbAgentRegistryInstance = registry;

      const agentA = await registry.registerAgent();
      await registry.bindTab(agentA.agentId, 100);

      const vs = freshRequireVisualSession();
      const manager = new vs.McpVisualSessionManager();

      const r1 = manager.startSession({
        clientLabel: 'codex', tabId: 100, agentId: agentA.agentId, task: 't1', now: 1000
      });
      assert.strictEqual(r1.session.version, 1, 'initial version 1');

      const r2 = manager.startSession({
        clientLabel: 'codex', tabId: 100, agentId: agentA.agentId, task: 't2', now: 2000
      });
      assert.strictEqual(r2.session.version, 2, 'after first resume: version 2');

      const r3 = manager.startSession({
        clientLabel: 'codex', tabId: 100, agentId: agentA.agentId, task: 't3', now: 3000
      });
      assert.strictEqual(r3.session.version, 3, 'after second resume: version 3');
    } finally {
      teardownChromeMock();
    }
  }
  console.log('  PASS: version monotonically increments across multiple resumes');

  console.log('\nAll Phase 240 visual-session-reentry assertions passed.');
})().catch((err) => {
  console.error('TEST FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
