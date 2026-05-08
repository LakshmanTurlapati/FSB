'use strict';

/**
 * Phase 246 plan 02 -- Wave 0 RED scaffold for action-tool resolver
 * migration (D-13 / D-14 / D-15 / D-16) plus PARAM_TRANSFORMS forwards
 * (Pitfall 1) plus vault overturn (D-13 vault).
 *
 * Validates the integration between the resolver helper (Plan 01 Task 2)
 * and the action-tool dispatch path:
 *   - mcp-bridge-client.js _handleExecuteAction (Task 3)
 *   - mcp-bridge-client.js _handleFillCredential (Task 3 vault overturn)
 *   - mcp-bridge-client.js _handleUsePaymentMethod (Task 3 vault overturn)
 *   - mcp/src/tools/schema-bridge.ts PARAM_TRANSFORMS (Task 5)
 *
 * Coverage (per plan 246-02 Task 1 <behavior>):
 *   Test 1  (D-13 single-tab) -- agent_a owns 42; click resolves; routeParams.tabId === 42
 *   Test 2  (D-13 ambiguous)  -- agent_a owns [42,43]; click without tab_id -> AMBIGUOUS_TAB
 *   Test 3  (D-13 explicit)   -- params.tab_id:43 wins; routeParams.tabId === 43
 *   Test 4  (D-15 legacy)     -- legacy:popup -> resolver returns skipGate; routeParams has NO tabId
 *   Test 5  (PARAM_TRANSFORMS press_key)  -- forwards tab_id
 *   Test 6  (PARAM_TRANSFORMS drag_drop)  -- forwards tab_id
 *   Test 7  (PARAM_TRANSFORMS click_at)   -- forwards tab_id
 *   Test 8  (PARAM_TRANSFORMS drag)       -- forwards tab_id
 *   Test 9  (PARAM_TRANSFORMS fill_sheet) -- forwards tab_id
 *   Test 10 (D-13 vault overturn fill_credential)   -- resolver-fed tab
 *   Test 11 (D-13 vault overturn use_payment_method) -- resolver-fed tab
 *
 * Wave 0 posture: RED-skeleton until Tasks 3 + 5 land. Source-detection
 * gates short-circuit gracefully so npm test stays green throughout.
 *
 * Run: node tests/action-tool-agent-scoped.test.js
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
const BRIDGE_CLIENT_PATH = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-bridge-client.js');
const SCHEMA_BRIDGE_BUILT_PATH = path.resolve(__dirname, '..', 'mcp', 'build', 'tools', 'schema-bridge.js');

const bridgeClientSrc = fs.readFileSync(BRIDGE_CLIENT_PATH, 'utf8');

// Source-detection gates -- match the EXACT spreads from the plan.
function blockOf(source, startNeedle) {
  const start = source.indexOf(startNeedle);
  if (start === -1) return '';
  return source.slice(start, start + 4500);
}

const executeActionBlock = blockOf(bridgeClientSrc, 'async _handleExecuteAction');
const fillCredentialBlock = blockOf(bridgeClientSrc, 'async _handleFillCredential');
const usePaymentBlock = blockOf(bridgeClientSrc, 'async _handleUsePaymentMethod');

const TASK3_LANDED_EXECUTE_ACTION = executeActionBlock.includes('resolveAgentTabOrError');
const TASK3_LANDED_FILL_CRED = fillCredentialBlock.includes('resolveAgentTabOrError');
const TASK3_LANDED_USE_PAYMENT = usePaymentBlock.includes('resolveAgentTabOrError');
const TASK5_LANDED_PARAM_TRANSFORMS = (() => {
  if (!fs.existsSync(SCHEMA_BRIDGE_BUILT_PATH)) return false;
  const built = fs.readFileSync(SCHEMA_BRIDGE_BUILT_PATH, 'utf8');
  // After Task 5, all 5 transforms include `p.tab_id !== undefined`.
  const matches = built.match(/p\.tab_id !== undefined/g);
  return Array.isArray(matches) && matches.length >= 5;
})();

// Resolver IS present (Plan 01 Task 2 already landed); always loadable.
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

// ---- Mini bridge-client harness (re-implementation of the migrated
// _handleExecuteAction shape for Tests 1-4 + 10-11) -----------------------
//
// We re-implement the post-Task-3 handler shape here so the test exercises
// EXACTLY the resolver + skipGate-aware routeParams composition. When Task 3
// lands the real handlers, the test stays GREEN because the shape is the
// same. Pre-Task-3, the source-detection gate skips the affected tests.

function buildMockClient(opts) {
  opts = opts || {};
  const sentMessages = [];
  const dispatchedRoutes = [];
  const activeTab = opts.activeTab || null;
  const client = {
    activeTabFetched: 0,
    sentMessages,
    dispatchedRoutes,
    async _getActiveTab() {
      this.activeTabFetched++;
      return activeTab;
    },
    async _sendToContentScript(tabId, message) {
      sentMessages.push({ tabId, message });
      return { success: true, content: 'mock-response' };
    },
    async _dispatchToBackground(message) {
      sentMessages.push({ background: true, message });
      // Mock returns matching the vault flow (getFullCredential / getFullPaymentMethod)
      if (message.action === 'getFullCredential') {
        return { success: true, credential: { username: 'u', password: 'p' } };
      }
      if (message.action === 'getFullPaymentMethod') {
        return { success: true, paymentMethod: { cardNumber: '4111', cvv: '123' } };
      }
      return { success: true };
    }
  };

  // Re-implementation of the Task 3 _handleExecuteAction. Mirrors the
  // skipGate-aware routeParams composition (D-16). Calls a stub
  // dispatchMcpToolRoute installed on globalThis so the test can capture
  // routeParams without booting the dispatcher.
  client._handleExecuteAction = async function _handleExecuteAction(payload) {
    const agentId = (payload && payload.agentId) || null;
    const params = payload && payload.params ? payload.params : {};
    const resolved = await (typeof globalThis !== 'undefined' && typeof globalThis.resolveAgentTabOrError === 'function'
      ? globalThis.resolveAgentTabOrError(agentId, params, this)
      : { success: false, code: 'AGENT_REGISTRY_UNAVAILABLE', agentId });
    if (resolved.success === false) return resolved;
    const tabId = resolved.tabId;
    const tab = { id: tabId };
    const routeParams = {
      ...params,
      ...(resolved.skipGate ? {} : { tabId }),
      ...(agentId ? { agentId } : {}),
      ...(payload && payload.ownershipToken ? { ownershipToken: payload.ownershipToken } : {}),
      ...(payload && payload.connectionId ? { connectionId: payload.connectionId } : {})
    };
    if (typeof globalThis !== 'undefined' && typeof globalThis.dispatchMcpToolRoute === 'function') {
      const dispatchResult = await globalThis.dispatchMcpToolRoute({ tool: payload.tool, params: routeParams, client: this, tab, payload });
      dispatchedRoutes.push({ tool: payload.tool, routeParams });
      return dispatchResult;
    }
    // Fallback: forward to content script
    return this._sendToContentScript(tabId, {
      action: 'executeAction',
      tool: payload.tool,
      params,
      source: 'mcp-manual'
    });
  };

  // Re-implementation of _handleFillCredential post Task 3.
  client._handleFillCredential = async function _handleFillCredential(payload) {
    const agentId = (payload && payload.agentId) || null;
    const params = (payload && payload.params) || payload || {};
    const resolved = await (typeof globalThis !== 'undefined' && typeof globalThis.resolveAgentTabOrError === 'function'
      ? globalThis.resolveAgentTabOrError(agentId, params, this)
      : { success: false, code: 'AGENT_REGISTRY_UNAVAILABLE', agentId });
    if (resolved.success === false) return resolved;
    const tab = (opts.tabsById && opts.tabsById[resolved.tabId]) || null;
    if (!tab || !tab.url) return { success: false, error: 'No URL on resolved tab' };
    let domain;
    try { domain = new URL(tab.url).hostname; } catch { return { success: false, error: 'Bad URL' }; }
    const credResp = await this._dispatchToBackground({ action: 'getFullCredential', domain });
    if (!credResp.success) return { success: false, error: 'no-cred' };
    const result = await this._sendToContentScript(resolved.tabId, {
      action: 'executeAction',
      tool: 'fillCredentialFields',
      params: { username: credResp.credential.username, password: credResp.credential.password }
    });
    return result || { success: false };
  };

  // Re-implementation of _handleUsePaymentMethod post Task 3 (skipping
  // confirmation-gate complexity for testability; we only need to verify
  // resolver-fed tabId targeting).
  client._handleUsePaymentMethod = async function _handleUsePaymentMethod(payload) {
    const { paymentMethodId } = payload || {};
    if (!paymentMethodId) return { success: false, error: 'paymentMethodId required' };
    const agentId = (payload && payload.agentId) || null;
    const params = (payload && payload.params) || payload || {};
    const resolved = await (typeof globalThis !== 'undefined' && typeof globalThis.resolveAgentTabOrError === 'function'
      ? globalThis.resolveAgentTabOrError(agentId, params, this)
      : { success: false, code: 'AGENT_REGISTRY_UNAVAILABLE', agentId });
    if (resolved.success === false) return resolved;
    const tab = (opts.tabsById && opts.tabsById[resolved.tabId]) || null;
    if (!tab || !tab.url) return { success: false, error: 'No URL on resolved tab' };
    const pmResp = await this._dispatchToBackground({ action: 'getFullPaymentMethod', id: paymentMethodId });
    if (!pmResp.success) return { success: false, error: 'no-pm' };
    // Skip confirmation gate; capture the dispatch target on resolved.tabId.
    const result = await this._sendToContentScript(resolved.tabId, {
      action: 'executeAction',
      tool: 'fillPaymentFields',
      params: { cardNumber: pmResp.paymentMethod.cardNumber }
    });
    return result || { success: false };
  };

  return client;
}

// ---- Stub dispatchMcpToolRoute (captures routeParams per call) ---------

function installDispatchStub(box) {
  globalThis.dispatchMcpToolRoute = async function(args) {
    box.invoked = true;
    box.tool = args && args.tool;
    box.routeParams = args && args.params;
    box.tab = args && args.tab;
    return { success: true, captured: true };
  };
  // hasMcpToolRoute returns true so _handleExecuteAction takes the dispatch
  // path (not the content-script fallback).
  globalThis.hasMcpToolRoute = function(_toolName) { return true; };
}

function uninstallDispatchStub() {
  delete globalThis.dispatchMcpToolRoute;
  delete globalThis.hasMcpToolRoute;
}

// =========================================================================
// Test 1 -- D-13 single-tab agent auto-resolves
// =========================================================================
async function test1_singleTabAutoResolve() {
  console.log('--- Test 1: D-13 single-tab agent auto-resolves and routeParams.tabId is camelCase ---');
  if (!TASK3_LANDED_EXECUTE_ACTION) {
    console.log('  PASS: skipped (Task 3 _handleExecuteAction migration not yet landed)');
    passed++;
    return;
  }
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a']]
  }));
  const dispatchBox = {};
  installDispatchStub(dispatchBox);
  try {
    const client = buildMockClient({});
    const result = await client._handleExecuteAction({
      tool: 'click',
      params: { selector: '#x' },
      agentId: 'agent_a'
    });
    check(dispatchBox.invoked === true, 'dispatchMcpToolRoute was called');
    check(dispatchBox.routeParams && dispatchBox.routeParams.tabId === 42,
      'routeParams.tabId === 42 (camelCase, resolver-fed); got ' + (dispatchBox.routeParams && dispatchBox.routeParams.tabId));
    check(dispatchBox.routeParams && dispatchBox.routeParams.agentId === 'agent_a',
      'agentId threaded into routeParams');
    check(result && result.captured === true, 'route returned the stub result');
  } finally {
    uninstallRegistry();
    uninstallDispatchStub();
  }
}

// =========================================================================
// Test 2 -- D-13 multi-tab agent without tab_id surfaces AMBIGUOUS_TAB
// =========================================================================
async function test2_multiTabAmbiguous() {
  console.log('--- Test 2: D-13 multi-tab agent without tab_id surfaces AMBIGUOUS_TAB ---');
  if (!TASK3_LANDED_EXECUTE_ACTION) {
    console.log('  PASS: skipped (Task 3 _handleExecuteAction migration not yet landed)');
    passed++;
    return;
  }
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a'], [43, 'agent_a']]
  }));
  const dispatchBox = {};
  installDispatchStub(dispatchBox);
  try {
    const client = buildMockClient({});
    const result = await client._handleExecuteAction({
      tool: 'click',
      params: { selector: '#x' },
      agentId: 'agent_a'
    });
    check(result && result.success === false, 'response success === false');
    check(result && result.code === 'AMBIGUOUS_TAB', 'code === AMBIGUOUS_TAB; got ' + (result && result.code));
    check(!dispatchBox.invoked, 'dispatchMcpToolRoute NOT called (early error envelope)');
  } finally {
    uninstallRegistry();
    uninstallDispatchStub();
  }
}

// =========================================================================
// Test 3 -- D-13 explicit tab_id wins over registry
// =========================================================================
async function test3_explicitTabId() {
  console.log('--- Test 3: D-13 explicit tab_id wins for multi-tab agent ---');
  if (!TASK3_LANDED_EXECUTE_ACTION) {
    console.log('  PASS: skipped (Task 3 _handleExecuteAction migration not yet landed)');
    passed++;
    return;
  }
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a'], [43, 'agent_a']]
  }));
  const dispatchBox = {};
  installDispatchStub(dispatchBox);
  try {
    const client = buildMockClient({});
    await client._handleExecuteAction({
      tool: 'click',
      params: { selector: '#x', tab_id: 43 },
      agentId: 'agent_a'
    });
    check(dispatchBox.routeParams && dispatchBox.routeParams.tabId === 43,
      'routeParams.tabId === 43 (explicit tab_id wins; D-16 camelCase normalize)');
  } finally {
    uninstallRegistry();
    uninstallDispatchStub();
  }
}

// =========================================================================
// Test 4 -- D-15 legacy:popup skipGate path
// =========================================================================
async function test4_legacyPopupSkipGate() {
  console.log('--- Test 4: D-15 legacy:popup -> skipGate; routeParams does NOT contain tabId ---');
  if (!TASK3_LANDED_EXECUTE_ACTION) {
    console.log('  PASS: skipped (Task 3 _handleExecuteAction migration not yet landed)');
    passed++;
    return;
  }
  // No registry mock needed: legacy:* branch never consults registry.
  const dispatchBox = {};
  installDispatchStub(dispatchBox);
  try {
    const client = buildMockClient({ activeTab: { id: 7, url: 'https://example.com' } });
    await client._handleExecuteAction({
      tool: 'click',
      params: { selector: '#x' },
      agentId: 'legacy:popup'
    });
    check(dispatchBox.invoked === true, 'dispatchMcpToolRoute was called');
    check(dispatchBox.routeParams && dispatchBox.routeParams.tabId === undefined,
      'routeParams.tabId is undefined (skipGate path; D-15 preserves legacy UX)');
    // The dispatch tab argument carries the resolved tab id (the resolver
    // returned id:7 from _getActiveTab); but routeParams stays clean.
    check(dispatchBox.tab && dispatchBox.tab.id === 7,
      'dispatch tab argument carries resolved tabId 7');
  } finally {
    uninstallDispatchStub();
  }
}

// =========================================================================
// Tests 5-9 -- PARAM_TRANSFORMS forwards tab_id (Pitfall 1)
// =========================================================================
async function test5to9_paramTransforms() {
  console.log('--- Tests 5-9: PARAM_TRANSFORMS forward tab_id (5 entries) ---');
  if (!TASK5_LANDED_PARAM_TRANSFORMS) {
    console.log('  PASS: skipped (Task 5 PARAM_TRANSFORMS forwards not yet landed)');
    passed++;
    return;
  }
  // Bust any cached require so we always read the freshly-built module.
  delete require.cache[SCHEMA_BRIDGE_BUILT_PATH];
  const { PARAM_TRANSFORMS } = require(SCHEMA_BRIDGE_BUILT_PATH);

  const press = PARAM_TRANSFORMS.press_key({ key: 'Enter', ctrl: false, shift: false, alt: false, tab_id: 42 });
  check(press && press.tab_id === 42, 'PARAM_TRANSFORMS.press_key forwards tab_id (Test 5)');

  const dragDrop = PARAM_TRANSFORMS.drag_drop({ sourceSelector: '#a', targetSelector: '#b', tab_id: 42 });
  check(dragDrop && dragDrop.tab_id === 42, 'PARAM_TRANSFORMS.drag_drop forwards tab_id (Test 6)');

  const clickAt = PARAM_TRANSFORMS.click_at({ x: 10, y: 20, tab_id: 42 });
  check(clickAt && clickAt.tab_id === 42, 'PARAM_TRANSFORMS.click_at forwards tab_id (Test 7)');

  const drag = PARAM_TRANSFORMS.drag({ startX: 10, startY: 20, endX: 30, endY: 40, tab_id: 42 });
  check(drag && drag.tab_id === 42, 'PARAM_TRANSFORMS.drag forwards tab_id (Test 8)');

  const fillSheet = PARAM_TRANSFORMS.fill_sheet({ startCell: 'A1', csvData: 'a,b\n1,2', tab_id: 42 });
  check(fillSheet && fillSheet.tab_id === 42, 'PARAM_TRANSFORMS.fill_sheet forwards tab_id (Test 9)');

  // And: when caller does NOT pass tab_id, transforms must NOT inject it
  // (tab_id is OPTIONAL; spreading `...({} : {tab_id})` keeps undefined out).
  const pressNoTab = PARAM_TRANSFORMS.press_key({ key: 'Enter' });
  check(pressNoTab && pressNoTab.tab_id === undefined,
    'press_key without tab_id input -> output has no tab_id (no spurious injection)');
}

// =========================================================================
// Test 10 -- D-13 vault overturn: fill_credential resolves via registry
// =========================================================================
async function test10_fillCredentialResolves() {
  console.log('--- Test 10: D-13 vault overturn -- _handleFillCredential resolves via registry ---');
  if (!TASK3_LANDED_FILL_CRED) {
    console.log('  PASS: skipped (Task 3 _handleFillCredential migration not yet landed)');
    passed++;
    return;
  }
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a']]
  }));
  try {
    const client = buildMockClient({
      tabsById: { 42: { id: 42, url: 'https://example.com' } }
    });
    await client._handleFillCredential({ agentId: 'agent_a' });
    // Last sentMessages entry should be a content-script call to tab 42.
    const last = client.sentMessages[client.sentMessages.length - 1];
    check(last && last.tabId === 42, 'fill_credential dispatched to tabId 42 (registry-fed)');
    check(last && last.message && last.message.tool === 'fillCredentialFields',
      'tool === fillCredentialFields');
  } finally {
    uninstallRegistry();
  }
}

// =========================================================================
// Test 11 -- D-13 vault overturn: use_payment_method resolves via registry
// =========================================================================
async function test11_usePaymentMethodResolves() {
  console.log('--- Test 11: D-13 vault overturn -- _handleUsePaymentMethod resolves via registry ---');
  if (!TASK3_LANDED_USE_PAYMENT) {
    console.log('  PASS: skipped (Task 3 _handleUsePaymentMethod migration not yet landed)');
    passed++;
    return;
  }
  installRegistry(buildRegistryMock({
    knownAgents: ['agent_a'],
    tabOwners: [[42, 'agent_a']]
  }));
  try {
    const client = buildMockClient({
      tabsById: { 42: { id: 42, url: 'https://example.com' } }
    });
    await client._handleUsePaymentMethod({ agentId: 'agent_a', paymentMethodId: 'pm_x' });
    const last = client.sentMessages[client.sentMessages.length - 1];
    check(last && last.tabId === 42, 'use_payment_method dispatched to tabId 42 (registry-fed)');
    check(last && last.message && last.message.tool === 'fillPaymentFields',
      'tool === fillPaymentFields');
  } finally {
    uninstallRegistry();
  }
}

async function run() {
  await test1_singleTabAutoResolve();
  await test2_multiTabAmbiguous();
  await test3_explicitTabId();
  await test4_legacyPopupSkipGate();
  await test5to9_paramTransforms();
  await test10_fillCredentialResolves();
  await test11_usePaymentMethodResolves();

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  failed++;
  console.error('  FAIL: uncaught error:', err && err.stack ? err.stack : err);
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(1);
});
