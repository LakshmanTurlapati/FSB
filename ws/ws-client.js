/**
 * FSB WebSocket Client for Chrome MV3 Service Worker
 * Maintains persistent connection to the relay server with keepalive pings
 * and exponential backoff reconnection.
 */

const FSB_SERVER_URL = 'https://full-selfbrowsing.com';

class FSBWebSocket {
  constructor() {
    this.ws = null;
    this.keepaliveTimer = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 0;
    this.maxReconnectDelay = 30000;
    this.connected = false;
    this.intentionalClose = false;
  }

  /**
   * Connect to the relay server WebSocket endpoint.
   * Auto-registers a hash key on first run if none exists.
   */
  async connect() {
    let { serverHashKey } = await chrome.storage.local.get(['serverHashKey']);

    // Auto-register with the server if no hash key exists
    if (!serverHashKey) {
      try {
        const resp = await fetch(FSB_SERVER_URL + '/api/auth/register', { method: 'POST' });
        if (resp.ok) {
          const data = await resp.json();
          serverHashKey = data.hashKey;
          await chrome.storage.local.set({ serverHashKey });
          console.log('[FSB WS] Auto-registered with server');
        } else {
          console.warn('[FSB WS] Auto-register failed:', resp.status);
          this._scheduleReconnect();
          return;
        }
      } catch (err) {
        console.warn('[FSB WS] Auto-register failed:', err.message);
        this._scheduleReconnect();
        return;
      }
    }

    // Close any existing connection before opening a new one
    if (this.ws) {
      try { this.ws.close(); } catch (_) { /* ignore */ }
      this.ws = null;
    }

    const wsUrl = FSB_SERVER_URL.replace(/^http/, 'ws') + '/ws?key=' + encodeURIComponent(serverHashKey) + '&role=extension';

    this.intentionalClose = false;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[FSB WS] Failed to create WebSocket:', err.message);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 0;
      this.connected = true;
      this._startKeepalive();
      this._sendStateSnapshot();
      this._updateBadge(true);
      console.log('[FSB WS] Connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (err) {
        console.warn('[FSB WS] Failed to parse message:', err.message);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._stopKeepalive();
      this._updateBadge(false);
      if (!this.intentionalClose) {
        this._scheduleReconnect();
      }
      console.log('[FSB WS] Disconnected');
    };

    this.ws.onerror = () => {
      // No-op: onclose fires after onerror
    };
  }

  /**
   * Explicitly disconnect and prevent reconnection.
   */
  disconnect() {
    this.intentionalClose = true;
    this._stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
    this.connected = false;
    this._clearBadge();
  }

  /**
   * Send a typed message through the WebSocket.
   * @param {string} type - Message type
   * @param {Object} payload - Message payload
   * @returns {boolean} true if sent, false if not connected
   */
  send(type, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, payload, ts: Date.now() }));
    return true;
  }

  /**
   * Start 20-second keepalive ping interval.
   * Keeps both Chrome service worker and fly.io connection alive.
   */
  _startKeepalive() {
    this._stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 20000);
  }

  _stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  /**
   * Schedule a reconnection with exponential backoff.
   * First retry is immediate, then 1s, 2s, 4s, 8s, 16s, capped at 30s.
   */
  _scheduleReconnect() {
    if (this.reconnectDelay === 0) {
      this.reconnectDelay = 1000;
      console.log('[FSB WS] Reconnecting immediately');
      this.connect();
    } else {
      console.log('[FSB WS] Reconnecting in ' + this.reconnectDelay + 'ms');
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }
  }

  /**
   * Send a state snapshot on connect/reconnect for dashboard sync.
   */
  async _sendStateSnapshot() {
    var snapshotPayload = {
      version: chrome.runtime.getManifest().version,
      timestamp: Date.now()
    };

    // Include current dashboard task state for reconnection recovery
    if (typeof activeSessions !== 'undefined') {
      var dashSession = null;
      activeSessions.forEach(function(s) {
        if (s._isDashboardTask && s.status === 'running') dashSession = s;
      });
      if (dashSession) {
        var progress = typeof calculateProgress === 'function' ? calculateProgress(dashSession) : { progressPercent: 0 };
        snapshotPayload.taskRunning = true;
        snapshotPayload.task = dashSession.task;
        snapshotPayload.progress = progress.progressPercent;
        snapshotPayload.phase = typeof detectTaskPhase === 'function' ? detectTaskPhase(dashSession) : 'unknown';
        snapshotPayload.elapsed = Date.now() - dashSession.startTime;
      } else {
        snapshotPayload.taskRunning = false;
      }
    }

    this.send('ext:snapshot', snapshotPayload);

    // Send ext:page-ready for current active tab so dashboard can start streaming
    try {
      var readyTabId = (typeof _streamingTabId !== 'undefined' && _streamingTabId) ? _streamingTabId : null;
      var readyUrl = '';

      // Verify streaming tab is still valid
      if (readyTabId) {
        try {
          var et = await chrome.tabs.get(readyTabId);
          readyUrl = et?.url || '';
          if (!readyUrl || /^(chrome|about|edge|brave|chrome-extension):/.test(readyUrl)) {
            readyTabId = null;
            readyUrl = '';
          }
        } catch (e) { readyTabId = null; }
      }

      // Fallback: find any real page tab
      if (!readyTabId) {
        var tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        var t = tabs[0];
        if (t && t.url && !/^(chrome|about|edge|brave|chrome-extension):/.test(t.url)) {
          readyTabId = t.id;
          readyUrl = t.url;
        }
      }
      if (!readyTabId) {
        var allActive = await chrome.tabs.query({ active: true });
        for (var ai = 0; ai < allActive.length; ai++) {
          if (allActive[ai].url && !/^(chrome|about|edge|brave|chrome-extension):/.test(allActive[ai].url)) {
            readyTabId = allActive[ai].id;
            readyUrl = allActive[ai].url;
            break;
          }
        }
      }

      if (readyTabId && readyUrl) {
        if (typeof _streamingTabId !== 'undefined') _streamingTabId = readyTabId;
        this.send('ext:page-ready', { tabId: readyTabId, url: readyUrl });
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Handle incoming messages from the relay server.
   * @param {Object} msg - Parsed message { type, payload, ts }
   */
  _handleMessage(msg) {
    switch (msg.type) {
      case 'pong':
        // Server responded to our ping -- connection is healthy
        break;
      case 'dash:task-submit':
        this._handleDashboardTask(msg.payload);
        break;
      case 'dash:stop-task':
        this._handleStopTask();
        break;
      case 'dash:request-status':
        this._sendStateSnapshot();
        break;
      case 'dash:agent-run-now':
        this._handleAgentRunNow(msg.payload);
        break;
      case 'dash:dom-stream-start':
        if (typeof _streamingActive !== 'undefined') _streamingActive = true;
        this._forwardToContentScript('domStreamStart', msg.payload);
        break;
      case 'dash:dom-stream-stop':
        if (typeof _streamingActive !== 'undefined') _streamingActive = false;
        this._forwardToContentScript('domStreamStop', msg.payload);
        break;
      case 'dash:dom-stream-pause':
        this._forwardToContentScript('domStreamPause', msg.payload);
        break;
      case 'dash:dom-stream-resume':
        this._forwardToContentScript('domStreamResume', msg.payload);
        break;
      case 'dash:remote-control-start':
        handleRemoteControlStart();
        break;
      case 'dash:remote-control-stop':
        handleRemoteControlStop();
        break;
      case 'dash:remote-click':
        handleRemoteClick(msg.payload);
        break;
      case 'dash:remote-key':
        handleRemoteKey(msg.payload);
        break;
      case 'dash:remote-scroll':
        handleRemoteScroll(msg.payload);
        break;
      default:
        console.log('[FSB WS] Received: ' + msg.type);
        break;
    }
  }

  /**
   * Handle a task submission from the dashboard.
   * Validates preconditions (no running session, active tab) then dispatches to background.js.
   * @param {Object} payload - { task: string }
   */
  async _handleDashboardTask(payload) {
    var task = payload?.task;
    if (!task) {
      this.send('ext:task-complete', { success: false, error: 'No task provided', elapsed: 0 });
      return;
    }

    // Reject if another session is already running
    if (typeof activeSessions !== 'undefined') {
      var hasRunning = [...activeSessions.values()].some(function(s) { return s.status === 'running'; });
      if (hasRunning) {
        this.send('ext:task-complete', { success: false, error: 'Another task is already running', elapsed: 0 });
        return;
      }
    }

    // Find the best tab for automation: streaming tab > active tab > any real tab
    try {
      var tabId = (typeof _streamingTabId !== 'undefined' && _streamingTabId) ? _streamingTabId : null;

      // Verify streaming tab is still a real page
      if (tabId) {
        try {
          var sTab = await chrome.tabs.get(tabId);
          if (!sTab || !sTab.url || /^(chrome|about|edge|brave|chrome-extension):/.test(sTab.url)) {
            tabId = null; // Stale or restricted
          }
        } catch (e) { tabId = null; }
      }

      // Fallback 1: active tab in last focused window
      if (!tabId) {
        var tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        var t = tabs[0];
        if (t && t.url && !/^(chrome|about|edge|brave|chrome-extension):/.test(t.url)) {
          tabId = t.id;
        }
      }

      // Fallback 2: any active tab in any window
      if (!tabId) {
        var allActive = await chrome.tabs.query({ active: true });
        for (var i = 0; i < allActive.length; i++) {
          if (allActive[i].url && !/^(chrome|about|edge|brave|chrome-extension):/.test(allActive[i].url)) {
            tabId = allActive[i].id;
            break;
          }
        }
      }

      if (!tabId) {
        this.send('ext:task-complete', { success: false, error: 'No active browser tab with a real page', elapsed: 0 });
        return;
      }
      startDashboardTask(tabId, task);
    } catch (err) {
      this.send('ext:task-complete', { success: false, error: err.message, elapsed: 0 });
    }
  }

  /**
   * Handle stop task request from the dashboard.
   * Finds the active dashboard session and stops it.
   */
  _handleStopTask() {
    console.log('[FSB WS] Stop task received from dashboard');

    // Per D-03: stop ANY running automation, not just dashboard tasks
    // Mirror the mcp:stop-automation pattern from background.js
    this._dashStopSent = true;
    handleStopAutomation(
      { action: 'stopAutomation' },
      { id: chrome.runtime.id },
      (result) => {
        console.log('[FSB WS] Stop result:', JSON.stringify(result));
        if (result && result.success) {
          // Build the last action text from the session that was just stopped
          // handleStopAutomation already cleaned up, so send completion now
          this.send('ext:task-complete', {
            success: false,
            error: 'Stopped by user',
            elapsed: result.duration || 0,
            stopped: true,
            lastAction: result.lastAction || null
          });
        } else {
          // No session found or already stopped -- still acknowledge
          this.send('ext:task-complete', {
            success: false,
            error: 'Stopped by user',
            elapsed: 0,
            stopped: true,
            lastAction: null
          });
        }
      }
    );
  }

  /**
   * Handle an immediate agent run request from the dashboard.
   * Validates the agent exists and is not already running, then triggers execution.
   * @param {Object} payload - { agentId: string }
   */
  async _handleAgentRunNow(payload) {
    var agentId = payload && payload.agentId;
    if (!agentId) {
      this.send('ext:agent-run-complete', { agentId: null, success: false, error: 'No agentId provided' });
      return;
    }

    // Check if another session is already running
    if (typeof activeSessions !== 'undefined') {
      var hasRunning = [...activeSessions.values()].some(function(s) { return s.status === 'running'; });
      if (hasRunning) {
        this.send('ext:agent-run-complete', { agentId: agentId, success: false, error: 'Another task is already running' });
        return;
      }
    }

    // Dispatch to background.js handler
    if (typeof startAgentRunNow === 'function') {
      startAgentRunNow(agentId);
    } else {
      this.send('ext:agent-run-complete', { agentId: agentId, success: false, error: 'Agent execution not available' });
    }
  }

  /**
   * Forward a message to the content script on the active tab.
   * Used for dashboard-to-content-script communication (DOM stream control).
   * @param {string} action - Content script action name
   * @param {Object} payload - Additional payload data
   */
  async _forwardToContentScript(action, payload) {
    try {
      // Prefer streaming tab (always-on), fall back to dashboard task tab, then active tab query
      var tabId = (typeof _streamingTabId !== 'undefined' && _streamingTabId)
        ? _streamingTabId
        : (typeof _dashboardTaskTabId !== 'undefined' ? _dashboardTaskTabId : null);
      if (!tabId) {
        // Last resort: query active tab (unreliable from service worker)
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id;
      }
      if (tabId) {
        try {
          await chrome.tabs.sendMessage(tabId, { action: action, ...payload }, { frameId: 0 });
        } catch (sendErr) {
          // Content script not injected yet -- inject it and retry once
          console.log('[FSB WS] Content script not ready on tab', tabId, '-- injecting and retrying', action);
          try {
            var scriptFiles = (typeof CONTENT_SCRIPT_FILES !== 'undefined')
              ? CONTENT_SCRIPT_FILES
              : ['content/init.js', 'content/utils.js', 'content/dom-stream.js', 'content/messaging.js', 'content/lifecycle.js'];
            await chrome.scripting.executeScript({
              target: { tabId: tabId, allFrames: false },
              files: scriptFiles
            });
            // Brief delay for script initialization
            await new Promise(function(r) { setTimeout(r, 300); });
            await chrome.tabs.sendMessage(tabId, { action: action, ...payload }, { frameId: 0 });
          } catch (injectErr) {
            console.warn('[FSB WS] Failed to inject content script on tab', tabId, ':', injectErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('[FSB WS] Failed to forward to content script:', action, e.message);
    }
  }

  /**
   * Update badge icon to reflect connection state.
   * @param {boolean} connected
   */
  _updateBadge(connected) {
    if (connected) {
      chrome.action.setBadgeText({ text: ' ' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    } else {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  }

  /**
   * Clear badge (no WS configured or explicitly disconnected).
   */
  _clearBadge() {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Global instance for service worker
const fsbWebSocket = new FSBWebSocket();
