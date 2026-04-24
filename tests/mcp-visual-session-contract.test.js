'use strict';

const path = require('path');
const util = require('util');

const visualSessionUtils = require('../utils/mcp-visual-session.js');
const overlayStateUtils = require('../utils/overlay-state.js');
const dispatcher = require('../ws/mcp-tool-dispatcher.js');

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

function assertDeepEqual(actual, expected, msg) {
  assert(util.isDeepStrictEqual(actual, expected), `${msg} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function toPlainObject(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function runAllowlistAndManagerCase() {
  console.log('\n--- allowlist normalization and manager lifecycle ---');

  const {
    McpVisualSessionManager,
    normalizeMcpVisualClientLabel,
    getAllowedMcpVisualClientLabels,
    buildMcpVisualSessionStatus,
    buildMcpVisualSessionClearStatus,
  } = visualSessionUtils;

  assertEqual(normalizeMcpVisualClientLabel(' codex '), 'Codex', 'normalizes case/whitespace to Codex');
  assertEqual(normalizeMcpVisualClientLabel('chat gpt'), 'ChatGPT', 'normalizes benign spacing to ChatGPT');
  assertEqual(normalizeMcpVisualClientLabel('unknown-client'), null, 'rejects unknown client labels');
  assert(getAllowedMcpVisualClientLabels().includes('Gemini'), 'allowlist includes Gemini');

  const manager = new McpVisualSessionManager();
  const started = manager.startSession({
    clientLabel: 'codex',
    tabId: 55,
    task: 'Complete checkout',
    detail: 'Preparing overlay',
  });

  assert(started && started.session && typeof started.session.sessionToken === 'string', 'startSession returns a session token');
  assertEqual(started.session.clientLabel, 'Codex', 'startSession stores the canonical client label');
  assertEqual(manager.getTokenForTab(55), started.session.sessionToken, 'tab owner maps to the issued token');

  const runningState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionStatus(started.session, { statusText: 'Preparing overlay' }),
    null,
  );
  assertEqual(runningState.sessionToken, started.session.sessionToken, 'overlay state preserves sessionToken');
  assertEqual(runningState.version, 1, 'overlay state preserves version');
  assertEqual(runningState.clientLabel, 'Codex', 'overlay state preserves clientLabel');

  const replacement = manager.startSession({
    clientLabel: 'ChatGPT',
    tabId: 55,
    task: 'Retry checkout',
  });
  assert(replacement.replacedSession && replacement.replacedSession.sessionToken === started.session.sessionToken, 'starting a new same-tab session replaces the old token');
  assertEqual(manager.getSession(started.session.sessionToken), null, 'replaced token is removed from the manager');
  assertEqual(manager.getTokenForTab(55), replacement.session.sessionToken, 'tab owner switches to the latest token');

  const ended = manager.endSession(replacement.session.sessionToken, { reason: 'ended' });
  assert(ended && ended.version === 2, 'endSession increments version for the clear payload');

  const clearState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionClearStatus(ended, { reason: 'ended' }),
    null,
  );
  assertEqual(clearState.lifecycle, 'cleared', 'clear payload normalizes to cleared lifecycle');
  assertEqual(clearState.sessionToken, replacement.session.sessionToken, 'clear payload keeps the matching session token');
  assertEqual(manager.endSession(started.session.sessionToken, { reason: 'ended' }), null, 'stale token end is ignored');
}

async function runDispatcherValidationCases() {
  console.log('\n--- dispatcher validation and routing ---');

  const originalStartHandler = global.handleStartMcpVisualSession;
  const originalEndHandler = global.handleEndMcpVisualSession;
  const originalActiveSessions = global.activeSessions;

  let startHandlerCalled = false;
  let endHandlerCalled = false;
  let capturedStart = null;
  let capturedEnd = null;

  global.handleStartMcpVisualSession = (request, sender, sendResponse) => {
    startHandlerCalled = true;
    capturedStart = { request, sender };
    sendResponse({
      success: true,
      sessionToken: 'visual_token_123',
      clientLabel: request.clientLabel,
      tabId: request.tabId,
    });
    return true;
  };

  global.handleEndMcpVisualSession = (request, sender, sendResponse) => {
    endHandlerCalled = true;
    capturedEnd = { request, sender };
    sendResponse({
      success: true,
      sessionToken: request.sessionToken,
      cleared: true,
    });
    return true;
  };

  try {
    startHandlerCalled = false;
    const invalidLabel = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: { client: 'NotARealClient', task: 'Drive checkout' },
      client: { _getActiveTab: async () => ({ id: 44, url: 'https://example.com' }) },
    });
    assertEqual(invalidLabel.errorCode, 'invalid_client_label', 'invalid client label is rejected before background callback');
    assertEqual(startHandlerCalled, false, 'invalid client label does not reach the background callback');

    startHandlerCalled = false;
    const restricted = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: { client: 'Codex', task: 'Drive checkout' },
      client: { _getActiveTab: async () => ({ id: 45, url: 'chrome://settings/' }) },
    });
    assertEqual(restricted.errorCode, 'restricted_active_tab', 'restricted tabs are rejected');
    assertDeepEqual(
      restricted.validRecoveryTools,
      ['navigate', 'open_tab', 'switch_tab', 'list_tabs'],
      'restricted visual sessions preserve the navigation-only recovery tools',
    );
    assertEqual(startHandlerCalled, false, 'restricted tab rejection does not reach the background callback');

    global.activeSessions = new Map([
      ['run-1', { tabId: 46, status: 'running' }],
    ]);
    startHandlerCalled = false;
    const busy = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: { client: 'Codex', task: 'Drive checkout' },
      client: { _getActiveTab: async () => ({ id: 46, url: 'https://example.com/cart' }) },
    });
    assertEqual(busy.errorCode, 'visual_surface_busy', 'same-tab autopilot ownership blocks a client-owned visual session');
    assertEqual(startHandlerCalled, false, 'busy surface rejection does not reach the background callback');

    global.activeSessions = new Map();
    startHandlerCalled = false;
    capturedStart = null;
    const started = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:start-visual-session',
      payload: { client: ' codex ', task: 'Drive checkout', detail: 'Preparing checkout' },
      client: { _getActiveTab: async () => ({ id: 47, url: 'https://example.com/cart' }) },
    });
    assertEqual(started.success, true, 'start visual-session route succeeds on a normal page');
    assert(startHandlerCalled, 'start visual-session route reaches the background callback');
    assertEqual(capturedStart.request.clientLabel, 'Codex', 'start visual-session route canonicalizes the client label before dispatch');
    assertEqual(capturedStart.request.tabId, 47, 'start visual-session route dispatches the active tab id');
    assertEqual(started.sessionToken, 'visual_token_123', 'start visual-session route returns the issued session token');

    endHandlerCalled = false;
    capturedEnd = null;
    const ended = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:end-visual-session',
      payload: { sessionToken: 'visual_token_123', reason: 'ended' },
      client: {},
    });
    assertEqual(ended.success, true, 'end visual-session route succeeds');
    assert(endHandlerCalled, 'end visual-session route reaches the background callback');
    assertEqual(capturedEnd.request.sessionToken, 'visual_token_123', 'end visual-session route forwards the session token');
  } finally {
    if (originalStartHandler === undefined) {
      delete global.handleStartMcpVisualSession;
    } else {
      global.handleStartMcpVisualSession = originalStartHandler;
    }

    if (originalEndHandler === undefined) {
      delete global.handleEndMcpVisualSession;
    } else {
      global.handleEndMcpVisualSession = originalEndHandler;
    }

    if (originalActiveSessions === undefined) {
      delete global.activeSessions;
    } else {
      global.activeSessions = originalActiveSessions;
    }
  }
}

async function run() {
  await runAllowlistAndManagerCase();
  await runDispatcherValidationCases();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
