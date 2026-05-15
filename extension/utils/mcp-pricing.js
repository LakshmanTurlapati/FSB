/**
 * MCP Pricing Module (JS service-worker mirror) -- canonical USD-per-MTok rates
 * + client default-model mapping + graceful-fallback cost resolver for the FSB
 * v0.9.69 telemetry pipeline.
 *
 * Phase 270 / v0.9.69 anonymous telemetry. This is the extension/service-worker
 * side mirror of `mcp/src/tools/pricing.ts`. Phase 271's MCPMetricsRecorder will
 * `require` this module from `extension/ws/mcp-tool-dispatcher.js` and call
 * `globalThis.fsbMcpPricing.estimateMcpCost(...)` inside the recorder's
 * `try/finally` hook.
 *
 * Source of truth: `extension/utils/mcp-pricing-data.json`, which MUST be kept
 * byte-exact in sync with `mcp/data/mcp-pricing-data.json`. The CI parity test
 * (`tests/mcp-pricing-data-parity.test.js`) fails the build on any divergence.
 *
 * Module surface (globalThis.fsbMcpPricing):
 *   - `estimateMcpCost(input)` -> McpPricingResult envelope. Synchronous. NEVER throws.
 *   - `PRICING_SOURCE_DATE` -- literal string '2026-05-14'.
 *   - `MCP_MODEL_PRICING` (getter) -- per-model rate table once data has loaded.
 *   - `MCP_CLIENT_DEFAULT_MODEL` (getter) -- per-client default-model mapping.
 *   - `_loadDataIfNeeded()` -- exposed for tests; not part of stable contract.
 *
 * Module surface (Node CommonJS for tests): same as above plus `_loadPricingData(data)`
 * test seam so the test harness can inject custom JSON for the unknown-path tests.
 *
 * Pattern: function/prototype on globalThis (mirrors extension/utils/install-identity.js
 * from Phase 269). NO `class`, NO ES module syntax -- importScripts-compatible in MV3 SW.
 *
 * Data load strategy:
 *   - Under MV3 SW (chrome.runtime.getURL available): fetch the bundled JSON at
 *     module-init time, cache on `_data`. The resolver is SYNCHRONOUS; if it is
 *     called before the fetch resolves (defensive only -- Phase 271 dispatches
 *     happen well after module-load), it returns the canonical UNKNOWN envelope.
 *   - Under Node (chrome undefined): synchronously `require('./mcp-pricing-data.json')`
 *     at module-init.
 *
 * NEVER throws. The whole resolver body is wrapped in try/catch with a fall-
 * through to the canonical UNKNOWN envelope. Object-property lookups use
 * `Object.prototype.hasOwnProperty.call` to prevent prototype-pollution access;
 * tokens are checked via `isFinite` + `typeof number` before arithmetic.
 *
 * @module extension/utils/mcp-pricing
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var PRICING_SOURCE_DATE = '2026-05-14';

// The canonical "unknown" envelope. Returned on null / undefined / non-object
// input, on prototype-polluted strings that don't match a registered key, on
// any caught exception, and on the explicit no-match path.
function _unknownEnvelope() {
  return {
    cost: null,
    source: 'unknown',
    model_used: null,
    pricing_confidence: null,
    pricing_source_date: PRICING_SOURCE_DATE
  };
}

// ---------------------------------------------------------------------------
// Data load shim
// ---------------------------------------------------------------------------

// Resolved JSON: { pricing_source_date, pricing_policy, model_pricing,
// client_default_model }. Populated synchronously under Node, asynchronously
// under MV3 SW. Until populated, the resolver returns UNKNOWN defensively.
var _data = null;

// In-flight fetch Promise. Resolves to `_data` once the fetch lands; null if
// the fetch failed. Reused by `_loadDataIfNeeded` so concurrent callers don't
// double-fetch. On MV3 SW fetch failure the promise is RESET to null inside
// the .catch so a later wake / retry can re-attempt the load rather than
// latching UNKNOWN for the rest of the SW session (mirrors install-identity's
// _pendingMintPromise reset pattern from Phase 269).
var _dataPromise = null;

// One-shot diagnostic flag for the MV3-SW fetch failure path. We surface
// exactly one `console.warn` per SW session if the bundled pricing JSON
// cannot be loaded, so operators investigating "all MCP telemetry rows are
// UNKNOWN" have a signal in the SW logs without log spam on every subsequent
// retry. Mirrors install-identity.js's _corruptWarningEmitted pattern.
var _loadWarningEmitted = false;

/**
 * Load the JSON pricing data if it has not been loaded yet.
 *
 * Under Node (test harness): synchronously `require`s the adjacent
 * `mcp-pricing-data.json` and populates `_data` immediately. Returns a
 * resolved Promise for shape parity with the SW path.
 *
 * Under MV3 SW: fires a one-shot `fetch(chrome.runtime.getURL(...))` that
 * resolves into `_data` when the bundled JSON arrives. Returns the Promise
 * so callers (mainly tests) can `await` first-load completion.
 *
 * On Node `require` failure: caches a resolved-null Promise so the resolver
 * returns UNKNOWN defensively (rather than throwing).
 *
 * On MV3 SW fetch / HTTP / parse failure: (a) emits exactly ONE
 * `console.warn` per SW session via the `_loadWarningEmitted` latch so
 * operators have a single diagnostic line in the SW logs instead of either
 * silent failure or per-call log spam, and (b) RESETS `_dataPromise` to null
 * so a subsequent caller can re-attempt the load. The previous behavior
 * resolved the promise to null permanently, which latched every subsequent
 * call to UNKNOWN for the lifetime of the SW session even on transient fetch
 * hiccups at cold-start.
 *
 * @returns {Promise<object|null>} The loaded JSON, or null on load failure.
 */
function _loadDataIfNeeded() {
  if (_data) return Promise.resolve(_data);
  if (_dataPromise) return _dataPromise;

  // Path A: Node + test harness (require works synchronously).
  if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    try {
      // eslint-disable-next-line global-require
      _data = require('./mcp-pricing-data.json');
      _dataPromise = Promise.resolve(_data);
      return _dataPromise;
    } catch (_e) {
      // can't load synchronously; resolver will return unknown
      _dataPromise = Promise.resolve(null);
      return _dataPromise;
    }
  }

  // Path B: MV3 SW -- fetch the bundled JSON.
  //
  // 1. Check r.ok BEFORE r.json() -- a 404 (e.g. typo in the bundled-resource
  //    path, or extension upgrade race where the file isn't yet available)
  //    would otherwise let r.json() try to parse an HTML error body and
  //    throw without diagnostic.
  // 2. .catch emits ONE warn per SW session via _loadWarningEmitted so the
  //    operator sees "why is everything UNKNOWN" without log spam.
  // 3. .catch RESETS _dataPromise to null so the next caller can retry the
  //    load. This is the production hook -- a transient fetch hiccup at SW
  //    cold start no longer permanently degrades the rest of the session.
  _dataPromise = fetch(chrome.runtime.getURL('utils/mcp-pricing-data.json'))
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) { _data = d; return d; })
    .catch(function (e) {
      if (!_loadWarningEmitted) {
        // Safe-guard `console` access: SW context has it, but we still guard
        // for any test harness that might stub the global.
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn(
            '[FSB MCP Pricing] Failed to load pricing data; cost estimation will return UNKNOWN:',
            e && e.message ? e.message : e
          );
        }
        _loadWarningEmitted = true;
      }
      _dataPromise = null;  // permit retry on next call
      return null;
    });
  return _dataPromise;
}

// Fire-and-forget load at module init so the resolver has data by the time
// Phase 271 dispatches arrive. Under Node this populates `_data` synchronously
// before any caller runs (because `require` is sync); under SW the resolver
// will defensively return UNKNOWN until the fetch resolves.
_loadDataIfNeeded();

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Estimate the USD cost of an MCP-driven LLM call.
 *
 * Four resolution paths (CONTEXT.md "Fallback policy"):
 *
 *   1. **lookup**: `model` is provided AND is a key in model_pricing ->
 *      compute cost from the row, source='lookup', model_used=model,
 *      pricing_confidence = row.confidence (HIGH/MEDIUM/LOW).
 *
 *   2. **fallback**: `model` missing/null/unknown BUT `client` is in
 *      client_default_model AND its default model is in model_pricing ->
 *      compute cost using the default model's rates, source='fallback',
 *      model_used=defaultModel, pricing_confidence='fallback' (literal
 *      sentinel string; distinct from the model's own HIGH/MEDIUM/LOW
 *      so the caller can tell at a glance that the model was assumed
 *      rather than reported).
 *
 *   3. **unknown**: neither path matches -> {cost: null, source: 'unknown',
 *      model_used: null, pricing_confidence: null, pricing_source_date: '2026-05-14'}.
 *
 *   4. **missing or invalid tokens** (modifier on any of the above): if
 *      tokensIn or tokensOut is null / undefined / NaN / Infinity /
 *      -Infinity / non-number / NEGATIVE number, set cost=null but
 *      preserve model_used + source + pricing_confidence as far as the
 *      lookup got. Telemetry rows with missing-or-invalid tokens are a
 *      legitimate "uncounted" reason; we still want the model/source
 *      attribution to flow through to the stats page. Negative tokens
 *      are treated as "uncounted" rather than producing a negative USD
 *      cost that would pollute downstream sum/avg telemetry aggregations.
 *
 * Security: the resolver NEVER throws. The whole body is wrapped in a
 * try/catch that falls through to UNKNOWN on any caught exception.
 * Object-property lookups use `Object.prototype.hasOwnProperty.call` to
 * prevent prototype-pollution access. Token values are checked via
 * `typeof number && isFinite` before arithmetic to prevent NaN propagation.
 *
 * `pricing_source_date='2026-05-14'` is attached to ALL FOUR return shapes.
 *
 * @param {object|null|undefined} input - {client?, model?, tokensIn?, tokensOut?}.
 * @returns {object} The McpPricingResult envelope. Shape is canonical on every input.
 */
function estimateMcpCost(input) {
  try {
    // If data hasn't loaded yet (defensive; SW startup race), return UNKNOWN.
    if (!_data) return _unknownEnvelope();
    if (!input || typeof input !== 'object') return _unknownEnvelope();

    var client = input.client;
    var model = input.model;
    var tokensIn = input.tokensIn;
    var tokensOut = input.tokensOut;

    // Resolve which model to bill against, and which path we are on.
    var modelKey = null;
    var source = 'unknown';
    var pricingConfidence = null;

    if (
      typeof model === 'string' &&
      model.length > 0 &&
      Object.prototype.hasOwnProperty.call(_data.model_pricing, model)
    ) {
      modelKey = model;
      source = 'lookup';
      pricingConfidence = _data.model_pricing[model].confidence;
    } else if (
      typeof client === 'string' &&
      client.length > 0 &&
      Object.prototype.hasOwnProperty.call(_data.client_default_model, client)
    ) {
      var defaultModel = _data.client_default_model[client].model;
      if (Object.prototype.hasOwnProperty.call(_data.model_pricing, defaultModel)) {
        modelKey = defaultModel;
        source = 'fallback';
        pricingConfidence = 'fallback';
      }
    }

    if (!modelKey) return _unknownEnvelope();

    // Compute cost only if BOTH tokens are finite NON-NEGATIVE numbers.
    // Strict typeof check rejects string-shaped tokens ('1000'),
    // null/undefined, NaN, Infinity, -Infinity, and non-numeric inputs
    // uniformly. The `>= 0` guard rejects negative integers -- a malformed
    // MCP envelope reporting negative token counts (or an integer-overflow
    // wraparound) would otherwise produce a negative USD cost that would
    // silently distort sum/avg aggregations on the showcase dashboard.
    // Zero remains legitimate (cost = 0 is a valid zero-tokens result).
    var tin = (typeof tokensIn === 'number' && isFinite(tokensIn) && tokensIn >= 0) ? tokensIn : null;
    var tout = (typeof tokensOut === 'number' && isFinite(tokensOut) && tokensOut >= 0) ? tokensOut : null;

    var cost = null;
    if (tin !== null && tout !== null) {
      var row = _data.model_pricing[modelKey];
      cost = (tin / 1000000) * row.input_per_mtok + (tout / 1000000) * row.output_per_mtok;
    }

    return {
      cost: cost,
      source: source,
      model_used: modelKey,
      pricing_confidence: pricingConfidence,
      pricing_source_date: PRICING_SOURCE_DATE
    };
  } catch (_e) {
    // Defensive: any unanticipated runtime error (prototype-polluted input,
    // exotic descriptor, etc.) falls through to the canonical UNKNOWN shape.
    return _unknownEnvelope();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// Service-worker / importScripts surface. Mirrors install-identity.js pattern
// (globalThis.fsbInstallIdentity). Getter properties on MCP_MODEL_PRICING and
// MCP_CLIENT_DEFAULT_MODEL so consumers always see the loaded values once data
// has populated (under SW, this can be after a microtask).
globalThis.fsbMcpPricing = {
  estimateMcpCost: estimateMcpCost,
  PRICING_SOURCE_DATE: PRICING_SOURCE_DATE,
  _loadDataIfNeeded: _loadDataIfNeeded
};
Object.defineProperty(globalThis.fsbMcpPricing, 'MCP_MODEL_PRICING', {
  get: function () { return _data ? _data.model_pricing : {}; },
  enumerable: true,
  configurable: false
});
Object.defineProperty(globalThis.fsbMcpPricing, 'MCP_CLIENT_DEFAULT_MODEL', {
  get: function () { return _data ? _data.client_default_model : {}; },
  enumerable: true,
  configurable: false
});

// Node CommonJS surface for the test harness at tests/mcp-pricing.test.js.
// Same surface as globalThis.fsbMcpPricing plus the _loadPricingData test seam.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estimateMcpCost: estimateMcpCost,
    PRICING_SOURCE_DATE: PRICING_SOURCE_DATE,
    _loadDataIfNeeded: _loadDataIfNeeded,
    // Test seam: inject custom JSON for the unknown-path tests. Also lets a
    // test reset the module-level _data to null to exercise the SW startup
    // race (resolver called before data has loaded).
    _loadPricingData: function (data) { _data = data; _dataPromise = data ? Promise.resolve(data) : null; }
  };
  Object.defineProperty(module.exports, 'MCP_MODEL_PRICING', {
    get: function () { return _data ? _data.model_pricing : {}; },
    enumerable: true,
    configurable: false
  });
  Object.defineProperty(module.exports, 'MCP_CLIENT_DEFAULT_MODEL', {
    get: function () { return _data ? _data.client_default_model : {}; },
    enumerable: true,
    configurable: false
  });
}
