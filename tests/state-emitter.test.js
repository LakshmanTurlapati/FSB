/**
 * Unit tests for ai/state-emitter.js
 *
 * Adapted from archive/remote-main tests/test-session-emitter.js. The archive
 * used a `SessionEmitter` class with a `bridgeToRuntime()` method and
 * different event names. Local's SessionStateEmitter instead:
 *   - Auto-broadcasts via chrome.runtime.sendMessage from inside emit()
 *     (guarded for non-Chrome environments, so tests run cleanly in Node).
 *   - Uses a fixed STATE_EVENTS enum (7 event types).
 *   - Exposes emitStatusChange() / emitIterationComplete() convenience
 *     helpers for common payload shapes.
 *
 * Run: node tests/state-emitter.test.js
 */

'use strict';

const {
  SessionStateEmitter,
  STATE_EVENTS,
  emitStatusChange,
  emitIterationComplete
} = require('../ai/state-emitter.js');

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

// --- STATE_EVENTS enum ---------------------------------------------------

console.log('\n--- STATE_EVENTS enum ---');
assertEqual(STATE_EVENTS.STATUS_CHANGED, 'status_changed', 'STATUS_CHANGED');
assertEqual(STATE_EVENTS.ITERATION_COMPLETE, 'iteration_complete', 'ITERATION_COMPLETE');
assertEqual(STATE_EVENTS.COST_UPDATED, 'cost_updated', 'COST_UPDATED');
assertEqual(STATE_EVENTS.TOOL_EXECUTED, 'tool_executed', 'TOOL_EXECUTED');
assertEqual(STATE_EVENTS.SESSION_STARTED, 'session_started', 'SESSION_STARTED');
assertEqual(STATE_EVENTS.SESSION_ENDED, 'session_ended', 'SESSION_ENDED');
assertEqual(STATE_EVENTS.ERROR_OCCURRED, 'error_occurred', 'ERROR_OCCURRED');
assertEqual(Object.keys(STATE_EVENTS).length, 7, 'exactly 7 state events');

// --- new SessionStateEmitter() starts with no handlers ------------------

console.log('\n--- new SessionStateEmitter() starts with no handlers ---');
{
  const em = new SessionStateEmitter();
  assert(em._handlers && typeof em._handlers === 'object', '_handlers initialized');
  assertEqual(Object.keys(em._handlers).length, 0, 'no events registered initially');
}

// --- on() + emit() basic flow --------------------------------------------

console.log('\n--- on() + emit() basic flow ---');
{
  const em = new SessionStateEmitter();
  let received = null;
  em.on(STATE_EVENTS.STATUS_CHANGED, function (data) { received = data; });
  em.emit(STATE_EVENTS.STATUS_CHANGED, { sessionId: 'sess-1', newStatus: 'running' });
  assert(received !== null, 'handler was called');
  assertEqual(received.sessionId, 'sess-1', 'data.sessionId passed through');
  assertEqual(received.newStatus, 'running', 'data.newStatus passed through');
}

// --- on() returns an unsubscribe closure ---------------------------------

console.log('\n--- on() returns an unsubscribe closure ---');
{
  const em = new SessionStateEmitter();
  let called = false;
  const unsub = em.on(STATE_EVENTS.STATUS_CHANGED, function () { called = true; });
  assert(typeof unsub === 'function', 'on() returns a function');
  unsub();
  em.emit(STATE_EVENTS.STATUS_CHANGED, {});
  assert(!called, 'handler NOT called after unsubscribe closure invoked');
}

// --- off() removes handler by reference ---------------------------------

console.log('\n--- off() removes handler by reference ---');
{
  const em = new SessionStateEmitter();
  let aCalled = false;
  let bCalled = false;
  const handlerA = function () { aCalled = true; };
  const handlerB = function () { bCalled = true; };
  em.on(STATE_EVENTS.STATUS_CHANGED, handlerA);
  em.on(STATE_EVENTS.STATUS_CHANGED, handlerB);
  em.off(STATE_EVENTS.STATUS_CHANGED, handlerA);
  em.emit(STATE_EVENTS.STATUS_CHANGED, {});
  assert(!aCalled, 'removed handlerA NOT called');
  assert(bCalled, 'handlerB still called');
}

// --- multiple handlers all run on emit -----------------------------------

console.log('\n--- multiple handlers all run on emit ---');
{
  const em = new SessionStateEmitter();
  const log = [];
  em.on(STATE_EVENTS.ITERATION_COMPLETE, function () { log.push('a'); });
  em.on(STATE_EVENTS.ITERATION_COMPLETE, function () { log.push('b'); });
  em.on(STATE_EVENTS.ITERATION_COMPLETE, function () { log.push('c'); });
  em.emit(STATE_EVENTS.ITERATION_COMPLETE, {});
  assertEqual(log.length, 3, 'all 3 handlers called');
  assert(log.indexOf('a') !== -1, 'handler a called');
  assert(log.indexOf('b') !== -1, 'handler b called');
  assert(log.indexOf('c') !== -1, 'handler c called');
}

// --- emit() with no handlers is a silent no-op --------------------------

console.log('\n--- emit() with no handlers is a silent no-op ---');
{
  const em = new SessionStateEmitter();
  let threw = false;
  try { em.emit(STATE_EVENTS.ERROR_OCCURRED, { err: 'x' }); } catch (_) { threw = true; }
  assert(!threw, 'emit with no handlers does not throw');
}

// --- emit() error isolation: throwing handler does not break emitter ----

console.log('\n--- emit() error isolation: throwing handler ---');
{
  const em = new SessionStateEmitter();
  let secondCalled = false;
  const origError = console.error;
  let errLogged = false;
  console.error = function () { errLogged = true; };
  em.on(STATE_EVENTS.ERROR_OCCURRED, function () { throw new Error('handler exploded'); });
  em.on(STATE_EVENTS.ERROR_OCCURRED, function () { secondCalled = true; });
  em.emit(STATE_EVENTS.ERROR_OCCURRED, {});
  console.error = origError;
  assert(secondCalled, 'second handler called despite first throwing (error swallowed)');
  assert(errLogged, 'error logged via console.error');
}

// --- set semantics: same handler reference is not added twice -----------

console.log('\n--- set semantics: same handler reference not added twice ---');
{
  const em = new SessionStateEmitter();
  let callCount = 0;
  const handler = function () { callCount++; };
  em.on(STATE_EVENTS.STATUS_CHANGED, handler);
  em.on(STATE_EVENTS.STATUS_CHANGED, handler); // second .on() with same fn
  em.emit(STATE_EVENTS.STATUS_CHANGED, {});
  assertEqual(callCount, 1, 'same handler registered twice is only called once (Set semantics)');
}

// --- removeAllListeners(eventType) clears only that event type ---------

console.log('\n--- removeAllListeners(eventType) clears only that event ---');
{
  const em = new SessionStateEmitter();
  let aCalled = false;
  let bCalled = false;
  em.on(STATE_EVENTS.STATUS_CHANGED, function () { aCalled = true; });
  em.on(STATE_EVENTS.COST_UPDATED, function () { bCalled = true; });
  em.removeAllListeners(STATE_EVENTS.STATUS_CHANGED);
  em.emit(STATE_EVENTS.STATUS_CHANGED, {});
  em.emit(STATE_EVENTS.COST_UPDATED, {});
  assert(!aCalled, 'status_changed handler removed');
  assert(bCalled, 'cost_updated handler preserved');
}

// --- removeAllListeners() with no args clears everything ----------------

console.log('\n--- removeAllListeners() with no args clears everything ---');
{
  const em = new SessionStateEmitter();
  let anyCalled = false;
  em.on(STATE_EVENTS.STATUS_CHANGED, function () { anyCalled = true; });
  em.on(STATE_EVENTS.COST_UPDATED, function () { anyCalled = true; });
  em.on(STATE_EVENTS.ERROR_OCCURRED, function () { anyCalled = true; });
  em.removeAllListeners();
  em.emit(STATE_EVENTS.STATUS_CHANGED, {});
  em.emit(STATE_EVENTS.COST_UPDATED, {});
  em.emit(STATE_EVENTS.ERROR_OCCURRED, {});
  assert(!anyCalled, 'no handlers called after removeAllListeners()');
  assertEqual(Object.keys(em._handlers).length, 0, '_handlers is empty');
}

// --- off() cleans up empty handler sets ---------------------------------

console.log('\n--- off() cleans up empty handler sets ---');
{
  const em = new SessionStateEmitter();
  const h = function () {};
  em.on(STATE_EVENTS.STATUS_CHANGED, h);
  em.off(STATE_EVENTS.STATUS_CHANGED, h);
  assert(!(STATE_EVENTS.STATUS_CHANGED in em._handlers), 'empty event key deleted');
}

// --- emitStatusChange helper produces canonical payload ----------------

console.log('\n--- emitStatusChange helper produces canonical payload ---');
{
  const em = new SessionStateEmitter();
  let received = null;
  em.on(STATE_EVENTS.STATUS_CHANGED, function (data) { received = data; });
  emitStatusChange(em, 'sess-1', 'idle', 'running');
  assert(received !== null, 'status_changed emitted');
  assertEqual(received.sessionId, 'sess-1', 'sessionId in payload');
  assertEqual(received.oldStatus, 'idle', 'oldStatus in payload');
  assertEqual(received.newStatus, 'running', 'newStatus in payload');
  assert(typeof received.timestamp === 'number' && received.timestamp > 0, 'timestamp auto-populated');
}

// --- emitStatusChange helper merges extras into payload ----------------

console.log('\n--- emitStatusChange helper merges extras into payload ---');
{
  const em = new SessionStateEmitter();
  let received = null;
  em.on(STATE_EVENTS.STATUS_CHANGED, function (data) { received = data; });
  emitStatusChange(em, 'sess-1', 'idle', 'running', { reason: 'user started', tabId: 42 });
  assertEqual(received.reason, 'user started', 'extras.reason merged');
  assertEqual(received.tabId, 42, 'extras.tabId merged');
}

// --- emitStatusChange helper tolerates missing extras -----------------

console.log('\n--- emitStatusChange helper tolerates missing extras ---');
{
  const em = new SessionStateEmitter();
  let threw = false;
  em.on(STATE_EVENTS.STATUS_CHANGED, function () {});
  try {
    emitStatusChange(em, 'sess-1', 'idle', 'running');
    emitStatusChange(em, 'sess-1', 'idle', 'running', null);
    emitStatusChange(em, 'sess-1', 'idle', 'running', undefined);
  } catch (_) { threw = true; }
  assert(!threw, 'emitStatusChange tolerates missing/null/undefined extras');
}

// --- emitIterationComplete helper produces canonical payload ----------

console.log('\n--- emitIterationComplete helper produces canonical payload ---');
{
  const em = new SessionStateEmitter();
  let received = null;
  em.on(STATE_EVENTS.ITERATION_COMPLETE, function (data) { received = data; });
  emitIterationComplete(em, 'sess-2', 7, 0.034, 1500, 400);
  assert(received !== null, 'iteration_complete emitted');
  assertEqual(received.sessionId, 'sess-2', 'sessionId in payload');
  assertEqual(received.iteration, 7, 'iteration in payload');
  assertEqual(received.cost, 0.034, 'cost in payload');
  assertEqual(received.inputTokens, 1500, 'inputTokens in payload');
  assertEqual(received.outputTokens, 400, 'outputTokens in payload');
  assert(typeof received.timestamp === 'number' && received.timestamp > 0, 'timestamp auto-populated');
}

// --- emit() does not throw in Node environment (no chrome.runtime) ----

console.log('\n--- emit() does not throw in Node environment ---');
{
  const em = new SessionStateEmitter();
  let threw = false;
  try {
    em.emit(STATE_EVENTS.SESSION_STARTED, { sessionId: 'x' });
  } catch (_) { threw = true; }
  assert(!threw, 'emit without chrome.runtime does not throw');
}

// --- isolation: multiple emitters do not share handlers -------------

console.log('\n--- isolation: multiple emitters do not share handlers ---');
{
  const a = new SessionStateEmitter();
  const b = new SessionStateEmitter();
  let aCalls = 0;
  let bCalls = 0;
  a.on(STATE_EVENTS.STATUS_CHANGED, function () { aCalls++; });
  b.on(STATE_EVENTS.STATUS_CHANGED, function () { bCalls++; });
  a.emit(STATE_EVENTS.STATUS_CHANGED, {});
  assertEqual(aCalls, 1, 'a handler called');
  assertEqual(bCalls, 0, 'b handler NOT called by a.emit()');
  b.emit(STATE_EVENTS.STATUS_CHANGED, {});
  assertEqual(aCalls, 1, 'a handler still 1');
  assertEqual(bCalls, 1, 'b handler now called');
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
