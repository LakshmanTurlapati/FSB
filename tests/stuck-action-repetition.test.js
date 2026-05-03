/**
 * Phase 227-01 Unit Test: strict consecutive-action-repetition detector
 *
 * Validates the new strict consecutive-same-fingerprint counter inside
 * detectStuck() (extension/ai/agent-loop.js) added by Phase 227-01.
 *
 * Threshold contract:
 *   - warn at 3 consecutive identical (tool, target) tuples
 *   - force-stop at 5 consecutive identical tuples
 *   - read-only sentinel iterations do not increment the counter
 *   - a single different fingerprint resets the counter to 1
 *
 * Run: node tests/stuck-action-repetition.test.js
 */

'use strict';

const { detectStuck } = require('../extension/ai/agent-loop.js');
const { STUCK_REASONS } = require('../extension/ai/turn-result.js');

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
  assert(
    actual === expected,
    msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')'
  );
}

function makeSession() {
  return {
    agentState: { consecutiveNoChangeCount: 0, actionFingerprints: [], stuckWarningCount: 0 },
    actionHistory: []
  };
}

function clickResultsFor(selector) {
  return [{ callId: 'c-' + selector, name: 'click', args: { selector: selector }, result: { success: true, hadEffect: true } }];
}

// --- Test 1: 6 identical invocations force-stop at the 5th iteration ---

console.log('\n--- Test 1: 6 identical click(#dropdown) -- force-stop fires at iteration 5 ---');
{
  const session = makeSession();
  const results = clickResultsFor('#dropdown');
  const iterationOutcomes = [];
  for (let i = 0; i < 6; i++) {
    iterationOutcomes.push(detectStuck(session, results));
  }
  // After iteration 5 (index 4) the strict counter hits 5 -> force-stop.
  assertEqual(iterationOutcomes[4].shouldForceStop, true, 'iteration 5 force-stops');
  assertEqual(iterationOutcomes[4].reasonCode, STUCK_REASONS.ACTION_REPETITION, 'reasonCode = ACTION_REPETITION');
  assert(typeof iterationOutcomes[4].hint === 'string' && iterationOutcomes[4].hint.indexOf('stuck_action_repetition') !== -1,
    'force-stop hint contains "stuck_action_repetition"');
  // Iteration 6 (index 5) should also continue to force-stop.
  assertEqual(iterationOutcomes[5].shouldForceStop, true, 'iteration 6 still force-stops');
}

// --- Test 2: 3 identical invocations warn but do not force-stop ---

console.log('\n--- Test 2: 3 identical invocations warn (no force-stop) ---');
{
  const session = makeSession();
  const results = clickResultsFor('#warn-target');
  let last = null;
  for (let i = 0; i < 3; i++) {
    last = detectStuck(session, results);
  }
  assertEqual(last.isStuck, true, 'isStuck=true after 3 consecutive identical actions');
  assertEqual(last.shouldForceStop, false, 'shouldForceStop=false at warn threshold');
  assertEqual(last.reasonCode, STUCK_REASONS.ACTION_REPETITION, 'reasonCode = ACTION_REPETITION at warn');
  assert(typeof last.hint === 'string' && (last.hint.indexOf('WARNING') !== -1 || last.hint.indexOf('stuck_action_repetition') !== -1),
    'warn hint contains "WARNING" or "stuck_action_repetition"');
}

// --- Test 3: 6 alternating invocations (A,B,A,B,A,B) do NOT trigger ACTION_REPETITION force-stop ---

console.log('\n--- Test 3: alternating A,B,A,B,A,B does not trigger ACTION_REPETITION force-stop ---');
{
  const session = makeSession();
  const a = clickResultsFor('#a');
  const b = clickResultsFor('#b');
  let last = null;
  for (let i = 0; i < 6; i++) {
    last = detectStuck(session, i % 2 === 0 ? a : b);
  }
  // The strict consecutive counter should never exceed 1 here.
  // The windowed heuristic may flag it, but reasonCode must NOT be ACTION_REPETITION.
  if (last.shouldForceStop) {
    assert(last.reasonCode !== STUCK_REASONS.ACTION_REPETITION,
      'alternating actions did not force-stop with ACTION_REPETITION reason (got ' + last.reasonCode + ')');
  } else {
    assertEqual(last.shouldForceStop, false, 'alternating actions did not force-stop');
  }
  assertEqual(session.agentState.consecutiveSameFingerprintCount, 1,
    'consecutiveSameFingerprintCount stays at 1 with alternating fingerprints');
}

// --- Test 4: A,A,A,B,A pattern -- B resets the counter ---

console.log('\n--- Test 4: A,A,A,B,A pattern -- single B resets counter to 1, then A increments to 1 ---');
{
  const session = makeSession();
  const a = clickResultsFor('#reset-a');
  const b = clickResultsFor('#reset-b');
  detectStuck(session, a); // counter=1
  detectStuck(session, a); // counter=2
  detectStuck(session, a); // counter=3 (warn)
  detectStuck(session, b); // counter=1 (reset by B)
  const last = detectStuck(session, a); // counter=1 (reset by A != lastFingerprint=B)
  assertEqual(session.agentState.consecutiveSameFingerprintCount, 1,
    'counter resets to 1 after B then A (not 4)');
  assertEqual(last.shouldForceStop, false, 'no force-stop after A,A,A,B,A pattern');
}

// --- Test 5: read-only iteration interleaved does NOT increment the counter ---

console.log('\n--- Test 5: read_page interleaved does not increment consecutive counter ---');
{
  const session = makeSession();
  const click = clickResultsFor('#mut');
  const readOnly = [{ callId: 'r', name: 'read_page', args: {}, result: { success: true, hadEffect: false } }];
  detectStuck(session, click);    // counter=1, lastFingerprint=click:#mut
  detectStuck(session, click);    // counter=2
  detectStuck(session, readOnly); // read-only sentinel: counter UNCHANGED, lastFingerprint UNCHANGED
  const after = detectStuck(session, click); // should continue: counter=3 (warn)
  assertEqual(session.agentState.consecutiveSameFingerprintCount, 3,
    'read-only iteration does not reset OR increment the counter (3 mutation hits total)');
  assertEqual(after.reasonCode, STUCK_REASONS.ACTION_REPETITION,
    'mutation iteration after read-only attributes to ACTION_REPETITION at warn');
}

// --- Test 6: hadEffect=true between repeats does not save us -- the counter is fingerprint-based ---

console.log('\n--- Test 6: hadEffect=true does not prevent action-repetition force-stop (fingerprint-based) ---');
{
  const session = makeSession();
  // All 5 calls report hadEffect: true (DOM keeps changing) but the
  // (tool, target) fingerprint is identical -- this is exactly the
  // PROMPT-10 react-select dropdown loop scenario.
  const results = [{ callId: 'r', name: 'click', args: { selector: '#react-dropdown' }, result: { success: true, hadEffect: true } }];
  let last = null;
  for (let i = 0; i < 5; i++) {
    last = detectStuck(session, results);
  }
  assertEqual(last.shouldForceStop, true,
    'force-stop fires at iteration 5 even when every iteration reports hadEffect=true');
  assertEqual(last.reasonCode, STUCK_REASONS.ACTION_REPETITION,
    'reasonCode = ACTION_REPETITION (distinct from DOM-hash detector)');
}

// --- Report ---
setTimeout(() => {
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}, 50);
