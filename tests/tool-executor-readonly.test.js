/**
 * Regression tests for ai/tool-executor.js hadEffect semantics.
 *
 * These tests guard the fix for a hallucination loop observed in
 * session_1775947916398 (96 iterations, 0 clicks, 0 type_texts). Root cause:
 * executeContentTool and executeCdpTool were blanket-setting
 * hadEffect = success, causing read-only tools like read_page / get_text /
 * get_attribute to report hadEffect: true on success. That defeated
 * detectStuck (ai/agent-loop.js) which resets its no-change counter whenever
 * ANY tool in a turn reports hadEffect === true, letting the model spin
 * forever in a report_progress -> read_page -> report_progress loop.
 *
 * The fix: derive hadEffect from tool._readOnly (set in tool-definitions.js)
 * so read-only tools report hadEffect: false even on success.
 *
 * Run: node tests/tool-executor-readonly.test.js
 */

'use strict';

// Stub the chrome global BEFORE loading tool-executor, which will reference
// it via chrome.tabs.sendMessage in executeContentTool.
let sendMessageStub = null;
global.chrome = {
  tabs: {
    sendMessage: (...args) => sendMessageStub(...args),
    get: async () => ({ url: 'https://example.com' })
  }
};

const { executeTool } = require('../ai/tool-executor.js');

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

function assertEqual(actual, expected, msg) {
  assert(actual === expected, msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
}

// -----------------------------------------------------------------------
// Read-only content tools must report hadEffect: false on success
// -----------------------------------------------------------------------

console.log('\n--- read_page reports hadEffect: false on success ---');
{
  sendMessageStub = async () => ({ success: true, text: 'hello world', charCount: 11 });
  executeTool('read_page', {}, 1).then(result => {
    assertEqual(result.success, true, 'read_page success');
    assertEqual(result.hadEffect, false, 'read_page hadEffect is false (read-only)');
  });
}

console.log('\n--- get_text reports hadEffect: false on success ---');
{
  sendMessageStub = async () => ({ success: true, text: 'button label' });
  executeTool('get_text', { selector: '#btn' }, 1).then(result => {
    assertEqual(result.success, true, 'get_text success');
    assertEqual(result.hadEffect, false, 'get_text hadEffect is false (read-only)');
  });
}

console.log('\n--- get_attribute reports hadEffect: false on success ---');
{
  sendMessageStub = async () => ({ success: true, value: 'https://x.com' });
  executeTool('get_attribute', { selector: 'a', attribute: 'href' }, 1).then(result => {
    assertEqual(result.success, true, 'get_attribute success');
    assertEqual(result.hadEffect, false, 'get_attribute hadEffect is false (read-only)');
  });
}

// -----------------------------------------------------------------------
// Mutating content tools must still report hadEffect: true on success
// -----------------------------------------------------------------------

console.log('\n--- click reports hadEffect: true on success ---');
{
  sendMessageStub = async () => ({ success: true });
  executeTool('click', { selector: '#btn' }, 1).then(result => {
    assertEqual(result.success, true, 'click success');
    assertEqual(result.hadEffect, true, 'click hadEffect is true (mutating)');
  });
}

console.log('\n--- type_text reports hadEffect: true on success ---');
{
  sendMessageStub = async () => ({ success: true });
  executeTool('type_text', { selector: '#in', text: 'hi' }, 1).then(result => {
    assertEqual(result.success, true, 'type_text success');
    assertEqual(result.hadEffect, true, 'type_text hadEffect is true (mutating)');
  });
}

// -----------------------------------------------------------------------
// Failed tools must report hadEffect: false regardless of _readOnly
// -----------------------------------------------------------------------

console.log('\n--- failed click reports hadEffect: false ---');
{
  sendMessageStub = async () => ({ success: false, error: 'element not found' });
  executeTool('click', { selector: '#missing' }, 1).then(result => {
    assertEqual(result.success, false, 'click failure');
    assertEqual(result.hadEffect, false, 'failed click hadEffect is false');
  });
}

console.log('\n--- failed read_page reports hadEffect: false ---');
{
  sendMessageStub = async () => ({ success: false, error: 'page not ready' });
  executeTool('read_page', {}, 1).then(result => {
    assertEqual(result.success, false, 'read_page failure');
    assertEqual(result.hadEffect, false, 'failed read_page hadEffect is false');
  });
}

// -----------------------------------------------------------------------
// detectStuck + checkSafetyBreakers integration with the fix
// -----------------------------------------------------------------------

// Stub globals referenced by agent-loop.js hook factories. agent-loop.js
// guards typeof importScripts and typeof require -- it loads cleanly in
// Node because of the try/catch require blocks at the top of the file.
const agentLoop = require('../ai/agent-loop.js');
const { detectStuck, checkSafetyBreakers } = agentLoop;

console.log('\n--- detectStuck: read_page loop (hadEffect=false) trips after 3 iterations ---');
{
  const session = { agentState: {}, actionHistory: [] };
  // Simulate 3 consecutive iterations of read_page + report_progress, both
  // now correctly reporting hadEffect: false.
  const readOnlyResults = [
    { callId: 'a', name: 'read_page', result: { success: true, hadEffect: false } },
    { callId: 'b', name: 'report_progress', result: { success: true, hadEffect: false } }
  ];
  let lastStuck = null;
  for (let i = 0; i < 3; i++) {
    lastStuck = detectStuck(session, readOnlyResults);
  }
  assertEqual(lastStuck.isStuck, true, 'stuck detected after 3 no-effect iterations');
  assert(typeof lastStuck.hint === 'string' && lastStuck.hint.length > 0, 'stuck hint is a non-empty string');
}

console.log('\n--- detectStuck: real click (hadEffect=true) resets the counter ---');
{
  const session = { agentState: { consecutiveNoChangeCount: 2 }, actionHistory: [] };
  const mutatingResults = [
    { callId: 'c', name: 'click', result: { success: true, hadEffect: true } }
  ];
  const result = detectStuck(session, mutatingResults);
  assertEqual(result.isStuck, false, 'not stuck when a mutating tool had effect');
  assertEqual(session.agentState.consecutiveNoChangeCount, 0, 'counter reset to 0');
}

console.log('\n--- detectStuck: read_page reporting hadEffect=true WOULD have reset stuck counter (pre-fix regression guard) ---');
{
  // This test documents the old broken behavior: if read_page ever regressed
  // to returning hadEffect: true on success, stuck detection would be defeated.
  // The guard is that ai/tool-executor.js MUST NOT set hadEffect: true for
  // read-only tools. The assertions in the content-tool tests above already
  // prove the fix. Here we just assert the downstream consumer (detectStuck)
  // is sensitive to the field -- so a regression in the executor would
  // measurably break this test-suite.
  const session = { agentState: { consecutiveNoChangeCount: 2 }, actionHistory: [] };
  const wrongResults = [
    // Simulate the pre-fix bug: read_page claiming hadEffect: true.
    { callId: 'd', name: 'read_page', result: { success: true, hadEffect: true } }
  ];
  const result = detectStuck(session, wrongResults);
  assertEqual(result.isStuck, false, 'pre-fix regression: lying read_page would reset counter');
  assertEqual(session.agentState.consecutiveNoChangeCount, 0, 'pre-fix regression: counter would be reset to 0');
}

console.log('\n--- checkSafetyBreakers: iteration limit triggers stop ---');
{
  const session = {
    agentState: { iterationCount: 20, totalCost: 0, startTime: Date.now() },
    maxIterations: 20
  };
  const result = checkSafetyBreakers(session);
  assertEqual(result.shouldStop, true, 'iteration limit should stop the session');
  assert(/iteration count/i.test(result.reason || ''), 'reason mentions iteration count');
}

console.log('\n--- checkSafetyBreakers: below iteration limit does not stop ---');
{
  const session = {
    agentState: { iterationCount: 5, totalCost: 0, startTime: Date.now() },
    maxIterations: 20
  };
  const result = checkSafetyBreakers(session);
  assertEqual(result.shouldStop, false, 'below iteration limit should not stop');
}

console.log('\n--- checkSafetyBreakers: falls back to SESSION_DEFAULTS when no session.maxIterations ---');
{
  const session = {
    agentState: { iterationCount: 501, totalCost: 0, startTime: Date.now() }
    // No maxIterations set -- should fall back to SESSION_DEFAULTS (500)
  };
  const result = checkSafetyBreakers(session);
  assertEqual(result.shouldStop, true, 'SESSION_DEFAULTS.maxIterations (500) enforced when session override missing');
}

// -----------------------------------------------------------------------
// detectStuck: action repetition detection
// -----------------------------------------------------------------------

console.log('\n--- detectStuck: repeated click(e28) triggers stuck despite hadEffect=true ---');
{
  const session = { agentState: {}, actionHistory: [] };
  // Simulate 6 iterations of click(e28) -- all report hadEffect: true
  // but they're all the same fingerprint -> repetition detection kicks in
  const clickResults = [
    { callId: 'x', name: 'click', args: { selector: 'e28' }, result: { success: true, hadEffect: true } }
  ];
  let lastResult = null;
  for (let i = 0; i < 6; i++) {
    lastResult = detectStuck(session, clickResults);
  }
  assertEqual(lastResult.isStuck, true, 'stuck detected via action repetition (6x click(e28))');
  assertEqual(lastResult.shouldForceStop, false, 'not force-stopped yet (warning phase)');
  assert(typeof lastResult.hint === 'string' && lastResult.hint.includes('WARNING'), 'hint contains WARNING');
}

console.log('\n--- detectStuck: varied actions do NOT trigger repetition ---');
{
  const session = { agentState: {}, actionHistory: [] };
  // 6 iterations with different tool/target combos
  const tools = ['click', 'type_text', 'scroll', 'press_enter', 'hover', 'execute_js'];
  let lastResult = null;
  for (let i = 0; i < 6; i++) {
    lastResult = detectStuck(session, [
      { callId: 'v' + i, name: tools[i], args: { selector: 'e' + i }, result: { success: true, hadEffect: true } }
    ]);
  }
  assertEqual(lastResult.isStuck, false, 'varied actions are not stuck');
}

console.log('\n--- detectStuck: force-stop after stuckForceStopThreshold warnings ---');
{
  const session = { agentState: {}, actionHistory: [] };
  // Simulate many iterations of the same action to exhaust warnings
  const sameClick = [
    { callId: 'f', name: 'click', args: { selector: 'e28' }, result: { success: true, hadEffect: true } }
  ];
  let lastResult = null;
  // Need 5 warnings * ~3 iterations each (repetition detected after 5 iterations, then every iteration)
  // After first 5 iterations: warning 1. Then warning every iteration after.
  // forceStopThreshold = 5, so need to accumulate 5 warnings.
  for (let i = 0; i < 20; i++) {
    lastResult = detectStuck(session, sameClick);
  }
  assertEqual(lastResult.isStuck, true, 'still stuck after 20 repetitions');
  assertEqual(lastResult.shouldForceStop, true, 'force-stop triggered after enough warnings');
  assert(lastResult.hint.includes('FORCE-STOPPED'), 'hint mentions FORCE-STOPPED');
}

console.log('\n--- detectStuck: mixing read-only + click still detects repetition ---');
{
  const session = { agentState: {}, actionHistory: [] };
  // Each iteration has read_page (ignored for fingerprint) + click(e28) (fingerprinted)
  const mixedResults = [
    { callId: 'r1', name: 'read_page', args: {}, result: { success: true, hadEffect: false } },
    { callId: 'r2', name: 'get_dom_snapshot', args: {}, result: { success: true, hadEffect: false } },
    { callId: 'r3', name: 'click', args: { selector: 'e28' }, result: { success: true, hadEffect: true } },
    { callId: 'r4', name: 'report_progress', args: {}, result: { success: true, hadEffect: false } }
  ];
  let lastResult = null;
  for (let i = 0; i < 6; i++) {
    lastResult = detectStuck(session, mixedResults);
  }
  assertEqual(lastResult.isStuck, true, 'repetition detected through read-only noise');
}

// -----------------------------------------------------------------------
// Flush promises and report
// -----------------------------------------------------------------------

// Use setTimeout to let all pending microtasks resolve before reporting.
setTimeout(() => {
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}, 50);
