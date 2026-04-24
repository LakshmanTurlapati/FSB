(function(global) {
  'use strict';

  var MCP_VISUAL_CLIENT_LABELS = [
    'Claude',
    'Codex',
    'ChatGPT',
    'Perplexity',
    'Windsurf',
    'Cursor',
    'Antigravity',
    'OpenCode',
    'OpenClaw',
    'Grok',
    'Gemini'
  ];

  var CLIENT_LABEL_MAP = Object.create(null);
  MCP_VISUAL_CLIENT_LABELS.forEach(function(label) {
    CLIENT_LABEL_MAP[toClientLabelKey(label)] = label;
  });

  var MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS = 3200;

  function toClientLabelKey(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  function normalizeMcpVisualClientLabel(raw) {
    var key = toClientLabelKey(raw);
    return key ? (CLIENT_LABEL_MAP[key] || null) : null;
  }

  function isAllowedMcpVisualClientLabel(raw) {
    return !!normalizeMcpVisualClientLabel(raw);
  }

  function getAllowedMcpVisualClientLabels() {
    return MCP_VISUAL_CLIENT_LABELS.slice();
  }

  function createMcpVisualSessionToken() {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'mcpv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function normalizeText(value, fallback) {
    var text = String(value == null ? '' : value).trim();
    return text || (fallback || '');
  }

  function McpVisualSessionManager() {
    this._sessionsByToken = new Map();
    this._tokenByTabId = new Map();
  }

  McpVisualSessionManager.prototype.startSession = function(input) {
    var canonicalClientLabel = normalizeMcpVisualClientLabel(input && input.clientLabel);
    if (!canonicalClientLabel) {
      return { errorCode: 'invalid_client_label' };
    }

    var tabId = Number(input && input.tabId);
    if (!Number.isFinite(tabId) || tabId <= 0) {
      return { errorCode: 'no_active_tab' };
    }

    var task = normalizeText(input && input.task, 'FSB Automating');
    var detail = normalizeText(input && input.detail, '');
    var now = Number.isFinite(input && input.now) ? input.now : Date.now();
    var existingToken = this._tokenByTabId.get(tabId) || null;
    var replacedSession = existingToken ? (this._sessionsByToken.get(existingToken) || null) : null;

    if (existingToken) {
      this._sessionsByToken.delete(existingToken);
    }

    var sessionToken = normalizeText(input && input.sessionToken, createMcpVisualSessionToken());
    var session = {
      sessionToken: sessionToken,
      clientLabel: canonicalClientLabel,
      tabId: tabId,
      task: task,
      detail: detail,
      version: 1,
      createdAt: now,
      lastUpdateAt: now
    };

    this._sessionsByToken.set(sessionToken, session);
    this._tokenByTabId.set(tabId, sessionToken);

    return {
      session: cloneSession(session),
      replacedSession: cloneSession(replacedSession)
    };
  };

  McpVisualSessionManager.prototype.getSession = function(sessionToken) {
    return cloneSession(this._sessionsByToken.get(normalizeText(sessionToken, '')) || null);
  };

  McpVisualSessionManager.prototype.getTokenForTab = function(tabId) {
    return this._tokenByTabId.get(Number(tabId)) || null;
  };

  McpVisualSessionManager.prototype.updateSession = function(sessionToken, patch) {
    var token = normalizeText(sessionToken, '');
    var session = this._sessionsByToken.get(token);
    if (!session) return null;

    var nextPatch = patch || {};
    session.version = Number.isFinite(nextPatch.version) ? nextPatch.version : (session.version + 1);
    session.lastUpdateAt = Number.isFinite(nextPatch.lastUpdateAt) ? nextPatch.lastUpdateAt : Date.now();

    if (nextPatch.task !== undefined) {
      session.task = normalizeText(nextPatch.task, session.task || 'FSB Automating');
    }
    if (nextPatch.detail !== undefined) {
      session.detail = normalizeText(nextPatch.detail, '');
    }
    if (Number.isFinite(nextPatch.tabId) && nextPatch.tabId > 0 && nextPatch.tabId !== session.tabId) {
      this._tokenByTabId.delete(session.tabId);
      session.tabId = Number(nextPatch.tabId);
      this._tokenByTabId.set(session.tabId, token);
    }

    return cloneSession(session);
  };

  McpVisualSessionManager.prototype.endSession = function(sessionToken, options) {
    var token = normalizeText(sessionToken, '');
    var session = this._sessionsByToken.get(token);
    if (!session) return null;

    var opts = options || {};
    var clearedSession = {
      sessionToken: session.sessionToken,
      clientLabel: session.clientLabel,
      tabId: session.tabId,
      task: session.task,
      detail: session.detail,
      version: Number.isFinite(opts.version) ? opts.version : (session.version + 1),
      createdAt: session.createdAt,
      lastUpdateAt: Number.isFinite(opts.lastUpdateAt) ? opts.lastUpdateAt : Date.now(),
      reason: normalizeText(opts.reason, 'ended')
    };

    this._sessionsByToken.delete(token);
    if (this._tokenByTabId.get(session.tabId) === token) {
      this._tokenByTabId.delete(session.tabId);
    }

    return clearedSession;
  };

  function cloneSession(session) {
    return session ? {
      sessionToken: session.sessionToken,
      clientLabel: session.clientLabel,
      tabId: session.tabId,
      task: session.task,
      detail: session.detail,
      version: session.version,
      createdAt: session.createdAt,
      lastUpdateAt: session.lastUpdateAt,
      ...(session.reason ? { reason: session.reason } : {})
    } : null;
  }

  function buildMcpVisualSessionStatus(session, overrides) {
    if (!session) return null;
    var opts = overrides || {};
    var status = {
      sessionToken: session.sessionToken,
      version: Number.isFinite(opts.version) ? opts.version : session.version,
      clientLabel: session.clientLabel,
      phase: normalizeText(opts.phase, 'planning'),
      lifecycle: normalizeText(opts.lifecycle, 'running'),
      taskName: normalizeText(opts.taskName, session.task || 'FSB Automating'),
      statusText: normalizeText(
        opts.statusText,
        opts.detail !== undefined ? opts.detail : (session.detail || 'Working')
      ),
      taskSummary: normalizeText(opts.taskSummary, ''),
      animatedHighlights: opts.animatedHighlights !== false
    };

    if (opts.result) status.result = opts.result;
    if (opts.reason) status.reason = normalizeText(opts.reason, '');
    if (opts.display && typeof opts.display === 'object') status.display = opts.display;
    if (opts.progress && typeof opts.progress === 'object') status.progress = opts.progress;
    if (Number.isFinite(opts.progressPercent)) status.progressPercent = opts.progressPercent;

    return status;
  }

  function buildMcpVisualSessionClearStatus(session, overrides) {
    if (!session) return null;
    var opts = overrides || {};
    return {
      sessionToken: session.sessionToken,
      version: Number.isFinite(opts.version) ? opts.version : session.version,
      clientLabel: session.clientLabel,
      phase: 'ended',
      reason: normalizeText(opts.reason, session.reason || 'ended')
    };
  }

  var exportsObj = {
    MCP_VISUAL_CLIENT_LABELS: MCP_VISUAL_CLIENT_LABELS,
    MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS: MCP_VISUAL_SESSION_FINAL_CLEAR_DELAY_MS,
    McpVisualSessionManager: McpVisualSessionManager,
    createMcpVisualSessionToken: createMcpVisualSessionToken,
    normalizeMcpVisualClientLabel: normalizeMcpVisualClientLabel,
    isAllowedMcpVisualClientLabel: isAllowedMcpVisualClientLabel,
    getAllowedMcpVisualClientLabels: getAllowedMcpVisualClientLabels,
    buildMcpVisualSessionStatus: buildMcpVisualSessionStatus,
    buildMcpVisualSessionClearStatus: buildMcpVisualSessionClearStatus
  };

  global.MCPVisualSessionUtils = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
