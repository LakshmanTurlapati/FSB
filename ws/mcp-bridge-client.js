/**
 * MCP Bridge Client for FSB Chrome Extension
 *
 * Connects to the local MCP server's WebSocket bridge on ws://localhost:7225.
 * Routes incoming MCP tool requests to the extension's existing action handlers
 * and sends results back. Auto-reconnects with exponential backoff.
 *
 * This runs alongside the existing dashboard relay (ws-client.js) -- both
 * connections are independent and always-on.
 */

const MCP_BRIDGE_URL = 'ws://localhost:7225';
const MCP_RECONNECT_BASE_MS = 2000;
const MCP_RECONNECT_MAX_MS = 30000;
const MCP_PING_INTERVAL_MS = 25000;

class MCPBridgeClient {
  constructor() {
    this._ws = null;
    this._reconnectDelay = MCP_RECONNECT_BASE_MS;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._intentionalClose = false;
    this._connected = false;
  }

  /**
   * Start the connection. Safe to call multiple times.
   */
  connect() {
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._intentionalClose = false;

    try {
      this._ws = new WebSocket(MCP_BRIDGE_URL);
    } catch (err) {
      console.log('[FSB MCP Bridge] WebSocket construction failed:', err.message);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      console.log('[FSB MCP Bridge] Connected to local MCP bridge');
      this._connected = true;
      this._reconnectDelay = MCP_RECONNECT_BASE_MS;
      this._startPing();
    };

    this._ws.onmessage = (event) => {
      this._handleMessage(event.data);
    };

    this._ws.onclose = () => {
      console.log('[FSB MCP Bridge] Disconnected from local MCP bridge');
      this._connected = false;
      this._stopPing();
      if (!this._intentionalClose) {
        this._scheduleReconnect();
      }
    };

    this._ws.onerror = (err) => {
      // Errors are followed by onclose, so reconnect happens there
    };
  }

  /**
   * Gracefully disconnect.
   */
  disconnect() {
    this._intentionalClose = true;
    this._stopPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }

  get isConnected() {
    return this._connected;
  }

  // --------------------------------------------------------------------------
  // Reconnect
  // --------------------------------------------------------------------------

  _scheduleReconnect() {
    if (this._intentionalClose) return;
    if (this._reconnectTimer) return;

    const jitter = Math.random() * 500;
    const delay = Math.min(this._reconnectDelay + jitter, MCP_RECONNECT_MAX_MS);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, MCP_RECONNECT_MAX_MS);
      this.connect();
    }, delay);
  }

  // --------------------------------------------------------------------------
  // Keepalive
  // --------------------------------------------------------------------------

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ type: 'mcp:ping', ts: Date.now() }));
      }
    }, MCP_PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Message handling
  // --------------------------------------------------------------------------

  _send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  _sendResult(id, payload) {
    this._send({ id, type: 'mcp:result', payload });
  }

  _sendError(id, error) {
    this._send({ id, type: 'mcp:error', payload: { success: false, error } });
  }

  _sendProgress(id, progressData) {
    this._send({ id, type: 'mcp:progress', payload: progressData });
  }

  async _handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Ignore pong responses
    if (msg.type === 'mcp:pong') return;

    const { id, type, payload } = msg;
    if (!id || !type) return;

    try {
      const result = await this._routeMessage(type, payload || {}, id);
      this._sendResult(id, { success: true, ...result });
    } catch (err) {
      this._sendError(id, err.message || 'Unknown error');
    }
  }

  /**
   * Route an MCP message type to the appropriate extension handler.
   * Returns the result payload.
   */
  async _routeMessage(type, payload, id) {
    switch (type) {
      case 'mcp:get-tabs':
        return this._handleGetTabs();

      case 'mcp:get-dom':
        return this._handleGetDOM(payload);

      case 'mcp:read-page':
        return this._handleReadPage(payload);

      case 'mcp:execute-action':
        return this._handleExecuteAction(payload);

      case 'mcp:start-automation':
        return this._handleStartAutomation(payload, id);

      case 'mcp:stop-automation':
        return this._handleStopAutomation();

      case 'mcp:get-status':
        return this._handleGetStatus();

      case 'mcp:get-config':
        return this._handleGetConfig();

      case 'mcp:get-site-guides':
        return this._handleGetSiteGuides(payload);

      case 'mcp:get-memory':
        return this._handleGetMemory(payload);

      case 'mcp:list-sessions':
        return this._handleListSessions();

      case 'mcp:get-session':
        return this._handleGetSession(payload);

      case 'mcp:get-logs':
        return this._handleGetLogs(payload);

      case 'mcp:search-memory':
        return this._handleSearchMemory(payload);

      case 'mcp:create-agent':
        return this._handleAgentAction('createAgent', payload);

      case 'mcp:list-agents':
        return this._handleAgentAction('listAgents', payload);

      case 'mcp:run-agent':
        return this._handleAgentAction('runAgent', payload);

      case 'mcp:stop-agent':
        return this._handleAgentAction('stopAgent', payload);

      case 'mcp:delete-agent':
        return this._handleAgentAction('deleteAgent', payload);

      case 'mcp:toggle-agent':
        return this._handleAgentAction('toggleAgent', payload);

      case 'mcp:get-agent-stats':
        return this._handleAgentAction('getAgentStats', payload);

      case 'mcp:get-agent-history':
        return this._handleAgentAction('getAgentHistory', payload);

      default:
        throw new Error('Unknown MCP message type: ' + type);
    }
  }

  // --------------------------------------------------------------------------
  // Handler implementations
  // Uses background.js functions directly (same service worker scope via importScripts)
  // --------------------------------------------------------------------------

  async _getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  /**
   * Send message to content script using background.js's sendMessageWithRetry.
   * This ensures content scripts are injected before sending, handling the
   * MV3 content script lifecycle properly.
   */
  async _sendToContentScript(tabId, message) {
    // sendMessageWithRetry is defined in background.js (same scope)
    if (typeof sendMessageWithRetry === 'function') {
      return await sendMessageWithRetry(tabId, message);
    }
    // Fallback: inject then send directly
    if (typeof ensureContentScriptInjected === 'function') {
      await ensureContentScriptInjected(tabId);
    }
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || {});
      });
    });
  }

  async _handleGetTabs() {
    const tabs = await chrome.tabs.query({});
    const activeTab = await this._getActiveTab();
    return {
      tabs: tabs.map(t => ({
        id: t.id,
        url: t.url || '',
        title: t.title || '',
        active: t.active,
        windowId: t.windowId,
      })),
      activeTabId: activeTab?.id || null,
      totalTabs: tabs.length,
    };
  }

  async _handleGetDOM(payload) {
    const tab = await this._getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab');
    const response = await this._sendToContentScript(tab.id, {
      action: 'getDOM',
      maxElements: payload.maxElements || 50,
    });
    return response;
  }

  async _handleReadPage(payload) {
    const tab = await this._getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab');
    const response = await this._sendToContentScript(tab.id, {
      action: 'readPage',
      full: payload.full || false,
    });
    return response;
  }

  async _handleExecuteAction(payload) {
    const tab = await this._getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab');

    // D-06: Route-aware dispatch using TOOL_REGISTRY _route field
    const toolDef = typeof getToolByName === 'function' ? getToolByName(payload.tool) : null;

    if (toolDef && toolDef._route === 'background') {
      return this._handleExecuteBackground(tab, payload, toolDef);
    }

    // Default: send to content script (content-routed or unknown tools)
    const response = await this._sendToContentScript(tab.id, {
      action: 'executeAction',
      tool: payload.tool,
      params: payload.params || {},
      source: 'mcp-manual',
    });
    return response;
  }

  /**
   * Handle background-routed tools directly in the service worker.
   * Special-cases execute_js (chrome.scripting.executeScript); others
   * dispatch via chrome.runtime.sendMessage to background.js onMessage handler.
   */
  async _handleExecuteBackground(tab, payload, toolDef) {
    const toolName = payload.tool;
    const params = payload.params || {};

    // Special handler for execute_js -- uses chrome.scripting.executeScript directly
    if (toolName === 'execute_js') {
      return this._handleExecuteJS(tab, params);
    }

    // For other background tools (navigate, report_progress, etc.),
    // dispatch via chrome.runtime.sendMessage to background.js onMessage handler
    const bgAction = toolDef._contentVerb || toolName;
    const response = await this._dispatchToBackground({
      action: bgAction,
      ...params,
      tabId: tab.id,
    });
    return response;
  }

  /**
   * Execute arbitrary JavaScript in the active tab's MAIN world.
   * Uses chrome.scripting.executeScript (same pattern as background.js:5945).
   * Per D-01: MAIN world gives full page DOM access.
   */
  async _handleExecuteJS(tab, params) {
    const code = params.code;
    if (!code || typeof code !== 'string') {
      throw new Error('execute_js requires a "code" parameter (string)');
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: (userCode) => {
          try {
            // Use Function constructor to execute in page context
            // This allows return values and multi-statement code
            const fn = new Function(userCode);
            const result = fn();
            // Serialize result for message passing
            if (result === undefined) return { value: 'undefined' };
            if (result === null) return { value: 'null' };
            if (typeof result === 'object') {
              try { return { value: JSON.stringify(result) }; }
              catch { return { value: String(result) }; }
            }
            return { value: String(result) };
          } catch (execError) {
            return { error: execError.message || String(execError) };
          }
        },
        args: [code],
      });

      // chrome.scripting.executeScript returns an array of InjectionResult
      const injectionResult = results && results[0];
      if (!injectionResult) {
        return { success: false, error: 'No result from script execution' };
      }

      const resultValue = injectionResult.result;
      if (resultValue && resultValue.error) {
        return { success: false, error: resultValue.error };
      }

      return {
        success: true,
        result: resultValue ? resultValue.value : 'undefined',
        tool: 'execute_js',
      };
    } catch (err) {
      // chrome.scripting.executeScript can throw for restricted pages (chrome://, etc.)
      return {
        success: false,
        error: `execute_js failed: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Dispatch a request through background.js's onMessage handler.
   * Since we're in the same service worker scope, we simulate the
   * chrome.runtime.onMessage pattern by calling the handler directly.
   */
  _dispatchToBackground(request) {
    return new Promise((resolve) => {
      // Trigger the onMessage listener in background.js
      // The listener uses sendResponse callback pattern
      const fakeMessageEvent = new CustomEvent('fsb-mcp-internal', {
        detail: { request, resolve }
      });

      // Direct dispatch: call the handler via the existing message listener
      // background.js's chrome.runtime.onMessage handler is not directly callable,
      // so we use chrome.runtime.sendMessage which loops back within the service worker
      chrome.runtime.sendMessage(request, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || {});
      });
    });
  }

  async _handleStartAutomation(payload, mcpMsgId) {
    const tab = await this._getActiveTab();
    if (!tab || !tab.id) throw new Error('No active tab');

    const response = await this._dispatchToBackground({
      action: 'startAutomation',
      task: payload.task,
      tabId: tab.id,
      source: 'mcp',
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to start automation');
    }

    const sessionId = response.sessionId;

    // Listen for automation completion via message listener
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        resolve({ sessionId, status: 'timeout', message: 'Automation timed out after 5 minutes' });
      }, 300000);

      const listener = (message) => {
        if (message.type === 'automationProgress' && message.sessionId === sessionId) {
          this._sendProgress(mcpMsgId, {
            taskId: sessionId,
            progress: message.progress || 0,
            phase: message.phase || 'executing',
            eta: message.eta || null,
            action: message.action || null,
          });
        }

        if (message.type === 'automationComplete' && message.sessionId === sessionId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve({
            sessionId,
            status: message.result?.status || 'completed',
            result: message.result || {},
          });
        }

        if (message.type === 'automationError' && message.sessionId === sessionId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve({
            sessionId,
            status: 'error',
            error: message.error || 'Unknown automation error',
          });
        }
      };

      chrome.runtime.onMessage.addListener(listener);
    });
  }

  async _handleStopAutomation() {
    const response = await this._dispatchToBackground({ action: 'stopAutomation' });
    return response || { stopped: true };
  }

  async _handleGetStatus() {
    const response = await this._dispatchToBackground({ action: 'getStatus' });
    return response || {};
  }

  async _handleGetConfig() {
    const config = await chrome.storage.local.get([
      'selectedModel', 'selectedProvider', 'defaultModel',
      'maxIterations', 'domOptimization', 'maxDOMElements',
    ]);
    return { config };
  }

  async _handleGetSiteGuides(payload) {
    const response = await this._dispatchToBackground({
      action: 'getSiteGuides',
      domain: payload.domain,
    });
    return response || {};
  }

  async _handleGetMemory(payload) {
    const response = await this._dispatchToBackground({
      action: 'getMemory',
      type: payload.type,
      domain: payload.domain,
    });
    return response || {};
  }

  async _handleListSessions() {
    const response = await this._dispatchToBackground({ action: 'listSessions' });
    return response || {};
  }

  async _handleGetSession(payload) {
    const response = await this._dispatchToBackground({
      action: 'getSession',
      sessionId: payload.sessionId,
    });
    return response || {};
  }

  async _handleGetLogs(payload) {
    const response = await this._dispatchToBackground({
      action: 'getLogs',
      sessionId: payload.sessionId,
      level: payload.level,
      limit: payload.limit,
    });
    return response || {};
  }

  async _handleSearchMemory(payload) {
    const response = await this._dispatchToBackground({
      action: 'searchMemory',
      query: payload.query,
      type: payload.type,
      domain: payload.domain,
      limit: payload.limit,
    });
    return response || {};
  }

  async _handleAgentAction(action, payload) {
    const response = await this._dispatchToBackground({
      action,
      ...payload,
    });
    return response || {};
  }
}

// Global instance
const mcpBridgeClient = new MCPBridgeClient();
