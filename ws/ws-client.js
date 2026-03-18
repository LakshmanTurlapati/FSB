/**
 * FSB WebSocket Client for Chrome MV3 Service Worker
 * Maintains persistent connection to the relay server with keepalive pings
 * and exponential backoff reconnection.
 */

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
   * Reads config from chrome.storage.local; no-ops if sync not enabled.
   */
  async connect() {
    const { serverUrl, serverHashKey, serverSyncEnabled } = await chrome.storage.local.get([
      'serverUrl', 'serverHashKey', 'serverSyncEnabled'
    ]);

    if (!serverSyncEnabled || !serverHashKey) {
      this._clearBadge();
      return;
    }

    // Close any existing connection before opening a new one
    if (this.ws) {
      try { this.ws.close(); } catch (_) { /* ignore */ }
      this.ws = null;
    }

    const baseUrl = (serverUrl || 'https://fsb-server.fly.dev').replace(/^http/, 'ws');
    const wsUrl = baseUrl + '/ws?key=' + encodeURIComponent(serverHashKey) + '&role=extension';

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
  _sendStateSnapshot() {
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

    // Get the user's active tab to run automation on
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];
      if (!tab || !tab.id) {
        this.send('ext:task-complete', { success: false, error: 'No active browser tab', elapsed: 0 });
        return;
      }
      startDashboardTask(tab.id, task);
    } catch (err) {
      this.send('ext:task-complete', { success: false, error: err.message, elapsed: 0 });
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
