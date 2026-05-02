/**
 * State Event Emitter -- pub/sub event system for session state transitions.
 *
 * Lives in the background service worker.  Translates internal state events
 * to chrome.runtime messages automatically so that popup and sidepanel
 * operator surfaces receive delta updates without polling. Dashboard state
 * uses separate status and relay channels.
 *
 * Per D-06: single emitter replaces scattered sendStatus calls.
 * Per D-07: events carry only what changed (delta), not the full session.
 *
 * Mirrors Claude Code's event broadcasting adapted for Chrome MV3.
 *
 * @module state-emitter
 */

'use strict';

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

/**
 * All supported state event types.
 * @type {Object.<string, string>}
 */
var STATE_EVENTS = {
  STATUS_CHANGED: 'status_changed',
  ITERATION_COMPLETE: 'iteration_complete',
  COST_UPDATED: 'cost_updated',
  TOOL_EXECUTED: 'tool_executed',
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  ERROR_OCCURRED: 'error_occurred'
};

// ---------------------------------------------------------------------------
// SessionStateEmitter class
// ---------------------------------------------------------------------------

/**
 * Event emitter for session state transitions.
 *
 * Supports register/emit/unregister lifecycle.  Every emit() also broadcasts
 * the event via chrome.runtime.sendMessage (fire-and-forget) so that UI
 * surfaces (sidepanel, popup, dashboard) receive updates.
 *
 * @class
 */
function SessionStateEmitter() {
  /** @type {Object.<string, Set<Function>>} */
  this._handlers = {};
}

/**
 * Register a handler for an event type.
 *
 * @param {string} eventType - One of {@link STATE_EVENTS} values.
 * @param {Function} handler - Callback receiving the event data object.
 * @returns {Function} Unsubscribe function -- call to remove this handler.
 */
SessionStateEmitter.prototype.on = function on(eventType, handler) {
  if (!this._handlers[eventType]) {
    this._handlers[eventType] = new Set();
  }
  this._handlers[eventType].add(handler);

  var self = this;
  return function unsubscribe() {
    self.off(eventType, handler);
  };
};

/**
 * Remove a specific handler for an event type.
 *
 * @param {string} eventType - The event type.
 * @param {Function} handler - The handler to remove.
 */
SessionStateEmitter.prototype.off = function off(eventType, handler) {
  var set = this._handlers[eventType];
  if (set) {
    set.delete(handler);
    if (set.size === 0) {
      delete this._handlers[eventType];
    }
  }
};

/**
 * Emit an event to all registered handlers and broadcast via chrome.runtime.
 *
 * Handlers are called synchronously.  The chrome.runtime.sendMessage call is
 * fire-and-forget (wrapped in try/catch) and guarded for non-Chrome
 * environments (Node.js testing). Direct runtime consumers are popup and
 * sidepanel message handlers; dashboard runtime state uses other channels.
 *
 * @param {string} eventType - One of {@link STATE_EVENTS} values.
 * @param {Object} data - Delta data for the event (what changed).
 */
SessionStateEmitter.prototype.emit = function emit(eventType, data) {
  // Call registered handlers
  var set = this._handlers[eventType];
  if (set) {
    set.forEach(function (handler) {
      try {
        handler(data);
      } catch (err) {
        // Handler errors must not break the emitter
        if (typeof console !== 'undefined' && console.error) {
          console.error('[state-emitter] handler error for ' + eventType + ':', err);
        }
      }
    });
  }

  // Broadcast via chrome.runtime.sendMessage (fire-and-forget)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      var payload = { action: 'sessionStateEvent', eventType: eventType };
      if (data && typeof data === 'object') {
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
          payload[keys[i]] = data[keys[i]];
        }
      }
      chrome.runtime.sendMessage(payload).catch(function () {
        // Swallow -- no listeners is a normal state (popup/sidepanel closed)
      });
    } catch (_ignored) {
      // chrome.runtime may throw if extension context is invalidated
    }
  }
};

/**
 * Remove all handlers for a specific event type, or all handlers entirely.
 *
 * @param {string} [eventType] - If provided, remove handlers for this type
 *   only.  If omitted, remove ALL handlers (cleanup for session end).
 */
SessionStateEmitter.prototype.removeAllListeners = function removeAllListeners(eventType) {
  if (eventType) {
    delete this._handlers[eventType];
  } else {
    this._handlers = {};
  }
};

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Emit a STATUS_CHANGED event with standardized payload.
 *
 * Replaces the scattered sendStatus calls throughout background.js and
 * agent-loop.js.
 *
 * @param {SessionStateEmitter} emitter - The emitter instance.
 * @param {string} sessionId - The session identifier.
 * @param {string} oldStatus - Previous status value.
 * @param {string} newStatus - New status value.
 * @param {Object} [extras={}] - Additional delta fields to include.
 */
function emitStatusChange(emitter, sessionId, oldStatus, newStatus, extras) {
  var data = {
    sessionId: sessionId,
    oldStatus: oldStatus,
    newStatus: newStatus,
    timestamp: Date.now()
  };
  if (extras && typeof extras === 'object') {
    var keys = Object.keys(extras);
    for (var i = 0; i < keys.length; i++) {
      data[keys[i]] = extras[keys[i]];
    }
  }
  emitter.emit(STATE_EVENTS.STATUS_CHANGED, data);
}

/**
 * Emit an ITERATION_COMPLETE event with standardized payload.
 *
 * Provides a convenient wrapper for iteration completion reporting.
 *
 * @param {SessionStateEmitter} emitter - The emitter instance.
 * @param {string} sessionId - The session identifier.
 * @param {number} iteration - The iteration number that completed.
 * @param {number} cost - Cost incurred in this iteration.
 * @param {number} inputTokens - Input tokens used in this iteration.
 * @param {number} outputTokens - Output tokens used in this iteration.
 */
function emitIterationComplete(emitter, sessionId, iteration, cost, inputTokens, outputTokens) {
  emitter.emit(STATE_EVENTS.ITERATION_COMPLETE, {
    sessionId: sessionId,
    iteration: iteration,
    cost: cost,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    timestamp: Date.now()
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SessionStateEmitter, STATE_EVENTS, emitStatusChange, emitIterationComplete };
}
