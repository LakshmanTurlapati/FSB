// Background service worker for FSB v9.0.2

// Import configuration and AI integration modules
importScripts('config/config.js');
importScripts('config/init-config.js');
importScripts('config/secure-config.js');
importScripts('ai/ai-integration.js');
importScripts('utils/automation-logger.js');
importScripts('utils/analytics.js');
importScripts('utils/keyboard-emulator.js');
importScripts('utils/site-explorer.js');

// Site-specific AI guidance modules
importScripts('site-guides/index.js');
importScripts('site-guides/ecommerce.js');
importScripts('site-guides/social.js');
importScripts('site-guides/coding.js');
importScripts('site-guides/travel.js');
importScripts('site-guides/finance.js');
importScripts('site-guides/email.js');
importScripts('site-guides/gaming-platforms.js');
importScripts('site-guides/career.js');
importScripts('site-guides/productivity.js');

// Background agent modules
importScripts('agents/agent-manager.js');
importScripts('agents/agent-scheduler.js');
importScripts('agents/agent-executor.js');
importScripts('agents/server-sync.js');

// Memory layer modules
importScripts('lib/memory/memory-schemas.js');
importScripts('lib/memory/memory-storage.js');
importScripts('lib/memory/memory-retriever.js');
importScripts('lib/memory/memory-extractor.js');
importScripts('lib/memory/memory-manager.js');
importScripts('lib/memory/memory-consolidator.js');

// Site Explorer instance
const siteExplorer = new SiteExplorer();

// Debug mode flag (controlled by options page toggle)
let fsbDebugMode = false;

/**
 * Extract and store long-term memories from a completed session.
 * Non-blocking, fire-and-forget. Safe to call for both successful and failed sessions.
 * @param {string} sessionId
 * @param {Object} session
 */
async function extractAndStoreMemories(sessionId, session) {
  try {
    // Extract domain from session URL or action history
    let domain = null;
    if (session.actionHistory) {
      for (const action of session.actionHistory) {
        if (action.params?.url) {
          try { domain = new URL(action.params.url).hostname; } catch {}
          if (domain) break;
        }
      }
    }

    const memories = await memoryManager.add(session, { domain });
    if (memories.length > 0) {
      debugLog('Extracted memories from session', {
        sessionId,
        count: memories.length,
        types: memories.map(m => m.type)
      });
    }
  } catch (error) {
    // Non-critical: log and move on
    console.warn('[FSB] Memory extraction failed for session', sessionId, error.message);
  }
}

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
 * Simplify a status message for user display.
 * Truncates to a short, clean one-liner.
 * @param {string} msg - Raw status message
 * @param {number} maxLen - Maximum character length (default 60)
 * @returns {string} Simplified message
 */
function simplifyStatus(msg, maxLen = 60) {
  if (!msg || typeof msg !== 'string') return 'Working...';
  // Strip leading/trailing whitespace
  let clean = msg.trim();
  // If already short, return as-is
  if (clean.length <= maxLen) return clean;
  // Truncate at last word boundary within limit
  const truncated = clean.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

/**
 * Generate a human-readable status string from an action's tool and params.
 * Replaces AI-generated currentStep/description fields to save tokens.
 * @param {string} tool - The action tool name
 * @param {Object} params - The action parameters
 * @returns {string} Short status string for UI display
 */
function getActionStatus(tool, params) {
  const label = (p) => shorten(p?.text || p?.ariaLabel || p?.placeholder || p?.selector, 25);
  switch (tool) {
    case 'click': {
      const t = label(params);
      return t ? `Clicking "${t}"` : 'Clicking element';
    }
    case 'type': {
      const val = shorten(params?.text, 25);
      const field = params?.placeholder ? ` into ${shorten(params.placeholder, 20)}` : '';
      return val ? `Typing "${val}"${field}` : 'Entering text';
    }
    case 'pressEnter':     return 'Submitting';
    case 'navigate': {
      const url = params?.url;
      if (url) {
        try { return `Opening ${shorten(new URL(url).hostname + new URL(url).pathname, 25)}`; }
        catch { return `Opening ${shorten(url, 25)}`; }
      }
      return 'Opening page';
    }
    case 'searchGoogle':   return `Looking up "${shorten(params?.query)}"`;
    case 'scroll':         return 'Scrolling';
    case 'getText':        return 'Reading content';
    case 'getAttribute':   return 'Inspecting page';
    case 'selectOption': {
      const opt = shorten(params?.optionText || params?.value, 25);
      return opt ? `Selecting "${opt}"` : 'Selecting option';
    }
    case 'toggleCheckbox': {
      const cb = shorten(params?.label || params?.ariaLabel || params?.text, 25);
      return cb ? `Toggling "${cb}"` : 'Toggling checkbox';
    }
    case 'hover': {
      const h = label(params);
      return h ? `Hovering over "${h}"` : 'Hovering';
    }
    case 'focus': {
      const f = shorten(params?.placeholder || params?.ariaLabel || params?.selector, 25);
      return f ? `Focusing "${f}"` : 'Focusing field';
    }
    case 'clearInput': {
      const c = shorten(params?.placeholder || params?.ariaLabel || params?.selector, 25);
      return c ? `Clearing "${c}"` : 'Clearing field';
    }
    case 'waitForElement': {
      const w = shorten(params?.selector, 25);
      return w ? `Waiting for ${w}` : 'Waiting for element';
    }
    case 'doubleClick': {
      const d = label(params);
      return d ? `Double-clicking "${d}"` : 'Double-clicking';
    }
    case 'rightClick': {
      const r = label(params);
      return r ? `Right-clicking "${r}"` : 'Right-clicking';
    }
    case 'goBack':         return 'Going back';
    case 'goForward':      return 'Going forward';
    case 'refresh':        return 'Refreshing';
    case 'moveMouse':      return 'Moving cursor';
    case 'keyPress':       return `Pressing ${params?.key || 'key'}`;
    case 'selectText':     return 'Selecting text';
    case 'setAttribute':   return 'Updating page';
    case 'solveCaptcha':   return 'Solving captcha';
    case 'openNewTab':     return 'Opening new tab';
    case 'switchToTab':    return 'Switching tab';
    case 'closeTab':       return 'Closing tab';
    case 'listTabs':       return 'Checking tabs';
    default:               return 'Working';
  }
}

/**
 * Shorten a text string for display (used for search queries)
 * @param {string} text - Text to shorten
 * @param {number} max - Maximum length
 * @returns {string} Shortened text
 */
function shorten(text, max = 30) {
  if (!text || typeof text !== 'string') return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

/**
 * Send session status to content script for visual feedback (viewport glow + progress overlay).
 * Non-blocking -- silently ignores failures (tab may be navigating).
 * @param {number} tabId - Target tab ID
 * @param {Object} statusData - Status fields: phase, taskName, iteration, maxIterations, reason, animatedHighlights
 */
async function sendSessionStatus(tabId, statusData) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'sessionStatus',
      ...statusData
    });
  } catch (e) { /* non-blocking -- tab may be navigating */ }
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
 * Calculate progress percentage and estimated time remaining for a session.
 * @param {Object} session - Active automation session
 * @returns {{ progressPercent: number, estimatedTimeRemaining: string|null }}
 */
function calculateProgress(session) {
  const maxIter = session.maxIterations || 20;
  const current = session.iterationCount || 0;
  const progressPercent = Math.min(99, Math.round((current / maxIter) * 100));

  let estimatedTimeRemaining = null;
  if (current > 0 && session.startTime) {
    const elapsed = Date.now() - session.startTime;
    const avgPerIteration = elapsed / current;
    const remaining = (maxIter - current) * avgPerIteration;
    if (remaining > 0) {
      estimatedTimeRemaining = formatETA(remaining);
    }
  }
  return { progressPercent, estimatedTimeRemaining };
}

/**
 * Format milliseconds into a human-readable ETA string.
 * @param {number} ms - Remaining time in milliseconds
 * @returns {string}
 */
function formatETA(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `~${seconds}s remaining`;
  const minutes = Math.round(seconds / 60);
  return `~${minutes}m remaining`;
}

/**
 * Summarize a task description into a short label using the AI provider.
 * Non-blocking -- returns null on failure. Skips tasks already short enough.
 * @param {string} taskText - Original task description
 * @param {Object} settings - Extension settings (for provider config)
 * @returns {Promise<string|null>}
 */
async function summarizeTask(taskText, settings) {
  try {
    if (!taskText || taskText.length <= 40) return taskText;

    const provider = new UniversalProvider(settings);
    const requestBody = await provider.buildRequest({
      systemPrompt: 'Summarize this browser automation task in under 10 words. Return only the summary, nothing else.',
      userPrompt: taskText
    }, {});

    // Limit tokens for this tiny call
    if (requestBody.max_tokens) requestBody.max_tokens = 50;
    if (requestBody.generationConfig?.maxOutputTokens) requestBody.generationConfig.maxOutputTokens = 50;

    const response = await provider.sendRequest(requestBody, { timeout: 8000 });

    // Extract raw text content directly (parseResponse expects JSON, but we want plain text)
    let summary = null;
    const providerName = settings.modelProvider || 'xai';
    if (providerName === 'gemini') {
      summary = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === 'anthropic') {
      summary = response?.content?.[0]?.text;
    } else {
      // xAI / OpenAI compatible
      summary = response?.choices?.[0]?.message?.content;
    }

    summary = summary?.trim();
    if (summary && summary.length > 0 && summary.length <= 60) return summary;
    return summary ? summary.substring(0, 40) : null;
  } catch (e) {
    automationLogger.debug('Task summarization failed (non-blocking)', { error: e.message });
    return null;
  }
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

    // PERF: Signal the stop via AbortController (replaces 500ms polling)
    if (session._stopAbortController) {
      session._stopAbortController.abort();
      session._stopAbortController = null;
    }

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

    // Clean up orphaned login handler if session had one
    if (session._loginHandler) {
      chrome.runtime.onMessage.removeListener(session._loginHandler.handler);
      clearTimeout(session._loginHandler.timeout);
      session._loginHandler = null;
    }
  }

  // PERF: Flush any pending debounced log writes before session cleanup
  if (automationLogger && typeof automationLogger.flush === 'function') {
    automationLogger.flush();
  }

  activeSessions.delete(sessionId);
  // Also remove from persistent storage
  removePersistedSession(sessionId);

  // Clean up conversation session entries that reference this session
  for (const [convId, entry] of conversationSessions) {
    if (entry.sessionId === sessionId) {
      conversationSessions.delete(convId);
    }
  }
  persistConversationSessions();

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

/**
 * Reactivate an idle session for a follow-up command.
 * Resets per-command counters while preserving cumulative state (actionHistory, AI history).
 * @param {Object} session - The session object from activeSessions
 * @param {string} newTask - The new follow-up task/command
 */
function reactivateSession(session, newTask) {
  // Reset per-command fields
  session.status = 'running';
  session.task = newTask;
  session.iterationCount = 0;
  session.stuckCounter = 0;
  session.consecutiveNoProgressCount = 0;
  session.lastDOMHash = null;
  session.lastDOMSignals = null;
  session.actionSequences = [];
  session.sequenceRepeatCount = {};
  session.startTime = Date.now();
  session.isTerminating = false;

  // Track command count and command history
  session.commandCount = (session.commandCount || 1) + 1;
  session.commands = session.commands || [];
  session.commands.push(newTask);

  // Clear idle timeout if one was scheduled
  if (session.idleTimeout) {
    clearTimeout(session.idleTimeout);
    session.idleTimeout = null;
  }

  // Preserved (not touched): actionHistory, stateHistory, tabId, allowedTabs,
  // domSettings, conversationId, animatedActionHighlights, and the AI instance
  // in sessionAIInstances retains its full conversation history.
}

/**
 * Transition a session to idle status instead of fully cleaning it up.
 * The session remains in activeSessions with status 'idle' so it can be reactivated
 * by a follow-up command. A deferred cleanup timer will fully clean up after IDLE_SESSION_TIMEOUT.
 * @param {string} sessionId - The session ID to idle
 */
function idleSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.status = 'idle';

  // Schedule deferred cleanup -- if no follow-up comes within the timeout, clean up fully
  session.idleTimeout = setTimeout(() => {
    if (session.status === 'idle') {
      automationLogger.debug('Idle session timeout, cleaning up', { sessionId });
      cleanupSession(sessionId);
      if (session.conversationId) {
        conversationSessions.delete(session.conversationId);
        persistConversationSessions();
      }
    }
  }, IDLE_SESSION_TIMEOUT);

  // Persist the idle status so it survives service worker restarts
  persistSession(sessionId, session);
  persistConversationSessions();

  automationLogger.info('Session transitioned to idle', {
    sessionId,
    conversationId: session.conversationId || null,
    commandCount: session.commandCount || 1,
    actionHistoryLength: session.actionHistory?.length || 0
  });

  // Keep-alive stays running while idle sessions exist (activeSessions.size > 0)
  // The existing stopKeepAlive() check in cleanupSession handles stopping when size === 0
}

/**
 * Persist conversationSessions Map to chrome.storage.session for service worker restart survival.
 */
async function persistConversationSessions() {
  try {
    await chrome.storage.session.set({
      fsbConversationSessions: Object.fromEntries(conversationSessions)
    });
    automationLogger.debug('Conversation sessions persisted', { count: conversationSessions.size });
  } catch (error) {
    automationLogger.warn('Failed to persist conversation sessions', { error: error.message });
  }
}

/**
 * Restore conversationSessions Map from chrome.storage.session after service worker restart.
 * Validates that referenced sessions still exist in activeSessions.
 */
async function restoreConversationSessions() {
  try {
    const stored = await chrome.storage.session.get('fsbConversationSessions');
    const data = stored?.fsbConversationSessions;
    if (data && typeof data === 'object') {
      for (const [convId, entry] of Object.entries(data)) {
        // Only restore if the referenced session still exists
        if (entry?.sessionId && activeSessions.has(entry.sessionId)) {
          conversationSessions.set(convId, entry);
        }
      }
      automationLogger.debug('Conversation sessions restored', { count: conversationSessions.size });
    }
  } catch (error) {
    automationLogger.warn('Failed to restore conversation sessions', { error: error.message });
  }
}

// Store for active automation sessions
let activeSessions = new Map();

// Store for AI integration instances per session (for multi-turn conversations)
// This allows conversation history to persist across iterations within a session
let sessionAIInstances = new Map();

// Session continuity: maps conversationId to { sessionId, lastActiveTime }
// Enables follow-up commands in the same conversation to reuse the existing session and AI instance
let conversationSessions = new Map();
const IDLE_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes before idle sessions are cleaned up
const MAX_CONVERSATION_SESSIONS = 5; // FIFO cap using enforceMapLimit

// PERF: Max Map sizes to prevent unbounded growth
const MAX_CONTENT_SCRIPT_ENTRIES = 200;

/**
 * Enforce size limit on a Map by evicting oldest entries.
 * @param {Map} map - The map to trim
 * @param {number} maxSize - Maximum allowed entries
 */
function enforceMapLimit(map, maxSize) {
  if (map.size <= maxSize) return;
  const excess = map.size - maxSize;
  const iter = map.keys();
  for (let i = 0; i < excess; i++) {
    const key = iter.next().value;
    map.delete(key);
  }
}

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
    // Only persist essential fields needed for stop button and session continuity to work
    const persistableSession = {
      sessionId: sessionId,
      task: session.task,
      tabId: session.tabId,
      status: session.status,
      startTime: session.startTime,
      conversationId: session.conversationId || null,
      commandCount: session.commandCount || 1,
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
        // Check if session is still supposed to be running or idle (idle sessions can be reactivated)
        if (persistedSession.status === 'running' || persistedSession.status === 'idle') {
          // Restore to activeSessions map so stop button works (and idle sessions can be reactivated)
          // Mark as 'recoverable' so we know it was restored (can't resume automation loop)
          activeSessions.set(persistedSession.sessionId, {
            ...persistedSession,
            isRestored: true,  // Flag to indicate this was restored, automation loop is not running
            // Keep original status -- 'running' for stop button, 'idle' for reactivation
          });
          automationLogger.info('Restored session from storage', {
            sessionId: persistedSession.sessionId,
            status: persistedSession.status,
            task: persistedSession.task?.substring(0, 50)
          });
        } else {
          // Clean up non-running/non-idle sessions from storage
          await removePersistedSession(persistedSession.sessionId);
        }
      }
    }

    // Restore conversation session mappings after sessions are restored
    await restoreConversationSessions();

    automationLogger.logServiceWorker('sessions_restored', { count: activeSessions.size, conversationSessions: conversationSessions.size });
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
  debugLog('[FSB Background] onConnect received, port name:', port.name);
  if (port.name === 'content-script') {
    const tabId = port.sender?.tab?.id;
    const frameId = port.sender?.frameId;
    debugLog('[FSB Background] Content script port connection', { tabId, frameId });
    if (!tabId || frameId !== 0) {
      debugLog('[FSB Background] Ignoring non-main-frame port');
      return; // Main frame only
    }

    contentScriptPorts.set(tabId, {
      port,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now()
    });
    enforceMapLimit(contentScriptPorts, MAX_CONTENT_SCRIPT_ENTRIES);
    debugLog('[FSB Background] Port stored for tab:', tabId);

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

// PERF: Clean up all state when a tab is closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  contentScriptPorts.delete(tabId);
  contentScriptReadyStatus.delete(tabId);
  contentScriptHealth.delete(tabId);

  // Clean up any active sessions for this tab
  for (const [sessionId, session] of activeSessions) {
    if (session.tabId === tabId) {
      session.status = 'stopped';
      activeSessions.delete(sessionId);
      if (sessionAIInstances.has(sessionId)) {
        sessionAIInstances.delete(sessionId);
      }
    }
  }
});

// Send periodic heartbeats to keep port connections validated
// PERF: Store interval ID so it can be cleared on suspension
const _heartbeatIntervalId = setInterval(() => {
  for (const [tabId, portInfo] of contentScriptPorts.entries()) {
    try {
      portInfo.port.postMessage({ type: 'heartbeat', timestamp: Date.now() });
    } catch (e) {
      // Port disconnected, cleanup will handle via onDisconnect
    }
  }
}, 3000);

// PERF: Clean up on service worker suspension
chrome.runtime.onSuspend.addListener(() => {
  clearInterval(_heartbeatIntervalId);
  contentScriptPorts.clear();
  contentScriptReadyStatus.clear();
  contentScriptHealth.clear();
});

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
        debugLog('[FSB Background] Sending healthCheck to tab:', { tabId, attempt: msgAttempt });
        // CRITICAL: Use frameId: 0 to target ONLY the main frame
        const healthCheckPromise = chrome.tabs.sendMessage(tabId, {
          action: 'healthCheck'
        }, { frameId: 0 });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), adjustedTimeout)
        );

        const response = await Promise.race([healthCheckPromise, timeoutPromise]);
        debugLog('[FSB Background] healthCheck response', response);

        if (response && response.success) {
          debugLog('[FSB Background] healthCheck successful for tab:', tabId);
          contentScriptHealth.set(tabId, {
            lastCheck: Date.now(),
            healthy: true,
            failures: 0,
            method: 'message'
          });
          return true;
        }
      } catch (e) {
        debugLog('[FSB Background] healthCheck failed', { tabId, error: e.message });
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
      // CRITICAL: Must inject automation-logger.js BEFORE content.js because content.js
      // depends on the automationLogger global defined in automation-logger.js.
      // Without it, content.js crashes at initialization and never registers its
      // onMessage listener, causing all health checks and readiness signals to fail.
      automationLogger.logComm(null, 'send', 'inject', true, { tabId, attempt });
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },  // frameIds: [0] = main frame only
        files: ['utils/automation-logger.js', 'content.js'],
        world: 'ISOLATED',  // Explicitly specify isolated world
        injectImmediately: true  // Don't wait for document_idle
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

// Slim down action results before storing in session history.
// Keeps only the fields that ai-integration and stuck detection actually read.
function slimActionResult(result) {
  if (!result) return result;
  const slim = { success: result.success };
  if (result.error) slim.error = result.error;
  if (result.hadEffect !== undefined) slim.hadEffect = result.hadEffect;
  if (result.navigationTriggered) slim.navigationTriggered = true;
  if (result.validationPassed !== undefined) slim.validationPassed = result.validationPassed;
  if (result.validationPassed === false && result.actualValue !== undefined) slim.actualValue = result.actualValue;
  if (result.warning) slim.warning = result.warning;
  if (!result.success && result.suggestion) slim.suggestion = result.suggestion;
  if (result.typed) slim.typed = result.typed;
  if (result.clicked) slim.clicked = result.clicked;
  if (result.navigatingTo) slim.navigatingTo = result.navigatingTo;
  if (result.selected) slim.selected = result.selected;
  if (result.checked !== undefined) slim.checked = result.checked;
  if (result.failureType) slim.failureType = result.failureType;
  if (result.retryable !== undefined) slim.retryable = result.retryable;
  // MEM-02: Preserve fields for rich action descriptions downstream
  if (result.tool) slim.tool = result.tool;
  if (result.elementInfo?.text) slim.elementText = result.elementInfo.text.substring(0, 50);
  if (result.selectorUsed) slim.selectorUsed = result.selectorUsed;
  // CMP-04: Preserve value field for getText/getAttribute -- needed by progress tracking
  // and hard-stop extracted-text display (lines that reference result.value)
  if (result.value !== undefined) slim.value = typeof result.value === 'string' ? result.value.substring(0, 200) : result.value;
  return slim;
}

// ==========================================
// SESSION REPLAY ENGINE
// ==========================================

/**
 * Get appropriate inter-action delay for replay based on tool type.
 * Navigation actions get longer delays; typing/key actions are faster.
 * @param {string} tool - The action tool name
 * @returns {number} Delay in milliseconds
 */
function getReplayDelay(tool) {
  if (['navigate', 'searchGoogle', 'goBack', 'goForward'].includes(tool)) return 1500;
  if (['click', 'doubleClick', 'rightClick'].includes(tool)) return 500;
  if (['type', 'keyPress', 'pressEnter'].includes(tool)) return 300;
  return 200;
}

/**
 * Load a stored session's actionHistory and filter to replayable actions.
 * @param {string} sessionId - The session ID to load from fsbSessionLogs
 * @returns {Object|null} { session, replayableActions, originalTask, originalUrl } or null
 */
async function loadReplayableSession(sessionId) {
  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const session = sessionStorage[sessionId];

    if (!session || !session.actionHistory || session.actionHistory.length === 0) {
      return null;
    }

    const replayableTools = new Set([
      'click', 'rightClick', 'doubleClick', 'type', 'clearInput', 'pressEnter',
      'keyPress', 'selectOption', 'toggleCheckbox', 'navigate', 'searchGoogle',
      'scroll', 'goBack', 'goForward', 'refresh', 'hover', 'focus', 'moveMouse',
      'waitForElement'
    ]);

    const replayableActions = session.actionHistory
      .filter(a => a.result?.success === true && replayableTools.has(a.tool));

    if (replayableActions.length === 0) {
      return null;
    }

    // Extract the original URL from the first navigation-like action or session logs
    let originalUrl = null;
    for (const action of session.actionHistory) {
      if (action.params?.url) {
        originalUrl = action.params.url;
        break;
      }
    }
    if (!originalUrl && session.logs && session.logs.length > 0) {
      originalUrl = session.logs[0]?.data?.url || null;
    }

    return {
      session,
      replayableActions,
      originalTask: session.task,
      originalUrl
    };
  } catch (error) {
    automationLogger.error('Failed to load replayable session', { sessionId, error: error.message });
    return null;
  }
}

/**
 * Execute a replay sequence step-by-step through the existing sendMessageWithRetry path.
 * Sends statusUpdate messages to UI during each step with progress percentage.
 * Critical step failures (navigate, searchGoogle) abort replay; non-critical failures are skipped.
 * @param {string} replaySessionId - The replay session ID in activeSessions
 */
async function executeReplaySequence(replaySessionId) {
  const session = activeSessions.get(replaySessionId);
  if (!session || session.status !== 'replaying') return;

  const criticalTools = new Set(['navigate', 'searchGoogle']);

  for (let i = session.currentStep; i < session.replaySteps.length; i++) {
    // Check for termination (user stopped the replay)
    const currentSession = activeSessions.get(replaySessionId);
    if (!currentSession || currentSession.isTerminating || currentSession.status !== 'replaying') {
      return;
    }

    session.currentStep = i;
    const step = session.replaySteps[i];

    // Prepend clearInput before type actions to prevent text accumulation
    if (step.tool === 'type' && step.params?.selector) {
      try {
        await sendMessageWithRetry(session.tabId, {
          action: 'executeAction',
          tool: 'clearInput',
          params: { selector: step.params.selector }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        automationLogger.debug('clearInput before type failed (non-critical)', {
          sessionId: replaySessionId, step: i, error: e?.message || String(e)
        });
      }
    }

    // Send progress update to UI
    const progressPercent = Math.round(((i + 1) / session.totalSteps) * 100);
    try {
      chrome.runtime.sendMessage({
        action: 'statusUpdate',
        sessionId: replaySessionId,
        message: getActionStatus(step.tool, step.params),
        iteration: i + 1,
        maxIterations: session.totalSteps,
        progressPercent,
        replayStep: i + 1,
        isReplay: true
      });
    } catch (e) {
      // Non-blocking: UI may not be listening
    }

    // Execute the action via the existing content script path
    let actionResult = null;
    try {
      actionResult = await sendMessageWithRetry(session.tabId, {
        action: 'executeAction',
        tool: step.tool,
        params: step.params,
        visualContext: {
          taskName: session.task,
          stepNumber: i + 1,
          totalSteps: session.totalSteps,
          iterationCount: 1,
          isReplay: true
        }
      });
    } catch (e) {
      actionResult = { success: false, error: e?.message || String(e) };
    }

    // Record result in session actionHistory
    session.actionHistory.push({
      timestamp: Date.now(),
      tool: step.tool,
      params: step.params,
      result: slimActionResult(actionResult),
      replayStep: i + 1
    });

    // Handle failures
    if (!actionResult?.success) {
      if (criticalTools.has(step.tool)) {
        session.status = 'replay_failed';
        automationLogger.warn('Replay aborted: critical action failed', {
          sessionId: replaySessionId, step: i + 1, tool: step.tool, error: actionResult?.error
        });
        break;
      } else {
        automationLogger.warn('Replay step failed (non-critical, skipping)', {
          sessionId: replaySessionId, step: i + 1, tool: step.tool, error: actionResult?.error
        });
        // Continue to next step
      }
    }

    // Inter-action delay (skip if last step)
    if (i < session.replaySteps.length - 1) {
      await new Promise(resolve => setTimeout(resolve, getReplayDelay(step.tool)));
    }
  }

  // Tally results
  const successCount = session.actionHistory.filter(a => a.result?.success).length;
  const failedCount = session.actionHistory.filter(a => !a.result?.success).length;

  if (session.status === 'replaying') {
    session.status = 'replay_completed';

    // Send completion message to UI
    try {
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId: replaySessionId,
        result: `Replay complete: ${successCount}/${session.totalSteps} steps executed successfully.${failedCount > 0 ? ` ${failedCount} steps skipped.` : ''}`
      });
    } catch (e) { /* UI may not be listening */ }
  } else if (session.status === 'replay_failed') {
    // Send error message to UI
    try {
      chrome.runtime.sendMessage({
        action: 'automationError',
        sessionId: replaySessionId,
        error: `Replay failed at step ${session.currentStep + 1}/${session.totalSteps}. ${successCount} steps succeeded before failure.`
      });
    } catch (e) { /* UI may not be listening */ }
  }

  // Send session-ended status to content script
  sendSessionStatus(session.tabId, {
    phase: 'ended',
    reason: session.status === 'replay_completed' ? 'completed' : 'error'
  });

  // Log session end and cleanup
  const duration = Date.now() - session.startTime;
  automationLogger.logSessionEnd(replaySessionId, session.status, session.actionHistory.length, duration);
  automationLogger.saveSession(replaySessionId, session);
  cleanupSession(replaySessionId);
}

/**
 * Handle a replaySession message: load session data, create replay session, and kick off execution.
 * @param {Object} request - { sessionId: string }
 * @param {Object} sender - Chrome message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleReplaySession(request, sender, sendResponse) {
  try {
    const { sessionId } = request;

    // Check if automation is already running
    for (const [id, sess] of activeSessions) {
      if (sess.status !== 'idle') {
        sendResponse({ success: false, error: 'Another automation is already running' });
        return;
      }
    }

    // Get current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    // Load replayable session data
    const replayData = await loadReplayableSession(sessionId);
    if (!replayData || replayData.replayableActions.length === 0) {
      sendResponse({ success: false, error: 'No replayable actions found in this session' });
      return;
    }

    // Create replay session ID
    const replaySessionId = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Create replay session in activeSessions (no AI instance, no conversation session)
    activeSessions.set(replaySessionId, {
      task: `Replay: ${replayData.originalTask}`,
      tabId: activeTab.id,
      status: 'replaying',
      startTime: Date.now(),
      actionHistory: [],
      isReplay: true,
      originalSessionId: sessionId,
      replaySteps: replayData.replayableActions,
      currentStep: 0,
      totalSteps: replayData.replayableActions.length
    });

    // Start keep-alive to prevent service worker from sleeping
    startKeepAlive();

    // Log session start
    automationLogger.logSessionStart(replaySessionId, `Replay: ${replayData.originalTask}`, activeTab.id);

    // Respond immediately with session info
    sendResponse({
      success: true,
      sessionId: replaySessionId,
      totalSteps: replayData.replayableActions.length
    });

    // Kick off replay execution asynchronously (do NOT await)
    executeReplaySequence(replaySessionId);
  } catch (error) {
    automationLogger.error('Failed to start replay session', { error: error.message });
    sendResponse({ success: false, error: error.message });
  }
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
      // Check content script health before every attempt (not just the first)
      const isHealthy = await checkContentScriptHealth(tabId);
      if (!isHealthy) {
        automationLogger.logComm(null, 'health', 'pre_message', false, { tabId, attempt, action: 're-inject' });
        await ensureContentScriptInjected(tabId);
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

    // If we navigated or clicked before getting stuck, suggest goBack to return to previous page
    if (session.actionHistory?.some(a => a.tool === 'navigate' || a.tool === 'click' || a.tool === 'clickSearchResult')) {
      strategies.push({
        type: 'go_back',
        description: 'Use goBack to return to previous page (e.g., search results) and try a different link or approach',
        priority: 'high'
      });
    }
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

// Domain keyword map: ordered array of [url, keywords] pairs.
// More specific keywords come first to avoid false matches (e.g., "google docs" before "google").
const DOMAIN_KEYWORD_MAP = [
  // Productivity - specific Google products first
  ['https://docs.google.com', ['google docs', 'gdocs']],
  ['https://sheets.google.com', ['google sheets', 'gsheets', 'spreadsheet']],
  ['https://drive.google.com', ['google drive', 'gdrive']],
  ['https://maps.google.com', ['google maps']],
  ['https://news.google.com', ['google news']],
  // Email
  ['https://gmail.com', ['gmail', 'email', 'mail', 'inbox']],
  ['https://outlook.live.com', ['outlook', 'hotmail']],
  // Social media
  ['https://youtube.com', ['youtube']],
  ['https://twitter.com', ['twitter', 'tweet', 'x.com']],
  ['https://facebook.com', ['facebook']],
  ['https://instagram.com', ['instagram']],
  ['https://linkedin.com', ['linkedin']],
  ['https://reddit.com', ['reddit', 'subreddit']],
  ['https://tiktok.com', ['tiktok']],
  // Shopping
  ['https://amazon.com', ['amazon']],
  ['https://ebay.com', ['ebay']],
  ['https://etsy.com', ['etsy']],
  // Entertainment
  ['https://netflix.com', ['netflix']],
  ['https://spotify.com', ['spotify']],
  ['https://twitch.tv', ['twitch']],
  // Development
  ['https://github.com', ['github', 'repository', 'repo']],
  ['https://stackoverflow.com', ['stackoverflow', 'stack overflow']],
  // Communication
  ['https://discord.com', ['discord']],
  ['https://slack.com', ['slack']],
  ['https://web.whatsapp.com', ['whatsapp']],
  // Productivity - other
  ['https://notion.so', ['notion']],
  ['https://dropbox.com', ['dropbox']],
  // Information
  ['https://wikipedia.org', ['wikipedia', 'wiki']],
  ['https://weather.com', ['weather', 'forecast']],
  // Generic Google last (catches "google something" not matched above)
  ['https://google.com', ['google']],
];

// Extract the first logical segment of a multi-step task.
// "Do X on Amazon, then email it" -> "Do X on Amazon"
function getFirstTaskSegment(task) {
  const separators = [' and then ', ', then ', ' then ', ' after that ', ' afterwards ', '. Then ', '. After that '];
  const lowerTask = task.toLowerCase();
  let earliestSplit = task.length;

  for (const sep of separators) {
    const pos = lowerTask.indexOf(sep.toLowerCase());
    if (pos !== -1 && pos < earliestSplit) {
      earliestSplit = pos;
    }
  }

  return earliestSplit < task.length ? task.substring(0, earliestSplit).trim() : task;
}

// Smart navigation: match task keywords to known domains.
// Picks the keyword whose first occurrence is earliest in the task text.
function analyzeTaskAndGetTargetUrl(task) {
  const taskLower = task.toLowerCase();
  let bestUrl = null;
  let bestPosition = Infinity;

  for (const [url, keywords] of DOMAIN_KEYWORD_MAP) {
    for (const kw of keywords) {
      const pos = taskLower.indexOf(kw);
      if (pos !== -1 && pos < bestPosition) {
        bestPosition = pos;
        bestUrl = url;
      }
    }
  }

  return bestUrl || 'https://google.com';
}

// ==========================================
// TAB DISCOVERY & SMART TAB MANAGEMENT
// ==========================================

/**
 * Score how well a tab URL matches the target URL.
 * exact URL = 100, same path = 75, homepage = 50, domain only = 25
 */
function calculateTabScore(tabUrl, targetUrl) {
  try {
    const tab = new URL(tabUrl);
    const target = new URL(targetUrl);
    const tabHost = tab.hostname.replace(/^www\./, '');
    const targetHost = target.hostname.replace(/^www\./, '');
    if (tabHost !== targetHost) return 0;
    if (tab.href === target.href) return 100;
    if (tab.pathname === target.pathname) return 75;
    if (tab.pathname === '/' && !tab.search) return 50;
    return 25;
  } catch {
    return 0;
  }
}

/**
 * Find open tabs matching the target URL's domain, scored and sorted.
 */
async function findMatchingTabs(targetUrl) {
  try {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const scored = allTabs
      .map(tab => ({ tab, score: calculateTabScore(tab.url || '', targetUrl) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.tab.lastAccessed || 0) - (a.tab.lastAccessed || 0);
      });
    return scored.map(entry => entry.tab);
  } catch (error) {
    automationLogger.debug('findMatchingTabs error', { error: error.message });
    return [];
  }
}

/**
 * Determine if a tab has real user content worth preserving.
 */
function isUserContentTab(tab) {
  if (!tab || !tab.url) return false;
  if (isRestrictedURL(tab.url)) return false;
  try {
    const url = new URL(tab.url);
    // Blank / new-tab-like pages
    if (url.pathname === '/' && !url.search && !url.hash) {
      const genericTitles = ['new tab', 'untitled', 'start page', 'home', 'homepage'];
      if (!tab.title || genericTitles.includes(tab.title.toLowerCase().trim())) {
        return false;
      }
      // A domain homepage with a real title (e.g. "Reddit - Dive into anything") is still user content
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Decide what tab action to take: navigate, switch, or create.
 * Returns { action: 'navigate'|'switch'|'create', tabId?, url?, reason }
 */
async function decideTabAction(currentTabId, currentTabUrl, targetUrl, task) {
  try {
    const targetHost = new URL(targetUrl).hostname.replace(/^www\./, '');
    const currentHost = currentTabUrl ? new URL(currentTabUrl).hostname.replace(/^www\./, '') : '';

    // Already on the target domain - just navigate in place
    if (currentHost === targetHost) {
      return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Already on target domain' };
    }

    const matchingTabs = await findMatchingTabs(targetUrl);
    const currentTab = await chrome.tabs.get(currentTabId).catch(() => null);
    const currentIsRestricted = !currentTabUrl || isRestrictedURL(currentTabUrl);
    const currentHasContent = currentTab ? isUserContentTab(currentTab) : false;

    if (currentIsRestricted) {
      // Safe to overwrite restricted pages, but prefer existing matching tab
      if (matchingTabs.length > 0) {
        return { action: 'switch', tabId: matchingTabs[0].id, url: targetUrl, reason: 'Found matching tab, current is restricted' };
      }
      return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Navigating restricted page to target' };
    }

    if (currentHasContent) {
      // Preserve user content - switch to existing tab or open new one
      if (matchingTabs.length > 0) {
        return { action: 'switch', tabId: matchingTabs[0].id, url: targetUrl, reason: 'Switching to matching tab, preserving user content' };
      }
      return { action: 'create', url: targetUrl, reason: 'Creating new tab to preserve user content' };
    }

    // Generic page without meaningful content - navigate in place
    if (matchingTabs.length > 0) {
      return { action: 'switch', tabId: matchingTabs[0].id, url: targetUrl, reason: 'Found matching tab' };
    }
    return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Navigating generic page to target' };
  } catch (error) {
    automationLogger.debug('decideTabAction error, falling back to navigate', { error: error.message });
    return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Fallback after error' };
  }
}

/**
 * Add a tab ID to the session's allowed tabs whitelist.
 */
function addAllowedTab(sessionId, tabId, reason) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  if (!session.allowedTabs.includes(tabId)) {
    session.allowedTabs.push(tabId);
    session.tabHistory.push({ tabId, reason, timestamp: Date.now() });
    automationLogger.debug('Added allowed tab', { sessionId, tabId, reason, allowedTabs: session.allowedTabs });
  }
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
      'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50 },
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
 * CMP-03: Classify a task string into one of 8 task types.
 * Simplified port of ai-integration.js detectTaskType() for background.js use
 * (no site guide dependency). Used by completion validators and progress tracking.
 * @param {string} taskString - The user's task description
 * @returns {string} One of: 'email', 'messaging', 'form', 'shopping', 'search', 'extraction', 'navigation', 'general'
 */
function classifyTask(taskString) {
  if (!taskString) return 'general';
  const t = taskString.toLowerCase();

  // Email -- check before messaging to avoid 'send' matching messaging
  if (/email|mail|gmail|outlook|compose|inbox|draft/.test(t)) return 'email';
  // Messaging -- 'send', 'reply', 'post', 'comment' etc. (after email ruled out)
  if (/message|send|text|chat|reply|comment|dm\b|post/.test(t)) return 'messaging';
  // Form
  if (/fill|form|submit|register|sign.?up|apply/.test(t)) return 'form';
  // Shopping
  if (/buy|purchase|order|add.?to.?cart|checkout|shop/.test(t)) return 'shopping';
  // Career -- check before search since "find jobs" would otherwise match search
  if (/career|job|jobs|position|opening|hiring|employment/.test(t)) return 'career';
  // Search
  if (/search|find|look.?for|what.?is|how.?to/.test(t)) return 'search';
  // Extraction
  if (/get|extract|price|read|check|scrape/.test(t)) return 'extraction';
  // Navigation
  if (/go.?to|navigate|open|visit/.test(t)) return 'navigation';
  // Fallback
  return 'general';
}

// CMP-03: Irrevocable verb pattern -- matches verbs whose side effects cannot be undone
const IRREVOCABLE_VERB_PATTERN = /send|submit|purchase|order|delete|publish|post/i;

/**
 * CMP-03: Record a critical (irrevocable) action in the session registry.
 * Called after action execution when the action is a click on an element whose
 * text or selector matches the irrevocable verb pattern.
 * @param {Object} session - The automation session
 * @param {Object} action - The action object { tool, params }
 * @param {Object} result - The slim action result
 */
function recordCriticalAction(session, action, result) {
  // Initialize registry if absent
  if (!session.criticalActionRegistry) {
    session.criticalActionRegistry = {
      actions: [],    // { tool, selector, elementText, iteration, verified, timestamp }
      cooldowns: {}   // { signature: { blockedUntilIteration, reason } }
    };
  }
  const registry = session.criticalActionRegistry;

  const elementText = result?.elementText || result?.clicked || '';
  const selector = action.params?.selector || '';

  // Push to actions array (cap at 20, drop oldest per Pitfall 6)
  registry.actions.push({
    tool: action.tool,
    selector: selector.substring(0, 80),
    elementText: elementText.substring(0, 50),
    iteration: session.iterationCount,
    verified: false,
    timestamp: Date.now()
  });
  if (registry.actions.length > 20) {
    registry.actions.shift();
  }

  // Set 3-iteration cooldown on the action signature
  const signature = createActionSignature(action);
  registry.cooldowns[signature] = {
    blockedUntilIteration: session.iterationCount + 3,
    reason: `Irrevocable action "${elementText.substring(0, 30)}" needs cooldown`
  };

  automationLogger.info('Critical action recorded', {
    sessionId: session.id,
    tool: action.tool,
    elementText: elementText.substring(0, 30),
    cooldownUntil: session.iterationCount + 3
  });
}

/**
 * CMP-03: Check if an action is currently on cooldown (blocked from re-execution).
 * @param {Object} session - The automation session
 * @param {Object} action - The action to check
 * @returns {boolean} True if the action is blocked (still cooling down)
 */
function isCooledDown(session, action) {
  if (!session.criticalActionRegistry?.cooldowns) return false;
  const signature = createActionSignature(action);
  const cooldown = session.criticalActionRegistry.cooldowns[signature];
  if (!cooldown) return false;
  return session.iterationCount < cooldown.blockedUntilIteration;
}

/**
 * CMP-03: Get a compact summary of critical actions for prompt injection.
 * @param {Object} session - The automation session
 * @returns {Array} Array of { description, verified, cooldownRemaining }
 */
function getCriticalActionSummary(session) {
  if (!session.criticalActionRegistry?.actions?.length) return [];
  const summary = [];
  let charCount = 0;
  // Iterate most recent first, stop at 300 chars
  const actions = session.criticalActionRegistry.actions.slice().reverse();
  for (const entry of actions) {
    const cooldownEntry = session.criticalActionRegistry.cooldowns[
      `${entry.tool}:${entry.selector}`
    ];
    const cooldownRemaining = cooldownEntry
      ? Math.max(0, cooldownEntry.blockedUntilIteration - session.iterationCount)
      : 0;
    const desc = `${entry.tool} "${entry.elementText}" @iter${entry.iteration}`;
    if (charCount + desc.length > 300) break;
    summary.push({
      description: desc,
      verified: entry.verified,
      cooldownRemaining
    });
    charCount += desc.length;
  }
  return summary;
}

// ============================================================================
// CMP-01 + CMP-02: Multi-signal completion validation
// Replaces ad-hoc completion checks with structured task-type validators
// and weighted multi-signal scoring.
// ============================================================================

/**
 * CMP-02: Detect URL patterns that indicate task completion.
 * @param {string} url - The current page URL
 * @param {Object} session - The automation session
 * @returns {string|null} Matched pattern description, or null
 */
function detectUrlCompletionPattern(url, session) {
  if (!url) return null;
  // Check for success URL patterns
  const successPattern = /\/(?:confirm|success|thank|receipt|done|complete|order-placed|submitted)/i;
  const match = url.match(successPattern);
  if (match) return 'success-url: ' + match[0];
  // For navigation tasks: URL differs from start
  if (session.startUrl && url !== session.startUrl) {
    const startHost = new URL(session.startUrl).hostname;
    const currentHost = new URL(url).hostname;
    if (startHost !== currentHost) return 'navigated-away: ' + currentHost;
  }
  return null;
}

/**
 * CMP-01: Check if action history shows task-appropriate completion.
 * @param {Object} session - The automation session
 * @param {string} taskType - Classified task type
 * @returns {boolean}
 */
function checkActionChainComplete(session, taskType) {
  const history = session.actionHistory || [];
  if (history.length === 0) return false;
  const recent = history.slice(-15);
  switch (taskType) {
    case 'messaging':
    case 'email': {
      // Has a successful click on a send/submit-like element
      return recent.some(a =>
        a.tool === 'click' && a.result?.success &&
        /send|submit|post|reply/i.test(a.result?.elementText || a.result?.clicked || a.params?.selector || '')
      );
    }
    case 'form':
    case 'shopping': {
      // Type actions followed by a submit click
      const hasType = recent.some(a => a.tool === 'type' && a.result?.success);
      const hasSubmit = recent.some(a =>
        a.tool === 'click' && a.result?.success &&
        /submit|confirm|place.?order|checkout|register|sign.?up|apply|continue/i.test(
          a.result?.elementText || a.result?.clicked || a.params?.selector || ''
        )
      );
      return hasType && hasSubmit;
    }
    case 'navigation': {
      return session.startUrl && session.lastUrl !== session.startUrl;
    }
    case 'search': {
      const hasSearch = recent.some(a =>
        (a.tool === 'type' || a.tool === 'searchGoogle') && a.result?.success
      );
      const hasNavOrResult = recent.some(a =>
        (a.tool === 'clickSearchResult' || a.tool === 'click' || a.tool === 'getText') && a.result?.success
      );
      return hasSearch && hasNavOrResult;
    }
    case 'extraction': {
      return recent.some(a =>
        a.tool === 'getText' && a.result?.success && a.result?.value && a.result.value.trim().length > 0
      );
    }
    default:
      return false;
  }
}

/**
 * CMP-02: Summarize the last 5 actions as compact evidence string.
 * @param {Object} session - The automation session
 * @returns {string}
 */
function summarizeRecentActions(session) {
  const recent = (session.actionHistory || []).slice(-5);
  return recent.map(a => {
    const status = a.result?.success ? 'ok' : 'fail';
    const target = (a.result?.elementText || a.params?.selector || '').substring(0, 25);
    return `${a.tool}(${target}):${status}`;
  }).join(', ');
}

/**
 * CMP-02: Collect completion signals from all sources.
 * @param {Object} session - The automation session
 * @param {Object} aiResponse - The AI response with taskComplete and result
 * @param {Object} context - The iteration context (includes completionSignals from DOM)
 * @returns {Object} Signal bundle for scoring
 */
function gatherCompletionSignals(session, aiResponse, context) {
  const taskType = classifyTask(session.task);
  return {
    // URL signal (0.3 weight)
    urlMatch: detectUrlCompletionPattern(context.currentUrl, session),
    // DOM signal (0.25 weight) -- from content.js completionSignals (Plan 02)
    domSuccess: context.completionSignals?.successMessages?.length > 0
      ? context.completionSignals.successMessages[0].text : null,
    confirmationPage: context.completionSignals?.confirmationPage || false,
    formReset: context.completionSignals?.formReset || false,
    toast: context.completionSignals?.toastNotification?.text || null,
    // AI self-report (0.2 weight)
    aiComplete: aiResponse.taskComplete === true,
    aiResult: aiResponse.result || '',
    // Action chain (0.15 weight)
    actionChainComplete: checkActionChainComplete(session, taskType),
    actionChainEvidence: summarizeRecentActions(session),
    criticalActionsVerified: (session.criticalActionRegistry?.actions || [])
      .filter(a => a.verified).length,
    // Page stability (0.1 weight) -- use changeSignals if available
    pageStable: !context.changeSignals?.changed || false
  };
}

/**
 * CMP-02: Compute weighted completion score from gathered signals.
 * @param {Object} signals - Signal bundle from gatherCompletionSignals
 * @param {string} taskType - Classified task type
 * @returns {{ score: number, evidence: string[], threshold: number }}
 */
function computeCompletionScore(signals, taskType) {
  const weights = {
    urlSignal: 0.3,
    domSignal: 0.25,
    aiReport: 0.2,
    actionChain: 0.15,
    pageStability: 0.1
  };
  let score = 0;
  const evidence = [];

  // URL signal
  if (signals.urlMatch) {
    score += weights.urlSignal;
    evidence.push('URL: ' + signals.urlMatch);
  }
  // DOM signal (any of: success message, confirmation page, toast, form reset with action chain)
  if (signals.domSuccess || signals.confirmationPage || signals.toast) {
    score += weights.domSignal;
    evidence.push('DOM: ' + (signals.domSuccess || signals.toast || 'confirmation page'));
  } else if (signals.formReset && signals.actionChainComplete) {
    // Form reset alone is weak (Pitfall: empty forms on load); combine with action chain
    score += weights.domSignal * 0.5;
    evidence.push('DOM: form reset + action chain');
  }
  // AI self-report
  if (signals.aiComplete && signals.aiResult.length >= 10) {
    score += weights.aiReport;
    evidence.push('AI: task complete');
  }
  // Action chain
  if (signals.actionChainComplete) {
    score += weights.actionChain;
    evidence.push('Actions: chain complete');
  }
  // Page stability
  if (signals.pageStable) {
    score += weights.pageStability;
    evidence.push('Page: stable');
  }

  return { score, evidence, threshold: 0.5 };
}

// --- Task-type-specific validators (CMP-01) ---
// Each returns { approved: boolean, score: number, evidence: string[], taskType: string }

function messagingValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  // Bonus: compose window closed or send button was clicked and verified
  const sendClicked = (session.criticalActionRegistry?.actions || []).some(a =>
    /send|submit|post|reply/i.test(a.elementText) && a.verified
  );
  if (sendClicked) {
    score = Math.min(1, score + 0.1);
    evidence.push('Messaging: send action verified');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'messaging' };
}

function formValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  // Bonus: URL changed after form submission
  if (signals.urlMatch && signals.actionChainComplete) {
    score = Math.min(1, score + 0.1);
    evidence.push('Form: URL changed + submit chain');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'form' };
}

function navigationValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  // URL change to expected target is a strong signal for navigation
  if (signals.urlMatch) {
    score = Math.min(1, score + 0.1);
    evidence.push('Navigation: URL matches target');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'navigation' };
}

function searchValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  // Search tasks have a low bar -- search + results page loaded
  if (signals.actionChainComplete) {
    score = Math.min(1, score + 0.05);
    evidence.push('Search: results obtained');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'search' };
}

function careerValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  const currentUrl = context.currentUrl || '';
  const isOnSheets = /docs\.google\.com\/spreadsheets/.test(currentUrl);
  if (isOnSheets && signals.actionChainComplete) {
    score = Math.min(1, score + 0.15);
    evidence.push('Career: data entered into Google Sheets');
  }
  const resultLower = (aiResponse.result || '').toLowerCase();
  if (/entered.*sheet|added.*sheet|spreadsheet/.test(resultLower)) {
    score = Math.min(1, score + 0.1);
    evidence.push('Career: AI confirmed sheet data entry');
  }
  const actionHistory = session.actionHistory || [];
  const getTextCount = actionHistory.filter(a => a.tool === 'getText').length;
  const typeCount = actionHistory.filter(a => a.tool === 'type').length;
  if (getTextCount >= 3 && typeCount >= 6) {
    score = Math.min(1, score + 0.1);
    evidence.push('Career: extraction+entry actions detected');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'career' };
}

function extractionValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  // Very permissive -- getText returned content
  if (signals.actionChainComplete && signals.aiResult.length >= 10) {
    score = Math.min(1, score + 0.1);
    evidence.push('Extraction: data extracted');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'extraction' };
}

function generalValidator(session, aiResponse, context, signals, scoreResult) {
  // Score-only decision, no bonuses
  return { approved: scoreResult.score >= 0.5, score: scoreResult.score, evidence: scoreResult.evidence, taskType: 'general' };
}

/**
 * CMP-01: Main completion validation dispatcher.
 * Replaces the ad-hoc isMessagingTask / critical-failures block.
 * @param {Object} session - The automation session
 * @param {Object} aiResponse - The AI response
 * @param {Object} context - The iteration context
 * @returns {{ approved: boolean, score: number, evidence: string[], taskType: string }}
 */
function validateCompletion(session, aiResponse, context) {
  // Require non-empty result from AI (keep existing check: length >= 10)
  if (!aiResponse.result || aiResponse.result.trim().length < 10) {
    return { approved: false, score: 0, evidence: ['AI result too short or missing'], taskType: 'unknown' };
  }

  const taskType = classifyTask(session.task);
  const signals = gatherCompletionSignals(session, aiResponse, context);
  const scoreResult = computeCompletionScore(signals, taskType);

  // Dispatch to task-type-specific validator
  const validators = {
    messaging: messagingValidator,
    email: messagingValidator,
    form: formValidator,
    shopping: formValidator,
    navigation: navigationValidator,
    search: searchValidator,
    career: careerValidator,
    extraction: extractionValidator,
    general: generalValidator
  };
  const validator = validators[taskType] || generalValidator;
  const result = validator(session, aiResponse, context, signals, scoreResult);

  automationLogger.debug('Completion signals gathered', {
    sessionId: session.id,
    taskType,
    signals: {
      urlMatch: signals.urlMatch,
      domSuccess: !!signals.domSuccess,
      confirmationPage: signals.confirmationPage,
      toast: !!signals.toast,
      formReset: signals.formReset,
      aiComplete: signals.aiComplete,
      actionChainComplete: signals.actionChainComplete,
      pageStable: signals.pageStable
    },
    score: result.score,
    approved: result.approved
  });

  return result;
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
  // Security: Only accept messages from our own extension contexts
  if (sender.id !== chrome.runtime.id) {
    console.warn('[FSB] Rejected message from unknown sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return;
  }

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

    case 'monacoEditorInsert':
      handleMonacoEditorInsert(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'contentScriptReady':
      // Content script signals it's ready and message listener is registered
      debugLog('[FSB Background] contentScriptReady received', { tab: sender.tab?.id, frame: sender.frameId });
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
          debugLog('[FSB Background] Tab marked as ready:', tabId);
          automationLogger.logInit('content_script', 'ready', { tabId, frameId, readyState: request.readyState, retry: request.retry || false });
        } else {
          debugLog('[FSB Background] Iframe ready ignored, frame:', frameId);
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

    case 'solveCaptcha':
      handleSolveCaptcha(request, sender, sendResponse);
      return true; // Will respond asynchronously

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

    // Credential management actions (Passwords Beta)
    case 'getCredential':
      (async () => {
        try {
          const cred = await secureConfig.getCredential(request.domain);
          sendResponse({ success: true, credential: cred });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getFullCredential':
      (async () => {
        try {
          const cred = await secureConfig.getFullCredential(request.domain);
          sendResponse({ success: true, credential: cred });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'saveCredential':
      (async () => {
        try {
          const result = await secureConfig.saveCredential(request.domain, request.data);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAllCredentials':
      (async () => {
        try {
          const credentials = await secureConfig.getAllCredentials();
          sendResponse({ success: true, credentials });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'deleteCredential':
      (async () => {
        try {
          const result = await secureConfig.deleteCredential(request.domain);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'updateCredential':
      (async () => {
        try {
          const result = await secureConfig.updateCredential(request.domain, request.updates);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    // Site Explorer message handlers
    case 'startExplorer':
      (async () => {
        try {
          const result = await siteExplorer.start(request.url, {
            maxDepth: request.maxDepth || 3,
            maxPages: request.maxPages || 25,
            callerTabId: sender.tab?.id || null
          });
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'stopExplorer':
      (async () => {
        try {
          const result = await siteExplorer.stop();
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getExplorerStatus':
      sendResponse(siteExplorer.getStatus());
      break;

    case 'getResearchList':
      (async () => {
        try {
          const stored = await chrome.storage.local.get(['fsbResearchIndex']);
          sendResponse({ success: true, list: stored.fsbResearchIndex || [] });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getResearchData':
      (async () => {
        try {
          const stored = await chrome.storage.local.get(['fsbResearchData']);
          const data = (stored.fsbResearchData || {})[request.researchId];
          if (data) {
            sendResponse({ success: true, data });
          } else {
            sendResponse({ success: false, error: 'Research not found' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'deleteResearch':
      (async () => {
        try {
          const stored = await chrome.storage.local.get(['fsbResearchData', 'fsbResearchIndex']);
          const researchData = stored.fsbResearchData || {};
          const researchIndex = stored.fsbResearchIndex || [];
          delete researchData[request.researchId];
          const updatedIndex = researchIndex.filter(r => r.id !== request.researchId);
          await chrome.storage.local.set({
            fsbResearchData: researchData,
            fsbResearchIndex: updatedIndex
          });
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    // --- Background Agent Management ---
    case 'createAgent':
      (async () => {
        try {
          const agent = await agentManager.createAgent(request.params);
          if (agent.enabled) {
            await agentScheduler.scheduleAgent(agent);
          }
          sendResponse({ success: true, agent });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'updateAgent':
      (async () => {
        try {
          const agent = await agentManager.updateAgent(request.agentId, request.updates);
          // Reschedule if schedule or enabled state changed
          if (agent.enabled) {
            await agentScheduler.scheduleAgent(agent);
          } else {
            await agentScheduler.clearAlarm(agent.agentId);
          }
          sendResponse({ success: true, agent });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'deleteAgent':
      (async () => {
        try {
          await agentScheduler.clearAlarm(request.agentId);
          await agentExecutor.forceStop(request.agentId);
          const deleted = await agentManager.deleteAgent(request.agentId);
          sendResponse({ success: deleted });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'listAgents':
      (async () => {
        try {
          const agents = await agentManager.listAgents();
          sendResponse({ success: true, agents });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'toggleAgent':
      (async () => {
        try {
          const agent = await agentManager.toggleAgent(request.agentId);
          if (agent.enabled) {
            await agentScheduler.scheduleAgent(agent);
          } else {
            await agentScheduler.clearAlarm(agent.agentId);
          }
          sendResponse({ success: true, agent });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'runAgentNow':
      (async () => {
        try {
          const agent = await agentManager.getAgent(request.agentId);
          if (!agent) {
            sendResponse({ success: false, error: 'Agent not found' });
            return;
          }
          // Execute immediately in background
          sendResponse({ success: true, message: 'Agent execution started' });
          const result = await agentExecutor.execute(agent);
          await agentManager.recordRun(agent.agentId, result);
          chrome.runtime.sendMessage({
            action: 'agentRunComplete',
            agentId: agent.agentId,
            result: { success: result.success, duration: result.duration, error: result.error }
          }).catch(() => {});
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAgentStats':
      (async () => {
        try {
          const stats = await agentManager.getStats();
          sendResponse({ success: true, stats });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAgentRunHistory':
      (async () => {
        try {
          const history = await agentManager.getRunHistory(request.agentId, request.limit || 10);
          sendResponse({ success: true, history });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'clearAgentScript':
      (async () => {
        try {
          await agentManager.clearRecordedScript(request.agentId);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAgentReplayInfo':
      (async () => {
        try {
          const agent = await agentManager.getAgent(request.agentId);
          if (!agent) {
            sendResponse({ success: false, error: 'Agent not found' });
            return;
          }
          sendResponse({
            success: true,
            replayEnabled: agent.replayEnabled !== false,
            hasScript: !!(agent.recordedScript && agent.recordedScript.steps && agent.recordedScript.steps.length > 0),
            scriptSteps: agent.recordedScript?.totalSteps || 0,
            recordedAt: agent.recordedScript?.recordedAt || null,
            replayStats: agent.replayStats || { totalReplays: 0, totalAISaves: 0, estimatedCostSaved: 0 }
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'toggleAgentReplay':
      (async () => {
        try {
          const agent = await agentManager.getAgent(request.agentId);
          if (!agent) {
            sendResponse({ success: false, error: 'Agent not found' });
            return;
          }
          const newValue = !(agent.replayEnabled !== false);
          await agentManager.updateAgent(request.agentId, { replayEnabled: newValue });
          sendResponse({ success: true, replayEnabled: newValue });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'replaySession':
      handleReplaySession(request, sender, sendResponse);
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

// ==========================================
// 2Captcha CAPTCHA Solver Relay
// ==========================================

/**
 * Known 2Captcha error codes mapped to user-friendly messages
 */
const TWOCAPTCHA_ERRORS = {
  'ERROR_WRONG_USER_KEY': 'Invalid 2Captcha API key. Check your key in FSB settings.',
  'ERROR_KEY_DOES_NOT_EXIST': 'Invalid 2Captcha API key. Check your key in FSB settings.',
  'ERROR_ZERO_BALANCE': '2Captcha account has no balance. Please add funds at 2captcha.com.',
  'ERROR_NO_SLOT_AVAILABLE': '2Captcha is busy. Please try again in a moment.',
  'ERROR_CAPTCHA_UNSOLVABLE': 'CAPTCHA could not be solved. It may be too distorted.',
  'ERROR_WRONG_CAPTCHA_ID': 'Internal error: invalid CAPTCHA task ID.',
  'ERROR_BAD_DUPLICATES': 'CAPTCHA solve failed due to inconsistent results.',
  'ERROR_PAGEURL': 'Invalid page URL provided for CAPTCHA solving.',
  'ERROR_PROXY': 'Proxy error during CAPTCHA solving.'
};

/**
 * Handle CAPTCHA solving via 2Captcha API
 * Content scripts cannot make cross-origin requests, so this relays through the background
 */
async function handleSolveCaptcha(request, sender, sendResponse) {
  const { captchaType, sitekey, pageUrl, apiKey } = request;

  try {
    // Validate inputs
    if (!apiKey) {
      sendResponse({ success: false, error: 'No 2Captcha API key configured. Add it in FSB settings.' });
      return;
    }
    if (!sitekey) {
      sendResponse({ success: false, error: 'Could not extract sitekey from the page.' });
      return;
    }
    if (!pageUrl) {
      sendResponse({ success: false, error: 'Page URL is required for CAPTCHA solving.' });
      return;
    }

    // Determine method based on CAPTCHA type
    let method;
    switch (captchaType) {
      case 'recaptcha':
        method = 'userrecaptcha';
        break;
      case 'hcaptcha':
        method = 'hcaptcha';
        break;
      case 'turnstile':
        method = 'turnstile';
        break;
      default:
        sendResponse({ success: false, error: `Unsupported CAPTCHA type: ${captchaType}` });
        return;
    }

    console.log(`[FSB] Submitting ${captchaType} CAPTCHA to 2Captcha...`);

    // Step 1: Submit CAPTCHA to 2Captcha (POST to keep API key out of URL/logs)
    const submitParams = new URLSearchParams({
      key: apiKey,
      method: method,
      googlekey: sitekey,
      pageurl: pageUrl,
      json: '1'
    });

    const submitResponse = await fetch('https://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: submitParams.toString()
    });
    const submitData = await submitResponse.json();

    if (submitData.status !== 1) {
      const errorMsg = TWOCAPTCHA_ERRORS[submitData.request] || `2Captcha error: ${submitData.request}`;
      console.error('[FSB] 2Captcha submit failed:', submitData.request);
      sendResponse({ success: false, error: errorMsg });
      return;
    }

    const taskId = submitData.request;
    console.log(`[FSB] 2Captcha task submitted: ${taskId}. Polling for result...`);

    // Step 2: Poll for result (every 5s, max 30 attempts = 150s)
    const maxAttempts = 30;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const resultParams = new URLSearchParams({
        key: apiKey,
        action: 'get',
        id: taskId,
        json: '1'
      });

      const resultResponse = await fetch('https://2captcha.com/res.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: resultParams.toString()
      });
      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        console.log(`[FSB] CAPTCHA solved successfully after ${(attempt + 1) * 5}s`);
        sendResponse({ success: true, token: resultData.request });
        return;
      }

      if (resultData.request !== 'CAPCHA_NOT_READY') {
        const errorMsg = TWOCAPTCHA_ERRORS[resultData.request] || `2Captcha error: ${resultData.request}`;
        console.error('[FSB] 2Captcha solve failed:', resultData.request);
        sendResponse({ success: false, error: errorMsg });
        return;
      }

      // CAPCHA_NOT_READY - continue polling
      debugLog(`2Captcha polling attempt ${attempt + 1}/${maxAttempts}...`);
    }

    // Timeout
    sendResponse({ success: false, error: 'CAPTCHA solve timed out after 150 seconds. The CAPTCHA may be too complex.' });

  } catch (error) {
    console.error('[FSB] CAPTCHA solve error:', error);
    sendResponse({ success: false, error: `CAPTCHA solve failed: ${error.message}` });
  }
}

async function handleStartAutomation(request, sender, sendResponse) {
  const { task, tabId, conversationId } = request;

  try {
    // Get the target tab ID (may be updated by smart tab management below)
    let targetTabId = tabId || sender.tab?.id;

    // Check for existing conversation session for follow-up reuse
    if (conversationId && conversationSessions.has(conversationId)) {
      const convEntry = conversationSessions.get(conversationId);
      const existingSession = activeSessions.get(convEntry.sessionId);
      if (existingSession && existingSession.status === 'idle') {
        // Reactivate the existing session
        reactivateSession(existingSession, task);
        const sessionId = convEntry.sessionId;
        convEntry.lastActiveTime = Date.now();

        // Inject follow-up context into AI
        const ai = sessionAIInstances.get(sessionId);
        if (ai && typeof ai.injectFollowUpContext === 'function') {
          ai.injectFollowUpContext(task);
        }

        // Log the follow-up command for session tracking
        automationLogger.logFollowUpCommand(sessionId, task, existingSession.commandCount);

        automationLogger.info('Reactivating conversation session', {
          sessionId, conversationId, commandCount: existingSession.commandCount
        });

        // Persist updated session
        persistSession(sessionId, existingSession);

        sendResponse({
          success: true,
          sessionId,
          message: 'Continuing conversation session',
          continued: true
        });

        startKeepAlive();

        // Reset DOM state for fresh analysis
        try {
          await chrome.tabs.sendMessage(existingSession.tabId, { action: 'resetDOMState', sessionId });
        } catch (e) {
          automationLogger.debug('Could not reset DOM state for follow-up', { sessionId, error: e.message });
        }

        startAutomationLoop(sessionId);
        return;
      }
    }

    // Get tab information to check URL
    let tabInfo;
    try {
      tabInfo = await chrome.tabs.get(targetTabId);
    } catch (error) {
      throw new Error(`Cannot access tab ${targetTabId}. Tab may have been closed or is not accessible.`);
    }

    // Track smart navigation for user feedback
    let navigationMessage = '';
    let navigationPerformed = false;
    const originalUrl = tabInfo.url;

    // ==========================================
    // SMART TAB MANAGEMENT
    // ==========================================
    // For restricted URLs (newtab, about:blank): must navigate somewhere
    // For non-restricted URLs: check if current tab is relevant, preserve user content
    if (isRestrictedURL(tabInfo.url)) {
      if (shouldUseSmartNavigation(tabInfo.url, task)) {
        const targetUrl = analyzeTaskAndGetTargetUrl(getFirstTaskSegment(task));
        const decision = await decideTabAction(targetTabId, tabInfo.url, targetUrl, task);
        automationLogger.logNavigation(null, 'smart', tabInfo.url, targetUrl, { task: task.substring(0, 100), decision: decision.action, reason: decision.reason });

        if (decision.action === 'switch') {
          // Switch to an already-open matching tab
          try {
            await chrome.tabs.update(decision.tabId, { active: true });
            targetTabId = decision.tabId;
            navigationMessage = `Switched to existing ${new URL(targetUrl).hostname} tab.`;
          } catch (switchErr) {
            // Tab may have been closed between discovery and switch - fall back to navigate
            automationLogger.debug('Tab switch failed, falling back to navigate', { error: switchErr.message });
            await chrome.tabs.update(targetTabId, { url: targetUrl });
            navigationMessage = `Navigated from ${getPageTypeDescription(originalUrl)} to ${new URL(targetUrl).hostname}.`;
          }
        } else {
          // Navigate current (restricted) tab to target
          await chrome.tabs.update(targetTabId, { url: targetUrl });
          navigationMessage = `Navigated from ${getPageTypeDescription(originalUrl)} to ${new URL(targetUrl).hostname}.`;
        }

        // Wait for tab to finish loading
        await new Promise((resolve) => {
          const navListener = (updatedTabId, changeInfo) => {
            if (updatedTabId === targetTabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(navListener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(navListener);
          setTimeout(() => { chrome.tabs.onUpdated.removeListener(navListener); resolve(); }, 10000);
        });

        // Refresh tabInfo after action
        try {
          tabInfo = await chrome.tabs.get(targetTabId);
        } catch (error) {
          throw new Error(`Tab became inaccessible after smart navigation to ${targetUrl}`);
        }
        navigationPerformed = true;
      } else {
        // Non-navigable restricted pages (settings, extensions, etc.)
        const chromeError = new Error(`Chrome security restrictions prevent extensions from accessing this type of page (${tabInfo.url}). Please navigate to a regular website to use automation.`);
        chromeError.isChromePage = true;
        throw chromeError;
      }
    } else {
      // Non-restricted URL: let the AI agent decide tab management.
      // The AI receives MULTI-TAB CONTEXT with all open tabs and has
      // listTabs/switchToTab/navigate tools to handle tab switching itself.
      // This avoids the hardcoded DOMAIN_KEYWORD_MAP which can't cover all sites.
      automationLogger.debug('Non-restricted URL, deferring tab decision to AI agent', {
        currentUrl: tabInfo.url,
        task: task.substring(0, 100)
      });
    }

    // Read settings from storage before creating session
    const storedSettings = await getStorageWithTimeout(
      ['maxIterations', 'animatedActionHighlights', 'domOptimization', 'maxDOMElements', 'prioritizeViewport'],
      3000,
      { maxIterations: 20, animatedActionHighlights: true, domOptimization: true, maxDOMElements: 2000, prioritizeViewport: true }
    );
    const userMaxIterations = parseInt(storedSettings.maxIterations) || 20;

    // Pre-populate allowedTabs with all non-restricted tabs in the current window
    // so the AI can switch to any tab the user already has open
    const allWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const initialAllowedTabs = allWindowTabs
      .filter(t => t.id && !isRestrictedURL(t.url))
      .map(t => t.id);
    if (!initialAllowedTabs.includes(targetTabId)) {
      initialAllowedTabs.push(targetTabId);
    }

    // Create new session with enhanced tracking
    const sessionId = `session_${Date.now()}`;
    const sessionData = {
      task,
      tabId: targetTabId,
      originalTabId: targetTabId,  // Store original tab - automation is restricted to this tab
      status: 'running',
      startTime: Date.now(),
      maxIterations: userMaxIterations, // User-configured iteration limit
      actionHistory: [],        // Track all actions executed
      stateHistory: [],         // Track DOM state changes
      failedAttempts: {},       // Track failed actions by type
      failedActionDetails: {},  // Track detailed failures by action signature
      lastDOMHash: null,        // Hash of last DOM state to detect changes (backward compat)
      lastDOMSignals: null,     // Multi-channel DOM signals for fine-grained change detection
      stuckCounter: 0,          // Counter for detecting stuck state
      consecutiveNoProgressCount: 0, // Counter for iterations with no meaningful progress (doesn't reset on URL change)
      iterationCount: 0,        // Total iterations
      urlHistory: [],           // Track URL changes
      lastUrl: null,            // Last known URL
      actionSequences: [],      // Track sequences of actions to detect patterns
      sequenceRepeatCount: {},  // Count how many times each sequence repeats
      allowedTabs: initialAllowedTabs, // All non-restricted tabs in the current window
      tabHistory: [],             // Track tab switches for debugging
      navigationMessage,        // Store navigation message for UI
      animatedActionHighlights: storedSettings.animatedActionHighlights ?? true,
      // Session continuity fields
      conversationId: conversationId || null,
      commandCount: 1,
      commands: [task],
      // PERF: Cache DOM settings at session start to avoid repeated storage reads
      domSettings: {
        domOptimization: storedSettings.domOptimization !== false,
        maxDOMElements: storedSettings.maxDOMElements || 2000,
        prioritizeViewport: storedSettings.prioritizeViewport !== false
      }
    };

    activeSessions.set(sessionId, sessionData);
    // Persist session to storage so stop button works after service worker restart
    persistSession(sessionId, sessionData);

    // Register in conversation sessions for follow-up reuse
    if (conversationId) {
      conversationSessions.set(conversationId, { sessionId, lastActiveTime: Date.now() });
      enforceMapLimit(conversationSessions, MAX_CONVERSATION_SESSIONS);
      persistConversationSessions();
    }

    automationLogger.logSessionStart(sessionId, task, sessionData.tabId);
    initializeSessionMetrics(sessionId);
    automationLogger.info('Created new session', { sessionId, tabId: sessionData.tabId, activeSessions: activeSessions.size, conversationId: conversationId || null });

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

    // Send status update to UI so user knows we're connecting
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      sessionId: sessionId,
      message: 'Connecting to page...'
    }).catch(() => {});

    const isReady = await waitForContentScriptReady(targetTabId, 5000);
    automationLogger.debug('Content script readiness check complete', { sessionId, tabId: targetTabId, isReady });

    // CRITICAL FIX: Check isReady and fail fast if content script is not available
    // Previously, isReady was captured but never checked, causing a 90-second death spiral
    // where the automation loop would start and waste time on health checks that inevitably fail
    if (!isReady) {
      // Do one final health check to be absolutely sure
      const finalHealthCheck = await checkContentScriptHealth(targetTabId);
      if (!finalHealthCheck) {
        automationLogger.warn('Content script not ready after waiting, aborting session', {
          sessionId,
          tabId: targetTabId
        });

        // Clean up the session
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'failed';
          const duration = Date.now() - session.startTime;
          automationLogger.logSessionEnd(sessionId, 'failed', 0, duration);
          automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});
          cleanupSession(sessionId);
        }

        // Send actionable error to UI
        chrome.runtime.sendMessage({
          action: 'automationError',
          sessionId: sessionId,
          error: 'Could not connect to the page. Please refresh the page and try again. If the problem persists, reload the extension from chrome://extensions.',
          task
        }).catch(() => {});

        return; // Exit early - do not start the automation loop
      }
    }

    // Send status update to UI
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      sessionId: sessionId,
      message: 'Connected. Analyzing page...'
    }).catch(() => {});

    // Send session status to content script for visual feedback
    sendSessionStatus(targetTabId, {
      phase: 'analyzing',
      taskName: task,
      iteration: 0,
      maxIterations: userMaxIterations,
      animatedHighlights: sessionData.animatedActionHighlights,
      progressPercent: 0,
      estimatedTimeRemaining: null,
      taskSummary: null
    });

    // Non-blocking task summarization (runs in parallel, does not delay start)
    config.getAll().then(settings => {
      summarizeTask(task, settings).then(summary => {
        const s = activeSessions.get(sessionId);
        if (s && summary) {
          s.taskSummary = summary;
        }
      });
    }).catch(() => {});

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


/**
 * Execute an automation task programmatically (used by background agents).
 * Creates a session, runs the automation loop, and returns a Promise with the result.
 * @param {number} tabId - Target tab ID (must already exist and be loaded)
 * @param {string} task - Task description for the AI
 * @param {Object} [options] - Execution options
 * @param {number} [options.maxIterations=15] - Max automation iterations
 * @param {boolean} [options.isBackgroundAgent=false] - If true, skip UI status messages
 * @param {string} [options.agentId] - Agent ID for tracking
 * @returns {Promise<Object>} { success, sessionId, result, error, duration, tokensUsed, costUsd, iterations }
 */
async function executeAutomationTask(tabId, task, options = {}) {
  const { maxIterations = 15, isBackgroundAgent = false, agentId = null } = options;

  return new Promise(async (resolve) => {
    try {
      const sessionId = `session_${Date.now()}`;
      const sessionData = {
        task,
        tabId: tabId,
        originalTabId: tabId,
        status: 'running',
        startTime: Date.now(),
        maxIterations: maxIterations,
        actionHistory: [],
        stateHistory: [],
        failedAttempts: {},
        failedActionDetails: {},
        lastDOMHash: null,
        stuckCounter: 0,
        consecutiveNoProgressCount: 0,
        iterationCount: 0,
        urlHistory: [],
        lastUrl: null,
        actionSequences: [],
        sequenceRepeatCount: {},
        isBackgroundAgent: isBackgroundAgent,
        agentId: agentId,
        animatedActionHighlights: false, // No highlights for background agents
        _completionCallback: resolve, // Store callback for when automation finishes
        // PERF: Cache DOM settings (use defaults for background agents)
        domSettings: {
          domOptimization: true,
          maxDOMElements: 2000,
          prioritizeViewport: true
        }
      };

      activeSessions.set(sessionId, sessionData);
      persistSession(sessionId, sessionData);

      automationLogger.logSessionStart(sessionId, task, tabId);
      initializeSessionMetrics(sessionId);

      startKeepAlive();

      // Reset DOM state
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'resetDOMState', sessionId });
      } catch (e) {
        // Content script may not be ready yet, proceed anyway
      }

      // Intercept completion messages for this session
      const originalCleanup = cleanupSession;

      // Patch: listen for automationComplete for this session to capture result
      const completionListener = (message) => {
        if (message.action === 'automationComplete' && message.sessionId === sessionId) {
          chrome.runtime.onMessage.removeListener(completionListener);
          const session = activeSessions.get(sessionId) || sessionData;
          const duration = Date.now() - sessionData.startTime;
          const metrics = performanceMetrics.sessionStats.get(sessionId);
          resolve({
            success: !message.partial && !message.error,
            sessionId,
            result: message.result || null,
            error: message.error || (message.partial ? 'Task completed partially: ' + (message.reason || 'unknown') : null),
            duration,
            tokensUsed: metrics?.totalActions || 0,
            costUsd: 0,
            iterations: session.iterationCount || 0,
            actionHistory: session.actionHistory || []
          });
        }

        if (message.action === 'automationError' && message.sessionId === sessionId) {
          chrome.runtime.onMessage.removeListener(completionListener);
          const duration = Date.now() - sessionData.startTime;
          resolve({
            success: false,
            sessionId,
            result: null,
            error: message.error || 'Automation error',
            duration,
            tokensUsed: 0,
            costUsd: 0,
            iterations: sessionData.iterationCount || 0
          });
        }
      };
      chrome.runtime.onMessage.addListener(completionListener);

      // Safety timeout - resolve after maxIterations * 30s max
      const safetyTimeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(completionListener);
        const duration = Date.now() - sessionData.startTime;
        resolve({
          success: false,
          sessionId,
          result: null,
          error: 'Execution safety timeout reached',
          duration,
          tokensUsed: 0,
          costUsd: 0,
          iterations: sessionData.iterationCount || 0
        });
      }, Math.min(maxIterations * 30000, 4 * 60 * 1000));

      // Store timeout for cleanup
      sessionData._safetyTimeout = safetyTimeout;

      // Start the automation loop
      startAutomationLoop(sessionId);

    } catch (error) {
      resolve({
        success: false,
        sessionId: null,
        result: null,
        error: error.message,
        duration: 0,
        tokensUsed: 0,
        costUsd: 0,
        iterations: 0
      });
    }
  });
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
      extractAndStoreMemories(sessionId, session).catch(() => {});

    // Tell content script to clean up visual overlays
    sendSessionStatus(session.tabId || session.originalTabId, {
      phase: 'ended',
      reason: 'stopped'
    });

    finalizeSessionMetrics(sessionId, false); // Stopped, not completed
    await cleanupSession(sessionId); // Await to ensure full cleanup before responding

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
    const providerApiKeyMap = {
      xai: { key: 'apiKey', name: 'xAI' },
      gemini: { key: 'geminiApiKey', name: 'Gemini' },
      openai: { key: 'openaiApiKey', name: 'OpenAI' },
      anthropic: { key: 'anthropicApiKey', name: 'Anthropic' }
    };
    const testProviderConfig = providerApiKeyMap[provider];
    if (testProviderConfig && !settings[testProviderConfig.key]) {
      sendResponse({
        success: false,
        error: `${testProviderConfig.name} API key not configured. Please set it in extension settings.`
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
          batchPattern: pattern.name,
          animatedHighlights: session?.animatedActionHighlights ?? true
        }
      });

      results.push({
        action,
        result: actionResult,
        duration: Date.now() - actionStartTime
      });

      // Track in session action history (slim result to reduce memory and prompt token usage)
      if (session) {
        session.actionHistory.push({
          timestamp: Date.now(),
          tool: action.tool,
          params: action.params,
          result: slimActionResult(actionResult),
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

// ==========================================
// Login Detection Helpers (Passwords Beta)
// ==========================================

// Wait for the user to respond to a login prompt (submit or skip)
function waitForLoginResponse(sessionId) {
  return new Promise((resolve) => {
    // Set a timeout to auto-skip after 2 minutes
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      resolve({ action: 'loginSkipped', sessionId, reason: 'timeout' });
    }, 120000);

    const handler = (request, sender, sendResponse) => {
      if (request.sessionId === sessionId &&
          (request.action === 'loginFormSubmitted' || request.action === 'loginSkipped')) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(request);
        sendResponse({ received: true });
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    // Store reference for cleanup on session termination
    const session = activeSessions.get(sessionId);
    if (session) {
      session._loginHandler = { handler, timeout };
    }
  });
}

// Extract login field selectors from DOM analysis
function extractLoginFields(domData) {
  const elements = domData?.elements || [];
  let usernameSelector = null;
  let passwordSelector = null;
  let submitSelector = null;
  let usernameType = 'text';
  let passwordFormId = null;

  // Find password field and record its form context
  for (const el of elements) {
    if (el.type === 'input' && el.attributes?.type === 'password') {
      passwordSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null) || 'input[type="password"]';
      passwordFormId = el.formId || null;
      break;
    }
  }

  // Helper: check if an element looks like a search input (not a login field)
  function isSearchInput(el) {
    const role = el.attributes?.role || '';
    const placeholder = (el.attributes?.placeholder || '').toLowerCase();
    const ariaLabel = (el.attributes?.['aria-label'] || '').toLowerCase();
    return role === 'combobox' || role === 'search' ||
           placeholder.includes('search') || ariaLabel.includes('search');
  }

  // Find username/email field: input[type=text|email] near password, or with matching name/id
  const usernamePatterns = /user|email|login|account|name|ident/i;
  for (const el of elements) {
    if (el.type !== 'input') continue;
    const inputType = el.attributes?.type || 'text';
    if (!['text', 'email', 'tel'].includes(inputType)) continue;

    const nameOrId = (el.id || '') + (el.attributes?.name || '') + (el.attributes?.placeholder || '');
    if (usernamePatterns.test(nameOrId) || inputType === 'email') {
      usernameSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      usernameType = inputType === 'email' ? 'email' : 'text';
      break;
    }
  }

  // If no username found by pattern but we know the password's form, search within that form
  if (!usernameSelector && passwordFormId) {
    for (const el of elements) {
      if (el.type !== 'input') continue;
      if (el.formId !== passwordFormId) continue;
      const inputType = el.attributes?.type || 'text';
      if (!['text', 'email', 'tel'].includes(inputType)) continue;
      if (isSearchInput(el)) continue;

      usernameSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      usernameType = inputType === 'email' ? 'email' : 'text';
      automationLogger.debug('Username found via form-scoped search', { formId: passwordFormId, selector: usernameSelector });
      break;
    }
  }

  // Last fallback: first text/email input that isn't password and isn't a search input
  if (!usernameSelector) {
    for (const el of elements) {
      if (el.type !== 'input') continue;
      const inputType = el.attributes?.type || 'text';
      if (!['text', 'email', 'tel'].includes(inputType)) continue;
      if (isSearchInput(el)) continue;

      usernameSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      break;
    }
  }

  // Find submit button
  const submitPatterns = /log.?in|sign.?in|submit|continue|next/i;
  for (const el of elements) {
    if (el.type !== 'button' && !(el.type === 'input' && el.attributes?.type === 'submit')) continue;
    const text = (el.text || '') + (el.attributes?.value || '') + (el.attributes?.['aria-label'] || '');
    if (submitPatterns.test(text)) {
      submitSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      break;
    }
  }

  // Fallback: any button[type=submit] or input[type=submit]
  if (!submitSelector) {
    for (const el of elements) {
      if (el.attributes?.type === 'submit') {
        submitSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
        break;
      }
    }
  }

  return { usernameSelector, passwordSelector, submitSelector, usernameType };
}

// Fill credentials on page using saved credentials (looks up from storage)
async function fillCredentialsOnPage(tabId, domain, domData) {
  const cred = await secureConfig.getCredential(domain);
  if (!cred) return { success: false, error: 'No credentials found' };

  const fields = extractLoginFields(domData);

  return await fillCredentialsOnPageDirect(tabId, {
    usernameSelector: fields.usernameSelector,
    passwordSelector: fields.passwordSelector,
    submitSelector: fields.submitSelector,
    username: cred.username,
    password: cred.password
  });
}

// Fill credentials on page directly via chrome.scripting.executeScript
// This avoids sending credentials over message passing where they could be intercepted
// Uses React-compatible native setter to work with frameworks that intercept value changes
async function fillCredentialsOnPageDirect(tabId, { usernameSelector, passwordSelector, submitSelector, username, password }) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (uSel, pSel, sSel, u, p) => {
        // React-compatible value setter: uses the native HTMLInputElement prototype setter
        // which triggers React's synthetic event system, unlike direct .value assignment
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'value'
        ).set;

        function setInputValue(el, value) {
          if (!el) return false;
          el.focus();
          // Use native setter to bypass React's interception
          nativeInputValueSetter.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));

          // Verify the value stuck
          if (el.value === value) return true;

          // Fallback: select all + insertText (works with most frameworks)
          el.focus();
          el.select();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, value);

          return el.value === value;
        }

        const uEl = uSel ? document.querySelector(uSel) : null;
        const pEl = pSel ? document.querySelector(pSel) : null;

        const uFilled = setInputValue(uEl, u);
        const pFilled = setInputValue(pEl, p);

        // Verify both fields after filling
        const uVerified = uEl ? uEl.value === u : false;
        const pVerified = pEl ? pEl.value === p : false;

        // Delay submit click to let framework state updates settle
        if (sSel) {
          setTimeout(() => {
            const sEl = document.querySelector(sSel);
            if (sEl) sEl.click();
          }, 300);
        }

        return {
          success: uVerified && pVerified,
          filledUsername: uFilled,
          filledPassword: pFilled,
          usernameVerified: uVerified,
          passwordVerified: pVerified
        };
      },
      args: [usernameSelector, passwordSelector, submitSelector, username, password],
      world: 'MAIN'
    });
    const result = results[0]?.result || { success: false, error: 'No result from script injection' };
    automationLogger.debug('fillCredentialsOnPageDirect result', result);
    return result;
  } catch (error) {
    console.error('[FSB] fillCredentialsOnPageDirect error:', error.message || 'Unknown error');
    return { success: false, error: 'Credential fill failed' };
  }
}

// Fast DJB2-style string hash for signal channel generation
function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}

// Multi-signal DOM change detection
// Returns 4 independent signal channels + raw data for downstream descriptor generation
// Each channel detects a different class of change the old single-hash missed
function createDOMSignals(domState) {
  const elements = domState.elements || [];

  // --- Structural signal: element type distribution ---
  const typeCounts = {};
  for (const el of elements) {
    const t = el.type;
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}:${count}`)
    .join(',');
  const structural = quickHash(topTypes);

  // --- Content signal: text/value from interactive elements ---
  const interactiveRoles = new Set(['alert', 'status', 'dialog', 'alertdialog']);
  const contentElements = elements
    .filter(el => el.isInput || el.isButton || (el.attributes?.role && interactiveRoles.has(el.attributes.role)))
    .sort((a, b) => (a.elementId || '').localeCompare(b.elementId || ''))
    .slice(0, 15);
  const contentParts = [];
  for (const el of contentElements) {
    if (el.isInput) {
      const label = el.attributes?.name || el.id || '';
      const val = (el.value || el.text || '').substring(0, 20);
      // Skip purely numeric values (timestamps, counters)
      if (val && !/^\d+$/.test(val)) {
        contentParts.push(`${label}:${val}`);
      }
    } else {
      const txt = (el.text || '').substring(0, 30);
      if (txt && !/^\d+$/.test(txt)) {
        contentParts.push(txt);
      }
    }
  }
  const content = quickHash(contentParts.join('|'));

  // --- Interaction signal: disabled/checked/readonly state ---
  // Explicitly EXCLUDES focused state (focus changes every iteration from AI actions)
  const interactionElements = elements
    .filter(el => el.isInput || el.isButton)
    .slice(0, 20);
  const interactionParts = [];
  for (const el of interactionElements) {
    const label = el.id || el.type || '';
    const flags = [];
    if (el.interactionState?.disabled) flags.push('D');
    if (el.interactionState?.checked) flags.push('C');
    if (el.interactionState?.readonly) flags.push('R');
    if (flags.length > 0) {
      interactionParts.push(`${label}:${flags.join('')}`);
    }
  }
  const interaction = quickHash(interactionParts.join('|'));

  // --- Page state signal: URL, title, element count, modals, alerts ---
  let urlPath = '';
  try {
    urlPath = new URL(domState.url || '').pathname;
  } catch { urlPath = domState.url || ''; }
  const hasModal = elements.some(el => {
    const r = el.attributes?.role;
    return r === 'dialog' || r === 'alertdialog';
  });
  const hasAlert = elements.some(el => {
    const r = el.attributes?.role;
    return r === 'alert' || r === 'status';
  });
  const pageStateFlags = {
    urlPath,
    title: domState.title || '',
    elementCount: elements.length,
    hasModal,
    hasAlert,
    captchaPresent: domState.captchaPresent || false
  };
  const pageState = quickHash(JSON.stringify(pageStateFlags));

  return {
    structural,
    content,
    interaction,
    pageState,
    _raw: { topTypes, elementCount: elements.length, pageStateFlags }
  };
}

// Compare two signal objects channel by channel
// Returns { changed: boolean, channels: string[], summary: string }
function compareSignals(current, previous) {
  if (!previous) {
    return { changed: true, channels: ['initial'], summary: 'First DOM snapshot' };
  }
  const changedChannels = [];
  if (current.structural !== previous.structural) changedChannels.push('structural');
  if (current.content !== previous.content) changedChannels.push('content');
  if (current.interaction !== previous.interaction) changedChannels.push('interaction');
  if (current.pageState !== previous.pageState) changedChannels.push('pageState');
  return {
    changed: changedChannels.length > 0,
    channels: changedChannels,
    summary: changedChannels.length > 0
      ? `Changed: ${changedChannels.join(', ')}`
      : 'No changes detected'
  };
}

// Parse topTypes string into a Map for diffing (e.g., "button:12,input:8" -> Map{button=>12, input=>8})
function parseTopTypes(topTypesStr) {
  const map = new Map();
  if (!topTypesStr) return map;
  for (const entry of topTypesStr.split(',')) {
    const [type, count] = entry.split(':');
    if (type && count) map.set(type.trim(), parseInt(count, 10));
  }
  return map;
}

// COMPAT: Backward-compatible wrapper -- returns a single hash string
// Used by automationLogger.logIteration() and stateHistory.domHash
function createDOMHash(domState) {
  const signals = createDOMSignals(domState);
  return '' + signals.structural + signals.content + signals.interaction + signals.pageState;
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
        // Allow switching to tabs in the session's allowedTabs whitelist
        const switchRequest = { ...mockRequest };
        if (switchRequest.tabId && typeof switchRequest.tabId === 'string') {
          switchRequest.tabId = parseInt(switchRequest.tabId, 10);
        }

        // Find the session for this tab
        const session = Array.from(activeSessions.values()).find(s => s.tabId === currentTabId);
        const isAllowed = session && (
          switchRequest.tabId === session.originalTabId ||
          (session.allowedTabs || []).includes(switchRequest.tabId)
        );

        if (session && !isAllowed) {
          automationLogger.warn('Tab switch blocked', { allowedTabs: session.allowedTabs, requestedTabId: switchRequest.tabId });
          resolve({
            success: false,
            error: `Security restriction: Tab ${switchRequest.tabId} is not in the session's allowed tabs. Allowed: [${(session.allowedTabs || []).join(', ')}].`,
            blocked: true
          });
          return;
        }

        // Perform the actual tab switch
        chrome.tabs.update(switchRequest.tabId, { active: true })
          .then(async () => {
            if (session) {
              session.tabId = switchRequest.tabId;
            }

            // Wait for the target tab to finish loading before checking content script
            try {
              const targetTab = await chrome.tabs.get(switchRequest.tabId);
              if (targetTab.status === 'loading') {
                await new Promise((resolveLoad) => {
                  const onUpdated = (tabId, changeInfo) => {
                    if (tabId === switchRequest.tabId && changeInfo.status === 'complete') {
                      chrome.tabs.onUpdated.removeListener(onUpdated);
                      resolveLoad();
                    }
                  };
                  chrome.tabs.onUpdated.addListener(onUpdated);
                  // Safety timeout to avoid hanging indefinitely
                  setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    resolveLoad();
                  }, 5000);
                });
              }
            } catch (tabErr) {
              automationLogger.debug('Could not check target tab status', { tabId: switchRequest.tabId, error: tabErr.message });
            }

            const contentScriptReady = await waitForContentScriptReady(switchRequest.tabId, 5000).catch(() => false);
            automationLogger.debug('Tab switch allowed and executed', { tabId: switchRequest.tabId, contentScriptReady });
            resolve({
              success: true,
              message: contentScriptReady
                ? `Switched to tab ${switchRequest.tabId}`
                : `Switched to tab ${switchRequest.tabId} (content script not yet ready -- DOM will be fetched on next iteration)`,
              tabId: switchRequest.tabId,
              contentScriptReady
            });
          })
          .catch((switchErr) => {
            automationLogger.warn('Tab switch failed', { tabId: switchRequest.tabId, error: switchErr.message });
            resolve({
              success: false,
              error: `Failed to switch to tab ${switchRequest.tabId}: ${switchErr.message}`
            });
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

  // Update content script with iteration progress
  sendSessionStatus(session.tabId, {
    phase: 'analyzing',
    taskName: session.task,
    iteration: session.iterationCount,
    maxIterations: session.maxIterations || 20,
    animatedHighlights: session.animatedActionHighlights,
    statusText: null,  // Don't carry over previous action text; let content.js show "Analyzing page..."
    ...calculateProgress(session),
    taskSummary: session.taskSummary || null
  });

  // === SAFETY NET: Absolute iteration cap and session time limit ===
  const ABSOLUTE_MAX_ITERATIONS = session.maxIterations || 20;
  const MAX_SESSION_DURATION = 5 * 60 * 1000; // 5 minutes
  const sessionAge = Date.now() - (session.startTime || Date.now());

  if (session.iterationCount > ABSOLUTE_MAX_ITERATIONS) {
    automationLogger.warn('Absolute iteration cap reached', {
      sessionId,
      iterationCount: session.iterationCount,
      maxIterations: ABSOLUTE_MAX_ITERATIONS
    });
    session.status = 'max_iterations';

    const duration = Date.now() - session.startTime;
    const finalResult = 'Reached the maximum number of iterations (' + ABSOLUTE_MAX_ITERATIONS + '). ' +
      'The task may be too complex for a single session. Try breaking it into smaller steps.';

    automationLogger.logSessionEnd(sessionId, 'max_iterations', session.actionHistory.length, duration);
    automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});

    sendSessionStatus(session.tabId, { phase: 'ended', reason: 'max_iterations' });
    finalizeSessionMetrics(sessionId, false);
    idleSession(sessionId); // Idle instead of cleanup -- allow follow-up continuation

    chrome.runtime.sendMessage({
      action: 'automationComplete',
      sessionId,
      result: finalResult,
      partial: true,
      reason: 'max_iterations'
    }).catch(() => {});

    loopResolve?.();
    return;
  }

  if (sessionAge > MAX_SESSION_DURATION) {
    automationLogger.warn('Session time limit exceeded', {
      sessionId,
      sessionAge,
      maxDuration: MAX_SESSION_DURATION,
      iterationCount: session.iterationCount
    });
    session.status = 'timeout';

    const finalResult = 'Session timed out after ' + Math.round(sessionAge / 1000) + ' seconds. ' +
      'Try breaking the task into smaller steps.';

    automationLogger.logSessionEnd(sessionId, 'timeout', session.actionHistory.length, sessionAge);
    automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});

    sendSessionStatus(session.tabId, { phase: 'ended', reason: 'timeout' });
    finalizeSessionMetrics(sessionId, false);
    idleSession(sessionId); // Idle instead of cleanup -- allow follow-up continuation

    chrome.runtime.sendMessage({
      action: 'automationComplete',
      sessionId,
      result: finalResult,
      partial: true,
      reason: 'timeout'
    }).catch(() => {});

    loopResolve?.();
    return;
  }

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
        // FIX: Log the health check attempt WITHOUT claiming success yet
        // Previously logged success:true before the check ran, making comm logs misleading
        automationLogger.logComm(sessionId, 'health', 'healthCheck_attempt', true, { tabId: session.originalTabId, attempt, maxRetries: maxHealthRetries });
        healthOk = await checkContentScriptHealth(session.originalTabId);

        // Log the ACTUAL result of the health check
        automationLogger.logComm(sessionId, 'health', 'healthCheck', healthOk, { tabId: session.originalTabId, attempt, status: healthOk ? 'healthy' : 'failed' });

        if (healthOk) {
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
        error: `Failed to communicate with the page (${tabUrl}). The content script may not have loaded yet. Try refreshing the page. Error: ${healthError.message}`,
        task: session.task
      }).catch(() => {});

      // Stop the session
      session.status = 'failed';
      const duration = Date.now() - session.startTime;
      automationLogger.logSessionEnd(sessionId, 'failed', session.actionHistory.length, duration);
      automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});
      sendSessionStatus(session.tabId, { phase: 'ended', reason: 'error' });
      cleanupSession(sessionId);
      return;
    }

    // Get current DOM state with enhanced error handling
    // SPEED-02: Check for pending prefetch first
    let domResponse;
    let usedPrefetch = false;
    try {
      // PERF: Use session-cached DOM settings instead of reading from storage each iteration
      const settings = session.domSettings || { domOptimization: true, maxDOMElements: 2000, prioritizeViewport: true };
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
            // Safety net: verify prefetch URL matches current tab URL
            // Catches stale prefetches from before navigation (e.g., click that redirects)
            try {
              const currentTab = await chrome.tabs.get(session.tabId);
              const prefetchUrl = domResponse.structuredDOM?.url || domResponse.structuredDOM?.htmlContext?.pageStructure?.url || '';
              const tabUrl = currentTab?.url || '';
              if (prefetchUrl && tabUrl) {
                const prefetchOrigin = new URL(prefetchUrl).origin;
                const tabOrigin = new URL(tabUrl).origin;
                if (prefetchOrigin !== tabOrigin) {
                  automationLogger.debug('Prefetch URL mismatch, fetching fresh DOM', {
                    sessionId, prefetchUrl, tabUrl
                  });
                  domResponse = null; // Discard stale prefetch
                  usedPrefetch = false;
                }
              }
            } catch (urlCheckErr) {
              // URL check failed - still use the prefetch rather than failing
              automationLogger.debug('Prefetch URL verification failed, using prefetch anyway', {
                sessionId, error: urlCheckErr.message
              });
            }

            if (domResponse) {
              automationLogger.logTiming(sessionId, 'DOM', 'prefetch_consumed', Date.now() - domFetchStart, {
                tabId: session.tabId,
                source: 'prefetch'
              });
            }
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
            prioritizeViewport: settings.prioritizeViewport !== false,
            includeCompactSnapshot: true
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

    // PERF: Event-driven SPA element detection (replaces 6-iteration polling loop)
    // Uses MutationObserver in content script to detect elements as soon as they render
    const initialElementCount = domResponse.structuredDOM.elements?.length || 0;
    const initialTotalElements = domResponse.structuredDOM._totalElements || initialElementCount;
    const urlRecentlyChanged = session.lastUrl && session.lastUrl !== domResponse.structuredDOM.url;

    if (initialTotalElements === 0 && (urlRecentlyChanged || session.iterationCount <= 2)) {
      automationLogger.debug('Zero elements detected after navigation, waiting for SPA render', {
        sessionId,
        url: domResponse.structuredDOM.url,
        iteration: session.iterationCount
      });

      if (isSessionTerminating(sessionId)) {
        loopResolve?.();
        return;
      }

      try {
        const waitResult = await sendMessageWithRetry(session.tabId, {
          action: 'waitForInteractiveElements',
          timeout: 3000
        });

        if (waitResult?.found) {
          automationLogger.debug('SPA elements appeared via MutationObserver', {
            sessionId,
            elementCount: waitResult.elementCount,
            waitTime: waitResult.waitTime
          });

          // Fetch fresh DOM now that elements exist
          domResponse = await sendMessageWithRetry(session.tabId, {
            action: 'getDOM',
            options: {
              useIncrementalDiff: false,
              maxElements: settings.maxDOMElements || 2000,
              prioritizeViewport: settings.prioritizeViewport !== false,
              includeCompactSnapshot: true
            }
          });
        } else {
          automationLogger.debug('SPA wait timed out, proceeding with empty DOM', {
            sessionId,
            waitTime: waitResult?.waitTime
          });
        }
      } catch (e) {
        automationLogger.debug('SPA MutationObserver wait failed, proceeding', { sessionId, error: e.message });
      }
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
    const currentDOMSignals = createDOMSignals(domResponse.structuredDOM);
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
    
    // Multi-signal change detection: compare current signals against previous
    const changeResult = compareSignals(currentDOMSignals, session.lastDOMSignals);

    // Build structured change descriptor with human-readable summary
    const changeSignals = {
      changed: changeResult.changed,
      channels: changeResult.channels,
      summary: []
    };

    if (changeResult.channels.length === 1 && changeResult.channels[0] === 'initial') {
      changeSignals.summary = ['First DOM snapshot -- no comparison available'];
    } else {
      // Structural channel: diff topTypes to report WHICH element types appeared/disappeared
      if (changeResult.channels.includes('structural')) {
        const prevTopTypes = parseTopTypes(session.lastDOMSignals?._raw?.topTypes);
        const currTopTypes = parseTopTypes(currentDOMSignals._raw.topTypes);
        let structuralItems = [];

        // Types in current but not previous
        for (const [type, count] of currTopTypes) {
          if (!prevTopTypes.has(type)) {
            structuralItems.push(`${type} elements appeared`);
          }
        }
        // Types in previous but not current
        for (const [type, count] of prevTopTypes) {
          if (!currTopTypes.has(type)) {
            structuralItems.push(`${type} elements removed`);
          }
        }
        // Types with count changes
        for (const [type, count] of currTopTypes) {
          if (prevTopTypes.has(type) && prevTopTypes.get(type) !== count) {
            const countDelta = count - prevTopTypes.get(type);
            structuralItems.push(`${Math.abs(countDelta)} ${type} elements ${countDelta > 0 ? 'added' : 'removed'}`);
          }
        }
        // Edge case: hashes differ but topTypes maps are identical
        if (structuralItems.length === 0) {
          structuralItems.push('element structure changed');
        }

        // Append overall element count delta to last structural item
        const prevCount = session.lastDOMSignals?._raw?.elementCount || 0;
        const currCount = currentDOMSignals._raw.elementCount;
        if (prevCount !== currCount) {
          const countDelta = currCount - prevCount;
          structuralItems[structuralItems.length - 1] += ` (${Math.abs(countDelta)} elements net ${countDelta > 0 ? 'added' : 'removed'})`;
        }

        changeSignals.summary.push(...structuralItems);
      }

      // Content channel
      if (changeResult.channels.includes('content')) {
        changeSignals.summary.push('page content changed (text or input values)');
      }

      // Interaction channel
      if (changeResult.channels.includes('interaction')) {
        changeSignals.summary.push('element states changed (disabled, checked, or readonly)');
      }

      // Page state channel: report specific changes
      if (changeResult.channels.includes('pageState')) {
        const prevFlags = session.lastDOMSignals?._raw?.pageStateFlags;
        const currFlags = currentDOMSignals._raw.pageStateFlags;
        if (prevFlags) {
          if (!prevFlags.hasModal && currFlags.hasModal) changeSignals.summary.push('modal/dialog opened');
          if (prevFlags.hasModal && !currFlags.hasModal) changeSignals.summary.push('modal/dialog closed');
          if (!prevFlags.hasAlert && currFlags.hasAlert) changeSignals.summary.push('alert/status message appeared');
          if (prevFlags.hasAlert && !currFlags.hasAlert) changeSignals.summary.push('alert/status message removed');
          if (prevFlags.title !== currFlags.title) changeSignals.summary.push(`title changed to "${currFlags.title.substring(0, 60)}"`);
        }
      }
    }

    // Derive domChanged from changeResult for backward compatibility and reuse
    let domChanged = changeResult.changed;

    // Multi-signal stuck detection
    if (!changeResult.changed && !urlChanged) {
      // No signal changes detected -- apply stuck detection logic

      // Safety net: typing-sequence special-case (catches edge cases where content
      // sampling misses the change, e.g., typing into fields not in the sampled set)
      const recentActions = session.actionHistory.slice(-3);
      const isTypingSequence = recentActions.length > 0 &&
        recentActions.every(action => ['type', 'clearInput', 'selectText', 'focus', 'blur', 'pressEnter', 'keyPress'].includes(action.tool));

      if (isTypingSequence) {
        const lastAction = recentActions[recentActions.length - 1];
        const sameTypeRepeats = recentActions.filter(action =>
          action.tool === lastAction?.tool &&
          JSON.stringify(action.params) === JSON.stringify(lastAction?.params)
        ).length;

        const recentTypeActions = session.actionHistory.slice(-5).filter(a => a.tool === 'type');
        const allTypingFailed = recentTypeActions.length >= 3 &&
                                recentTypeActions.every(a => !a.result?.success);

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
    } else if (changeResult.changed) {
      // Channel-aware stuck counter management
      const substantiveChannels = changeResult.channels.filter(ch => ch !== 'interaction');
      if (substantiveChannels.length > 0) {
        // Structural, content, or pageState changed -- definite progress
        session.stuckCounter = 0;
        automationLogger.debug('Stuck counter reset: substantive DOM change', { sessionId, channels: changeResult.channels });
      } else {
        // Only interaction changed (focus moved, element state toggled) -- reduce penalty
        session.stuckCounter = Math.max(0, session.stuckCounter - 1);
        automationLogger.debug('Stuck counter reduced: interaction-only change', { sessionId, stuckCounter: session.stuckCounter });
      }
    } else {
      // URL changed -- reset stuck counter
      session.stuckCounter = 0;
    }

    session.lastDOMHash = currentDOMHash;
    session.lastDOMSignals = currentDOMSignals;

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

    // ==========================================
    // LOGIN DETECTION HOOK (Passwords Beta)
    // ==========================================
    const enableLogin = settings.enableLogin === true;
    const domElements = domResponse.structuredDOM?.elements || [];
    const domForms = domResponse.structuredDOM?.htmlContext?.pageStructure?.forms || [];
    const hasPasswordField = domElements.some(el =>
      el.type === 'input' && (
        el.inputType === 'password' ||
        el.attributes?.type === 'password' ||
        (el.id && el.id.includes('password')) ||
        el.selectors?.some(s => typeof s === 'string' && s.includes('type="password"'))
      )
    ) || domForms.some(f => f.fields?.some(field => field.type === 'password'));

    if (enableLogin && hasPasswordField && !session._loginHandledForUrl?.includes(currentUrl)) {
      const loginDomain = secureConfig.normalizeDomain(currentUrl);
      automationLogger.debug('Login page detected', { sessionId, domain: loginDomain, url: currentUrl });

      // Track that we've handled login for this URL to avoid repeated prompts
      if (!session._loginHandledForUrl) session._loginHandledForUrl = [];

      // Check for saved credentials
      const savedCred = await secureConfig.getCredential(loginDomain);

      if (savedCred) {
        // SILENT AUTO-FILL: use saved credentials
        automationLogger.info('Auto-filling saved credentials', { sessionId, domain: loginDomain });

        sendSessionStatus(session.tabId, {
          phase: 'acting',
          taskName: session.task,
          iteration: session.iterationCount,
          maxIterations: session.maxIterations || 20,
          statusText: 'Signing in...',
          animatedHighlights: session.animatedActionHighlights
        });

        const signinProgress = calculateProgress(session);
        chrome.runtime.sendMessage({
          action: 'statusUpdate',
          sessionId,
          message: 'Signing in...',
          iteration: session.iterationCount,
          maxIterations: session.maxIterations || 20,
          progressPercent: signinProgress.progressPercent
        }).catch(() => {});

        const loginFields = extractLoginFields(domResponse.structuredDOM);
        const fillResult = await fillCredentialsOnPage(session.tabId, loginDomain, domResponse.structuredDOM);

        automationLogger.debug('Auto-fill result', { sessionId, success: fillResult?.success, filledUsername: fillResult?.filledUsername, filledPassword: fillResult?.filledPassword, usernameVerified: fillResult?.usernameVerified, passwordVerified: fillResult?.passwordVerified });

        if (fillResult?.success) {
          session._loginHandledForUrl.push(currentUrl);

          // Wait for page to settle after login submission
          await new Promise(r => setTimeout(r, 2000));

          // Check if login actually succeeded (URL changed = redirect after login)
          try {
            const tab = await chrome.tabs.get(session.tabId);
            const newUrl = tab?.url || '';
            if (newUrl === currentUrl) {
              // Still on login page - login may have failed, allow re-detection
              const idx = session._loginHandledForUrl.indexOf(currentUrl);
              if (idx !== -1) session._loginHandledForUrl.splice(idx, 1);
              automationLogger.debug('Still on login page after fill - re-enabling detection', { sessionId });
            }
          } catch (e) { /* tab may be gone */ }

          // Auto-fill succeeded -- restart loop to verify login worked
          loopResolve?.();
          if (!isSessionTerminating(sessionId) && activeSessions.has(sessionId)) {
            setTimeout(() => startAutomationLoop(sessionId), 500);
          }
          return;
        }
        // Auto-fill failed -- fall through to AI call so it can handle the login form
        automationLogger.info('Auto-fill failed, deferring to AI for login handling', { sessionId, domain: loginDomain });
        session._loginHandledForUrl.push(currentUrl); // Prevent re-triggering hook next iteration
      } else {
        // NO SAVED CREDS: interrupt sidepanel for credentials
        const loginFields = extractLoginFields(domResponse.structuredDOM);
        automationLogger.info('No saved credentials, requesting from user', { sessionId, domain: loginDomain });

        chrome.runtime.sendMessage({
          action: 'loginDetected',
          sessionId,
          domain: loginDomain,
          fields: loginFields
        }).catch(() => {});

        // PAUSE: wait for user response
        const userResponse = await waitForLoginResponse(sessionId);

        if (userResponse.action === 'loginFormSubmitted') {
          // Save credentials if requested
          if (userResponse.save) {
            await secureConfig.saveCredential(loginDomain, {
              username: userResponse.credentials.username,
              password: userResponse.credentials.password
            });
          }

          // Fill the form on page
          const directFillResult = await fillCredentialsOnPageDirect(session.tabId, {
            usernameSelector: loginFields.usernameSelector,
            passwordSelector: loginFields.passwordSelector,
            submitSelector: loginFields.submitSelector,
            username: userResponse.credentials.username,
            password: userResponse.credentials.password
          });

          if (directFillResult?.success) {
            session._loginHandledForUrl.push(currentUrl);

            // Wait for page to settle
            await new Promise(r => setTimeout(r, 2000));

            // Check if login actually succeeded (URL changed = redirect after login)
            try {
              const tab = await chrome.tabs.get(session.tabId);
              const newUrl = tab?.url || '';
              if (newUrl === currentUrl) {
                const idx = session._loginHandledForUrl.indexOf(currentUrl);
                if (idx !== -1) session._loginHandledForUrl.splice(idx, 1);
                automationLogger.debug('Still on login page after direct fill - re-enabling detection', { sessionId });
              }
            } catch (e) { /* tab may be gone */ }

            // Direct fill succeeded -- restart loop
            loopResolve?.();
            if (!isSessionTerminating(sessionId) && activeSessions.has(sessionId)) {
              setTimeout(() => startAutomationLoop(sessionId), 500);
            }
            return;
          }
          // Direct fill failed -- fall through to AI
          automationLogger.info('Direct credential fill failed, deferring to AI', { sessionId, domain: loginDomain });
          session._loginHandledForUrl.push(currentUrl);
        } else {
          // User skipped - mark as handled so we don't prompt again
          session._loginHandledForUrl.push(currentUrl);
          // Continue automation, AI will handle as it can
        }
      }
    }
    // ==========================================
    // END LOGIN DETECTION HOOK
    // ==========================================

    // Detect repeated action failures
    const repeatedFailures = detectRepeatedActionFailures(session);
    const forceAlternativeStrategy = repeatedFailures.length > 0;
    
    // Gather multi-tab context with allowed-tab awareness
    let tabInfo = null;
    try {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const sessionTabs = Array.from(activeSessions.values()).map(s => s.tabId);
      const allowedTabs = session.allowedTabs || [];

      tabInfo = {
        currentTabId: session.tabId,
        allTabs: allTabs.map(tab => {
          const isAllowed = allowedTabs.includes(tab.id);
          let domain;
          if (tab.url) {
            try { domain = new URL(tab.url).hostname; } catch { /* skip */ }
          }
          return {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.active,
            status: tab.status,
            isAllowedTab: isAllowed,
            ...(domain ? { domain } : {}),
          };
        }),
        sessionTabs: sessionTabs,
        allowedTabs: allowedTabs
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
      lastActionResult: session.actionHistory.length > 0
        ? session.actionHistory[session.actionHistory.length - 1]
        : null,
      isStuck,
      stuckCounter: session.stuckCounter,
      domChanged,             // Boolean backward compat (derived from changeResult.changed)
      changeSignals,          // Structured: { changed, channels, summary }
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
      tabInfo: tabInfo,
      // Recovery strategies when stuck (generated by generateRecoveryStrategies)
      recoveryStrategies: recoveryStrategies.length > 0 ? recoveryStrategies : undefined
    };

    // DIF-02: Wire completion signals from DOM response into context
    context.completionSignals = domResponse.structuredDOM.completionSignals || null;
    const pageIntent = domResponse.structuredDOM.pageContext?.pageIntent;
    if (pageIntent === 'success-confirmation') {
      const completionSignals = domResponse.structuredDOM.completionSignals;
      if (completionSignals && (completionSignals.successMessages?.length > 0 || completionSignals.confirmationPage)) {
        context.completionCandidate = {
          pageIntent,
          signals: completionSignals,
          suggestion: 'Page shows success state -- verify task completion and set taskComplete: true if your task objective was met'
        };
      }
    }

    // CMP-03: Critical action warnings for AI prompt
    const criticalSummary = getCriticalActionSummary(session);
    if (criticalSummary.length > 0) {
      context.criticalActionWarnings = criticalSummary;
    }

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
        session.lastDOMSignals = null;
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

    // Signal thinking phase to content script
    sendSessionStatus(session.tabId, {
      phase: 'thinking',
      taskName: session.task,
      iteration: session.iterationCount,
      maxIterations: session.maxIterations || 20,
      animatedHighlights: session.animatedActionHighlights,
      statusText: null,  // Don't carry over previous action text; let content.js show "Planning next step..."
      ...calculateProgress(session),
      taskSummary: session.taskSummary || null
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
      prioritizeViewport: settings.prioritizeViewport !== false,
      includeCompactSnapshot: true
    });

    // FIX 1A: Race AI response against a stop signal so stop button works during API calls
    // PERF: Use event-based AbortController pattern instead of 500ms polling
    const stopController = new AbortController();
    session._stopAbortController = stopController;

    const stopSignal = new Promise((resolve) => {
      stopController.signal.addEventListener('abort', () => {
        resolve({ stopped: true });
      }, { once: true });
      // Fallback: check once in case already terminating
      if (isSessionTerminating(sessionId)) {
        resolve({ stopped: true });
      }
    });

    const raceResult = await Promise.race([aiPromise, stopSignal]);

    // Clean up the abort controller
    session._stopAbortController = null;

    // If stopped, bail out immediately
    if (raceResult?.stopped) {
      automationLogger.debug('Session stopped during AI call', { sessionId });
      loopResolve?.();
      return;
    }

    const aiResponse = raceResult;

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
      extractAndStoreMemories(sessionId, session).catch(() => {});

      sendSessionStatus(session.tabId, { phase: 'ended', reason: 'error' });
      finalizeSessionMetrics(sessionId, false); // Failed
      cleanupSession(sessionId);

      // Notify UI of failure (simple message for user)
      chrome.runtime.sendMessage({
        action: 'automationError',
        sessionId,
        error: 'AI service error - please try again',
        message: 'Stopped due to an error',
        task: session.task
      }).catch(() => {});

      return; // Stop automation loop
    }

    // Execute actions and track results
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      // Signal acting phase to content script
      sendSessionStatus(session.tabId, {
        phase: 'acting',
        taskName: session.task,
        iteration: session.iterationCount,
        maxIterations: session.maxIterations || 20,
        actionCount: aiResponse.actions.length,
        animatedHighlights: session.animatedActionHighlights,
        statusText: getActionStatus(aiResponse.actions[0].tool, aiResponse.actions[0].params),
        ...calculateProgress(session),
        taskSummary: session.taskSummary || null
      });
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
              prioritizeViewport: settings.prioritizeViewport !== false,
              includeCompactSnapshot: true
            });
          }
        }
      }

      // Skip individual action loop if batch was executed
      if (!batchExecuted) {
      for (let i = 0; i < aiResponse.actions.length; i++) {
        const action = aiResponse.actions[i];
        const nextAction = aiResponse.actions[i + 1];

        // Check if session was stopped between actions
        if (isSessionTerminating(sessionId)) {
          automationLogger.debug('Session terminated during action execution', { sessionId, actionIndex: i, totalActions: aiResponse.actions.length });
          loopResolve?.();
          return;
        }

        // CMP-03: Skip actions that are on cooldown (irrevocable action re-execution guard)
        if (isCooledDown(session, action)) {
          const cooldown = session.criticalActionRegistry.cooldowns[createActionSignature(action)];
          automationLogger.warn('Skipping cooled-down irrevocable action', {
            sessionId,
            tool: action.tool,
            selector: action.params?.selector,
            blockedUntilIteration: cooldown?.blockedUntilIteration,
            currentIteration: session.iterationCount
          });
          continue;
        }

        automationLogger.logActionExecution(sessionId, action.tool, 'start', { index: i + 1, total: aiResponse.actions.length, params: action.params });
        const actionStartTime = Date.now();

        // Debug mode: Log action execution
        debugLog('Executing action', {
          tool: action.tool,
          index: i + 1,
          total: aiResponse.actions.length
        });

        // Send action-specific status update to UI with progress data
        const actionProgress = calculateProgress(session);
        chrome.runtime.sendMessage({
          action: 'statusUpdate',
          sessionId,
          message: getActionStatus(action.tool, action.params),
          iteration: session.iterationCount,
          maxIterations: session.maxIterations || 20,
          progressPercent: actionProgress.progressPercent
        }).catch(() => {
          // Ignore errors if no listeners
        });

        // Store last action status on session so it persists across navigations
        session.lastActionStatusText = getActionStatus(action.tool, action.params);

        // Send per-action status to content script viewport overlay
        sendSessionStatus(session.tabId, {
          phase: 'acting',
          taskName: session.task,
          iteration: session.iterationCount,
          maxIterations: session.maxIterations || 20,
          statusText: getActionStatus(action.tool, action.params),
          animatedHighlights: session.animatedActionHighlights,
          ...calculateProgress(session),
          taskSummary: session.taskSummary || null
        });

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
                iterationCount: session.iterationCount,
                animatedHighlights: session.animatedActionHighlights ?? true
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

        // Track action in history (slim result to reduce memory and prompt token usage)
        const actionRecord = {
          timestamp: Date.now(),
          tool: action.tool,
          params: action.params,
          result: slimActionResult(actionResult),
          iteration: session.iterationCount
        };
        session.actionHistory.push(actionRecord);

        // CMP-03: Record critical (irrevocable) actions for cooldown enforcement
        if (action.tool === 'click' && actionResult?.success) {
          const clickedText = actionResult?.elementInfo?.text || actionResult?.clicked || '';
          const selectorStr = action.params?.selector || '';
          if (IRREVOCABLE_VERB_PATTERN.test(clickedText) || IRREVOCABLE_VERB_PATTERN.test(selectorStr)) {
            recordCriticalAction(session, action, slimActionResult(actionResult));
          }
        }

        // Log action result
        automationLogger.logAction(sessionId, action, actionResult);

        // Fix: Invalidate stale DOM prefetch after navigation-triggering actions
        // Navigate returns instantly (window.location.href = url) but the page hasn't loaded yet.
        // Without this, the next iteration consumes a prefetch captured from the OLD page.
        const navigationTools = ['navigate', 'searchGoogle', 'goBack', 'goForward', 'switchToTab'];
        if (navigationTools.includes(action.tool) || actionResult?.navigationTriggered) {
          pendingDOMPrefetch = null;
          automationLogger.debug('Invalidated stale DOM prefetch after navigation action', {
            sessionId, tool: action.tool
          });

          // Wait for the new page to actually load before continuing
          if (actionResult?.success) {
            try {
              await pageLoadWatcher.waitForPageReady(session.tabId, { maxWait: 5000 });
              automationLogger.debug('Page load confirmed after navigation', {
                sessionId, tool: action.tool
              });
            } catch (e) {
              automationLogger.debug('Page load wait failed after navigation', {
                sessionId, tool: action.tool, error: e.message
              });
            }
          }
        }

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
                description: `${getActionStatus(action.tool, action.params)} (Alternative: ${alternativeResult.alternativeUsed})`
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

      // Invalidate stale DOM prefetch if actions had visible effects
      // The prefetch was started BEFORE actions executed (line ~4127), so it's stale
      if (!batchExecuted) {
        const currentIterationActions = session.actionHistory.filter(a => a.iteration === session.iterationCount);
        const anyHadEffect = currentIterationActions.some(a =>
          a.result?.hadEffect || a.result?.navigationTriggered ||
          a.result?.verification?.urlChanged || a.result?.verification?.contentChanged
        );
        if (anyHadEffect) {
          pendingDOMPrefetch = null;
          automationLogger.debug('Invalidated stale DOM prefetch - actions had visible effects', {
            sessionId,
            effectfulActions: currentIterationActions.filter(a => a.result?.hadEffect).map(a => a.tool)
          });
        }
      }
    }

    // === PROGRESS TRACKING: Determine if this iteration made meaningful progress ===
    // This counter does NOT reset on URL changes like stuckCounter does
    const iterationActions = session.actionHistory.filter(a => a.iteration === session.iterationCount);
    const iterationStats = {
      actionsSucceeded: iterationActions.filter(a => a.result?.success).length,
      actionsFailed: iterationActions.filter(a => !a.result?.success).length,
      domChanged: domChanged,
      urlChanged: currentUrl !== session.lastUrl,
      // getText/getAttribute are read-only operations - tracked for logging but NOT counted as progress
      newDataExtracted: iterationActions.some(a =>
        a.tool === 'getText' && a.result?.success && a.result?.value && a.result.value.trim().length > 0
      ),
      hadEffect: iterationActions.some(a => a.result?.hadEffect === true),
      hadNavigation: iterationActions.some(a =>
        ['navigate', 'goBack', 'goForward'].includes(a.tool) && a.result?.success
      )
    };

    // CMP-04: Enhanced progress tracking using changeSignals channels (Phase 3)
    // Only count changes that are structural, content, or pageState -- not interaction-only
    const madeProgress = (
      iterationStats.urlChanged ||
      iterationStats.hadNavigation ||
      iterationStats.hadEffect ||
      // Use changeSignals channels to distinguish meaningful changes from noise
      (changeSignals.changed && changeSignals.channels.some(
        ch => ['structural', 'content', 'pageState'].includes(ch)
      ) && iterationStats.actionsSucceeded > 0) ||
      // For extraction tasks, successful getText with content counts as progress
      (classifyTask(session.task) === 'extraction' &&
       iterationStats.newDataExtracted)
    );

    if (madeProgress) {
      session.consecutiveNoProgressCount = 0;
      automationLogger.debug('Progress made this iteration', {
        sessionId,
        consecutiveNoProgressCount: session.consecutiveNoProgressCount,
        stats: iterationStats,
        progressSignal: iterationStats.urlChanged ? 'url_changed' :
                        iterationStats.hadNavigation ? 'navigation' :
                        iterationStats.hadEffect ? 'had_effect' :
                        iterationStats.newDataExtracted ? 'extraction_progress' :
                        'dom_change_substantive'
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

      // Provide a concise summary for the user
      let finalResult = 'Could not complete the task - the page was not responding as expected. ';

      // Include any extracted text if available
      const recentTextActions = session.actionHistory
        .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
        .slice(-3);

      if (recentTextActions.length > 0) {
        const extractedTexts = recentTextActions.map(action => action.result.value).filter(text => text && text.trim());
        if (extractedTexts.length > 0) {
          finalResult += `Found: ${extractedTexts[0].substring(0, 150)}`;
          if (extractedTexts[0].length > 150) finalResult += '...';
          finalResult += ' ';
        }
      }

      finalResult += 'Try refreshing the page or rephrasing your request.';

      automationLogger.logSessionEnd(sessionId, 'no_progress', session.actionHistory.length, Date.now() - session.startTime);
      automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});

      sendSessionStatus(session.tabId, { phase: 'ended', reason: 'no_progress' });
      finalizeSessionMetrics(sessionId, false);
      idleSession(sessionId); // Idle instead of cleanup -- allow follow-up continuation

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
      extractAndStoreMemories(sessionId, session).catch(() => {});

        // Send success message via runtime message
        chrome.runtime.sendMessage({
          action: 'automationComplete',
          sessionId,
          result: repeatedResult,
          navigatedTo: currentUrl
        });

        // Transition to idle for follow-up continuation
        sendSessionStatus(session.tabId, { phase: 'ended', reason: 'complete' });
        finalizeSessionMetrics(sessionId, true); // Successfully completed
        idleSession(sessionId); // Idle instead of cleanup -- allow follow-up continuation
        return;
      }
    }

    // Check if we're stuck in a loop after more iterations
    if (session.stuckCounter >= 8) {

      automationLogger.error('Automation appears stuck', { sessionId, stuckCounter: session.stuckCounter });
      session.status = 'stuck';
      
      // Provide a concise summary for the user
      let finalResult = 'Got stuck trying to complete your task. ';

      // Include any extracted text if available
      const recentTextActions = session.actionHistory
        .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
        .slice(-3);

      if (recentTextActions.length > 0) {
        const extractedTexts = recentTextActions.map(action => action.result.value).filter(text => text && text.trim());
        if (extractedTexts.length > 0) {
          finalResult += `Found: ${extractedTexts[0].substring(0, 150)}`;
          if (extractedTexts[0].length > 150) finalResult += '...';
          finalResult += ' ';
        }
      }

      finalResult += 'Try rephrasing your request or breaking it into smaller steps.';

      automationLogger.logSessionEnd(sessionId, 'stuck', session.actionHistory.length, Date.now() - session.startTime);

      // Save session logs for history
      automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});

      sendSessionStatus(session.tabId, { phase: 'ended', reason: 'stuck' });
      finalizeSessionMetrics(sessionId, false); // Failed due to stuck loop
      idleSession(sessionId); // Idle instead of cleanup -- allow follow-up continuation

      // Send completion with partial results instead of error
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: finalResult,
        partial: true
      });

      return;
    }
    
    // COMPLETION VALIDATION: Multi-signal verification (CMP-01 + CMP-02)
    if (aiResponse.taskComplete) {
      const validation = validateCompletion(session, aiResponse, context);
      automationLogger.info('Completion validation result', {
        sessionId,
        approved: validation.approved,
        score: validation.score,
        taskType: validation.taskType,
        evidence: validation.evidence
      });
      if (!validation.approved) {
        aiResponse.taskComplete = false;
        automationLogger.warn('Completion blocked by multi-signal validation', {
          sessionId,
          score: validation.score,
          evidence: validation.evidence
        });
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
      extractAndStoreMemories(sessionId, session).catch(() => {});

      sendSessionStatus(session.tabId, { phase: 'ended', reason: 'complete' });
      finalizeSessionMetrics(sessionId, true); // Successfully completed
      idleSession(sessionId); // Idle instead of cleanup -- allow follow-up continuation

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

      // Save session logs so failures are recorded
      const duration = Date.now() - currentSession.startTime;
      automationLogger.logSessionEnd(sessionId, 'error', currentSession.actionHistory?.length || 0, duration);
      automationLogger.saveSession(sessionId, currentSession);
      extractAndStoreMemories(sessionId, currentSession).catch(() => {});
    }

    // Notify UI about error (keep message simple for user)
    const userError = error.message && error.message.length > 100
      ? 'Something went wrong. Please try again.'
      : (error.message || 'Something went wrong. Please try again.');
    chrome.runtime.sendMessage({
      action: 'automationError',
      sessionId,
      error: userError,
      task: currentSession?.task
    });
  } finally {
    // Signal that this loop iteration has completed
    loopResolve?.();

    // Defensive: If session was terminated (stopped/failed) and the loop is exiting,
    // notify the UI in case the stop handler's sendResponse didn't reach it
    const finalSession = activeSessions.get(sessionId);
    if (!finalSession || finalSession.status === 'stopped' || finalSession.status === 'failed') {
      chrome.runtime.sendMessage({
        action: 'automationError',
        sessionId,
        error: 'Automation ended.',
        task: finalSession?.task
      }).catch(() => {});
    }
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

    // Check if appropriate API key is configured for the selected provider
    const provider = settings.modelProvider || 'xai';
    const providerApiKeyMap = {
      xai: { key: 'apiKey', name: 'xAI' },
      gemini: { key: 'geminiApiKey', name: 'Gemini' },
      openai: { key: 'openaiApiKey', name: 'OpenAI' },
      anthropic: { key: 'anthropicApiKey', name: 'Anthropic' }
    };
    const providerConfig = providerApiKeyMap[provider];
    if (providerConfig && !settings[providerConfig.key]) {
      throw new Error(`${providerConfig.name} API key not configured. Please set it in extension settings.`);
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
    // FIX 1B: Pass shouldAbort callback so retry loop can check if session was stopped
    const result = await ai.getAutomationActions(task, structuredDOM, context, {
      shouldAbort: () => isSessionTerminating(context?.sessionId)
    });
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

    // Add newly opened tab to the session's allowed tabs
    const senderTabId = sender.tab?.id;
    if (senderTabId) {
      for (const [sid, sess] of activeSessions.entries()) {
        if (sess.tabId === senderTabId || (sess.allowedTabs || []).includes(senderTabId)) {
          addAllowedTab(sid, tab.id, 'openNewTab');
          break;
        }
      }
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
      // Detect platform: modifier 4 = Meta (Cmd) on macOS, modifier 2 = Ctrl on others
      const isMac = navigator.userAgent?.includes('Macintosh') || navigator.platform?.includes('Mac');
      const selectAllModifier = isMac ? 4 : 2;

      // Select all text in focused element
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          modifiers: selectAllModifier,
          key: 'a',
          code: 'KeyA'
        }
      );
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          modifiers: selectAllModifier,
          key: 'a',
          code: 'KeyA'
        }
      );

      // Delay for selection -- Monaco needs ~200ms to process Ctrl+A and update its internal model
      await new Promise(r => setTimeout(r, 200));

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

      // Delay for deletion -- Monaco needs time to clear its buffer before accepting new input
      await new Promise(r => setTimeout(r, 200));
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
 * Handle Monaco/CodeMirror editor insert via MAIN world script injection.
 * Bypasses auto-indent by using the editor's native API (executeEdits) directly.
 * @param {Object} request - The request object containing text to insert
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleMonacoEditorInsert(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { text } = request;

  if (!tabId || !text) {
    sendResponse({ success: false, error: !tabId ? 'No tab ID' : 'No text provided' });
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [text],
      func: (codeText) => {
        // Attempt 1: Monaco editor API
        if (typeof monaco !== 'undefined' && monaco.editor) {
          const editors = typeof monaco.editor.getEditors === 'function'
            ? monaco.editor.getEditors() : [];
          // Prefer the focused editor, fall back to first
          const editor = editors.find(e => e.hasTextFocus?.()) || editors[0];
          if (editor) {
            const model = editor.getModel();
            if (model) {
              const fullRange = model.getFullModelRange();
              editor.executeEdits('fsb-automation', [{
                range: fullRange,
                text: codeText
              }]);
              // Move cursor to end
              const lastLine = model.getLineCount();
              const lastCol = model.getLineMaxColumn(lastLine);
              editor.setPosition({ lineNumber: lastLine, column: lastCol });
              return { success: true, method: 'monaco_executeEdits' };
            }
          }
          // Fallback: try models directly
          const models = typeof monaco.editor.getModels === 'function'
            ? monaco.editor.getModels() : [];
          if (models.length > 0) {
            const model = models[0];
            const fullRange = model.getFullModelRange();
            model.pushEditOperations([], [{
              range: fullRange,
              text: codeText
            }], () => null);
            return { success: true, method: 'monaco_pushEditOperations' };
          }
        }

        // Attempt 2: CodeMirror 6 API
        const cmElement = document.querySelector('.cm-editor');
        if (cmElement?.cmView?.view) {
          const view = cmElement.cmView.view;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: codeText }
          });
          return { success: true, method: 'codemirror6_dispatch' };
        }

        return { success: false, error: 'No editor API found on page' };
      }
    });

    const result = results?.[0]?.result;
    if (result?.success) {
      sendResponse(result);
    } else {
      sendResponse({ success: false, error: result?.error || 'Editor API injection returned no result' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
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
    
    const allowedTabs = requestingSession ? (requestingSession.allowedTabs || []) : [];

    const formattedTabs = tabs.map(tab => {
      const isAllowed = allowedTabs.includes(tab.id);
      let domain;
      if (tab.url) {
        try { domain = new URL(tab.url).hostname; } catch { /* skip */ }
      }
      return {
        id: tab.id,
        title: tab.title || 'Untitled Tab',
        isSessionTab: requestingSession && tab.id === requestingSession.originalTabId,
        isAllowedTab: isAllowed,
        isActive: tab.active,
        ...(domain ? { domain } : {}),
      };
    });

    sendResponse({
      success: true,
      tabs: formattedTabs,
      sessionTabId: requestingSession ? requestingSession.originalTabId : null,
      allowedTabs: allowedTabs,
      currentTab: currentTab ? currentTab.id : null,
      totalTabs: formattedTabs.length,
      message: 'Tabs listed. Session and allowed tabs can be controlled via switchToTab.'
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
      url: chrome.runtime.getURL('ui/popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});

// --- Background Agent Alarm Handler ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const agentId = agentScheduler.getAgentIdFromAlarm(alarm.name);
  if (!agentId) return; // Not an FSB agent alarm

  console.log('[FSB] Agent alarm fired:', alarm.name);

  try {
    const agent = await agentManager.getAgent(agentId);
    if (!agent) {
      console.warn('[FSB] Agent not found for alarm, clearing:', agentId);
      await agentScheduler.clearAlarm(agentId);
      return;
    }

    if (!agent.enabled) {
      console.log('[FSB] Agent disabled, skipping:', agentId);
      return;
    }

    // Guard against double-runs
    if (!agentScheduler.isValidAlarmFire(agent)) {
      console.log('[FSB] Agent alarm fired too soon, skipping:', agentId);
      return;
    }

    // Execute the agent
    const result = await agentExecutor.execute(agent);

    // Record the run
    const updatedAgent = await agentManager.recordRun(agentId, result);

    // Reschedule daily agents for their next occurrence
    if (agent.schedule.type === 'daily') {
      await agentScheduler.rescheduleDaily(updatedAgent);
    }

    // Disable once-type agents after execution
    if (agent.schedule.type === 'once') {
      await agentManager.updateAgent(agentId, { enabled: false });
      await agentScheduler.clearAlarm(agentId);
    }

    // Notify any open UI about the run completion
    chrome.runtime.sendMessage({
      action: 'agentRunComplete',
      agentId: agentId,
      result: {
        success: result.success,
        duration: result.duration,
        error: result.error
      }
    }).catch(() => {}); // UI may not be open

    // Sync to server if enabled
    if (updatedAgent.syncEnabled && typeof serverSync !== 'undefined') {
      serverSync.syncRun(updatedAgent, result).catch(err => {
        console.warn('[FSB] Server sync failed:', err.message);
      });
    }

  } catch (error) {
    console.error('[FSB] Agent alarm handler error:', error.message);
  }
});

// Set up side panel behavior
chrome.runtime.onInstalled.addListener(async () => {
  automationLogger.logInit('extension', 'installed', { version: 'v9.0.2' });

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

  // Reschedule all background agents
  agentScheduler.rescheduleAllAgents();
});

// Initialize analytics and restore sessions on startup
chrome.runtime.onStartup.addListener(async () => {
  automationLogger.logServiceWorker('startup', {});
  initializeAnalytics();
  // Load debug mode setting
  await loadDebugMode();
  // Restore sessions from storage so stop button works after service worker restart
  await restoreSessionsFromStorage();
  // Reschedule all background agents
  agentScheduler.rescheduleAllAgents();
});

// Listen for debug mode changes so toggling takes effect immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.debugMode) {
    fsbDebugMode = changes.debugMode.newValue === true;
    console.log('[FSB] Debug mode ' + (fsbDebugMode ? 'enabled' : 'disabled'));
  }

  // PERF: Update cached DOM settings in active sessions when changed
  if (namespace === 'local') {
    const domKeys = ['domOptimization', 'maxDOMElements', 'prioritizeViewport'];
    const hasDomChange = domKeys.some(key => key in changes);
    if (hasDomChange) {
      for (const [, session] of activeSessions) {
        if (session.domSettings) {
          if ('domOptimization' in changes) session.domSettings.domOptimization = changes.domOptimization.newValue;
          if ('maxDOMElements' in changes) session.domSettings.maxDOMElements = changes.maxDOMElements.newValue;
          if ('prioritizeViewport' in changes) session.domSettings.prioritizeViewport = changes.prioritizeViewport.newValue;
        }
      }
    }
  }
});