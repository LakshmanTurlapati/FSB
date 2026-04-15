/**
 * Turn Result -- structured factory for per-iteration metadata.
 *
 * Each agent iteration produces a TurnResult carrying prompt tokens,
 * output tokens, matched tools, stop reason, cost, and timing.  Replaces
 * the ad-hoc property reads from session/response objects with an
 * explicit data contract.
 *
 * Per D-05: factory function (not a class) since TurnResult is a data
 * structure, not a stateful object.
 *
 * Mirrors Claude Code's TurnResult pattern (matched_commands, matched_tools,
 * permission_denials, stop_reason) adapted for FSB's automation context.
 *
 * @module turn-result
 */

'use strict';

// ---------------------------------------------------------------------------
// Stop reason constants
// ---------------------------------------------------------------------------

/**
 * All valid stop reasons for a turn result.
 * @type {Object.<string, string>}
 */
var STOP_REASONS = {
  END_TURN: 'end_turn',
  TOOL_CALLS: 'tool_calls',
  PARTIAL: 'partial',
  SAFETY_STOP: 'safety_stop',
  USER_STOP: 'user_stop',
  ERROR: 'error',
  MAX_ITERATIONS: 'max_iterations',
  STUCK: 'stuck'
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a structured turn result object with defaults.
 *
 * @param {Object} [fields={}] - Override fields.
 * @param {string} [fields.sessionId] - The session identifier.
 * @param {number} [fields.iteration] - The iteration number.
 * @param {number} [fields.inputTokens] - Input tokens used.
 * @param {number} [fields.outputTokens] - Output tokens generated.
 * @param {number} [fields.cost] - Cost incurred for this turn.
 * @param {Array<string>} [fields.matchedTools] - Tool names called this turn.
 * @param {Array<{name: string, success: boolean, hadEffect: boolean}>} [fields.toolResults] - Per-tool outcomes.
 * @param {Array<{toolName: string, reason: string}>} [fields.permissionDenials] - Permission denials (Phase 157).
 * @param {string} [fields.stopReason] - One of STOP_REASONS values.
 * @param {string|null} [fields.completionMessage] - Final text if END_TURN.
 * @param {string|null} [fields.errorMessage] - Error text if ERROR.
 * @param {number} [fields.timestamp] - Timestamp for this turn.
 * @param {number} [fields.durationMs] - Duration of the API call in ms.
 * @returns {Object} A structured turn result.
 */
function createTurnResult(fields) {
  var f = fields || {};
  return {
    sessionId: f.sessionId || '',
    iteration: f.iteration || 0,
    inputTokens: f.inputTokens || 0,
    outputTokens: f.outputTokens || 0,
    cost: f.cost || 0,
    matchedTools: f.matchedTools || [],
    toolResults: f.toolResults || [],
    permissionDenials: f.permissionDenials || [],
    stopReason: f.stopReason || STOP_REASONS.TOOL_CALLS,
    completionMessage: f.completionMessage || null,
    errorMessage: f.errorMessage || null,
    timestamp: f.timestamp || Date.now(),
    durationMs: f.durationMs || 0
  };
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Return a one-line string summary of a turn result for logging.
 *
 * Format: "Turn {iteration}: {toolCount} tools, {input}+{output} tokens, ${cost}, {stopReason}"
 *
 * @param {Object} turnResult - A turn result object from createTurnResult.
 * @returns {string} A concise summary string.
 */
function summarizeTurnResult(turnResult) {
  var tr = turnResult || {};
  var toolCount = (tr.matchedTools || []).length;
  return 'Turn ' + (tr.iteration || 0) + ': ' +
    toolCount + ' tools, ' +
    (tr.inputTokens || 0) + '+' + (tr.outputTokens || 0) + ' tokens, $' +
    (tr.cost || 0).toFixed(4) + ', ' +
    (tr.stopReason || 'unknown');
}

/**
 * Accumulate aggregate stats from an array of turn results.
 *
 * Sums tokens and cost, deduplicates tool names, returns the final
 * stop reason from the last result.
 *
 * @param {Array<Object>} results - Array of turn result objects.
 * @returns {{ totalInputTokens: number, totalOutputTokens: number, totalCost: number, totalIterations: number, allMatchedTools: Array<string>, finalStopReason: string }}
 */
function accumulateTurnResults(results) {
  var totalInputTokens = 0;
  var totalOutputTokens = 0;
  var totalCost = 0;
  var toolSet = {};
  var finalStopReason = '';

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    totalInputTokens += r.inputTokens || 0;
    totalOutputTokens += r.outputTokens || 0;
    totalCost += r.cost || 0;
    finalStopReason = r.stopReason || finalStopReason;

    var tools = r.matchedTools || [];
    for (var j = 0; j < tools.length; j++) {
      toolSet[tools[j]] = true;
    }
  }

  return {
    totalInputTokens: totalInputTokens,
    totalOutputTokens: totalOutputTokens,
    totalCost: totalCost,
    totalIterations: results.length,
    allMatchedTools: Object.keys(toolSet),
    finalStopReason: finalStopReason
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createTurnResult: createTurnResult,
    STOP_REASONS: STOP_REASONS,
    summarizeTurnResult: summarizeTurnResult,
    accumulateTurnResults: accumulateTurnResults
  };
}
