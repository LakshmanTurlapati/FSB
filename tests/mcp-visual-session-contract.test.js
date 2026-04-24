'use strict';

const path = require('path');
const util = require('util');

const visualSessionUtils = require('../utils/mcp-visual-session.js');
const overlayStateUtils = require('../utils/overlay-state.js');
const dispatcher = require('../ws/mcp-tool-dispatcher.js');
const { MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS } = visualSessionUtils;

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
  assertEqual(MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS, 3200, 'final clear delay stays aligned with overlay freeze');

  const lifecycleManager = new McpVisualSessionManager();
  const started = lifecycleManager.startSession({
    clientLabel: 'codex',
    tabId: 55,
    task: 'Complete checkout',
    detail: 'Preparing overlay',
  });

  assert(started && started.session && typeof started.session.sessionToken === 'string', 'startSession returns a session token');
  assertEqual(started.session.clientLabel, 'Codex', 'startSession stores the canonical client label');
  assertEqual(lifecycleManager.getTokenForTab(55), started.session.sessionToken, 'tab owner maps to the issued token');

  const runningState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionStatus(started.session, { statusText: 'Preparing overlay' }),
    null,
  );
  assertEqual(runningState.sessionToken, started.session.sessionToken, 'overlay state preserves sessionToken');
  assertEqual(runningState.version, 1, 'overlay state preserves version');
  assertEqual(runningState.clientLabel, 'Codex', 'overlay state preserves clientLabel');

  const progressed = lifecycleManager.updateSession(started.session.sessionToken, {
    detail: 'Clicking checkout',
  });
  assert(progressed && progressed.version === 2, 'progress update increments version on the same session');
  assertEqual(lifecycleManager.getTokenForTab(55), started.session.sessionToken, 'progress update does not create a duplicate same-tab session');

  const progressedState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionStatus(progressed, {
      phase: 'acting',
      lifecycle: 'running',
      statusText: 'Clicking checkout',
    }),
    null,
  );
  assertEqual(progressedState.lifecycle, 'running', 'progress update keeps lifecycle running');
  assertEqual(progressedState.version, 2, 'progress update preserves incremented version');
  assertEqual(progressedState.sessionToken, started.session.sessionToken, 'progress update stays on the same token');

  const finalized = lifecycleManager.updateSession(started.session.sessionToken, {
    detail: 'Task completed',
  });
  const finalSuccessState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionStatus(finalized, {
      phase: 'complete',
      lifecycle: 'final',
      result: 'success',
      taskSummary: 'Order submitted',
      statusText: 'Task completed',
      animatedHighlights: false,
    }),
    null,
  );
  assertEqual(finalSuccessState.lifecycle, 'final', 'final success state preserves final lifecycle');
  assertEqual(finalSuccessState.result, 'success', 'final success state preserves success result');
  assertEqual(finalSuccessState.progress.label, 'Done', 'final success state shows done label');

  const clearedAfterFinal = lifecycleManager.endSession(started.session.sessionToken, { reason: 'complete' });
  const clearedAfterFinalState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionClearStatus(clearedAfterFinal, { reason: 'complete' }),
    null,
  );
  assertEqual(clearedAfterFinalState.lifecycle, 'cleared', 'final success lifecycle ends with a clear state');

  const manager = new McpVisualSessionManager();
  const original = manager.startSession({
    clientLabel: 'codex',
    tabId: 55,
    task: 'Complete checkout',
    detail: 'Preparing overlay',
  });

  const replacement = manager.startSession({
    clientLabel: 'ChatGPT',
    tabId: 55,
    task: 'Retry checkout',
  });
  assert(replacement.replacedSession && replacement.replacedSession.sessionToken === original.session.sessionToken, 'starting a new same-tab session replaces the old token');
  assertEqual(manager.getSession(original.session.sessionToken), null, 'replaced token is removed from the manager');
  assertEqual(manager.getTokenForTab(55), replacement.session.sessionToken, 'tab owner switches to the latest token');

  const ended = manager.endSession(replacement.session.sessionToken, { reason: 'ended' });
  assert(ended && ended.version === 2, 'endSession increments version for the clear payload');

  const clearState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionClearStatus(ended, { reason: 'ended' }),
    null,
  );
  assertEqual(clearState.lifecycle, 'cleared', 'clear payload normalizes to cleared lifecycle');
  assertEqual(clearState.sessionToken, replacement.session.sessionToken, 'clear payload keeps the matching session token');
  assertEqual(manager.endSession(original.session.sessionToken, { reason: 'ended' }), null, 'stale token end is ignored');
}

async function runDispatcherValidationCases() {
  console.log('\n--- dispatcher validation and routing ---');

  const originalStartHandler = global.handleStartMcpVisualSession;
  const originalEndHandler = global.handleEndMcpVisualSession;
  const originalTaskStatusHandler = global.handleMcpVisualSessionTaskStatus;
  const originalActiveSessions = global.activeSessions;

  let startHandlerCalled = false;
  let endHandlerCalled = false;
  let taskStatusHandlerCalled = false;
  let capturedStart = null;
  let capturedEnd = null;
  let capturedTaskStatus = [];

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

  global.handleMcpVisualSessionTaskStatus = (request, sender, sendResponse) => {
    taskStatusHandlerCalled = true;
    capturedTaskStatus.push({ request, sender });

    if (request.sessionToken === 'stale_token') {
      sendResponse({
        success: false,
        errorCode: 'visual_session_not_found',
        error: 'No active client-owned visual session found for token',
        sessionToken: request.sessionToken,
      });
      return true;
    }

    if (request.tool === 'report_progress') {
      sendResponse({
        success: true,
        tool: 'report_progress',
        hadEffect: true,
        message: request.message,
        sessionToken: request.sessionToken,
        version: 2,
      });
      return true;
    }

    if (request.tool === 'complete_task') {
      sendResponse({
        success: true,
        tool: 'complete_task',
        status: 'completed',
        hadEffect: true,
        summary: request.summary,
        sessionToken: request.sessionToken,
        version: 3,
        clearsAfterMs: MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS,
      });
      return true;
    }

    if (request.tool === 'partial_task') {
      sendResponse({
        success: true,
        tool: 'partial_task',
        status: 'partial',
        hadEffect: true,
        summary: request.summary,
        blocker: request.blocker,
        nextStep: request.nextStep,
        reason: request.reason,
        sessionToken: request.sessionToken,
        version: 3,
        clearsAfterMs: MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS,
      });
      return true;
    }

    if (request.tool === 'fail_task') {
      sendResponse({
        success: false,
        tool: 'fail_task',
        status: 'failed',
        hadEffect: true,
        error: request.reason,
        reason: request.reason,
        sessionToken: request.sessionToken,
        version: 3,
        clearsAfterMs: MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS,
      });
      return true;
    }

    sendResponse({ success: false, error: 'Unexpected task status tool' });
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

    taskStatusHandlerCalled = false;
    capturedTaskStatus = [];
    const narrationOnly = await dispatcher.dispatchMcpToolRoute({
      tool: 'report_progress',
      params: { message: 'Planning the next step' },
    });
    assertEqual(narrationOnly.hadEffect, false, 'report_progress without session token stays narration-only');
    assertEqual(taskStatusHandlerCalled, false, 'narration-only progress does not reach the visual-session background callback');

    taskStatusHandlerCalled = false;
    capturedTaskStatus = [];
    const progressed = await dispatcher.dispatchMcpToolRoute({
      tool: 'report_progress',
      params: { message: 'Clicking checkout', session_token: 'visual_token_123' },
    });
    assertEqual(progressed.success, true, 'report_progress with token succeeds');
    assertEqual(progressed.hadEffect, true, 'report_progress with token reports an overlay effect');
    assert(taskStatusHandlerCalled, 'token-aware progress reaches the visual-session background callback');
    assertEqual(capturedTaskStatus[0].request.tool, 'report_progress', 'progress callback receives report_progress tool name');
    assertEqual(capturedTaskStatus[0].request.sessionToken, 'visual_token_123', 'progress callback receives the matching token');

    taskStatusHandlerCalled = false;
    capturedTaskStatus = [];
    const staleProgress = await dispatcher.dispatchMcpToolRoute({
      tool: 'report_progress',
      params: { message: 'Still working', session_token: 'stale_token' },
    });
    assertEqual(staleProgress.errorCode, 'visual_session_not_found', 'stale token progress is rejected safely');
    assert(taskStatusHandlerCalled, 'stale token progress still reaches the visual-session callback for ownership validation');

    taskStatusHandlerCalled = false;
    capturedTaskStatus = [];
    const completed = await dispatcher.dispatchMcpToolRoute({
      tool: 'complete_task',
      params: { summary: 'Order submitted', session_token: 'visual_token_123' },
    });
    assertEqual(completed.success, true, 'complete_task with token succeeds');
    assertEqual(completed.hadEffect, true, 'complete_task with token finalizes the visual session');
    assertEqual(completed.clearsAfterMs, MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS, 'complete_task preserves deterministic clear delay');

    taskStatusHandlerCalled = false;
    capturedTaskStatus = [];
    const partial = await dispatcher.dispatchMcpToolRoute({
      tool: 'partial_task',
      params: {
        summary: 'Saved draft',
        blocker: 'Login required',
        next_step: 'Sign in and send the message',
        reason: 'auth_required',
        session_token: 'visual_token_123',
      },
    });
    assertEqual(partial.success, true, 'partial_task with token succeeds');
    assertEqual(partial.hadEffect, true, 'partial_task with token finalizes the visual session');
    assertEqual(partial.summary, 'Saved draft', 'partial_task keeps summary in final response');
    assertEqual(partial.blocker, 'Login required', 'partial_task keeps blocker in final response');
    assertEqual(partial.nextStep, 'Sign in and send the message', 'partial_task keeps nextStep in final response');
    assertEqual(partial.reason, 'auth_required', 'partial_task keeps reason in final response');

    taskStatusHandlerCalled = false;
    capturedTaskStatus = [];
    const failed = await dispatcher.dispatchMcpToolRoute({
      tool: 'fail_task',
      params: { reason: 'Checkout button never appeared', session_token: 'visual_token_123' },
    });
    assertEqual(failed.success, false, 'fail_task with token preserves failure semantics');
    assertEqual(failed.hadEffect, true, 'fail_task with token still finalizes the visual session');
    assertEqual(failed.reason, 'Checkout button never appeared', 'fail_task preserves the failure reason');
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

    if (originalTaskStatusHandler === undefined) {
      delete global.handleMcpVisualSessionTaskStatus;
    } else {
      global.handleMcpVisualSessionTaskStatus = originalTaskStatusHandler;
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
