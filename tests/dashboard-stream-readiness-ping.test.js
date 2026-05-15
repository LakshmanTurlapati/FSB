'use strict';

/**
 * Phase 276 STREAM-DEFENSIVE-02 -- readiness-ping test.
 *
 * Asserts:
 *  1. `pingDomStream` handler is present in extension/content/dom-stream.js
 *     inside the chrome.runtime.onMessage.addListener switch and responds
 *     synchronously with { ready: true }.
 *  2. `_waitForContentScriptReady` is defined in extension/ws/ws-client.js
 *     and uses chrome.tabs.sendMessage({ action: 'pingDomStream' }).
 *  3. The 5s timeout + 200ms polling interval constants are present.
 *  4. The setTimeout(300) heuristic in _forwardToContentScript reinjection
 *     branch is REPLACED by a call to _waitForContentScriptReady.
 *  5. Behavioural simulation: stub chrome.tabs.sendMessage to (a) return
 *     ready=false on the first 2 polls and ready=true on the 3rd; assert
 *     the helper resolves true within ~600ms (3 polls). And (b) never
 *     respond -- assert the helper resolves false at the 5s deadline.
 *
 * Run: node tests/dashboard-stream-readiness-ping.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const wsSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'ws', 'ws-client.js'),
  'utf8'
);
const dsSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'content', 'dom-stream.js'),
  'utf8'
);

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail || ''}`); }
}

console.log('--- Phase 276 STREAM-DEFENSIVE-02 readiness-ping invariants ---');

check(
  'dom-stream.js has pingDomStream case in onMessage listener',
  /case 'pingDomStream'/.test(dsSource),
  'pingDomStream case missing from dom-stream.js'
);

check(
  'pingDomStream responds with { ready: true }',
  /case 'pingDomStream'[\s\S]{0,1200}sendResponse\(\s*\{\s*ready:\s*true\s*\}/.test(dsSource),
  'pingDomStream does not call sendResponse({ ready: true })'
);

check(
  'ws-client.js declares _waitForContentScriptReady function',
  /function _waitForContentScriptReady\(tabId,\s*timeoutMs\)/.test(wsSource),
  '_waitForContentScriptReady function not found'
);

check(
  '_waitForContentScriptReady sends action: \'pingDomStream\'',
  /chrome\.tabs\.sendMessage\s*\(\s*tabId\s*,\s*\{\s*action:\s*'pingDomStream'\s*\}\s*,\s*\{\s*frameId:\s*0\s*\}/.test(wsSource),
  'pingDomStream sendMessage call shape wrong'
);

check(
  'FSB_CONTENT_READY_TIMEOUT_MS = 5000',
  /FSB_CONTENT_READY_TIMEOUT_MS\s*=\s*5000/.test(wsSource),
  '5s timeout constant missing'
);

check(
  'FSB_CONTENT_READY_POLL_INTERVAL_MS = 200',
  /FSB_CONTENT_READY_POLL_INTERVAL_MS\s*=\s*200/.test(wsSource),
  '200ms poll interval constant missing'
);

check(
  'old setTimeout(r, 300) heuristic removed from _forwardToContentScript',
  !/Brief delay for script initialization[\s\S]{0,200}setTimeout\(r,\s*300\)/.test(wsSource),
  'setTimeout(r, 300) heuristic still present in _forwardToContentScript reinjection branch'
);

check(
  '_forwardToContentScript reinjection branch calls _waitForContentScriptReady',
  /executeScript\(\{[\s\S]{0,1500}_waitForContentScriptReady\(tabId\)/.test(wsSource),
  '_waitForContentScriptReady not called after chrome.scripting.executeScript in reinjection branch'
);

console.log('\n--- Behavioural simulation: stub chrome.tabs.sendMessage ---');

// Extract _waitForContentScriptReady into an executable sandbox. The function
// only depends on chrome.tabs.sendMessage, chrome.runtime.lastError, and the
// two timing constants -- all of which we can stub via a global proxy.
function evalReadinessHelper(stubSendMessage) {
  const ctx = {
    setTimeout: setTimeout,
    Date: Date,
    Promise: Promise,
    FSB_CONTENT_READY_POLL_INTERVAL_MS: 50,  // shorter for tests
    FSB_CONTENT_READY_TIMEOUT_MS: 500,       // shorter for tests
    chrome: {
      tabs: { sendMessage: stubSendMessage },
      runtime: { lastError: null }
    }
  };
  // Pull the function source out of ws-client.js, fix up the constants to use
  // the sandbox names (the originals are still global hoists in the real SW).
  const fnSrc = wsSource.match(/function _waitForContentScriptReady\([\s\S]*?\n\}\n/)[0];
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'setTimeout', 'Date', 'Promise',
    'FSB_CONTENT_READY_POLL_INTERVAL_MS', 'FSB_CONTENT_READY_TIMEOUT_MS', 'chrome',
    fnSrc + '; return _waitForContentScriptReady;'
  );
  return factory(
    ctx.setTimeout, ctx.Date, ctx.Promise,
    ctx.FSB_CONTENT_READY_POLL_INTERVAL_MS, ctx.FSB_CONTENT_READY_TIMEOUT_MS,
    ctx.chrome
  );
}

async function simulateReady() {
  let callCount = 0;
  const stub = function (tabId, msg, opts, cb) {
    callCount += 1;
    setTimeout(function () {
      cb(callCount >= 3 ? { ready: true } : null);
    }, 1);
  };
  const helper = evalReadinessHelper(stub);
  const t0 = Date.now();
  const result = await helper(99, 500);
  const elapsed = Date.now() - t0;
  check(
    'simulation A: resolves true on 3rd poll',
    result === true,
    'expected true; got ' + result
  );
  check(
    'simulation A: callCount === 3',
    callCount === 3,
    'expected 3 polls; got ' + callCount
  );
  check(
    'simulation A: elapsed under 500ms budget',
    elapsed < 500,
    'helper took ' + elapsed + 'ms (budget 500ms)'
  );
}

async function simulateTimeout() {
  let callCount = 0;
  const stub = function (tabId, msg, opts, cb) {
    callCount += 1;
    setTimeout(function () { cb(null); }, 1);  // never returns ready
  };
  const helper = evalReadinessHelper(stub);
  const t0 = Date.now();
  const result = await helper(99, 300);
  const elapsed = Date.now() - t0;
  check(
    'simulation B: resolves false when deadline elapses',
    result === false,
    'expected false; got ' + result
  );
  check(
    'simulation B: helper waited at least 300ms',
    elapsed >= 280,
    'helper returned in ' + elapsed + 'ms (expected >= 280)'
  );
  check(
    'simulation B: helper waited less than 1.5x the budget',
    elapsed < 450,
    'helper overshot budget significantly: ' + elapsed + 'ms'
  );
}

async function simulateImmediateReady() {
  let callCount = 0;
  const stub = function (tabId, msg, opts, cb) {
    callCount += 1;
    setTimeout(function () { cb({ ready: true }); }, 1);
  };
  const helper = evalReadinessHelper(stub);
  const t0 = Date.now();
  const result = await helper(99, 500);
  const elapsed = Date.now() - t0;
  check(
    'simulation C: immediate ready resolves true on first poll',
    result === true && callCount === 1,
    'expected 1 call returning true; got ' + callCount + ' calls -> ' + result
  );
  check(
    'simulation C: happy path under 100ms',
    elapsed < 100,
    'happy path took ' + elapsed + 'ms (expected < 100ms)'
  );
}

(async () => {
  await simulateImmediateReady();
  await simulateReady();
  await simulateTimeout();

  console.log(`\n=== readiness-ping test results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch(function (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
});
