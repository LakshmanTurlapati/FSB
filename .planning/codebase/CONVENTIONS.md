# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- Lowercase with hyphens for multi-word files: `ai-integration.js`, `universal-provider.js`, `secure-config.js`
- Single word files use lowercase: `background.js`, `content.js`, `config.js`, `popup.js`
- HTML/CSS files match their JS counterparts: `popup.html`, `popup.css`, `sidepanel.html`, `sidepanel.css`

**Functions:**
- camelCase for all functions: `handleSendMessage`, `checkContentScriptHealth`, `waitForPageReady`
- Async functions prefixed with action verbs: `async processQueue()`, `async loadFromStorage()`, `async getSecureValue()`
- Helper functions often start with `is`, `has`, `can`, `get`, `set`: `isRestrictedURL()`, `hasElementChanged()`, `getPageTypeDescription()`
- Event handlers prefixed with `handle` or action verb: `handleSendMessage()`, `stopAutomation()`

**Variables:**
- camelCase for local and instance variables: `currentSessionId`, `isRunning`, `lastError`
- SCREAMING_SNAKE_CASE for constants: `FAILURE_TYPES`, `RETRY_STRATEGIES`, `TOOL_DOCUMENTATION`, `KEY_MAPPINGS`
- Descriptive names for Maps: `activeSessions`, `contentScriptPorts`, `parameterCache`

**Classes:**
- PascalCase: `AIIntegration`, `DOMStateManager`, `PageLoadWatcher`, `UniversalProvider`, `FSBAnalytics`
- Suffix with purpose when helpful: `AutomationLogger`, `KeyboardEmulator`, `SecureConfig`

**DOM Elements:**
- camelCase matching element IDs: `chatInput`, `sendBtn`, `statusDot`
- Grouped in objects when caching: `elements.modelProvider`, `elements.saveBtn`

## Code Style

**Formatting:**
- No automated formatter configured (no Prettier/ESLint config files detected)
- Manual formatting with 2-space indentation observed throughout
- Opening braces on same line as statement
- Consistent spacing around operators

**Semicolons:**
- Always use semicolons at end of statements
- Exception: class method definitions don't need trailing semicolons

**Quotes:**
- Single quotes for strings throughout: `'running'`, `'error'`
- Template literals for string interpolation: `` `Iteration ${iterationCount}` ``

**Line Length:**
- No strict limit, but generally keep under 120 characters
- Long object definitions may span multiple lines

## Import Organization

**Order:**
- Chrome Extension pattern using `importScripts()` in service worker:
```javascript
// In background.js - load order matters for dependencies
importScripts('config.js');
importScripts('init-config.js');
importScripts('ai-integration.js');
importScripts('automation-logger.js');
importScripts('analytics.js');
importScripts('keyboard-emulator.js');
```

**Content Scripts:**
- Defined in `manifest.json` in dependency order:
```json
"js": ["automation-logger.js", "content.js"]
```

**Cross-Environment Exports:**
- Use conditional exports for modules that work in multiple contexts:
```javascript
// Export for service workers
if (typeof self !== 'undefined') {
  self.config = config;
}

// Export for content scripts
if (typeof window !== 'undefined') {
  window.BrowserAgentConfig = config;
}

// CommonJS fallback
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { function1, function2 };
}
```

## Error Handling

**Patterns:**
- Use try-catch for async operations and API calls
- Return structured objects with `success` boolean:
```javascript
return { success: true, waitTime, method: 'event-driven' };
return { success: false, error: error.message };
```

- Log errors before throwing or returning:
```javascript
} catch (error) {
  automationLogger.error('AI request failed', { error: error.message });
  return this.createFallbackResponse(task, error);
}
```

**Error Classification:**
- Define error types as constants (see `background.js` line 528-536):
```javascript
const FAILURE_TYPES = {
  COMMUNICATION: 'communication',
  DOM: 'dom',
  SELECTOR: 'selector',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  PERMISSION: 'permission',
  BF_CACHE: 'bfcache'
};
```

**Recovery Strategies:**
- Map error types to recovery handlers:
```javascript
const RETRY_STRATEGIES = {
  [FAILURE_TYPES.COMMUNICATION]: 'reconnect_retry',
  [FAILURE_TYPES.DOM]: 'wait_retry',
  // ...
};
```

**Retry Logic:**
- Use exponential backoff for retries:
```javascript
const delay = baseDelay * Math.pow(2, attempt);
await new Promise(resolve => setTimeout(resolve, delay));
```

## Logging

**Framework:** Custom `AutomationLogger` class (`automation-logger.js`)

**Log Levels:**
- `error`: Critical failures
- `warn`: Recoverable issues, deprecation warnings
- `info`: Important state changes, session events
- `debug`: Detailed operation tracing

**Patterns:**
```javascript
// Standard logging
automationLogger.info('Automation session started', { sessionId, task, tabId });
automationLogger.error('AI request failed', { error: error.message });
automationLogger.debug('Content script ready via port', { tabId });

// Specialized logging methods for different concerns:
automationLogger.logSessionStart(sessionId, task, tabId);
automationLogger.logIteration(sessionId, iterationCount, domHash, stuckCounter);
automationLogger.logAction(sessionId, action, result);
automationLogger.logAIResponse(sessionId, reasoning, actions, taskComplete);
automationLogger.logStuckDetection(sessionId, stuckCounter, lastActions);
automationLogger.logTiming(sessionId, 'LLM', 'queue_process', duration, { model });
automationLogger.logDOMOperation(sessionId, 'compute_diff', { phase: 'start' });
automationLogger.logComm(sessionId, 'health', 'healthCheck', success, { tabId });
automationLogger.logRecovery(sessionId, errorType, strategy, status, details);
```

**Console Output:**
- All logs also go to console with prefix: `[FSB ${level.toUpperCase()}]`

## Comments

**When to Comment:**
- Major class/function definitions get JSDoc comments
- Complex logic blocks get inline explanations
- "Why" comments for non-obvious decisions
- Version markers for major changes: `// EASY WIN #10:`, `// PERFORMANCE FIX:`

**JSDoc Usage:**
```javascript
/**
 * AIIntegration class handles all AI-related functionality for browser automation
 * @class
 */
class AIIntegration {
  /**
   * Creates an instance of AIIntegration
   * @param {Object} settings - Configuration settings for the AI integration
   * @param {string} settings.modelProvider - The AI provider ('xai' or 'gemini')
   * @param {string} settings.modelName - The specific model to use
   * @param {string} settings.apiKey - The API key (for xAI)
   */
  constructor(settings) { ... }
}

/**
 * Loads configuration from Chrome storage
 * @returns {Promise<Object>} Complete configuration object with defaults applied
 */
async loadFromStorage() { ... }
```

**Section Markers:**
```javascript
// ============================================================================
// IFRAME SUPPORT - Detect if running in iframe and manage cross-frame comms
// ============================================================================
```

## Function Design

**Size:**
- Most functions are 10-50 lines
- Complex functions (100+ lines) are acceptable for self-contained operations like DOM traversal

**Parameters:**
- Use options objects for functions with many parameters:
```javascript
async waitForPageReady(tabId, options = {}) {
  const {
    maxWait = 10000,
    requireDOMStable = true,
    stableTime = 300,
  } = options;
  // ...
}
```

**Return Values:**
- Return objects with consistent structure for operations:
```javascript
return {
  success: true,
  waitTime: elapsed,
  method: 'event-driven',
  details: { ... }
};
```

- Use early returns for guard clauses:
```javascript
if (!url) return true;
if (this.requestQueue.length === 0) return;
```

## Module Design

**Exports:**
- Singleton pattern for utility classes:
```javascript
// Export singleton instance
const config = new Config();
const automationLogger = new AutomationLogger();
const secureConfig = new SecureConfig();
```

**Class Structure:**
- Constructor initializes state and defaults
- Public methods first, then private helpers
- Constants defined outside class or as static properties

**Barrel Files:**
- Not used; direct imports via `importScripts()` or `manifest.json`

## Async/Await Patterns

**Prefer async/await over callbacks:**
```javascript
async function handleSendMessage() {
  const message = chatInput.textContent.trim();
  if (!message || isRunning) return;

  const settings = await chrome.storage.local.get(['apiKey', 'modelName']);
  // ...
}
```

**Promise.race for timeouts:**
```javascript
const response = await Promise.race([
  chrome.tabs.sendMessage(tabId, { action: 'healthCheck' }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Health check timeout')), timeout)
  )
]);
```

**Promise.all for parallel operations:**
```javascript
const results = await Promise.all(framePromises);
```

## Chrome Extension Specifics

**Message Passing:**
```javascript
// Sending messages
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => { ... });
chrome.tabs.sendMessage(tabId, { action: 'healthCheck' }, { frameId: 0 });

// Receiving messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startAutomation') {
    handleAsyncMessage(request, sendResponse);
    return true; // Required for async response
  }
});
```

**Storage API:**
```javascript
// Local storage
await chrome.storage.local.get(['apiKey', 'modelName']);
await chrome.storage.local.set({ lastTask: task });

// Session storage (survives service worker restart)
await chrome.storage.session.set({ [key]: session });
await chrome.storage.session.get(null); // Get all
```

**Double-injection Protection:**
```javascript
// In content.js - prevent duplicate execution
if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  console.log('[FSB Content] Already loaded, skipping duplicate injection');
  throw new Error('FSB_ALREADY_LOADED');
}
window.__FSB_CONTENT_SCRIPT_LOADED__ = true;
```

---

*Convention analysis: 2026-02-03*
