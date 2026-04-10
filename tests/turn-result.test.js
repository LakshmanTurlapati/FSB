/**
 * Unit tests for ai/turn-result.js
 *
 * Adapted from archive/remote-main tests/test-turn-result.js — the shape
 * assertions are rewritten against local's actual TurnResult API
 * (inputTokens / completionMessage / flat fields / STOP_REASONS as object
 * of 8 values) rather than the archive's alternate shape.
 *
 * Run: node tests/turn-result.test.js
 */

'use strict';

const {
  createTurnResult,
  STOP_REASONS,
  summarizeTurnResult,
  accumulateTurnResults
} = require('../ai/turn-result.js');

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
  assert(actual === expected, msg + ' (expected: ' + expected + ', got: ' + actual + ')');
}

// --- createTurnResult with all defaults -----------------------------------

console.log('\n--- createTurnResult with all defaults ---');
const t1 = createTurnResult({});
assertEqual(t1.sessionId, '', 'default sessionId');
assertEqual(t1.iteration, 0, 'default iteration');
assertEqual(t1.inputTokens, 0, 'default inputTokens');
assertEqual(t1.outputTokens, 0, 'default outputTokens');
assertEqual(t1.cost, 0, 'default cost');
assertEqual(t1.stopReason, STOP_REASONS.TOOL_CALLS, 'default stopReason is TOOL_CALLS');
assertEqual(t1.completionMessage, null, 'default completionMessage');
assertEqual(t1.errorMessage, null, 'default errorMessage');
assertEqual(t1.durationMs, 0, 'default durationMs');
assert(typeof t1.timestamp === 'number' && t1.timestamp > 0, 'timestamp auto-populated');
assert(Array.isArray(t1.matchedTools) && t1.matchedTools.length === 0, 'default matchedTools is empty array');
assert(Array.isArray(t1.toolResults) && t1.toolResults.length === 0, 'default toolResults is empty array');
assert(Array.isArray(t1.permissionDenials) && t1.permissionDenials.length === 0, 'default permissionDenials is empty array');

// --- createTurnResult with explicit values --------------------------------

console.log('\n--- createTurnResult with explicit values ---');
const t2 = createTurnResult({
  sessionId: 'sess-42',
  iteration: 5,
  inputTokens: 1000,
  outputTokens: 200,
  cost: 0.003,
  stopReason: STOP_REASONS.END_TURN,
  completionMessage: 'Done',
  durationMs: 1250
});
assertEqual(t2.sessionId, 'sess-42', 'sessionId passthrough');
assertEqual(t2.iteration, 5, 'iteration passthrough');
assertEqual(t2.inputTokens, 1000, 'inputTokens passthrough');
assertEqual(t2.outputTokens, 200, 'outputTokens passthrough');
assertEqual(t2.cost, 0.003, 'cost passthrough');
assertEqual(t2.stopReason, 'end_turn', 'stopReason passthrough');
assertEqual(t2.completionMessage, 'Done', 'completionMessage passthrough');
assertEqual(t2.durationMs, 1250, 'durationMs passthrough');

// --- createTurnResult with no argument ------------------------------------

console.log('\n--- createTurnResult with no argument ---');
const t3 = createTurnResult();
assertEqual(t3.iteration, 0, 'no-arg creates default iteration');
assertEqual(t3.stopReason, STOP_REASONS.TOOL_CALLS, 'no-arg creates default stopReason');
assert(Array.isArray(t3.matchedTools), 'no-arg creates array fields');

// --- createTurnResult with error path -------------------------------------

console.log('\n--- createTurnResult with error path ---');
const t4 = createTurnResult({
  stopReason: STOP_REASONS.ERROR,
  errorMessage: 'network timeout'
});
assertEqual(t4.stopReason, 'error', 'error stopReason');
assertEqual(t4.errorMessage, 'network timeout', 'errorMessage passthrough');
assertEqual(t4.completionMessage, null, 'completionMessage stays null on error');

// --- STOP_REASONS contains all 8 valid reasons ----------------------------

console.log('\n--- STOP_REASONS enum completeness ---');
assertEqual(STOP_REASONS.END_TURN, 'end_turn', 'END_TURN value');
assertEqual(STOP_REASONS.TOOL_CALLS, 'tool_calls', 'TOOL_CALLS value');
assertEqual(STOP_REASONS.PARTIAL, 'partial', 'PARTIAL value');
assertEqual(STOP_REASONS.SAFETY_STOP, 'safety_stop', 'SAFETY_STOP value');
assertEqual(STOP_REASONS.USER_STOP, 'user_stop', 'USER_STOP value');
assertEqual(STOP_REASONS.ERROR, 'error', 'ERROR value');
assertEqual(STOP_REASONS.MAX_ITERATIONS, 'max_iterations', 'MAX_ITERATIONS value');
assertEqual(STOP_REASONS.STUCK, 'stuck', 'STUCK value');
assertEqual(Object.keys(STOP_REASONS).length, 8, 'STOP_REASONS has exactly 8 entries');

// --- createTurnResult with matchedTools (array of strings) ----------------

console.log('\n--- createTurnResult with matchedTools ---');
const t5 = createTurnResult({
  matchedTools: ['click', 'type', 'navigate']
});
assertEqual(t5.matchedTools.length, 3, 'matchedTools length');
assertEqual(t5.matchedTools[0], 'click', 'first tool name');
assertEqual(t5.matchedTools[2], 'navigate', 'third tool name');

// --- createTurnResult with toolResults ------------------------------------

console.log('\n--- createTurnResult with toolResults ---');
const t6 = createTurnResult({
  toolResults: [
    { name: 'click', success: true, hadEffect: true },
    { name: 'type', success: false, hadEffect: false }
  ]
});
assertEqual(t6.toolResults.length, 2, 'toolResults length');
assertEqual(t6.toolResults[0].name, 'click', 'first tool result name');
assertEqual(t6.toolResults[0].success, true, 'first tool result success');
assertEqual(t6.toolResults[1].success, false, 'second tool result failure');

// --- createTurnResult with permissionDenials ------------------------------

console.log('\n--- createTurnResult with permissionDenials ---');
const t7 = createTurnResult({
  permissionDenials: [{ toolName: 'navigate', reason: 'blocked domain' }]
});
assertEqual(t7.permissionDenials.length, 1, 'permissionDenials length');
assertEqual(t7.permissionDenials[0].toolName, 'navigate', 'denied toolName');
assertEqual(t7.permissionDenials[0].reason, 'blocked domain', 'denial reason');

// --- summarizeTurnResult produces expected format -------------------------

console.log('\n--- summarizeTurnResult format ---');
const summary = summarizeTurnResult(createTurnResult({
  iteration: 3,
  inputTokens: 1500,
  outputTokens: 400,
  cost: 0.0075,
  matchedTools: ['click', 'type'],
  stopReason: STOP_REASONS.TOOL_CALLS
}));
assert(summary.indexOf('Turn 3:') === 0, 'summary starts with "Turn {iteration}:"');
assert(summary.indexOf('2 tools') !== -1, 'summary mentions tool count');
assert(summary.indexOf('1500+400 tokens') !== -1, 'summary mentions tokens');
assert(summary.indexOf('$0.0075') !== -1, 'summary mentions cost');
assert(summary.indexOf('tool_calls') !== -1, 'summary mentions stopReason');

// --- summarizeTurnResult handles null/missing fields ----------------------

console.log('\n--- summarizeTurnResult handles empty input ---');
const emptySummary = summarizeTurnResult({});
assert(typeof emptySummary === 'string', 'summary of empty object is a string');
assert(emptySummary.indexOf('Turn 0:') === 0, 'empty summary starts with Turn 0');
assert(emptySummary.indexOf('0 tools') !== -1, 'empty summary shows 0 tools');

// --- accumulateTurnResults sums totals correctly --------------------------

console.log('\n--- accumulateTurnResults sums correctly ---');
const results = [
  createTurnResult({ inputTokens: 100, outputTokens: 50, cost: 0.001, matchedTools: ['click'] }),
  createTurnResult({ inputTokens: 200, outputTokens: 80, cost: 0.002, matchedTools: ['type', 'click'] }),
  createTurnResult({ inputTokens: 150, outputTokens: 60, cost: 0.0015, matchedTools: ['navigate'], stopReason: STOP_REASONS.END_TURN })
];
const agg = accumulateTurnResults(results);
assertEqual(agg.totalInputTokens, 450, 'sum of inputTokens');
assertEqual(agg.totalOutputTokens, 190, 'sum of outputTokens');
assert(Math.abs(agg.totalCost - 0.0045) < 1e-9, 'sum of cost');
assertEqual(agg.totalIterations, 3, 'totalIterations matches results length');
assertEqual(agg.finalStopReason, STOP_REASONS.END_TURN, 'finalStopReason picks up last turn');

// --- accumulateTurnResults deduplicates tool names ------------------------

console.log('\n--- accumulateTurnResults deduplicates tools ---');
assertEqual(agg.allMatchedTools.length, 3, 'unique tool count');
assert(agg.allMatchedTools.indexOf('click') !== -1, 'click in aggregate');
assert(agg.allMatchedTools.indexOf('type') !== -1, 'type in aggregate');
assert(agg.allMatchedTools.indexOf('navigate') !== -1, 'navigate in aggregate');

// --- accumulateTurnResults handles empty array ----------------------------

console.log('\n--- accumulateTurnResults handles empty array ---');
const emptyAgg = accumulateTurnResults([]);
assertEqual(emptyAgg.totalInputTokens, 0, 'empty sum input');
assertEqual(emptyAgg.totalOutputTokens, 0, 'empty sum output');
assertEqual(emptyAgg.totalCost, 0, 'empty sum cost');
assertEqual(emptyAgg.totalIterations, 0, 'empty iterations');
assertEqual(emptyAgg.allMatchedTools.length, 0, 'empty tools');
assertEqual(emptyAgg.finalStopReason, '', 'empty finalStopReason');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
