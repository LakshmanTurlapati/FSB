'use strict';

/**
 * Phase 239 plan 01 -- regression coverage for the 5 D-08 cleanup-exit paths.
 *
 * One named test per path, plus one source-grep gate that asserts agent-loop.js
 * uses fsbBroadcastAutomationLifecycle from notifySidepanel.
 *
 * Wave 0 RED: paths 1, 2, 3, 5 fail (NOT YET WIRED). Path 4 (tab_close) passes
 * as the control. The agent_loop_uses_helper grep gate fails until Task 1 lands.
 *
 * After Plan 01 Tasks 1+2: all 6 cases pass.
 *
 * Run: node tests/run-task-cleanup-paths.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const harness = require('./fixtures/run-task-harness');
const {
  installChromeMock,
  createLifecycleBusSpy,
  simulateCleanupExit
} = harness;

const AGENT_LOOP_PATH = path.resolve(__dirname, '..', 'extension', 'ai', 'agent-loop.js');

// Plan 01 GREEN flag: when true, regression tests dispatch via the same helper
// that notifySidepanel + handleStopAutomation use AFTER Tasks 1+2 land.
// The grep gate test independently checks the source file regardless of this.
const PLAN_01_LANDED = (function() {
  try {
    const src = fs.readFileSync(AGENT_LOOP_PATH, 'utf8');
    return /fsbBroadcastAutomationLifecycle\s*\(/.test(src);
  } catch (_e) {
    return false;
  }
})();

let passed = 0;
let failed = 0;
const failures = [];

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS:', name);
  } catch (err) {
    failed++;
    failures.push({ name, message: err && err.message });
    console.error('  FAIL:', name, '--', err && err.message);
  }
}

// --- Test 1: normal_completion ---------------------------------------------
runTest('normal_completion', () => {
  const chromeRestore = installChromeMock();
  const spy = createLifecycleBusSpy();
  try {
    simulateCleanupExit('normal_completion', 'sess-A', { useReal: PLAN_01_LANDED });
    assert.strictEqual(spy.recorded.length, 1, 'expected exactly one lifecycle dispatch');
    const ev = spy.recorded[0];
    assert.strictEqual(ev.action, 'automationComplete', 'action should be automationComplete');
    assert.strictEqual(ev.sessionId, 'sess-A', 'sessionId should match');
  } finally {
    spy.restore();
    chromeRestore.restore();
  }
});

// --- Test 2: stuck_detection_terminal --------------------------------------
runTest('stuck_detection_terminal', () => {
  const chromeRestore = installChromeMock();
  const spy = createLifecycleBusSpy();
  try {
    simulateCleanupExit('stuck_terminal', 'sess-B', { useReal: PLAN_01_LANDED });
    assert.strictEqual(spy.recorded.length, 1, 'expected exactly one lifecycle dispatch');
    const ev = spy.recorded[0];
    const isCompletePartial = ev.action === 'automationComplete' && ev.partial === true;
    const isError = ev.action === 'automationError';
    assert.ok(isCompletePartial || isError, 'expected automationComplete{partial:true} or automationError');
  } finally {
    spy.restore();
    chromeRestore.restore();
  }
});

// --- Test 3: safety_breaker ------------------------------------------------
runTest('safety_breaker', () => {
  const chromeRestore = installChromeMock();
  const spy = createLifecycleBusSpy();
  try {
    simulateCleanupExit('safety_breaker', 'sess-C', { useReal: PLAN_01_LANDED });
    assert.strictEqual(spy.recorded.length, 1, 'expected exactly one lifecycle dispatch');
    const ev = spy.recorded[0];
    assert.strictEqual(ev.action, 'automationComplete', 'action should be automationComplete');
    assert.strictEqual(ev.outcome, 'stopped', 'outcome should be stopped');
    const allowedReasons = ['iteration_limit_exceeded', 'cost_limit_exceeded', 'time_limit_exceeded', 'safety'];
    assert.ok(allowedReasons.indexOf(ev.reason) !== -1, 'reason should be one of the safety constants (got ' + ev.reason + ')');
  } finally {
    spy.restore();
    chromeRestore.restore();
  }
});

// --- Test 4: tab_close (control -- always passes) --------------------------
runTest('tab_close', () => {
  const chromeRestore = installChromeMock();
  const spy = createLifecycleBusSpy();
  try {
    simulateCleanupExit('tab_close', 'sess-D');
    assert.strictEqual(spy.recorded.length, 1, 'expected exactly one lifecycle dispatch');
    const ev = spy.recorded[0];
    assert.strictEqual(ev.action, 'automationComplete', 'action should be automationComplete');
    assert.strictEqual(ev.reason, 'tab_closed', 'reason should be tab_closed');
  } finally {
    spy.restore();
    chromeRestore.restore();
  }
});

// --- Test 5: handle_stop ---------------------------------------------------
runTest('handle_stop', () => {
  const chromeRestore = installChromeMock();
  const spy = createLifecycleBusSpy();
  try {
    let lifecycleAt = null;
    let sendResponseAt = null;

    // Wrap the helper to record the timestamp of the bus dispatch.
    const realHelper = globalThis.fsbBroadcastAutomationLifecycle;
    globalThis.fsbBroadcastAutomationLifecycle = function(msg) {
      lifecycleAt = process.hrtime.bigint();
      return realHelper(msg);
    };

    simulateCleanupExit('handle_stop', 'sess-E', {
      useReal: PLAN_01_LANDED,
      recordSendResponse() { sendResponseAt = process.hrtime.bigint(); }
    });

    // Restore inner wrap before assertions / spy.restore.
    globalThis.fsbBroadcastAutomationLifecycle = realHelper;

    assert.strictEqual(spy.recorded.length, 1, 'expected exactly one lifecycle dispatch');
    const ev = spy.recorded[0];
    assert.strictEqual(ev.action, 'automationComplete', 'action should be automationComplete');
    assert.strictEqual(ev.outcome, 'stopped', 'outcome should be stopped');
    assert.strictEqual(ev.reason, 'user_stopped', 'reason should be user_stopped');
    assert.ok(lifecycleAt !== null, 'lifecycle dispatch must have fired');
    assert.ok(sendResponseAt !== null, 'sendResponse callback must have fired');
    assert.ok(lifecycleAt <= sendResponseAt, 'lifecycle dispatch must fire BEFORE sendResponse');
  } finally {
    spy.restore();
    chromeRestore.restore();
  }
});

// --- Test 6: agent_loop_uses_helper (source grep gate) ---------------------
runTest('agent_loop_uses_helper', () => {
  const src = fs.readFileSync(AGENT_LOOP_PATH, 'utf8');
  const helperMatches = src.match(/fsbBroadcastAutomationLifecycle\s*\(/g) || [];
  assert.ok(helperMatches.length >= 1, 'expected at least 1 fsbBroadcastAutomationLifecycle( call in agent-loop.js (got ' + helperMatches.length + ')');

  // Find the notifySidepanel function declaration and extract its body via brace
  // counting. Then assert the body contains zero `chrome.runtime.sendMessage(`.
  const declRegex = /function\s+notifySidepanel\s*\([^)]*\)\s*\{/;
  const declMatch = declRegex.exec(src);
  assert.ok(declMatch, 'notifySidepanel function must exist in agent-loop.js');

  const startIdx = declMatch.index + declMatch[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const body = src.slice(startIdx, i - 1);

  const sendMessageInBody = (body.match(/chrome\.runtime\.sendMessage\s*\(/g) || []).length;
  assert.strictEqual(sendMessageInBody, 0, 'notifySidepanel body must NOT contain chrome.runtime.sendMessage (got ' + sendMessageInBody + ' calls)');
});

// --- Tally + exit ----------------------------------------------------------
console.log('');
console.log('Cleanup-paths regression: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('Failures:');
  failures.forEach((f) => console.log('  - ' + f.name + ': ' + f.message));
}
process.exit(failed > 0 ? 1 : 0);
