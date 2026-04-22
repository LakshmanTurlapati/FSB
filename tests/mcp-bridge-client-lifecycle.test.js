'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  assert(actual === expected, `${msg} (expected: ${expected}, got: ${actual})`);
}

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
    async set(values) {
      Object.assign(store, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => {
        delete store[key];
      });
    },
    _dump() {
      return { ...store };
    }
  };
}

function createFakeTimers() {
  const timeouts = [];
  const intervals = [];
  return {
    timeouts,
    intervals,
    setTimeout(fn, delay) {
      const timer = { fn, delay, cleared: false };
      timeouts.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cleared = true;
    },
    setInterval(fn, delay) {
      const timer = { fn, delay, cleared: false };
      intervals.push(timer);
      return timer;
    },
    clearInterval(timer) {
      if (timer) timer.cleared = true;
    }
  };
}

function createChromeMock() {
  const session = createStorageArea();
  const local = createStorageArea();
  const alarms = new Map();
  const cleared = [];
  return {
    runtime: { id: 'phase-198-test-extension' },
    storage: { session, local },
    alarms: {
      async create(name, options) {
        alarms.set(name, { name, ...options });
      },
      async clear(name) {
        cleared.push(name);
        alarms.delete(name);
        return true;
      },
      async getAll() {
        return Array.from(alarms.values());
      },
      _created() {
        return Array.from(alarms.values());
      },
      _cleared() {
        return [...cleared];
      }
    }
  };
}

function createFakeWebSocketClass(options = {}) {
  const sockets = [];

  class FakeWebSocket {
    constructor(url) {
      if (options.throwOnConstruct) {
        throw new Error('server unavailable');
      }
      this.url = url;
      this.readyState = FakeWebSocket.CONNECTING;
      this.sent = [];
      sockets.push(this);
    }

    open() {
      this.readyState = FakeWebSocket.OPEN;
      if (typeof this.onopen === 'function') this.onopen();
    }

    close() {
      this.readyState = FakeWebSocket.CLOSED;
      if (typeof this.onclose === 'function') this.onclose();
    }

    send(payload) {
      this.sent.push(payload);
    }
  }

  FakeWebSocket.CONNECTING = 0;
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.CLOSED = 3;
  FakeWebSocket._sockets = sockets;
  return FakeWebSocket;
}

function buildClientHarness(options = {}) {
  const chrome = createChromeMock();
  const timers = createFakeTimers();
  const FakeWebSocket = createFakeWebSocketClass(options);
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0;

  const context = {
    chrome,
    WebSocket: FakeWebSocket,
    console,
    Math: deterministicMath,
    Date,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    globalThis: {}
  };
  context.globalThis = context;

  const source = fs.readFileSync(path.join(__dirname, '..', 'ws', 'mcp-bridge-client.js'), 'utf8');
  const footer = `
this.__phase198 = {
  MCPBridgeClient,
  mcpBridgeClient,
  MCP_BRIDGE_STATE_KEY: typeof MCP_BRIDGE_STATE_KEY !== 'undefined' ? MCP_BRIDGE_STATE_KEY : undefined,
  MCP_RECONNECT_ALARM: typeof MCP_RECONNECT_ALARM !== 'undefined' ? MCP_RECONNECT_ALARM : undefined,
  MCP_RECONNECT_MAX_MS: typeof MCP_RECONNECT_MAX_MS !== 'undefined' ? MCP_RECONNECT_MAX_MS : undefined
};
`;
  vm.runInNewContext(`${source}\n${footer}`, context, { filename: 'ws/mcp-bridge-client.js' });

  return {
    chrome,
    timers,
    sockets: FakeWebSocket._sockets,
    exports: context.__phase198
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function assertNoSecrets(value, msg) {
  const serialized = JSON.stringify(value || {});
  assert(!/password|cardNumber|cvv|apiKey/i.test(serialized), msg);
}

async function runBrowserFirstReconnectCase() {
  console.log('\n--- browser-first reconnect state ---');

  const harness = buildClientHarness({ throwOnConstruct: true });
  const client = harness.exports.mcpBridgeClient;

  assertEqual(harness.exports.MCP_BRIDGE_STATE_KEY, 'mcpBridgeState', 'MCP_BRIDGE_STATE_KEY is exported as mcpBridgeState');
  assertEqual(harness.exports.MCP_RECONNECT_ALARM, 'fsb-mcp-bridge-reconnect', 'MCP_RECONNECT_ALARM is exported as fsb-mcp-bridge-reconnect');
  assertEqual(harness.exports.MCP_RECONNECT_MAX_MS, 30000, 'MCP_RECONNECT_MAX_MS remains bounded at 30000');

  client.connect();
  await flushMicrotasks();

  const sessionState = harness.chrome.storage.session._dump().mcpBridgeState;
  const localState = harness.chrome.storage.local._dump().mcpBridgeState;
  const reconnectAlarm = harness.chrome.alarms._created().find((alarm) => alarm.name === 'fsb-mcp-bridge-reconnect');
  const scheduledDelay = harness.timers.timeouts[0]?.delay;

  assert(sessionState && sessionState.status === 'reconnecting', 'browser-first failure persists reconnecting chrome.storage.session.mcpBridgeState');
  assertEqual(localState, undefined, 'chrome.storage.local._dump().mcpBridgeState remains undefined');
  assert(reconnectAlarm && reconnectAlarm.delayInMinutes === 0.5, 'reconnect alarm options include { delayInMinutes: 0.5 }');
  assert(typeof scheduledDelay === 'number' && scheduledDelay <= 30000, 'in-memory reconnect delay is no greater than 30000ms');
  assertNoSecrets(sessionState, 'mcpBridgeState omits password, cardNumber, cvv, and apiKey fields');
}

async function runServiceWorkerWakeCase() {
  console.log('\n--- service-worker wake state ---');

  const harness = buildClientHarness();
  const client = harness.exports.mcpBridgeClient;

  assert(typeof client.recordWake === 'function', 'mcpBridgeClient.recordWake(reason) exists');
  if (typeof client.recordWake === 'function') {
    await client.recordWake('service-worker-evaluated');
    await client.recordWake('runtime.onMessage');
  }
  await flushMicrotasks();

  const sessionState = harness.chrome.storage.session._dump().mcpBridgeState || (typeof client.getState === 'function' ? client.getState() : undefined);

  assertEqual(sessionState?.lastWakeReason, 'runtime.onMessage', "recordWake('runtime.onMessage') records lastWakeReason");
  assert(typeof sessionState?.wakeCount === 'number' && sessionState.wakeCount >= 2, 'recordWake updates wakeCount');
  assertEqual(harness.chrome.storage.local._dump().mcpBridgeState, undefined, 'wake state does not write chrome.storage.local._dump().mcpBridgeState');
  assertNoSecrets(sessionState, 'wake state omits password, cardNumber, cvv, and apiKey fields');
}

async function runConnectedTransitionCase() {
  console.log('\n--- connected transition state ---');

  const harness = buildClientHarness();
  const client = harness.exports.mcpBridgeClient;

  client.connect();
  const socket = harness.sockets[0];
  assert(socket, 'connect creates a WebSocket instance');
  if (socket) socket.open();
  await flushMicrotasks();

  const sessionState = harness.chrome.storage.session._dump().mcpBridgeState || (typeof client.getState === 'function' ? client.getState() : undefined);
  const reconnectDelay = sessionState?.reconnectDelayMs ?? sessionState?.nextReconnectDelayMs ?? client._reconnectDelay;

  assertEqual(sessionState?.status, 'connected', 'fake WebSocket onopen persists status: connected');
  assertEqual(reconnectDelay, 2000, 'fake WebSocket onopen resets reconnect delay to 2000');
  assert(harness.chrome.alarms._cleared().includes('fsb-mcp-bridge-reconnect'), 'fake WebSocket onopen clears fsb-mcp-bridge-reconnect alarm');
  assert(typeof sessionState?.lastConnectedAt === 'string' && sessionState.lastConnectedAt.length > 0, 'fake WebSocket onopen records lastConnectedAt');
  assertNoSecrets(sessionState, 'connected state omits password, cardNumber, cvv, and apiKey fields');
}

function runBackgroundArmingSourceCase() {
  console.log('\n--- background wake arming source ---');

  const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const requiredSnippets = [
    'function armMcpBridge(reason)',
    "armMcpBridge('service-worker-evaluated')",
    "armMcpBridge('runtime.onInstalled')",
    "armMcpBridge('runtime.onStartup')",
    "armMcpBridge('runtime.onMessage')",
    "armMcpBridge('runtime.onConnect')",
    "armMcpBridge('webNavigation.onCommitted')",
    "armMcpBridge('action.onClicked')",
    'alarm.name === MCP_RECONNECT_ALARM',
    "armMcpBridge('alarm:' + MCP_RECONNECT_ALARM)"
  ];

  for (const snippet of requiredSnippets) {
    assert(backgroundSource.includes(snippet), `background.js includes ${snippet}`);
  }
}

async function run() {
  await runBrowserFirstReconnectCase();
  await runServiceWorkerWakeCase();
  await runConnectedTransitionCase();
  runBackgroundArmingSourceCase();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
