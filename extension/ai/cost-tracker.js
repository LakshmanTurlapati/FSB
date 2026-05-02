/**
 * Cost Tracker -- model pricing, cost estimation, and per-session budget enforcement.
 *
 * Extracted from agent-loop.js (MODEL_PRICING, estimateCost) with a new
 * CostTracker class for cumulative cost tracking and budget checking.
 *
 * Mirrors Claude Code's cost_tracker.py pattern adapted for Chrome MV3.
 *
 * @module cost-tracker
 */

'use strict';

// ---------------------------------------------------------------------------
// Model pricing per 1M tokens (input / output)
// ---------------------------------------------------------------------------

/**
 * Pricing per 1M tokens (input / output) by model name.
 * Matches background.js analytics calculateCost pricing table.
 * @type {Object.<string, {input: number, output: number}>}
 */
var MODEL_PRICING = {
  // xAI Current models
  'grok-4-0709':                    { input: 3.00, output: 15.00 },
  'grok-4-1-fast-reasoning':        { input: 0.20, output: 0.50 },
  'grok-4-1-fast-non-reasoning':    { input: 0.20, output: 0.50 },
  'grok-4-fast-reasoning':          { input: 3.00, output: 15.00 },
  'grok-4-fast-non-reasoning':      { input: 3.00, output: 15.00 },
  'grok-code-fast-1':               { input: 0.20, output: 1.50 },
  'grok-3':                         { input: 5.00, output: 25.00 },
  'grok-3-mini':                    { input: 0.30, output: 0.50 },
  // xAI Legacy
  'grok-4-1-fast':                  { input: 0.20, output: 0.50 },
  'grok-4-1':                       { input: 3.00, output: 15.00 },
  'grok-4':                         { input: 3.00, output: 15.00 },
  'grok-4-fast':                    { input: 3.00, output: 15.00 },
  'grok-3-fast':                    { input: 0.50, output: 2.50 },
  'grok-3-mini-beta':               { input: 0.30, output: 0.50 },
  'grok-3-mini-fast-beta':          { input: 0.20, output: 0.50 },
  // OpenAI
  'gpt-4o':                         { input: 2.50, output: 10.00 },
  'gpt-4o-mini':                    { input: 0.15, output: 0.60 },
  'chatgpt-4o-latest':              { input: 2.50, output: 10.00 },
  'gpt-4-turbo':                    { input: 10.00, output: 30.00 },
  // Anthropic
  'claude-sonnet-4-5-20250514':     { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20250514':      { input: 1.00, output: 5.00 },
  'claude-opus-4-1-20250414':       { input: 15.00, output: 75.00 },
  // Gemini
  'gemini-2.5-flash':               { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite':          { input: 0.10, output: 0.40 },
  'gemini-2.5-pro':                 { input: 1.25, output: 10.00 },
  'gemini-2.0-flash':               { input: 0.00, output: 0.00 }
};

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

/**
 * Estimate cost for an API call based on token usage.
 * @param {string} model - Model name (e.g. 'grok-4-1-fast')
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {string} [provider] - Provider key (used for local free providers)
 * @returns {number} Estimated cost in USD
 */
function estimateCost(model, inputTokens, outputTokens, provider) {
  if ((provider || '').toLowerCase() === 'lmstudio') {
    return 0;
  }

  // Try exact match first, then prefix match for versioned model names
  var pricing = MODEL_PRICING[model];
  if (!pricing) {
    var modelLower = (model || '').toLowerCase();
    for (var key in MODEL_PRICING) {
      if (modelLower.startsWith(key) || modelLower.includes(key)) {
        pricing = MODEL_PRICING[key];
        break;
      }
    }
  }
  // Default to grok-4-1-fast pricing if model not found
  if (!pricing) {
    pricing = MODEL_PRICING['grok-4-1-fast-reasoning'] || { input: 0.20, output: 0.50 };
  }

  var inputCost = (inputTokens / 1000000) * pricing.input;
  var outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// CostTracker class
// ---------------------------------------------------------------------------

/**
 * Per-session cost accumulator with budget enforcement.
 *
 * Tracks cumulative cost across all API calls in a session and provides
 * a checkBudget() method to determine if the session has exceeded its
 * cost limit.
 *
 * Uses function/prototype pattern for importScripts compatibility.
 *
 * @param {number} [costLimit=2.00] - Maximum allowed session cost in USD.
 * @constructor
 */
function CostTracker(costLimit) {
  this.totalCost = 0;
  this.totalInputTokens = 0;
  this.totalOutputTokens = 0;
  this.callCount = 0;
  this.costLimit = costLimit || 2.00;
}

/**
 * Record an API call's token usage and accumulate cost.
 *
 * @param {string} model - Model name used for the call.
 * @param {number} inputTokens - Number of input tokens consumed.
 * @param {number} outputTokens - Number of output tokens produced.
 * @param {string} [provider] - Provider key used for the call.
 * @returns {number} Cost of this individual call in USD.
 */
CostTracker.prototype.record = function(model, inputTokens, outputTokens, provider) {
  var cost = estimateCost(model, inputTokens, outputTokens, provider);
  this.totalCost += cost;
  this.totalInputTokens += (inputTokens || 0);
  this.totalOutputTokens += (outputTokens || 0);
  this.callCount += 1;
  return cost;
};

/**
 * Check whether the session has exceeded its cost budget.
 *
 * @returns {{exceeded: boolean, totalCost: number, costLimit: number, reason: string|null}}
 */
CostTracker.prototype.checkBudget = function() {
  if (this.totalCost >= this.costLimit) {
    return {
      exceeded: true,
      totalCost: this.totalCost,
      costLimit: this.costLimit,
      reason: 'Session cost ($' + this.totalCost.toFixed(2) + ') exceeded limit ($' + this.costLimit.toFixed(2) + '). Stopping to prevent excess spending.'
    };
  }
  return { exceeded: false, totalCost: this.totalCost, costLimit: this.costLimit, reason: null };
};

/**
 * Serialize tracker state for persistence or logging.
 *
 * @returns {{totalCost: number, totalInputTokens: number, totalOutputTokens: number, callCount: number, costLimit: number}}
 */
CostTracker.prototype.toJSON = function() {
  return {
    totalCost: this.totalCost,
    totalInputTokens: this.totalInputTokens,
    totalOutputTokens: this.totalOutputTokens,
    callCount: this.callCount,
    costLimit: this.costLimit
  };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MODEL_PRICING: MODEL_PRICING, estimateCost: estimateCost, CostTracker: CostTracker };
}
