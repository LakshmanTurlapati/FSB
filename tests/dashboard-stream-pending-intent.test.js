'use strict';

/**
 * Phase 276 STREAM-DEFENSIVE-04 -- pending-intent re-arm test.
 *
 * Asserts:
 *  1. `_pendingStreamStart` module-level state is declared in ws-client.js.
 *  2. `_handleDashboardStreamStart` parks the payload into _pendingStreamStart
 *     when _waitForContentScriptReady returns false (timeout).
 *  3. `_handleDashboardStreamStart` clears _pendingStreamStart when readiness
 *     succeeds (so a late domStreamReady ping does NOT re-fire a stream-start).
 *  4. `_onDomStreamReady` is defined and clears _pendingStreamStart and
 *     re-dispatches via wsInstance._handleDashboardStreamStart.
 *  5. background.js `case 'domStreamReady':` calls _onDomStreamReady.
 *
 * Run: node tests/dashboard-stream-pending-intent.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const wsSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'ws', 'ws-client.js'),
  'utf8'
);
const bgSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'background.js'),
  'utf8'
);

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail || ''}`); }
}

console.log('--- Phase 276 STREAM-DEFENSIVE-04 pending-intent invariants ---');

check(
  '_pendingStreamStart declared at module scope in ws-client.js',
  /^var _pendingStreamStart\s*=\s*null;/m.test(wsSource),
  '_pendingStreamStart module-level declaration missing'
);

check(
  '_handleDashboardStreamStart parks payload on readiness timeout',
  /if \(!ready\)\s*\{\s*_pendingStreamStart\s*=\s*\{\s*payload:\s*payload\s*,\s*tabId:\s*candidate\.tabId/.test(wsSource),
  '_handleDashboardStreamStart does NOT assign _pendingStreamStart on !ready branch'
);

check(
  '_handleDashboardStreamStart clears _pendingStreamStart on happy path',
  /Clear any prior parked intent[\s\S]{0,200}_pendingStreamStart\s*=\s*null/.test(wsSource),
  '_pendingStreamStart not cleared on happy path before _forwardToContentScript'
);

check(
  '_onDomStreamReady function defined in ws-client.js',
  /function _onDomStreamReady\(senderTabId\)\s*\{/.test(wsSource),
  '_onDomStreamReady function not found'
);

check(
  '_onDomStreamReady early-returns when no pending intent',
  /function _onDomStreamReady\([\s\S]{0,300}if \(!_pendingStreamStart\) return;/.test(wsSource),
  '_onDomStreamReady does not early-return when _pendingStreamStart is null'
);

check(
  '_onDomStreamReady clears _pendingStreamStart before re-dispatch',
  /var parked = _pendingStreamStart;\s*\n\s*_pendingStreamStart = null;/.test(wsSource),
  '_onDomStreamReady does not clear _pendingStreamStart before re-dispatching'
);

check(
  '_onDomStreamReady re-dispatches via wsInstance._handleDashboardStreamStart',
  /wsInstance\._handleDashboardStreamStart\(parked\.payload\)/.test(wsSource),
  '_onDomStreamReady does not call _handleDashboardStreamStart(parked.payload)'
);

check(
  'background.js case domStreamReady calls _onDomStreamReady',
  /case 'domStreamReady':[\s\S]{0,1200}_onDomStreamReady\(sender\.tab\s*\?\s*sender\.tab\.id\s*:\s*null\)/.test(bgSource),
  'background.js domStreamReady handler does not call _onDomStreamReady'
);

check(
  'background.js domStreamReady call is wrapped in try/catch (non-blocking)',
  /case 'domStreamReady':[\s\S]{0,1500}try\s*\{[\s\S]{0,300}_onDomStreamReady[\s\S]{0,300}catch/.test(bgSource),
  'domStreamReady -> _onDomStreamReady not wrapped in try/catch'
);

console.log('\n--- Behavioural simulation: parked intent re-arm cycle ---');

// Sandbox the relevant module-level state + _onDomStreamReady function.
// We need to evaluate the function source against a controlled wsInstance.
function evalPendingReArm() {
  // Pull both declarations + the function out of ws-client.js.
  const fnSrc = wsSource.match(/function _onDomStreamReady\(senderTabId\)\s*\{[\s\S]*?\n\}\n/)[0];

  // Build a sandbox: _pendingStreamStart starts as the parked payload; we stub
  // globalThis.__fsbWsInstance to expose a fake _handleDashboardStreamStart
  // that records the call. We also stub recordFSBTransportFailure to a no-op.
  const calls = [];
  const fakeWsInstance = {
    _handleDashboardStreamStart: function (payload) { calls.push(payload); }
  };

  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'recordFSBTransportFailure', 'wsInstance',
    'var _pendingStreamStart = null;\n' +
    fnSrc + '\n' +
    'return {\n' +
    '  setParked: function (p) { _pendingStreamStart = p; },\n' +
    '  getParked: function () { return _pendingStreamStart; },\n' +
    '  ready: function (tid) { return _onDomStreamReady(tid); }\n' +
    '};'
  );

  // Stub globalThis.__fsbWsInstance for _onDomStreamReady's body.
  const prevGlobal = globalThis.__fsbWsInstance;
  globalThis.__fsbWsInstance = fakeWsInstance;
  try {
    return {
      api: factory(function () { /* no-op */ }, fakeWsInstance),
      calls: calls,
      restore: function () { globalThis.__fsbWsInstance = prevGlobal; }
    };
  } catch (e) {
    globalThis.__fsbWsInstance = prevGlobal;
    throw e;
  }
}

const sim = evalPendingReArm();
try {
  // Case 1: no parked intent -- _onDomStreamReady is a no-op.
  sim.api.ready(42);
  check(
    'sim 1: no parked intent -> 0 re-dispatches',
    sim.calls.length === 0,
    'expected 0 calls; got ' + sim.calls.length
  );

  // Case 2: park a payload, fire ready -> re-dispatch once + clear.
  sim.api.setParked({ payload: { trigger: 'test' }, tabId: 99, ts: Date.now() });
  sim.api.ready(99);
  check(
    'sim 2: parked intent -> 1 re-dispatch',
    sim.calls.length === 1,
    'expected 1 call; got ' + sim.calls.length
  );
  check(
    'sim 2: re-dispatch carries the parked payload',
    sim.calls[0] && sim.calls[0].trigger === 'test',
    'expected trigger=test in re-dispatched payload; got ' + JSON.stringify(sim.calls[0])
  );
  check(
    'sim 2: _pendingStreamStart cleared after re-arm',
    sim.api.getParked() === null,
    '_pendingStreamStart not null after re-arm'
  );

  // Case 3: fire ready twice in a row -- second call is a no-op (parked is
  // already null), so no double-fire.
  sim.api.ready(99);
  check(
    'sim 3: idempotent -- second ready does not re-fire',
    sim.calls.length === 1,
    'expected calls.length still 1; got ' + sim.calls.length
  );
} finally {
  sim.restore();
}

console.log(`\n=== pending-intent test results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
