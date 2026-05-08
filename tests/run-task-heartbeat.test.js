'use strict';

/**
 * Phase 239 plan 02 -- 30s setInterval heartbeat ticker validation.
 *
 * Validates that extension/ws/mcp-bridge-client.js:_handleStartAutomation:
 *   1. Starts a 30s setInterval ticker scoped to each Promise.
 *   2. Each tick emits notifications/progress with the D-01 9-field payload.
 *   3. settle() calls clearInterval(heartbeatTimer) (paired with clearTimeout).
 *   4. The settled-flag guards the heartbeat callback so no _sendProgress
 *      fires after settle.
 *   5. writeSnapshot fires on subscribe + every tick + on settle (D-04 cadence).
 *   6. Sequential invocations leave 0 active intervals (Pitfall 2 leak).
 *
 * Wave 0 (RED): all 6 cases fail because no setInterval call exists in
 * _handleStartAutomation yet.
 * Wave 1 (GREEN): all 6 cases pass once Task 2 wires the ticker.
 *
 * Run: node tests/run-task-heartbeat.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const util = require('util');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} (expected: ${expected}, got: ${actual})`);
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
}

// ---- Shared chrome / lifecycle / clock builders --------------------------

function createStorageArea(initial = {}) {
  const store = { ...initial };
  return {
    async get(keys) {
      if (keys == null) return { ...store };
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
      }
      if (typeof keys === 'object') {
        const out = {};
        Object.keys(keys).forEach((key) => {
          out[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
        });
        return out;
      }
      return { ...store };
    },
    async set(values) { Object.assign(store, values); },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => { delete store[key]; });
    },
    _dump() { return { ...store }; }
  };
}

function createOnMessageMock() {
  const listeners = [];
  return {
    addListener(fn) { listeners.push(fn); },
    removeListener(fn) {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    },
    _emit(message, sender = {}, sendResponse = () => {}) {
      for (const fn of [...listeners]) fn(message, sender, sendResponse);
    },
    _listeners() { return [...listeners]; }
  };
}

function createChromeMock() {
  const session = createStorageArea();
  const local = createStorageArea();
  const alarms = new Map();
  return {
    runtime: { id: 'phase-239-test', onMessage: createOnMessageMock(), lastError: null },
    storage: { session, local },
    alarms: {
      async create(name, options) { alarms.set(name, { name, ...options }); },
      async clear(name) { alarms.delete(name); return true; },
      async getAll() { return Array.from(alarms.values()); }
    }
  };
}

function createFakeWebSocketClass() {
  const sockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    open() { this.readyState = 1; if (typeof this.onopen === 'function') this.onopen(); }
    close() { this.readyState = 3; if (typeof this.onclose === 'function') this.onclose(); }
    send(payload) { this.sent.push(payload); }
  }
  FakeWebSocket.CONNECTING = 0;
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.CLOSED = 3;
  FakeWebSocket._sockets = sockets;
  return FakeWebSocket;
}

// In-context virtual clock that mirrors the harness fixture but lives inside
// the vm context so mcp-bridge-client.js sees the shimmed setInterval at
// evaluation AND invocation time.
function createVirtualClock() {
  let currentTime = 0;
  let nextHandle = 1;
  const pending = [];
  let activeIntervalCount = 0;

  function _enqueue(entry) {
    pending.push(entry);
    pending.sort((a, b) => a.fireAt - b.fireAt);
    return entry.handle;
  }

  function virtualSetTimeout(fn, ms) {
    return _enqueue({
      fireAt: currentTime + (Number(ms) || 0),
      fn, kind: 'timeout', handle: nextHandle++, cancelled: false
    });
  }
  function virtualSetInterval(fn, ms) {
    activeIntervalCount++;
    return _enqueue({
      fireAt: currentTime + (Number(ms) || 0),
      fn, kind: 'interval', intervalMs: Number(ms) || 0,
      handle: nextHandle++, cancelled: false
    });
  }
  function virtualClear(handle) {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].handle === handle) {
        if (pending[i].kind === 'interval') activeIntervalCount--;
        pending[i].cancelled = true;
        pending.splice(i, 1);
        return;
      }
    }
    // Maybe cancelled-after-fire (interval not in pending right now).
    // Walk a sentinel set: track all live interval handles separately.
    // For our test, the simpler approach is: scanning pending only is enough
    // because interval re-enqueues immediately after firing.
  }
  async function advance(ms) {
    const target = currentTime + (Number(ms) || 0);
    while (pending.length > 0 && pending[0].fireAt <= target) {
      const entry = pending.shift();
      if (entry.cancelled) continue;
      currentTime = entry.fireAt;
      try {
        const out = entry.fn();
        if (out && typeof out.then === 'function') {
          // Drain async callbacks before next fire so test assertions run after side effects.
          await out.catch(() => {});
        }
      } catch (_e) { /* swallow */ }
      if (entry.kind === 'interval' && !entry.cancelled) {
        entry.fireAt = currentTime + entry.intervalMs;
        _enqueue(entry);
      } else if (entry.kind === 'interval') {
        activeIntervalCount--;
      }
      // Allow microtasks to flush between fires
      await Promise.resolve();
    }
    currentTime = target;
    await Promise.resolve();
  }

  return {
    advance,
    now() { return currentTime; },
    activeIntervalCount() { return activeIntervalCount; },
    setInterval: virtualSetInterval,
    setTimeout: virtualSetTimeout,
    clearInterval: virtualClear,
    clearTimeout: virtualClear
  };
}

function buildHarness(opts = {}) {
  const chromeMock = createChromeMock();
  const FakeWebSocket = createFakeWebSocketClass();
  const clock = createVirtualClock();
  const writeSnapshotCalls = [];

  // Stub task-store: records every writeSnapshot call.
  const taskStoreStub = {
    writeSnapshot: (taskId, snap) => {
      writeSnapshotCalls.push({ taskId, snapshot: snap });
      return Promise.resolve();
    },
    readSnapshot: () => Promise.resolve(null),
    deleteSnapshot: () => Promise.resolve(),
    listInFlightSnapshots: () => Promise.resolve([]),
    hydrate: () => Promise.resolve({ v: 1, records: {} })
  };

  // Active sessions stub the heartbeat callback reads to populate the
  // payload's optional fields.
  const activeSessions = new Map();

  const FakeDate = class extends Date {
    static now() { return clock.now(); }
  };

  const context = {
    chrome: chromeMock,
    WebSocket: FakeWebSocket,
    console,
    Math,
    Date: FakeDate,
    EventTarget,
    CustomEvent,
    setInterval: clock.setInterval,
    setTimeout: clock.setTimeout,
    clearInterval: clock.clearInterval,
    clearTimeout: clock.clearTimeout,
    Promise,
    activeSessions,
    dispatchMcpMessageRoute: opts.dispatchMcpMessageRoute || (async () => ({ success: true, sessionId: opts.sessionId || 'sess_test' })),
    globalThis: {}
  };
  context.globalThis = context;

  // Install lifecycle bus + task store BEFORE evaluating mcp-bridge-client.js
  // so the captured globalThis-references resolve to the mocks.
  context.fsbAutomationLifecycleBus = new EventTarget();
  context.FsbMcpTaskStore = taskStoreStub;

  const source = fs.readFileSync(
    path.join(__dirname, '..', 'extension', 'ws', 'mcp-bridge-client.js'),
    'utf8'
  );
  const footer = `
this.__phase239 = {
  MCPBridgeClient,
  mcpBridgeClient,
  lifecycleBus: typeof fsbAutomationLifecycleBus !== 'undefined' ? fsbAutomationLifecycleBus : null
};
`;
  vm.runInNewContext(`${source}\n${footer}`, context, { filename: 'ws/mcp-bridge-client.js' });

  return {
    chrome: chromeMock,
    clock,
    sockets: FakeWebSocket._sockets,
    writeSnapshotCalls,
    activeSessions,
    context,
    exports: context.__phase239
  };
}

// ---- Tests ---------------------------------------------------------------

async function runTest(name, fn) {
  console.log('\n---', name, '---');
  try {
    await fn();
  } catch (err) {
    failed++;
    console.error('  ERROR:', name, '--', err && err.message ? err.message : err);
  }
}

(async () => {
  await runTest('first_tick_within_30s', async () => {
    const sessionId = 'sess_first_tick';
    const harness = buildHarness({ sessionId });
    const client = harness.exports.mcpBridgeClient;
    const sent = [];
    client._send = (msg) => sent.push(msg);

    const promise = client._handleStartAutomation({ task: 'check 30s' }, 'mcp_first_tick');
    // Allow setup microtasks to flush
    await flushMicrotasks();

    // Either implementation fires immediately on subscribe OR at 30s. Either is acceptable.
    const sentBefore30s = sent.filter((m) => m && m.type === 'mcp:progress').length;
    await harness.clock.advance(30_000);
    await flushMicrotasks();
    const sentBy30s = sent.filter((m) => m && m.type === 'mcp:progress').length;

    assert(sentBy30s >= 1, 'at least one heartbeat fired by t=30s');
    // Resolve the promise so it doesn't dangle
    harness.exports.lifecycleBus.dispatchEvent(new CustomEvent('automationComplete', {
      detail: { action: 'automationComplete', sessionId, result: {} }
    }));
    await promise;
  });

  await runTest('payload_shape_d01', async () => {
    const sessionId = 'sess_d01';
    const harness = buildHarness({ sessionId });
    const client = harness.exports.mcpBridgeClient;
    const sent = [];
    client._send = (msg) => sent.push(msg);

    // Seed a session entry the heartbeat callback can read.
    harness.activeSessions.set(sessionId, {
      iterationCount: 5,
      lastKnownUrl: 'https://example.com/page',
      _lastActionSummary: 'Clicked submit button',
      tabId: 99,
      lastDOMHash: 'hash_abc'
    });

    const promise = client._handleStartAutomation({ task: 'd01 shape' }, 'mcp_d01');
    await flushMicrotasks();
    await harness.clock.advance(30_000);
    await flushMicrotasks();

    const progressMsgs = sent.filter((m) => m && m.type === 'mcp:progress');
    assert(progressMsgs.length >= 1, 'at least one progress message was sent');
    const tick = progressMsgs[0].payload;
    assert(typeof tick.timestamp === 'number', 'timestamp is a number');
    assertEqual(tick.sessionId, sessionId, 'sessionId matches');
    assertEqual(tick.taskId, sessionId, 'taskId matches sessionId (single-task scope)');
    assertEqual(tick.alive, true, 'alive: true');
    assert(typeof tick.step === 'number', 'step is a number');
    assert(typeof tick.elapsed_ms === 'number', 'elapsed_ms is a number');
    // current_url, ai_cycles, last_action present (may be null/0 if session not seeded)
    assert(Object.prototype.hasOwnProperty.call(tick, 'current_url'), 'current_url field present');
    assert(Object.prototype.hasOwnProperty.call(tick, 'ai_cycles'), 'ai_cycles field present');
    assert(Object.prototype.hasOwnProperty.call(tick, 'last_action'), 'last_action field present');

    // Resolve
    harness.exports.lifecycleBus.dispatchEvent(new CustomEvent('automationComplete', {
      detail: { action: 'automationComplete', sessionId, result: {} }
    }));
    await promise;
  });

  await runTest('ticker_cleared_on_settle', async () => {
    const sessionId = 'sess_clear';
    const harness = buildHarness({ sessionId });
    const client = harness.exports.mcpBridgeClient;
    const sent = [];
    client._send = (msg) => sent.push(msg);

    const promise = client._handleStartAutomation({ task: 'clear test' }, 'mcp_clear');
    await flushMicrotasks();
    // Tick once
    await harness.clock.advance(30_000);
    await flushMicrotasks();
    const beforeSettle = sent.filter((m) => m && m.type === 'mcp:progress').length;

    // Settle via lifecycle bus
    harness.exports.lifecycleBus.dispatchEvent(new CustomEvent('automationComplete', {
      detail: { action: 'automationComplete', sessionId, result: {} }
    }));
    await promise;

    // Advance 60s past settle; heartbeat must NOT fire again
    await harness.clock.advance(60_000);
    await flushMicrotasks();
    const afterSettle = sent.filter((m) => m && m.type === 'mcp:progress').length;
    assertEqual(afterSettle, beforeSettle, 'no heartbeat ticks after settle');
  });

  await runTest('no_tick_after_settle', async () => {
    // Same invariant, expressed via the settled-flag guard inside the callback.
    const sessionId = 'sess_no_tick';
    const harness = buildHarness({ sessionId });
    const client = harness.exports.mcpBridgeClient;
    const sent = [];
    client._send = (msg) => sent.push(msg);

    const promise = client._handleStartAutomation({ task: 'no tick' }, 'mcp_no_tick');
    await flushMicrotasks();

    // Settle BEFORE any tick has fired
    harness.exports.lifecycleBus.dispatchEvent(new CustomEvent('automationComplete', {
      detail: { action: 'automationComplete', sessionId, result: {} }
    }));
    await promise;

    const progressBefore = sent.filter((m) => m && m.type === 'mcp:progress').length;

    // Advance 90s; ticker should be cleared so no progress fires.
    await harness.clock.advance(90_000);
    await flushMicrotasks();
    const progressAfter = sent.filter((m) => m && m.type === 'mcp:progress').length;
    assertEqual(progressAfter, progressBefore, 'no _sendProgress after settle (settled-flag guard)');
  });

  await runTest('store_write_cadence', async () => {
    const sessionId = 'sess_cadence';
    const harness = buildHarness({ sessionId });
    const client = harness.exports.mcpBridgeClient;
    client._send = () => {};

    const promise = client._handleStartAutomation({ task: 'cadence' }, 'mcp_cadence');
    await flushMicrotasks();
    // 3 ticks worth (90s)
    await harness.clock.advance(30_000); await flushMicrotasks();
    await harness.clock.advance(30_000); await flushMicrotasks();
    await harness.clock.advance(30_000); await flushMicrotasks();

    // Settle
    harness.exports.lifecycleBus.dispatchEvent(new CustomEvent('automationComplete', {
      detail: { action: 'automationComplete', sessionId, result: {} }
    }));
    await promise;
    await flushMicrotasks();

    const calls = harness.writeSnapshotCalls;
    assert(calls.length >= 4,
      `at least 4 writeSnapshot calls (1 subscribe-or-immediate-tick + 3+ ticks + 1 settle); got ${calls.length}`
    );
    // Assert at least one write has status 'in_progress' (tick) and one terminal
    const inFlight = calls.filter((c) => c.snapshot && c.snapshot.status === 'in_progress');
    const terminal = calls.filter((c) => c.snapshot && (
      c.snapshot.status === 'complete' || c.snapshot.status === 'error' ||
      c.snapshot.status === 'stopped' || c.snapshot.status === 'partial'
    ));
    assert(inFlight.length >= 1, 'at least one in_progress write (heartbeat tick)');
    assert(terminal.length >= 1, 'at least one terminal write (settle)');
  });

  await runTest('clear_interval_no_leak_across_invocations', async () => {
    const sessionId = 'sess_leak';
    const harness = buildHarness({ sessionId });
    const client = harness.exports.mcpBridgeClient;
    client._send = () => {};

    for (let i = 0; i < 5; i++) {
      const tid = sessionId + '_' + i;
      // Re-stub dispatch to return distinct sessionIds; in this harness
      // the stub is fixed so we use the bus dispatch with the harness sessionId.
      // Instead, we run sequentially with a fixed sessionId — each invocation
      // creates its own setInterval that must be cleared on settle.
      const p = client._handleStartAutomation({ task: 'leak ' + i }, 'mcp_leak_' + i);
      await flushMicrotasks();
      // Tick once
      await harness.clock.advance(30_000); await flushMicrotasks();
      // Settle
      harness.exports.lifecycleBus.dispatchEvent(new CustomEvent('automationComplete', {
        detail: { action: 'automationComplete', sessionId, result: {} }
      }));
      await p;
      await flushMicrotasks();
    }

    assertEqual(harness.clock.activeIntervalCount(), 0, '0 active setInterval handles after 5 sequential settles');
  });

  console.log('\n--- Phase 239 plan 02 run-task-heartbeat summary ---');
  console.log('  passed:', passed);
  console.log('  failed:', failed);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
