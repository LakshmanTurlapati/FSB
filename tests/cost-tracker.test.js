/**
 * Unit tests for ai/cost-tracker.js
 *
 * Adapted from archive/remote-main tests/test-cost-tracker.js. The archive
 * exported standalone checkBudget / checkTimeLimit functions that read
 * agentState.totalCost / agentState.startTime; local uses an instance-based
 * CostTracker class with a record()/checkBudget() method pair instead. The
 * tests below preserve the pricing + budget enforcement validation intent
 * against local's actual API surface.
 *
 * Note: local also has an orthogonal source-level regression test at
 * tests/cost-tracker-ordering.test.js that verifies agent-loop.js
 * construction ordering. These two test files complement each other.
 *
 * Run: node tests/cost-tracker.test.js
 */

'use strict';

const {
  MODEL_PRICING,
  estimateCost,
  CostTracker
} = require('../extension/ai/cost-tracker.js');

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

function assertClose(actual, expected, msg, epsilon) {
  const eps = epsilon || 0.0001;
  assert(Math.abs(actual - expected) < eps, msg + ' (expected: ~' + expected + ', got: ' + actual + ')');
}

// --- MODEL_PRICING table presence ----------------------------------------

console.log('\n--- MODEL_PRICING table presence ---');
assert(typeof MODEL_PRICING === 'object' && MODEL_PRICING !== null, 'MODEL_PRICING is an object');
assert('grok-4-1-fast-reasoning' in MODEL_PRICING, 'has grok-4-1-fast-reasoning');
assertEqual(MODEL_PRICING['grok-4-1-fast-reasoning'].input, 0.20, 'grok-4-1-fast-reasoning input price');
assertEqual(MODEL_PRICING['grok-4-1-fast-reasoning'].output, 0.50, 'grok-4-1-fast-reasoning output price');
assert('gpt-4o' in MODEL_PRICING, 'has gpt-4o');
assertEqual(MODEL_PRICING['gpt-4o'].input, 2.50, 'gpt-4o input price');
assertEqual(MODEL_PRICING['gpt-4o'].output, 10.00, 'gpt-4o output price');
assert('claude-sonnet-4-5-20250514' in MODEL_PRICING, 'has claude-sonnet-4-5-20250514');
assertEqual(MODEL_PRICING['claude-sonnet-4-5-20250514'].input, 3.00, 'claude sonnet input price');
assertEqual(MODEL_PRICING['claude-sonnet-4-5-20250514'].output, 15.00, 'claude sonnet output price');
assert('claude-opus-4-1-20250414' in MODEL_PRICING, 'has claude-opus-4-1-20250414');
assert('gemini-2.5-flash' in MODEL_PRICING, 'has gemini-2.5-flash');
assert('gemini-2.0-flash' in MODEL_PRICING, 'has gemini-2.0-flash (free tier)');
assertEqual(MODEL_PRICING['gemini-2.0-flash'].input, 0.00, 'gemini-2.0-flash free input');
assertEqual(MODEL_PRICING['gemini-2.0-flash'].output, 0.00, 'gemini-2.0-flash free output');

const modelCount = Object.keys(MODEL_PRICING).length;
assert(modelCount >= 20, 'MODEL_PRICING has 20+ entries (got ' + modelCount + ')');

// --- estimateCost: exact model match -------------------------------------

console.log('\n--- estimateCost: exact model match ---');
// grok-4-1-fast-reasoning: input 0.20/1M, output 0.50/1M -> 1M/1M = $0.70
assertClose(estimateCost('grok-4-1-fast-reasoning', 1000000, 1000000), 0.70, 'grok-4-1-fast-reasoning 1M/1M = $0.70');
// grok-4-1-fast-reasoning: 1M input, 100K output -> $0.20 + $0.05 = $0.25
assertClose(estimateCost('grok-4-1-fast-reasoning', 1000000, 100000), 0.25, 'grok-4-1-fast-reasoning 1M/100K = $0.25');
// gpt-4o: 1M/1M = $12.50
assertClose(estimateCost('gpt-4o', 1000000, 1000000), 12.50, 'gpt-4o 1M/1M = $12.50');
// claude-sonnet-4-5: 1M/1M = $18.00
assertClose(estimateCost('claude-sonnet-4-5-20250514', 1000000, 1000000), 18.00, 'claude-sonnet-4-5 1M/1M = $18.00');

// --- estimateCost: prefix / substring match ------------------------------

console.log('\n--- estimateCost: prefix / substring match ---');
// Versioned model name that starts with a known key should match it
assertClose(estimateCost('grok-4-1-fast-reasoning-v2', 1000000, 0), 0.20, 'prefix match: grok-4-1-fast-reasoning-v2 matches grok-4-1-fast-reasoning');

// --- estimateCost: unknown model fallback --------------------------------

console.log('\n--- estimateCost: unknown model fallback ---');
// Unknown model should default to grok-4-1-fast-reasoning pricing (0.20/0.50)
assertClose(estimateCost('totally-unknown-model', 1000000, 1000000), 0.70, 'unknown model defaults to grok-4-1-fast-reasoning pricing');

// --- estimateCost: null / zero inputs ------------------------------------

console.log('\n--- estimateCost: null / zero inputs ---');
assertEqual(estimateCost(null, 0, 0), 0, 'null model, zero tokens returns 0');
assertEqual(estimateCost('grok-4-1-fast-reasoning', 0, 0), 0, 'zero tokens returns 0 regardless of model');

// --- estimateCost: LM Studio stays free -----------------------------------

console.log('\n--- estimateCost: LM Studio local usage ---');
assertEqual(
  estimateCost('qwen/qwen3-30b-a3b', 1000000, 1000000, 'lmstudio'),
  0,
  'LM Studio local usage is always $0'
);

// --- CostTracker construction --------------------------------------------

console.log('\n--- CostTracker construction ---');
{
  const ct = new CostTracker(5.00);
  assertEqual(ct.totalCost, 0, 'initial totalCost is 0');
  assertEqual(ct.totalInputTokens, 0, 'initial totalInputTokens is 0');
  assertEqual(ct.totalOutputTokens, 0, 'initial totalOutputTokens is 0');
  assertEqual(ct.callCount, 0, 'initial callCount is 0');
  assertEqual(ct.costLimit, 5.00, 'costLimit passed through constructor');
}

// --- CostTracker default costLimit ---------------------------------------

console.log('\n--- CostTracker default costLimit ---');
{
  const ct = new CostTracker();
  assertEqual(ct.costLimit, 2.00, 'default costLimit is $2.00');
}

// --- CostTracker.record() accumulates correctly --------------------------

console.log('\n--- CostTracker.record() accumulates ---');
{
  const ct = new CostTracker(10.00);
  const c1 = ct.record('grok-4-1-fast-reasoning', 1000000, 1000000);
  assertClose(c1, 0.70, 'first call returns individual cost');
  assertClose(ct.totalCost, 0.70, 'totalCost after one call');
  assertEqual(ct.totalInputTokens, 1000000, 'totalInputTokens after one call');
  assertEqual(ct.totalOutputTokens, 1000000, 'totalOutputTokens after one call');
  assertEqual(ct.callCount, 1, 'callCount after one call');

  const c2 = ct.record('grok-4-1-fast-reasoning', 500000, 200000);
  // 0.1 + 0.1 = 0.20
  assertClose(c2, 0.20, 'second call returns individual cost');
  assertClose(ct.totalCost, 0.90, 'totalCost after two calls');
  assertEqual(ct.totalInputTokens, 1500000, 'totalInputTokens after two calls');
  assertEqual(ct.totalOutputTokens, 1200000, 'totalOutputTokens after two calls');
  assertEqual(ct.callCount, 2, 'callCount after two calls');
}

// --- CostTracker.record() handles missing tokens -------------------------

console.log('\n--- CostTracker.record() handles missing tokens ---');
{
  const ct = new CostTracker();
  ct.record('grok-4-1-fast-reasoning', undefined, undefined);
  assertEqual(ct.totalInputTokens, 0, 'undefined inputTokens treated as 0');
  assertEqual(ct.totalOutputTokens, 0, 'undefined outputTokens treated as 0');
  assertEqual(ct.callCount, 1, 'callCount still incremented');
}

// --- CostTracker.record() keeps LM Studio free ----------------------------

console.log('\n--- CostTracker.record() keeps LM Studio free ---');
{
  const ct = new CostTracker();
  const cost = ct.record('qwen/qwen3-30b-a3b', 1000000, 1000000, 'lmstudio');
  assertEqual(cost, 0, 'LM Studio call cost is $0');
  assertEqual(ct.totalCost, 0, 'LM Studio does not increase totalCost');
  assertEqual(ct.callCount, 1, 'LM Studio calls still increment callCount');
}

// --- CostTracker.checkBudget(): under limit ------------------------------

console.log('\n--- CostTracker.checkBudget(): under limit ---');
{
  const ct = new CostTracker(2.00);
  ct.record('grok-4-1-fast-reasoning', 1000000, 500000);
  // Cost: 0.20 + 0.25 = 0.45
  const budget = ct.checkBudget();
  assertEqual(budget.exceeded, false, 'under limit -> exceeded is false');
  assertEqual(budget.reason, null, 'under limit -> reason is null');
  assertEqual(budget.costLimit, 2.00, 'checkBudget echoes costLimit');
  assertClose(budget.totalCost, 0.45, 'checkBudget echoes totalCost');
}

// --- CostTracker.checkBudget(): Phase 231 — enforcement disabled ---------

console.log('\n--- CostTracker.checkBudget(): Phase 231 — limit no longer enforced ---');
{
  const ct = new CostTracker(0.50);
  ct.record('grok-4-1-fast-reasoning', 1000000, 1000000);
  // Cost: 0.70 — would have exceeded 0.50 pre-Phase-231
  const budget = ct.checkBudget();
  assertEqual(budget.exceeded, false, 'Phase 231: cost over old limit no longer triggers exceeded');
  assertEqual(budget.reason, null, 'Phase 231: no termination reason emitted');
  assertClose(budget.totalCost, 0.70, 'totalCost still tracked accurately for analytics');
  assertEqual(budget.costLimit, 0.50, 'costLimit field preserved for backward-compat reads');
}

console.log('\n--- CostTracker.checkBudget(): Phase 231 — at-limit also no longer enforced ---');
{
  const ct = new CostTracker(0.70);
  ct.record('grok-4-1-fast-reasoning', 1000000, 1000000);
  // Cost: exactly 0.70
  const budget = ct.checkBudget();
  assertEqual(budget.exceeded, false, 'Phase 231: at-limit no longer triggers exceeded');
}

// --- CostTracker.toJSON() serialization ----------------------------------

console.log('\n--- CostTracker.toJSON() ---');
{
  const ct = new CostTracker(3.00);
  ct.record('grok-4-1-fast-reasoning', 1000000, 500000);
  ct.record('gpt-4o', 500000, 100000);
  const json = ct.toJSON();
  assertClose(json.totalCost, 0.45 + 2.25, 'toJSON totalCost');
  assertEqual(json.totalInputTokens, 1500000, 'toJSON totalInputTokens');
  assertEqual(json.totalOutputTokens, 600000, 'toJSON totalOutputTokens');
  assertEqual(json.callCount, 2, 'toJSON callCount');
  assertEqual(json.costLimit, 3.00, 'toJSON costLimit');
}

// --- CostTracker isolation: multiple independent instances ---------------

console.log('\n--- CostTracker isolation between instances ---');
{
  const a = new CostTracker(1.00);
  const b = new CostTracker(5.00);
  a.record('grok-4-1-fast-reasoning', 1000000, 1000000);
  assertClose(a.totalCost, 0.70, 'a.totalCost updated');
  assertEqual(b.totalCost, 0, 'b.totalCost unaffected by a.record()');
  assertEqual(b.callCount, 0, 'b.callCount unaffected');
}

// --- exports check --------------------------------------------------------

console.log('\n--- exports check ---');
assert(typeof MODEL_PRICING === 'object', 'exports MODEL_PRICING');
assert(typeof estimateCost === 'function', 'exports estimateCost');
assert(typeof CostTracker === 'function', 'exports CostTracker');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
