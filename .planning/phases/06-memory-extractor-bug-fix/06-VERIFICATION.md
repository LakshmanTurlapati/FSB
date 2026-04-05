---
phase: 06-memory-extractor-bug-fix
verified: 2026-02-23T06:19:23Z
status: passed
score: 5/5 must-haves verified
gaps: []
---

# Phase 6: Memory Extractor Bug Fix Verification Report

**Phase Goal:** memory-extractor.js correctly instantiates UniversalProvider so AI-powered memory extraction runs when an AI provider is configured. Local fallback has been removed entirely per user decision -- memory extraction is AI-only. Failures surface visibly via extension badge and console errors.
**Verified:** 2026-02-23T06:19:23Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                   | Status     | Evidence                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | When an AI provider is configured, memory extraction uses the AI provider (not a local fallback)        | VERIFIED   | `_getProvider()` calls `new UniversalProvider(cfg)` with single settings object at line 318                             |
| 2   | When no API key is configured, extraction does not run and surfaces a clear error                       | VERIFIED   | `_getProvider()` throws descriptive Error at lines 311-315 before any AI call is made                                   |
| 3   | When AI call fails transiently, it retries 1-2 times before surfacing error with badge indicator        | VERIFIED   | `MAX_RETRIES = 2`, `RETRY_DELAYS = [1000, 2000]`, retry loop at lines 43-83 with `_isTransientError` gating             |
| 4   | Auth errors (401, 403) surface immediately with badge indicator, no retry                               | VERIFIED   | `_isAuthError()` at lines 437-443 checks status 401/403 + message patterns; on match calls `_setBadgeError()` and throws immediately before retry check |
| 5   | Extension badge shows red "!" on any extraction failure so user knows something went wrong              | VERIFIED   | `_setBadgeError()` at lines 459-466 sets `#FF0000` background and `!` text; called at lines 69, 88, and 362            |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                     | Expected                                     | Status    | Details                                                                                                  |
| -------------------------------------------- | -------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `lib/memory/memory-extractor.js`             | Contains `new UniversalProvider(cfg)`        | VERIFIED  | Line 318: `return new UniversalProvider(cfg);` -- single settings object passed                          |
| `lib/memory/memory-extractor.js`             | No `_localFallbackExtract` anywhere          | VERIFIED  | grep finds zero matches for `_localFallbackExtract` in file                                              |
| `lib/memory/memory-extractor.js`             | Uses `chrome.storage.local.get` directly     | VERIFIED  | Lines 281-297: direct `chrome.storage.local.get([...], callback)` call; no `config.loadFromStorage`     |

### Key Link Verification

| From                      | To                         | Via                                | Status   | Details                                                                              |
| ------------------------- | -------------------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `memory-extractor.js`     | `ai/universal-provider.js` | `new UniversalProvider(cfg)`       | WIRED    | `UniversalProvider` constructor takes a single `settings` object; `cfg` matches that shape (`modelProvider`, `modelName`, API keys) |
| `memory-extractor.js`     | `chrome.storage.local`     | `chrome.storage.local.get([...])` | WIRED    | Direct Chrome storage call at lines 280-297, no intermediary config abstraction      |

### Requirements Coverage

No REQUIREMENTS.md entries mapped explicitly to phase 6. Coverage is fully addressed by the five must-have truths above.

### Anti-Patterns Found

| File                              | Line | Pattern           | Severity | Impact                              |
| --------------------------------- | ---- | ----------------- | -------- | ----------------------------------- |
| `lib/memory/memory-extractor.js`  | 6    | comment "no local fallback" | Info | Intentional design note, not a stub |

No blocker anti-patterns found. No TODO/FIXME/placeholder markers. No empty return stubs. No console.log-only handlers. The `catch` block in `_parseEnrichmentResponse` is intentional graceful degradation (returns `rawAnalysis`), not a stub.

### Human Verification Required

None. All five truths are verifiable structurally. The badge behavior and retry timing are observable in code without running the extension.

### Gaps Summary

No gaps. All five must-haves pass all three verification levels (exists, substantive, wired).

---

## Detailed Findings

### Must-Have 1: AI provider called with single settings object

`_getProvider()` (lines 275-319) loads config keys from `chrome.storage.local`, assembles a plain `cfg` object, then executes:

```javascript
return new UniversalProvider(cfg);
```

`UniversalProvider`'s constructor signature is `constructor(settings)` and reads `settings.modelName`, `settings.modelProvider` -- exactly what `cfg` provides. The call matches the expected interface.

### Must-Have 2: No API key throws clear error

Lines 300-315:

```javascript
const activeKey = keyMap[providerName] || cfg.apiKey || '';
if (!activeKey) {
  throw new Error(`[MemoryExtractor] No API key configured for ${providerName}. Memory extraction requires an AI provider.`);
}
if (!cfg.modelName) {
  throw new Error('[MemoryExtractor] No model name configured. Memory extraction requires a model selection.');
}
```

This throws before any AI call, with a human-readable message naming the unconfigured provider. The caller (`extract()`) has no suppression; the error propagates and `_setBadgeError()` is called at line 88.

### Must-Have 3: Transient retry logic

```javascript
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000];

for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try { ... }
  catch (error) {
    if (this._isAuthError(error)) { throw immediately }
    if (attempt < MAX_RETRIES && this._isTransientError(error)) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      continue;
    }
    break;
  }
}
```

Up to 3 total attempts (attempt 0, 1, 2). Transient errors (429, 503, timeout, network) retry with 1s and 2s delays. Exhausted retries call `_setBadgeError()` and throw.

### Must-Have 4: Auth errors bypass retry

Lines 65-71:

```javascript
if (this._isAuthError(error)) {
  console.error('[MemoryExtractor] AI extraction auth error:', error.message);
  session._lastExtractionActionIndex = allActions.length;
  this._setBadgeError();
  throw error;
}
```

This block runs before the `attempt < MAX_RETRIES` check, so 401/403 errors skip all retry delay and immediately set the badge and re-throw.

`_isAuthError()` covers: HTTP status 401 or 403, message containing "unauthorized" or "forbidden", or message matching `/invalid.*key/i`.

### Must-Have 5: Badge indicator on failure

`_setBadgeError()` (lines 459-466):

```javascript
_setBadgeError() {
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    chrome.action.setBadgeText({ text: '!' });
  } catch (badgeErr) {
    // Badge API might not be available in all contexts
  }
}
```

Called at:
- Line 69: auth error in `extract()`
- Line 88: all retries exhausted in `extract()`
- Line 362: any error in `enrich()`

All failure paths reach the badge indicator.

---

_Verified: 2026-02-23T06:19:23Z_
_Verifier: Claude (gsd-verifier)_
