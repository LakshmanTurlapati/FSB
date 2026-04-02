// content/init.js -- FSB Content Script Bootstrap
// First content module loaded. Sets up re-injection guard, FSB namespace, logger, shared state.
// This file runs at top level (no IIFE) because it establishes the guard flag other modules check.

// Re-injection guard -- if already loaded, set skip flag so subsequent files bail out
if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  window.__FSB_SKIP_INIT__ = true;
} else {
  // Mark as loaded FIRST to prevent race conditions
  window.__FSB_CONTENT_SCRIPT_LOADED__ = true;
  window.__FSB_SKIP_INIT__ = false;

  // Create namespace
  window.FSB = {};

  // Module tracking for debugging injection issues
  window.FSB._modules = {};

  // Logger setup (automation-logger.js should already be loaded before this file)
  window.FSB.logger = window.automationLogger || {
    log: function() {},
    error: function(msg, data) { console.error('[FSB Fallback]', msg, data || ''); },
    warn: function(msg, data) { console.warn('[FSB Fallback]', msg, data || ''); },
    info: function(msg, data) { console.log('[FSB Fallback]', msg, data || ''); },
    debug: function() {},
    logComm: function() {},
    logInit: function() {},
    logDOMOperation: function() {},
    logAction: function() {},
    logAI: function() {},
    logTiming: function() {},
    logNavigation: function() {},
    logSessionStart: function() {},
    logSessionEnd: function() {},
    logServiceWorker: function() {},
    getSessionLogs: function() { return []; },
    saveSession: function() { return Promise.resolve(false); },
    persistLogs: function() {},
    recordAction: function() {},
    logActionExecution: function() {}
  };

  // Backward compatibility alias
  window.FSB.automationLogger = window.FSB.logger;

  if (!window.automationLogger) {
    console.warn('[FSB Content] automation-logger.js was not loaded. Using fallback logger.');
  }

  // Shared mutable state (accessible by all modules via window.FSB)
  window.FSB.sessionId = null;
  window.FSB.overlayState = null;
  window.FSB.lastActionStatusText = null;
  window.FSB._overlayWatchdogTimer = null;

  // Global error handler for uncaught errors in content script
  window.addEventListener('error', (event) => {
    window.FSB.logger.error('Uncaught error in content script', {
      sessionId: window.FSB.sessionId,
      error: event.error?.message,
      filename: event.filename,
      lineno: event.lineno
    });

    // Try to notify background script of the error
    try {
      chrome.runtime.sendMessage({
        action: 'contentScriptError',
        error: event.error?.message || 'Unknown error',
        stack: event.error?.stack || '',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
        timestamp: Date.now()
      }).catch(() => {
        // Can't even send error message
        window.FSB.logger.error('Could not send error report to background', { sessionId: window.FSB.sessionId });
      });
    } catch (e) {
      window.FSB.logger.error('Error in error handler', { sessionId: window.FSB.sessionId, error: e.message });
    }
  });

  // Global promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    window.FSB.logger.error('Unhandled promise rejection in content script', { sessionId: window.FSB.sessionId, reason: String(event.reason) });

    // Try to notify background script
    try {
      chrome.runtime.sendMessage({
        action: 'contentScriptError',
        error: `Unhandled promise rejection: ${event.reason}`,
        url: window.location.href,
        timestamp: Date.now()
      }).catch(() => {
        window.FSB.logger.error('Could not send rejection report to background', { sessionId: window.FSB.sessionId });
      });
    } catch (e) {
      window.FSB.logger.error('Error in rejection handler', { sessionId: window.FSB.sessionId, error: e.message });
    }
  });

  window.FSB._modules['init'] = { loaded: true, timestamp: Date.now() };
}
