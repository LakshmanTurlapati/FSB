// Background service worker for FSB v0.9

// Import configuration and AI integration modules
importScripts('config.js');
importScripts('init-config.js');
importScripts('ai-integration.js');
importScripts('automation-logger.js');
importScripts('analytics.js');
importScripts('keyboard-emulator.js');

// Debug mode flag (controlled by options page toggle)
let fsbDebugMode = false;

/**
 * Debug logging helper - only logs when debug mode is enabled
 * @param {string} message - Debug message
 * @param {*} data - Optional data to log
 */
function debugLog(message, data) {
  if (fsbDebugMode) {
    if (data !== undefined) {
      console.log('[FSB DEBUG]', message, data);
    } else {
      console.log('[FSB DEBUG]', message);
    }
  }
}

/**
 * Load debug mode setting from storage
 */
async function loadDebugMode() {
  try {
    const stored = await chrome.storage.local.get(['debugMode']);
    fsbDebugMode = stored.debugMode === true;
    debugLog('Debug mode ' + (fsbDebugMode ? 'enabled' : 'disabled'));
  } catch (e) {
    fsbDebugMode = false;
  }
}

/**
 * Wrapper for chrome.storage.local.get() with timeout to prevent indefinite hanging
 * @param {Array|Object|string} keys - Storage keys to retrieve
 * @param {number} timeout - Timeout in milliseconds (default 3000)
 * @param {Object} defaults - Default values if storage read fails or times out
 * @returns {Promise<Object>} Storage data or defaults
 */
async function getStorageWithTimeout(keys, timeout = 3000, defaults = {}) {
  try {
    const storagePromise = chrome.storage.local.get(keys);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Storage read timeout')), timeout)
    );

    const result = await Promise.race([storagePromise, timeoutPromise]);
    return result;
  } catch (error) {
    automationLogger.warn('Storage read failed or timed out, using defaults', {
      error: error.message,
      keys
    });
    return defaults;
  }
}

// PART 3: Helper function to format duration for session elapsed timer
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSecs}s`;
  }
  return `${seconds}s`;
}

/**
 * PageLoadWatcher - Event-driven page load detection
 * Replaces hardcoded delays with smart waiting that proceeds immediately when ready
 */
class PageLoadWatcher {
  constructor() {
    this.pendingLoads = new Map(); // tabId -> {resolve, timeout, startTime}
  }

  /**
   * Wait for a tab to be fully loaded and ready for interaction
   * @param {number} tabId - Tab to watch
   * @param {Object} options - Configuration options
   * @returns {Promise<{success: boolean, waitTime: number, method: string}>}
   */
  async waitForPageReady(tabId, options = {}) {
    const {
      maxWait = 10000,         // Maximum wait time in ms
      requireDOMStable = true, // Also wait for DOM to stabilize
      stableTime = 300,        // How long DOM must be stable (ms)
    } = options;

    const startTime = Date.now();

    try {
      // Step 1: Wait for tab status='complete'
      await this.waitForTabComplete(tabId, maxWait);

      const afterTabComplete = Date.now() - startTime;
      automationLogger.logTiming(null, 'WAIT', 'tab_complete', afterTabComplete, { tabId });

      // Step 2: Verify content script is responsive
      const remainingForPing = Math.max(2000, maxWait - (Date.now() - startTime));
      const healthOk = await this.pingContentScript(tabId, remainingForPing);
      if (!healthOk) {
        automationLogger.logComm(null, 'health', 'healthCheck', false, { tabId, reason: 'not_responsive' });
        return { success: false, waitTime: Date.now() - startTime, method: 'health-failed' };
      }

      // Step 3: Optionally wait for DOM stability
      if (requireDOMStable) {
        const remainingTime = maxWait - (Date.now() - startTime);
        if (remainingTime > stableTime) {
          const stableResult = await this.waitForDOMStable(tabId, remainingTime, stableTime);
          automationLogger.logTiming(null, 'WAIT', 'dom_stable', stableResult?.waitTime || remainingTime, { tabId, ...stableResult });
        }
      }

      const waitTime = Date.now() - startTime;
      automationLogger.logTiming(null, 'WAIT', 'page_ready', waitTime, { tabId, method: 'event-driven' });

      return { success: true, waitTime, method: 'event-driven' };
    } catch (error) {
      const waitTime = Date.now() - startTime;
      automationLogger.logComm(null, 'health', 'page_ready', false, { tabId, error: error.message, waitTime });
      return {
        success: false,
        waitTime,
        method: 'error',
        error: error.message
      };
    }
  }

  /**
   * Wait for chrome.tabs.onUpdated status='complete'
   * @param {number} tabId - Tab to watch
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<void>}
   */
  waitForTabComplete(tabId, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, timeout);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      // Check if already complete
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          clearTimeout(timeoutId);
          resolve();
        } else {
          chrome.tabs.onUpdated.addListener(listener);
        }
      }).catch(err => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }

  /**
   * Ping content script to verify it's responsive
   * @param {number} tabId - Tab to ping
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>}
   */
  async pingContentScript(tabId, timeout = 2000) {
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { action: 'healthCheck' }, { frameId: 0 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ping timeout')), timeout)
        )
      ]);
      return response?.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for DOM to stabilize via content script
   * @param {number} tabId - Tab to check
   * @param {number} timeout - Max wait time in ms
   * @param {number} stableTime - How long DOM must be stable
   * @returns {Promise<Object>}
   */
  async waitForDOMStable(tabId, timeout, stableTime) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'executeAction',
        tool: 'waitForDOMStable',
        params: { timeout, stableTime }
      }, { frameId: 0 });
      return response || { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick check if page appears ready (non-blocking)
   * @param {number} tabId - Tab to check
   * @returns {Promise<Object>}
   */
  async checkPageReady(tabId) {
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { action: 'checkPageReady' }, { frameId: 0 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Check timeout')), 1000)
        )
      ]);
      return response || { success: false, isReady: false };
    } catch {
      return { success: false, isReady: false };
    }
  }
}

// Global PageLoadWatcher instance
const pageLoadWatcher = new PageLoadWatcher();

/**
 * Calculate smart delay after an action based on what happened
 * @param {Object} actionResult - Result from the action
 * @param {Object} context - Current automation context
 * @returns {Promise} Resolves when ready to continue
 */
async function smartWaitAfterAction(actionResult, context) {
  const { tool, params } = context.lastAction || {};
  const tabId = context.tabId;

  // Navigation actions - wait for page load
  if (['navigate', 'goBack', 'goForward'].includes(tool)) {
    automationLogger.logNavigation(null, tool, null, null, { waiting: true, tabId });
    return pageLoadWatcher.waitForPageReady(tabId, {
      maxWait: 5000,
      requireDOMStable: true,
      stableTime: 300
    });
  }

  // Click that triggered navigation
  if (tool === 'click' && (actionResult?.navigationTriggered || context.urlChanged)) {
    automationLogger.logNavigation(null, 'click', context.lastUrl, null, { navigationTriggered: true, tabId });
    return pageLoadWatcher.waitForPageReady(tabId, {
      maxWait: 5000,
      requireDOMStable: true,
      stableTime: 300
    });
  }

  // Type/input actions - minimal wait, just ensure input registered
  if (['type', 'clearInput', 'keyPress'].includes(tool)) {
    // No delay needed - immediate continuation is fine
    return Promise.resolve({ success: true, waitTime: 0, method: 'no-wait' });
  }

  // pressEnter might trigger form submission/navigation
  if (tool === 'pressEnter') {
    // Brief check for URL change
    await new Promise(resolve => setTimeout(resolve, 100));
    if (context.urlChanged) {
      return pageLoadWatcher.waitForPageReady(tabId, {
        maxWait: 5000,
        requireDOMStable: true
      });
    }
    // Otherwise just wait for DOM stability
    return pageLoadWatcher.waitForDOMStable(tabId, 2000, 200);
  }

  // Click that didn't navigate - might trigger AJAX
  if (tool === 'click' && !context.urlChanged) {
    automationLogger.logActionExecution(null, 'click', 'wait_dom', { tabId, reason: 'ajax_possible' });
    return pageLoadWatcher.waitForDOMStable(tabId, 2000, 200);
  }

  // Scroll actions - short wait for lazy loading
  if (tool === 'scroll') {
    return pageLoadWatcher.waitForDOMStable(tabId, 1500, 200);
  }

  // Default: no delay needed
  return Promise.resolve({ success: true, waitTime: 0, method: 'default' });
}

// EASY WIN #10: Service worker keep-alive mechanism
// Prevents service worker from shutting down during active automation sessions
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return; // Already running

  automationLogger.logServiceWorker('keepalive_start', { interval: 20000 });
  keepAliveInterval = setInterval(() => {
    // No-op operation to keep service worker alive
    chrome.runtime.getPlatformInfo(() => {
      // Just accessing the API keeps the worker active
    });
  }, 20000); // Ping every 20 seconds (MV3 workers shut down after 30s of inactivity)
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    automationLogger.logServiceWorker('keepalive_stop', {});
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// EASY WIN #10: Helper to clean up session and stop keep-alive if no active sessions
// Enhanced with race condition protection
async function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);

  // If session exists, mark it as terminating and wait for loop to yield
  if (session) {
    session.isTerminating = true;

    // If there's an active loop iteration, wait for it to yield
    if (session.loopPromise) {
      automationLogger.debug('Waiting for active loop to yield', { sessionId });
      try {
        // Wait up to 5 seconds for the loop to yield
        await Promise.race([
          session.loopPromise,
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      } catch (e) {
        automationLogger.debug('Loop yield wait completed', { sessionId, message: e?.message || 'timeout' });
      }
    }

    // Clear any pending timeouts
    if (session.pendingTimeout) {
      clearTimeout(session.pendingTimeout);
      session.pendingTimeout = null;
    }
  }

  activeSessions.delete(sessionId);
  // Also remove from persistent storage
  removePersistedSession(sessionId);

  // Clean up AI instance and its conversation history
  if (sessionAIInstances.has(sessionId)) {
    const ai = sessionAIInstances.get(sessionId);
    if (ai && typeof ai.clearConversationHistory === 'function') {
      ai.clearConversationHistory();
    }
    sessionAIInstances.delete(sessionId);
    automationLogger.debug('Cleaned up AI instance for session', { sessionId });
  }

  // Stop keep-alive if no more active sessions
  if (activeSessions.size === 0) {
    automationLogger.logServiceWorker('session_count', { count: 0, action: 'stopping_keepalive' });
    stopKeepAlive();
  } else {
    automationLogger.logServiceWorker('session_count', { count: activeSessions.size, action: 'keeping_alive' });
  }
}

// Helper to check if session is terminating (used in automation loop)
function isSessionTerminating(sessionId) {
  const session = activeSessions.get(sessionId);
  return !session || session.isTerminating || session.status !== 'running';
}

// Store for active automation sessions
let activeSessions = new Map();

// Store for AI integration instances per session (for multi-turn conversations)
// This allows conversation history to persist across iterations within a session
let sessionAIInstances = new Map();

// SPEED-02: Track pending DOM prefetch for parallel analysis
// When AI is processing, we speculatively start the next DOM fetch
let pendingDOMPrefetch = null;

/**
 * SPEED-02: Prefetch DOM for parallel analysis
 * Initiates DOM analysis while AI is processing, to reduce sequential waiting.
 * Returns a Promise that can be awaited later (or discarded if not needed).
 *
 * @param {number} tabId - Tab ID to fetch DOM from
 * @param {Object} options - DOM fetch options
 * @returns {Promise<Object|null>} Promise resolving to DOM response, or null on failure
 */
async function prefetchDOM(tabId, options = {}) {
  try {
    const domOptions = {
      useIncrementalDiff: true,
      prefetch: true, // Hint to content.js this is speculative
      ...options
    };

    automationLogger.debug('Starting DOM prefetch', { tabId, options: domOptions });

    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'getDOM',
      options: domOptions
    }, { frameId: 0 });

    if (response && response.success) {
      automationLogger.debug('DOM prefetch complete', {
        tabId,
        elementCount: response.structuredDOM?.elements?.length || 0
      });
      return response;
    }

    // Invalid response
    automationLogger.debug('DOM prefetch returned invalid response', { tabId });
    return null;
  } catch (error) {
    // Prefetch failure should not block - return null silently
    automationLogger.debug('DOM prefetch failed (non-blocking)', {
      tabId,
      error: error.message
    });
    return null;
  }
}

// Session persistence helpers - survive service worker restarts
// Persists essential session data to chrome.storage.session
async function persistSession(sessionId, session) {
  try {
    // Only persist essential fields needed for stop button to work
    const persistableSession = {
      sessionId: sessionId,
      task: session.task,
      tabId: session.tabId,
      status: session.status,
      startTime: session.startTime,
      // Don't persist: loopPromise, pendingTimeout, DOM hashes, etc. (non-serializable or transient)
    };

    const key = `session_${sessionId}`;
    await chrome.storage.session.set({ [key]: persistableSession });
    automationLogger.debug('Session persisted to storage', { sessionId });
  } catch (error) {
    automationLogger.warn('Failed to persist session', { sessionId, error: error.message });
  }
}

// Remove persisted session from storage
async function removePersistedSession(sessionId) {
  try {
    const key = `session_${sessionId}`;
    await chrome.storage.session.remove(key);
    automationLogger.debug('Session removed from storage', { sessionId });
  } catch (error) {
    automationLogger.warn('Failed to remove persisted session', { sessionId, error: error.message });
  }
}

// Restore sessions from storage on service worker startup
// Note: Restored sessions can only be stopped, not resumed (loop state is lost)
async function restoreSessionsFromStorage() {
  try {
    const allStorage = await chrome.storage.session.get(null);
    const sessionKeys = Object.keys(allStorage).filter(k => k.startsWith('session_'));

    for (const key of sessionKeys) {
      const persistedSession = allStorage[key];
      if (persistedSession && persistedSession.sessionId) {
        // Check if session is still supposed to be running
        if (persistedSession.status === 'running') {
          // Restore to activeSessions map so stop button works
          // Mark as 'recoverable' so we know it was restored (can't resume automation loop)
          activeSessions.set(persistedSession.sessionId, {
            ...persistedSession,
            isRestored: true,  // Flag to indicate this was restored, automation loop is not running
            status: 'running', // Keep as running so stop button works
          });
          automationLogger.info('Restored session from storage', {
            sessionId: persistedSession.sessionId,
            task: persistedSession.task?.substring(0, 50)
          });
        } else {
          // Clean up non-running sessions from storage
          await removePersistedSession(persistedSession.sessionId);
        }
      }
    }

    automationLogger.logServiceWorker('sessions_restored', { count: activeSessions.size });
  } catch (error) {
    automationLogger.warn('Failed to restore sessions from storage', { error: error.message });
  }
}

// Immediately restore sessions when service worker wakes up
// This handles both service worker restarts and browser startups
restoreSessionsFromStorage().catch(err => {
  console.warn('FSB: Failed to restore sessions on wake:', err);
});

// Track content script ready status per tab
let contentScriptReadyStatus = new Map();

// Global analytics instance
let globalAnalytics = null;

// Content script communication health tracking
let contentScriptHealth = new Map();

// Track active content script ports per tab for persistent connections
const contentScriptPorts = new Map();

// Listen for persistent port connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'content-script') {
    const tabId = port.sender?.tab?.id;
    if (!tabId || port.sender?.frameId !== 0) return; // Main frame only

    contentScriptPorts.set(tabId, {
      port,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now()
    });

    automationLogger.logComm(null, 'receive', 'port_connected', true, { tabId });

    port.onMessage.addListener((msg) => {
      if (msg.type === 'ready') {
        // Update heartbeat timestamp when ready message is received
        const portInfo = contentScriptPorts.get(tabId);
        if (portInfo) portInfo.lastHeartbeat = Date.now();

        contentScriptReadyStatus.set(tabId, {
          ready: true,
          timestamp: msg.timestamp,
          url: msg.url,
          method: 'port'
        });
        automationLogger.logComm(null, 'receive', 'port_ready', true, { tabId, url: msg.url });
      } else if (msg.type === 'heartbeat-ack') {
        const portInfo = contentScriptPorts.get(tabId);
        if (portInfo) portInfo.lastHeartbeat = Date.now();
      } else if (msg.type === 'spaNavigation') {
        // Handle SPA navigation notification via port
        const status = contentScriptReadyStatus.get(tabId);
        if (status) {
          status.url = msg.url;
          status.lastSpaNav = Date.now();
        }
        automationLogger.logComm(null, 'receive', 'spa_nav_port', true, { tabId, url: msg.url, method: msg.method });
      }
    });

    port.onDisconnect.addListener(() => {
      contentScriptPorts.delete(tabId);
      contentScriptReadyStatus.delete(tabId);
      contentScriptHealth.delete(tabId);
      automationLogger.logComm(null, 'receive', 'port_disconnected', true, { tabId });
    });
  }
});

// Clear content script state on navigation to prevent stale state issues
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // Main frame only

  const tabId = details.tabId;

  // Clear all state for this tab
  contentScriptReadyStatus.delete(tabId);
  contentScriptHealth.delete(tabId);

  // Disconnect existing port if any
  const portInfo = contentScriptPorts.get(tabId);
  if (portInfo) {
    try { portInfo.port.disconnect(); } catch (e) {}
    contentScriptPorts.delete(tabId);
  }

  automationLogger.logComm(null, 'nav', 'state_cleared', true, {
    tabId,
    transitionType: details.transitionType,
    url: details.url
  });
});

// Send periodic heartbeats to keep port connections validated
setInterval(() => {
  for (const [tabId, portInfo] of contentScriptPorts.entries()) {
    try {
      portInfo.port.postMessage({ type: 'heartbeat', timestamp: Date.now() });
    } catch (e) {
      // Port disconnected, cleanup will handle via onDisconnect
    }
  }
}, 3000);

// Performance monitoring
const performanceMetrics = {
  sessionStats: new Map(),
  globalStats: {
    totalSessions: 0,
    successfulSessions: 0,
    totalActions: 0,
    successfulActions: 0,
    averageIterationsPerSession: 0,
    averageTimePerSession: 0,
    communicationFailures: 0,
    alternativeActionsUsed: 0
  }
};

// Failure classification system
const FAILURE_TYPES = {
  COMMUNICATION: 'communication',
  DOM: 'dom',
  SELECTOR: 'selector',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  PERMISSION: 'permission',
  BF_CACHE: 'bfcache'  // Back/forward cache issue
};

const RETRY_STRATEGIES = {
  [FAILURE_TYPES.COMMUNICATION]: 'reconnect_retry',
  [FAILURE_TYPES.DOM]: 'wait_retry',
  [FAILURE_TYPES.SELECTOR]: 'alternative_selector',
  [FAILURE_TYPES.NETWORK]: 'exponential_backoff',
  [FAILURE_TYPES.TIMEOUT]: 'increase_timeout',
  [FAILURE_TYPES.PERMISSION]: 'skip_action',
  [FAILURE_TYPES.BF_CACHE]: 'wake_and_retry'
};

// EASY WIN #9: Specialized recovery handlers for each error type
const RECOVERY_HANDLERS = {
  async [FAILURE_TYPES.COMMUNICATION](tabId, error) {
    automationLogger.logRecovery(null, 'comm_failure', 're-inject', 'attempt', { tabId });
    await ensureContentScriptInjected(tabId);
    // Use smart page ready check instead of hardcoded 500ms
    const ready = await pageLoadWatcher.pingContentScript(tabId, 2000);
    if (!ready) {
      automationLogger.logRecovery(null, 'comm_failure', 're-inject', 'failed', { tabId, reason: 'not_responsive' });
    }
    return { recovered: true, method: 'script_reinjection' };
  },

  async [FAILURE_TYPES.DOM](tabId, error) {
    automationLogger.logRecovery(null, 'dom_failure', 'dom_wait', 'attempt', { tabId });
    try {
      await sendMessageWithRetry(tabId, {
        action: 'executeAction',
        tool: 'waitForDOMStable',
        params: { timeout: 3000, stableTime: 500 }
      });
      return { recovered: true, method: 'dom_wait' };
    } catch (e) {
      return { recovered: false, method: 'dom_wait_failed' };
    }
  },

  async [FAILURE_TYPES.SELECTOR](tabId, error, action) {
    automationLogger.logRecovery(null, 'selector_fail', 'alternative', 'pending', { tabId });
    // This is handled by tryAlternativeAction, but we track it
    return { recovered: false, method: 'needs_alternative_selector' };
  },

  async [FAILURE_TYPES.NETWORK](tabId, error) {
    automationLogger.logRecovery(null, 'network_failure', 'dom_wait', 'attempt', { tabId });
    // Use DOM stability check which also monitors network activity
    const stabilityResult = await pageLoadWatcher.waitForDOMStable(tabId, 3000, 500);
    automationLogger.logRecovery(null, 'network_failure', 'dom_wait', stabilityResult?.success ? 'success' : 'failed', { tabId, ...stabilityResult });
    return { recovered: true, method: 'network_wait', details: stabilityResult };
  },

  async [FAILURE_TYPES.TIMEOUT](tabId, error) {
    automationLogger.logRecovery(null, 'timeout', 'page_ready', 'attempt', { tabId });
    // Use smart page ready detection instead of hardcoded 1000ms
    const readyResult = await pageLoadWatcher.waitForPageReady(tabId, {
      maxWait: 3000,
      requireDOMStable: true,
      stableTime: 300
    });
    automationLogger.logRecovery(null, 'timeout', 'page_ready', readyResult?.success ? 'success' : 'failed', { tabId, ...readyResult });
    return { recovered: true, method: 'timeout_extended', details: readyResult };
  },

  async [FAILURE_TYPES.BF_CACHE](tabId, error) {
    automationLogger.logRecovery(null, 'bfcache', 'wake_page', 'attempt', { tabId });
    try {
      await chrome.tabs.update(tabId, { active: true });
      // Use smart page ready detection instead of hardcoded 500ms
      const loadResult = await pageLoadWatcher.waitForPageReady(tabId, {
        maxWait: 2000,
        requireDOMStable: false // Just need tab complete + health check
      });
      automationLogger.logRecovery(null, 'bfcache', 'wake_page', loadResult.success ? 'success' : 'retry', { tabId, waitTime: loadResult.waitTime });
      if (!loadResult.success) {
        // Fallback: re-inject content script
        await ensureContentScriptInjected(tabId);
      }
      return { recovered: true, method: 'page_wakeup', details: loadResult };
    } catch (e) {
      automationLogger.logRecovery(null, 'bfcache', 'wake_page', 'failed', { tabId, error: e.message });
      return { recovered: false, method: 'wakeup_failed', error: e.message };
    }
  }
};

// Helper function to check if URL is restricted for content script access
function isRestrictedURL(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://'
  ];
  
  const restrictedPages = [
    'chrome://extensions/',
    'chrome://settings/',
    'chrome://newtab/',
    'chrome://history/',
    'chrome://bookmarks/',
    'chrome://downloads/',
    'chrome://flags/',
    'chrome://version/',
    'chrome://webstore/',
    'edge://extensions/',
    'edge://settings/',
    'about:blank',
    'about:newtab'
  ];
  
  // Check exact matches first
  if (restrictedPages.some(page => url.startsWith(page))) {
    return true;
  }
  
  // Check protocol restrictions
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Get user-friendly page type description
function getPageTypeDescription(url) {
  if (url.startsWith('chrome://')) return 'Chrome internal page';
  if (url.startsWith('chrome-extension://')) return 'Chrome extension page';
  if (url.startsWith('edge://')) return 'Edge internal page';
  if (url.startsWith('about:')) return 'Browser internal page';
  if (url.startsWith('file://')) return 'Local file';
  return 'Restricted page';
}

// Content script health monitoring with enhanced timeout and retry
async function checkContentScriptHealth(tabId, timeout = 4000) {
  try {
    // Quick check: use port if available and recently active (10s window)
    let portInfo = contentScriptPorts.get(tabId);
    if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
      contentScriptHealth.set(tabId, {
        lastCheck: Date.now(),
        healthy: true,
        failures: 0,
        method: 'port'
      });
      return true;
    }

    // If port not found but we know content script should be there,
    // wait briefly for port reconnection (service worker may have just woken)
    if (!portInfo) {
      automationLogger.debug('Port not found, waiting for potential reconnection', { tabId });
      await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
      portInfo = contentScriptPorts.get(tabId);
      if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
        automationLogger.logComm(null, 'health', 'port_reconnected', true, { tabId });
        contentScriptHealth.set(tabId, {
          lastCheck: Date.now(),
          healthy: true,
          failures: 0,
          method: 'port_reconnect'
        });
        return true;
      }
    }

    // Adaptive timeout for known heavy sites (Google, YouTube)
    let adjustedTimeout = timeout;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url?.includes('google.com') || tab.url?.includes('youtube.com')) {
        adjustedTimeout = Math.min(timeout * 2.5, 10000);
        automationLogger.debug('Using extended timeout for heavy site', { tabId, url: tab.url, timeout: adjustedTimeout });
      }
    } catch (e) {
      // Tab might not exist, continue with default timeout
    }

    // Message-based check with internal retry
    for (let msgAttempt = 1; msgAttempt <= 2; msgAttempt++) {
      try {
        // CRITICAL: Use frameId: 0 to target ONLY the main frame
        const healthCheckPromise = chrome.tabs.sendMessage(tabId, {
          action: 'healthCheck'
        }, { frameId: 0 });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), adjustedTimeout)
        );

        const response = await Promise.race([healthCheckPromise, timeoutPromise]);

        if (response && response.success) {
          contentScriptHealth.set(tabId, {
            lastCheck: Date.now(),
            healthy: true,
            failures: 0,
            method: 'message'
          });
          return true;
        }
      } catch (e) {
        if (msgAttempt < 2) {
          automationLogger.debug('Message health check failed, retrying', { tabId, attempt: msgAttempt, error: e.message });
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // All attempts failed
    const health = contentScriptHealth.get(tabId) || { failures: 0 };
    health.lastCheck = Date.now();
    health.healthy = false;
    health.failures++;
    health.lastError = 'All health check attempts failed';
    contentScriptHealth.set(tabId, health);
    return false;
  } catch (error) {
    const health = contentScriptHealth.get(tabId) || { failures: 0 };
    health.lastCheck = Date.now();
    health.healthy = false;
    health.failures++;
    health.lastError = error.message;
    contentScriptHealth.set(tabId, health);
    return false;
  }
}

// Wait for content script to be ready before starting automation
// This prevents the race condition where automation starts before port is established
async function waitForContentScriptReady(tabId, timeout = 5000) {
  const startTime = Date.now();
  const pollInterval = 200;

  while (Date.now() - startTime < timeout) {
    // Check if port is established and has recent heartbeat
    const portInfo = contentScriptPorts.get(tabId);
    if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
      automationLogger.debug('Content script ready via port', { tabId });
      return true;
    }

    // Check if ready status is set
    const readyStatus = contentScriptReadyStatus.get(tabId);
    if (readyStatus && readyStatus.ready) {
      automationLogger.debug('Content script ready via status', { tabId });
      return true;
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  // Timeout reached - try to ensure content script is injected
  automationLogger.debug('Content script ready timeout, ensuring injection', { tabId });
  await ensureContentScriptInjected(tabId);

  // Give it one more check after injection
  const portInfo = contentScriptPorts.get(tabId);
  if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
    automationLogger.debug('Content script ready after injection', { tabId });
    return true;
  }

  const readyStatus = contentScriptReadyStatus.get(tabId);
  if (readyStatus && readyStatus.ready) {
    automationLogger.debug('Content script ready via status after injection', { tabId });
    return true;
  }

  automationLogger.debug('Content script readiness uncertain, proceeding anyway', { tabId });
  return false;
}

// Enhanced content script injection with retry logic and page load checks
async function ensureContentScriptInjected(tabId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait for page to be fully loaded before health check
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'loading') {
        automationLogger.logComm(null, 'health', 'tab_loading', true, { tabId, status: 'waiting' });
        await new Promise(resolve => {
          const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          // Timeout after 5 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 5000);
        });
      }

      // Check port connection first - most reliable indicator
      const portInfo = contentScriptPorts.get(tabId);
      if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
        automationLogger.logComm(null, 'health', 'port_healthy', true, { tabId, source: 'port' });
        return true;
      }

      // Then check if we already received a ready signal
      const readyStatus = contentScriptReadyStatus.get(tabId);
      if (readyStatus && readyStatus.ready) {
        automationLogger.logComm(null, 'health', 'ready_signal', true, { tabId, source: 'cached' });
        // Still do a health check to be sure
        const isHealthy = await checkContentScriptHealth(tabId);
        if (isHealthy) {
          return true;
        }
        // Ready signal received but health check failed
        // Don't delete ready status if port method was used - port disconnect handles cleanup
        if (readyStatus.method !== 'port') {
          contentScriptReadyStatus.delete(tabId);
        }
      }

      // Check if content script is already healthy (might be from previous injection)
      const isHealthy = await checkContentScriptHealth(tabId);
      if (isHealthy) {
        automationLogger.logComm(null, 'health', 'healthCheck', true, { tabId, source: 'existing' });
        contentScriptReadyStatus.set(tabId, { ready: true, timestamp: Date.now() });
        return true;
      }

      // Check if script might already be injected but not responsive
      // Prevent double injection by checking port existence
      const existingPorts = chrome.runtime.getContexts?.({
        contextTypes: ['TAB'],
        tabIds: [tabId]
      });
      if (existingPorts && (await existingPorts).length > 0) {
        automationLogger.logComm(null, 'health', 'context_check', true, { tabId, contextExists: true });
        // Use smart ping instead of hardcoded 500ms delay
        const recheckHealthy = await pageLoadWatcher.pingContentScript(tabId, 1000);
        if (recheckHealthy) {
          automationLogger.logComm(null, 'health', 'ping', true, { tabId });
          return true;
        }
      }

      // Check if content script was recently healthy - likely just needs time to reconnect
      const recentHealth = contentScriptHealth.get(tabId);
      if (recentHealth && Date.now() - recentHealth.lastCheck < 30000 && recentHealth.healthy) {
        automationLogger.debug('Content script was recently healthy, skipping re-injection', { tabId });
        // Just wait a bit more for reconnection instead of re-injecting
        await new Promise(r => setTimeout(r, 1500));
        const recheckHealthy = await checkContentScriptHealth(tabId);
        if (recheckHealthy) {
          automationLogger.logComm(null, 'health', 'reconnected_after_wait', true, { tabId });
          return true;
        }
      }

      // Inject content script - target only main frame to avoid iframe issues
      automationLogger.logComm(null, 'send', 'inject', true, { tabId, attempt });
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },  // frameIds: [0] = main frame only
        files: ['content.js']
      });

      // Wait for ready signal or timeout
      automationLogger.logComm(null, 'receive', 'ready_signal', true, { tabId, status: 'waiting' });
      const readySignalReceived = await new Promise((resolve) => {
        const startTime = Date.now();
        const maxWaitTime = 1000 * attempt; // Progressive: 1s, 2s, 3s

        const checkInterval = setInterval(() => {
          const readyStatus = contentScriptReadyStatus.get(tabId);
          if (readyStatus && readyStatus.ready) {
            clearInterval(checkInterval);
            automationLogger.logComm(null, 'receive', 'ready_signal', true, { tabId, waitTime: Date.now() - startTime });
            resolve(true);
          } else if (Date.now() - startTime > maxWaitTime) {
            clearInterval(checkInterval);
            automationLogger.logComm(null, 'receive', 'ready_signal', false, { tabId, timeout: maxWaitTime });
            resolve(false);
          }
        }, 100); // Check every 100ms
      });

      // If ready signal received, do one health check to confirm
      if (readySignalReceived) {
        const healthAfterReady = await checkContentScriptHealth(tabId);
        if (healthAfterReady) {
          automationLogger.logComm(null, 'health', 'healthCheck', true, { tabId, attempt, source: 'after_ready' });
          return true;
        }
      }

      // Fallback: Check health multiple times even without ready signal
      automationLogger.logComm(null, 'health', 'fallback_check', true, { tabId, reason: 'no_ready_signal' });
      for (let healthAttempt = 1; healthAttempt <= 3; healthAttempt++) {
        const healthAfterInjection = await checkContentScriptHealth(tabId);
        if (healthAfterInjection) {
          automationLogger.logComm(null, 'health', 'healthCheck', true, { tabId, attempt, healthAttempt });
          contentScriptReadyStatus.set(tabId, { ready: true, timestamp: Date.now() });
          return true;
        }
        // Use progressive ping timeout instead of hardcoded 500ms delay
        if (healthAttempt < 3) {
          const pingOk = await pageLoadWatcher.pingContentScript(tabId, 500 * healthAttempt);
          if (pingOk) {
            automationLogger.logComm(null, 'health', 'ping', true, { tabId, healthAttempt });
            contentScriptReadyStatus.set(tabId, { ready: true, timestamp: Date.now() });
            return true;
          }
        }
      }

    } catch (error) {
      automationLogger.logComm(null, 'send', 'inject', false, { tabId, attempt, error: error.message });
      if (attempt === maxRetries) {
        throw new Error(`Failed to inject content script after ${maxRetries} attempts: ${error.message}`);
      }
      // Exponential backoff between retries: 1000ms, 2000ms, 4000ms
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return false;
}

// Classify failure type based on error message and context
function classifyFailure(error, action, context = {}) {
  const errorMessage = (error.message || error || '').toLowerCase();
  
  // Communication failures
  // Check for back/forward cache issue first
  if (errorMessage.includes('back/forward cache') || 
      errorMessage.includes('page keeping the extension port is moved')) {
    return FAILURE_TYPES.BF_CACHE;
  }
  
  if (errorMessage.includes('could not establish connection') ||
      errorMessage.includes('receiving end does not exist') ||
      errorMessage.includes('message port closed') ||
      errorMessage.includes('no tab with id') ||
      errorMessage.includes('cannot access') ||
      errorMessage.includes('communication failure')) {
    return FAILURE_TYPES.COMMUNICATION;
  }
  
  // DOM/Selector failures
  if (errorMessage.includes('element not found') ||
      errorMessage.includes('selector') ||
      errorMessage.includes('not visible') ||
      errorMessage.includes('not interactable')) {
    return FAILURE_TYPES.SELECTOR;
  }
  
  // Timeout failures
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')) {
    return FAILURE_TYPES.TIMEOUT;
  }
  
  // Network failures
  if (errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch')) {
    return FAILURE_TYPES.NETWORK;
  }
  
  // Permission failures
  if (errorMessage.includes('permission') ||
      errorMessage.includes('restricted') ||
      errorMessage.includes('chrome://') ||
      errorMessage.includes('cannot execute')) {
    return FAILURE_TYPES.PERMISSION;
  }
  
  // Default to communication for unknown errors
  return FAILURE_TYPES.COMMUNICATION;
}

// Enhanced message sending with automatic retry and fallback
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
  // Capture URL before sending - used to detect if action triggered navigation
  let previousUrl = null;
  try {
    const tabInfo = await chrome.tabs.get(tabId);
    previousUrl = tabInfo?.url;
    message._previousUrl = previousUrl; // Store for BFCache recovery check
  } catch (e) {
    // Tab might not exist, continue anyway
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check content script health first
      if (attempt === 1) {
        const isHealthy = await checkContentScriptHealth(tabId);
        if (!isHealthy) {
          automationLogger.logComm(null, 'health', 'pre_message', false, { tabId, action: 're-inject' });
          await ensureContentScriptInjected(tabId);
        }
      }

      // CRITICAL: Use frameId: 0 to target ONLY the main frame
      // This prevents responding from iframes (like Google's RotateCookiesPage iframe)
      const response = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
      
      // Success - reset health tracking
      contentScriptHealth.set(tabId, {
        lastCheck: Date.now(),
        healthy: true,
        failures: 0
      });
      
      return response;
      
    } catch (error) {
      const failureType = classifyFailure(error, message);
      automationLogger.logComm(null, 'send', message.action || 'unknown', false, { tabId, attempt, failureType, error: error.message });
      
      // Update health tracking
      const health = contentScriptHealth.get(tabId) || { failures: 0 };
      health.failures++;
      health.healthy = false;
      health.lastCheck = Date.now();
      contentScriptHealth.set(tabId, health);
      
      if (attempt === maxRetries) {
        throw {
          originalError: error,
          failureType,
          attempts: maxRetries,
          message: `Failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      // Apply failure-specific retry strategy
      if (failureType === FAILURE_TYPES.BF_CACHE) {
        automationLogger.logRecovery(null, 'bfcache', 'detect', 'attempt', { tabId });

        // CRITICAL: BFCache often means navigation happened (click triggered page change)
        // Check if URL changed - if so, the action likely succeeded!
        try {
          const tabInfo = await chrome.tabs.get(tabId);
          const currentUrl = tabInfo?.url;
          const previousUrl = message._previousUrl; // Stored before sending

          if (previousUrl && currentUrl && currentUrl !== previousUrl) {
            automationLogger.logNavigation(null, 'bfcache_nav', previousUrl, currentUrl, { success: true, note: 'navigation_triggered' });
            return {
              success: true,
              navigationTriggered: true,
              previousUrl: previousUrl,
              newUrl: currentUrl,
              note: 'Action triggered page navigation (BFCache indicates page change)'
            };
          }
        } catch (urlCheckError) {
          automationLogger.debug('Could not check URL change', { tabId, error: urlCheckError.message });
        }

        // Try to wake up the page by focusing the tab
        try {
          await chrome.tabs.update(tabId, { active: true });
          // Use smart page ready detection instead of hardcoded delays
          const wakeResult = await pageLoadWatcher.waitForPageReady(tabId, {
            maxWait: 2000,
            requireDOMStable: false
          });
          automationLogger.logRecovery(null, 'bfcache', 'wake_tab', wakeResult.success ? 'success' : 'failed', { tabId, waitTime: wakeResult.waitTime, method: wakeResult.method });
        } catch (e) {
          automationLogger.logRecovery(null, 'bfcache', 'wake_tab', 'failed', { tabId, error: e.message });
        }
        // Re-inject content script after waking the page
        await ensureContentScriptInjected(tabId);
        // Verify content script is responsive
        const pingOk = await pageLoadWatcher.pingContentScript(tabId, 1000);
        if (!pingOk) {
          automationLogger.logRecovery(null, 'bfcache', 'verify_ping', 'failed', { tabId });
        }
      } else if (failureType === FAILURE_TYPES.COMMUNICATION) {
        automationLogger.logRecovery(null, 'comm_failure', 're-inject', 'attempt', { tabId });
        await ensureContentScriptInjected(tabId);
      }

      // EASY WIN #4: Exponential backoff with jitter (improves retry success by 20-30%)
      // Wait progressively longer with random jitter to prevent thundering herd
      const baseDelay = 1000; // 1 second base
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      const jitter = Math.random() * 1000; // 0-1000ms random jitter
      const totalDelay = exponentialDelay + jitter;

      automationLogger.logTiming(null, 'WAIT', 'retry_backoff', Math.round(totalDelay), { tabId, attempt: attempt + 1 });
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}

// Alternative action strategies for failed operations
async function tryAlternativeAction(sessionId, originalAction, originalError) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  
  const { tool, params } = originalAction;
  const alternatives = [];
  
  // Type action alternatives
  if (tool === 'type') {
    alternatives.push(
      // Try clicking first, then typing
      { tool: 'click', params: { selector: params.selector }, description: `Click element before typing` },
      // Try focus + clear + type
      { tool: 'focus', params: { selector: params.selector }, description: `Focus element before typing` },
      { tool: 'clearInput', params: { selector: params.selector }, description: `Clear input before typing` },
      { tool: 'type', params: { ...params, slow: true }, description: `Type slowly with delays` },
      // Try keyboard events instead
      { tool: 'keyPress', params: { selector: params.selector, key: params.text }, description: `Use keyboard events instead of typing` }
    );
  }
  
  // Click action alternatives
  if (tool === 'click') {
    alternatives.push(
      // Try different click methods
      { tool: 'doubleClick', params, description: `Try double-click instead` },
      { tool: 'rightClick', params, description: `Try right-click to trigger context` },
      // Try hovering first
      { tool: 'hover', params, description: `Hover before clicking` },
      { tool: 'click', params: { ...params, forceClick: true }, description: `Force click ignoring visibility` }
    );
  }
  
  // Selector alternatives for any action with selector
  if (params.selector && originalError.failureType === FAILURE_TYPES.SELECTOR) {
    const baseSelector = params.selector;
    const selectorAlternatives = generateAlternativeSelectors(baseSelector);
    
    for (const altSelector of selectorAlternatives) {
      alternatives.push({
        tool,
        params: { ...params, selector: altSelector },
        description: `Try alternative selector: ${altSelector.substring(0, 30)}...`
      });
    }
  }
  
  // Execute alternatives one by one
  for (const alternative of alternatives.slice(0, 3)) { // Limit to 3 alternatives
    try {
      automationLogger.logActionExecution(sessionId, alternative.tool, 'fallback', { description: alternative.description });
      
      const result = await sendMessageWithRetry(session.tabId, {
        action: 'executeAction',
        tool: alternative.tool,
        params: alternative.params
      });
      
      if (result && result.success) {
        automationLogger.logActionExecution(sessionId, alternative.tool, 'complete', { success: true, alternative: alternative.description });
        return {
          success: true,
          result: result.result,
          alternativeUsed: alternative.description,
          originalError: originalError.error
        };
      }
    } catch (error) {
      automationLogger.logActionExecution(sessionId, alternative.tool, 'complete', { success: false, alternative: alternative.description, error: error.message });
      continue;
    }
  }
  
  return null; // No alternatives worked
}

// Generate alternative selectors for failed selector queries
function generateAlternativeSelectors(originalSelector) {
  const alternatives = [];
  
  // If it's an ID selector, try class-based alternatives
  if (originalSelector.startsWith('#')) {
    const id = originalSelector.substring(1);
    alternatives.push(
      `[id="${id}"]`,
      `*[id*="${id}"]`,
      `[id^="${id}"]`,
      `[id$="${id}"]`
    );
  }
  
  // If it's a class selector, try attribute alternatives
  if (originalSelector.startsWith('.')) {
    const className = originalSelector.substring(1);
    alternatives.push(
      `[class*="${className}"]`,
      `[class^="${className}"]`, 
      `[class$="${className}"]`
    );
  }
  
  // Try data attribute alternatives
  alternatives.push(
    `[data-testid*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[aria-label*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[name*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[title*="${originalSelector.replace(/[#.]/g, '')}"]`
  );
  
  // Try partial matches
  if (originalSelector.includes('[') && originalSelector.includes('=')) {
    const attrMatch = originalSelector.match(/\[([^=]+)="([^"]+)"\]/);
    if (attrMatch) {
      const [, attr, value] = attrMatch;
      alternatives.push(
        `[${attr}*="${value}"]`,
        `[${attr}^="${value}"]`,
        `[${attr}$="${value}"]`,
        `[${attr}~="${value}"]`
      );
    }
  }
  
  return alternatives.slice(0, 5); // Limit alternatives
}

// Enhanced stuck detection with pattern recognition
function analyzeStuckPatterns(session) {
  const recentActions = session.actionHistory.slice(-10); // Look at last 10 actions
  const patterns = {
    repetitiveActions: false,
    cyclingBetweenStates: false,
    failingOnSameElement: false,
    noProgressMade: false,
    severity: 'low'
  };
  
  if (recentActions.length < 3) return patterns;
  
  // Check for repetitive actions (same action/params repeated)
  const actionGroups = {};
  recentActions.forEach(action => {
    const key = `${action.tool}_${JSON.stringify(action.params)}`;
    actionGroups[key] = (actionGroups[key] || 0) + 1;
  });
  
  const maxRepeats = Math.max(...Object.values(actionGroups));
  if (maxRepeats >= 3) {
    patterns.repetitiveActions = true;
    patterns.severity = 'high';
  }
  
  // Check for cycling between different states
  const domHashes = session.stateHistory.slice(-5).map(state => state.domHash);
  const uniqueHashes = new Set(domHashes);
  if (uniqueHashes.size <= 2 && domHashes.length >= 4) {
    patterns.cyclingBetweenStates = true;
    patterns.severity = Math.max(patterns.severity, 'medium');
  }
  
  // Check for failing on same elements
  const failedSelectors = recentActions
    .filter(action => !action.result?.success && action.params?.selector)
    .map(action => action.params.selector);
  
  if (failedSelectors.length >= 3) {
    const selectorCounts = {};
    failedSelectors.forEach(selector => {
      selectorCounts[selector] = (selectorCounts[selector] || 0) + 1;
    });
    
    if (Math.max(...Object.values(selectorCounts)) >= 2) {
      patterns.failingOnSameElement = true;
      patterns.severity = 'high';
    }
  }
  
  // Check for overall lack of progress
  const recentSuccesses = recentActions.filter(action => action.result?.success).length;
  if (recentSuccesses / recentActions.length < 0.3) { // Less than 30% success rate
    patterns.noProgressMade = true;
    patterns.severity = 'high';
  }
  
  return patterns;
}

/**
 * Check if click actions are targeting nearby elements (same area of the page)
 * Used to detect when automation is repeatedly clicking in the same area without progress
 * @param {Array} clickActions - Array of recent click actions with results
 * @returns {boolean} True if clicks are targeting nearby positions
 */
function areClicksNearby(clickActions) {
  if (clickActions.length < 2) return false;

  // Extract position data from click results
  const positions = clickActions
    .filter(a => a.result?.verification?.preState || a.result?.elementInfo)
    .map(a => {
      // Try to get position from element rect if available
      const elementRect = a.result?.elementRect;
      if (elementRect) {
        return { x: elementRect.x + elementRect.width / 2, y: elementRect.y + elementRect.height / 2 };
      }

      // Fallback: compare by selector similarity
      return { selector: a.params?.selector };
    });

  // If we have position data, check for proximity
  const positionsWithCoords = positions.filter(p => p.x !== undefined);
  if (positionsWithCoords.length >= 2) {
    // Check if all positions are within 100px of each other
    const avgX = positionsWithCoords.reduce((sum, p) => sum + p.x, 0) / positionsWithCoords.length;
    const avgY = positionsWithCoords.reduce((sum, p) => sum + p.y, 0) / positionsWithCoords.length;

    const allNearby = positionsWithCoords.every(p => {
      const distance = Math.sqrt(Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2));
      return distance < 100;
    });

    if (allNearby) return true;
  }

  // Fallback: check selector similarity
  const selectors = positions.filter(p => p.selector).map(p => p.selector);
  if (selectors.length >= 2) {
    // Check if selectors target similar elements (same class or ID patterns)
    const uniqueSelectors = [...new Set(selectors)];
    if (uniqueSelectors.length === 1) {
      return true; // All clicks on same selector
    }

    // Check for similar selector patterns (e.g., all targeting .btn classes)
    const selectorPatterns = selectors.map(s => s.split(/[#.\[\]]/)[0]);
    const uniquePatterns = [...new Set(selectorPatterns)];
    if (uniquePatterns.length <= 2) {
      return true; // Similar selector patterns
    }
  }

  return false;
}

// Generate recovery strategies based on stuck patterns
function generateRecoveryStrategies(patterns, session) {
  const strategies = [];
  
  if (patterns.repetitiveActions) {
    strategies.push({
      type: 'break_repetition',
      description: 'Switch to alternative approach to break repetitive loop',
      priority: 'high'
    });
  }
  
  if (patterns.cyclingBetweenStates) {
    strategies.push({
      type: 'reset_state',
      description: 'Navigate to different page or refresh to reset state',
      priority: 'medium'
    });
  }
  
  if (patterns.failingOnSameElement) {
    strategies.push({
      type: 'alternative_selectors',
      description: 'Use completely different element selection strategy',
      priority: 'high'
    });
  }
  
  if (patterns.noProgressMade) {
    strategies.push({
      type: 'change_approach',
      description: 'Fundamentally change approach (e.g., use Google search instead of direct interaction)',
      priority: 'high'
    });
  }
  
  return strategies.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// Performance monitoring functions
function initializeSessionMetrics(sessionId) {
  performanceMetrics.sessionStats.set(sessionId, {
    startTime: Date.now(),
    endTime: null,
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    communicationFailures: 0,
    alternativeActionsUsed: 0,
    iterations: 0,
    stuckEvents: 0,
    domStabilityWaits: 0,
    averageActionTime: 0,
    actionTimes: []
  });
  
  performanceMetrics.globalStats.totalSessions++;
}

function trackActionPerformance(sessionId, action, result, startTime, alternativeUsed = false) {
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (!sessionStats) return;
  
  const actionTime = Date.now() - startTime;
  sessionStats.actionTimes.push(actionTime);
  sessionStats.totalActions++;
  performanceMetrics.globalStats.totalActions++;
  
  if (result.success) {
    sessionStats.successfulActions++;
    performanceMetrics.globalStats.successfulActions++;
  } else {
    sessionStats.failedActions++;
    if (result.failureType === FAILURE_TYPES.COMMUNICATION) {
      sessionStats.communicationFailures++;
      performanceMetrics.globalStats.communicationFailures++;
    }
  }
  
  if (alternativeUsed) {
    sessionStats.alternativeActionsUsed++;
    performanceMetrics.globalStats.alternativeActionsUsed++;
  }
  
  // Update average action time
  sessionStats.averageActionTime = sessionStats.actionTimes.reduce((a, b) => a + b, 0) / sessionStats.actionTimes.length;
}

function finalizeSessionMetrics(sessionId, successful = false) {
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (!sessionStats) return;
  
  sessionStats.endTime = Date.now();
  const sessionDuration = sessionStats.endTime - sessionStats.startTime;
  
  if (successful) {
    performanceMetrics.globalStats.successfulSessions++;
  }
  
  // Update global averages
  const allSessions = Array.from(performanceMetrics.sessionStats.values());
  const completedSessions = allSessions.filter(s => s.endTime !== null);
  
  if (completedSessions.length > 0) {
    const totalIterations = completedSessions.reduce((sum, s) => sum + s.iterations, 0);
    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    
    performanceMetrics.globalStats.averageIterationsPerSession = totalIterations / completedSessions.length;
    performanceMetrics.globalStats.averageTimePerSession = totalDuration / completedSessions.length;
  }
  
  automationLogger.logTiming(sessionId, 'SESSION', 'complete', sessionDuration, {
    iterations: sessionStats.iterations,
    actions: sessionStats.totalActions,
    successRate: sessionStats.totalActions > 0 ? (sessionStats.successfulActions / sessionStats.totalActions * 100).toFixed(1) + '%' : '0%',
    avgActionTime: sessionStats.averageActionTime.toFixed(0) + 'ms',
    communicationFailures: sessionStats.communicationFailures,
    alternativeActionsUsed: sessionStats.alternativeActionsUsed
  });
}

function getPerformanceReport() {
  const global = performanceMetrics.globalStats;
  const actionSuccessRate = global.totalActions > 0 ? (global.successfulActions / global.totalActions * 100) : 0;
  const sessionSuccessRate = global.totalSessions > 0 ? (global.successfulSessions / global.totalSessions * 100) : 0;
  
  return {
    summary: {
      totalSessions: global.totalSessions,
      sessionSuccessRate: sessionSuccessRate.toFixed(1) + '%',
      totalActions: global.totalActions,
      actionSuccessRate: actionSuccessRate.toFixed(1) + '%',
      averageIterationsPerSession: global.averageIterationsPerSession.toFixed(1),
      averageTimePerSession: (global.averageTimePerSession / 1000).toFixed(1) + 's'
    },
    issues: {
      communicationFailures: global.communicationFailures,
      alternativeActionsNeeded: global.alternativeActionsUsed,
      communicationFailureRate: global.totalActions > 0 ? (global.communicationFailures / global.totalActions * 100).toFixed(1) + '%' : '0%'
    },
    recommendations: generatePerformanceRecommendations()
  };
}

function generatePerformanceRecommendations() {
  const global = performanceMetrics.globalStats;
  const recommendations = [];
  
  if (global.totalActions > 0) {
    const commFailureRate = global.communicationFailures / global.totalActions;
    if (commFailureRate > 0.3) {
      recommendations.push('High communication failure rate detected. Consider improving content script stability.');
    }
    
    const altActionRate = global.alternativeActionsUsed / global.totalActions;
    if (altActionRate > 0.2) {
      recommendations.push('High alternative action usage. Consider improving initial selector accuracy.');
    }
    
    if (global.averageIterationsPerSession > 20) {
      recommendations.push('High iteration count per session. Consider improving stuck detection and recovery.');
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! No issues detected.');
  }
  
  return recommendations;
}

// Smart navigation: Let AI decide the best approach instead of hardcoding
// The AI now has better context and tools to handle navigation
function analyzeTaskAndGetTargetUrl(task) {
  // Always default to Google so AI can search and navigate naturally
  // The AI will use searchGoogle tool or navigate tool as needed
  return 'https://google.com';
  
  /* Disabled hardcoded logic - AI handles this better
  const taskLower = task.toLowerCase();
  
  // Email-related tasks
  if (taskLower.includes('email') || taskLower.includes('gmail') || taskLower.includes('mail')) {
    return 'https://gmail.com';
  }
  
  // Social media tasks
  if (taskLower.includes('twitter') || taskLower.includes('tweet')) {
    return 'https://twitter.com';
  }
  if (taskLower.includes('facebook') || taskLower.includes('fb')) {
    return 'https://facebook.com';
  }
  */
  if (taskLower.includes('linkedin')) {
    return 'https://linkedin.com';
  }
  if (taskLower.includes('instagram')) {
    return 'https://instagram.com';
  }
  
  // Video/Entertainment
  if (taskLower.includes('youtube') || taskLower.includes('video') || taskLower.includes('watch')) {
    return 'https://youtube.com';
  }
  if (taskLower.includes('netflix')) {
    return 'https://netflix.com';
  }
  
  // Music
  if (taskLower.includes('spotify') || taskLower.includes('music') || taskLower.includes('song') || taskLower.includes('play')) {
    return 'https://spotify.com';
  }
  
  // Shopping
  if (taskLower.includes('amazon') || taskLower.includes('shop') || taskLower.includes('buy')) {
    return 'https://amazon.com';
  }
  
  // News
  if (taskLower.includes('news') || taskLower.includes('article')) {
    return 'https://news.google.com';
  }
  
  // Development/GitHub
  if (taskLower.includes('github') || taskLower.includes('repository') || taskLower.includes('repo')) {
    return 'https://github.com';
  }
  
  // Wikipedia/Information
  if (taskLower.includes('wikipedia') || taskLower.includes('wiki') || taskLower.includes('information about') || taskLower.includes('learn about')) {
    return 'https://wikipedia.org';
  }
  
  // Maps/Navigation
  if (taskLower.includes('map') || taskLower.includes('direction') || taskLower.includes('navigate to')) {
    return 'https://maps.google.com';
  }
  
  // Weather
  if (taskLower.includes('weather') || taskLower.includes('forecast')) {
    return 'https://weather.com';
  }
  
  // Chat/Communication
  if (taskLower.includes('discord')) {
    return 'https://discord.com';
  }
  if (taskLower.includes('slack')) {
    return 'https://slack.com';
  }
  if (taskLower.includes('whatsapp')) {
    return 'https://web.whatsapp.com';
  }
  
  // Cloud Storage
  if (taskLower.includes('drive') || taskLower.includes('google drive')) {
    return 'https://drive.google.com';
  }
  if (taskLower.includes('dropbox')) {
    return 'https://dropbox.com';
  }
  
  // Productivity
  if (taskLower.includes('docs') || taskLower.includes('document')) {
    return 'https://docs.google.com';
  }
  if (taskLower.includes('sheets') || taskLower.includes('spreadsheet')) {
    return 'https://sheets.google.com';
  }
  
  // All navigation decisions now handled by AI
}

// Check if we should attempt smart navigation
function shouldUseSmartNavigation(url, task) {
  if (!isRestrictedURL(url)) {
    return false; // Not on a restricted page
  }
  
  // Only use smart navigation for chrome://newtab and about:blank
  // Don't navigate away from settings, extensions, etc.
  const navigablePages = [
    'chrome://newtab/',
    'about:blank',
    'chrome://newtab',
    'about:newtab'
  ];
  
  return navigablePages.some(page => url.startsWith(page));
}

// Service Worker compatible analytics class
class BackgroundAnalytics {
  constructor() {
    this.usageData = [];
    this.currentModel = 'grok-3-fast';
    this.initialized = false;
    this.initPromise = this.initialize();
  }
  
  async initialize() {
    try {
      automationLogger.logInit('analytics', 'loading', {});
      await this.loadStoredData();
      this.initialized = true;
      automationLogger.logInit('analytics', 'ready', {});
    } catch (error) {
      automationLogger.logInit('analytics', 'failed', { error: error.message });
    }
  }
  
  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['fsbUsageData', 'fsbCurrentModel']);
      if (result.fsbUsageData) {
        this.usageData = result.fsbUsageData;
        automationLogger.debug('Loaded analytics data', { entries: this.usageData.length });
      }
      if (result.fsbCurrentModel) {
        this.currentModel = result.fsbCurrentModel;
      }
    } catch (error) {
      automationLogger.error('Failed to load analytics data', { error: error.message });
    }
  }
  
  async saveData() {
    try {
      automationLogger.debug('Saving analytics data', { entries: this.usageData.length, model: this.currentModel });

      await chrome.storage.local.set({
        fsbUsageData: this.usageData,
        fsbCurrentModel: this.currentModel
      });

      automationLogger.debug('Analytics data saved', { entries: this.usageData.length });

      // Verify save by reading back
      const verify = await chrome.storage.local.get(['fsbUsageData']);
      automationLogger.debug('Analytics save verified', { savedEntries: verify.fsbUsageData?.length });
    } catch (error) {
      automationLogger.error('Failed to save analytics data', { error: error.message });
      throw error; // Re-throw to be caught by caller
    }
  }
  
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = {
      // New Grok 4.1 series (2026)
      'grok-4-1': { input: 3.00, output: 15.00 },
      'grok-4-1-fast': { input: 0.20, output: 0.50 },
      'grok-4': { input: 3.00, output: 15.00 },
      'grok-code-fast-1': { input: 0.20, output: 1.50 },
      'grok-3': { input: 3.00, output: 15.00 },
      'grok-3-mini': { input: 0.30, output: 0.50 },
      'grok-2-vision': { input: 2.00, output: 10.00 },
      // Legacy model IDs for backward compatibility
      'grok-3-fast': { input: 0.20, output: 0.50 },
      'grok-3-mini-beta': { input: 0.30, output: 0.50 },
      'grok-3-mini-fast-beta': { input: 0.20, output: 0.50 },
      'grok-4-fast': { input: 3.00, output: 15.00 },
      // Other providers
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 }
    };

    const modelPricing = pricing[model] || pricing['grok-4-1-fast'];
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    return inputCost + outputCost;
  }
  
  async trackUsage(model, inputTokens, outputTokens, success = true) {
    try {
      // Ensure initialization is complete
      if (!this.initialized) {
        await this.initPromise;
      }
      
      const entry = {
        timestamp: Date.now(),
        model: model,
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        success: success,
        cost: this.calculateCost(model, inputTokens, outputTokens)
      };

      this.usageData.push(entry);
      this.currentModel = model;

      automationLogger.logAPI(null, 'analytics', 'track', { model, inputTokens, outputTokens, success, cost: entry.cost });

      // Clean old data (keep only last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.usageData = this.usageData.filter(entry => entry.timestamp > thirtyDaysAgo);

      await this.saveData();

    } catch (error) {
      automationLogger.error('Failed to track usage', { error: error.message });
      throw error; // Re-throw to be caught by caller
    }
  }
}

// Initialize analytics
function initializeAnalytics() {
  if (!globalAnalytics) {
    globalAnalytics = new BackgroundAnalytics();
    automationLogger.logInit('background_analytics', 'ready', {});
  }
  return globalAnalytics;
}

/**
 * Validates if a result is meaningful based on task context
 * @param {string} result - The result to validate
 * @param {string} task - The original task
 * @returns {boolean} True if result is valid and meaningful
 */
function isValidResult(result, task) {
  // Handle null/undefined
  if (!result || result === null || result === undefined) {
    return false;
  }
  
  // Convert to string for analysis
  const resultStr = String(result).trim();
  
  // Empty results or placeholder text are invalid
  if (resultStr === '' || resultStr === 'null' || resultStr === 'undefined') {
    return false;
  }
  
  // Reject generic placeholder messages
  const genericMessages = [
    'task completed',
    'task completed successfully', 
    'completed successfully',
    'done',
    'finished',
    'success',
    'completed',
    'found it',
    'found the information',
    'extracted the data'
  ];
  
  const resultLower = resultStr.toLowerCase();
  if (genericMessages.some(msg => resultLower === msg || resultLower === msg + '.')) {
    return false;
  }
  
  // Accept any result that is reasonably detailed (shows AI provided context)
  // This is much more permissive than the old validation
  if (resultStr.length >= 15) {
    // Check if it contains meaningful content words (not just filler)
    const meaningfulWords = resultStr.match(/\b\w{3,}\b/g) || [];
    return meaningfulWords.length >= 3; // At least 3 meaningful words
  }
  
  // For shorter results, be more flexible - accept if it has specific data patterns
  // Numbers, currency, percentages, URLs, etc.
  const hasSpecificData = /(\d+\.?\d*|\$|%|https?:\/\/|@|#|\w+\.\w+)/.test(resultStr);
  if (hasSpecificData && resultStr.length >= 5) {
    return true;
  }
  
  // Accept if it looks like extracted data (has quotes, colons, specific formats)
  const hasDataFormat = /(["'].*["']|:\s*\w+|\w+:\s*\w+|\d+\s*(USD|EUR|BTC|°F|°C|%))/.test(resultStr);
  if (hasDataFormat) {
    return true;
  }
  
  // Default: accept anything with reasonable length and multiple words
  const wordCount = (resultStr.match(/\b\w+\b/g) || []).length;
  return wordCount >= 2 && resultStr.length >= 8;
}

/**
 * Creates a unique signature for an action based on tool and key parameters
 * @param {Object} action - The action object
 * @returns {string} A unique signature for the action
 */
function createActionSignature(action) {
  // Create a signature that uniquely identifies this action
  const tool = action.tool || '';
  const params = action.params || {};
  
  // For most actions, the selector is the key differentiator
  if (params.selector) {
    return `${tool}:${params.selector}`;
  }
  
  // For navigation actions, use the URL
  if (params.url) {
    return `${tool}:${params.url}`;
  }
  
  // For type actions, include the text (truncated)
  if (tool === 'type' && params.text) {
    const textPreview = params.text.substring(0, 20);
    return `${tool}:${params.selector || 'unknown'}:${textPreview}`;
  }
  
  // For other actions, create a simple hash of params
  const paramsStr = JSON.stringify(params);
  return `${tool}:${simpleHash(paramsStr)}`;
}

/**
 * Simple hash function for creating signatures
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Detects if specific actions have failed repeatedly
 * @param {Object} session - The automation session
 * @returns {Array} Array of actions that need alternative strategies
 */
function detectRepeatedActionFailures(session) {
  const repeatedFailures = [];
  
  // Check each failed action
  for (const [signature, details] of Object.entries(session.failedActionDetails)) {
    // If an action has failed 2 or more times, it needs an alternative strategy
    if (details.count >= 2) {
      repeatedFailures.push({
        signature,
        tool: details.tool,
        params: details.params,
        failureCount: details.count,
        lastError: details.errors[details.errors.length - 1]?.error || 'Unknown error',
        allErrors: details.errors.map(e => e.error),
        timeSinceFirstFailure: Date.now() - details.firstFailure
      });
    }
  }
  
  return repeatedFailures;
}

/**
 * Detects if the same valid result has been extracted multiple times
 * @param {Object} session - The automation session
 * @returns {string|null} The repeated result if found, null otherwise
 */
function detectRepeatedSuccess(session) {
  // Look at recent getText actions
  const recentTextActions = session.actionHistory
    .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
    .slice(-10); // Last 10 successful getText actions
  
  if (recentTextActions.length < 3) {
    return null; // Not enough data
  }
  
  // Count occurrences of each result
  const resultCounts = {};
  recentTextActions.forEach(action => {
    const value = String(action.result.value).trim();
    if (value && value !== 'null' && value !== 'undefined') {
      resultCounts[value] = (resultCounts[value] || 0) + 1;
    }
  });
  
  // Find results that appear at least 3 times
  for (const [result, count] of Object.entries(resultCounts)) {
    if (count >= 3 && isValidResult(result, session.task)) {
      automationLogger.debug('Found repeated valid result', { result: result.substring(0, 100), count });
      return result;
    }
  }
  
  // Also check for similar results (e.g., same number with different formatting)
  const numericResults = recentTextActions
    .map(action => {
      const value = String(action.result.value).trim();
      const numMatch = value.match(/(\d+\.?\d*)/);
      return numMatch ? parseFloat(numMatch[1]) : null;
    })
    .filter(num => num !== null);

  if (numericResults.length >= 3) {
    // Check if the same number appears multiple times
    const numCounts = {};
    numericResults.forEach(num => {
      numCounts[num] = (numCounts[num] || 0) + 1;
    });

    for (const [num, count] of Object.entries(numCounts)) {
      if (count >= 3) {
        automationLogger.debug('Found repeated numeric result', { num, count });
        return String(num);
      }
    }
  }

  return null;
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  automationLogger.logComm(null, 'receive', request.action || 'unknown', true, { tabId: sender.tab?.id });
  
  switch (request.action) {
    case 'startAutomation':
      handleStartAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'stopAutomation':
      handleStopAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getPerformanceReport':
      const report = getPerformanceReport();
      sendResponse({ success: true, report });
      break;
      
    case 'callAI':
      handleAICall(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getStatus':
      // Return sessionIds so UI can recover after service worker restart
      const sessionIds = Array.from(activeSessions.keys());
      sendResponse({
        status: 'ready',
        activeSessions: activeSessions.size,
        sessionIds: sessionIds,
        currentSessionId: sessionIds[0] || null  // First active session for UI recovery
      });
      break;
      
    case 'testAPI':
      handleTestAPI(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'TRACK_USAGE':
      return handleTrackUsage(request, sender, sendResponse);
      
    // Multi-tab management actions
    case 'openNewTab':
      handleOpenNewTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'switchToTab':
      handleSwitchToTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'closeTab':
      handleCloseTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'listTabs':
      handleListTabs(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getCurrentTab':
      handleGetCurrentTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'waitForTabLoad':
      handleWaitForTabLoad(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'keyboardDebuggerAction':
      handleKeyboardDebuggerAction(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpInsertText':
      handleCDPInsertText(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'contentScriptReady':
      // Content script signals it's ready and message listener is registered
      const tabId = sender.tab?.id;
      const frameId = sender.frameId;
      if (tabId) {
        // Only track main frame (frameId: 0) readiness for health checks
        // Iframe signals are logged but don't mark the tab as ready
        if (frameId === 0) {
          contentScriptReadyStatus.set(tabId, {
            ready: true,
            timestamp: Date.now(),
            url: request.url || sender.url,
            frameId: frameId
          });
          automationLogger.logInit('content_script', 'ready', { tabId, frameId, readyState: request.readyState, retry: request.retry || false });
        } else {
          automationLogger.debug('Iframe content script ready (ignored)', { tabId, frameId });
        }
      }
      sendResponse({ success: true });
      break;

    case 'contentScriptConfirmation':
      // Content script sends confirmation ping to verify bidirectional communication
      const confirmTabId = sender.tab?.id;
      const confirmFrameId = sender.frameId;
      if (confirmTabId) {
        // Only track main frame confirmations
        if (confirmFrameId === 0) {
          const existingStatus = contentScriptReadyStatus.get(confirmTabId);
          if (existingStatus) {
            existingStatus.confirmed = true;
            existingStatus.confirmTimestamp = Date.now();
            contentScriptReadyStatus.set(confirmTabId, existingStatus);
          }
          automationLogger.logComm(null, 'receive', 'confirmation', true, { tabId: confirmTabId, frameId: confirmFrameId });
        }
        // Silently ignore iframe confirmations
      }
      sendResponse({ success: true });
      break;

    case 'spaNavigation':
      // Content script detected SPA navigation (Google, etc.)
      const spaTabId = sender.tab?.id;
      if (spaTabId) {
        const status = contentScriptReadyStatus.get(spaTabId);
        if (status) {
          status.url = request.url;
          status.lastSpaNav = Date.now();
        }
        automationLogger.logComm(null, 'receive', 'spa_navigation', true, {
          tabId: spaTabId,
          url: request.url,
          method: request.method
        });
      }
      sendResponse({ success: true });
      break;

    case 'contentScriptError':
      // Content script encountered an error during initialization
      automationLogger.logInit('content_script', 'failed', {
        tabId: sender.tab?.id,
        url: request.url,
        error: request.error,
        stack: request.stack,
        filename: request.filename,
        lineno: request.lineno,
        colno: request.colno
      });
      sendResponse({ success: true });
      break;

    case 'getSessionReplayData':
      // Get structured replay data for session visualization
      (async () => {
        try {
          const replay = await automationLogger.getReplayData(request.sessionId);
          sendResponse({ replay });
        } catch (error) {
          sendResponse({ replay: null, error: error.message });
        }
      })();
      return true; // Will respond asynchronously

    case 'exportSessionHumanReadable':
      // Export session as human-readable text report
      (async () => {
        try {
          const text = await automationLogger.exportHumanReadable(request.sessionId);
          sendResponse({ text });
        } catch (error) {
          sendResponse({ text: null, error: error.message });
        }
      })();
      return true; // Will respond asynchronously

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

/**
 * Handles the start of a new automation session
 * @param {Object} request - The automation start request
 * @param {string} request.task - The task description in natural language
 * @param {number} request.tabId - The ID of the tab to automate
 * @param {Object} sender - The message sender information
 * @param {Function} sendResponse - Function to send response back to sender
 * @returns {Promise<void>}
 */
async function handleStartAutomation(request, sender, sendResponse) {
  const { task, tabId } = request;
  
  try {
    // Get the target tab ID
    const targetTabId = tabId || sender.tab?.id;
    
    // Get tab information to check URL
    let tabInfo;
    try {
      tabInfo = await chrome.tabs.get(targetTabId);
    } catch (error) {
      throw new Error(`Cannot access tab ${targetTabId}. Tab may have been closed or is not accessible.`);
    }
    
    // Check if we need smart navigation for restricted URLs
    if (isRestrictedURL(tabInfo.url)) {
      if (shouldUseSmartNavigation(tabInfo.url, task)) {
        // Determine the best website for this task
        const targetUrl = analyzeTaskAndGetTargetUrl(task);
        
        automationLogger.logNavigation(null, 'smart', tabInfo.url, targetUrl, { task: task.substring(0, 100) });
        
        // Navigate to the target website
        await chrome.tabs.update(targetTabId, { url: targetUrl });
        
        // Wait for navigation to complete
        await new Promise((resolve) => {
          const navigationListener = (tabId, changeInfo) => {
            if (tabId === targetTabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(navigationListener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(navigationListener);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(navigationListener);
            resolve();
          }, 10000);
        });
        
        // Update tabInfo after navigation
        try {
          tabInfo = await chrome.tabs.get(targetTabId);
        } catch (error) {
          throw new Error(`Tab became inaccessible after navigation to ${targetUrl}`);
        }
        
        automationLogger.logNavigation(null, 'smart', null, tabInfo.url, { status: 'completed' });
      } else {
        // For non-navigable restricted pages (settings, extensions, etc.), show error
        const pageType = getPageTypeDescription(tabInfo.url);
        const error = new Error(`Chrome security restrictions prevent extensions from accessing this type of page (${tabInfo.url}). Please navigate to a regular website to use automation.`);
        error.isChromePage = true;
        throw error;
      }
    }
    
    // Track smart navigation for user feedback
    let navigationMessage = '';
    const originalUrl = tabInfo.url;
    let navigationPerformed = false;
    
    if (isRestrictedURL(originalUrl) && shouldUseSmartNavigation(originalUrl, task)) {
      const targetUrl = analyzeTaskAndGetTargetUrl(task);
      navigationMessage = `Navigated from ${getPageTypeDescription(originalUrl)} to ${new URL(targetUrl).hostname} to complete your task.`;
      navigationPerformed = true;
    }

    // Create new session with enhanced tracking
    const sessionId = `session_${Date.now()}`;
    const sessionData = {
      task,
      tabId: targetTabId,
      originalTabId: targetTabId,  // Store original tab - automation is restricted to this tab
      status: 'running',
      startTime: Date.now(),
      actionHistory: [],        // Track all actions executed
      stateHistory: [],         // Track DOM state changes
      failedAttempts: {},       // Track failed actions by type
      failedActionDetails: {},  // Track detailed failures by action signature
      lastDOMHash: null,        // Hash of last DOM state to detect changes
      stuckCounter: 0,          // Counter for detecting stuck state
      consecutiveNoProgressCount: 0, // Counter for iterations with no meaningful progress (doesn't reset on URL change)
      iterationCount: 0,        // Total iterations
      urlHistory: [],           // Track URL changes
      lastUrl: null,            // Last known URL
      actionSequences: [],      // Track sequences of actions to detect patterns
      sequenceRepeatCount: {},  // Count how many times each sequence repeats
      navigationMessage,        // Store navigation message for UI
    };
    
    activeSessions.set(sessionId, sessionData);
    // Persist session to storage so stop button works after service worker restart
    persistSession(sessionId, sessionData);

    automationLogger.logSessionStart(sessionId, task, sessionData.tabId);
    initializeSessionMetrics(sessionId);
    automationLogger.info('Created new session', { sessionId, tabId: sessionData.tabId, activeSessions: activeSessions.size });

    // Content script injection is now handled by the automation loop
    // to prevent double injection and race conditions

    sendResponse({
      success: true,
      sessionId,
      message: navigationMessage || 'Automation started',
      navigationPerformed: navigationPerformed
    });

    // EASY WIN #10: Start keep-alive when automation begins
    startKeepAlive();

    // Wait for content script to be ready before starting automation
    // This prevents race conditions where automation starts before port connection is established
    automationLogger.debug('Waiting for content script readiness', { sessionId, tabId: targetTabId });
    const isReady = await waitForContentScriptReady(targetTabId, 5000);
    automationLogger.debug('Content script readiness check complete', { sessionId, tabId: targetTabId, isReady });

    // Reset DOM state in content script to prevent stale state comparison between sessions
    try {
      await chrome.tabs.sendMessage(targetTabId, { action: 'resetDOMState', sessionId });
      automationLogger.logDOMOperation(sessionId, 'reset', {}, { tabId: targetTabId });
    } catch (e) {
      automationLogger.debug('Could not reset DOM state', { sessionId, error: e.message });
    }

    // Start the automation loop
    startAutomationLoop(sessionId);

  } catch (error) {
    automationLogger.error('Error starting automation', { error: error.message, isChromePage: error.isChromePage || false });
    sendResponse({
      success: false,
      error: error.message,
      isChromePage: error.isChromePage || false
    });
  }
}



// Handle automation stop
async function handleStopAutomation(request, sender, sendResponse) {
  const { sessionId } = request;

  automationLogger.info('Stop automation request received', { sessionId, activeSessions: Array.from(activeSessions.keys()) });

  // Check in-memory first
  let session = activeSessions.get(sessionId);

  // Fallback: Check storage if not in memory (service worker may have restarted)
  if (!session) {
    automationLogger.info('Session not in memory, checking storage...', { sessionId });
    try {
      const key = `session_${sessionId}`;
      const stored = await chrome.storage.session.get(key);
      if (stored[key] && stored[key].sessionId === sessionId) {
        // Restore to activeSessions so cleanup works properly
        session = {
          ...stored[key],
          isRestored: true,
          actionHistory: stored[key].actionHistory || []
        };
        activeSessions.set(sessionId, session);
        automationLogger.info('Session restored from storage for stop', { sessionId });
      }
    } catch (error) {
      automationLogger.warn('Failed to check storage for session', { sessionId, error: error.message });
    }
  }

  if (session) {
    automationLogger.debug('Found session to stop', { sessionId, status: session.status });

    session.status = 'stopped';

    // Log and save session before cleanup
    const duration = Date.now() - session.startTime;
    automationLogger.logSessionEnd(sessionId, 'stopped', session.actionHistory.length, duration);
    automationLogger.saveSession(sessionId, session);

    finalizeSessionMetrics(sessionId, false); // Stopped, not completed
    cleanupSession(sessionId); // EASY WIN #10: Use cleanup helper

    automationLogger.info('Session stopped and removed', { sessionId });
    sendResponse({
      success: true,
      message: 'Automation stopped'
    });
  } else {
    automationLogger.warn('Session not found in memory or storage', { sessionId });
    sendResponse({
      success: false,
      error: 'Session not found'
    });
  }
}

// Handle API test
async function handleTestAPI(request, sender, sendResponse) {
  try {
    // Get settings for API test
    const settings = await config.getAll();
    
    // Check appropriate API key based on provider
    const provider = settings.modelProvider || 'xai';
    if (provider === 'gemini' && !settings.geminiApiKey) {
      sendResponse({ 
        success: false, 
        error: 'Gemini API key not configured. Please set it in extension settings.' 
      });
      return;
    } else if (provider === 'xai' && !settings.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'xAI API key not configured. Please set it in extension settings.' 
      });
      return;
    }
    
    // Create AI integration instance and test connection
    const ai = new AIIntegration(settings);
    const testResult = await ai.testConnection();
    
    sendResponse({ 
      success: !testResult.connectionFailed && testResult.ok, 
      result: testResult 
    });
    
  } catch (error) {
    automationLogger.error('API test error', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle AI API calls
async function handleAICall(request, sender, sendResponse) {
  const { prompt, structuredDOM, apiKey } = request;
  
  try {
    // This is where we'll integrate with xAI Grok or OpenAI
    // For now, we'll simulate an AI response
    const aiResponse = await callAIAPI(prompt, structuredDOM, apiKey);
    
    sendResponse({ 
      success: true, 
      response: aiResponse 
    });
  } catch (error) {
    automationLogger.error('AI API error', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * EASY WIN #5: Smart delay calculation with context awareness
 * Calculates delays based on action types, recent failures, DOM changes, and network activity
 * @param {Object} currentAction - The current action being executed
 * @param {string} currentAction.tool - The tool/action type
 * @param {Object} currentAction.params - Action parameters
 * @param {Object} nextAction - The next action to be executed
 * @param {string} nextAction.tool - The next tool/action type
 * @param {Object} context - Execution context (failures, DOM changes, etc.)
 * @returns {number} Delay in milliseconds
 */
function calculateActionDelay(currentAction, nextAction, context = {}) {
  // Define action categories
  const fastActions = ['type', 'clearInput', 'selectText', 'focus', 'blur', 'pressEnter', 'keyPress'];
  const mediumActions = ['hover', 'moveMouse', 'getAttribute', 'getText'];
  const slowActions = ['click', 'rightClick', 'doubleClick', 'selectOption', 'toggleCheckbox'];
  const verySlowActions = ['navigate', 'refresh', 'goBack', 'goForward', 'solveCaptcha', 'waitForElement'];
  
  // Base delays in milliseconds
  const delays = {
    fastToFast: 300,      // Fast typing sequences
    fastToMedium: 500,    // Type then hover
    fastToSlow: 800,      // Type then click
    fastToVerySlow: 1500, // Type then navigate
    
    mediumToFast: 400,    // Hover then type
    mediumToMedium: 600,  // Hover then move
    mediumToSlow: 800,    // Hover then click
    mediumToVerySlow: 1500,
    
    slowToFast: 1000,     // Click then type (need DOM to settle)
    slowToMedium: 800,    // Click then hover
    slowToSlow: 1200,     // Click then click
    slowToVerySlow: 2000, // Click then navigate
    
    verySlowToAny: 3000   // Navigation actions need time
  };
  
  // Categorize actions
  function getActionCategory(action) {
    if (!action) return 'unknown';
    
    if (fastActions.includes(action.tool)) return 'fast';
    if (mediumActions.includes(action.tool)) return 'medium';
    if (slowActions.includes(action.tool)) return 'slow';
    if (verySlowActions.includes(action.tool)) return 'verySlow';
    return 'medium'; // Default
  }
  
  const currentCategory = getActionCategory(currentAction);
  const nextCategory = getActionCategory(nextAction);
  
  // Special cases for related actions
  if (currentAction.tool === 'type' && nextAction && nextAction.tool === 'type') {
    // Fast consecutive typing - check if they're in the same form
    const currentSelector = currentAction.params?.selector || '';
    const nextSelector = nextAction.params?.selector || '';
    
    // If typing in different fields of same form, use shorter delay
    if (currentSelector.includes('input') && nextSelector.includes('input')) {
      return 200; // Very fast for form filling
    }
    if (currentSelector.includes('textarea') && nextSelector.includes('textarea')) {
      return 300; // Fast for text areas
    }
  }
  
  // Click followed by type (common pattern like clicking input then typing)
  if (currentAction.tool === 'click' && nextAction && nextAction.tool === 'type') {
    return 600; // Moderate delay for click-to-type
  }
  
  // Type with pressEnter followed by anything needs more time
  if (currentAction.tool === 'type' && currentAction.params?.pressEnter) {
    return 1000; // Enter key usually triggers actions
  }
  
  // Use category-based delays
  const delayKey = `${currentCategory}To${nextCategory.charAt(0).toUpperCase() + nextCategory.slice(1)}`;

  let baseDelay;
  if (currentCategory === 'verySlow') {
    baseDelay = delays.verySlowToAny;
  } else {
    baseDelay = delays[delayKey] || delays.mediumToMedium;
  }

  // EASY WIN #5: Adjust delay based on execution context
  let adjustedDelay = baseDelay;

  // Increase delay if recent failures detected
  if (context.recentFailures && context.recentFailures > 2) {
    adjustedDelay *= 2; // Double delay when struggling
    automationLogger.logTiming(null, 'ACTION', 'delay_increase', adjustedDelay, { reason: 'recent_failures', failures: context.recentFailures });
  }

  // Increase delay if DOM is changing rapidly
  if (context.domChangeVelocity && context.domChangeVelocity > 10) {
    adjustedDelay *= 1.5; // 50% more time for unstable DOM
    automationLogger.logTiming(null, 'ACTION', 'delay_increase', adjustedDelay, { reason: 'rapid_dom_changes', velocity: context.domChangeVelocity });
  }

  // Increase delay if network activity detected
  if (context.networkActive) {
    adjustedDelay *= 1.5;
    automationLogger.logTiming(null, 'ACTION', 'delay_increase', adjustedDelay, { reason: 'network_active' });
  }

  // Decrease delay if consecutive successes (things going smoothly)
  if (context.consecutiveSuccesses && context.consecutiveSuccesses > 5) {
    adjustedDelay *= 0.7; // 30% faster when on a roll
  }

  // Clamp delay between 100ms minimum and 3000ms maximum
  adjustedDelay = Math.min(Math.max(adjustedDelay, 100), 3000);

  return Math.round(adjustedDelay);
}

/**
 * SPEED-01: Outcome-based delay strategies
 * Maps detected outcome types to appropriate wait strategies
 */
const OUTCOME_DELAYS = {
  navigation: { waitFor: 'pageLoad', maxWait: 5000 },
  network: { waitFor: 'networkQuiet', maxWait: 2000, quietTime: 200 },
  majorDOMChange: { waitFor: 'domStable', maxWait: 1000, stableTime: 300 },
  minorDOMChange: { waitFor: 'domStable', maxWait: 500, stableTime: 100 },
  elementStateChange: { waitFor: 'minimal', delayMs: 50 },
  noChange: { waitFor: 'none', delayMs: 0 }
};

/**
 * SPEED-01: Applies outcome-based delay instead of category-based delay
 * Waits appropriately based on what actually happened after an action
 * @param {number} tabId - Tab ID for communication with content script
 * @param {string} outcomeType - Type from detectActionOutcome (navigation, network, etc.)
 * @param {Object} options - Override options
 * @returns {Promise<Object>} Wait result { waited: true, strategy, waitTime }
 */
async function outcomeBasedDelay(tabId, outcomeType, options = {}) {
  const startTime = Date.now();
  const strategy = OUTCOME_DELAYS[outcomeType] || OUTCOME_DELAYS.noChange;

  try {
    switch (strategy.waitFor) {
      case 'pageLoad':
        // Use pageLoadWatcher for navigation outcomes
        const loadResult = await pageLoadWatcher.waitForPageReady(tabId, {
          maxWait: options.maxWait || strategy.maxWait,
          requireDOMStable: true,
          stableTime: 300
        });
        automationLogger.logTiming(null, 'WAIT', 'outcome_pageLoad', Date.now() - startTime, {
          outcomeType,
          success: loadResult.success
        });
        return {
          waited: true,
          strategy: outcomeType,
          waitTime: Date.now() - startTime,
          method: 'pageLoad',
          result: loadResult
        };

      case 'networkQuiet':
        // Wait for network to quiet down
        try {
          const networkResult = await sendMessageWithRetry(tabId, {
            action: 'executeAction',
            tool: 'waitForPageStability',
            params: {
              maxWait: options.maxWait || strategy.maxWait,
              stableTime: 100,
              networkQuietTime: options.quietTime || strategy.quietTime
            }
          });
          automationLogger.logTiming(null, 'WAIT', 'outcome_networkQuiet', Date.now() - startTime, {
            outcomeType,
            stable: networkResult?.result?.stable
          });
          return {
            waited: true,
            strategy: outcomeType,
            waitTime: Date.now() - startTime,
            method: 'networkQuiet',
            result: networkResult
          };
        } catch (err) {
          // Fallback to minimal delay if network wait fails
          await new Promise(r => setTimeout(r, 200));
          return {
            waited: true,
            strategy: outcomeType,
            waitTime: Date.now() - startTime,
            method: 'networkQuiet-fallback',
            error: err.message
          };
        }

      case 'domStable':
        // Wait for DOM to stabilize
        try {
          const domResult = await sendMessageWithRetry(tabId, {
            action: 'executeAction',
            tool: 'waitForDOMStable',
            params: {
              timeout: options.maxWait || strategy.maxWait,
              stableTime: options.stableTime || strategy.stableTime
            }
          });
          automationLogger.logTiming(null, 'WAIT', 'outcome_domStable', Date.now() - startTime, {
            outcomeType,
            stable: domResult?.result?.stable
          });
          return {
            waited: true,
            strategy: outcomeType,
            waitTime: Date.now() - startTime,
            method: 'domStable',
            result: domResult
          };
        } catch (err) {
          // Fallback to minimal delay if DOM wait fails
          await new Promise(r => setTimeout(r, 100));
          return {
            waited: true,
            strategy: outcomeType,
            waitTime: Date.now() - startTime,
            method: 'domStable-fallback',
            error: err.message
          };
        }

      case 'minimal':
        // Very short fixed delay for state changes
        await new Promise(r => setTimeout(r, strategy.delayMs));
        automationLogger.logTiming(null, 'WAIT', 'outcome_minimal', strategy.delayMs, { outcomeType });
        return {
          waited: true,
          strategy: outcomeType,
          waitTime: strategy.delayMs,
          method: 'minimal'
        };

      case 'none':
      default:
        // No delay needed
        automationLogger.logTiming(null, 'WAIT', 'outcome_none', 0, { outcomeType });
        return {
          waited: false,
          strategy: outcomeType,
          waitTime: 0,
          method: 'none'
        };
    }
  } catch (error) {
    automationLogger.warn('Outcome-based delay error, using fallback', {
      outcomeType,
      error: error.message
    });
    // Fallback: use a safe minimal delay
    await new Promise(r => setTimeout(r, 100));
    return {
      waited: true,
      strategy: outcomeType,
      waitTime: Date.now() - startTime,
      method: 'error-fallback',
      error: error.message
    };
  }
}

/**
 * SPEED-03: Deterministic action patterns that can be batched without AI roundtrips
 * These patterns represent predictable sequences where we know the outcome
 */
const DETERMINISTIC_PATTERNS = [
  {
    name: 'formFill',
    description: 'Multiple type actions to different form fields',
    detect: (actions) => {
      // All actions must be type operations
      if (!actions.every(a => a.tool === 'type')) return false;
      // Must target different selectors (filling different fields)
      const selectors = actions.map(a => a.params?.selector).filter(Boolean);
      return selectors.length === actions.length &&
             new Set(selectors).size === selectors.length;
    },
    optimize: true,
    minDelay: 50  // Minimal delay between batched typing actions
  },
  {
    name: 'clickType',
    description: 'Click input then type (focus + input pattern)',
    detect: (actions) => {
      // Click followed by type (clicking input then typing)
      return actions.length === 2 &&
             actions[0].tool === 'click' &&
             actions[1].tool === 'type';
    },
    optimize: true,
    minDelay: 100  // Small delay between click and type
  },
  {
    name: 'multiClick',
    description: 'Multiple clicks to different elements (checkbox selections)',
    detect: (actions) => {
      // All actions must be clicks
      if (!actions.every(a => a.tool === 'click')) return false;
      // Must target different selectors
      const selectors = actions.map(a => a.params?.selector).filter(Boolean);
      // Limit to 3 to avoid unexpected side effects
      return selectors.length === actions.length &&
             new Set(selectors).size === selectors.length &&
             actions.length <= 3;
    },
    optimize: true,
    minDelay: 100  // Between click actions
  }
];

/**
 * SPEED-03: Detect if an action sequence matches a deterministic pattern
 * @param {Array} actions - Array of actions to analyze
 * @returns {Object|null} Matching pattern or null
 */
function detectDeterministicPattern(actions) {
  if (!actions || actions.length < 1) return null;

  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (pattern.detect(actions)) {
      automationLogger.debug('Deterministic pattern detected', {
        pattern: pattern.name,
        actionCount: actions.length,
        tools: actions.map(a => a.tool)
      });
      return pattern;
    }
  }

  return null;
}

/**
 * SPEED-03: Execute a batch of actions matching a deterministic pattern
 * Skips AI roundtrips between actions, using minimal inter-action delays
 *
 * @param {Array} actions - Actions to execute
 * @param {Object} session - Current automation session
 * @param {number} tabId - Tab ID for action execution
 * @returns {Promise<Object|null>} Batch result or null if pattern not matched
 */
async function executeDeterministicBatch(actions, session, tabId) {
  const pattern = detectDeterministicPattern(actions);

  // If no pattern matched, return null (caller should execute normally)
  if (!pattern || !pattern.optimize) {
    return null;
  }

  const batchStartTime = Date.now();
  const results = [];

  automationLogger.info('Executing deterministic batch', {
    sessionId: session?.sessionId,
    pattern: pattern.name,
    actionCount: actions.length
  });

  try {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const actionStartTime = Date.now();

      // Execute the action
      const actionResult = await sendMessageWithRetry(tabId, {
        action: 'executeAction',
        tool: action.tool,
        params: action.params,
        visualContext: {
          taskName: session?.task?.substring(0, 50) || 'Automation',
          stepNumber: i + 1,
          totalSteps: actions.length,
          iterationCount: session?.iterationCount || 1,
          isBatchedAction: true,
          batchPattern: pattern.name
        }
      });

      results.push({
        action,
        result: actionResult,
        duration: Date.now() - actionStartTime
      });

      // Track in session action history
      if (session) {
        session.actionHistory.push({
          timestamp: Date.now(),
          tool: action.tool,
          params: action.params,
          result: actionResult,
          iteration: session.iterationCount,
          batched: true,
          batchPattern: pattern.name
        });
      }

      // Log action execution
      automationLogger.logTiming(
        session?.sessionId,
        'ACTION',
        `${action.tool}_batched`,
        Date.now() - actionStartTime,
        { success: actionResult?.success, batch: pattern.name }
      );

      // If action failed, break the batch (don't continue with remaining actions)
      if (!actionResult?.success) {
        automationLogger.warn('Batch action failed, breaking batch', {
          sessionId: session?.sessionId,
          pattern: pattern.name,
          actionIndex: i,
          tool: action.tool,
          error: actionResult?.error
        });
        break;
      }

      // Apply minimal delay between actions (except for last action)
      if (i < actions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, pattern.minDelay));
      }
    }

    const batchDuration = Date.now() - batchStartTime;
    const successCount = results.filter(r => r.result?.success).length;

    automationLogger.info('Deterministic batch complete', {
      sessionId: session?.sessionId,
      pattern: pattern.name,
      successCount,
      totalCount: actions.length,
      batchDuration,
      savedTime: `~${(actions.length - 1) * 1000}ms AI roundtrips avoided`
    });

    return {
      batched: true,
      pattern: pattern.name,
      results,
      count: actions.length,
      successCount,
      duration: batchDuration
    };
  } catch (error) {
    automationLogger.error('Deterministic batch execution error', {
      sessionId: session?.sessionId,
      pattern: pattern.name,
      error: error.message
    });

    // Return partial results if any completed
    return {
      batched: true,
      pattern: pattern.name,
      results,
      count: actions.length,
      successCount: results.filter(r => r.result?.success).length,
      duration: Date.now() - batchStartTime,
      error: error.message
    };
  }
}

// Helper function to create smart sequence signatures that group similar actions
function createSmartSequenceSignature(actions) {
  return actions.map(action => {
    // Normalize action signatures to group similar actions
    if (action.tool === 'type') {
      // Group typing actions by selector type, not exact text
      const selector = action.params?.selector || '';
      let selectorType = 'unknown';
      
      if (selector.includes('input')) selectorType = 'input';
      else if (selector.includes('textarea')) selectorType = 'textarea';
      else if (selector.includes('search')) selectorType = 'search';
      else if (selector.includes('email')) selectorType = 'email';
      else if (selector.includes('password')) selectorType = 'password';
      
      return `type:${selectorType}`;
    }
    
    if (action.tool === 'click') {
      // Group clicks by element type
      const selector = action.params?.selector || '';
      let elementType = 'unknown';
      
      if (selector.includes('button') || selector.includes('btn')) elementType = 'button';
      else if (selector.includes('link') || selector.includes('a[')) elementType = 'link';
      else if (selector.includes('submit')) elementType = 'submit';
      else if (selector.includes('form')) elementType = 'form';
      
      return `click:${elementType}`;
    }
    
    // For other actions, use a simplified signature
    return action.tool;
  }).join('->');
}

// Helper function to check if repetition is harmful
function checkHarmfulRepetition(actions, repeatCount, session) {
  // Don't flag as harmful if repeat count is low
  if (repeatCount <= 2) return false;
  
  // Check if the actions are making progress
  const hasProgressIndicators = actions.some(action => {
    // Actions that typically indicate progress
    return ['navigate', 'searchGoogle', 'refresh', 'solveCaptcha'].includes(action.tool) ||
           (action.tool === 'type' && action.params?.pressEnter) || // Form submissions
           (action.tool === 'click' && action.params?.selector?.includes('submit'));
  });
  
  // If actions include progress indicators, be less aggressive about flagging
  if (hasProgressIndicators && repeatCount <= 4) return false;
  
  // Check recent success rate
  const recentActions = session.actionHistory.slice(-10);
  const recentFailures = recentActions.filter(a => !a.result?.success).length;
  const failureRate = recentActions.length > 0 ? recentFailures / recentActions.length : 0;
  
  // If most actions are succeeding, don't flag as harmful even with repetition
  if (failureRate < 0.3 && repeatCount <= 5) return false;
  
  // Check if we're stuck on the same URL without making progress
  const urlHistory = session.urlHistory.slice(-3);
  const sameUrlCount = urlHistory.filter(entry => entry.url === session.lastUrl).length;
  
  // If we're repeating the same actions on the same URL multiple times, it's likely harmful
  if (sameUrlCount >= 2 && repeatCount >= 3) return true;
  
  // Default threshold - flag as harmful if repeated more than 4 times
  return repeatCount > 4;
}

// Helper function to create a more intelligent hash of DOM state
function createDOMHash(domState) {
  // Filter out elements that should not affect stuck detection
  const coreElements = (domState.elements || []).filter(el => {
    const classStr = String(el.class || '').toLowerCase();
    const idStr = String(el.id || '').toLowerCase();
    const textStr = String(el.text || '').toLowerCase();
    
    // Exclude common modal/overlay indicators
    const isModal = classStr.includes('modal') || classStr.includes('overlay') || 
                   classStr.includes('popup') || classStr.includes('dialog') ||
                   idStr.includes('modal') || idStr.includes('overlay') ||
                   classStr.includes('dropdown') || classStr.includes('menu');
    
    // Exclude elements that are typically transient
    const isTransient = classStr.includes('loading') || classStr.includes('spinner') ||
                       classStr.includes('toast') || classStr.includes('alert') ||
                       classStr.includes('notification') || classStr.includes('tooltip') ||
                       classStr.includes('progress') || classStr.includes('skeleton');
    
    // Exclude dynamic content that changes frequently
    const isDynamic = classStr.includes('timestamp') || classStr.includes('counter') ||
                     classStr.includes('badge') || classStr.includes('status') ||
                     textStr.includes('ago') || textStr.includes('now') ||
                     textStr.includes('online') || textStr.includes('offline');
    
    // Exclude animations and transitions
    const isAnimated = classStr.includes('animate') || classStr.includes('transition') ||
                      classStr.includes('fade') || classStr.includes('slide') ||
                      classStr.includes('bounce') || classStr.includes('pulse');
    
    // Exclude ads and tracking elements
    const isAd = classStr.includes('ad') || classStr.includes('advertisement') ||
                classStr.includes('promo') || classStr.includes('banner') ||
                idStr.includes('ad') || classStr.includes('google') ||
                classStr.includes('facebook') || classStr.includes('twitter');
    
    // Exclude temporary UI states
    const isTemporaryState = classStr.includes('hover') || classStr.includes('focus') ||
                            classStr.includes('active') || classStr.includes('selected') ||
                            classStr.includes('highlighted');
    
    return !isModal && !isTransient && !isDynamic && !isAnimated && !isAd && !isTemporaryState;
  });
  
  // Create a more meaningful key that represents the core page state
  // Focus on stable elements that indicate real page structure changes
  const stableElements = coreElements.filter(el => {
    // Only include elements that are likely to be stable page structure
    return ['button', 'input', 'select', 'textarea', 'form', 'nav', 'header', 'main', 'section'].includes(el.type) ||
           (el.id && el.id.length > 2) || // Elements with meaningful IDs
           (el.text && el.text.trim().length > 3 && el.text.length < 100); // Elements with meaningful text
  });
  
  const key = [
    domState.url,
    domState.title,
    stableElements.length,
    // Include key element identifiers to detect real changes
    stableElements.slice(0, 15).map(el => {
      const identifier = el.id || el.class?.split(' ')[0] || el.type;
      const text = el.text ? el.text.substring(0, 20) : '';
      return `${el.type}-${identifier}-${text}`;
    }).join(',')
  ].join('-');
  
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Handle multi-tab actions directly in background script
 * @param {Object} action - The action to execute
 * @param {number} currentTabId - The current tab ID for context
 * @returns {Promise<Object>} Action result
 */
async function handleMultiTabAction(action, currentTabId) {
  const { tool, params } = action;

  automationLogger.logActionExecution(null, tool, 'start', { params, currentTabId });

  return new Promise((resolve) => {
    const mockSender = { tab: { id: currentTabId } };
    const mockRequest = { ...params, action: tool };

    switch (tool) {
      case 'openNewTab':
        handleOpenNewTab(mockRequest, mockSender, resolve);
        break;

      case 'switchToTab':
        // SECURITY: Block switching away from the original session tab
        const switchRequest = { ...mockRequest };
        if (switchRequest.tabId && typeof switchRequest.tabId === 'string') {
          switchRequest.tabId = parseInt(switchRequest.tabId, 10);
        }

        // Find the session to check originalTabId
        const session = Array.from(activeSessions.values()).find(s => s.tabId === currentTabId);
        if (session && switchRequest.tabId !== session.originalTabId) {
          automationLogger.warn('Tab switch blocked', { sessionTabId: session.originalTabId, requestedTabId: switchRequest.tabId });
          resolve({
            success: false,
            error: `Security restriction: Automation is limited to the original tab (${session.originalTabId}). Cannot switch to tab ${switchRequest.tabId}.`,
            blocked: true
          });
          return;
        }

        automationLogger.debug('Tab switch allowed', { tabId: switchRequest.tabId });
        resolve({
          success: true,
          message: `Already on session tab ${switchRequest.tabId}`,
          tabId: switchRequest.tabId
        });
        break;

      case 'closeTab':
        // Fix: Convert string tabId to integer
        const closeRequest = { ...mockRequest };
        if (closeRequest.tabId && typeof closeRequest.tabId === 'string') {
          closeRequest.tabId = parseInt(closeRequest.tabId, 10);
        }
        handleCloseTab(closeRequest, mockSender, resolve);
        break;

      case 'listTabs':
        handleListTabs(mockRequest, mockSender, resolve);
        break;

      case 'waitForTabLoad':
        // Fix: Convert string tabId to integer, default to current tab if not specified
        const waitRequest = { ...mockRequest };
        if (waitRequest.tabId) {
          if (typeof waitRequest.tabId === 'string') {
            waitRequest.tabId = parseInt(waitRequest.tabId, 10);
          }
        } else {
          waitRequest.tabId = currentTabId;
        }
        handleWaitForTabLoad(waitRequest, mockSender, resolve);
        break;

      case 'getCurrentTab':
        handleGetCurrentTab(mockRequest, mockSender, resolve);
        break;

      default:
        automationLogger.error('Unknown multi-tab action', { tool });
        resolve({
          success: false,
          error: `Unknown multi-tab action: ${tool}`
        });
    }
  });
}

/**
 * Main automation loop that executes AI-generated actions iteratively
 * @param {string} sessionId - The unique session identifier
 * @returns {Promise<void>}
 */
async function startAutomationLoop(sessionId) {
  const session = activeSessions.get(sessionId);

  // RACE CONDITION FIX: Check if session is terminating before starting iteration
  if (isSessionTerminating(sessionId)) {
    automationLogger.debug('Session is terminating, exiting loop', { sessionId });
    return;
  }

  // Track the current loop iteration as a promise for cleanup coordination
  let loopResolve;
  session.loopPromise = new Promise(resolve => { loopResolve = resolve; });

  session.iterationCount++;

  // FSB TIMING: Track iteration start time
  const iterationStart = Date.now();

  // PART 3: Add cumulative session elapsed time
  const sessionElapsed = Date.now() - (session.startTime || Date.now());
  automationLogger.logTiming(sessionId, 'LOOP', 'iteration_start', 0, {
    iteration: session.iterationCount,
    sessionElapsedMs: sessionElapsed,
    sessionElapsedFormatted: formatDuration(sessionElapsed)
  });

  // Track iteration in performance metrics
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (sessionStats) {
    sessionStats.iterations = session.iterationCount;
  }

  // Log iteration with session elapsed context
  automationLogger.debug('Iteration start', {
    sessionId,
    iteration: session.iterationCount,
    sessionElapsedMs: sessionElapsed,
    sessionElapsedFormatted: formatDuration(sessionElapsed),
    stuckCounter: session.stuckCounter
  });
  automationLogger.logIteration(sessionId, session.iterationCount, session.lastDOMHash, session.stuckCounter);

  // Debug mode: Log iteration start
  debugLog('Iteration start', {
    sessionId,
    iterationCount: session.iterationCount,
    stuckCounter: session.stuckCounter
  });

  try {
    // SECURITY: Only inject content script into the original session tab
    if (session.tabId !== session.originalTabId) {
      throw new Error(`Security violation: Attempted to inject content script into unauthorized tab ${session.tabId}. Session is restricted to tab ${session.originalTabId}.`);
    }

    // Content script is now injected via manifest.json content_scripts
    // Verify it's responding with enhanced retry logic
    try {
      let healthOk = false;
      const maxHealthRetries = 5;
      const healthRetryDelay = 500;

      // PART 4: Track health check recovery timing
      const recoveryStart = Date.now();
      let wasReinjected = false;
      let healthCheckAttempts = 0;

      for (let attempt = 1; attempt <= maxHealthRetries; attempt++) {
        healthCheckAttempts = attempt;
        automationLogger.logComm(sessionId, 'health', 'healthCheck', true, { tabId: session.originalTabId, attempt, maxRetries: maxHealthRetries });
        healthOk = await checkContentScriptHealth(session.originalTabId);

        if (healthOk) {
          automationLogger.logComm(sessionId, 'health', 'healthCheck', true, { tabId: session.originalTabId, attempt, status: 'healthy' });
          break;
        }

        if (attempt < maxHealthRetries) {
          // Try re-injecting content script on later attempts
          if (attempt >= 3) {
            automationLogger.logRecovery(sessionId, 'health_fail', 're-inject', 'attempt', { tabId: session.originalTabId, attempt });
            try {
              await ensureContentScriptInjected(session.originalTabId);
              wasReinjected = true;
            } catch (e) {
              automationLogger.logRecovery(sessionId, 'health_fail', 're-inject', 'failed', { tabId: session.originalTabId, error: e.message });
            }
          }
          await new Promise(resolve => setTimeout(resolve, healthRetryDelay * attempt));
        }
      }

      if (!healthOk) {
        throw new Error('Content script not responding to health check after multiple attempts');
      }

      // PART 4: Log recovery duration if it took significant time
      const recoveryDuration = Date.now() - recoveryStart;
      if (recoveryDuration > 2000) {
        automationLogger.info('Health check recovery completed', {
          sessionId,
          recoveryDurationMs: recoveryDuration,
          recoveryDurationFormatted: formatDuration(recoveryDuration),
          attempts: healthCheckAttempts,
          method: wasReinjected ? 'content_script_reinjection' : 'retry'
        });
      }

      automationLogger.logComm(sessionId, 'health', 'verified', true, { tabId: session.originalTabId, recoveryDurationMs: recoveryDuration });
    } catch (healthError) {
      automationLogger.logComm(sessionId, 'health', 'healthCheck', false, { tabId: session.originalTabId, error: healthError.message });

      // Get tab URL for error message
      let tabUrl = 'unknown';
      try {
        const tab = await chrome.tabs.get(session.originalTabId);
        tabUrl = tab.url;
      } catch (e) {}

      // Send error to UI
      chrome.runtime.sendMessage({
        action: 'automationError',
        sessionId: sessionId,
        error: `Failed to communicate with the page (${tabUrl}). The content script may not have loaded yet. Try refreshing the page. Error: ${healthError.message}`
      }).catch(() => {});

      // Stop the session
      session.status = 'failed';
      cleanupSession(sessionId);
      return;
    }
    
    // Get current DOM state with enhanced error handling
    // SPEED-02: Check for pending prefetch first
    let domResponse;
    let usedPrefetch = false;
    try {
      // Get DOM optimization settings from storage with timeout to prevent hanging
      const settings = await getStorageWithTimeout(
        ['domOptimization', 'maxDOMElements', 'prioritizeViewport'],
        2000, // 2 second timeout
        { domOptimization: true, maxDOMElements: 2000, prioritizeViewport: true } // defaults
      );
      const domOptimizationEnabled = settings.domOptimization !== false;

      // FSB TIMING: Track DOM fetch time
      const domFetchStart = Date.now();

      // SPEED-02: Try to use pending prefetch if available
      if (pendingDOMPrefetch) {
        automationLogger.debug('Using pending DOM prefetch', { sessionId, iteration: session.iterationCount });
        try {
          domResponse = await pendingDOMPrefetch;
          usedPrefetch = true;
          if (domResponse && domResponse.success) {
            automationLogger.logTiming(sessionId, 'DOM', 'prefetch_consumed', Date.now() - domFetchStart, {
              tabId: session.tabId,
              source: 'prefetch'
            });
          } else {
            // Prefetch returned invalid response, fetch normally
            automationLogger.debug('Prefetch response invalid, fetching normally', { sessionId });
            domResponse = null;
          }
        } catch (prefetchErr) {
          // Prefetch failed, will fetch normally
          automationLogger.debug('Prefetch await failed, fetching normally', {
            sessionId,
            error: prefetchErr.message
          });
          domResponse = null;
        }
        pendingDOMPrefetch = null; // Clear regardless of success
      }

      // If no prefetch or prefetch failed, fetch normally
      if (!domResponse) {
        automationLogger.logDOMOperation(sessionId, 'request', {
          iteration: session.iterationCount,
          useIncrementalDiff: domOptimizationEnabled,
          maxElements: settings.maxDOMElements || 2000,
          prioritizeViewport: settings.prioritizeViewport !== false
        });

        const getDOMPayload = {
          action: 'getDOM',
          options: {
            useIncrementalDiff: domOptimizationEnabled,
            maxElements: settings.maxDOMElements || 2000,
            prioritizeViewport: settings.prioritizeViewport !== false
          }
        };

        // Log outgoing message for comprehensive session logging
        automationLogger.logContentMessage(sessionId, 'send', 'getDOM', getDOMPayload, null);

        domResponse = await sendMessageWithRetry(session.tabId, getDOMPayload);
        automationLogger.logTiming(sessionId, 'DOM', 'fetch', Date.now() - domFetchStart, {
          tabId: session.tabId,
          source: 'direct'
        });
      }

      // Log received DOM response
      automationLogger.logContentMessage(sessionId, 'receive', 'getDOM', null, {
        success: domResponse?.success,
        elementCount: domResponse?.structuredDOM?.elements?.length || 0
      });
    } catch (messageError) {
      // Check if this is a restricted URL error
      let tabInfo;
      try {
        tabInfo = await chrome.tabs.get(session.tabId);
      } catch (tabError) {
        throw new Error('Tab has been closed or is no longer accessible.');
      }
      
      if (isRestrictedURL(tabInfo.url)) {
        const pageType = getPageTypeDescription(tabInfo.url);
        throw new Error(`Cannot access ${pageType} (${tabInfo.url}). The page navigated to a restricted URL that extensions cannot automate. Please navigate to a regular website to continue automation.`);
      }
      
      // Other message sending errors
      throw new Error(`Failed to communicate with the page (${tabInfo.url}). This may happen if the page is still loading, has security restrictions, or the content script failed to load. Error: ${messageError.message}`);
    }
    
    // Check if DOM response is valid
    if (!domResponse || !domResponse.success || !domResponse.structuredDOM) {
      throw new Error('Failed to get DOM state from content script. Response: ' + JSON.stringify(domResponse));
    }
    
    // Log DOM response details
    const domData = domResponse.structuredDOM;
    automationLogger.logDOMOperation(sessionId, 'received', {
      isDelta: domData._isDelta || false,
      type: domData.type || 'full',
      payloadSize: JSON.stringify(domData).length,
      optimization: domData.optimization || {}
    });

    // Log DOM state for comprehensive session logging
    automationLogger.logDOMState(sessionId, domData, session.iterationCount);

    // Debug mode: Log DOM received
    debugLog('DOM received', {
      elementCount: domData?.elements?.length,
      url: domData?.url
    });

    // Create hash of current DOM state
    const currentDOMHash = createDOMHash(domResponse.structuredDOM);
    const currentUrl = domResponse.structuredDOM.url;
    
    // Track URL changes
    let urlChanged = false;
    if (session.lastUrl) {
      urlChanged = currentUrl !== session.lastUrl;
      if (urlChanged) {
        session.urlHistory.push({
          url: currentUrl,
          timestamp: Date.now(),
          iteration: session.iterationCount
        });
        automationLogger.logNavigation(sessionId, 'change', session.lastUrl, currentUrl, { iteration: session.iterationCount });
      }
    }
    session.lastUrl = currentUrl;
    
    // Check if DOM has changed since last iteration
    let domChanged = true;
    if (session.lastDOMHash) {
      domChanged = currentDOMHash !== session.lastDOMHash;
      if (!domChanged && !urlChanged) {
        // Smart stuck detection - consider recent action types
        const recentActions = session.actionHistory.slice(-3);
        const isTypingSequence = recentActions.length > 0 && 
          recentActions.every(action => ['type', 'clearInput', 'selectText', 'focus', 'blur', 'pressEnter', 'keyPress'].includes(action.tool));
        
        // Don't increment stuck counter for typing sequences unless they're problematic
        if (isTypingSequence) {
          // Check if it's the same typing action repeated
          const lastAction = recentActions[recentActions.length - 1];
          const sameTypeRepeats = recentActions.filter(action =>
            action.tool === lastAction?.tool &&
            JSON.stringify(action.params) === JSON.stringify(lastAction?.params)
          ).length;

          // ENHANCED: Also check if ALL recent type actions are failing
          // This catches the case where form filling types to different fields but all fail
          const recentTypeActions = session.actionHistory.slice(-5).filter(a => a.tool === 'type');
          const allTypingFailed = recentTypeActions.length >= 3 &&
                                  recentTypeActions.every(a => !a.result?.success);

          // ENHANCED: Check if clicking same area repeatedly (might be trying to activate inputs)
          const recentClicks = session.actionHistory.slice(-5).filter(a => a.tool === 'click');
          const clicksNearSameArea = recentClicks.length >= 3 && areClicksNearby(recentClicks);

          if (sameTypeRepeats >= 2) {
            session.stuckCounter++;
            automationLogger.debug('Stuck: Repetitive typing detected', { sessionId, stuckCounter: session.stuckCounter });
          } else if (allTypingFailed) {
            session.stuckCounter++;
            automationLogger.debug('Stuck: All recent type actions failed', { sessionId, stuckCounter: session.stuckCounter });
          } else if (clicksNearSameArea) {
            session.stuckCounter++;
            automationLogger.debug('Stuck: Clicking same area repeatedly', { sessionId, stuckCounter: session.stuckCounter });
          } else {
            automationLogger.debug('Typing sequence in progress - not counting as stuck', { sessionId });
          }
        } else {
          session.stuckCounter++;
          automationLogger.debug('Stuck: DOM and URL unchanged', { sessionId, stuckCounter: session.stuckCounter });
        }
        
        if (session.stuckCounter > 0) {
          automationLogger.logStuckDetection(sessionId, session.stuckCounter, session.actionHistory);
        }
      } else {
        session.stuckCounter = 0; // Reset counter on change
      }
    }
    session.lastDOMHash = currentDOMHash;
    
    // Log iteration details
    automationLogger.logIteration(sessionId, session.iterationCount, currentDOMHash, session.stuckCounter);
    
    // Store state history
    session.stateHistory.push({
      timestamp: Date.now(),
      url: domResponse.structuredDOM.url,
      domHash: currentDOMHash,
      elementCount: domResponse.structuredDOM.elements?.length || 0
    });
    
    // Enhanced stuck detection with pattern recognition
    const stuckPatterns = analyzeStuckPatterns(session);
    const isStuck = session.stuckCounter >= 3 || stuckPatterns.severity === 'high';
    
    // Generate recovery strategies if stuck
    let recoveryStrategies = [];
    if (isStuck) {
      recoveryStrategies = generateRecoveryStrategies(stuckPatterns, session);
      automationLogger.logRecovery(sessionId, 'stuck_detected', 'analyze', 'attempt', { patterns: stuckPatterns, strategies: recoveryStrategies.length });
    }
    
    // Get settings for AI call using config
    const settings = await config.getAll();
    
    // Detect repeated action failures
    const repeatedFailures = detectRepeatedActionFailures(session);
    const forceAlternativeStrategy = repeatedFailures.length > 0;
    
    // Gather multi-tab context
    let tabInfo = null;
    try {
      // Get all tabs in current window
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      // Get tabs that have active sessions
      const sessionTabs = Array.from(activeSessions.values()).map(s => s.tabId);
      
      tabInfo = {
        currentTabId: session.tabId,
        allTabs: allTabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          status: tab.status
        })),
        sessionTabs: sessionTabs
      };
    } catch (error) {
      automationLogger.debug('Failed to gather tab context', { sessionId, error: error.message });
    }
    
    // Calculate progress metrics for AI context
    const maxIterations = session.maxIterations || 20;
    const actionsSucceeded = session.actionHistory?.filter(a => a.result?.success).length || 0;
    const actionsFailed = session.actionHistory?.filter(a => !a.result?.success).length || 0;
    const uniquePagesVisited = new Set(session.urlHistory?.map(u => u.url) || []).size;

    // Estimate task completion based on various signals
    const estimateTaskCompletion = () => {
      // If we're on a success page, likely near completion
      if (domResponse.structuredDOM.pageContext?.pageState?.hasSuccess) return 0.9;

      // If stuck, progress is questionable
      if (isStuck) return Math.min(0.5, session.iterationCount / maxIterations);

      // If we've done significant actions without failure, good progress
      const successRate = actionsSucceeded / Math.max(1, actionsSucceeded + actionsFailed);
      const iterationProgress = session.iterationCount / maxIterations;

      // Weighted estimate
      return Math.min(0.95, (successRate * 0.4) + (iterationProgress * 0.6));
    };

    // Progress tracking context for AI
    const progressContext = {
      iterationsUsed: session.iterationCount,
      maxIterations: maxIterations,
      progressPercent: Math.round((session.iterationCount / maxIterations) * 100),
      actionsSucceeded: actionsSucceeded,
      actionsFailed: actionsFailed,
      successRate: actionsSucceeded / Math.max(1, actionsSucceeded + actionsFailed),
      uniquePagesVisited: uniquePagesVisited,
      stuckDuration: session.stuckCounter,
      estimatedCompletion: estimateTaskCompletion(),
      // Time tracking
      elapsedTime: Date.now() - (session.startTime || Date.now()),
      // Momentum indicator
      momentum: actionsFailed === 0 ? 'good' : (actionsFailed <= 2 ? 'moderate' : 'struggling')
    };

    // Prepare context with action history and task plan
    const context = {
      sessionId: sessionId, // Include sessionId for comprehensive logging
      actionHistory: session.actionHistory.slice(-10), // Last 10 actions
      isStuck,
      stuckCounter: session.stuckCounter,
      domChanged,
      urlChanged,
      failedAttempts: session.failedAttempts,
      failedActionDetails: repeatedFailures, // Specific actions that keep failing
      forceAlternativeStrategy, // Flag to force AI to try different approach
      iterationCount: session.iterationCount,
      urlHistory: session.urlHistory.slice(-5), // Last 5 URL changes
      currentUrl: currentUrl,
      // NEW: Progress tracking for AI awareness
      progress: progressContext,
      // Add sequence repetition info
      repeatedSequences: Object.entries(session.sequenceRepeatCount)
        .filter(([_, count]) => count > 2)
        .map(([signature, count]) => ({ signature, count })),
      lastSequences: session.actionSequences.slice(-3), // Last 3 action sequences
      // Add multi-tab context
      tabInfo: tabInfo
    };

    // Check for intermediate/redirect pages that should be allowed to resolve
    // Note: With frameId: 0 targeting, we now get DOM from main frame only,
    // so this only triggers when the main page itself is an intermediate page
    const intermediatePagePatterns = [
      /accounts\.google\.com\/RotateCookiesPage/i,
      /accounts\.google\.com\/ServiceLogin/i,
      /consent\.google\.com/i,
      /accounts\.google\.com\/signin\/oauth/i,
      /login\.microsoftonline\.com\/common\/oauth2/i,
      /www\.google\.com\/url\?/i  // Google redirect URLs
    ];

    const isIntermediatePage = intermediatePagePatterns.some(pattern => pattern.test(currentUrl));

    if (isIntermediatePage) {
      automationLogger.logNavigation(sessionId, 'intermediate', currentUrl, null, { waiting: true });

      // Wait for page to be ready using event-driven detection instead of hardcoded 1500ms
      const loadResult = await pageLoadWatcher.waitForPageReady(session.tabId, {
        maxWait: 3000,
        requireDOMStable: true,
        stableTime: 300
      });
      automationLogger.logTiming(sessionId, 'WAIT', 'intermediate_page', loadResult.waitTime, { method: loadResult.method });

      // Check if URL changed after waiting
      let newTabInfo;
      try {
        newTabInfo = await chrome.tabs.get(session.tabId);
      } catch (e) {
        // Tab closed, let normal error handling deal with it
      }

      if (newTabInfo && newTabInfo.url !== currentUrl) {
        automationLogger.logNavigation(sessionId, 'redirect', currentUrl, newTabInfo.url, {});

        // Reset state for the new page
        session.lastUrl = newTabInfo.url;
        session.lastDOMHash = null;
        session.stuckCounter = 0;

        // Continue to next iteration with the new page
        session.pendingTimeout = setTimeout(() => {
          session.pendingTimeout = null;
          startAutomationLoop(sessionId);
        }, 300);
        return;
      }

      // If still on intermediate page after waiting, add context for AI
      context.isIntermediatePage = true;
      context.intermediatePageNote = 'This appears to be an intermediate/authentication page. Wait for it to redirect or look for a continue/proceed button.';
      automationLogger.debug('Still on intermediate page, continuing with AI', { sessionId, url: currentUrl });
    }

    // Call AI to get next actions with context
    // SPEED-02: Start AI call and DOM prefetch in parallel
    // The prefetch will be ready for the NEXT iteration while we process this one

    // Debug mode: Log AI call start
    debugLog('Sending to AI', {
      model: settings.modelName,
      provider: settings.modelProvider,
      isStuck: context.isStuck
    });

    const aiPromise = callAIAPI(
      session.task,
      domResponse.structuredDOM,
      settings,
      context
    );

    // Start prefetching DOM for next iteration while AI processes
    // Key: prefetch starts AFTER AI call begins, so DOM reflects current state changes
    pendingDOMPrefetch = prefetchDOM(session.tabId, {
      maxElements: settings.maxDOMElements || 2000,
      prioritizeViewport: settings.prioritizeViewport !== false
    });

    // Now await the AI response
    const aiResponse = await aiPromise;

    // Log AI response
    // automationLogger.logAIResponse(sessionId, aiResponse.reasoning, aiResponse.actions, aiResponse.taskComplete);
    automationLogger.logAIResponse(sessionId, '', aiResponse.actions, aiResponse.taskComplete); // Reasoning disabled for performance

    // Debug mode: Log AI response received
    debugLog('AI response received', {
      hasActions: !!aiResponse?.actions?.length,
      actionCount: aiResponse?.actions?.length || 0,
      taskComplete: aiResponse?.taskComplete
    });

    // CRITICAL FIX: Handle failedDueToError flag - stop automation and report failure properly
    if (aiResponse.failedDueToError) {
      session.status = 'failed';
      const duration = Date.now() - session.startTime;

      automationLogger.logSessionEnd(sessionId, 'failed', session.actionHistory.length, duration);
      automationLogger.error('Task failed due to API error', { sessionId, result: aiResponse.result });

      // Save session logs for history
      automationLogger.saveSession(sessionId, session);

      finalizeSessionMetrics(sessionId, false); // Failed
      cleanupSession(sessionId);

      // Notify UI of failure
      chrome.runtime.sendMessage({
        action: 'automationFailed',
        sessionId,
        error: aiResponse.result || 'Unknown API error',
        message: aiResponse.currentStep || 'Automation stopped due to error'
      }).catch(() => {});

      return; // Stop automation loop
    }

    // Send dynamic status update to UI
    if (aiResponse.currentStep) {
      chrome.runtime.sendMessage({
        action: 'statusUpdate',
        sessionId,
        message: aiResponse.currentStep
      }).catch(() => {
        // Ignore errors if no listeners
      });
    }

    // Execute actions and track results
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      // Create a smart signature for this action sequence
      const sequenceSignature = createSmartSequenceSignature(aiResponse.actions);
      
      // Track sequence repetition with context awareness
      const sequenceKey = `${sequenceSignature}:${domResponse.structuredDOM.url}`;
      if (!session.sequenceRepeatCount[sequenceKey]) {
        session.sequenceRepeatCount[sequenceKey] = 0;
      }
      session.sequenceRepeatCount[sequenceKey]++;
      
      // Check if this sequence has been repeated too many times
      const sequenceRepeats = session.sequenceRepeatCount[sequenceKey];
      const isHarmfulRepetition = checkHarmfulRepetition(aiResponse.actions, sequenceRepeats, session);
      
      if (isHarmfulRepetition) {
        automationLogger.warn('Harmful action sequence repetition', { sessionId, repeats: sequenceRepeats, signature: sequenceSignature });
        session.stuckCounter = Math.max(session.stuckCounter, 2); // Increase stuck counter but not too aggressively
      }
      
      // Add to sequence history
      session.actionSequences.push({
        signature: sequenceSignature,
        actions: aiResponse.actions,
        iteration: session.iterationCount,
        repeatCount: sequenceRepeats
      });

      // SPEED-03: Try deterministic batch execution for recognized patterns
      // This skips AI roundtrips between actions for predictable sequences
      let batchExecuted = false;
      if (aiResponse.actions.length > 1) {
        const batchResult = await executeDeterministicBatch(aiResponse.actions, session, session.tabId);
        if (batchResult) {
          batchExecuted = true;
          automationLogger.info('Deterministic batch completed', {
            sessionId,
            pattern: batchResult.pattern,
            successCount: batchResult.successCount,
            totalCount: batchResult.count,
            duration: batchResult.duration
          });

          // Clear stale prefetch since batch may have changed DOM significantly
          // Start fresh prefetch for next iteration
          if (batchResult.successCount > 0) {
            pendingDOMPrefetch = null;
            pendingDOMPrefetch = prefetchDOM(session.tabId, {
              maxElements: settings.maxDOMElements || 2000,
              prioritizeViewport: settings.prioritizeViewport !== false
            });
          }
        }
      }

      // Skip individual action loop if batch was executed
      if (!batchExecuted) {
      for (let i = 0; i < aiResponse.actions.length; i++) {
        const action = aiResponse.actions[i];
        const nextAction = aiResponse.actions[i + 1];

        automationLogger.logActionExecution(sessionId, action.tool, 'start', { index: i + 1, total: aiResponse.actions.length, params: action.params });
        const actionStartTime = Date.now();

        // Debug mode: Log action execution
        debugLog('Executing action', {
          tool: action.tool,
          index: i + 1,
          total: aiResponse.actions.length
        });

        // Send action-specific status update to UI
        if (action.description) {
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            sessionId,
            message: action.description
          }).catch(() => {
            // Ignore errors if no listeners
          });
        }
        
        let actionResult;
        
        // Multi-tab actions should be handled directly by background script
        const multiTabActions = ['openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'waitForTabLoad', 'getCurrentTab'];
        
        if (multiTabActions.includes(action.tool)) {
          // Handle multi-tab actions directly in background script
          automationLogger.logActionExecution(sessionId, action.tool, 'routing', { handler: 'background' });
          try {
            actionResult = await handleMultiTabAction(action, session.tabId);
            automationLogger.logActionExecution(sessionId, action.tool, 'complete', { success: actionResult?.success });
          } catch (error) {
            automationLogger.logActionExecution(sessionId, action.tool, 'complete', { success: false, error: error.message });
            actionResult = {
              success: false,
              error: `Multi-tab action failed: ${error.message}`,
              tool: action.tool
            };
          }
        } else {
          // Send regular DOM actions to content script
          try {
            const actionPayload = {
              action: 'executeAction',
              tool: action.tool,
              params: action.params,
              visualContext: {
                taskName: session.task?.substring(0, 50) || 'Automation',
                stepNumber: i + 1,
                totalSteps: aiResponse.actions.length,
                iterationCount: session.iterationCount
              }
            };

            // Log outgoing action message for comprehensive session logging (includes visualContext)
            automationLogger.logContentMessage(sessionId, 'send', 'executeAction', actionPayload, null);

            actionResult = await sendMessageWithRetry(session.tabId, actionPayload);

            // Log action result received
            automationLogger.logContentMessage(sessionId, 'receive', 'executeAction', { tool: action.tool }, actionResult);
          } catch (messageError) {
            // Check if this is a restricted URL error during action execution
            let tabInfo;
            try {
              tabInfo = await chrome.tabs.get(session.tabId);
              if (isRestrictedURL(tabInfo.url)) {
                const pageType = getPageTypeDescription(tabInfo.url);
                throw new Error(`Cannot execute action on ${pageType} (${tabInfo.url}). The page navigated to a restricted URL during automation.`);
              }
            } catch (tabError) {
              throw new Error('Tab was closed or became inaccessible during action execution.');
            }
            
            // For other errors, provide a failure result with classification
            const failureType = classifyFailure(messageError, action);
            actionResult = {
              success: false,
              error: `Failed to execute ${action.tool}: ${messageError.message || messageError}`,
              tool: action.tool,
              failureType,
              retryable: failureType !== FAILURE_TYPES.PERMISSION
            };
          }
        }
        
        // FSB TIMING: Log action execution time
        automationLogger.logTiming(sessionId, 'ACTION', action.tool, Date.now() - actionStartTime, { success: actionResult?.success });

        // Track action in history
        const actionRecord = {
          timestamp: Date.now(),
          tool: action.tool,
          params: action.params,
          result: actionResult,
          iteration: session.iterationCount
        };
        session.actionHistory.push(actionRecord);

        // Log action result
        automationLogger.logAction(sessionId, action, actionResult);
        
        // Ensure actionResult has proper structure
        if (!actionResult) {
          actionResult = {
            success: false,
            error: 'Action returned no result - possible content script communication failure',
            tool: action.tool,
            failureType: FAILURE_TYPES.COMMUNICATION,
            retryable: true
          };
        }
        
        // Track failures and verification issues
        if (!actionResult.success) {
          // Track by tool type (existing)
          if (!session.failedAttempts[action.tool]) {
            session.failedAttempts[action.tool] = 0;
          }
          session.failedAttempts[action.tool]++;
          
          // Track detailed failures by action signature
          const actionSignature = createActionSignature(action);
          if (!session.failedActionDetails[actionSignature]) {
            session.failedActionDetails[actionSignature] = {
              tool: action.tool,
              params: action.params,
              count: 0,
              errors: [],
              firstFailure: Date.now(),
              lastFailure: null
            };
          }
          
          session.failedActionDetails[actionSignature].count++;
          session.failedActionDetails[actionSignature].lastFailure = Date.now();
          const errorMessage = actionResult.error || 'Unknown error - no error details provided';
          session.failedActionDetails[actionSignature].errors.push({
            error: errorMessage,
            timestamp: Date.now(),
            iteration: session.iterationCount
          });
          
          // Keep only last 3 errors to avoid memory bloat
          if (session.failedActionDetails[actionSignature].errors.length > 3) {
            session.failedActionDetails[actionSignature].errors.shift();
          }
          
          automationLogger.logActionExecution(sessionId, action.tool, 'complete', { success: false, error: errorMessage, failureCount: session.failedActionDetails[actionSignature].count });
          
          // Try alternative actions for critical failures
          if (actionResult.retryable && actionResult.failureType !== FAILURE_TYPES.PERMISSION) {
            automationLogger.logRecovery(sessionId, 'action_fail', 'alternative', 'attempt', { tool: action.tool });
            const alternativeResult = await tryAlternativeAction(sessionId, action, actionResult);

            if (alternativeResult && alternativeResult.success) {
              automationLogger.logRecovery(sessionId, 'action_fail', 'alternative', 'success', { tool: action.tool, alternative: alternativeResult.alternativeUsed });
              actionResult = alternativeResult;
              
              // Log the successful alternative
              automationLogger.logAction(sessionId, {
                ...action,
                description: `${action.description} (Alternative: ${alternativeResult.alternativeUsed})`
              }, alternativeResult);
              
              // Track alternative action usage
              trackActionPerformance(sessionId, action, actionResult, actionStartTime, true);
            } else {
              // Track failed action
              trackActionPerformance(sessionId, action, actionResult, actionStartTime, false);
            }
          } else {
            // Track failed action
            trackActionPerformance(sessionId, action, actionResult, actionStartTime, false);
          }
        } else {
          // Track successful action
          trackActionPerformance(sessionId, action, actionResult, actionStartTime, false);
          
          // Check for verification warnings
          if (actionResult.success && (actionResult.warning || actionResult.hadEffect === false || actionResult.validationPassed === false)) {
            automationLogger.logValidation(sessionId, 'action_effect', false, {
              tool: action.tool,
              selector: action.params?.selector,
              warning: actionResult.warning,
              hadEffect: actionResult.hadEffect,
              validationPassed: actionResult.validationPassed
            });
            
            // Track actions that succeeded but had no effect
            if (!session.noEffectActions) {
              session.noEffectActions = [];
            }
            
            session.noEffectActions.push({
              tool: action.tool,
              params: action.params,
              warning: actionResult.warning || 'Action completed but verification failed',
              iteration: session.iterationCount,
              timestamp: Date.now()
            });
            
            // If too many no-effect actions, increase stuck counter
            const recentNoEffectCount = session.noEffectActions.filter(a => 
              Date.now() - a.timestamp < 30000 // Last 30 seconds
            ).length;
            
            if (recentNoEffectCount >= 3) {
              session.stuckCounter++;
              automationLogger.debug('Multiple no-effect actions detected', { sessionId, stuckCounter: session.stuckCounter, noEffectCount: recentNoEffectCount });
            }
          }
        }
        
        // SPEED-01: Outcome-based delay calculation
        // Only add delay if not the last action in this batch
        if (i < aiResponse.actions.length - 1) {
          const nextAction = aiResponse.actions[i + 1];

          // Try to detect action outcome for smart waiting
          let outcomeType = 'noChange'; // Default to no change

          try {
            // Check if actionResult already has verification with pre/post state
            if (actionResult?.verification?.preState && actionResult?.verification?.postState) {
              // Use verification data already captured by the action handler
              const outcome = await sendMessageWithRetry(session.tabId, {
                action: 'detectActionOutcome',
                preState: actionResult.verification.preState,
                postState: actionResult.verification.postState,
                actionResult: actionResult
              });

              if (outcome?.type) {
                outcomeType = outcome.type;
                automationLogger.debug('Outcome detected from verification', {
                  sessionId,
                  tool: action.tool,
                  outcomeType,
                  confidence: outcome.confidence
                });
              }
            } else {
              // For actions without built-in verification, capture current state and compare
              // Get current page state as a proxy for post-action state
              const postState = await sendMessageWithRetry(session.tabId, {
                action: 'capturePageState'
              });

              // Infer outcome based on action type and result
              if (actionResult?.success) {
                if (['navigate', 'searchGoogle', 'goBack', 'goForward'].includes(action.tool)) {
                  outcomeType = 'navigation';
                } else if (['click', 'type', 'pressEnter', 'submit'].includes(action.tool)) {
                  // Check if there was a URL change or DOM change indication
                  if (postState?.urlChanged || actionResult?.urlChanged) {
                    outcomeType = 'navigation';
                  } else if (actionResult?.hadEffect) {
                    outcomeType = 'minorDOMChange';
                  } else {
                    // Check for loading indicators
                    const loadingCheck = await sendMessageWithRetry(session.tabId, {
                      action: 'executeAction',
                      tool: 'detectLoadingState',
                      params: {}
                    });
                    if (loadingCheck?.success && loadingCheck?.result?.loading) {
                      outcomeType = 'network';
                    }
                  }
                } else if (['getText', 'getAttribute', 'hover', 'moveMouse', 'focus'].includes(action.tool)) {
                  // Read-only actions - no change expected
                  outcomeType = 'noChange';
                }
              }

              automationLogger.debug('Outcome inferred from action type', {
                sessionId,
                tool: action.tool,
                outcomeType,
                hadEffect: actionResult?.hadEffect
              });
            }
          } catch (outcomeError) {
            // If outcome detection fails, fall back to category-based delay
            automationLogger.debug('Outcome detection failed, using fallback', {
              sessionId,
              error: outcomeError.message
            });

            // Fallback: use calculateActionDelay for unknown situations
            const fallbackDelay = Math.min(calculateActionDelay(action, nextAction), 500);
            automationLogger.logTiming(sessionId, 'WAIT', 'outcome_fallback', fallbackDelay, { tool: action.tool });
            await new Promise(resolve => setTimeout(resolve, fallbackDelay));
            continue; // Skip outcome-based delay
          }

          // Apply outcome-based delay
          const delayResult = await outcomeBasedDelay(session.tabId, outcomeType);
          automationLogger.debug('Applied outcome-based delay', {
            sessionId,
            outcomeType,
            waitTime: delayResult.waitTime,
            method: delayResult.method
          });
        }
      }
      } // End of if (!batchExecuted)
    }

    // === PROGRESS TRACKING: Determine if this iteration made meaningful progress ===
    // This counter does NOT reset on URL changes like stuckCounter does
    const iterationActions = session.actionHistory.filter(a => a.iteration === session.iterationCount);
    const iterationStats = {
      actionsSucceeded: iterationActions.filter(a => a.result?.success).length,
      actionsFailed: iterationActions.filter(a => !a.result?.success).length,
      domChanged: session.lastDOMHash !== null && createDOMHash(domResponse.structuredDOM) !== session.lastDOMHash,
      urlChanged: currentUrl !== session.lastUrl,
      newDataExtracted: iterationActions.some(a =>
        a.tool === 'getText' && a.result?.success && a.result?.value && a.result.value.trim().length > 0
      ),
      hadEffect: iterationActions.some(a => a.result?.hadEffect === true)
    };

    // Meaningful progress: DOM changed with successful actions, or URL changed, or new data extracted
    const madeProgress = (
      (iterationStats.domChanged && iterationStats.actionsSucceeded > 0) ||
      iterationStats.urlChanged ||
      iterationStats.newDataExtracted ||
      iterationStats.hadEffect
    );

    if (madeProgress) {
      session.consecutiveNoProgressCount = 0;
      automationLogger.debug('Progress made this iteration', {
        sessionId,
        consecutiveNoProgressCount: session.consecutiveNoProgressCount,
        stats: iterationStats
      });
    } else if (iterationStats.actionsFailed > 0 || !iterationStats.domChanged) {
      session.consecutiveNoProgressCount++;
      automationLogger.debug('No meaningful progress this iteration', {
        sessionId,
        consecutiveNoProgressCount: session.consecutiveNoProgressCount,
        stats: iterationStats
      });
    }

    // === HARD STOP: No progress for 6 consecutive iterations ===
    if (session.consecutiveNoProgressCount >= 6) {
      automationLogger.warn('No progress detected for 6 consecutive iterations', {
        sessionId,
        consecutiveNoProgressCount: session.consecutiveNoProgressCount,
        iterationCount: session.iterationCount,
        lastIterationStats: iterationStats
      });
      session.status = 'no_progress';

      // Provide a helpful summary of what was accomplished
      let finalResult = 'Automation stopped after 6 consecutive iterations without meaningful progress. ';

      // Check for any extracted text from recent actions
      const recentTextActions = session.actionHistory
        .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
        .slice(-5);

      if (recentTextActions.length > 0) {
        const extractedTexts = recentTextActions.map(action => action.result.value).filter(text => text && text.trim());
        if (extractedTexts.length > 0) {
          finalResult += `Here's what I found: ${extractedTexts.join(', ')}. `;
        }
      }

      // Add information about successful actions
      const successfulActions = session.actionHistory.filter(a => a.result?.success);
      if (successfulActions.length > 0) {
        const uniqueSuccessActions = [...new Set(successfulActions.map(a => a.tool))];
        finalResult += `Actions completed: ${uniqueSuccessActions.join(', ')}. `;
      }

      // Add current URL if navigated
      if (session.urlHistory.length > 1) {
        finalResult += `Currently on: ${session.lastUrl}. `;
      }

      finalResult += 'The automation may be stuck in a loop or unable to interact with the page effectively.';

      automationLogger.logSessionEnd(sessionId, 'no_progress', session.actionHistory.length, Date.now() - session.startTime);
      automationLogger.saveSession(sessionId, session);

      finalizeSessionMetrics(sessionId, false);
      cleanupSession(sessionId);

      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: finalResult,
        partial: true,
        reason: 'no_progress'
      });

      return;
    }

    // Smart stuck detection with early exit for repeated success
    // Check for repeated success earlier (at 4 iterations) to avoid unnecessary loops
    if (session.stuckCounter >= 4) {
      const repeatedResult = detectRepeatedSuccess(session);
      if (repeatedResult) {
        automationLogger.info('Found repeated valid result', { sessionId, stuckCounter: session.stuckCounter, result: repeatedResult.substring(0, 100) });
        // Complete the task with the repeated result
        session.status = 'completed';
        const duration = Date.now() - session.startTime;
        automationLogger.logSessionEnd(sessionId, 'completed', session.actionHistory.length, duration);

        // Save session logs for history
        automationLogger.saveSession(sessionId, session);

        // Send success message via runtime message
        chrome.runtime.sendMessage({
          action: 'automationComplete',
          sessionId,
          result: repeatedResult,
          navigatedTo: currentUrl
        });

        // Clean up session
        finalizeSessionMetrics(sessionId, true); // Successfully completed
        cleanupSession(sessionId); // EASY WIN #10: Use cleanup helper
        return;
      }
    }

    // Check if we're stuck in a loop after more iterations
    if (session.stuckCounter >= 8) {

      automationLogger.error('Automation appears stuck', { sessionId, stuckCounter: session.stuckCounter });
      session.status = 'stuck';
      
      // Provide a detailed summary of what was accomplished before getting stuck
      let finalResult = 'I attempted to complete your task but encountered repeated difficulties. ';
      
      // Check if we have any extracted text from recent actions
      const recentTextActions = session.actionHistory
        .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
        .slice(-5); // Last 5 getText results
      
      if (recentTextActions.length > 0) {
        // We found some text, include it in the result
        const extractedTexts = recentTextActions.map(action => action.result.value).filter(text => text && text.trim());
        if (extractedTexts.length > 0) {
          finalResult += `Here's what I was able to extract: ${extractedTexts.join(', ')}. `;
        }
      }
      
      // Add information about successful actions
      const successfulActions = session.actionHistory.filter(a => a.result?.success);
      const failedActions = session.actionHistory.filter(a => !a.result?.success);
      
      if (successfulActions.length > 0) {
        const uniqueSuccessActions = [...new Set(successfulActions.map(a => a.tool))];
        finalResult += `Successfully completed: ${uniqueSuccessActions.join(', ')}. `;
      }
      
      if (failedActions.length > 0) {
        const uniqueFailedActions = [...new Set(failedActions.map(a => a.tool))];
        finalResult += `Had trouble with: ${uniqueFailedActions.join(', ')}. `;
      }
      
      // Add current URL if changed from start
      if (session.urlHistory.length > 1) {
        finalResult += `Currently on: ${session.lastUrl}. `;
      }
      
      finalResult += 'You may want to try rephrasing your request or breaking it into smaller steps.';

      automationLogger.logSessionEnd(sessionId, 'stuck', session.actionHistory.length, Date.now() - session.startTime);

      // Save session logs for history
      automationLogger.saveSession(sessionId, session);

      finalizeSessionMetrics(sessionId, false); // Failed due to stuck loop
      cleanupSession(sessionId); // EASY WIN #10: Use cleanup helper

      // Send completion with partial results instead of error
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: finalResult,
        partial: true
      });

      return;
    }
    
    // COMPLETION VALIDATION: Ensure AI provides meaningful results AND critical actions succeeded
    if (aiResponse.taskComplete) {
      // Check for meaningful result
      if (!aiResponse.result || aiResponse.result.trim().length < 10) {
        automationLogger.warn('Completion blocked - AI must provide result summary', { sessionId });
        aiResponse.taskComplete = false; // Override the AI's decision
      } else {
        // Check for recent critical action failures
        const criticalActions = ['type', 'click'];
        const recentActions = session.actionHistory.slice(-10); // Last 10 actions
        const recentCriticalFailures = recentActions.filter(action => 
          criticalActions.includes(action.tool) && !action.result?.success
        );
        
        // Enhanced messaging task completion validation
        const isMessagingTask = session.task.toLowerCase().includes('message') || 
                               session.task.toLowerCase().includes('send') ||
                               session.task.toLowerCase().includes('text') ||
                               session.task.toLowerCase().includes('chat') ||
                               session.task.toLowerCase().includes('reply') ||
                               session.task.toLowerCase().includes('comment');
        
        // For messaging tasks, check if message was actually sent
        if (isMessagingTask && recentCriticalFailures.length > 0) {
          const typeFailures = recentCriticalFailures.filter(action => action.tool === 'type');
          const clickSuccesses = recentActions.filter(action => 
            action.tool === 'click' && action.result?.success
          );
          
          // Allow completion if:
          // 1. Type failed but there were successful clicks (might have sent empty/existing message)
          // 2. Multiple attempts were made and DOM changed (likely successful)
          // 3. AI provides detailed result indicating success
          const shouldAllowCompletion = (
            (typeFailures.length > 0 && clickSuccesses.length >= 2) ||  // Clicked send buttons
            (session.stuckCounter < 3 && session.urlHistory.length > 0) || // Made progress
            (aiResponse.result && aiResponse.result.length > 50 && 
             aiResponse.result.toLowerCase().includes('sent')) || // AI claims success
            (recentActions.filter(a => a.result?.success).length >= recentActions.length * 0.7) // Most actions succeeded
          );
          
          if (typeFailures.length > 0 && !shouldAllowCompletion) {
            automationLogger.warn('Completion blocked - critical type actions failed', {
              sessionId,
              failedActions: typeFailures.map(a => ({tool: a.tool, params: a.params, error: a.result?.error})),
              clickSuccesses: clickSuccesses.length
            });
            aiResponse.taskComplete = false; // Override the AI's decision
          } else if (typeFailures.length > 0 && shouldAllowCompletion) {
            automationLogger.info('Allowing messaging task completion despite type failures', { sessionId });
          }
        } else if (recentCriticalFailures.length >= 3) {
          // General rule: block completion if multiple critical actions failed recently
          // But be more lenient if there are signs of success
          const successRate = recentActions.length > 0 ? 
            recentActions.filter(a => a.result?.success).length / recentActions.length : 0;
          
          // Allow completion if success rate is decent (60%+) or if AI provides detailed result
          const hasDetailedResult = aiResponse.result && aiResponse.result.length > 30;
          const hasDecentSuccessRate = successRate >= 0.6;
          
          if (!hasDetailedResult && !hasDecentSuccessRate) {
            automationLogger.warn('Completion blocked - multiple critical actions failed', {
              sessionId,
              failedActions: recentCriticalFailures.map(a => ({tool: a.tool, params: a.params, error: a.result?.error})),
              successRate,
              hasDetailedResult
            });
            aiResponse.taskComplete = false; // Override the AI's decision
          } else {
            automationLogger.info('Allowing task completion despite failures', { sessionId, successRate, hasDetailedResult, resultLength: aiResponse.result?.length || 0 });
          }
        }

        if (aiResponse.taskComplete) {
          automationLogger.info('Task completion approved', { sessionId, resultPreview: aiResponse.result.substring(0, 100) });
        }
      }
    }
    
    // Check if task is complete (after verification enforcement)
    if (aiResponse.taskComplete) {
      // VERIFY-04: Global stability gate - enforce page stability before confirming completion
      // AI operates on DOM snapshots and cannot see pending network requests or in-flight mutations
      automationLogger.info('Task completion claimed by AI, verifying page stability', { sessionId });

      try {
        const stabilityCheck = await sendMessageWithRetry(session.tabId, {
          action: 'waitForPageStability',
          options: {
            maxWait: 3000,     // Allow more time for final action effects
            stableTime: 500,   // DOM stable for 500ms
            networkQuietTime: 300  // No network for 300ms
          }
        });

        const stabilityDuration = stabilityCheck?.waitTime || 0;
        automationLogger.logTiming(sessionId, 'WAIT', 'completion_stability', stabilityDuration, {
          stable: stabilityCheck?.stable,
          timedOut: stabilityCheck?.timedOut,
          pendingRequests: stabilityCheck?.pendingRequests,
          domChanges: stabilityCheck?.domChangeCount
        });

        if (!stabilityCheck?.stable) {
          automationLogger.warn('Task completion: page not fully stable, proceeding anyway', {
            sessionId,
            timedOut: stabilityCheck?.timedOut,
            pendingRequests: stabilityCheck?.pendingRequests,
            domStableFor: stabilityCheck?.domStableFor,
            networkQuietFor: stabilityCheck?.networkQuietFor
          });
        } else {
          automationLogger.info('Task completion: page stability verified', { sessionId });
        }
      } catch (stabilityError) {
        // Stability check failure should NOT block completion
        // Content script may be disconnected if final action navigated away
        automationLogger.warn('Stability check failed before completion, proceeding anyway', {
          sessionId,
          error: stabilityError.message
        });
      }

      // NOW mark complete (existing logic below this point stays unchanged)
      session.status = 'completed';
      const duration = Date.now() - session.startTime;

      automationLogger.logSessionEnd(sessionId, 'completed', session.actionHistory.length, duration);
      automationLogger.info('Task completed successfully', { sessionId, totalActions: session.actionHistory.length, duration });

      // Debug mode: Log task completion
      debugLog('Task complete', {
        sessionId,
        totalActions: session.actionHistory.length,
        durationMs: duration
      });

      // Save session logs for history
      automationLogger.saveSession(sessionId, session);

      finalizeSessionMetrics(sessionId, true); // Successfully completed
      cleanupSession(sessionId); // EASY WIN #10: Use cleanup helper

      // Notify popup
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: aiResponse.result
      });
    } else {
      // Dynamic delay based on stuck counter - optimized for speed
      // FSB TIMING: Log iteration end
      automationLogger.logTiming(sessionId, 'LOOP', 'iteration_end', Date.now() - iterationStart, { iteration: session.iterationCount });

      const delay = session.stuckCounter > 0 ?
        Math.min(1000 * Math.pow(1.5, session.stuckCounter), 10000) : // Exponential backoff up to 10s
        800; // Reduced from 2000ms for faster automation

      automationLogger.debug('Continuing loop', { sessionId, delay, stuckCounter: session.stuckCounter });

      // RACE CONDITION FIX: Check termination before scheduling next iteration
      if (isSessionTerminating(sessionId)) {
        automationLogger.debug('Session terminated during iteration', { sessionId });
        loopResolve?.(); // Signal that loop has yielded
        return;
      }

      // Store timeout reference for cleanup
      session.pendingTimeout = setTimeout(() => {
        session.pendingTimeout = null;
        startAutomationLoop(sessionId);
      }, delay);
    }

  } catch (error) {
    automationLogger.error('Automation loop error', { sessionId, error: error.message });

    // Check if session still exists before updating
    const currentSession = activeSessions.get(sessionId);
    if (currentSession && !currentSession.isTerminating) {
      currentSession.status = 'error';
      currentSession.error = error.message;
    }

    // Notify UI about error
    chrome.runtime.sendMessage({
      action: 'automationError',
      sessionId,
      error: error.message
    });
  } finally {
    // Signal that this loop iteration has completed
    loopResolve?.();
  }
}

/**
 * Calls the xAI Grok-3-mini API to generate automation actions
 * @param {string} task - The task description in natural language
 * @param {Object} structuredDOM - The structured DOM representation
 * @param {Object} settings - Extension settings including API key
 * @param {Object|null} context - Optional context for stuck detection and history
 * @returns {Promise<Object>} AI response with actions and completion status
 */
async function callAIAPI(task, structuredDOM, settings, context = null) {
  try {
    // Get settings if not provided
    if (!settings) {
      settings = await config.getAll();
    }

    // Check if appropriate API key is configured
    const provider = settings.modelProvider || 'xai';
    if (provider === 'gemini' && !settings.geminiApiKey) {
      throw new Error('Gemini API key not configured. Please set it in extension settings.');
    } else if (provider === 'xai' && !settings.apiKey) {
      throw new Error('xAI API key not configured. Please set it in extension settings.');
    }

    // Get or create AI integration instance for this session
    // Reusing instances enables multi-turn conversation history
    const sessionId = context?.sessionId;
    let ai;

    if (sessionId && sessionAIInstances.has(sessionId)) {
      // Reuse existing instance for multi-turn conversation
      ai = sessionAIInstances.get(sessionId);
      automationLogger.debug('Reusing AI instance for multi-turn', { sessionId });
    } else {
      // Create new AI integration instance
      ai = new AIIntegration(settings);

      // Store for future iterations if we have a session ID
      if (sessionId) {
        sessionAIInstances.set(sessionId, ai);
        automationLogger.debug('Created new AI instance for session', { sessionId });
      }
    }

    automationLogger.logAPI(context?.sessionId, settings.modelProvider || 'xai', 'call', {
      task: task.substring(0, 100),
      domType: structuredDOM._isDelta ? 'delta' : 'full',
      iteration: context?.iterationCount || 0,
      multiTurn: sessionId && sessionAIInstances.has(sessionId)
    });

    // FSB TIMING: Track AI API call time
    const aiCallStart = Date.now();
    // Get automation actions with context (multi-turn if available)
    const result = await ai.getAutomationActions(task, structuredDOM, context);
    automationLogger.logTiming(context?.sessionId, 'LLM', 'api_call', Date.now() - aiCallStart, { model: settings.modelName || 'default' });

    return result;
    
  } catch (error) {
    automationLogger.error('AI API error', { sessionId: context?.sessionId, error: error.message });

    // CRITICAL FIX: Do NOT mark taskComplete: true on errors - this falsely reports success
    // Return error response that stops automation but indicates failure
    return {
      actions: [],
      taskComplete: false,  // FIX: Do not mark as complete when there's an error
      failedDueToError: true,  // NEW: Explicit error flag for UI to display
      reasoning: '',
      result: `Task failed due to API error: ${error.message}. The automation will stop. Please check your API settings and try again.`,
      currentStep: 'Error - automation stopped',
      error: true
    };
  }
}

// Handle usage tracking from all contexts
function handleTrackUsage(request, sender, sendResponse) {
  automationLogger.debug('Usage tracking request received', {});

  // Initialize analytics if not already done
  const analytics = initializeAnalytics();

  const { model, inputTokens, outputTokens, success, tokenSource, timestamp } = request.data;

  automationLogger.logAPI(null, 'analytics', 'track_request', {
    model,
    inputTokens,
    outputTokens,
    success,
    tokenSource,
    context: sender.tab ? 'content' : 'extension'
  });

  // Track the usage and handle response
  analytics.trackUsage(model, inputTokens, outputTokens, success)
    .then(() => {
      // Broadcast update to all extension contexts
      broadcastAnalyticsUpdate();

      automationLogger.debug('Usage tracking completed', {});
      sendResponse({ success: true, message: 'Usage tracked successfully' });
    })
    .catch((error) => {
      automationLogger.error('Failed to handle usage tracking', { error: error.message });
      sendResponse({ success: false, error: error.message });
    });
  
  // Return true to indicate async response
  return true;
}

// Broadcast analytics updates to all extension contexts
function broadcastAnalyticsUpdate() {
  // Send to all extension contexts (popup, sidepanel, options)
  chrome.runtime.sendMessage({
    type: 'ANALYTICS_UPDATE'
  }).catch(() => {
    // Ignore errors if no listeners
  });
}

// Multi-tab management handler functions

/**
 * Handle opening a new tab
 * @param {Object} request - The request object containing url and active flag
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleOpenNewTab(request, sender, sendResponse) {
  try {
    const { url, active } = request;
    automationLogger.debug('Opening new tab', { url, active });
    
    const tab = await chrome.tabs.create({
      url: url || 'about:blank',
      active: active !== false // Default to true
    });
    
    // If we need to inject content script into the new tab
    if (url && url !== 'about:blank') {
      // Wait a moment for the tab to load
      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (error) {
          automationLogger.debug('Content script injection skipped for new tab', { tabId: tab.id, error: error.message });
        }
      }, 1000);
    }

    sendResponse({
      success: true,
      tabId: tab.id,
      url: tab.url,
      active: tab.active
    });

  } catch (error) {
    automationLogger.error('Error opening new tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle switching to an existing tab
 * @param {Object} request - The request object containing tabId
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleSwitchToTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    automationLogger.debug('Switching to tab', { tabId });
    
    // Get current active tab first
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Switch to the target tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Also bring the window to front
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    
    sendResponse({
      success: true,
      tabId: tabId,
      previousTab: currentTab ? currentTab.id : null
    });
    
  } catch (error) {
    automationLogger.error('Error switching to tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle closing a tab
 * @param {Object} request - The request object containing tabId
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleCloseTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    automationLogger.debug('Closing tab', { tabId });

    // Remove any active sessions for this tab
    for (const [sessionId, session] of activeSessions) {
      if (session.tabId === tabId) {
        automationLogger.info('Stopping session for closing tab', { sessionId, tabId });
        session.status = 'stopped';
        finalizeSessionMetrics(sessionId, false); // Tab closed
        cleanupSession(sessionId); // EASY WIN #10: Use cleanup helper
      }
    }

    await chrome.tabs.remove(tabId);

    sendResponse({
      success: true,
      tabId: tabId,
      closed: true
    });

  } catch (error) {
    automationLogger.error('Error closing tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle CDP-based text insertion for stubborn editors (Slack, Notion, Google Docs, etc.)
 * Uses Chrome DevTools Protocol for guaranteed keystroke delivery
 * @param {Object} request - The request object containing text to insert
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleCDPInsertText(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { text, clearFirst } = request;

  if (!tabId) {
    sendResponse({ success: false, error: 'No tab ID available' });
    return;
  }

  if (!text) {
    sendResponse({ success: false, error: 'No text provided' });
    return;
  }

  let debuggerAttached = false;

  try {
    automationLogger.logActionExecution(null, 'cdpInsertText', 'start', { tabId, textLength: text.length });

    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, '1.3');
    debuggerAttached = true;

    // If clearFirst is requested, select all and delete
    if (clearFirst) {
      // Select all text in focused element
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          modifiers: 2, // Ctrl/Cmd
          key: 'a',
          code: 'KeyA'
        }
      );
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          modifiers: 2,
          key: 'a',
          code: 'KeyA'
        }
      );

      // Small delay for selection
      await new Promise(r => setTimeout(r, 50));

      // Delete selected text
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          key: 'Backspace',
          code: 'Backspace'
        }
      );
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: 'Backspace',
          code: 'Backspace'
        }
      );

      await new Promise(r => setTimeout(r, 50));
    }

    // Use Input.insertText for reliable text insertion
    await chrome.debugger.sendCommand(
      { tabId },
      'Input.insertText',
      { text }
    );

    // Detach debugger
    await chrome.debugger.detach({ tabId });
    debuggerAttached = false;

    automationLogger.logActionExecution(null, 'cdpInsertText', 'complete', { success: true, tabId, textLength: text.length });
    sendResponse({
      success: true,
      text: text,
      method: 'cdp',
      length: text.length
    });

  } catch (error) {
    automationLogger.logActionExecution(null, 'cdpInsertText', 'complete', { success: false, tabId, error: error.message });

    // Try to detach debugger if it was attached
    if (debuggerAttached) {
      try {
        await chrome.debugger.detach({ tabId });
      } catch (detachError) {
        automationLogger.debug('Debugger already detached', { tabId });
      }
    }

    sendResponse({
      success: false,
      error: error.message,
      method: 'cdp'
    });
  }
}

/**
 * Handle listing all tabs
 * @param {Object} request - The request object containing currentWindowOnly flag
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleListTabs(request, sender, sendResponse) {
  try {
    const { currentWindowOnly } = request;
    automationLogger.debug('Listing tabs', { currentWindowOnly });
    
    let queryOptions = {};
    if (currentWindowOnly !== false) {
      queryOptions.currentWindow = true;
    }
    
    const tabs = await chrome.tabs.query(queryOptions);
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // PRIVACY: Only return tab titles for context, not URLs or sensitive data
    // Find the requesting session to identify the session tab
    const requestingSession = Array.from(activeSessions.values()).find(session => 
      session.tabId === (sender.tab?.id || currentTab?.id)
    );
    
    const formattedTabs = tabs.map(tab => ({
      id: tab.id,
      title: tab.title || 'Untitled Tab',  // Only title for context
      isSessionTab: requestingSession && tab.id === requestingSession.originalTabId,
      isActive: tab.active,
      // URL and other sensitive data removed for privacy
    }));
    
    sendResponse({
      success: true,
      tabs: formattedTabs,
      sessionTabId: requestingSession ? requestingSession.originalTabId : null,
      currentTab: currentTab ? currentTab.id : null,
      totalTabs: formattedTabs.length,
      message: 'Tab titles shown for context only. Automation is restricted to the session tab.'
    });
    
  } catch (error) {
    automationLogger.error('Error listing tabs', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle getting current tab information
 * @param {Object} request - The request object
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleGetCurrentTab(request, sender, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      sendResponse({
        success: true,
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          windowId: tab.windowId,
          index: tab.index,
          status: tab.status,
          hasSession: Array.from(activeSessions.values()).some(session => session.tabId === tab.id)
        }
      });
    } else {
      sendResponse({
        success: false,
        error: 'No active tab found'
      });
    }
    
  } catch (error) {
    automationLogger.error('Error getting current tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle waiting for a tab to load
 * @param {Object} request - The request object containing tabId and timeout
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleWaitForTabLoad(request, sender, sendResponse) {
  try {
    const { tabId, timeout = 30000 } = request;
    automationLogger.logTiming(null, 'WAIT', 'tab_load_start', 0, { tabId, timeout });
    
    const startTime = Date.now();
    
    // Check if tab is already loaded
    let tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      sendResponse({
        success: true,
        tabId: tabId,
        loaded: true,
        url: tab.url,
        loadTime: 0
      });
      return;
    }
    
    // Set up listener for tab updates
    const loadPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(updateListener);
        reject(new Error('Tab load timeout'));
      }, timeout);
      
      const updateListener = (updatedTabId, changeInfo, updatedTab) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(updateListener);
          resolve({
            url: updatedTab.url,
            loadTime: Date.now() - startTime
          });
        }
      };
      
      chrome.tabs.onUpdated.addListener(updateListener);
    });
    
    const result = await loadPromise;
    
    sendResponse({
      success: true,
      tabId: tabId,
      loaded: true,
      url: result.url,
      loadTime: result.loadTime
    });
    
  } catch (error) {
    automationLogger.error('Error waiting for tab load', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Global keyboard emulator instance
let keyboardEmulator = null;

/**
 * Initialize keyboard emulator if not already initialized
 */
function initializeKeyboardEmulator() {
  if (!keyboardEmulator) {
    keyboardEmulator = new KeyboardEmulator();
  }
  return keyboardEmulator;
}

/**
 * Handle keyboard emulator actions from content scripts
 * @param {Object} request - The keyboard action request
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleKeyboardDebuggerAction(request, sender, sendResponse) {
  try {
    const { method, key, keys, text, specialKey, modifiers = {}, delay = 50 } = request;
    const tabId = sender.tab.id;

    automationLogger.logActionExecution(null, `keyboard_${method}`, 'start', { tabId, key, specialKey });
    
    // Initialize keyboard emulator
    const emulator = initializeKeyboardEmulator();
    
    let result;
    
    switch (method) {
      case 'pressKey':
        if (!key) {
          throw new Error('Key parameter is required for pressKey');
        }
        result = await emulator.pressKey(tabId, key, modifiers);
        break;
        
      case 'pressKeySequence':
        if (!keys || !Array.isArray(keys)) {
          throw new Error('Keys array is required for pressKeySequence');
        }
        result = await emulator.pressKeySequence(tabId, keys, modifiers, delay);
        break;
        
      case 'typeText':
        if (!text || typeof text !== 'string') {
          throw new Error('Text parameter is required for typeText');
        }
        result = await emulator.typeText(tabId, text, delay);
        break;
        
      case 'sendSpecialKey':
        if (!specialKey || typeof specialKey !== 'string') {
          throw new Error('SpecialKey parameter is required for sendSpecialKey');
        }
        result = await emulator.sendSpecialKey(tabId, specialKey);
        break;
        
      default:
        throw new Error(`Unknown keyboard emulator method: ${method}`);
    }

    automationLogger.logActionExecution(null, `keyboard_${method}`, 'complete', { tabId, success: result.success });

    sendResponse({
      success: result.success,
      result: result,
      method: method,
      tabId: tabId
    });

  } catch (error) {
    automationLogger.logActionExecution(null, `keyboard_${request.method}`, 'complete', { success: false, error: error.message });
    sendResponse({
      success: false,
      error: error.message || 'Keyboard emulator action failed',
      method: request.method
    });
  }
}

/**
 * Clean up keyboard emulator resources when tab is closed
 */
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (keyboardEmulator && keyboardEmulator.debuggerAttached) {
    try {
      await keyboardEmulator.detachDebugger(tabId);
      automationLogger.debug('Cleaned up keyboard emulator for closed tab', { tabId });
    } catch (error) {
      automationLogger.debug('Failed to clean up keyboard emulator', { tabId, error: error.message });
    }
  }
});

/**
 * Clean up keyboard emulator when extension is suspended/unloaded
 */
chrome.runtime.onSuspend.addListener(async () => {
  if (keyboardEmulator) {
    automationLogger.logServiceWorker('suspend', { component: 'keyboard_emulator' });
    try {
      // Get all tabs and detach debugger from each
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await keyboardEmulator.detachDebugger(tab.id);
        } catch (error) {
          // Ignore individual cleanup errors during shutdown
        }
      }
    } catch (error) {
      automationLogger.debug('Error during keyboard emulator cleanup', { error: error.message });
    }
  }
});

// Handle action (icon) clicks - open global side panel
chrome.action.onClicked.addListener(async (tab) => {
  automationLogger.logInit('sidepanel', 'opening', { windowId: tab.windowId });

  // Open global side panel for the entire browser window
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    automationLogger.logInit('sidepanel', 'ready', { windowId: tab.windowId });
  } catch (error) {
    automationLogger.logInit('sidepanel', 'failed', { error: error.message, fallback: 'popup' });
    // Fallback to popup window if side panel fails
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});

// Set up side panel behavior
chrome.runtime.onInstalled.addListener(async () => {
  automationLogger.logInit('extension', 'installed', { version: 'v0.9' });

  // Initialize analytics
  initializeAnalytics();

  // Load debug mode setting
  await loadDebugMode();

  // Set default UI mode if not set
  const { uiMode } = await chrome.storage.local.get(['uiMode']);
  if (!uiMode) {
    await chrome.storage.local.set({ uiMode: 'sidepanel' });
    automationLogger.debug('Default UI mode set to sidepanel', {});
  }

  // Configure side panel to open automatically on action click
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    automationLogger.debug('Side panel behavior configured', { autoOpen: true });
  } catch (error) {
    automationLogger.debug('Side panel API not available', { chromeVersion: 'below 114' });
  }
});

// Initialize analytics and restore sessions on startup
chrome.runtime.onStartup.addListener(async () => {
  automationLogger.logServiceWorker('startup', {});
  initializeAnalytics();
  // Load debug mode setting
  await loadDebugMode();
  // Restore sessions from storage so stop button works after service worker restart
  await restoreSessionsFromStorage();
});

// DISABLED: Storage listener interferes with automation loop async operations
// Debug mode will load on startup but won't update in real-time
// chrome.storage.onChanged.addListener((changes, namespace) => {
//   if (namespace === 'local' && changes.debugMode) {
//     fsbDebugMode = changes.debugMode.newValue === true;
//     debugLog('Debug mode ' + (fsbDebugMode ? 'enabled' : 'disabled'));
//   }
// });