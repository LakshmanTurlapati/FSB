/**
 * Unit tests for ai/hook-pipeline.js
 *
 * Adapted from archive/remote-main tests/test-hook-pipeline.js. The archive's
 * HookPipeline had a synchronous emit/emitBlocking split, a channelRegistry
 * constructor argument, and co-located hook factory functions
 * (createCostHook, createProgressHook, etc). Local's design differs:
 *
 *   - LIFECYCLE_EVENTS is an OBJECT (not a frozen array) with SCREAMING_SNAKE
 *     keys mapped to camelCase string values.
 *   - emit() is async and returns {stopped, results, stoppedBy} — shouldStop
 *     semantics are carried on handler return values, not a separate
 *     emitBlocking() method.
 *   - register() returns an unsubscribe closure (not `this`) and WARNS on
 *     invalid events rather than throwing.
 *   - No channelRegistry — factories live in ai/hooks/ folder.
 *
 * This test file covers HookPipeline CORE (register/unregister/emit/removeAll/
 * getHandlerCount/error isolation/shouldStop chain). The archive's factory
 * tests (createCostHook/createTimeLimitHook/createStuckDetectionHook/
 * createPermissionHook/createProgressHook) are NOT ported here — local puts
 * equivalents in ai/hooks/*.js and would need a separate file per module.
 *
 * Run: node tests/hook-pipeline.test.js
 */

'use strict';

const { HookPipeline, LIFECYCLE_EVENTS } = require('../extension/ai/hook-pipeline.js');

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

async function run() {
  // --- LIFECYCLE_EVENTS has all 7 lifecycle values -----------------------

  console.log('\n--- LIFECYCLE_EVENTS has all 7 lifecycle values ---');
  assertEqual(LIFECYCLE_EVENTS.BEFORE_ITERATION, 'beforeIteration', 'BEFORE_ITERATION');
  assertEqual(LIFECYCLE_EVENTS.AFTER_API_RESPONSE, 'afterApiResponse', 'AFTER_API_RESPONSE');
  assertEqual(LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION, 'beforeToolExecution', 'BEFORE_TOOL_EXECUTION');
  assertEqual(LIFECYCLE_EVENTS.AFTER_TOOL_EXECUTION, 'afterToolExecution', 'AFTER_TOOL_EXECUTION');
  assertEqual(LIFECYCLE_EVENTS.AFTER_ITERATION, 'afterIteration', 'AFTER_ITERATION');
  assertEqual(LIFECYCLE_EVENTS.ON_COMPLETION, 'onCompletion', 'ON_COMPLETION');
  assertEqual(LIFECYCLE_EVENTS.ON_ERROR, 'onError', 'ON_ERROR');
  assertEqual(Object.keys(LIFECYCLE_EVENTS).length, 7, 'exactly 7 events');

  // --- new HookPipeline() starts empty -----------------------------------

  console.log('\n--- new HookPipeline() starts empty ---');
  {
    const hp = new HookPipeline();
    assertEqual(hp.getHandlerCount(), 0, 'total handler count is 0');
    assertEqual(hp.getHandlerCount('afterIteration'), 0, 'per-event count is 0');
  }

  // --- register + emit basic flow ----------------------------------------

  console.log('\n--- register + emit basic flow ---');
  {
    const hp = new HookPipeline();
    let received = null;
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function (ctx) { received = ctx; });
    const result = await hp.emit(LIFECYCLE_EVENTS.AFTER_ITERATION, { iteration: 5 });
    assert(received !== null, 'handler was called');
    assertEqual(received.iteration, 5, 'handler received correct context');
    assertEqual(result.stopped, false, 'emit result not stopped');
    assertEqual(result.results.length, 1, 'emit result has 1 handler result');
    assertEqual(result.stoppedBy, null, 'stoppedBy is null');
  }

  // --- register returns an unsubscribe closure ---------------------------

  console.log('\n--- register returns an unsubscribe closure ---');
  {
    const hp = new HookPipeline();
    let called = false;
    const unsub = hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { called = true; });
    assert(typeof unsub === 'function', 'register returns a function');
    unsub();
    await hp.emit(LIFECYCLE_EVENTS.AFTER_ITERATION, {});
    assert(!called, 'handler not called after unsubscribe closure invoked');
  }

  // --- register warns on invalid event (does not throw) ------------------

  console.log('\n--- register warns on invalid event (does not throw) ---');
  {
    const hp = new HookPipeline();
    const origWarn = console.warn;
    let warnedWith = '';
    console.warn = function (msg) { warnedWith = String(msg); };
    let threw = false;
    let ret;
    try {
      ret = hp.register('notARealEvent', function () {});
    } catch (_) {
      threw = true;
    }
    console.warn = origWarn;
    assert(!threw, 'register does NOT throw on invalid event');
    assert(warnedWith.indexOf('notARealEvent') !== -1, 'warning mentions the invalid event name');
    assert(typeof ret === 'function', 'invalid register still returns a noop function');
    assertEqual(hp.getHandlerCount('notARealEvent'), 0, 'no handler registered for invalid event');
  }

  // --- emit with no handlers returns empty result ------------------------

  console.log('\n--- emit with no handlers returns empty result ---');
  {
    const hp = new HookPipeline();
    const result = await hp.emit(LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION, {});
    assertEqual(result.stopped, false, 'stopped is false');
    assertEqual(result.results.length, 0, 'results is empty');
    assertEqual(result.stoppedBy, null, 'stoppedBy is null');
  }

  // --- emit preserves registration order ---------------------------------

  console.log('\n--- emit preserves registration order ---');
  {
    const hp = new HookPipeline();
    const order = [];
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { order.push('a'); });
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { order.push('b'); });
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { order.push('c'); });
    await hp.emit(LIFECYCLE_EVENTS.AFTER_ITERATION, {});
    assertEqual(order.join(','), 'a,b,c', 'handlers run in registration order');
  }

  // --- emit stops the chain on shouldStop = true -------------------------

  console.log('\n--- emit stops the chain on shouldStop = true ---');
  {
    const hp = new HookPipeline();
    let secondCalled = false;
    hp.register(LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION, function () {
      return { shouldStop: true, reason: 'denied for test' };
    });
    hp.register(LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION, function () { secondCalled = true; });
    const result = await hp.emit(LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION, { tool: 'click' });
    assertEqual(result.stopped, true, 'result.stopped is true');
    assertEqual(result.stoppedBy, 'denied for test', 'stoppedBy carries the reason');
    assert(!secondCalled, 'second handler NOT called after first signals shouldStop');
  }

  // --- emit error isolation: one throwing handler does not break chain ---

  console.log('\n--- emit error isolation: one throwing handler does not break chain ---');
  {
    const hp = new HookPipeline();
    let secondCalled = false;
    let warnedWith = '';
    const origWarn = console.warn;
    console.warn = function () { warnedWith += Array.prototype.join.call(arguments, ' '); };
    hp.register(LIFECYCLE_EVENTS.ON_ERROR, function () { throw new Error('handler exploded'); });
    hp.register(LIFECYCLE_EVENTS.ON_ERROR, function () { secondCalled = true; });
    await hp.emit(LIFECYCLE_EVENTS.ON_ERROR, {});
    console.warn = origWarn;
    assert(secondCalled, 'second handler called despite first throwing (error swallowed)');
    assert(warnedWith.indexOf('handler error on onError') !== -1, 'error logged via console.warn');
  }

  // --- emit survives async handlers --------------------------------------

  console.log('\n--- emit awaits async handlers ---');
  {
    const hp = new HookPipeline();
    let value = 0;
    hp.register(LIFECYCLE_EVENTS.BEFORE_ITERATION, async function () {
      await new Promise(function (r) { setTimeout(r, 5); });
      value = 42;
    });
    await hp.emit(LIFECYCLE_EVENTS.BEFORE_ITERATION, {});
    assertEqual(value, 42, 'async handler completed before emit returned');
  }

  // --- unregister removes a specific handler by reference ----------------

  console.log('\n--- unregister removes a specific handler by reference ---');
  {
    const hp = new HookPipeline();
    let aCalled = false;
    let bCalled = false;
    const handlerA = function () { aCalled = true; };
    const handlerB = function () { bCalled = true; };
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, handlerA);
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, handlerB);
    hp.unregister(LIFECYCLE_EVENTS.ON_COMPLETION, handlerA);
    await hp.emit(LIFECYCLE_EVENTS.ON_COMPLETION, {});
    assert(!aCalled, 'unregistered handlerA NOT called');
    assert(bCalled, 'handlerB still called');
  }

  // --- getHandlerCount: per-event and total ------------------------------

  console.log('\n--- getHandlerCount: per-event and total ---');
  {
    const hp = new HookPipeline();
    const fn1 = function () {};
    const fn2 = function () {};
    const fn3 = function () {};
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, fn1);
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, fn2);
    hp.register(LIFECYCLE_EVENTS.BEFORE_ITERATION, fn3);
    assertEqual(hp.getHandlerCount(LIFECYCLE_EVENTS.ON_COMPLETION), 2, 'per-event count for onCompletion');
    assertEqual(hp.getHandlerCount(LIFECYCLE_EVENTS.BEFORE_ITERATION), 1, 'per-event count for beforeIteration');
    assertEqual(hp.getHandlerCount(), 3, 'total handler count across all events');
    assertEqual(hp.getHandlerCount(LIFECYCLE_EVENTS.ON_ERROR), 0, 'empty event reports 0');
  }

  // --- removeAll(event) clears only that event ---------------------------

  console.log('\n--- removeAll(event) clears only that event ---');
  {
    const hp = new HookPipeline();
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, function () {});
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, function () {});
    hp.register(LIFECYCLE_EVENTS.BEFORE_ITERATION, function () {});
    hp.removeAll(LIFECYCLE_EVENTS.ON_COMPLETION);
    assertEqual(hp.getHandlerCount(LIFECYCLE_EVENTS.ON_COMPLETION), 0, 'removed event has 0 handlers');
    assertEqual(hp.getHandlerCount(LIFECYCLE_EVENTS.BEFORE_ITERATION), 1, 'other event unaffected');
  }

  // --- removeAll() with no args clears everything ------------------------

  console.log('\n--- removeAll() with no args clears everything ---');
  {
    const hp = new HookPipeline();
    hp.register(LIFECYCLE_EVENTS.ON_COMPLETION, function () {});
    hp.register(LIFECYCLE_EVENTS.BEFORE_ITERATION, function () {});
    hp.register(LIFECYCLE_EVENTS.ON_ERROR, function () {});
    hp.removeAll();
    assertEqual(hp.getHandlerCount(), 0, 'all handlers removed');
  }

  // --- unregister cleans up empty event arrays ---------------------------

  console.log('\n--- unregister cleans up empty event arrays ---');
  {
    const hp = new HookPipeline();
    const handler = function () {};
    hp.register(LIFECYCLE_EVENTS.ON_ERROR, handler);
    hp.unregister(LIFECYCLE_EVENTS.ON_ERROR, handler);
    assertEqual(hp.getHandlerCount(LIFECYCLE_EVENTS.ON_ERROR), 0, 'unregister to empty removes key');
  }

  // --- emit collects handler return values into results array -----------

  console.log('\n--- emit collects handler return values into results array ---');
  {
    const hp = new HookPipeline();
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { return { a: 1 }; });
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { return { b: 2 }; });
    hp.register(LIFECYCLE_EVENTS.AFTER_ITERATION, function () { return { c: 3 }; });
    const result = await hp.emit(LIFECYCLE_EVENTS.AFTER_ITERATION, {});
    assertEqual(result.results.length, 3, 'three results collected');
    assertEqual(result.results[0].a, 1, 'first handler result');
    assertEqual(result.results[1].b, 2, 'second handler result');
    assertEqual(result.results[2].c, 3, 'third handler result');
  }

  // --- handler signalling shouldStop with reason=null also stops -------

  console.log('\n--- shouldStop with explicit null reason still stops chain ---');
  {
    const hp = new HookPipeline();
    let secondCalled = false;
    hp.register(LIFECYCLE_EVENTS.BEFORE_ITERATION, function () {
      return { shouldStop: true }; // no reason
    });
    hp.register(LIFECYCLE_EVENTS.BEFORE_ITERATION, function () { secondCalled = true; });
    const result = await hp.emit(LIFECYCLE_EVENTS.BEFORE_ITERATION, {});
    assertEqual(result.stopped, true, 'stopped flag is true');
    assertEqual(result.stoppedBy, null, 'stoppedBy is null when reason omitted');
    assert(!secondCalled, 'chain halted');
  }

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function (err) {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
