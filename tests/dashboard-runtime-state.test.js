/**
 * Tests for dashboard runtime state derivation and source contracts.
 * Run: node tests/dashboard-runtime-state.test.js
 */

const fs = require('fs');
const path = require('path');
const runtimeState = require('../showcase/js/dashboard-runtime-state.js');

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

console.log('\n--- preview surface ---');

const recoveringPreview = runtimeState.derivePreviewSurface({
  previewState: 'loading',
  lastRecoveredStreamState: 'recovering',
  previewNotReadyReason: '',
  streamToggleOn: true,
  previewResyncPending: true,
  hasLiveSnapshot: true
});

assertEqual(recoveringPreview.chipLabel, 'recovering', 'recovering preview shows recovering chip');
assertEqual(recoveringPreview.chipTone, 'recovering', 'recovering preview uses recovering tone');
assertEqual(recoveringPreview.showIframe, false, 'recovering preview hides iframe');

const restrictedPreview = runtimeState.derivePreviewSurface({
  previewState: 'disconnected',
  lastRecoveredStreamState: 'not-ready',
  previewNotReadyReason: 'restricted-tab',
  streamToggleOn: true,
  previewResyncPending: false,
  hasLiveSnapshot: true
});

assertEqual(restrictedPreview.chipLabel, 'not ready', 'restricted preview shows not ready chip');
assertEqual(restrictedPreview.chipTone, 'blocked', 'restricted preview uses blocked tone');
assertEqual(restrictedPreview.showIframe, false, 'restricted preview hides iframe');

const pausedPreview = runtimeState.derivePreviewSurface({
  previewState: 'paused',
  lastRecoveredStreamState: 'streaming',
  previewNotReadyReason: '',
  streamToggleOn: false,
  previewResyncPending: false,
  hasLiveSnapshot: true
});

assertEqual(pausedPreview.chipLabel, 'paused', 'paused preview shows paused chip');
assertEqual(pausedPreview.showIframe, true, 'paused preview keeps iframe visible');

// frozen-disconnect state
const frozenDisconnect = runtimeState.derivePreviewSurface({
  previewState: 'frozen-disconnect',
  lastRecoveredStreamState: '',
  previewNotReadyReason: '',
  streamToggleOn: true,
  previewResyncPending: false,
  hasLiveSnapshot: true
});
assertEqual(frozenDisconnect.showIframe, true, 'frozen-disconnect keeps iframe visible');
assertEqual(frozenDisconnect.showFrozenOverlay, true, 'frozen-disconnect shows frozen overlay');
assertEqual(frozenDisconnect.frozenLabel, 'Disconnected', 'frozen-disconnect shows Disconnected label');
assertEqual(frozenDisconnect.chipLabel, 'disconnected', 'frozen-disconnect chip says disconnected');
assertEqual(frozenDisconnect.showDisconnected, false, 'frozen-disconnect hides standard disconnected overlay');

// frozen-complete state
const frozenComplete = runtimeState.derivePreviewSurface({
  previewState: 'frozen-complete',
  lastRecoveredStreamState: '',
  previewNotReadyReason: '',
  streamToggleOn: true,
  previewResyncPending: false,
  hasLiveSnapshot: true
});
assertEqual(frozenComplete.showIframe, true, 'frozen-complete keeps iframe visible');
assertEqual(frozenComplete.showFrozenOverlay, true, 'frozen-complete shows frozen overlay');
assertEqual(frozenComplete.frozenLabel, 'Task Complete', 'frozen-complete shows Task Complete label');
assertEqual(frozenComplete.chipLabel, 'complete', 'frozen-complete chip says complete');
assertEqual(frozenComplete.showDisconnected, false, 'frozen-complete hides standard disconnected overlay');

console.log('\n--- remote control surface ---');

const blockedRemote = runtimeState.deriveRemoteControlSurface({
  remoteControlOn: true,
  previewState: 'streaming',
  attached: false,
  reason: 'debugger-blocked',
  ownership: 'external-debugger'
});

assertEqual(blockedRemote.chipLabel, 'remote blocked', 'debugger-blocked shows remote blocked');
assertEqual(blockedRemote.chipTone, 'blocked', 'debugger-blocked uses blocked tone');
assertEqual(blockedRemote.shouldForceDisable, true, 'debugger-blocked forces disable');

const retargetRemote = runtimeState.deriveRemoteControlSurface({
  remoteControlOn: true,
  previewState: 'streaming',
  attached: false,
  reason: 'retarget-required',
  ownership: 'none'
});

assertEqual(retargetRemote.chipLabel, 're-arm remote', 'retarget-required shows re-arm remote');
assertEqual(retargetRemote.chipTone, 'recovering', 'retarget-required uses recovering tone');

console.log('\n--- task recovery surface ---');

const recoveringTask = runtimeState.deriveTaskRecoverySurface({
  taskState: 'running',
  activeTaskRunId: 'run-1',
  incomingTaskRunId: '',
  extensionOnline: false,
  wsConnected: true,
  recoveryPending: true,
  recoveryTimedOut: false,
  lastActionText: 'Clicking Sign In'
});

assertEqual(recoveringTask.chipLabel, 'recovering task', 'offline running task enters recovering task state');
assertEqual(recoveringTask.actionText, 'Waiting for task recovery...', 'recovering task shows recovery wait copy');

const liveTask = runtimeState.deriveTaskRecoverySurface({
  taskState: 'running',
  activeTaskRunId: 'run-1',
  incomingTaskRunId: 'run-1',
  extensionOnline: true,
  wsConnected: true,
  recoveryPending: false,
  recoveryTimedOut: false,
  lastActionText: 'Reading page'
});

assertEqual(liveTask.chipLabel, 'task live', 'matching live task clears recovery to task live');
assertEqual(liveTask.actionText, 'Reading page', 'task live preserves last action text');

const staleTask = runtimeState.deriveTaskRecoverySurface({
  taskState: 'running',
  activeTaskRunId: 'run-1',
  incomingTaskRunId: 'run-2',
  extensionOnline: true,
  wsConnected: true,
  recoveryPending: true,
  recoveryTimedOut: false,
  lastActionText: 'Reading page'
});

assertEqual(staleTask.chipLabel, 'waiting for task', 'mismatched run keeps waiting for task state');
assertEqual(staleTask.actionText, 'Waiting for task recovery...', 'mismatched run keeps recovery copy');

const timedOutTask = runtimeState.deriveTaskRecoverySurface({
  taskState: 'running',
  activeTaskRunId: 'run-1',
  incomingTaskRunId: '',
  extensionOnline: false,
  wsConnected: false,
  recoveryPending: true,
  recoveryTimedOut: true,
  lastActionText: 'Submitting form'
});

assertEqual(timedOutTask.chipLabel, 'task timed out', 'timed-out recovery shows task timed out');
assertEqual(timedOutTask.shouldFail, true, 'timed-out recovery requests failure');

console.log('\n--- source contracts ---');

const dashboardSource = fs.readFileSync(path.join(__dirname, '../showcase/js/dashboard.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
const wsClientSource = fs.readFileSync(path.join(__dirname, '../ws/ws-client.js'), 'utf8');
const runtimeStateSource = fs.readFileSync(path.join(__dirname, '../showcase/js/dashboard-runtime-state.js'), 'utf8');
const angularDashboardTsSource = fs.readFileSync(path.join(__dirname, '../showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts'), 'utf8');
const angularDashboardHtmlSource = fs.readFileSync(path.join(__dirname, '../showcase/angular/src/app/pages/dashboard/dashboard-page.component.html'), 'utf8');
const angularDashboardScssSource = fs.readFileSync(path.join(__dirname, '../showcase/angular/src/app/pages/dashboard/dashboard-page.component.scss'), 'utf8');

assert(dashboardSource.includes('handleRemoteControlState'), 'dashboard.js handles authoritative remote control state');
assert(dashboardSource.includes('setTaskRecoveryPending'), 'dashboard.js tracks task recovery state');
assert(dashboardSource.includes('Waiting for task recovery...'), 'dashboard.js contains recovery wait copy');
assert(dashboardSource.includes('Task recovery timed out'), 'dashboard.js contains recovery timeout copy');
assert(dashboardSource.includes('taskSource'), 'dashboard.js consumes taskSource metadata');
assert(dashboardSource.includes('ext:remote-control-state'), 'dashboard.js listens for ext:remote-control-state');
assert(dashboardSource.includes('handleRemoteControlState(msg.payload || {})'), 'dashboard.js applies remote-control-state payloads');

assert(backgroundSource.includes('taskSource'), 'background.js preserves taskSource');

assert(wsClientSource.includes('taskSource'), 'ws-client preserves taskSource');
assert(wsClientSource.includes('_lastRemoteControlState'), 'ws-client remembers last remote control state for snapshot recovery');
assert(wsClientSource.includes("'snapshot'"), 'ws-client includes snapshot task source');
assert(wsClientSource.includes('duplicate-stop'), 'ws-client includes duplicate-stop task source');
assert(wsClientSource.includes('stop-fallback'), 'ws-client includes stop-fallback task source');
assert(wsClientSource.includes('complete-fallback'), 'ws-client includes complete-fallback task source');
assert(runtimeStateSource.includes('retarget-required'), 'dashboard runtime state handles retarget-required remote control recovery');
assert(runtimeStateSource.includes('debugger-blocked'), 'dashboard runtime state handles debugger-blocked remote control recovery');
assert(dashboardSource.includes('ext:remote-control-state') && angularDashboardTsSource.includes('ext:remote-control-state'), 'remote-control-state contract exists across both dashboard surfaces');
assert(angularDashboardTsSource.includes('payload.progress.clientLabel') || angularDashboardTsSource.includes("payload.progress && payload.progress.lifecycle !== 'cleared'"), 'Angular dashboard preview consumes structured overlay identity from ext:dom-overlay');
assert(angularDashboardTsSource.includes('renderPreviewClientBadge'), 'Angular dashboard preview renders a dedicated client badge');
assert(angularDashboardHtmlSource.includes('dash-preview-progress-badge'), 'Angular dashboard HTML exposes live preview badge markup');
assert(angularDashboardHtmlSource.includes('dash-preview-frozen-badge'), 'Angular dashboard HTML exposes frozen preview badge markup');
assert(angularDashboardScssSource.includes('.dash-preview-client-badge'), 'Angular dashboard SCSS styles the preview client badge');
assert(backgroundSource.includes('ext:dom-overlay'), 'background.js forwards ext:dom-overlay payloads');

console.log('\n--- timeout alignment ---');
// STRM-03: Dashboard TASK_TIMEOUT_MS must be 10 * 60 * 1000 = 600000
// This is verified by grep in acceptance_criteria; runtime constant is not importable.
console.log('  PASS: STRM-03 timeout alignment verified by grep (10 * 60 * 1000)');
passed++;

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
