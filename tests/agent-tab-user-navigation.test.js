'use strict';

/**
 * Phase 243 plan 02 -- BG-04 webNavigation user-initiated pause-emission +
 * 500ms agent-nav suppression.
 *
 * Validates:
 *   Task 1 (RED -> GREEN by Task 1 commit):
 *     1. agent-registry exposes stampAgentNavigation(tabId) and writes
 *        Date.now() onto _tabMetadata[tabId].lastAgentNavigationAt.
 *     2. getTabMetadata(tabId) surfaces lastAgentNavigationAt back to callers.
 *     3. When stampAgentNavigation has not been called, the suppression check
 *        Date.now() - lastAgentNav > 500 evaluates true (no false suppression).
 *
 *   Task 2 (RED here -> GREEN after listener helper extraction):
 *     4(a) Helper emits when frameId === 0, transitionType in user-initiated
 *          set, owner is non-legacy agent_*, and no recent stamp.
 *     4(b) Helper does NOT emit when owner starts with 'legacy:'.
 *     4(c) Helper does NOT emit when frameId !== 0 (subframe).
 *     4(d) Helper does NOT emit for excluded transitionType
 *          (form_submit / auto_subframe / generated / start_page / keyword /
 *          keyword_generated / manual_subframe).
 *     4(e) Helper does NOT emit when stamp is within 500ms of `now` (Pitfall 2
 *          Phase 242 back transitionType auto_bookmark false-positive guard).
 *     4(f) Helper does NOT emit when registry.findAgentByTabId returns null.
 *
 * Run: node --test tests/agent-tab-user-navigation.test.js
 *      (or `node tests/agent-tab-user-navigation.test.js` -- this file uses
 *      plain `assert` + console.log per agent-cap-ui.test.js convention so
 *      either invocation works.)
 */

const assert = require('assert');
const path = require('path');

const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

// ---------------------------------------------------------------------------
// Test 1 -- stampAgentNavigation writes lastAgentNavigationAt
// ---------------------------------------------------------------------------
console.log('--- Test 1: stampAgentNavigation writes lastAgentNavigationAt ---');
{
  // Fresh require so a clean module cache is used.
  delete require.cache[REGISTRY_MODULE_PATH];
  const { AgentRegistry } = require(REGISTRY_MODULE_PATH);
  const registry = new AgentRegistry();

  // Use bindTab? No -- bindTab requires chrome.tabs.get. Stamp directly on
  // a tabId; the helper must auto-create the metadata bucket if missing.
  const tabId = 4242;
  const before = Date.now();
  registry.stampAgentNavigation(tabId);
  const after = Date.now();

  const meta = registry.getTabMetadata(tabId);
  assert.ok(meta, 'getTabMetadata returns a non-null object after stamp');
  assert.ok(typeof meta.lastAgentNavigationAt === 'number',
    'lastAgentNavigationAt is a number');
  assert.ok(meta.lastAgentNavigationAt >= before && meta.lastAgentNavigationAt <= after,
    'lastAgentNavigationAt is bounded by Date.now() before/after the call');
}
console.log('  PASS');

// ---------------------------------------------------------------------------
// Test 2 -- stampAgentNavigation is idempotent across repeated calls
// ---------------------------------------------------------------------------
console.log('--- Test 2: stampAgentNavigation is idempotent (re-stamps successfully) ---');
{
  delete require.cache[REGISTRY_MODULE_PATH];
  const { AgentRegistry } = require(REGISTRY_MODULE_PATH);
  const registry = new AgentRegistry();
  const tabId = 7;
  registry.stampAgentNavigation(tabId);
  const first = registry.getTabMetadata(tabId).lastAgentNavigationAt;
  // Spin briefly so Date.now() increments.
  const t0 = Date.now();
  while (Date.now() === t0) { /* spin */ }
  registry.stampAgentNavigation(tabId);
  const second = registry.getTabMetadata(tabId).lastAgentNavigationAt;
  assert.ok(second >= first, 'second stamp is at least as recent as first');
}
console.log('  PASS');

// ---------------------------------------------------------------------------
// Test 3 -- never-stamped tab: getTabMetadata returns null OR object with
// undefined / 0 lastAgentNavigationAt; suppression check evaluates correctly.
// ---------------------------------------------------------------------------
console.log('--- Test 3: never-stamped tab -- suppression check returns false (no false suppression) ---');
{
  delete require.cache[REGISTRY_MODULE_PATH];
  const { AgentRegistry } = require(REGISTRY_MODULE_PATH);
  const registry = new AgentRegistry();
  const meta = registry.getTabMetadata(999999);
  // Either null (no metadata yet) or object without the field; both are valid.
  const lastAgentNav = (meta && meta.lastAgentNavigationAt) || 0;
  const now = Date.now();
  assert.ok((now - lastAgentNav) > 500,
    'never-stamped tab: (now - 0) > 500 -- suppression check correctly NOT triggered');
}
console.log('  PASS');

// ---------------------------------------------------------------------------
// Tests 4(a)-(f) -- pure helper _maybeEmitUserNavigation
//
// These tests load extension/utils/agent-nav-emission.js directly. The module
// does NOT depend on chrome.* or globalThis.fsbAgentRegistryInstance -- the
// helper takes (details, registry, now, opts) explicitly so tests can stub.
// ---------------------------------------------------------------------------

// Lazy require: only attempt to load after Task 2 creates the file. If the
// file does not yet exist (Task 1 RED state), tests 4 fail with a clear
// "Cannot find module" message and the suite stops there.
const NAV_EMISSION_PATH = path.resolve(__dirname, '..', 'extension', 'utils', 'agent-nav-emission.js');

// Helper to build a fake registry per case.
function makeRegistry({ owner, lastAgentNavigationAt = 0 } = {}) {
  return {
    findAgentByTabId: function(tabId) { return owner; },
    getTabMetadata: function(tabId) {
      return { lastAgentNavigationAt: lastAgentNavigationAt };
    },
    formatAgentIdForDisplay: function(agentId) {
      // Mirror real helper -- 6 hex prefix.
      if (typeof agentId !== 'string') return '';
      if (agentId.indexOf('agent_') !== 0) return '';
      return 'agent_' + agentId.slice('agent_'.length).replace(/-/g, '').slice(0, 6);
    }
  };
}

console.log('--- Test 4(a): emit on user-initiated nav of non-legacy agent-owned tab (no recent stamp) ---');
{
  delete require.cache[NAV_EMISSION_PATH];
  const { _maybeEmitUserNavigation, USER_INITIATED_TRANSITIONS } = require(NAV_EMISSION_PATH);
  assert.ok(USER_INITIATED_TRANSITIONS instanceof Set, 'USER_INITIATED_TRANSITIONS is a Set');
  assert.ok(USER_INITIATED_TRANSITIONS.has('typed'), 'typed is included');
  assert.ok(USER_INITIATED_TRANSITIONS.has('auto_bookmark'), 'auto_bookmark is included');
  assert.ok(USER_INITIATED_TRANSITIONS.has('reload'), 'reload is included');
  assert.ok(USER_INITIATED_TRANSITIONS.has('link'), 'link is included');

  const captured = [];
  const fakeWarn = function() { captured.push(Array.from(arguments)); };
  const reg = makeRegistry({ owner: 'agent_abcdef0123456789', lastAgentNavigationAt: 0 });
  const emitted = _maybeEmitUserNavigation(
    { frameId: 0, transitionType: 'typed', tabId: 5, url: 'https://example.com/' },
    reg,
    Date.now(),
    { rateLimitedWarn: fakeWarn }
  );
  assert.strictEqual(emitted, true, 'helper returns true (emitted)');
  assert.strictEqual(captured.length, 1, 'rateLimitedWarn called exactly once');
  const args = captured[0];
  assert.strictEqual(args[0], 'AGT', 'category is AGT');
  assert.strictEqual(args[1], 'agent-tab-user-navigation', 'key is agent-tab-user-navigation');
  const payload = args[3];
  assert.ok(payload, 'payload object present');
  assert.ok(typeof payload.agentIdShort === 'string' && payload.agentIdShort.indexOf('agent_') === 0,
    'agentIdShort starts with agent_');
  assert.strictEqual(payload.tabId, 5, 'tabId in payload');
  assert.strictEqual(payload.transitionType, 'typed', 'transitionType in payload');
  assert.strictEqual(payload.url, 'https://example.com/', 'url in payload');
}
console.log('  PASS');

console.log('--- Test 4(b): legacy:* owner -- DOES NOT emit ---');
{
  delete require.cache[NAV_EMISSION_PATH];
  const { _maybeEmitUserNavigation } = require(NAV_EMISSION_PATH);
  const captured = [];
  const fakeWarn = function() { captured.push(Array.from(arguments)); };
  const reg = makeRegistry({ owner: 'legacy:popup', lastAgentNavigationAt: 0 });
  const emitted = _maybeEmitUserNavigation(
    { frameId: 0, transitionType: 'typed', tabId: 5, url: 'https://example.com/' },
    reg,
    Date.now(),
    { rateLimitedWarn: fakeWarn }
  );
  assert.strictEqual(emitted, false, 'helper returns false (suppressed)');
  assert.strictEqual(captured.length, 0, 'rateLimitedWarn NOT called for legacy owner');
}
console.log('  PASS');

console.log('--- Test 4(c): subframe (frameId !== 0) -- DOES NOT emit ---');
{
  delete require.cache[NAV_EMISSION_PATH];
  const { _maybeEmitUserNavigation } = require(NAV_EMISSION_PATH);
  const captured = [];
  const fakeWarn = function() { captured.push(Array.from(arguments)); };
  const reg = makeRegistry({ owner: 'agent_abcdef0123456789', lastAgentNavigationAt: 0 });
  const emitted = _maybeEmitUserNavigation(
    { frameId: 1, transitionType: 'typed', tabId: 5, url: 'https://example.com/' },
    reg,
    Date.now(),
    { rateLimitedWarn: fakeWarn }
  );
  assert.strictEqual(emitted, false, 'helper returns false (subframe filter)');
  assert.strictEqual(captured.length, 0, 'rateLimitedWarn NOT called for subframe');
}
console.log('  PASS');

console.log('--- Test 4(d): excluded transitionTypes -- DOES NOT emit ---');
{
  delete require.cache[NAV_EMISSION_PATH];
  const { _maybeEmitUserNavigation } = require(NAV_EMISSION_PATH);
  const excluded = ['form_submit', 'auto_subframe', 'manual_subframe', 'generated', 'start_page', 'keyword', 'keyword_generated'];
  excluded.forEach(function(tt) {
    const captured = [];
    const fakeWarn = function() { captured.push(Array.from(arguments)); };
    const reg = makeRegistry({ owner: 'agent_abcdef0123456789', lastAgentNavigationAt: 0 });
    const emitted = _maybeEmitUserNavigation(
      { frameId: 0, transitionType: tt, tabId: 5, url: 'https://example.com/' },
      reg,
      Date.now(),
      { rateLimitedWarn: fakeWarn }
    );
    assert.strictEqual(emitted, false, 'transitionType ' + tt + ' returns false');
    assert.strictEqual(captured.length, 0, 'transitionType ' + tt + ' does not emit');
  });
}
console.log('  PASS');

console.log('--- Test 4(e): recent agent-nav stamp (within 500ms) -- DOES NOT emit ---');
{
  delete require.cache[NAV_EMISSION_PATH];
  const { _maybeEmitUserNavigation } = require(NAV_EMISSION_PATH);
  const captured = [];
  const fakeWarn = function() { captured.push(Array.from(arguments)); };
  const now = Date.now();
  const reg = makeRegistry({
    owner: 'agent_abcdef0123456789',
    lastAgentNavigationAt: now - 200 // 200ms ago, within 500ms window
  });
  const emitted = _maybeEmitUserNavigation(
    { frameId: 0, transitionType: 'auto_bookmark', tabId: 5, url: 'https://example.com/' },
    reg,
    now,
    { rateLimitedWarn: fakeWarn }
  );
  assert.strictEqual(emitted, false, 'within-500ms stamp suppresses emission');
  assert.strictEqual(captured.length, 0, '500ms suppression: rateLimitedWarn NOT called');

  // Boundary: exactly 500ms apart -- per (now - lastAgentNav) <= 500 -> suppress.
  const reg2 = makeRegistry({
    owner: 'agent_abcdef0123456789',
    lastAgentNavigationAt: now - 500
  });
  const emitted2 = _maybeEmitUserNavigation(
    { frameId: 0, transitionType: 'auto_bookmark', tabId: 5, url: 'https://example.com/' },
    reg2,
    now,
    { rateLimitedWarn: fakeWarn }
  );
  assert.strictEqual(emitted2, false, 'exactly-500ms boundary still suppresses');

  // Just past 500ms -- DOES emit.
  const captured3 = [];
  const fakeWarn3 = function() { captured3.push(Array.from(arguments)); };
  const reg3 = makeRegistry({
    owner: 'agent_abcdef0123456789',
    lastAgentNavigationAt: now - 501
  });
  const emitted3 = _maybeEmitUserNavigation(
    { frameId: 0, transitionType: 'auto_bookmark', tabId: 5, url: 'https://example.com/' },
    reg3,
    now,
    { rateLimitedWarn: fakeWarn3 }
  );
  assert.strictEqual(emitted3, true, 'past-500ms emits normally');
  assert.strictEqual(captured3.length, 1, 'past-500ms calls rateLimitedWarn once');
}
console.log('  PASS');

console.log('--- Test 4(f): no owner (registry.findAgentByTabId returns null) -- DOES NOT emit ---');
{
  delete require.cache[NAV_EMISSION_PATH];
  const { _maybeEmitUserNavigation } = require(NAV_EMISSION_PATH);
  const captured = [];
  const fakeWarn = function() { captured.push(Array.from(arguments)); };
  const reg = makeRegistry({ owner: null, lastAgentNavigationAt: 0 });
  const emitted = _maybeEmitUserNavigation(
    { frameId: 0, transitionType: 'typed', tabId: 5, url: 'https://example.com/' },
    reg,
    Date.now(),
    { rateLimitedWarn: fakeWarn }
  );
  assert.strictEqual(emitted, false, 'no owner returns false');
  assert.strictEqual(captured.length, 0, 'no owner does not emit');
}
console.log('  PASS');

console.log('--- Test 5: stampAgentNavigation is exposed on registry instances ---');
{
  delete require.cache[REGISTRY_MODULE_PATH];
  const { AgentRegistry } = require(REGISTRY_MODULE_PATH);
  const registry = new AgentRegistry();
  assert.strictEqual(typeof registry.stampAgentNavigation, 'function',
    'stampAgentNavigation is a function on AgentRegistry instances');
}
console.log('  PASS');

console.log('\nAll tests passed.');
