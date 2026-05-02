/**
 * Safety hook handlers for the agent loop lifecycle pipeline.
 *
 * Thin wrappers around checkSafetyBreakers and detectStuck (agent-loop.js).
 * The original functions remain independently callable -- these factories
 * receive them via closure (D-03) and adapt their return values for the
 * HookPipeline protocol.
 *
 * Registered on LIFECYCLE_EVENTS.AFTER_ITERATION by Phase 159.
 *
 * @module hooks/safety-hooks
 */

'use strict';

// ---------------------------------------------------------------------------
// createSafetyBreakerHook factory
// ---------------------------------------------------------------------------

/**
 * Create a safety breaker hook handler for the HookPipeline.
 *
 * Wraps checkSafetyBreakers(session) and translates its result into the
 * pipeline return shape.  When shouldStop is true the pipeline halts and
 * the agent loop terminates the session.
 *
 * @param {Function} checkSafetyBreakersFn - The checkSafetyBreakers function
 *   from agent-loop.js.  Signature: (session) => { shouldStop, reason }.
 * @returns {Function} Handler suitable for pipeline.register(AFTER_ITERATION, handler).
 */
function createSafetyBreakerHook(checkSafetyBreakersFn) {
  /**
   * @param {Object} context - Pipeline event context.
   * @param {Object} context.session - The current session object.
   * @returns {{ shouldStop: boolean, reason?: string, source?: string }}
   */
  function safetyBreakerHandler(context) {
    try {
      var result = checkSafetyBreakersFn(context.session);
      if (result && result.shouldStop) {
        return { shouldStop: true, reason: result.reason, source: 'safetyBreaker' };
      }
      return { shouldStop: false };
    } catch (err) {
      console.warn('[safety-hooks] safetyBreakerHandler error:', err);
      return { shouldStop: false };
    }
  }

  return safetyBreakerHandler;
}

// ---------------------------------------------------------------------------
// createStuckDetectionHook factory
// ---------------------------------------------------------------------------

/**
 * Create a stuck detection hook handler for the HookPipeline.
 *
 * Wraps detectStuck(session, toolResults) and translates its result into
 * the pipeline return shape.  When shouldForceStop is true, the pipeline
 * halts and the agent loop terminates the session (same as safety breakers).
 * Otherwise it provides a hint injected into the next prompt.
 *
 * @param {Function} detectStuckFn - The detectStuck function from
 *   agent-loop.js.  Signature: (session, toolResults) => { isStuck, shouldForceStop, hint }.
 * @returns {Function} Handler suitable for pipeline.register(AFTER_ITERATION, handler).
 */
function createStuckDetectionHook(detectStuckFn) {
  /**
   * @param {Object} context - Pipeline event context.
   * @param {Object} context.session - The current session object.
   * @param {Array} context.toolResults - Tool results from this iteration.
   * @returns {{ shouldStop: boolean, isStuck: boolean, hint?: string, source?: string }}
   */
  function stuckDetectionHandler(context) {
    try {
      var result = detectStuckFn(context.session, context.toolResults);
      if (result && result.isStuck) {
        // Force-stop when stuck detection escalates past threshold
        if (result.shouldForceStop) {
          return { shouldStop: true, isStuck: true, hint: result.hint, reason: result.hint, source: 'stuckDetection' };
        }
        return { shouldStop: false, isStuck: true, hint: result.hint, source: 'stuckDetection' };
      }
      return { shouldStop: false, isStuck: false };
    } catch (err) {
      console.warn('[safety-hooks] stuckDetectionHandler error:', err);
      return { shouldStop: false, isStuck: false };
    }
  }

  return stuckDetectionHandler;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSafetyBreakerHook: createSafetyBreakerHook, createStuckDetectionHook: createStuckDetectionHook };
}
