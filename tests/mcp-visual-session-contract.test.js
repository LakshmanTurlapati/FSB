'use strict';

const path = require('path');
const util = require('util');

const visualSessionUtils = require('../extension/utils/mcp-visual-session.js');
const overlayStateUtils = require('../extension/utils/overlay-state.js');
const dispatcher = require('../extension/ws/mcp-tool-dispatcher.js');
const {
  MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS,
  MCP_VISUAL_SESSION_DEGRADE_AFTER_MS,
  MCP_VISUAL_SESSION_ORPHAN_CLEAR_AFTER_MS,
} = visualSessionUtils;

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
  assertEqual(
    manager.endSession(replacement.session.sessionToken, { reason: 'ended' }),
    null,
    'repeating endSession on an already-cleared token is a safe no-op',
  );

  const clearState = overlayStateUtils.buildOverlayState(
    buildMcpVisualSessionClearStatus(ended, { reason: 'ended' }),
    null,
  );
  assertEqual(clearState.lifecycle, 'cleared', 'clear payload normalizes to cleared lifecycle');
  assertEqual(clearState.sessionToken, replacement.session.sessionToken, 'clear payload keeps the matching session token');
  assertEqual(manager.endSession(original.session.sessionToken, { reason: 'ended' }), null, 'stale token end is ignored');
}

async function runPersistenceReplayCase() {
  console.log('\n--- persisted visual session replay planning ---');

  const {
    McpVisualSessionManager,
    serializeMcpVisualSessionRecord,
    restoreMcpVisualSessionRecord,
    planMcpVisualSessionReplay,
  } = visualSessionUtils;

  const now = 1_700_000_000_000;
  const manager = new McpVisualSessionManager();
  const started = manager.startSession({
    clientLabel: 'Codex',
    tabId: 77,
    task: 'Submit order',
    detail: 'Opening cart',
    now: now - 10_000,
  });

  const runningSession = manager.updateSession(started.session.sessionToken, {
    detail: 'Clicking checkout',
    lastUpdateAt: now - 10_000,
    phase: 'acting',
    lifecycle: 'running',
    statusText: 'Clicking checkout',
  });
  const runningRecord = serializeMcpVisualSessionRecord(runningSession);

  assertEqual(runningRecord.lastUpdateAt, now - 10_000, 'serialized record preserves lastUpdateAt');
  assertEqual(runningRecord.statusText, 'Clicking checkout', 'serialized record preserves statusText');
  assertEqual(runningRecord.phase, 'acting', 'serialized record preserves phase');

  const restoredRunning = restoreMcpVisualSessionRecord(runningRecord);
  assertDeepEqual(restoredRunning, runningRecord, 'restore helper preserves serialized running record');

  const runningReplay = planMcpVisualSessionReplay(runningRecord, { now });
  assertEqual(runningReplay.action, 'replay', 'fresh running record is replayed');
  assertEqual(runningReplay.mode, 'running', 'fresh running record replays in running mode');
  assertEqual(runningReplay.status.sessionToken, runningRecord.sessionToken, 'running replay keeps the same token');
  assertEqual(runningReplay.status.clientLabel, 'Codex', 'running replay keeps the trusted client label');
  assertEqual(runningReplay.status.statusText, 'Clicking checkout', 'running replay keeps the latest status text');

  const degradedReplay = planMcpVisualSessionReplay({
    ...runningRecord,
    lastUpdateAt: now - (MCP_VISUAL_SESSION_DEGRADE_AFTER_MS + 1000),
  }, { now });
  assertEqual(degradedReplay.action, 'replay', 'stale-but-not-orphaned session still replays');
  assertEqual(degradedReplay.mode, 'degraded', 'stale session replays in degraded mode');
  assertEqual(degradedReplay.status.phase, 'waiting', 'degraded replay switches to waiting phase');
  assertEqual(degradedReplay.status.progress.label, 'Waiting', 'degraded replay shows waiting progress label');
  assertEqual(degradedReplay.status.clientLabel, 'Codex', 'degraded replay preserves trusted client badge');

  const orphanReplay = planMcpVisualSessionReplay({
    ...runningRecord,
    lastUpdateAt: now - (MCP_VISUAL_SESSION_ORPHAN_CLEAR_AFTER_MS + 1000),
  }, { now });
  assertEqual(orphanReplay.action, 'clear', 'orphaned running session is cleared');
  assertEqual(orphanReplay.reason, 'timeout', 'orphaned running session clears with timeout reason');

  const finalSession = manager.updateSession(started.session.sessionToken, {
    detail: 'Task completed',
    lastUpdateAt: now - 1000,
    phase: 'complete',
    lifecycle: 'final',
    result: 'success',
    statusText: 'Task completed',
    taskSummary: 'Order submitted',
    display: {
      title: 'Order submitted',
      subtitle: 'Completed',
      detail: 'Task completed',
    },
    animatedHighlights: false,
    finalClearAt: now + 2200,
    finalClearReason: 'complete',
  });
  const finalRecord = serializeMcpVisualSessionRecord(finalSession);
  const finalReplay = planMcpVisualSessionReplay(finalRecord, { now });

  assertEqual(finalReplay.action, 'replay', 'final record with remaining freeze time replays');
  assertEqual(finalReplay.mode, 'final', 'final record replays in final mode');
  assertEqual(finalReplay.status.lifecycle, 'final', 'final replay preserves final lifecycle');
  assertEqual(finalReplay.status.result, 'success', 'final replay preserves final result');
  assertEqual(finalReplay.clearAfterMs, 2200, 'final replay preserves remaining freeze time');

  const expiredFinalReplay = planMcpVisualSessionReplay({
    ...finalRecord,
    finalClearAt: now - 1,
  }, { now });
  assertEqual(expiredFinalReplay.action, 'clear', 'expired final record clears immediately');
  assertEqual(expiredFinalReplay.reason, 'complete', 'expired final record clears with stored final reason');

  const restoreManager = new McpVisualSessionManager();
  const restoredOriginal = restoreManager.restoreSession(runningRecord);
  assert(restoredOriginal?.session, 'restoreSession accepts a persisted running record');

  const replacementRecord = {
    ...runningRecord,
    sessionToken: 'replacement_token_456',
    clientLabel: 'ChatGPT',
    task: 'Retry order',
    detail: 'Retrying checkout',
    statusText: 'Retrying checkout',
    version: runningRecord.version + 3,
    lastUpdateAt: now,
  };
  const restoredReplacement = restoreManager.restoreSession(replacementRecord);
  assert(
    restoredReplacement.replacedSession && restoredReplacement.replacedSession.sessionToken === runningRecord.sessionToken,
    'restoreSession replaces stale persisted token when a newer same-tab record exists',
  );
  assertEqual(restoreManager.getSession(runningRecord.sessionToken), null, 'stale restored token is removed after same-tab replacement');
  assertEqual(restoreManager.getTokenForTab(77), 'replacement_token_456', 'same-tab restore keeps the newest token as owner');
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
  const clearedTokens = new Set();

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

    if (clearedTokens.has(request.sessionToken)) {
      sendResponse({
        success: false,
        errorCode: 'visual_session_not_found',
        error: 'No active client-owned visual session found for token',
        sessionToken: request.sessionToken,
      });
      return true;
    }

    clearedTokens.add(request.sessionToken);
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

    endHandlerCalled = false;
    const endedTwice = await dispatcher.dispatchMcpMessageRoute({
      type: 'mcp:end-visual-session',
      payload: { sessionToken: 'visual_token_123', reason: 'ended' },
      client: {},
    });
    assertEqual(endedTwice.errorCode, 'visual_session_not_found', 'repeating end visual-session returns a safe structured stale-token error');
    assert(endHandlerCalled, 'repeat end visual-session still routes through the background callback for idempotent cleanup handling');

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

async function runPhase240OwnershipAwareStartSessionCases() {
  console.log('\n--- Phase 240 ownership-aware startSession ---');

  const { McpVisualSessionManager } = visualSessionUtils;
  const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

  function makeStorage() {
    const store = {};
    return {
      async get(keys) {
        if (keys == null) return Object.assign({}, store);
        if (Array.isArray(keys)) {
          const out = {};
          keys.forEach((k) => {
            if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = store[k];
          });
          return out;
        }
        if (typeof keys === 'string') {
          return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
        }
        return Object.assign({}, store);
      },
      async set(values) { Object.assign(store, values); },
      async remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((k) => { delete store[k]; });
      }
    };
  }
  function makeTabs() {
    const tabs = [
      { id: 700, incognito: false, windowId: 1 },
      { id: 800, incognito: false, windowId: 1 }
    ];
    return {
      async query() { return tabs.slice(); },
      async get(tabId) {
        const found = tabs.find((t) => t.id === tabId);
        if (!found) throw new Error('No tab with id: ' + tabId);
        return found;
      }
    };
  }

  const priorChrome = globalThis.chrome;
  const priorRegistry = globalThis.fsbAgentRegistryInstance;
  globalThis.chrome = {
    runtime: { id: 'phase-240-vs-test', lastError: null },
    storage: { session: makeStorage() },
    tabs: makeTabs()
  };
  delete require.cache[REGISTRY_MODULE_PATH];
  const regMod = require(REGISTRY_MODULE_PATH);
  const registry = new regMod.AgentRegistry();
  globalThis.fsbAgentRegistryInstance = registry;

  try {
    // ----- Same-agent resume -----
    const a = await registry.registerAgent();
    await registry.bindTab(a.agentId, 700);
    const m1 = new McpVisualSessionManager();
    const first = m1.startSession({
      clientLabel: 'codex', tabId: 700, agentId: a.agentId, task: 'phase 240 task', now: 100
    });
    assert(first.session && first.session.version === 1,
      'Phase 240: first startSession returns version 1 for owned tab');
    const initialToken = first.session.sessionToken;

    const resumed = m1.startSession({
      clientLabel: 'codex', tabId: 700, agentId: a.agentId, task: 'phase 240 task v2', now: 200
    });
    assert(resumed.resumed === true,
      'Phase 240: same-agent re-entry returns resumed: true');
    assertEqual(resumed.session.sessionToken, initialToken,
      'Phase 240: same-agent resume preserves sessionToken');
    assertEqual(resumed.session.version, 2,
      'Phase 240: same-agent resume bumps version monotonically');

    // ----- Cross-agent reject -----
    const b = await registry.registerAgent();
    const rejected = m1.startSession({
      clientLabel: 'claude', tabId: 700, agentId: b.agentId, task: 'invasion', now: 300
    });
    assertEqual(rejected.errorCode, 'tab_owned_by_other_agent',
      'Phase 240: cross-agent re-entry returns errorCode tab_owned_by_other_agent');
    assertEqual(rejected.ownerAgentId, a.agentId,
      'Phase 240: reject payload echoes the owner agentId');

    // ----- Unowned-tab displacement preserved (regression guard) -----
    const m2 = new McpVisualSessionManager();
    const ufirst = m2.startSession({
      clientLabel: 'codex', tabId: 800, task: 'unowned a', now: 100
    });
    assert(ufirst.session && !ufirst.errorCode,
      'Phase 240 regression: unowned tab first startSession succeeds');
    const usecond = m2.startSession({
      clientLabel: 'codex', tabId: 800, task: 'unowned b', now: 200
    });
    assert(usecond.session && usecond.replacedSession,
      'Phase 240 regression: unowned tab second startSession displaces (legacy v0.9.36 contract)');
    assertEqual(
      usecond.replacedSession.sessionToken,
      ufirst.session.sessionToken,
      'Phase 240 regression: unowned tab replacedSession matches old token'
    );
  } finally {
    if (priorChrome === undefined) delete globalThis.chrome; else globalThis.chrome = priorChrome;
    if (priorRegistry === undefined) delete globalThis.fsbAgentRegistryInstance;
    else globalThis.fsbAgentRegistryInstance = priorRegistry;
  }
}

async function run() {
  await runAllowlistAndManagerCase();
  await runPersistenceReplayCase();
  await runDispatcherValidationCases();
  await runPhase240OwnershipAwareStartSessionCases();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
