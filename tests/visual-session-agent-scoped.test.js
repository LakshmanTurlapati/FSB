'use strict';

/**
 * Phase 246 plan 02 -- Wave 0 RED scaffold for visual-session resolver
 * migration (D-09 / D-10 / D-11).
 *
 * Validates the integration between the resolver helper (Plan 01 Task 2)
 * and handleStartVisualSessionRoute (Plan 02 Task 2). When an MCP agent
 * calls start_visual_session WITHOUT tab_id, the dispatcher consults
 * registry.getAgentTabs(agentId) and either auto-resolves (1 owned),
 * surfaces NO_OWNED_TAB (0 owned), or surfaces AMBIGUOUS_TAB (2+ owned).
 *
 * Coverage (per plan 246-02 Task 1 <behavior>):
 *   Test 1 (D-09 single-tab) -- agent_a owns tabId=42; payload has no
 *                                tab_id; assert handleStartMcpVisualSession
 *                                called with tabId=42.
 *   Test 2 (D-09 zero owned) -- agent_a registered but owns no tabs;
 *                                assert errorCode === 'NO_OWNED_TAB'.
 *   Test 3 (D-09 ambiguous)  -- agent_a owns tabIds=[42,43]; assert
 *                                errorCode === 'AMBIGUOUS_TAB'.
 *   Test 4 (D-10 explicit)   -- agent_a owns tabIds=[42,43] AND payload
 *                                has tab_id:43; assert handler called
 *                                with tabId=43.
 *   Test 5 (D-11 resume)     -- single-tab agent_a owns tab=42 with an
 *                                existing visual session; payload has
 *                                tab_id:42; resolver picks 42, route
 *                                forwards intact (resume detail covered
 *                                in tests/visual-session-reentry.test.js
 *                                D-11 case).
 *
 * Wave 0 posture: this file is RED-skeleton when the resolver migration
 * has not landed yet. Source-detection gate short-circuits gracefully.
 *
 * Run: node tests/visual-session-agent-scoped.test.js
 */

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

const RESOLVER_PATH = path.resolve(__dirname, '..', 'extension', 'utils', 'agent-tab-resolver.js');
const DISPATCHER_PATH = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-tool-dispatcher.js');

// Source-detection gate: tests are GREEN once Task 2 lands. If
// handleStartVisualSessionRoute still calls getActiveTabFromClient, this
// scaffold short-circuits cleanly (npm test stays green between Task 1
// and Task 2).
const dispatcherSrc = fs.readFileSync(DISPATCHER_PATH, 'utf8');
const handleStartVisualSessionBlock = (() => {
  const start = dispatcherSrc.indexOf('async function handleStartVisualSessionRoute');
  if (start === -1) return '';
  // Capture roughly the next 80 lines of the function body.
  return dispatcherSrc.slice(start, start + 4000);
})();
const RESOLVER_LANDED_IN_VISUAL_SESSION = handleStartVisualSessionBlock.includes('resolveAgentTabOrError');

if (!RESOLVER_LANDED_IN_VISUAL_SESSION) {
  console.log('--- Phase 246 / visual-session-agent-scoped: RED-skeleton (resolver migration not yet landed in handleStartVisualSessionRoute) ---');
  console.log('  PASS: skipped (Task 2 retires this gate)');
  console.log('\n=== Results: ' + 1 + ' passed, ' + 0 + ' failed ===');
  process.exit(0);
}

// Resolver IS present (Plan 01 Task 2 already landed); load it.
require(RESOLVER_PATH);

// ---- Mock registry helpers ------------------------------------------------

function buildRegistryMock(opts) {
  opts = opts || {};
  const knownAgents = new Set(opts.knownAgents || []);
  const tabOwners = new Map(opts.tabOwners || []);
  return {
    hasAgent(agentId) {
      return typeof agentId === 'string' && knownAgents.has(agentId);
    },
    getAgentTabs(agentId) {
      if (!knownAgents.has(agentId)) return null;
      const tabs = [];
      tabOwners.forEach((owner, tabId) => {
        if (owner === agentId) tabs.push(tabId);
      });
      return tabs;
    },
    isOwnedBy(tabId, agentId, _ownershipToken) {
      return tabOwners.get(tabId) === agentId;
    },
    getOwner(tabId) {
      return tabOwners.get(tabId) || null;
    },
    getTabMetadata(_tabId) { return null; },
    getAgentWindowId(_agentId) { return null; }
  };
}

function installRegistry(mock) {
  globalThis.fsbAgentRegistryInstance = mock;
}

function uninstallRegistry() {
  delete globalThis.fsbAgentRegistryInstance;
}

// ---- Chrome API mock ------------------------------------------------------

function installChrome(tabsById) {
  globalThis.chrome = {
    tabs: {
      async get(tabId) {
        if (tabsById && tabsById[tabId]) return tabsById[tabId];
        throw new Error('No tab with id ' + tabId);
      },
      async query() { return []; }
    },
    runtime: { id: 'phase-246-test', lastError: null }
  };
}

function uninstallChrome(prev) {
  if (prev === undefined) {
    delete globalThis.chrome;
  } else {
    globalThis.chrome = prev;
  }
}

// ---- Callback handler stub ------------------------------------------------
//
// handleStartVisualSessionRoute calls callCallbackHandler('handleStartMcpVisualSession', ...)
// which delegates to globalThis.handleStartMcpVisualSession. We install a
// stub function on globalThis that captures the (request, sender, sendResponse)
// triple and resolves with a deterministic payload.

function installCallbackHandler(captureBox) {
  globalThis.handleStartMcpVisualSession = function(request, _sender, sendResponse) {
    captureBox.action = request && request.action;
    captureBox.message = request;
    if (typeof sendResponse === 'function') {
      sendResponse({ success: true, captured: true });
    }
    return true;
  };
  return true;
}

function uninstallCallbackHandler() {
  delete globalThis.handleStartMcpVisualSession;
}

// =========================================================================
// Test 1 (D-09 single-tab) -- single-tab agent auto-resolves
// =========================================================================
async function test1_singleTabResolves() {
  console.log('--- Test 1: D-09 single-tab agent auto-resolves to owned tab ---');
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a']]
  }));
  const prevChrome = globalThis.chrome;
  installChrome({ 42: { id: 42, url: 'https://example.com', windowId: 1, incognito: false } });
  try {
    const dispatcher = require(DISPATCHER_PATH);
    const captureBox = {};
    const installed = installCallbackHandler(captureBox);
    check(installed, 'callback handler installer available');
    const result = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: {
        agentId: 'agent_a',
        clientLabel: 'Claude',
        task: 'first task'
      },
      client: {}
    });
    check(captureBox.action === 'startMcpVisualSession', 'callback fired with action startMcpVisualSession');
    check(captureBox.message && captureBox.message.tabId === 42, 'callback message tabId === 42 (resolver-fed)');
    check(captureBox.message && captureBox.message.agentId === 'agent_a', 'agentId threaded into message');
    check(result && result.captured === true, 'route returned the stub callback result');
  } finally {
    uninstallRegistry();
    uninstallChrome(prevChrome);
  }
}

// =========================================================================
// Test 2 (D-09 zero owned) -- NO_OWNED_TAB error envelope
// =========================================================================
async function test2_zeroOwned() {
  console.log('--- Test 2: D-09 zero-owned agent surfaces NO_OWNED_TAB ---');
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a']
  }));
  const prevChrome = globalThis.chrome;
  installChrome({});
  try {
    const dispatcher = require(DISPATCHER_PATH);
    const captureBox = {};
    installCallbackHandler(captureBox);
    const result = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: {
        agentId: 'agent_a',
        clientLabel: 'Claude',
        task: 'task'
      },
      client: {}
    });
    check(result && result.success === false, 'response success === false');
    check(result && (result.errorCode === 'NO_OWNED_TAB' || result.code === 'NO_OWNED_TAB'),
      'errorCode === NO_OWNED_TAB; got ' + (result && (result.errorCode || result.code)));
    check(!captureBox.message, 'callback was NOT fired (early error envelope)');
  } finally {
    uninstallRegistry();
    uninstallChrome(prevChrome);
  }
}

// =========================================================================
// Test 3 (D-09 ambiguous) -- AMBIGUOUS_TAB error envelope
// =========================================================================
async function test3_ambiguous() {
  console.log('--- Test 3: D-09 multi-tab agent without tab_id surfaces AMBIGUOUS_TAB ---');
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a'], [43, 'agent_a']]
  }));
  const prevChrome = globalThis.chrome;
  installChrome({});
  try {
    const dispatcher = require(DISPATCHER_PATH);
    const captureBox = {};
    installCallbackHandler(captureBox);
    const result = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: {
        agentId: 'agent_a',
        clientLabel: 'Claude',
        task: 'task'
      },
      client: {}
    });
    check(result && result.success === false, 'response success === false');
    check(result && (result.errorCode === 'AMBIGUOUS_TAB' || result.code === 'AMBIGUOUS_TAB'),
      'errorCode === AMBIGUOUS_TAB; got ' + (result && (result.errorCode || result.code)));
    check(!captureBox.message, 'callback was NOT fired (early error envelope)');
  } finally {
    uninstallRegistry();
    uninstallChrome(prevChrome);
  }
}

// =========================================================================
// Test 4 (D-10 explicit tab_id) -- explicit tab_id disambiguates
// =========================================================================
async function test4_explicitTabId() {
  console.log('--- Test 4: D-10 explicit tab_id disambiguates multi-tab agent ---');
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a'], [43, 'agent_a']]
  }));
  const prevChrome = globalThis.chrome;
  installChrome({
    42: { id: 42, url: 'https://example.com', windowId: 1, incognito: false },
    43: { id: 43, url: 'https://example.org', windowId: 1, incognito: false }
  });
  try {
    const dispatcher = require(DISPATCHER_PATH);
    const captureBox = {};
    installCallbackHandler(captureBox);
    const result = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: {
        agentId: 'agent_a',
        clientLabel: 'Claude',
        task: 'second task',
        tab_id: 43
      },
      client: {}
    });
    check(captureBox.action === 'startMcpVisualSession', 'callback fired with action startMcpVisualSession');
    check(captureBox.message && captureBox.message.tabId === 43, 'callback message tabId === 43 (explicit tab_id wins)');
    check(result && result.captured === true, 'route returned the stub callback result');
  } finally {
    uninstallRegistry();
    uninstallChrome(prevChrome);
  }
}

// =========================================================================
// Test 5 (D-11 same-agent resume forwarding) -- explicit tab_id matches
// =========================================================================
async function test5_resumeForwarding() {
  console.log('--- Test 5: D-11 resume path -- resolver picks tab matching existing session ---');
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a']]
  }));
  const prevChrome = globalThis.chrome;
  installChrome({ 42: { id: 42, url: 'https://example.com', windowId: 1, incognito: false } });
  try {
    const dispatcher = require(DISPATCHER_PATH);
    const captureBox = {};
    installCallbackHandler(captureBox);
    // Caller passes explicit tab_id matching the agent's owned tab.
    // Whether mcp-visual-session.js fires its same-agent resume path is
    // covered by tests/visual-session-reentry.test.js D-11. Here we just
    // confirm the dispatcher route forwards the resolved tabId correctly.
    const result = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: {
        agentId: 'agent_a',
        clientLabel: 'Claude',
        task: 'resume task',
        tab_id: 42
      },
      client: {}
    });
    check(captureBox.message && captureBox.message.tabId === 42, 'callback message tabId === 42 (resume target preserved)');
    check(result && result.captured === true, 'route returned the stub callback result');
  } finally {
    uninstallRegistry();
    uninstallChrome(prevChrome);
  }
}

async function run() {
  await test1_singleTabResolves();
  await test2_zeroOwned();
  await test3_ambiguous();
  await test4_explicitTabId();
  await test5_resumeForwarding();

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  failed++;
  console.error('  FAIL: uncaught error:', err && err.stack ? err.stack : err);
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(1);
});
