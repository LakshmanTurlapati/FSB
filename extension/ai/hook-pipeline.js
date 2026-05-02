/**
 * Hook Pipeline -- composable lifecycle hook infrastructure for the agent loop.
 *
 * Provides named lifecycle events that cross-cutting concerns (safety breakers,
 * permission gates, progress hooks) register on.  Phase 159's agent-loop
 * refactor replaces inline conditionals with hook emissions through this
 * pipeline.
 *
 * Separate from SessionStateEmitter (Phase 156).  Emitter broadcasts state
 * changes to UI consumers; HookPipeline intercepts lifecycle events for
 * pre/post processing.  Different concerns, different classes (D-02).
 *
 * Uses function/prototype pattern for importScripts compatibility.
 *
 * @module hook-pipeline
 */

'use strict';

// ---------------------------------------------------------------------------
// Lifecycle event constants (7 events per HOOK-01)
// ---------------------------------------------------------------------------

/**
 * All supported lifecycle event names.
 * Keys are SCREAMING_SNAKE for constant naming; values are camelCase strings
 * used as map keys internally.
 *
 * @type {Object.<string, string>}
 */
var LIFECYCLE_EVENTS = {
  BEFORE_ITERATION: 'beforeIteration',
  AFTER_API_RESPONSE: 'afterApiResponse',
  BEFORE_TOOL_EXECUTION: 'beforeToolExecution',
  AFTER_TOOL_EXECUTION: 'afterToolExecution',
  AFTER_ITERATION: 'afterIteration',
  ON_COMPLETION: 'onCompletion',
  ON_ERROR: 'onError'
};

/**
 * Set of valid event values for fast lookup during registration validation.
 * @type {Object.<string, boolean>}
 */
var _validEvents = {};
var _eventKeys = Object.keys(LIFECYCLE_EVENTS);
for (var _i = 0; _i < _eventKeys.length; _i++) {
  _validEvents[LIFECYCLE_EVENTS[_eventKeys[_i]]] = true;
}

// ---------------------------------------------------------------------------
// HookPipeline class
// ---------------------------------------------------------------------------

/**
 * Composable hook pipeline for agent loop lifecycle events.
 *
 * Handlers are stored in arrays (not Sets) to preserve registration order
 * (D-01).  Each handler runs in a try/catch so a buggy hook never breaks the
 * pipeline or other handlers (D-05).
 *
 * @class
 */
function HookPipeline() {
  /** @type {Object.<string, Array<Function>>} */
  this._hooks = {};
}

/**
 * Register a handler for a lifecycle event.
 *
 * @param {string} event - One of {@link LIFECYCLE_EVENTS} values.
 * @param {Function} handler - Callback receiving the event context object.
 *   May return a result object.  Return `{ shouldStop: true, reason: '...' }`
 *   to halt the pipeline (D-05).
 * @returns {Function} Unsubscribe function -- call to remove this handler.
 */
HookPipeline.prototype.register = function register(event, handler) {
  if (!_validEvents[event]) {
    console.warn('[hook-pipeline] invalid event "' + event + '", registration ignored');
    return function noop() {};
  }

  if (!this._hooks[event]) {
    this._hooks[event] = [];
  }
  this._hooks[event].push(handler);

  var self = this;
  return function unsubscribe() {
    self.unregister(event, handler);
  };
};

/**
 * Remove a specific handler for an event.
 *
 * Uses reference equality to find the handler.  If the array becomes empty
 * after removal the key is deleted.
 *
 * @param {string} event - The event name.
 * @param {Function} handler - The handler to remove.
 */
HookPipeline.prototype.unregister = function unregister(event, handler) {
  var arr = this._hooks[event];
  if (!arr) {
    return;
  }
  var idx = arr.indexOf(handler);
  if (idx !== -1) {
    arr.splice(idx, 1);
    if (arr.length === 0) {
      delete this._hooks[event];
    }
  }
};

/**
 * Emit a lifecycle event, running all registered handlers in order.
 *
 * Async to allow handlers that perform chrome.storage reads or other async
 * work.  Each handler is wrapped in try/catch -- errors are logged but do not
 * break the pipeline (D-05).
 *
 * Only handlers returning `{ shouldStop: true }` can halt the pipeline.  When
 * a handler signals stop, subsequent handlers do NOT execute.
 *
 * @param {string} event - One of {@link LIFECYCLE_EVENTS} values.
 * @param {Object} context - Event-specific context object.
 * @returns {Promise<{stopped: boolean, results: Array, stoppedBy: string|null}>}
 */
HookPipeline.prototype.emit = async function emit(event, context) {
  var handlers = this._hooks[event];
  if (!handlers || handlers.length === 0) {
    return { stopped: false, results: [], stoppedBy: null };
  }

  var results = [];
  var stopped = false;
  var stoppedBy = null;

  for (var i = 0; i < handlers.length; i++) {
    try {
      var result = await handlers[i](context);
      results.push(result);

      if (result && typeof result === 'object' && result.shouldStop === true) {
        stopped = true;
        stoppedBy = result.reason || null;
        break;
      }
    } catch (err) {
      console.warn('[hook-pipeline] handler error on ' + event + ':', err);
      // Error does not produce a result and does not stop the pipeline
    }
  }

  return { stopped: stopped, results: results, stoppedBy: stoppedBy };
};

/**
 * Remove all handlers for a specific event, or all handlers entirely.
 *
 * @param {string} [event] - If provided, remove handlers for this event only.
 *   If omitted, remove ALL handlers (cleanup for session end).
 */
HookPipeline.prototype.removeAll = function removeAll(event) {
  if (event) {
    delete this._hooks[event];
  } else {
    this._hooks = {};
  }
};

/**
 * Get the number of registered handlers.
 *
 * @param {string} [event] - If provided, count for this event only.
 *   If omitted, return total handler count across all events.
 * @returns {number}
 */
HookPipeline.prototype.getHandlerCount = function getHandlerCount(event) {
  if (event) {
    var arr = this._hooks[event];
    return arr ? arr.length : 0;
  }
  var total = 0;
  var keys = Object.keys(this._hooks);
  for (var i = 0; i < keys.length; i++) {
    total += this._hooks[keys[i]].length;
  }
  return total;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HookPipeline: HookPipeline, LIFECYCLE_EVENTS: LIFECYCLE_EVENTS };
}
