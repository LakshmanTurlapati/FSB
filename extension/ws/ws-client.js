/**
 * FSB WebSocket Client for Chrome MV3 Service Worker
 * Maintains persistent connection to the relay server with keepalive pings
 * and exponential backoff reconnection.
 */

const FSB_SERVER_URL = 'https://full-selfbrowsing.com';
var FSB_TRANSPORT_DIAGNOSTIC_LIMIT = 100;
var FSB_TRANSPORT_TRACKED_TYPES = {
  'dash:request-status': true,
  'dash:dom-stream-start': true,
  'ext:snapshot': true,
  'ext:page-ready': true,
  'ext:stream-state': true,
  'ext:dom-snapshot': true,
  'ext:dom-mutations': true,
  'ext:dom-scroll': true,
  'ext:dom-overlay': true,
  'ext:dom-dialog': true
};

function getCurrentTransportTabId() {
  if (typeof _streamingTabId !== 'undefined' && typeof _streamingTabId === 'number') {
    return _streamingTabId;
  }
  if (typeof _dashboardTaskTabId !== 'undefined' && typeof _dashboardTaskTabId === 'number') {
    return _dashboardTaskTabId;
  }
  return null;
}

function getFSBTransportDiagnostics() {
  if (!globalThis.__FSBTransportDiagnostics || typeof globalThis.__FSBTransportDiagnostics !== 'object') {
    globalThis.__FSBTransportDiagnostics = {
      sentByType: {},
      receivedByType: {},
      forwardFailures: [],
      reconnects: [],
      lastSnapshot: null,
      events: []
    };
  }

  var diagnostics = globalThis.__FSBTransportDiagnostics;
  diagnostics.sentByType = diagnostics.sentByType && typeof diagnostics.sentByType === 'object'
    ? diagnostics.sentByType
    : {};
  diagnostics.receivedByType = diagnostics.receivedByType && typeof diagnostics.receivedByType === 'object'
    ? diagnostics.receivedByType
    : {};
  diagnostics.forwardFailures = Array.isArray(diagnostics.forwardFailures)
    ? diagnostics.forwardFailures
    : [];
  diagnostics.reconnects = Array.isArray(diagnostics.reconnects)
    ? diagnostics.reconnects
    : [];
  diagnostics.events = Array.isArray(diagnostics.events)
    ? diagnostics.events
    : [];
  if (!Object.prototype.hasOwnProperty.call(diagnostics, 'lastSnapshot')) diagnostics.lastSnapshot = null;
  return diagnostics;
}

function pushFSBTransportEntry(bucket, entry) {
  var diagnostics = getFSBTransportDiagnostics();
  diagnostics[bucket].push(entry);
  if (diagnostics[bucket].length > FSB_TRANSPORT_DIAGNOSTIC_LIMIT) {
    diagnostics[bucket].shift();
  }
  return entry;
}

function recordFSBTransportCount(bucket, type) {
  if (!type || !FSB_TRANSPORT_TRACKED_TYPES[type]) return;
  var diagnostics = getFSBTransportDiagnostics();
  diagnostics[bucket][type] = (diagnostics[bucket][type] || 0) + 1;
}

function recordFSBTransportEvent(eventName, details) {
  return pushFSBTransportEntry('events', Object.assign({
    event: eventName,
    ts: Date.now()
  }, details || {}));
}

function recordFSBTransportFailure(eventName, details) {
  return pushFSBTransportEntry('forwardFailures', Object.assign({
    event: eventName,
    ts: Date.now(),
    type: '',
    target: '',
    tabId: getCurrentTransportTabId(),
    readyState: null,
    error: ''
  }, details || {}));
}

function recordFSBTransportReconnect(eventName, details) {
  return pushFSBTransportEntry('reconnects', Object.assign({
    event: eventName,
    ts: Date.now()
  }, details || {}));
}

function setFSBTransportLastSnapshot(snapshot) {
  getFSBTransportDiagnostics().lastSnapshot = Object.assign({
    ts: Date.now()
  }, snapshot || {});
}

getFSBTransportDiagnostics();

// =====================================================================
// Remote Control State (Phase 209)
// =====================================================================
// Dashboard remote-control commands flow through this module. State is
// kept at module scope so the bare-function handlers wired into the
// _handleMessage switch (around line 608) can consult lifecycle state
// without a `this` binding. The active WebSocket instance is exposed on
// globalThis.__fsbWsInstance so handlers can broadcast state back to the
// dashboard via ext:remote-control-state.

var _remoteControlActive = false;
var _lastRemoteControlState = null;

function _getRemoteControlTabId() {
  return getCurrentTransportTabId();
}

function _broadcastRemoteControlState(wsInstance, enabled, reason, tabId) {
  var state = {
    enabled: !!enabled,
    attached: !!enabled,
    tabId: typeof tabId === 'number' ? tabId : null,
    reason: reason || (enabled ? 'ready' : 'user-stop'),
    ownership: enabled ? 'dashboard' : 'none'
  };
  _lastRemoteControlState = state;
  if (wsInstance && typeof wsInstance.send === 'function') {
    wsInstance.send('ext:remote-control-state', state);
  }
  // Phase 213 D-17: parallel runtime push so the Sync tab pill (and any
  // other extension contexts) can subscribe to live state changes.
  // Fire-and-forget; never throws. background.js listens to this push
  // and updates its own _lastRemoteControlState cache (Phase 213 213-02).
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      chrome.runtime.sendMessage({ action: 'remoteControlStateChanged', state: state }, function () {
        // Read lastError to suppress the "Unchecked runtime.lastError" surface
        // when no listener is registered. Benign and expected at SW cold start.
        var _ = chrome.runtime.lastError;
      });
    }
  } catch (e) {
    // Defensive: never let runtime push failures break ext:remote-control-state.
    // Per Phase 211 LOG-01, route through [FSB SYNC] prefix if logging is enabled.
    try { console.warn('[FSB SYNC] runtime push failed', e && e.message ? e.message : 'unknown'); } catch (_e) { /* ignore */ }
  }
  return state;
}

// =====================================================================
// Phase 223 MET-01..05: ext:metrics broadcast (separate frame from
// ext:remote-control-state -- Phase 209 payload shape preserved).
// Mirror of _broadcastRemoteControlState pattern. Fire-and-forget.
// =====================================================================

function _broadcastMetrics(wsInstance, serverHashKey) {
  if (!wsInstance || typeof wsInstance.send !== 'function') return;

  // Source of truth for cost/tokens -- do NOT recalculate (MET-04).
  var stats;
  try {
    stats = (typeof analytics !== 'undefined' && analytics && typeof analytics.getStats === 'function')
      ? analytics.getStats('24h')
      : null;
  } catch (e) {
    stats = null;
  }
  if (!stats || typeof stats !== 'object') {
    stats = { totalRequests: 0, successfulRequests: 0, totalCost: 0, totalTokens: 0 };
  }

  var rcState = (typeof _lastRemoteControlState === 'object' && _lastRemoteControlState)
    ? _lastRemoteControlState
    : { enabled: false, attached: false, tabId: null };

  var totalRequests = typeof stats.totalRequests === 'number' ? stats.totalRequests : 0;
  var successfulRequests = typeof stats.successfulRequests === 'number' ? stats.successfulRequests : 0;
  var errorCount = Math.max(0, totalRequests - successfulRequests);

  var pairedClient = '';
  if (typeof serverHashKey === 'string' && serverHashKey.length > 0) {
    pairedClient = serverHashKey.substring(0, 8);
  }

  var payload = {
    connection: {
      connected: true,
      pairedClient: pairedClient,
      connectedAt: Date.now()
    },
    sessions: {
      activeSessions: rcState.enabled ? 1 : 0,
      completedTasks: successfulRequests,
      errorCount: errorCount
    },
    cost: {
      totalCost: typeof stats.totalCost === 'number' ? stats.totalCost : 0,
      totalTokens: typeof stats.totalTokens === 'number' ? stats.totalTokens : 0
    }
  };

  // MET-05: omit activeTab field entirely when not attached.
  if (rcState.enabled && typeof rcState.tabId === 'number') {
    payload.activeTab = { tabId: rcState.tabId, url: '' };
    // Best-effort URL fetch; do NOT block the emit. chrome.tabs.get is
    // async, so the dashboard receives an empty URL on this first frame
    // and a follow-up ext:metrics frame patches the URL when available.
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.get === 'function') {
        chrome.tabs.get(rcState.tabId, function (tab) {
          var _ignore = chrome.runtime && chrome.runtime.lastError;
          if (tab && typeof tab.url === 'string' && wsInstance && typeof wsInstance.send === 'function') {
            wsInstance.send('ext:metrics', Object.assign({}, payload, {
              activeTab: { tabId: rcState.tabId, url: tab.url }
            }));
          }
        });
      }
    } catch (_e) { /* defensive */ }
  }

  try {
    wsInstance.send('ext:metrics', payload);
  } catch (e) {
    try { console.warn('[FSB SYNC] metrics broadcast failed', e && e.message ? e.message : 'unknown'); } catch (_e) { /* ignore */ }
  }
}

function handleRemoteControlStart() {
  var tabId = _getRemoteControlTabId();
  if (!tabId) {
    console.warn('[FSB RC] Cannot start remote control: no active tab');
    _broadcastRemoteControlState(globalThis.__fsbWsInstance, false, 'no-tab', null);
    return;
  }
  _remoteControlActive = true;
  console.log('[FSB RC] Remote control started for tab', tabId);
  _broadcastRemoteControlState(globalThis.__fsbWsInstance, true, 'ready', tabId);
}

function handleRemoteControlStop() {
  _remoteControlActive = false;
  console.log('[FSB RC] Remote control stopped');
  _broadcastRemoteControlState(globalThis.__fsbWsInstance, false, 'user-stop', null);
}

// =====================================================================
// Remote Control Input Dispatch (Phase 209)
// =====================================================================
// Click, key, and scroll handlers translate dashboard payloads into CDP
// input events on the active streaming tab. All handlers:
//   - Guard on _remoteControlActive (T-209-05 elevation-of-privilege)
//   - Validate payload shape before any CDP dispatch (T-209-01/02/03)
//   - Wrap CDP calls in try/catch so a single failure does not crash the
//     WebSocket client (T-209-04)
//
// Dashboard sends modifiers as a bitmask integer:
//   alt = 1, ctrl = 2, meta = 4, shift = 8
// cdpClickAt expects { shiftKey, ctrlKey, altKey } booleans, so the click
// handler decomposes the bitmask. CDP Input.dispatchKeyEvent accepts the
// same bitmask format the dashboard sends, so keyDown/keyUp pass it
// through unchanged.

async function handleRemoteClick(payload) {
  if (!_remoteControlActive) {
    console.warn('[FSB RC] Click ignored: remote control not active');
    return;
  }
  if (!payload || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) {
    console.warn('[FSB RC] Click rejected: invalid payload', payload);
    return;
  }
  var tabId = _getRemoteControlTabId();
  if (!tabId) {
    console.warn('[FSB RC] Click failed: no active tab');
    return;
  }
  // Decompose dashboard bitmask modifiers into boolean flags for cdpClickAt.
  // Dashboard bitmask: alt=1, ctrl=2, meta=4, shift=8.
  var mods = typeof payload.modifiers === 'number' ? payload.modifiers : 0;
  try {
    var result = await executeCDPToolDirect({
      tool: 'cdpClickAt',
      params: {
        x: payload.x,
        y: payload.y,
        altKey: !!(mods & 1),
        ctrlKey: !!(mods & 2),
        shiftKey: !!(mods & 8)
      }
    }, tabId);
    if (!result || !result.success) {
      console.warn('[FSB RC] Click CDP dispatch failed:', result && result.error);
    }
  } catch (err) {
    console.error('[FSB RC] Click error:', err && err.message ? err.message : err);
  }
}

async function handleRemoteKey(payload) {
  if (!_remoteControlActive) {
    console.warn('[FSB RC] Key ignored: remote control not active');
    return;
  }
  if (!payload || !payload.type) {
    console.warn('[FSB RC] Key rejected: invalid payload', payload);
    return;
  }
  var tabId = _getRemoteControlTabId();
  if (!tabId) {
    console.warn('[FSB RC] Key failed: no active tab');
    return;
  }
  var mods = typeof payload.modifiers === 'number' ? payload.modifiers : 0;

  try {
    if (payload.type === 'insertText') {
      // Use the established cdpInsertText verb in executeCDPToolDirect.
      var insertResult = await executeCDPToolDirect({
        tool: 'cdpInsertText',
        params: { text: payload.text || payload.key || '', clearFirst: false }
      }, tabId);
      if (!insertResult || !insertResult.success) {
        console.warn('[FSB RC] InsertText CDP dispatch failed:', insertResult && insertResult.error);
      }
    } else if (payload.type === 'keyDown' || payload.type === 'keyUp') {
      // executeCDPToolDirect does not expose a keyDown/keyUp verb, so we
      // dispatch the CDP keyboard event directly. Follow the same
      // attach-with-stale-debugger-recovery pattern used by cdpClickAt.
      var debuggerAttached = false;
      try {
        if (typeof keyboardEmulator !== 'undefined' && keyboardEmulator && keyboardEmulator.isAttachedTo(tabId)) {
          await keyboardEmulator.detachDebugger(tabId);
        }
        try {
          await chrome.debugger.attach({ tabId: tabId }, '1.3');
        } catch (attachErr) {
          if (attachErr && attachErr.message && attachErr.message.includes('Another debugger is already attached')) {
            try { await chrome.debugger.detach({ tabId: tabId }); } catch (_e) { /* ignore */ }
            await chrome.debugger.attach({ tabId: tabId }, '1.3');
          } else {
            throw attachErr;
          }
        }
        debuggerAttached = true;

        await chrome.debugger.sendCommand({ tabId: tabId }, 'Input.dispatchKeyEvent', {
          type: payload.type === 'keyDown' ? 'keyDown' : 'keyUp',
          key: payload.key || '',
          code: payload.code || '',
          text: payload.type === 'keyDown' ? (payload.text || '') : '',
          modifiers: mods
        });

        await chrome.debugger.detach({ tabId: tabId });
        debuggerAttached = false;
      } catch (keyErr) {
        console.warn('[FSB RC] Key', payload.type, 'CDP dispatch failed:', keyErr && keyErr.message ? keyErr.message : keyErr);
      } finally {
        if (debuggerAttached) {
          try { await chrome.debugger.detach({ tabId: tabId }); } catch (_e) { /* ignore */ }
        }
      }
    } else {
      console.warn('[FSB RC] Key rejected: unknown type', payload.type);
    }
  } catch (err) {
    console.error('[FSB RC] Key error:', err && err.message ? err.message : err);
  }
}

async function handleRemoteScroll(payload) {
  if (!_remoteControlActive) {
    console.warn('[FSB RC] Scroll ignored: remote control not active');
    return;
  }
  if (!payload || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) {
    console.warn('[FSB RC] Scroll rejected: invalid payload', payload);
    return;
  }
  var tabId = _getRemoteControlTabId();
  if (!tabId) {
    console.warn('[FSB RC] Scroll failed: no active tab');
    return;
  }
  var deltaX = Number.isFinite(payload.deltaX) ? payload.deltaX : 0;
  var deltaY = Number.isFinite(payload.deltaY) ? payload.deltaY : 0;
  try {
    var result = await executeCDPToolDirect({
      tool: 'cdpScrollAt',
      params: { x: payload.x, y: payload.y, deltaX: deltaX, deltaY: deltaY }
    }, tabId);
    if (!result || !result.success) {
      console.warn('[FSB RC] Scroll CDP dispatch failed:', result && result.error);
    }
  } catch (err) {
    console.error('[FSB RC] Scroll error:', err && err.message ? err.message : err);
  }
}

// =====================================================================
// Remote Navigation (Phase 212)
// =====================================================================
// Dashboard sends `dash:navigate` with { url } to drive the streaming tab
// to a new address. Unlike click/key/scroll, this does NOT require remote
// control to be active -- typing a URL in the dashboard URL bar is a
// distinct workflow from interacting with the page contents. The handler
// resolves the active streaming tab via getCurrentTransportTabId(), falls
// back to the active tab in the focused window, normalizes bare domains
// to https://, and uses chrome.tabs.update() to navigate. Result is
// broadcast back as `ext:navigate-result`.

function _normalizeNavigateUrl(input) {
  if (typeof input !== 'string') return null;
  var url = input.trim();
  if (!url) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return url; // already has scheme
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return url;     // mailto:, chrome:, etc.
  if (/^\/\//.test(url)) return 'https:' + url;              // protocol-relative
  return 'https://' + url;                                   // bare domain or path
}

function _broadcastNavigateResult(wsInstance, ok, payload) {
  if (!wsInstance || typeof wsInstance.send !== 'function') return;
  var msg = { ok: !!ok };
  if (payload && typeof payload === 'object') {
    if (typeof payload.tabId === 'number') msg.tabId = payload.tabId;
    if (typeof payload.url === 'string') msg.url = payload.url;
    if (typeof payload.error === 'string') msg.error = payload.error;
    if (typeof payload.reason === 'string') msg.reason = payload.reason;
  }
  wsInstance.send('ext:navigate-result', msg);
}

async function handleRemoteNavigateHistory(payload) {
  var wsInstance = globalThis.__fsbWsInstance;
  var direction = payload && typeof payload.direction === 'string' ? payload.direction : '';
  if (direction !== 'back' && direction !== 'forward' && direction !== 'reload') {
    _broadcastNavigateResult(wsInstance, false, { error: 'invalid-direction', reason: 'direction must be back|forward|reload' });
    return;
  }
  var tabId = _getRemoteControlTabId();
  if (typeof tabId !== 'number') {
    try {
      var tabs = await new Promise(function (resolve) {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (t) { resolve(t || []); });
      });
      if (tabs && tabs[0] && typeof tabs[0].id === 'number') tabId = tabs[0].id;
    } catch (_e) { /* ignore */ }
  }
  if (typeof tabId !== 'number') {
    _broadcastNavigateResult(wsInstance, false, { error: 'no-tab', reason: 'No active tab' });
    return;
  }
  try {
    await new Promise(function (resolve, reject) {
      var cb = function () {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      };
      if (direction === 'back') chrome.tabs.goBack(tabId, cb);
      else if (direction === 'forward') chrome.tabs.goForward(tabId, cb);
      else chrome.tabs.reload(tabId, {}, cb);
    });
    _broadcastNavigateResult(wsInstance, true, { tabId: tabId });
  } catch (err) {
    var msg = err && err.message ? err.message : 'history navigation failed';
    console.warn('[FSB NAV] History', direction, 'failed:', msg);
    _broadcastNavigateResult(wsInstance, false, { tabId: tabId, error: 'navigate-failed', reason: msg });
  }
}

async function handleRemoteNavigate(payload) {
  var wsInstance = globalThis.__fsbWsInstance;
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    console.warn('[FSB NAV] Navigate rejected: invalid payload', payload);
    _broadcastNavigateResult(wsInstance, false, { error: 'invalid-url', reason: 'Missing or empty url' });
    return;
  }
  var url = _normalizeNavigateUrl(payload.url);
  if (!url) {
    _broadcastNavigateResult(wsInstance, false, { error: 'invalid-url', reason: 'Could not normalize url' });
    return;
  }
  // Reject obviously dangerous targets. chrome://, file://, javascript:, data:, blob:
  // are blocked by chrome.tabs.update for non-extension pages anyway, but rejecting
  // here gives the dashboard a clear error message.
  if (/^(javascript|data|blob|file):/i.test(url)) {
    _broadcastNavigateResult(wsInstance, false, { url: url, error: 'unsafe-scheme', reason: 'Scheme not allowed' });
    return;
  }

  var tabId = _getRemoteControlTabId();
  if (typeof tabId !== 'number') {
    // Fall back: navigate the active tab in the focused window. This lets the
    // user steer the browser away from chrome://newtab even before streaming
    // has resolved a candidate tab.
    try {
      var tabs = await new Promise(function (resolve) {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (t) { resolve(t || []); });
      });
      if (tabs && tabs[0] && typeof tabs[0].id === 'number') tabId = tabs[0].id;
    } catch (_e) { /* ignore */ }
  }
  if (typeof tabId !== 'number') {
    _broadcastNavigateResult(wsInstance, false, { url: url, error: 'no-tab', reason: 'No active tab to navigate' });
    return;
  }

  try {
    await new Promise(function (resolve, reject) {
      chrome.tabs.update(tabId, { url: url }, function (tab) {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(tab);
      });
    });
    console.log('[FSB NAV] Navigated tab', tabId, 'to', url);
    _broadcastNavigateResult(wsInstance, true, { tabId: tabId, url: url });
  } catch (err) {
    var msg = err && err.message ? err.message : 'navigate failed';
    console.warn('[FSB NAV] Navigate failed:', msg);
    _broadcastNavigateResult(wsInstance, false, { tabId: tabId, url: url, error: 'navigate-failed', reason: msg });
  }
}

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

    // Phase 223 MET-02: capture for metrics broadcast (truncated to 8 chars when emitted).
    this.serverHashKey = serverHashKey;

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
      // Phase 209: Expose this instance so bare-function remote control
      // handlers (handleRemoteControlStart/Stop, etc.) can broadcast state
      // back to the dashboard via ext:remote-control-state.
      globalThis.__fsbWsInstance = this;
      recordFSBTransportReconnect('ws-open', {
        readyState: this.ws ? this.ws.readyState : null
      });
      this._sendStateSnapshot('connect');
      // Phase 223 MET-01: push metrics on connect (not polling).
      try { _broadcastMetrics(this, this.serverHashKey); } catch (_e) { /* defensive */ }
      this._updateBadge(true);
      console.log('[FSB WS] Connected');
    };

    this.ws.onmessage = (event) => {
      try {
        var raw = JSON.parse(event.data);
        // Self-identifying _lz envelope: { _lz: true, d: <base64> }.
        // Mirrors showcase/js/dashboard.js:3517-3528. Stateless per-frame.
        // Do NOT introduce permessage-deflate or alternative deflate libraries
        // (PITFALLS.md P9 -- sliding-window corruption on bad frame requires
        // reconnect to recover).
        if (raw && raw._lz === true && typeof raw.d === 'string') {
          if (typeof LZString === 'undefined') {
            recordFSBTransportFailure('decompress-unavailable', {
              target: 'inbound',
              type: '_lz',
              tabId: getCurrentTransportTabId(),
              error: 'LZString not loaded (importScripts may have failed at background.js:37)',
              len: raw.d.length
            });
            return;
          }
          var decoded = LZString.decompressFromBase64(raw.d);
          if (!decoded) {
            recordFSBTransportFailure('decompress-failed', {
              target: 'inbound',
              type: '_lz',
              tabId: getCurrentTransportTabId(),
              error: 'LZString.decompressFromBase64 returned null/empty',
              len: raw.d.length
            });
            return;
          }
          raw = JSON.parse(decoded);
        }
        this._handleMessage(raw);
      } catch (err) {
        console.warn('[FSB WS] Failed to parse message:', err && err.message ? err.message : err);
      }
    };

    this.ws.onclose = (event) => {
      this.connected = false;
      this._stopKeepalive();
      this._updateBadge(false);
      recordFSBTransportReconnect('ws-close', {
        readyState: this.ws ? this.ws.readyState : null,
        closeCode: event && typeof event.code === 'number' ? event.code : null,
        closeReason: event && event.reason ? event.reason : ''
      });
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      recordFSBTransportFailure('message-send-failed', {
        type: type,
        target: 'relay',
        tabId: getCurrentTransportTabId(),
        readyState: this.ws ? this.ws.readyState : 'missing',
        error: 'WebSocket not open'
      });
      return false;
    }

    // _lz envelope contract (round-trip):
    //   Outbound: { _lz: true, d: LZString.compressToBase64(JSON.stringify({type, payload, ts})) }
    //             emitted when raw > 1024 bytes AND compressed.length < raw.length.
    //   Inbound:  symmetric branch in onmessage at lines 515-522 above. Self-identifying.
    //   Stateless per-frame. Do NOT replace LZString with stateful deflate compression
    //   -- per-connection stateful compression (RFC 7692 permessage-deflate) corrupts the
    //   sliding window on any bad frame and forces a full WebSocket reconnect to recover
    //   (PITFALLS.md P9).
    try {
      var raw = JSON.stringify({ type, payload, ts: Date.now() });
      // Compress payloads larger than 1KB to avoid relay message size limits
      if (raw.length > 1024 && typeof LZString !== 'undefined') {
        var compressed = LZString.compressToBase64(raw);
        // Only use compression if it actually reduces size
        if (compressed.length < raw.length) {
          console.log('[FSB WS] Compressed ' + type + ': ' + raw.length + ' -> ' + compressed.length + ' bytes (' + Math.round(compressed.length / raw.length * 100) + '%)');
          this.ws.send(JSON.stringify({ _lz: true, d: compressed }));
          recordFSBTransportCount('sentByType', type);
          return true;
        }
      }
      this.ws.send(raw);
      recordFSBTransportCount('sentByType', type);
      return true;
    } catch (err) {
      recordFSBTransportFailure('message-send-failed', {
        type: type,
        target: 'relay',
        tabId: getCurrentTransportTabId(),
        readyState: this.ws ? this.ws.readyState : 'missing',
        error: err && err.message ? err.message : 'WebSocket send failed'
      });
      return false;
    }
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
    recordFSBTransportReconnect('ws-reconnect-scheduled', {
      delayMs: this.reconnectDelay === 0 ? 0 : this.reconnectDelay,
      readyState: this.ws ? this.ws.readyState : 'missing'
    });
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
  async _sendStateSnapshot(snapshotSource) {
    snapshotSource = snapshotSource || 'dash:request-status';
    var snapshotPayload = {
      version: chrome.runtime.getManifest().version,
      timestamp: Date.now(),
      snapshotSource: snapshotSource
    };

    // Include current or recently completed dashboard task state for reconnection recovery.
    var recoverableTask = typeof _getDashboardTaskRecoverySnapshot === 'function'
      ? _getDashboardTaskRecoverySnapshot()
      : null;
    if (!recoverableTask && typeof activeSessions !== 'undefined') {
      var dashSession = null;
      activeSessions.forEach(function(s) {
        if (s._isDashboardTask && s.status === 'running') dashSession = s;
      });
      if (dashSession) {
        var progress = typeof calculateProgress === 'function' ? calculateProgress(dashSession) : { progressPercent: 0, estimatedTimeRemaining: null };
        recoverableTask = {
          taskRunId: dashSession._dashboardTaskRunId || '',
          taskStatus: 'running',
          task: dashSession.task || '',
          progress: progress.progressPercent,
          phase: typeof detectTaskPhase === 'function' ? detectTaskPhase(dashSession) : 'unknown',
          eta: progress.estimatedTimeRemaining || null,
          elapsed: Date.now() - dashSession.startTime,
          action: dashSession._lastActionSummary || 'Working...',
          lastAction: dashSession._lastActionSummary || '',
          summary: '',
          error: '',
          stopped: false,
          tabId: typeof dashSession.tabId === 'number' ? dashSession.tabId : null,
          taskSource: 'snapshot',
          updatedAt: Date.now()
        };
      }
    }

    if (recoverableTask) {
      snapshotPayload.taskRunId = recoverableTask.taskRunId || '';
      snapshotPayload.taskStatus = recoverableTask.taskStatus || 'idle';
      snapshotPayload.taskRunning = snapshotPayload.taskStatus === 'running';
      snapshotPayload.task = recoverableTask.task || '';
      snapshotPayload.progress = typeof recoverableTask.progress === 'number' ? recoverableTask.progress : 0;
      snapshotPayload.phase = recoverableTask.phase || '';
      snapshotPayload.eta = recoverableTask.eta || null;
      snapshotPayload.elapsed = recoverableTask.elapsed || 0;
      snapshotPayload.action = recoverableTask.action || '';
      snapshotPayload.lastAction = recoverableTask.lastAction || '';
      snapshotPayload.summary = recoverableTask.summary || '';
      snapshotPayload.error = recoverableTask.error || '';
      snapshotPayload.stopped = !!recoverableTask.stopped;
      snapshotPayload.taskSource = recoverableTask.taskSource || 'snapshot';
      snapshotPayload.taskUpdatedAt = recoverableTask.updatedAt || snapshotPayload.timestamp;
    } else {
      snapshotPayload.taskRunId = '';
      snapshotPayload.taskRunning = false;
      snapshotPayload.taskStatus = 'idle';
      snapshotPayload.taskSource = 'snapshot';
    }

    var candidate = await this._resolveStreamCandidate();
    var streamIntentActive = (typeof _streamingActive !== 'undefined') && !!_streamingActive;
    var streamStatus = candidate.ready
      ? (streamIntentActive ? 'recovering' : 'ready')
      : 'not-ready';
    var streamReason = candidate.ready
      ? (streamIntentActive ? 'waiting-for-page-ready' : '')
      : (candidate.reason || 'no-streamable-tab');

    snapshotPayload.streamIntentActive = streamIntentActive;
    snapshotPayload.streamTabId = typeof candidate.tabId === 'number' ? candidate.tabId : null;
    snapshotPayload.streamTabUrl = candidate.url || '';
    snapshotPayload.streamStatus = streamStatus;
    snapshotPayload.streamReason = streamReason;
    snapshotPayload.remoteControl = (typeof _lastRemoteControlState === 'object' && _lastRemoteControlState)
      ? Object.assign({}, _lastRemoteControlState)
      : {
          enabled: false,
          attached: false,
          tabId: null,
          reason: 'user-stop',
          ownership: 'none'
        };
    setFSBTransportLastSnapshot(snapshotPayload);

    this.send('ext:snapshot', snapshotPayload);

    if (candidate.ready) {
      if (typeof _rememberStreamState === 'function') {
        _rememberStreamState(streamStatus, streamReason, candidate.tabId, candidate.url, snapshotSource + ':snapshot');
      }
      if (typeof _streamingTabId !== 'undefined') _streamingTabId = candidate.tabId;
      this.send('ext:page-ready', { tabId: candidate.tabId, url: candidate.url });
      return;
    }

    recordFSBTransportFailure('stream-tab-not-ready', {
      type: 'ext:snapshot',
      target: 'stream-candidate',
      tabId: typeof candidate.tabId === 'number' ? candidate.tabId : null,
      readyState: 'not-ready',
      error: streamReason
    });
    this._emitStreamState('not-ready', streamReason, {
      tabId: candidate.tabId,
      url: candidate.url || '',
      source: snapshotSource + ':snapshot'
    });
  }

  async _resolveStreamCandidate() {
    var seenTabIds = new Set();
    var fallback = {
      ready: false,
      reason: 'no-streamable-tab',
      tabId: null,
      url: '',
      source: 'no-streamable-tab'
    };
    var preferredTabId = (typeof _streamingTabId !== 'undefined' && _streamingTabId) ? _streamingTabId : null;

    if (preferredTabId) {
      try {
        var preferredTab = await chrome.tabs.get(preferredTabId);
        seenTabIds.add(preferredTab.id);
        if (this._isStreamableTab(preferredTab)) {
          return {
            ready: true,
            tabId: preferredTab.id,
            url: preferredTab.url || '',
            source: 'streaming-tab'
          };
        }
        fallback = {
          ready: false,
          reason: 'restricted-tab',
          tabId: preferredTab.id || preferredTabId,
          url: preferredTab.url || '',
          source: 'streaming-tab'
        };
      } catch (err) {
        fallback = {
          ready: false,
          reason: 'tab-closed',
          tabId: preferredTabId,
          url: '',
          source: 'streaming-tab'
        };
      }
    }

    var queries = [
      { source: 'last-focused-active', query: { active: true, lastFocusedWindow: true } },
      { source: 'any-active', query: { active: true } }
    ];

    for (var i = 0; i < queries.length; i++) {
      var tabs = await chrome.tabs.query(queries[i].query);
      for (var j = 0; j < tabs.length; j++) {
        var tab = tabs[j];
        if (!tab || typeof tab.id !== 'number' || seenTabIds.has(tab.id)) continue;
        seenTabIds.add(tab.id);

        if (this._isStreamableTab(tab)) {
          return {
            ready: true,
            tabId: tab.id,
            url: tab.url || '',
            source: queries[i].source
          };
        }

        if (fallback.reason === 'no-streamable-tab' || fallback.reason === 'tab-closed') {
          fallback = {
            ready: false,
            reason: 'restricted-tab',
            tabId: tab.id,
            url: tab.url || '',
            source: queries[i].source
          };
        }
      }
    }

    return fallback;
  }

  _isStreamableTab(tab) {
    return !!tab
      && typeof tab.id === 'number'
      && !!tab.url
      && (typeof _isStreamableTabUrl === 'function'
        ? _isStreamableTabUrl(tab.url)
        : !/^(chrome|about|edge|brave|chrome-extension):/.test(tab.url));
  }

  _emitStreamState(status, reason, details) {
    var payload = details || {};
    var source = payload.source || 'ws-client';

    // Phase 212 / STREAM-06: enrich restricted-tab states with pageType so the
    // dashboard can render a friendly placeholder ("New Tab", "Chrome Settings",
    // etc.) instead of a generic error.
    var pageType = '';
    if (reason === 'restricted-tab' && payload.url && typeof getPageTypeDescription === 'function') {
      try { pageType = getPageTypeDescription(payload.url); } catch (_) { /* ignore */ }
    }

    if (typeof _sendStreamState === 'function') {
      _sendStreamState(status, reason, {
        tabId: payload.tabId,
        url: payload.url || '',
        source: source,
        pageType: pageType
      });
      return;
    }

    if (typeof _rememberStreamState === 'function') {
      _rememberStreamState(status, reason, payload.tabId, payload.url || '', source);
    }

    this.send('ext:stream-state', {
      status: status,
      reason: reason || '',
      streamIntentActive: (typeof _streamingActive !== 'undefined') && !!_streamingActive,
      tabId: typeof payload.tabId === 'number' ? payload.tabId : null,
      url: payload.url || '',
      pageType: pageType,
      source: source,
      // Phase 211-02 STREAM-02: peak watchdog-induced flushes since last drain.
      // Source: SW-side cache _lastDomStreamStaleFlushCount, populated by the
      // content-script flushMutations envelope (D-14 additive). Defaults to 0
      // when streaming is inactive or the cache has not yet been populated.
      staleFlushCount: (typeof _lastDomStreamStaleFlushCount === 'number') ? _lastDomStreamStaleFlushCount : 0
    });
  }

  async _handleDashboardStreamStart(payload) {
    var candidate = await this._resolveStreamCandidate();

    if (!candidate.ready) {
      recordFSBTransportFailure('stream-tab-not-ready', {
        type: 'dash:dom-stream-start',
        target: 'stream-candidate',
        tabId: typeof candidate.tabId === 'number' ? candidate.tabId : null,
        readyState: 'not-ready',
        error: candidate.reason || 'no-streamable-tab'
      });
      this._emitStreamState('not-ready', candidate.reason || 'no-streamable-tab', {
        tabId: candidate.tabId,
        url: candidate.url || '',
        source: 'dash:dom-stream-start'
      });
      return;
    }

    if (typeof _streamingTabId !== 'undefined') _streamingTabId = candidate.tabId;
    this._emitStreamState('recovering', 'waiting-for-page-ready', {
      tabId: candidate.tabId,
      url: candidate.url || '',
      source: 'dash:dom-stream-start'
    });
    this._forwardToContentScript('domStreamStart', payload);
  }

  /**
   * Handle incoming messages from the relay server.
   * @param {Object} msg - Parsed message { type, payload, ts }
   */
  _handleMessage(msg) {
    recordFSBTransportCount('receivedByType', msg && msg.type);

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
        this._sendStateSnapshot('dash:request-status');
        break;
      // DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md
      // case 'dash:agent-run-now':
      //   this._handleAgentRunNow(msg.payload);
      //   break;
      case 'dash:dom-stream-start':
        if (typeof _streamingActive !== 'undefined') _streamingActive = true;
        this._handleDashboardStreamStart(msg.payload);
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
      case 'dash:navigate':
        handleRemoteNavigate(msg.payload);
        break;
      case 'dash:navigate-history':
        handleRemoteNavigateHistory(msg.payload);
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
    // Reset stop flags for new task
    this._dashStopSent = false;
    this._stopInFlight = false;

    var task = payload?.task;
    var now = Date.now();
    if (!task) {
      this.send('ext:task-complete', {
        success: false,
        error: 'No task provided',
        elapsed: 0,
        taskRunId: '',
        taskStatus: 'failed',
        taskSource: 'live',
        updatedAt: now,
        lastAction: ''
      });
      return;
    }

    // Reject if another session is already running
    if (typeof activeSessions !== 'undefined') {
      var hasRunning = [...activeSessions.values()].some(function(s) { return s.status === 'running'; });
      if (hasRunning) {
        this.send('ext:task-complete', {
          success: false,
          error: 'Another task is already running',
          elapsed: 0,
          taskRunId: '',
          taskStatus: 'failed',
          taskSource: 'live',
          updatedAt: now,
          lastAction: ''
        });
        return;
      }
    }

    // Find the best tab for automation: streaming tab > active tab > any active tab > create about:blank
    try {
      var tabId = (typeof _streamingTabId !== 'undefined' && _streamingTabId) ? _streamingTabId : null;

      // Verify streaming tab still exists. Dashboard tasks may now start from restricted tabs too.
      if (tabId) {
        try {
          var sTab = await chrome.tabs.get(tabId);
          if (!sTab || !sTab.id) {
            tabId = null;
          }
        } catch (e) { tabId = null; }
      }

      // Fallback 1: active tab in last focused window
      if (!tabId) {
        var tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        var t = tabs[0];
        if (t && t.id) {
          tabId = t.id;
        }
      }

      // Fallback 2: any active tab in any window
      if (!tabId) {
        var allActive = await chrome.tabs.query({ active: true });
        for (var i = 0; i < allActive.length; i++) {
          if (allActive[i].id) {
            tabId = allActive[i].id;
            break;
          }
        }
      }

      // Fallback 3: create a neutral tab and let background routing decide the first page
      if (!tabId) {
        var created = await chrome.tabs.create({ url: 'about:blank', active: true });
        tabId = created && created.id;
      }

      if (!tabId) {
        this.send('ext:task-complete', {
          success: false,
          error: 'No usable browser tab found for automation',
          elapsed: 0,
          taskRunId: '',
          taskStatus: 'failed',
          taskSource: 'live',
          updatedAt: now,
          lastAction: ''
        });
        return;
      }
      chrome.runtime.sendMessage({
        action: 'startAutomation',
        task: task,
        tabId: tabId,
        source: 'dashboard'
      });
    } catch (err) {
      this.send('ext:task-complete', {
        success: false,
        error: err.message,
        elapsed: 0,
        taskRunId: '',
        taskStatus: 'failed',
        taskSource: 'live',
        updatedAt: Date.now(),
        lastAction: ''
      });
    }
  }

  /**
   * Handle stop task request from the dashboard.
   * Finds the active dashboard session and stops it.
   */
  _handleStopTask() {
    // Idempotency: ignore if a stop is already in-flight
    if (this._stopInFlight) {
      console.log('[FSB WS] Stop already in-flight, ignoring duplicate dash:stop-task');
      return;
    }
    this._stopInFlight = true;

    console.log('[FSB WS] Stop task received from dashboard');

    // Per D-03: stop ANY running automation, not just dashboard tasks
    // Mirror the mcp:stop-automation pattern from background.js
    this._dashStopSent = true;
    handleStopAutomation(
      { action: 'stopAutomation' },
      { id: chrome.runtime.id },
      (result) => {
        console.log('[FSB WS] Stop result:', JSON.stringify(result));
        var recoveryTask = typeof _getDashboardTaskRecoverySnapshot === 'function'
          ? _getDashboardTaskRecoverySnapshot()
          : null;
        var completionTimestamp = Date.now();

        // Skip sending if this was a duplicate (handleStopAutomation already handled it)
        if (result && result.duplicate) {
          console.log('[FSB WS] Duplicate stop -- not sending ext:task-complete again');
          this._stopInFlight = false;
          return;
        }

        if (result && result.success) {
          // Build the last action text from the session that was just stopped
          // handleStopAutomation already cleaned up, so send completion now
          this.send('ext:task-complete', {
            success: false,
            error: 'Stopped by user',
            elapsed: result.duration || 0,
            stopped: true,
            taskRunId: recoveryTask && recoveryTask.taskRunId ? recoveryTask.taskRunId : '',
            task: recoveryTask && recoveryTask.task ? recoveryTask.task : '',
            taskStatus: 'stopped',
            progress: recoveryTask && typeof recoveryTask.progress === 'number' ? recoveryTask.progress : 0,
            phase: recoveryTask && recoveryTask.phase ? recoveryTask.phase : '',
            action: recoveryTask && recoveryTask.action ? recoveryTask.action : '',
            summary: '',
            taskSource: recoveryTask && recoveryTask.taskSource
              ? recoveryTask.taskSource
              : (result && result.success ? 'stop-fallback' : 'complete-fallback'),
            updatedAt: recoveryTask && recoveryTask.updatedAt ? recoveryTask.updatedAt : completionTimestamp,
            lastAction: result.lastAction || (recoveryTask && recoveryTask.lastAction ? recoveryTask.lastAction : null)
          });
        } else {
          // No session found or already stopped -- still acknowledge
          this.send('ext:task-complete', {
            success: false,
            error: 'Stopped by user',
            elapsed: 0,
            stopped: true,
            taskRunId: recoveryTask && recoveryTask.taskRunId ? recoveryTask.taskRunId : '',
            task: recoveryTask && recoveryTask.task ? recoveryTask.task : '',
            taskStatus: 'stopped',
            progress: recoveryTask && typeof recoveryTask.progress === 'number' ? recoveryTask.progress : 0,
            phase: recoveryTask && recoveryTask.phase ? recoveryTask.phase : '',
            action: recoveryTask && recoveryTask.action ? recoveryTask.action : '',
            summary: '',
            taskSource: recoveryTask && recoveryTask.taskSource ? recoveryTask.taskSource : 'duplicate-stop',
            updatedAt: recoveryTask && recoveryTask.updatedAt ? recoveryTask.updatedAt : completionTimestamp,
            lastAction: recoveryTask && recoveryTask.lastAction ? recoveryTask.lastAction : null
          });
        }

        // Reset for next task
        this._stopInFlight = false;
      }
    );
  }

  // DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md
//   /**
//    * Handle an immediate agent run request from the dashboard.
//    * Validates the agent exists and is not already running, then triggers execution.
//    * @param {Object} payload - { agentId: string }
//    */
//   async _handleAgentRunNow(payload) {
//     var agentId = payload && payload.agentId;
//     if (!agentId) {
//       this.send('ext:agent-run-complete', { agentId: null, success: false, error: 'No agentId provided' });
//       return;
//     }
//
//     // Check if another session is already running
//     if (typeof activeSessions !== 'undefined') {
//       var hasRunning = [...activeSessions.values()].some(function(s) { return s.status === 'running'; });
//       if (hasRunning) {
//         this.send('ext:agent-run-complete', { agentId: agentId, success: false, error: 'Another task is already running' });
//         return;
//       }
//     }
//
//     // Dispatch to background.js handler
//     if (typeof startAgentRunNow === 'function') {
//       startAgentRunNow(agentId);
//     } else {
//       this.send('ext:agent-run-complete', { agentId: agentId, success: false, error: 'Agent execution not available' });
//     }
//   }

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
      if (!tabId) {
        recordFSBTransportFailure('dom-forward-failed', {
          type: action,
          target: 'content-script',
          tabId: null,
          readyState: 'no-tab',
          error: 'No tab resolved for DOM forward'
        });
        return;
      }

      try {
        await chrome.tabs.sendMessage(tabId, { action: action, ...payload }, { frameId: 0 });
      } catch (sendErr) {
        recordFSBTransportFailure('dom-forward-failed', {
          type: action,
          target: 'content-script',
          tabId: tabId,
          readyState: 'sendMessage-rejected',
          error: sendErr && sendErr.message ? sendErr.message : 'DOM forward failed'
        });
        // Content script not injected yet -- inject it and retry once
        console.log('[FSB WS] Content script not ready on tab', tabId, '-- injecting and retrying', action);
        recordFSBTransportFailure('dom-forward-reinject', {
          type: action,
          target: 'content-script',
          tabId: tabId,
          readyState: 'reinjection-attempted',
          error: sendErr && sendErr.message ? sendErr.message : 'Content script not ready'
        });
        try {
          var scriptFiles = (typeof CONTENT_SCRIPT_FILES !== 'undefined')
            ? CONTENT_SCRIPT_FILES
            : ['utils/diagnostics-ring-buffer.js', 'utils/redactForLog.js', 'content/init.js', 'content/utils.js', 'content/dom-stream.js', 'content/messaging.js', 'content/lifecycle.js'];
          await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: false },
            files: scriptFiles
          });
          // Brief delay for script initialization
          await new Promise(function(r) { setTimeout(r, 300); });
          await chrome.tabs.sendMessage(tabId, { action: action, ...payload }, { frameId: 0 });
        } catch (injectErr) {
          console.warn('[FSB WS] Failed to inject content script on tab', tabId, ':', injectErr.message);
          recordFSBTransportFailure('dom-forward-failed', {
            type: action,
            target: 'content-script',
            tabId: tabId,
            readyState: 'inject-retry-failed',
            error: injectErr && injectErr.message ? injectErr.message : 'Content script reinjection failed'
          });
        }
      }
    } catch (e) {
      console.warn('[FSB WS] Failed to forward to content script:', action, e.message);
      recordFSBTransportFailure('dom-forward-failed', {
        type: action,
        target: 'content-script',
        tabId: getCurrentTransportTabId(),
        readyState: 'forward-exception',
        error: e && e.message ? e.message : 'Failed to forward to content script'
      });
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
