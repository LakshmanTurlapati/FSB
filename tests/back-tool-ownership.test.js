'use strict';

/**
 * Phase 242 plan 02 -- back-tool dispatcher ownership + background-tab tests.
 *
 * Covers:
 *   - BACK-05 cross-agent reject: 'mcp:go-back' through dispatchMcpMessageRoute
 *     with a non-owning agentId returns the canonical Phase 240 gate error
 *     {success:false, code:'TAB_NOT_OWNED', ownerAgentId, requestedTabId,
 *      requestingAgentId} and triggers ZERO chrome.tabs.* / chrome.scripting.*
 *     side effects.
 *   - BACK-02 history.length precheck: legit caller with history.length <= 1
 *     returns {status:'no_history'} WITHOUT calling chrome.tabs.goBack.
 *   - D-08 background-tab invariant: legit caller with depth > 1 fires
 *     chrome.tabs.goBack BUT NEVER chrome.tabs.update (no focus stealing).
 *     bindTab is invoked with (agentId, tabId) and the response surfaces
 *     the refreshed ownershipToken.
 *
 * Run: node tests/back-tool-ownership.test.js
 */

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

// ---- mutable harness state -------------------------------------------------

const callLog = {
  tabs_goBack_calls: 0,
  tabs_update_calls: 0,
  tabs_get_calls: 0,
  scripting_executeScript_calls: 0,
  bindTab_calls: []
};

let executeScriptResult = [{ result: 5 }];
let tabGetSequence = null; // function (id, callIndex) => tab
let onUpdatedListeners = [];

function resetCallLog() {
  callLog.tabs_goBack_calls = 0;
  callLog.tabs_update_calls = 0;
  callLog.tabs_get_calls = 0;
  callLog.scripting_executeScript_calls = 0;
  callLog.bindTab_calls = [];
  onUpdatedListeners = [];
}

// ---- chrome mock -----------------------------------------------------------

global.chrome = {
  tabs: {
    async get(id) {
      const idx = callLog.tabs_get_calls;
      callLog.tabs_get_calls++;
      if (typeof tabGetSequence === 'function') return tabGetSequence(id, idx);
      return { id, url: 'https://example.com/before', windowId: 1 };
    },
    async goBack(_id) {
      callLog.tabs_goBack_calls++;
      // Simulate the post-back URL change by advancing the get sequence.
    },
    async update() {
      callLog.tabs_update_calls++;
    },
    async query() {
      return [{ id: 42, url: 'https://example.com/before', windowId: 1, active: true }];
    },
    onUpdated: {
      addListener(fn) {
        onUpdatedListeners.push(fn);
        // Simulate an immediate 'complete' event so waitForBackSettle's
        // onUpdated leg resolves quickly.
        setTimeout(() => {
          try { fn(42, { status: 'complete' }); } catch (_e) {}
        }, 0);
      },
      removeListener(fn) {
        const i = onUpdatedListeners.indexOf(fn);
        if (i !== -1) onUpdatedListeners.splice(i, 1);
      }
    }
  },
  scripting: {
    async executeScript(_cfg) {
      callLog.scripting_executeScript_calls++;
      return executeScriptResult;
    }
  },
  runtime: { lastError: null }
};

// ---- registry mock ---------------------------------------------------------

function makeRegistry({ ownerOf42, owner42Token, captureBindToken }) {
  return {
    hasAgent(id) { return id === 'agent_legit' || id === 'agent_attacker'; },
    isOwnedBy(_tabId, agentId, _token) { return agentId === ownerOf42; },
    getOwner(_tabId) { return ownerOf42; },
    getTabMetadata(_tabId) { return { incognito: false, windowId: 1, ownershipToken: owner42Token, boundAt: Date.now() }; },
    getAgentWindowId(_agentId) { return 1; },
    async bindTab(agentId, tabId) {
      callLog.bindTab_calls.push([agentId, tabId]);
      return { agentId, tabId, ownershipToken: captureBindToken || 'tok_renewed' };
    }
  };
}

// ---- dispatcher load -------------------------------------------------------

const path = require('path');
const dispatcherPath = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-tool-dispatcher.js');
const dispatcher = require(dispatcherPath);

assert(typeof dispatcher.dispatchMcpMessageRoute === 'function',
  'dispatcher exports dispatchMcpMessageRoute (Strategy A: existing tail-of-file module.exports)');
assert(dispatcher.MCP_PHASE199_MESSAGE_ROUTES
  && Object.prototype.hasOwnProperty.call(dispatcher.MCP_PHASE199_MESSAGE_ROUTES, 'mcp:go-back'),
  'MCP_PHASE199_MESSAGE_ROUTES contains mcp:go-back');
assert(dispatcher.MCP_PHASE199_MESSAGE_ROUTES
  && dispatcher.MCP_PHASE199_MESSAGE_ROUTES['mcp:go-back']
  && dispatcher.MCP_PHASE199_MESSAGE_ROUTES['mcp:go-back'].routeFamily === 'browser',
  'mcp:go-back route is in the browser family');

// ---- run tests -------------------------------------------------------------

(async () => {
  // === Test 1: cross-agent reject (BACK-05) ===
  console.log('\n--- Test 1: cross-agent reject (TAB_NOT_OWNED) ---');
  globalThis.fsbAgentRegistryInstance = makeRegistry({
    ownerOf42: 'agent_owner',          // legit owner
    owner42Token: 'tok_owner',
    captureBindToken: 'tok_renewed'
  });
  resetCallLog();

  const r1 = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:go-back',
    payload: { agentId: 'agent_attacker', ownershipToken: 'tok_attacker', tabId: 42 }
  });

  assert(r1 && r1.success === false, 'cross-agent reject returns success:false');
  assert(r1 && r1.code === 'TAB_NOT_OWNED', 'reject code is TAB_NOT_OWNED');
  assert(r1 && r1.ownerAgentId === 'agent_owner', 'reject includes ownerAgentId');
  assert(r1 && r1.requestedTabId === 42, 'reject includes requestedTabId');
  assert(r1 && r1.requestingAgentId === 'agent_attacker', 'reject includes requestingAgentId');
  assert(callLog.tabs_goBack_calls === 0, 'cross-agent reject: chrome.tabs.goBack NOT called');
  assert(callLog.tabs_update_calls === 0, 'cross-agent reject: chrome.tabs.update NOT called');
  assert(callLog.scripting_executeScript_calls === 0, 'cross-agent reject: chrome.scripting.executeScript NOT called');
  assert(callLog.bindTab_calls.length === 0, 'cross-agent reject: bindTab NOT called');

  // === Test 2: legit caller, history.length <= 1 -> no_history (BACK-02) ===
  console.log('\n--- Test 2: legit no_history (history.length <= 1) ---');
  globalThis.fsbAgentRegistryInstance = makeRegistry({
    ownerOf42: 'agent_legit',
    owner42Token: 'tok_legit',
    captureBindToken: 'tok_renewed'
  });
  resetCallLog();
  executeScriptResult = [{ result: 1 }];
  tabGetSequence = (id, _idx) => ({ id, url: 'https://example.com/page', windowId: 1 });

  const r2 = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:go-back',
    payload: { agentId: 'agent_legit', ownershipToken: 'tok_legit', tabId: 42 }
  });

  assert(r2 && r2.success === true, 'no_history returns success:true');
  assert(r2 && r2.status === 'no_history', 'no_history status discriminator');
  assert(r2 && r2.historyDepth === 1, 'no_history historyDepth surfaces precheck value (1)');
  assert(r2 && typeof r2.resultingUrl === 'string', 'no_history resultingUrl is the pre-back URL');
  assert(callLog.tabs_goBack_calls === 0, 'no_history: chrome.tabs.goBack NOT called (precheck rejects)');
  assert(callLog.tabs_update_calls === 0, 'no_history: chrome.tabs.update NEVER called');
  assert(callLog.scripting_executeScript_calls >= 1, 'no_history: precheck executeScript called at least once');

  // === Test 3: legit caller, depth > 1, same-origin path change -> ok ===
  console.log('\n--- Test 3: legit ok (depth > 1, same-origin path change, D-08 invariant) ---');
  globalThis.fsbAgentRegistryInstance = makeRegistry({
    ownerOf42: 'agent_legit',
    owner42Token: 'tok_legit',
    captureBindToken: 'tok_renewed'
  });
  resetCallLog();
  executeScriptResult = [{ result: 5 }];
  // chrome.tabs.get sequence: pre = /before, post = /after.
  tabGetSequence = (id, idx) => idx === 0
    ? { id, url: 'https://example.com/before', windowId: 1 }
    : { id, url: 'https://example.com/after',  windowId: 1 };

  const r3 = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:go-back',
    payload: { agentId: 'agent_legit', ownershipToken: 'tok_legit', tabId: 42 }
  });

  assert(r3 && r3.success === true, 'legit ok: success:true');
  assert(
    r3 && (r3.status === 'ok' || r3.status === 'cross_origin' || r3.status === 'fragment_only' || r3.status === 'bf_cache'),
    'legit ok: status is one of the 4 non-no_history codes (ok/cross_origin/fragment_only/bf_cache)'
  );
  assert(r3 && r3.resultingUrl === 'https://example.com/after', 'legit ok: resultingUrl reflects post-back URL');
  assert(r3 && r3.historyDepth === 5, 'legit ok: historyDepth surfaces precheck value (5)');
  assert(callLog.tabs_goBack_calls === 1, 'legit ok: chrome.tabs.goBack called exactly once');
  assert(callLog.tabs_update_calls === 0, 'legit ok: chrome.tabs.update NEVER called (D-08 background-tab invariant)');
  assert(callLog.bindTab_calls.length === 1
    && callLog.bindTab_calls[0][0] === 'agent_legit'
    && callLog.bindTab_calls[0][1] === 42,
    'legit ok: bindTab called with (agent_legit, 42)');
  assert(r3 && r3.ownershipToken === 'tok_renewed', 'legit ok: ownershipToken refreshed from bindTab');

  // === Test 4: defaultTabId via no payload.tabId resolves through getActiveTabFromClient ===
  // (Sanity: confirm the active-tab resolver path also obeys the D-08 invariant.)
  console.log('\n--- Test 4: legit ok via active tab (no payload.tabId) ---');
  globalThis.fsbAgentRegistryInstance = makeRegistry({
    ownerOf42: 'agent_legit',
    owner42Token: 'tok_legit',
    captureBindToken: 'tok_renewed_active'
  });
  resetCallLog();
  executeScriptResult = [{ result: 7 }];
  tabGetSequence = (id, idx) => idx === 0
    ? { id, url: 'https://example.com/before', windowId: 1 }
    : { id, url: 'https://example.com/after',  windowId: 1 };

  const r4 = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:go-back',
    payload: { agentId: 'agent_legit', ownershipToken: 'tok_legit' }
  });

  assert(r4 && r4.success === true, 'active-tab path: success:true');
  assert(r4 && r4.tabId === 42, 'active-tab path: resolved tabId is 42 (chrome.tabs.query mock)');
  assert(callLog.tabs_update_calls === 0, 'active-tab path: chrome.tabs.update NEVER called');
  assert(callLog.tabs_goBack_calls === 1, 'active-tab path: chrome.tabs.goBack called exactly once');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('FATAL:', err && err.stack ? err.stack : err);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (with FATAL) ===`);
  process.exit(2);
});
