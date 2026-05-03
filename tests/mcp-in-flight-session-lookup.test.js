'use strict';

/**
 * Phase 225-01 (Task 2): in-flight session lookup for stop_task and
 * get_session_detail.
 *
 * Today the dispatcher's session lookup only consults the COMPLETED-sessions
 * history store (automationLogger.loadSession). A session that is currently
 * running lives in the activeSessions map, never in history yet, so MCP
 * surfaces a misleading "Session not found" / "Page navigation" error while
 * the user can clearly see the run via get_task_status.
 *
 * These tests exercise handleGetSessionMessageRoute and handleStopAutomationRoute
 * against a minimal harness that mocks activeSessions + automationLogger.
 */

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

function buildHarness({ activeSessionEntries = [], historicalSession = null, stopHandler = null } = {}) {
  const dispatcherSource = fs.readFileSync(
    path.join(__dirname, '..', 'extension', 'ws', 'mcp-tool-dispatcher.js'),
    'utf8',
  );

  const context = {
    console,
    Math,
    Date,
    Map,
    Set,
    Array,
    Object,
    Number,
    Boolean,
    String,
    Promise,
    URL,
    Blob: typeof Blob !== 'undefined' ? Blob : undefined,
    JSON,
    activeSessions: undefined, // populated inside vm to use the same Map class
    automationLogger: {
      loadSession: async (sessionId) => (historicalSession && historicalSession.sessionId === sessionId ? historicalSession : null),
      listSessions: async () => [],
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {},
    },
    handleStopAutomation: stopHandler || ((req, _sender, sendResponse) => sendResponse({ success: true, sessionId: req.sessionId, stopped: true })),
    require: (modulePath) => {
      // Resolve relative requires from the dispatcher's location.
      if (modulePath.startsWith('../ai/tool-definitions.js')) {
        return require(path.join(__dirname, '..', 'extension', 'ai', 'tool-definitions.js'));
      }
      if (modulePath.startsWith('../utils/mcp-visual-session.js')) {
        return require(path.join(__dirname, '..', 'extension', 'utils', 'mcp-visual-session.js'));
      }
      throw new Error('Unsupported require in test harness: ' + modulePath);
    },
    chrome: {
      tabs: {
        query: async () => [],
      },
    },
    module: { exports: {} },
    globalThis: {},
  };
  context.globalThis = context;
  context.module.exports = {};

  // Initialize activeSessions as a Map constructed inside the vm so
  // dispatcher's `instanceof Map` check passes against the vm's Map class.
  const setupSource = `
    activeSessions = new Map();
    if (typeof __seed_active_session_entries !== 'undefined') {
      for (const [key, value] of __seed_active_session_entries) {
        activeSessions.set(key, value);
      }
    }
  `;
  context.__seed_active_session_entries = activeSessionEntries;
  vm.runInNewContext(setupSource + '\n' + dispatcherSource, context, { filename: 'ws/mcp-tool-dispatcher.js' });

  return {
    dispatcher: context.module.exports,
    context,
  };
}

async function runGetSessionDetailFallbackCase() {
  console.log('\n--- get_session_detail returns in-flight snapshot ---');

  const sessionId = 'session_active_1';
  const liveSession = {
    sessionId,
    status: 'running',
    task: 'Open Excalidraw and draw a triangle',
    startTime: Date.now() - 5000,
    iterationCount: 4,
    maxIterations: 20,
    actionHistory: [
      { tool: 'click', timestamp: Date.now() - 100, iteration: 4, params: { selector: '#draw-tool' }, result: { success: true } },
    ],
    tabId: 17,
    lastUrl: 'https://excalidraw.com/',
  };
  const { dispatcher } = buildHarness({ activeSessionEntries: [[sessionId, liveSession]] });

  const result = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:get-session',
    payload: { sessionId },
  });

  assert(result && result.success === true, 'in-flight get_session_detail returns success=true');
  assert(result && result.inFlight === true, 'in-flight get_session_detail flags inFlight: true');
  assert(result && result.session && result.session.final === false, 'in-flight snapshot carries final: false');
  assert(result && result.session && result.session.sessionId === sessionId, 'snapshot includes sessionId');
  assert(result && result.session && result.session.actionCount === 1, 'snapshot includes actionCount');
  assert(result && result.session && typeof result.session.note === 'string' && result.session.note.length > 0, 'snapshot includes a human-readable note');
}

async function runGetSessionDetailMissingCase() {
  console.log('\n--- get_session_detail surfaces session_not_found for unknown id ---');

  const { dispatcher } = buildHarness();

  const result = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:get-session',
    payload: { sessionId: 'session_does_not_exist' },
  });

  assert(result && result.success === false, 'unknown session returns success=false');
  assert(result && result.errorCode === 'session_not_found', 'unknown session returns errorCode=session_not_found (not generic action_rejected)');
  assert(result && typeof result.error === 'string' && result.error.includes('not found'), 'error message describes the actual failure');
  assert(result && typeof result.recoveryHint === 'string' && result.recoveryHint.includes('list_sessions') && result.recoveryHint.includes('get_task_status'), 'recovery hint suggests list_sessions and get_task_status');
}

async function runStopTaskInFlightCase() {
  console.log('\n--- stop_task resolves in-flight session when no sessionId provided ---');

  const sessionId = 'session_active_for_stop';
  const liveSession = { sessionId, status: 'running', task: 'long task', startTime: Date.now(), iterationCount: 1, actionHistory: [], tabId: 9 };

  let stopRequest = null;
  const { dispatcher } = buildHarness({
    activeSessionEntries: [[sessionId, liveSession]],
    stopHandler: (req, _sender, sendResponse) => {
      stopRequest = req;
      sendResponse({ success: true, sessionId: req.sessionId, stopped: true });
    },
  });

  const result = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:stop-automation',
    payload: {}, // MCP stop_task tool ships no sessionId in its schema
  });

  assert(result && result.success === true, 'stop_task on in-flight session returns success');
  assert(stopRequest && stopRequest.sessionId === sessionId, 'dispatcher forwarded the active sessionId to handleStopAutomation');
}

async function runStopTaskNoSessionCase() {
  console.log('\n--- stop_task returns session_not_found when no in-flight session ---');

  const { dispatcher } = buildHarness();

  const result = await dispatcher.dispatchMcpMessageRoute({
    type: 'mcp:stop-automation',
    payload: {},
  });

  assert(result && result.success === false, 'stop_task with no active session returns success=false');
  assert(result && result.errorCode === 'session_not_found', 'stop_task surfaces session_not_found error code');
  assert(result && typeof result.recoveryHint === 'string' && result.recoveryHint.includes('get_task_status'), 'stop_task recovery hint suggests get_task_status');
}

async function run() {
  await runGetSessionDetailFallbackCase();
  await runGetSessionDetailMissingCase();
  await runStopTaskInFlightCase();
  await runStopTaskNoSessionCase();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
