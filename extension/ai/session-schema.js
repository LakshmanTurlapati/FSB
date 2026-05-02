/**
 * Session Schema -- typed session factory and field-tier metadata.
 *
 * Every session field is declared upfront with a default value, a type
 * description, and a hot/warm tier annotation:
 *
 *   hot  -- transient; lost when the MV3 service worker is killed
 *           (Promises, setTimeout handles, class instances).
 *   warm -- persisted to chrome.storage.session after every state change.
 *
 * This module is the single source of truth for session shape.  No ad-hoc
 * property addition is allowed -- all fields exist from creation.
 *
 * Mirrors Claude Code's RuntimeSession pattern adapted for Chrome MV3.
 *
 * @module session-schema
 */

'use strict';

// ---------------------------------------------------------------------------
// Valid session status values
// ---------------------------------------------------------------------------

/**
 * All valid values for the session `status` field.
 * @type {string[]}
 */
var SESSION_STATUSES = [
  'idle',
  'running',
  'paused',
  'completed',
  'partial',
  'failed',
  'stopped',
  'error',
  'expired',
  'replaying',
  'replay_completed',
  'replay_failed'
];

// ---------------------------------------------------------------------------
// Field definitions -- { default, tier, type }
// ---------------------------------------------------------------------------

/**
 * Complete field registry for a session object.
 *
 * Each key maps to an object with:
 *   - default: the initial value for that field
 *   - tier:    'hot' (transient) or 'warm' (persisted)
 *   - type:    human-readable type description
 *
 * @type {Object.<string, {default: *, tier: string, type: string}>}
 */
var SESSION_FIELDS = {
  // --- Hot-tier fields (transient, lost on SW kill) -------------------------

  _nextIterationTimer: {
    default: null,
    tier: 'hot',
    type: 'number|null (setTimeout handle)'
  },
  _lastRetryIteration: {
    default: null,
    tier: 'hot',
    type: 'number|null'
  },
  providerConfig: {
    default: null,
    tier: 'hot',
    type: 'object|null (contains providerInstance which is a class)'
  },
  followUpContext: {
    default: null,
    tier: 'hot',
    type: 'object|null (consumed on first iteration)'
  },

  // --- Warm-tier fields (persisted to chrome.storage.session) ---------------

  sessionId: {
    default: '',
    tier: 'warm',
    type: 'string'
  },
  task: {
    default: '',
    tier: 'warm',
    type: 'string'
  },
  tabId: {
    default: null,
    tier: 'warm',
    type: 'number|null'
  },
  originalTabId: {
    default: null,
    tier: 'warm',
    type: 'number|null'
  },
  startUrl: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  status: {
    default: 'idle',
    tier: 'warm',
    type: 'string (idle|running|paused|completed|partial|failed|stopped|error|expired)'
  },
  startTime: {
    default: 0,
    tier: 'warm',
    type: 'number (Date.now())'
  },
  maxIterations: {
    default: 20,
    tier: 'warm',
    type: 'number'
  },
  actionHistory: {
    default: [],
    tier: 'warm',
    type: 'Array<ActionEvent>'
  },
  stateHistory: {
    default: [],
    tier: 'warm',
    type: 'Array'
  },
  failedAttempts: {
    default: {},
    tier: 'warm',
    type: 'object'
  },
  failedActionDetails: {
    default: {},
    tier: 'warm',
    type: 'object'
  },
  lastDOMHash: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  lastDOMSignals: {
    default: null,
    tier: 'warm',
    type: 'object|null'
  },
  stuckCounter: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  consecutiveNoProgressCount: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  iterationCount: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  lastIterationTime: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  urlHistory: {
    default: [],
    tier: 'warm',
    type: 'Array<string>'
  },
  lastUrl: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  actionSequences: {
    default: [],
    tier: 'warm',
    type: 'Array'
  },
  sequenceRepeatCount: {
    default: {},
    tier: 'warm',
    type: 'object'
  },
  allowedTabs: {
    default: [],
    tier: 'warm',
    type: 'Array<number>'
  },
  tabHistory: {
    default: [],
    tier: 'warm',
    type: 'Array'
  },
  navigationMessage: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  animatedActionHighlights: {
    default: true,
    tier: 'warm',
    type: 'boolean'
  },
  conversationId: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  selectedConversationId: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  uiSurface: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  historySessionId: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  lastTask: {
    default: '',
    tier: 'warm',
    type: 'string'
  },
  lastCommandAt: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  commandCount: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  commands: {
    default: [],
    tier: 'warm',
    type: 'Array<string>'
  },
  agentResumeState: {
    default: null,
    tier: 'warm',
    type: 'object|null'
  },
  resumeSummary: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  domSettings: {
    default: { domOptimization: true, maxDOMElements: 2000, prioritizeViewport: true },
    tier: 'warm',
    type: 'object'
  },
  totalCost: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  totalInputTokens: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  totalOutputTokens: {
    default: 0,
    tier: 'warm',
    type: 'number'
  },
  userLocale: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  agentState: {
    default: null,
    tier: 'warm',
    type: 'object|null'
  },
  messages: {
    default: null,
    tier: 'warm',
    type: 'Array|null'
  },
  tools: {
    default: null,
    tier: 'warm',
    type: 'Array|null'
  },
  safetyConfig: {
    default: { costLimit: 2.00, timeLimit: 600000 },
    tier: 'warm',
    type: 'object'
  },
  completionMessage: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  error: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  result: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  outcome: {
    default: null,
    tier: 'warm',
    type: 'string|null (success|partial|failure|stopped)'
  },
  outcomeDetails: {
    default: null,
    tier: 'warm',
    type: 'object|null'
  },
  isRestored: {
    default: false,
    tier: 'warm',
    type: 'boolean'
  },
  lastAiReasoning: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  currentTool: {
    default: null,
    tier: 'warm',
    type: 'string|null'
  },
  continuity: {
    default: null,
    tier: 'warm',
    type: 'object|null'
  },
  multiSite: {
    default: null,
    tier: 'warm',
    type: 'object|null'
  },
  mode: {
    default: 'autopilot',
    tier: 'warm',
    type: 'string (autopilot|mcp-manual|mcp-agent|dashboard-remote)'
  }
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new session object with all fields populated from defaults.
 *
 * Deep-clones arrays and objects to avoid shared references between sessions.
 * Applies optional overrides on top of defaults.
 *
 * @param {Object} [overrides={}] - Key/value pairs to override defaults.
 * @returns {Object} A fully-populated session object.
 */
function createSession(overrides) {
  var session = {};
  for (var key in SESSION_FIELDS) {
    var field = SESSION_FIELDS[key];
    var defaultVal = field.default;
    // Deep-clone arrays and objects to avoid shared references
    if (Array.isArray(defaultVal)) {
      session[key] = [];
    } else if (defaultVal !== null && typeof defaultVal === 'object') {
      session[key] = JSON.parse(JSON.stringify(defaultVal));
    } else {
      session[key] = defaultVal;
    }
  }
  if (overrides) {
    Object.assign(session, overrides);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Tier accessors
// ---------------------------------------------------------------------------

/** Maximum number of messages to persist (keeps storage within 1MB limit). */
var MAX_PERSISTED_MESSAGES = 20;

/**
 * Return a new object containing only warm-tier fields from the session.
 *
 * Used by the persistence layer to determine what to write to
 * chrome.storage.session.  Values are deep-cloned (JSON round-trip) to
 * avoid reference issues.  The `messages` array is trimmed to the last
 * {@link MAX_PERSISTED_MESSAGES} entries to stay within the 1MB storage
 * limit.
 *
 * @param {Object} session - The full session object.
 * @returns {Object} An object with only warm-tier fields, deep-cloned.
 */
function getWarmFields(session) {
  var warm = {};
  for (var key in SESSION_FIELDS) {
    if (SESSION_FIELDS[key].tier !== 'warm') continue;
    var val = session[key];
    if (val === undefined) continue;

    // Special handling: trim messages to last N entries
    if (key === 'messages' && Array.isArray(val) && val.length > MAX_PERSISTED_MESSAGES) {
      warm[key] = JSON.parse(JSON.stringify(val.slice(-MAX_PERSISTED_MESSAGES)));
    } else if (val !== null && typeof val === 'object') {
      warm[key] = JSON.parse(JSON.stringify(val));
    } else {
      warm[key] = val;
    }
  }
  return warm;
}

/**
 * Return an array of field names that are hot-tier (transient).
 *
 * These fields cannot be serialized and are lost on service worker kill.
 *
 * @returns {string[]} Hot-tier field names.
 */
function getHotFieldNames() {
  var names = [];
  for (var key in SESSION_FIELDS) {
    if (SESSION_FIELDS[key].tier === 'hot') {
      names.push(key);
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSession, SESSION_FIELDS, SESSION_STATUSES, getWarmFields, getHotFieldNames };
}
