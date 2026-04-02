/**
 * Transcript Store -- standalone conversation history management with
 * token-budget-aware compaction.
 *
 * Extracted from the 90-line compactHistory() function in agent-loop.js.
 * Instantiated per session (per D-03).  Preserves FSB's existing
 * compaction logic (per D-04): 80% budget trigger, keep recent 5 intact,
 * replace old tool_result content with one-liner summaries.
 *
 * Mirrors Claude Code's TranscriptStore pattern (append, compact, replay,
 * flush) adapted for FSB's multi-provider message formats (OpenAI,
 * Anthropic, Gemini).
 *
 * @module transcript-store
 */

'use strict';

// ---------------------------------------------------------------------------
// Token estimation -- char/4 heuristic (verbatim from agent-loop.js:224-250)
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a message array using char/4 heuristic.
 *
 * Handles OpenAI (string content, tool_calls), Anthropic (content arrays),
 * and Gemini (parts arrays) message formats.
 *
 * @param {Array<Object>} messages - Conversation messages.
 * @returns {number} Estimated token count.
 */
function estimateTokens(messages) {
  var chars = 0;
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (var j = 0; j < msg.content.length; j++) {
        chars += JSON.stringify(msg.content[j]).length;
      }
    } else if (msg.parts) {
      // Gemini format
      chars += JSON.stringify(msg.parts).length;
    }
    // Tool call messages (OpenAI format)
    if (msg.tool_calls) {
      chars += JSON.stringify(msg.tool_calls).length;
    }
  }
  return Math.ceil(chars / 4);
}

// ---------------------------------------------------------------------------
// TranscriptStore class
// ---------------------------------------------------------------------------

/**
 * Conversation history manager with token-budget-aware compaction.
 *
 * One instance per session.  Holds the messages array and provides
 * append, compact, replay, flush, getStats, and hydrate methods.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {number} [options.tokenBudget=128000] - Max token budget.
 * @param {number} [options.compactThreshold=0.8] - Fraction of budget that triggers compaction.
 * @param {number} [options.keepRecentCount=5] - Number of recent tool_result messages to keep intact.
 * @constructor
 */
function TranscriptStore(options) {
  var opts = options || {};
  /** @type {Array<Object>} */
  this.messages = [];
  /** @type {number} */
  this.tokenBudget = opts.tokenBudget || 128000;
  /** @type {number} */
  this.compactThreshold = opts.compactThreshold || 0.8;
  /** @type {number} */
  this.keepRecentCount = opts.keepRecentCount || 5;
  /** @type {number} */
  this._compactionCount = 0;
  /** @type {number} */
  this._totalTokensSaved = 0;
}

/**
 * Append a message object to the conversation history.
 *
 * @param {Object} message - A message object (any provider format).
 * @returns {TranscriptStore} This instance (for chaining).
 */
TranscriptStore.prototype.append = function append(message) {
  this.messages.push(message);
  return this;
};

/**
 * Compact old tool_result messages when history exceeds the token budget
 * threshold.
 *
 * Preserves FSB's battle-tested compaction logic from compactHistory():
 *   1. Estimate current token usage.
 *   2. If below threshold, return early.
 *   3. Find all tool_result message indices across providers.
 *   4. Keep the most recent keepRecentCount intact.
 *   5. Replace each compactable tool_result with a one-liner summary.
 *
 * Handles OpenAI (role=tool), Anthropic (content array with type=tool_result),
 * and Gemini (parts with functionResponse) formats.
 *
 * @returns {{ compacted: boolean, removedCount: number, estimatedTokens: number }}
 */
TranscriptStore.prototype.compact = function compact() {
  var threshold = this.tokenBudget * this.compactThreshold;
  var currentTokens = estimateTokens(this.messages);

  if (currentTokens <= threshold) {
    return { compacted: false, removedCount: 0, estimatedTokens: currentTokens };
  }

  // Find all tool_result messages (OpenAI, Anthropic, Gemini)
  var toolResultIndices = [];
  for (var i = 0; i < this.messages.length; i++) {
    var msg = this.messages[i];
    if (msg.role === 'tool') {
      toolResultIndices.push(i);
    } else if (Array.isArray(msg.content) && msg.content.some(function (b) { return b.type === 'tool_result'; })) {
      toolResultIndices.push(i);
    } else if (msg.role === 'user' && msg.parts && msg.parts.some(function (p) { return p.functionResponse; })) {
      toolResultIndices.push(i);
    }
  }

  // Keep the most recent keepRecentCount tool_result messages intact
  var keepCount = this.keepRecentCount;
  var compactableIndices = toolResultIndices.length > keepCount
    ? toolResultIndices.slice(0, -keepCount)
    : [];

  if (compactableIndices.length === 0) {
    return { compacted: false, removedCount: 0, estimatedTokens: currentTokens };
  }

  // Compact each old tool_result to a one-liner summary
  var removedCount = 0;
  for (var ci = 0; ci < compactableIndices.length; ci++) {
    var idx = compactableIndices[ci];
    var compactMsg = this.messages[idx];
    var toolName = 'unknown_tool';
    var status = 'completed';

    // Extract tool name and status from various formats
    if (compactMsg.role === 'tool') {
      toolName = compactMsg.name || 'unknown_tool';
      try {
        var parsed = typeof compactMsg.content === 'string' ? JSON.parse(compactMsg.content) : compactMsg.content;
        status = parsed && parsed.success === false ? 'error' : 'success';
      } catch (_) { /* keep default */ }
    } else if (Array.isArray(compactMsg.content)) {
      var resultBlock = null;
      for (var rb = 0; rb < compactMsg.content.length; rb++) {
        if (compactMsg.content[rb].type === 'tool_result') {
          resultBlock = compactMsg.content[rb];
          break;
        }
      }
      if (resultBlock) {
        toolName = resultBlock.name || 'unknown_tool';
        try {
          var parsedResult = typeof resultBlock.content === 'string' ? JSON.parse(resultBlock.content) : resultBlock.content;
          status = parsedResult && parsedResult.success === false ? 'error' : 'success';
        } catch (_) { /* keep default */ }
      }
    } else if (compactMsg.parts) {
      var frPart = null;
      for (var fp = 0; fp < compactMsg.parts.length; fp++) {
        if (compactMsg.parts[fp].functionResponse) {
          frPart = compactMsg.parts[fp];
          break;
        }
      }
      if (frPart) {
        toolName = frPart.functionResponse.name || 'unknown_tool';
        var resp = frPart.functionResponse.response;
        status = resp && resp.success === false ? 'error' : 'success';
      }
    }

    // Replace with compact summary
    var summary = toolName + ' returned ' + status;
    if (compactMsg.role === 'tool') {
      compactMsg.content = summary;
    } else if (Array.isArray(compactMsg.content)) {
      var toolUseId = (compactMsg.content[0] && compactMsg.content[0].tool_use_id) || '';
      compactMsg.content = [{ type: 'tool_result', tool_use_id: toolUseId, content: summary }];
    } else if (compactMsg.parts) {
      var frPartCompact = null;
      for (var fpc = 0; fpc < compactMsg.parts.length; fpc++) {
        if (compactMsg.parts[fpc].functionResponse) {
          frPartCompact = compactMsg.parts[fpc];
          break;
        }
      }
      if (frPartCompact) {
        frPartCompact.functionResponse.response = { result: summary };
      }
    }
    removedCount++;
  }

  var newTokens = estimateTokens(this.messages);
  this._compactionCount++;
  this._totalTokensSaved += (currentTokens - newTokens);

  return { compacted: true, removedCount: removedCount, estimatedTokens: newTokens };
};

/**
 * Return a shallow copy of the messages array for read-only access.
 *
 * @returns {Array<Object>} A new array containing all messages.
 */
TranscriptStore.prototype.replay = function replay() {
  return this.messages.slice();
};

/**
 * Clear the messages array and return the flushed messages.
 *
 * The returned array can be archived to chrome.storage.local (per D-09).
 *
 * @returns {Array<Object>} The messages that were flushed.
 */
TranscriptStore.prototype.flush = function flush() {
  var old = this.messages;
  this.messages = [];
  return old;
};

/**
 * Return statistics about the current transcript state.
 *
 * @returns {{ messageCount: number, estimatedTokens: number, compactionCount: number, totalTokensSaved: number }}
 */
TranscriptStore.prototype.getStats = function getStats() {
  return {
    messageCount: this.messages.length,
    estimatedTokens: estimateTokens(this.messages),
    compactionCount: this._compactionCount,
    totalTokensSaved: this._totalTokensSaved
  };
};

/**
 * Replace the internal messages array with a provided array.
 *
 * Used when restoring a session from storage.  Validates that the
 * argument is an array.
 *
 * @param {Array<Object>} messages - The messages to hydrate with.
 */
TranscriptStore.prototype.hydrate = function hydrate(messages) {
  if (!Array.isArray(messages)) {
    throw new TypeError('hydrate() expects an array, got ' + typeof messages);
  }
  this.messages = messages;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranscriptStore: TranscriptStore, estimateTokens: estimateTokens };
}
