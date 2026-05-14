/**
 * MCP Pricing Module -- canonical USD-per-MTok rates + client default-model mapping
 * + graceful-fallback cost resolver for the FSB v0.9.69 telemetry pipeline.
 *
 * Phase 270 / v0.9.69 anonymous telemetry. Loaded by Phase 271's MCPMetricsRecorder
 * on the extension service-worker side via the JS mirror at
 * `extension/utils/mcp-pricing.js`. The TS module here is kept in lockstep with the
 * JS mirror so the MCP server can surface costs in error messages or analytics tools
 * server-side without a second source of truth.
 *
 * Source of truth: `mcp/data/mcp-pricing-data.json` (verbatim May 2026 rates from
 * STACK.md sections 1a-1e + section 2). A byte-exact copy ships at
 * `extension/utils/mcp-pricing-data.json` for the extension bundle; the CI parity
 * test (`tests/mcp-pricing-data-parity.test.js`) fails the build on any divergence.
 *
 * Module surface (named exports):
 *   - `PRICING_SOURCE_DATE`: literal-typed '2026-05-14' constant.
 *   - `MCP_MODEL_PRICING`: per-model {input_per_mtok, output_per_mtok, confidence,
 *      source_url, source_date, notes?} records.
 *   - `MCP_CLIENT_DEFAULT_MODEL`: per-client {model, confidence, source_url, notes?}.
 *   - `estimateMcpCost(input)`: synchronous resolver returning the McpPricingResult
 *      envelope. NEVER throws.
 *   - `type McpPricingResult`: the result envelope shape.
 *
 * NEVER throws -- callers can rely on the canonical envelope shape on every input,
 * including null / undefined / chaos inputs. Module-load time validates that every
 * client default-model reference resolves to a real model row; that startup check
 * is the ONLY throw path and it only fires if `mcp-pricing-data.json` ships in a
 * broken state.
 *
 * Refresh policy: STACK.md sections 1-2 must be re-verified on every milestone bump.
 * Specific 2026-05-14 watchlist: DeepSeek V4-Pro promo expires 2026-05-31; Grok 4
 * retires 2026-05-15; Gemini 3.1 Pro rates are assumed-parity with 2.5 Pro pending
 * the official Gemini 3.x table.
 *
 * @module mcp/src/tools/pricing
 */

import pricingData from '../../data/mcp-pricing-data.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result envelope returned by `estimateMcpCost`. Shape is canonical -- the
 * resolver returns this exact set of keys on EVERY input (lookup / fallback /
 * unknown / missing-tokens / chaos inputs / null / undefined).
 *
 * - `cost`: USD cost computed from the resolved model's rates, or `null` when
 *   either the model could not be resolved OR token counts were missing /
 *   non-finite (legitimate "uncounted" reason on the stats page).
 * - `source`: which lookup path resolved the model.
 *   - `'lookup'`: caller-provided model was a known key in MCP_MODEL_PRICING.
 *   - `'fallback'`: model was missing/unknown but client was on the allowlist,
 *     so we used MCP_CLIENT_DEFAULT_MODEL[client].model.
 *   - `'unknown'`: neither model nor client resolved.
 * - `model_used`: the actual model key whose rates were consulted (or null
 *   on the unknown path).
 * - `pricing_confidence`: the confidence stamp of the resolved row. For
 *   `lookup` results this is the model's own HIGH/MEDIUM/LOW; for `fallback`
 *   it is the literal sentinel `'fallback'` (distinct from the row's own
 *   confidence so consumers can tell at-a-glance that the model was assumed
 *   rather than reported). For `unknown` it is `null`.
 * - `pricing_source_date`: the freshness stamp of the rate table; literal
 *   `'2026-05-14'` for v0.9.69.
 */
export type McpPricingResult = {
  cost: number | null;
  source: 'lookup' | 'fallback' | 'unknown';
  model_used: string | null;
  pricing_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'fallback' | null;
  pricing_source_date: '2026-05-14';
};

type ModelPricingRow = {
  input_per_mtok: number;
  output_per_mtok: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source_url: string;
  source_date: string;
  notes?: string;
};

type ClientDefaultModelRow = {
  model: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source_url: string;
  notes?: string;
};

// ---------------------------------------------------------------------------
// Constants and tables
// ---------------------------------------------------------------------------

/**
 * Freshness stamp for the rate table. Bumped whenever STACK.md sections 1-2 are
 * re-verified. v0.9.69 ships with the 2026-05-14 board.
 */
export const PRICING_SOURCE_DATE = '2026-05-14' as const;

/**
 * Per-model USD-per-MTok rates plus provenance metadata. Keys are canonical
 * lowercase-with-dashes model identifiers; lookup is O(1) via own-property
 * check (NOT bracket access -- prevents prototype-pollution access).
 *
 * Loaded from mcp/data/mcp-pricing-data.json at module-import time. Type-asserted
 * because TS cannot infer the union-typed `confidence` field through a JSON
 * import.
 */
export const MCP_MODEL_PRICING: Record<string, ModelPricingRow> =
  pricingData.model_pricing as Record<string, ModelPricingRow>;

/**
 * Per-client default-model mapping. Keys are byte-exact equal to the canonical
 * visual-session allowlist at `mcp/src/tools/visual-session.ts:9-12` (the
 * pricing test suite asserts parity at runtime to prevent typo drift).
 *
 * Every `.model` value MUST be a key in MCP_MODEL_PRICING; the module-load
 * invariant below throws at startup if that link is ever broken.
 */
export const MCP_CLIENT_DEFAULT_MODEL: Record<string, ClientDefaultModelRow> =
  pricingData.client_default_model as Record<string, ClientDefaultModelRow>;

// ---------------------------------------------------------------------------
// Module-load invariant -- every client default model points to a real row.
// ---------------------------------------------------------------------------
// This is a startup-time correctness gate, NOT a runtime concern. The runtime
// resolver below NEVER throws. If the JSON ships in a broken state (e.g.
// somebody renames a model key in model_pricing but forgets to update the
// client_default_model.model reference), the MCP server fails fast at boot
// with a clear error rather than silently mis-costing rows in production.
for (const clientLabel of Object.keys(MCP_CLIENT_DEFAULT_MODEL)) {
  const row = MCP_CLIENT_DEFAULT_MODEL[clientLabel];
  if (!Object.prototype.hasOwnProperty.call(MCP_MODEL_PRICING, row.model)) {
    throw new Error(
      `[mcp/pricing] client_default_model.${clientLabel}.model="${row.model}" ` +
      `has no row in MCP_MODEL_PRICING; check mcp/data/mcp-pricing-data.json`
    );
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * The canonical "unknown" envelope. Returned on null / undefined / non-object
 * input, on prototype-polluted strings that don't match a registered key, on
 * any caught exception, and on the explicit no-match path.
 */
const UNKNOWN_ENVELOPE: McpPricingResult = {
  cost: null,
  source: 'unknown',
  model_used: null,
  pricing_confidence: null,
  pricing_source_date: PRICING_SOURCE_DATE,
};

/**
 * Estimate the USD cost of an MCP-driven LLM call.
 *
 * Four resolution paths (CONTEXT.md "Fallback policy"):
 *
 *   1. **lookup**: `model` is provided AND is a key in MCP_MODEL_PRICING ->
 *      compute cost from the row, source='lookup', model_used=model,
 *      pricing_confidence = row.confidence (HIGH/MEDIUM/LOW).
 *
 *   2. **fallback**: `model` missing/null/unknown BUT `client` is in
 *      MCP_CLIENT_DEFAULT_MODEL AND its default model is in MCP_MODEL_PRICING
 *      -> compute cost using the default model's rates, source='fallback',
 *      model_used=defaultModel, pricing_confidence='fallback' (literal
 *      sentinel string; distinct from the model's own HIGH/MEDIUM/LOW so the
 *      caller can tell at a glance that the model was assumed rather than
 *      reported).
 *
 *   3. **unknown**: neither path matches -> {cost: null, source: 'unknown',
 *      model_used: null, pricing_confidence: null, pricing_source_date: '2026-05-14'}.
 *
 *   4. **missing tokens** (modifier on any of the above): if tokensIn or
 *      tokensOut is null / undefined / NaN / Infinity / non-number, set
 *      cost=null but preserve model_used + source + pricing_confidence as
 *      far as the lookup got. Telemetry rows with missing tokens are a
 *      legitimate "uncounted" reason; we still want the model/source
 *      attribution to flow through to the stats page.
 *
 * Security: the resolver NEVER throws. The whole body is wrapped in a
 * try/catch that falls through to the unknown envelope on any caught
 * exception. Object-property lookups use Object.prototype.hasOwnProperty.call
 * to prevent prototype-pollution access. Token values are checked via
 * Number.isFinite before arithmetic to prevent NaN propagation.
 *
 * pricing_source_date='2026-05-14' is attached to ALL FOUR return shapes.
 *
 * @param input - {client?, model?, tokensIn?, tokensOut?}. Any field may be
 *   omitted, null, or undefined.
 * @returns The McpPricingResult envelope. Shape is canonical on every input.
 */
export function estimateMcpCost(
  input: {
    client?: string | null;
    model?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
  } | null | undefined
): McpPricingResult {
  try {
    if (!input || typeof input !== 'object') return UNKNOWN_ENVELOPE;

    const client = (input as { client?: string | null }).client;
    const model = (input as { model?: string | null }).model;
    const tokensIn = (input as { tokensIn?: number | null }).tokensIn;
    const tokensOut = (input as { tokensOut?: number | null }).tokensOut;

    // Resolve which model to bill against, and which path we are on.
    let modelKey: string | null = null;
    let source: 'lookup' | 'fallback' | 'unknown' = 'unknown';
    let pricingConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'fallback' | null = null;

    if (
      typeof model === 'string' &&
      model.length > 0 &&
      Object.prototype.hasOwnProperty.call(MCP_MODEL_PRICING, model)
    ) {
      modelKey = model;
      source = 'lookup';
      pricingConfidence = MCP_MODEL_PRICING[model].confidence;
    } else if (
      typeof client === 'string' &&
      client.length > 0 &&
      Object.prototype.hasOwnProperty.call(MCP_CLIENT_DEFAULT_MODEL, client)
    ) {
      const defaultModel = MCP_CLIENT_DEFAULT_MODEL[client].model;
      if (Object.prototype.hasOwnProperty.call(MCP_MODEL_PRICING, defaultModel)) {
        modelKey = defaultModel;
        source = 'fallback';
        pricingConfidence = 'fallback';
      }
    }

    if (!modelKey) return UNKNOWN_ENVELOPE;

    // Compute cost only if BOTH tokens are finite numbers. Strict typeof check
    // rejects string-shaped tokens ('1000'), null/undefined, NaN, Infinity,
    // negative-infinity, and non-numeric inputs uniformly.
    const tin =
      typeof tokensIn === 'number' && Number.isFinite(tokensIn) ? tokensIn : null;
    const tout =
      typeof tokensOut === 'number' && Number.isFinite(tokensOut) ? tokensOut : null;

    let cost: number | null = null;
    if (tin !== null && tout !== null) {
      const row = MCP_MODEL_PRICING[modelKey];
      cost = (tin / 1_000_000) * row.input_per_mtok + (tout / 1_000_000) * row.output_per_mtok;
    }

    return {
      cost,
      source,
      model_used: modelKey,
      pricing_confidence: pricingConfidence,
      pricing_source_date: PRICING_SOURCE_DATE,
    };
  } catch (_e) {
    // Defensive: any unanticipated runtime error (prototype-polluted input,
    // exotic descriptor, etc.) falls through to the canonical unknown shape.
    return UNKNOWN_ENVELOPE;
  }
}
