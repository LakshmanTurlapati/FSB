(function(global) {
  'use strict';

  function getPreviewNotReadyText(reason) {
    switch (reason) {
      case 'restricted-tab':
        return 'Open a normal browser page to resume preview';
      case 'tab-closed':
        return 'The streaming tab was closed. Open another page to resume preview';
      case 'waiting-for-page-ready':
        return 'Waiting for the browser page to finish loading';
      case 'no-streamable-tab':
      default:
        return 'Open a browser tab with a normal web page to start preview';
    }
  }

  function derivePreviewSurface(input) {
    input = input || {};
    var previewState = input.previewState || 'hidden';
    var reason = input.previewNotReadyReason || '';
    var lastRecoveredStreamState = input.lastRecoveredStreamState || '';
    var hasLiveSnapshot = !!input.hasLiveSnapshot;
    var isRecovering = previewState === 'loading' &&
      (lastRecoveredStreamState === 'recovering' || !!input.previewResyncPending);

    if (previewState === 'hidden') {
      return {
        chipLabel: '',
        chipTone: 'paused',
        detailText: '',
        showIframe: false,
        showLoading: false,
        showDisconnected: false
      };
    }

    if (previewState === 'streaming') {
      return {
        chipLabel: 'streaming',
        chipTone: 'streaming',
        detailText: 'Live browser preview',
        showIframe: true,
        showLoading: false,
        showDisconnected: false
      };
    }

    if (previewState === 'paused') {
      return {
        chipLabel: 'paused',
        chipTone: 'paused',
        detailText: 'Preview paused',
        showIframe: hasLiveSnapshot,
        showLoading: false,
        showDisconnected: false
      };
    }

    if (reason) {
      return {
        chipLabel: 'not ready',
        chipTone: 'blocked',
        detailText: getPreviewNotReadyText(reason),
        showIframe: false,
        showLoading: false,
        showDisconnected: true
      };
    }

    if (isRecovering || lastRecoveredStreamState === 'recovering') {
      return {
        chipLabel: 'recovering',
        chipTone: 'recovering',
        detailText: 'Recovering browser preview...',
        showIframe: false,
        showLoading: true,
        showDisconnected: false
      };
    }

    if (previewState === 'loading') {
      return {
        chipLabel: 'loading',
        chipTone: 'loading',
        detailText: 'Waiting for live page preview...',
        showIframe: false,
        showLoading: true,
        showDisconnected: false
      };
    }

    if (previewState === 'disconnected') {
      return {
        chipLabel: 'disconnected',
        chipTone: 'blocked',
        detailText: 'Stream disconnected',
        showIframe: false,
        showLoading: false,
        showDisconnected: true
      };
    }

    return {
      chipLabel: 'disconnected',
      chipTone: 'blocked',
      detailText: 'Could not load page preview',
      showIframe: false,
      showLoading: false,
      showDisconnected: false
    };
  }

  function deriveRemoteControlSurface(input) {
    input = input || {};
    var previewState = input.previewState || 'hidden';
    var reason = input.reason || (input.attached ? 'ready' : 'stream-not-ready');
    var isStreaming = previewState === 'streaming';
    var detailText = 'Remote control is off';
    var chipLabel = 'remote off';
    var chipTone = 'paused';
    var available = isStreaming;

    switch (reason) {
      case 'ready':
        chipLabel = 'remote ready';
        chipTone = 'streaming';
        detailText = 'Remote control is attached to the live preview';
        available = isStreaming;
        break;
      case 'retarget-required':
        chipLabel = 're-arm remote';
        chipTone = 'recovering';
        detailText = 'Preview target changed. Re-enable remote control to continue.';
        available = isStreaming;
        break;
      case 'dispatch-failed':
        chipLabel = 'remote retry';
        chipTone = 'recovering';
        detailText = 'Remote control lost its debugger session. Re-enable it to retry.';
        available = isStreaming;
        break;
      case 'debugger-blocked':
        chipLabel = 'remote blocked';
        chipTone = 'blocked';
        detailText = input.ownership === 'external-debugger'
          ? 'Another debugger owns the browser tab.'
          : 'Remote control could not attach to the browser tab.';
        available = false;
        break;
      case 'stream-not-ready':
        chipLabel = 'remote off';
        chipTone = 'blocked';
        detailText = 'Remote control is unavailable until the preview is live again.';
        available = false;
        break;
      case 'user-stop':
      default:
        chipLabel = 'remote off';
        chipTone = 'paused';
        detailText = 'Remote control is off';
        available = isStreaming;
        break;
    }

    return {
      chipLabel: chipLabel,
      chipTone: chipTone,
      detailText: detailText,
      available: available,
      shouldForceDisable: input.attached !== true || reason !== 'ready'
    };
  }

  function deriveTaskRecoverySurface(input) {
    input = input || {};
    var activeTaskRunId = input.activeTaskRunId || '';
    var incomingTaskRunId = input.incomingTaskRunId || '';
    var lastActionText = input.lastActionText || '';

    if (input.recoveryTimedOut) {
      return {
        chipLabel: 'task timed out',
        chipTone: 'blocked',
        actionText: 'Task recovery timed out',
        keepProgressView: false,
        shouldFail: true
      };
    }

    if (incomingTaskRunId && activeTaskRunId && incomingTaskRunId !== activeTaskRunId) {
      return {
        chipLabel: 'waiting for task',
        chipTone: 'recovering',
        actionText: 'Waiting for task recovery...',
        keepProgressView: true,
        shouldFail: false
      };
    }

    if (input.taskState === 'running' &&
        (input.extensionOnline === false || input.wsConnected === false || input.recoveryPending === true)) {
      return {
        chipLabel: 'recovering task',
        chipTone: 'recovering',
        actionText: 'Waiting for task recovery...',
        keepProgressView: true,
        shouldFail: false
      };
    }

    if (input.taskState === 'running') {
      return {
        chipLabel: 'task live',
        chipTone: 'streaming',
        actionText: lastActionText || 'Working...',
        keepProgressView: true,
        shouldFail: false
      };
    }

    return {
      chipLabel: '',
      chipTone: 'paused',
      actionText: lastActionText,
      keepProgressView: false,
      shouldFail: false
    };
  }

  var exportsObj = {
    derivePreviewSurface: derivePreviewSurface,
    deriveRemoteControlSurface: deriveRemoteControlSurface,
    deriveTaskRecoverySurface: deriveTaskRecoverySurface
  };

  global.FSBDashboardRuntimeState = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
