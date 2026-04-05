# Phase 6: Memory Extractor Bug Fix - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the UniversalProvider constructor call in memory-extractor.js so AI-powered memory extraction runs when an AI provider is configured. The constructor currently receives three separate arguments (modelProvider, modelName, options) instead of a single settings object, causing it to silently fail and always use local fallback. Remove local fallback entirely -- memory extraction is an AI-only feature.

</domain>

<decisions>
## Implementation Decisions

### Failure handling
- Auth errors (invalid API key, wrong provider): surface as error immediately, no fallback, no retry
- Transient failures (network timeout, rate limit): retry 1-2 times, then surface as error -- no silent fallback
- No API key configured: do not run extraction at all -- memory extraction requires an AI provider
- All AI extraction failures should show an extension badge indicator so users know something went wrong
- Errors also logged to console with details

### Local fallback removal
- Remove `_localFallbackExtract` method entirely
- Remove all code paths that fall back to local extraction
- AI extraction or nothing -- no silent degradation

### Provider caching
- Do not cache the provider instance (remove `this._provider`)
- Create a fresh UniversalProvider from current config on every extraction/enrichment call
- Simplicity over micro-optimization -- chrome.storage reads are fast enough
- Keep the `context.provider` passthrough -- if the caller already has a provider, use it directly

### Provider validation
- Basic validation in `_getProvider`: check that required fields (model, provider, apiKey) are present before returning
- Fail fast with a clear error message if settings are misconfigured

</decisions>

<specifics>
## Specific Ideas

- The bug is at `memory-extractor.js:273` -- `new UniversalProvider(cfg.modelProvider, cfg.modelName, {...})` should be `new UniversalProvider({modelProvider: cfg.modelProvider, modelName: cfg.modelName, ...})`
- Match the pattern used in `sitemap-refiner.js:130` and `background.js:507` which correctly pass a single settings object
- Extension badge for extraction errors should be consistent with the existing badge error pattern from Phase 4 (04-01-PLAN)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-memory-extractor-bug-fix*
*Context gathered: 2026-02-23*
