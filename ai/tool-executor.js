/**
 * Unified Tool Executor for FSB Browser Automation
 *
 * Single dispatch function that routes all 42 browser tools to their correct
 * handler based on _route metadata from tool-definitions.js.
 *
 * Replaces duplicated routing logic in background.js (autopilot lines 10892-10955,
 * MCP lines 13647-13740) with one shared function.
 *
 * Routes:
 *   - 'content' (28 tools): chrome.tabs.sendMessage to content script
 *   - 'cdp' (7 tools): options.cdpHandler callback (delegates to executeCDPToolDirect)
 *   - 'background' (7 tools): chrome.tabs APIs or options.dataHandler callback
 *
 * @module tool-executor
 */

'use strict';

const { TOOL_REGISTRY, getToolByName } = require('./tool-definitions.js');

// ---------------------------------------------------------------------------
// Structured result factory
// ---------------------------------------------------------------------------

/**
 * Create a structured tool result.
 * Every tool execution returns this shape for consistent downstream handling.
 *
 * @param {Object} fields
 * @param {boolean} fields.success - Whether the tool achieved its intended effect
 * @param {boolean} [fields.hadEffect=false] - Whether the page/state changed
 * @param {string|null} [fields.error=null] - Error message if success=false
 * @param {boolean} [fields.navigationTriggered=false] - Whether a page navigation occurred
 * @param {Object|null} [fields.result=null] - Tool-specific payload
 * @returns {Object} Structured result
 */
function makeResult({ success, hadEffect = false, error = null, navigationTriggered = false, result = null }) {
  return {
    success: Boolean(success),
    hadEffect: Boolean(hadEffect),
    error: error || null,
    navigationTriggered: Boolean(navigationTriggered),
    result: result || null
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * Dispatch a content-route tool via chrome.tabs.sendMessage.
 *
 * @param {Object} tool - Tool definition from registry
 * @param {Object} params - Tool parameters
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<Object>} Structured result
 */
async function executeContentTool(tool, params, tabId) {
  // Special case: get_dom_snapshot has no _contentVerb, uses dedicated message type
  if (tool.name === 'get_dom_snapshot') {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'mcp:get-dom',
        params: params
      });
      return makeResult({
        success: true,
        hadEffect: false,
        result: response
      });
    } catch (err) {
      return makeResult({
        success: false,
        error: `get_dom_snapshot failed: ${err.message || err}`
      });
    }
  }

  // Standard content tools: dispatch via executeAction with the _contentVerb
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'executeAction',
      tool: tool._contentVerb,
      params: params
    });

    // Normalize content script response into structured result
    const success = response && response.success !== false;
    return makeResult({
      success: success,
      hadEffect: success,
      error: response?.error || null,
      navigationTriggered: Boolean(response?.navigationTriggered),
      result: response
    });
  } catch (err) {
    const errMsg = err.message || String(err);

    // BF cache detection: content script unreachable because page moved to BF cache
    if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
      // Check if URL changed (navigation success) -- the action may have triggered navigation
      try {
        const tab = await chrome.tabs.get(tabId);
        // We cannot compare previous URL here (caller has that context),
        // but we flag the navigation possibility for the caller
        return makeResult({
          success: true,
          hadEffect: true,
          navigationTriggered: true,
          result: { bfCacheDetected: true, currentUrl: tab?.url }
        });
      } catch (_tabErr) {
        // Tab no longer exists
        return makeResult({
          success: false,
          error: 'Tab was closed or became inaccessible',
          navigationTriggered: true
        });
      }
    }

    return makeResult({
      success: false,
      error: `Content tool ${tool.name} failed: ${errMsg}`
    });
  }
}

/**
 * Dispatch a CDP-route tool via the injected cdpHandler callback.
 *
 * The executor does NOT reimplement CDP logic -- it delegates to
 * background.js executeCDPToolDirect via options.cdpHandler.
 *
 * @param {Object} tool - Tool definition from registry
 * @param {Object} params - Tool parameters
 * @param {number} tabId - Chrome tab ID
 * @param {Function} cdpHandler - Callback: (cdpVerb, params, tabId) => Promise<result>
 * @returns {Promise<Object>} Structured result
 */
async function executeCdpTool(tool, params, tabId, cdpHandler) {
  if (typeof cdpHandler !== 'function') {
    return makeResult({
      success: false,
      error: `CDP tool ${tool.name} requires options.cdpHandler callback`
    });
  }

  try {
    const response = await cdpHandler(tool._cdpVerb, params, tabId);
    const success = response && response.success !== false;
    return makeResult({
      success: success,
      hadEffect: success,
      error: response?.error || null,
      result: response
    });
  } catch (err) {
    return makeResult({
      success: false,
      error: `CDP tool ${tool.name} failed: ${err.message || err}`
    });
  }
}

/**
 * Dispatch a background-route tool using chrome.tabs APIs or dataHandler.
 *
 * Navigation tools (navigate, go_back, go_forward, refresh, open_tab, switch_tab, list_tabs)
 * use chrome.tabs APIs directly since they are simple one-liners.
 *
 * @param {Object} tool - Tool definition from registry
 * @param {Object} params - Tool parameters
 * @param {number} tabId - Chrome tab ID
 * @param {Function|undefined} dataHandler - Optional callback for data tools
 * @returns {Promise<Object>} Structured result
 */
async function executeBackgroundTool(tool, params, tabId, dataHandler) {
  try {
    switch (tool.name) {
      case 'navigate': {
        const url = params?.url;
        if (!url) {
          return makeResult({ success: false, error: 'navigate requires url parameter' });
        }
        let fromUrl = null;
        try {
          const tab = await chrome.tabs.get(tabId);
          fromUrl = tab?.url;
        } catch (_) { /* tab may not be accessible */ }
        await chrome.tabs.update(tabId, { url });
        // Brief wait for navigation to initiate
        await new Promise(r => setTimeout(r, 500));
        return makeResult({
          success: true,
          hadEffect: true,
          navigationTriggered: true,
          result: { navigatingTo: url, fromUrl }
        });
      }

      case 'go_back': {
        await chrome.tabs.goBack(tabId);
        return makeResult({
          success: true,
          hadEffect: true,
          navigationTriggered: true,
          result: { direction: 'back' }
        });
      }

      case 'go_forward': {
        await chrome.tabs.goForward(tabId);
        return makeResult({
          success: true,
          hadEffect: true,
          navigationTriggered: true,
          result: { direction: 'forward' }
        });
      }

      case 'refresh': {
        await chrome.tabs.reload(tabId);
        return makeResult({
          success: true,
          hadEffect: true,
          navigationTriggered: true,
          result: { action: 'refresh' }
        });
      }

      case 'open_tab': {
        const url = params?.url || 'about:blank';
        const active = params?.active !== false;
        const newTab = await chrome.tabs.create({ url, active });
        return makeResult({
          success: true,
          hadEffect: true,
          result: { tabId: newTab.id, url, active }
        });
      }

      case 'switch_tab': {
        const targetTabId = params?.tabId;
        if (!targetTabId) {
          return makeResult({ success: false, error: 'switch_tab requires tabId parameter' });
        }
        await chrome.tabs.update(targetTabId, { active: true });
        // Focus the window containing the tab
        try {
          const tabWindow = await chrome.tabs.get(targetTabId);
          if (tabWindow.windowId) {
            await chrome.windows.update(tabWindow.windowId, { focused: true });
          }
        } catch (_) { /* window focus is best-effort */ }
        return makeResult({
          success: true,
          hadEffect: true,
          result: { tabId: targetTabId }
        });
      }

      case 'list_tabs': {
        const allTabs = await chrome.tabs.query({});
        const tabList = allTabs.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.active,
          windowId: t.windowId
        }));
        return makeResult({
          success: true,
          hadEffect: false,
          result: { tabs: tabList }
        });
      }

      default: {
        // Data tools or other background tools -- delegate to dataHandler callback
        if (typeof dataHandler === 'function') {
          const response = await dataHandler(tool.name, params, tabId);
          const success = response && response.success !== false;
          return makeResult({
            success: success,
            hadEffect: success,
            error: response?.error || null,
            result: response
          });
        }
        return makeResult({
          success: false,
          error: `Background tool ${tool.name} has no handler (no dataHandler callback provided)`
        });
      }
    }
  } catch (err) {
    return makeResult({
      success: false,
      error: `Background tool ${tool.name} failed: ${err.message || err}`
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute any of the 42 browser tools by name.
 *
 * Routes to the correct handler based on _route metadata from tool-definitions.js:
 *   - 'content' -> chrome.tabs.sendMessage (content script)
 *   - 'cdp' -> options.cdpHandler callback (executeCDPToolDirect)
 *   - 'background' -> chrome.tabs APIs or options.dataHandler callback
 *
 * @param {string} name - Tool name (snake_case, e.g. 'click', 'navigate', 'click_at')
 * @param {Object} params - Tool-specific parameters
 * @param {number} tabId - Chrome tab ID to execute against
 * @param {Object} [options={}] - Optional callbacks
 * @param {Function} [options.cdpHandler] - (cdpVerb, params, tabId) => Promise<result>
 * @param {Function} [options.dataHandler] - (toolName, params, tabId) => Promise<result>
 * @returns {Promise<Object>} Structured result: {success, hadEffect, error, navigationTriggered, result}
 */
async function executeTool(name, params, tabId, options = {}) {
  const tool = getToolByName(name);

  if (!tool) {
    return makeResult({
      success: false,
      error: `Unknown tool: ${name}`
    });
  }

  switch (tool._route) {
    case 'content':
      return executeContentTool(tool, params, tabId);

    case 'cdp':
      return executeCdpTool(tool, params, tabId, options.cdpHandler);

    case 'background':
      return executeBackgroundTool(tool, params, tabId, options.dataHandler);

    default:
      return makeResult({
        success: false,
        error: `Tool ${name} has unsupported route: ${tool._route}`
      });
  }
}

/**
 * Check whether a tool is read-only (bypasses mutation queue).
 *
 * Read-only tools: get_dom_snapshot, read_page, get_text, get_attribute, list_tabs, read_sheet
 *
 * @param {string} name - Tool name (snake_case)
 * @returns {boolean} True if tool is read-only, false otherwise
 */
function isReadOnly(name) {
  const tool = getToolByName(name);
  return tool ? tool._readOnly === true : false;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// CommonJS for Chrome extension context and Node.js require()
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { executeTool, isReadOnly };
}
