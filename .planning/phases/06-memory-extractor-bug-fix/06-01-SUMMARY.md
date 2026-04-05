---
phase: 06-memory-extractor-bug-fix
plan: 01
subsystem: memory
tags: [bug-fix, ai-provider, universalprovider, memory-extraction, error-handling]
requires: []
provides:
  - Fixed MemoryExtractor with correct UniversalProvider instantiation
  - AI-only memory extraction with visible error surfacing
  - Retry logic for transient AI failures
affects:
  - lib/memory/memory-manager.js (caller - compatible, no changes needed)
  - background.js (upstream caller - compatible, no changes needed)
tech-stack:
  added: []
  patterns:
    - chrome.storage.local.get for direct config loading (matches sitemap-refiner.js)
    - Provider key validation via keyMap lookup (matches sitemap-refiner.js)
    - Extension badge error indicator pattern (matches background.js)
    - Retry with exponential backoff for transient errors
    - Auth error immediate surfacing (no retry)
key-files:
  created: []
  modified:
    - lib/memory/memory-extractor.js
key-decisions:
  - id: 06-01-D1
    decision: Remove local fallback extraction entirely -- AI-only or error
    rationale: Per user decision, local fallback masks provider misconfiguration silently
  - id: 06-01-D2
    decision: No provider instance caching -- fresh UniversalProvider per call
    rationale: Per user decision, avoids stale config after settings changes
  - id: 06-01-D3
    decision: Use chrome.storage.local.get directly instead of config.loadFromStorage
    rationale: config.loadFromStorage omits OpenAI/Anthropic/custom API key fields
  - id: 06-01-D4
    decision: Badge error indicator for all extraction/enrichment failures
    rationale: Failures must be visible to user, not silently swallowed
duration: 2.8 min
completed: 2026-02-23
---

# Phase 6 Plan 1: Fix UniversalProvider Constructor and Remove Local Fallback Summary

Fixed the three-argument UniversalProvider constructor bug in memory-extractor.js (was passing modelProvider, modelName, options instead of single settings object), removed the entire local fallback extraction path, and added visible error surfacing via extension badge with retry logic for transient failures.

## Performance

| Metric | Value |
|--------|-------|
| Duration | 2.8 min |
| Started | 2026-02-23T06:13:32Z |
| Completed | 2026-02-23T06:16:22Z |
| Tasks | 2/2 |
| Files modified | 1 |

## Accomplishments

1. **Fixed UniversalProvider constructor** -- Changed from `new UniversalProvider(cfg.modelProvider, cfg.modelName, {...})` (three args) to `new UniversalProvider(cfg)` (single settings object), matching the pattern in ai-providers.js and sitemap-refiner.js
2. **Replaced config.loadFromStorage with chrome.storage.local.get** -- Direct storage access with explicit key list ensures all provider API keys (xai, gemini, openai, anthropic, custom) are loaded correctly
3. **Added provider key validation** -- keyMap lookup resolves the active API key for the selected provider; throws clear error if no key configured
4. **Removed local fallback entirely** -- Deleted _localFallbackExtract method (~105 lines) and all references in extract(), catch blocks, and _parseExtractedMemories
5. **Added retry logic for transient errors** -- Retries up to 2 times with 1s/2s delays for timeouts, rate limits (429), server errors (503), and network issues
6. **Auth error immediate surfacing** -- 401, 403, "unauthorized", "forbidden", "invalid key" errors throw immediately with no retry
7. **Extension badge error indicator** -- Red "!" badge set on any extraction or enrichment failure via _setBadgeError helper
8. **Removed provider caching** -- No more this._provider; fresh provider created every call to pick up config changes
9. **Cleaned _parseExtractedMemories catch block** -- Removed episodic memory fallback creation; now returns whatever was parsed so far

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix _getProvider and remove local fallback from extract() | ad5a4bd | Rewrote _getProvider, extract(), enrich(); deleted _localFallbackExtract; added retry/badge logic |
| 2 | Verify no regressions in callers and overall coherence | (verification only) | Read-only coherence pass, syntax check passed, all method refs intact |

## Files Modified

- **lib/memory/memory-extractor.js** -- 129 insertions, 178 deletions (525 -> 475 lines)

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 06-01-D1 | Remove local fallback extraction entirely | Per user decision; local fallback masks provider misconfiguration |
| 06-01-D2 | No provider instance caching | Per user decision; avoids stale config after settings changes |
| 06-01-D3 | Use chrome.storage.local.get directly | config.loadFromStorage omits OpenAI/Anthropic/custom API key fields |
| 06-01-D4 | Badge error indicator on all failures | Failures must be visible to user, not silently swallowed |

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- memory-extractor.js is fully fixed and ready for production use
- Callers (memory-manager.js, background.js) are compatible without changes
- memory-manager.js catch block returns [] on extract failure, which is correct behavior
- enrich() returns null on failure, which memory-manager's _enrichAsync handles gracefully

## Self-Check: PASSED
