# Phase 6: Memory Extractor Bug Fix - Research

**Researched:** 2026-02-23
**Domain:** Chrome extension service worker / AI provider instantiation bug
**Confidence:** HIGH

## Summary

The memory extractor has a constructor argument mismatch bug at `memory-extractor.js:273`. The `UniversalProvider` class expects a single settings object (`constructor(settings)`), but `_getProvider()` passes three separate arguments (`cfg.modelProvider, cfg.modelName, {...}`). This causes `settings` to be set to the string `cfg.modelProvider` (e.g., `'xai'`), making all property accesses like `settings.modelName` return `undefined`. The provider silently constructs with broken config, then fails on API calls, causing every extraction to fall back to the local fallback method.

The user has decided to remove local fallback entirely -- memory extraction is an AI-only feature. When no API key is configured, extraction should not run at all. When the AI call fails, errors should surface visibly (badge + console), not silently degrade.

The fix is small and well-understood. Three correct usage patterns exist in the codebase already: `sitemap-refiner.js:130`, `background.js:507`, and `ai-providers.js:19`. All pass a single settings object to `UniversalProvider`.

**Primary recommendation:** Fix the constructor call, remove `_localFallbackExtract` entirely, remove `this._provider` caching, add provider field validation, and surface failures via extension badge and thrown errors.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Failure handling
- Auth errors (invalid API key, wrong provider): surface as error immediately, no fallback, no retry
- Transient failures (network timeout, rate limit): retry 1-2 times, then surface as error -- no silent fallback
- No API key configured: do not run extraction at all -- memory extraction requires an AI provider
- All AI extraction failures should show an extension badge indicator so users know something went wrong
- Errors also logged to console with details

#### Local fallback removal
- Remove `_localFallbackExtract` method entirely
- Remove all code paths that fall back to local extraction
- AI extraction or nothing -- no silent degradation

#### Provider caching
- Do not cache the provider instance (remove `this._provider`)
- Create a fresh UniversalProvider from current config on every extraction/enrichment call
- Simplicity over micro-optimization -- chrome.storage reads are fast enough
- Keep the `context.provider` passthrough -- if the caller already has a provider, use it directly

#### Provider validation
- Basic validation in `_getProvider`: check that required fields (model, provider, apiKey) are present before returning
- Fail fast with a clear error message if settings are misconfigured

### Claude's Discretion

None specified -- all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

No new libraries or dependencies needed. This phase modifies one existing file (`lib/memory/memory-extractor.js`) and references existing codebase patterns.

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| UniversalProvider | `ai/universal-provider.js` | Model-agnostic AI API client | Already used everywhere in the codebase |
| config | `config/config.js` | Chrome storage config loader | Singleton, already importScript-ed in background.js |
| chrome.action.setBadge* | Chrome Extension API | Badge error indicator | Already used in Phase 4 pattern (background.js:3920-3921) |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| memory-manager.js | `lib/memory/memory-manager.js` | Calls extractor.extract() and extractor.enrich() | Caller -- must handle errors from extractor |
| memory-schemas.js | `lib/memory/memory-schemas.js` | createEpisodicMemory, validateMemory, etc. | Still used in _parseExtractedMemories (retained) |

## Architecture Patterns

### Pattern 1: Correct UniversalProvider Instantiation

**What:** Pass a single flat settings object to UniversalProvider constructor.
**Confidence:** HIGH -- verified by reading `ai/universal-provider.js:122-133`

The constructor expects:
```javascript
constructor(settings) {
    this.settings = settings;
    this.model = settings.modelName;
    this.provider = settings.modelProvider || 'xai';
    this.config = PROVIDER_CONFIGS[this.provider] || PROVIDER_CONFIGS.custom;
}
```

It accesses `settings.modelName`, `settings.modelProvider`, `settings[this.config.keyField]` (dynamic key like `apiKey`, `geminiApiKey`, etc.), and `settings.customEndpoint`.

**Required settings object shape:**
```javascript
{
  modelProvider: 'xai' | 'gemini' | 'openai' | 'anthropic' | 'custom',
  modelName: 'grok-4-1-fast' | etc.,
  apiKey: string,           // xAI key (keyField for xai provider)
  geminiApiKey: string,     // keyField for gemini provider
  openaiApiKey: string,     // keyField for openai provider
  anthropicApiKey: string,  // keyField for anthropic provider
  customApiKey: string,     // keyField for custom provider
  customEndpoint: string    // only for custom provider
}
```

**Correct patterns already in codebase:**

1. `sitemap-refiner.js:130` -- loads settings via `loadProviderSettings()`, passes directly:
   ```javascript
   const settings = config || await loadProviderSettings();
   const provider = new UniversalProvider(settings);
   ```

2. `background.js:507` -- receives `settings` parameter, passes directly:
   ```javascript
   const provider = new UniversalProvider(settings);
   ```

3. `ai-providers.js:19` -- factory function:
   ```javascript
   function createAIProvider(settings) {
     return new UniversalProvider(settings);
   }
   ```

### Pattern 2: Config Loading for Provider Creation

**What:** How to load config and extract the settings object for UniversalProvider.
**Confidence:** HIGH -- verified by reading `config/config.js:108-139` and `lib/memory/sitemap-refiner.js:75-94`

`config.loadFromStorage()` returns a flat object containing ALL config fields including:
- `modelProvider`, `modelName`, `apiKey`, `geminiApiKey`, `openaiApiKey`, `anthropicApiKey`, `customApiKey`, `customEndpoint`
- Plus non-provider fields: `maxIterations`, `debugMode`, `domOptimization`, etc.

This flat object is directly compatible with `UniversalProvider(settings)` because the constructor only accesses the fields it needs. Passing extra fields is harmless.

**The fix for `_getProvider`** is therefore simple: pass `cfg` directly instead of destructuring it into three arguments:
```javascript
const cfg = await config.loadFromStorage();
// ... validation ...
const provider = new UniversalProvider(cfg);
```

### Pattern 3: API Key Validation per Provider

**What:** Determine which API key field to check based on the configured provider.
**Confidence:** HIGH -- verified from `PROVIDER_CONFIGS` in `universal-provider.js:7-40` and `sitemap-refiner.js:113-121`

The `keyField` mapping from PROVIDER_CONFIGS:
| Provider | keyField |
|----------|----------|
| xai | `apiKey` |
| openai | `openaiApiKey` |
| anthropic | `anthropicApiKey` |
| gemini | `geminiApiKey` |
| custom | `customApiKey` |

`sitemap-refiner.js:113-121` has a clean validation pattern:
```javascript
const keyMap = {
  xai: settings.apiKey,
  gemini: settings.geminiApiKey,
  openai: settings.openaiApiKey,
  anthropic: settings.anthropicApiKey,
  custom: settings.customApiKey
};
const activeKey = keyMap[provider_name] || settings.apiKey || '';
if (!activeKey) {
  throw new Error('No API key configured for ' + provider_name);
}
```

### Pattern 4: Extension Badge Error Indicator

**What:** Show red "!" badge on extension icon when errors occur.
**Confidence:** HIGH -- verified from `background.js:3920-3921`

Existing pattern from Phase 4:
```javascript
chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
chrome.action.setBadgeText({ text: '!' });
```

Badge is cleared on successful content script load (background.js:3856):
```javascript
chrome.action.setBadgeText({ text: '' });
```

**For memory extraction errors:** The badge must be set from within the background service worker context. `memory-extractor.js` runs in the service worker (loaded via `importScripts` at background.js:98), so it has direct access to `chrome.action.setBadge*` APIs.

### Pattern 5: Retry for Transient Failures

**What:** UniversalProvider already has built-in retry for rate limits (429/503) with exponential backoff (up to 3 retries). See `universal-provider.js:399-477`.
**Confidence:** HIGH -- verified from source code.

The user's decision says: "Transient failures (network timeout, rate limit): retry 1-2 times, then surface as error."

UniversalProvider's `sendRequest` already retries rate limits up to `MAX_RATE_LIMIT_RETRIES = 3` times. For network timeouts, it uses `fetchWithTimeout` which throws on timeout.

The memory extractor's `extract()` method should catch errors from `sendRequest` and potentially retry the full extraction 1-2 times for transient errors (timeouts), while letting auth errors (401, 403) and other non-transient errors propagate immediately.

### Anti-Patterns to Avoid

- **Silent fallback to local extraction:** The current code silently falls back when provider creation fails or AI call fails. The user explicitly decided against this. Every error path must either throw or set the badge.
- **Caching a provider instance:** The user decided against `this._provider` caching. Create fresh on every call.
- **Swallowing errors in enrich():** The current `enrich()` returns `null` on any failure. This is acceptable for enrichment (store-first-enrich-second pattern from Phase 07-01), but should still log and potentially set badge for visibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key validation per provider | Custom key field mapping | PROVIDER_CONFIGS keyField mapping from universal-provider.js | Already defined, single source of truth |
| Rate limit retry | Custom retry loop | UniversalProvider.sendRequest built-in rate limit handling | Already implements exponential backoff with Retry-After header parsing |
| Config loading | Direct chrome.storage.local.get | config.loadFromStorage() | Already has caching, validation, model auto-correction |

## Common Pitfalls

### Pitfall 1: _parseExtractedMemories Catch Block Also Has Local Fallback

**What goes wrong:** The `_parseExtractedMemories` catch block (line 233-255) creates a simple episodic memory using `createEpisodicMemory` when JSON parsing fails. This is arguably a local fallback too.
**Why it happens:** Separate from the `_localFallbackExtract` method -- this is a parse-error-specific fallback inside the AI response parser.
**How to handle:** The user's decision is "remove all code paths that fall back to local extraction." However, this parse fallback is qualitatively different -- the AI DID respond, but the response was unparseable. Two options:
  1. Remove the catch fallback too, let it throw/return empty (strict interpretation)
  2. Keep it as a best-effort parse recovery since AI was actually used (pragmatic interpretation)

**Recommendation:** Remove the catch-block fallback episodic memory creation. If the AI responded with unparseable content, surface the error. This is consistent with "AI extraction or nothing." The `_parseExtractedMemories` method should return whatever it successfully parsed (could be empty `[]`), and errors should propagate to the caller.

### Pitfall 2: enrich() Also Calls _getProvider and Has Silent Failure

**What goes wrong:** The `enrich()` method (line 411-448) also calls `_getProvider(context)` and silently returns `null` when provider is unavailable.
**Why it happens:** Same buggy `_getProvider` code path.
**How to handle:** Fix `_getProvider` once -- both `extract()` and `enrich()` use it. For `enrich()`, returning `null` is acceptable per the store-first-enrich-second pattern (enrichment failure should not block storage), but the badge should still be set for visibility.

### Pitfall 3: Memory Manager Swallows Extraction Errors

**What goes wrong:** `memory-manager.js:78` catches all errors from `this._extractor.extract()` and returns `[]`. If `extract()` starts throwing on failures (as the user wants), the error will be caught by the manager and silently ignored.
**Why it happens:** The manager was designed around the assumption that extraction is fire-and-forget.
**How to handle:** The badge should be set inside `memory-extractor.js` itself (before throwing), so even if the manager catches the error, the user still sees the badge. The manager's catch block can remain as-is since it already logs to console.

### Pitfall 4: background.js:229 Caller Also Catches Errors

**What goes wrong:** The `extractMemoriesFromSession` function (background.js:229) wraps `memoryManager.add()` in a try-catch and logs `console.warn`. This is another layer of error swallowing.
**Why it happens:** Memory extraction was designed as non-blocking/non-critical.
**How to handle:** Same as pitfall 3 -- set badge inside memory-extractor.js before the error propagates. The badge persists regardless of how many try-catch layers the error passes through.

### Pitfall 5: config.loadFromStorage() May Not Include All API Key Fields

**What goes wrong:** `config.loadFromStorage()` only reads keys defined in `this.defaults`. The defaults include `apiKey` and `geminiApiKey`, but NOT `openaiApiKey`, `anthropicApiKey`, `customApiKey`, or `customEndpoint`.
**Why it happens:** Config defaults were written for xAI and Gemini only. Other providers were added later to the options page but not the defaults.
**Impact:** When a user has configured an OpenAI or Anthropic key in the options page, `config.loadFromStorage()` will still return it (because `chrome.storage.local.get` returns stored values even if not in defaults list -- but ONLY if requested by key name).

**Wait -- re-checking:** `config.loadFromStorage()` does `chrome.storage.local.get(Object.keys(this.defaults))`. The defaults DO NOT include `openaiApiKey`, `anthropicApiKey`, `customApiKey`, or `customEndpoint`. So these fields will NOT be returned by `loadFromStorage()`.

However, `sitemap-refiner.js` works around this by calling `chrome.storage.local.get()` directly with an explicit list of all key names (line 77-81).

**This is a pre-existing issue, not introduced by this phase.** But the fix to `_getProvider` should use the sitemap-refiner pattern (explicit key list via `chrome.storage.local.get`) rather than relying on `config.loadFromStorage()` to ensure all provider keys are retrieved.

**UPDATE -- re-reading config.js more carefully:** Line 118 does `chrome.storage.local.get(Object.keys(this.defaults))`. The defaults object at line 22 shows `apiKey` and `geminiApiKey` only. OpenAI/Anthropic/custom keys are NOT in defaults. So `config.loadFromStorage()` will NOT return those keys.

**Recommendation:** In `_getProvider`, use the same pattern as `sitemap-refiner.js:76-93` -- call `chrome.storage.local.get()` directly with the full list of required keys, bypassing `config.loadFromStorage()`.

## Code Examples

### Current Buggy Code (memory-extractor.js:263-288)

```javascript
async _getProvider(context) {
    if (context.provider) return context.provider;
    if (this._provider) return this._provider;  // BUG: caching decision says remove

    try {
      const cfg = await config.loadFromStorage();
      if (!cfg.apiKey && !cfg.geminiApiKey) return null;  // BUG: silently returns null

      const provider = new UniversalProvider(cfg.modelProvider, cfg.modelName, {  // BUG: wrong args
        apiKey: cfg.apiKey,
        geminiApiKey: cfg.geminiApiKey,
        openaiApiKey: cfg.openaiApiKey,  // NOTE: won't be in cfg (see Pitfall 5)
        anthropicApiKey: cfg.anthropicApiKey,  // NOTE: won't be in cfg
        customEndpoint: cfg.customEndpoint,  // NOTE: won't be in cfg
        customApiKey: cfg.customApiKey  // NOTE: won't be in cfg
      });

      this._provider = provider;  // BUG: caching decision says remove
      return provider;
    } catch (error) {
      console.error('[MemoryExtractor] Failed to create provider:', error.message);
      return null;  // BUG: silently returns null
    }
  }
```

### Fixed Code Pattern (based on sitemap-refiner.js pattern)

```javascript
async _getProvider(context) {
    // Reuse caller-provided provider if available
    if (context.provider) return context.provider;

    // Load all provider-related settings from chrome.storage directly
    // (config.loadFromStorage() doesn't include all API key fields)
    const cfg = await new Promise((resolve) => {
      chrome.storage.local.get([
        'modelProvider', 'modelName', 'apiKey',
        'geminiApiKey', 'openaiApiKey', 'anthropicApiKey',
        'customApiKey', 'customEndpoint'
      ], (result) => {
        resolve({
          modelProvider: result.modelProvider || 'xai',
          modelName: result.modelName || 'grok-4-1-fast',
          apiKey: result.apiKey || '',
          geminiApiKey: result.geminiApiKey || '',
          openaiApiKey: result.openaiApiKey || '',
          anthropicApiKey: result.anthropicApiKey || '',
          customApiKey: result.customApiKey || '',
          customEndpoint: result.customEndpoint || ''
        });
      });
    });

    // Validate required fields
    const providerName = cfg.modelProvider;
    const keyMap = {
      xai: cfg.apiKey,
      gemini: cfg.geminiApiKey,
      openai: cfg.openaiApiKey,
      anthropic: cfg.anthropicApiKey,
      custom: cfg.customApiKey
    };
    const activeKey = keyMap[providerName] || cfg.apiKey || '';

    if (!activeKey) {
      throw new Error(`[MemoryExtractor] No API key configured for ${providerName}. Memory extraction requires an AI provider.`);
    }

    if (!cfg.modelName) {
      throw new Error('[MemoryExtractor] No model name configured. Memory extraction requires a model selection.');
    }

    return new UniversalProvider(cfg);
  }
```

### Badge Setting Pattern (inside memory-extractor.js)

```javascript
// Set error badge -- memory-extractor.js runs in service worker, has chrome.action access
try {
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  chrome.action.setBadgeText({ text: '!' });
} catch (badgeErr) {
  // Badge API might not be available in all contexts
}
```

### Fixed extract() Method Pattern (error handling, no fallback)

```javascript
async extract(session, context = {}) {
    if (!session || !session.task) {
      console.warn('[MemoryExtractor] No session or task to extract from');
      return [];
    }

    const actionStartIndex = session._lastExtractionActionIndex || 0;
    const allActions = session.actionHistory || [];
    const newActions = allActions.slice(actionStartIndex);

    if (actionStartIndex > 0 && newActions.length === 0) {
      console.log('[MemoryExtractor] No new actions since last extraction, skipping');
      return [];
    }

    // Get provider -- throws if not configured
    const provider = await this._getProvider(context);

    try {
      const prompt = this._buildExtractionPrompt(session, context, newActions);
      const requestBody = await provider.buildRequest(prompt, {});
      const response = await provider.sendRequest(requestBody, { attempt: 0 });
      const parsed = provider.parseResponse(response);
      // ... parse memories ...
      session._lastExtractionActionIndex = allActions.length;
      return memories;
    } catch (error) {
      console.error('[MemoryExtractor] AI extraction failed:', error.message);
      // Set badge for visibility
      try {
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        chrome.action.setBadgeText({ text: '!' });
      } catch {}
      throw error;  // Propagate -- no silent fallback
    }
  }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three-arg constructor call | Single settings object | This fix | Fixes the root cause bug |
| Silent local fallback on failure | Error surfacing via badge + throw | This fix (user decision) | AI-only extraction, no degradation |
| Cached provider instance | Fresh provider per call | This fix (user decision) | Always uses current config |
| config.loadFromStorage() | Direct chrome.storage.local.get | This fix | All API key fields retrieved correctly |

## Scope of Changes

### Files Modified

**Primary:** `lib/memory/memory-extractor.js` -- This is the only file that needs code changes.

### Changes Inventory

1. **`constructor()`** (line 8-10): Remove `this._provider = null`
2. **`extract()`** (lines 18-63): Remove local fallback call at line 39, remove fallback call at line 59, throw error instead
3. **`_getProvider()`** (lines 263-288): Complete rewrite -- fix constructor call, add validation, remove caching
4. **`_localFallbackExtract()`** (lines 297-401): Delete entire method
5. **`_parseExtractedMemories()`** (lines 233-255): Remove catch-block fallback episodic memory creation, let errors propagate as empty array
6. **Badge calls**: Add `chrome.action.setBadge*` in error paths of `extract()` and optionally `enrich()`

### Files NOT Modified

- `background.js` -- The caller already has try-catch, no changes needed
- `lib/memory/memory-manager.js` -- The caller already catches errors and logs, no changes needed
- `ai/universal-provider.js` -- No changes, constructor is correct
- `config/config.js` -- No changes (we bypass it with direct chrome.storage.local.get)

## Open Questions

1. **FIX-02 (Local fallback) vs CONTEXT.md decisions:** The roadmap requires "FIX-02: Local fallback still works when AI extraction genuinely fails." But the user's CONTEXT.md decisions explicitly say to remove local fallback entirely. The CONTEXT.md decisions override the roadmap. **Resolution: Follow CONTEXT.md -- remove local fallback. FIX-02 should be updated to reflect "errors surface visibly when AI extraction fails" instead of "local fallback works."**

2. **_parseExtractedMemories catch-block fallback:** Is the catch block in `_parseExtractedMemories` (which creates a simple episodic memory from unparseable AI output) considered "local fallback"? **Recommendation: Yes, remove it. If AI returns garbage, surface the error. The method should return whatever it successfully parsed (could be `[]`). This is consistent with the user's "AI extraction or nothing" decision.**

3. **Badge clearing for memory extraction errors:** The contentScriptReady handler clears the badge (background.js:3856). Should memory extraction errors use the same badge (meaning a successful content script load would clear a memory extraction error badge)? **Recommendation: Use the same badge pattern for simplicity. Memory extraction errors are transient -- the badge will be cleared on next successful content script load or could be cleared on next successful extraction. Adding a separate badge system would be over-engineering for this phase.**

## Sources

### Primary (HIGH confidence)
- `ai/universal-provider.js` -- Constructor signature, settings object shape, PROVIDER_CONFIGS key fields
- `lib/memory/memory-extractor.js` -- Current buggy code, all method signatures and control flow
- `lib/memory/sitemap-refiner.js` -- Correct UniversalProvider instantiation pattern, loadProviderSettings pattern
- `background.js` -- Correct UniversalProvider instantiation (line 507), badge error pattern (lines 3920-3921), memoryManager.add caller (line 229)
- `config/config.js` -- loadFromStorage implementation, defaults object (missing OpenAI/Anthropic/custom keys)
- `lib/memory/memory-manager.js` -- Caller of extract() and enrich(), error handling pattern
- `ai/ai-providers.js` -- Factory function pattern for UniversalProvider
- `.planning/phases/04-content-script-modularization/04-01-PLAN.md` -- Badge error indicator pattern from Phase 4

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code verified by reading source files directly
- Architecture: HIGH -- patterns verified across 4 correct usage sites in codebase
- Pitfalls: HIGH -- all identified from actual code reading, especially the config.loadFromStorage missing keys issue (Pitfall 5)

**Research date:** 2026-02-23
**Valid until:** Indefinite (bug fix research, not dependent on external library versions)
