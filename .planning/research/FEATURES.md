# Feature Landscape: Tech Debt Cleanup for FSB Chrome Extension

**Domain:** Chrome Extension tech debt cleanup -- content script decomposition, configuration patterns, dead code removal, constructor bug fixes
**Researched:** 2026-02-21
**Overall Confidence:** HIGH
**Scope:** Specific to FSB v9.0.2, a 13,429-line content.js monolith in a Manifest V3 Chrome Extension

---

## Table Stakes

Features that constitute proper, non-controversial tech debt cleanup. Skipping any of these means the cleanup is incomplete or creates new risks.

---

### TS-1: Dead Code Removal with Verification (waitForActionable)

**Why Expected:** Dead code increases cognitive load, confuses contributors, bloats file size, and creates false confidence that functionality exists. In a 13K-line file, every line that serves no purpose actively harms maintainability. `waitForActionable()` (lines 4425-4572, ~148 lines) is defined but never called anywhere in the codebase -- verified via grep across all project files. It returns only from its own definition.

**Verification Protocol:**

The standard for safe dead code removal in JavaScript without a type system or build tooling is a three-step process:

1. **Static analysis (grep/search):** Search the entire codebase for all references to the function name. For `waitForActionable`, the only match is its own definition at content.js:4425. Zero call sites. Confidence: HIGH.

2. **Dynamic call path analysis:** Consider whether the function could be invoked indirectly -- via `eval()`, string-based dispatch, `window[funcName]()`, or message handler routing. In content.js, the message handler (`chrome.runtime.onMessage`) dispatches based on `request.action` strings that map to `tools.*` or specific named handlers. `waitForActionable` is a standalone function, not a property of `tools`, not referenced in any message handler case, and not exported to `window`. It cannot be reached dynamically.

3. **Replacement audit:** Confirm that the functionality `waitForActionable` provided is covered elsewhere. It is: `smartEnsureReady()` (line 4290) and `ensureElementReady()` (line 4317) both handle the same use case (wait for element to be visible, enabled, and stable) with simpler APIs. `waitForActionable` appears to be an older implementation that was superseded.

**What to Do:**
- Remove lines 4425-4572 entirely
- Run a final grep to confirm no references remain
- No behavioral change expected; confirm with manual testing of a basic automation task

**Complexity:** Low
**Risk:** Very Low (function is unreachable)

**Sources:**
- Codebase grep: `waitForActionable` appears only at content.js:4425 (definition)
- [Knip - dead code detection tool](https://knip.dev/) and [Dead Code Checker](https://github.com/denisoed/dead-code-checker) document this same three-step verification approach
- [HackerNoon: Remove Dead Code](https://hackernoon.com/refactoring-021-remove-dead-code) -- "removing dead code as you refactor improves maintainability with no risk of new problems"

---

### TS-2: Fix UniversalProvider Constructor Args in memory-extractor.js

**Why Expected:** This is a runtime bug, not just style debt. The code will throw or produce undefined behavior when the memory extraction code path is exercised.

**The Bug (memory-extractor.js line 273):**
```javascript
// WRONG -- passes 3 positional args
const provider = new UniversalProvider(cfg.modelProvider, cfg.modelName, {
  apiKey: cfg.apiKey,
  geminiApiKey: cfg.geminiApiKey,
  ...
});
```

**UniversalProvider's actual constructor (universal-provider.js line 121-133):**
```javascript
class UniversalProvider {
  constructor(settings) {         // Takes a SINGLE settings object
    this.settings = settings;
    this.model = settings.modelName;
    this.provider = settings.modelProvider || 'xai';
    ...
  }
}
```

**What happens:** `settings` receives the string `cfg.modelProvider` (e.g., "xai"). Then `settings.modelName` is `undefined`, `settings.modelProvider` is `undefined` (strings don't have these properties). The second and third arguments are silently ignored. The provider will attempt to use model `undefined` against provider `xai` (default fallback), which will produce API errors or silent failures.

**Correct pattern (from background.js line 425):**
```javascript
const provider = new UniversalProvider(settings);  // settings is the full config object
```

**What to Do:**
```javascript
// FIX: pass a single settings object
const provider = new UniversalProvider({
  modelProvider: cfg.modelProvider,
  modelName: cfg.modelName,
  apiKey: cfg.apiKey,
  geminiApiKey: cfg.geminiApiKey,
  openaiApiKey: cfg.openaiApiKey,
  anthropicApiKey: cfg.anthropicApiKey,
  customEndpoint: cfg.customEndpoint,
  customApiKey: cfg.customApiKey
});
```

Or more concisely, since `cfg` already has all the needed keys:
```javascript
const provider = new UniversalProvider(cfg);
```

**Complexity:** Low (one-line fix)
**Risk:** Low (fixes a bug; improves behavior)

**Sources:**
- universal-provider.js line 121-133: constructor signature is `constructor(settings)` (single object)
- background.js line 425: `new UniversalProvider(settings)` -- correct usage
- ai-providers.js line 19: `return new UniversalProvider(settings)` -- correct usage
- memory-extractor.js line 273: `new UniversalProvider(cfg.modelProvider, cfg.modelName, {...})` -- incorrect, three positional args

---

### TS-3: Make ElementCache maxCacheSize Configurable

**Why Expected:** Hardcoded magic numbers are a classic tech debt indicator. `maxCacheSize = 100` (content.js line 619) is a tuning parameter that may need adjustment based on page complexity. Some sites FSB automates have 2000+ interactive elements; a cache of 100 with FIFO eviction means constant cache churn on complex pages. Conversely, on simple pages, 100 may waste memory.

**Configuration Pattern Decision -- chrome.storage vs. Config Object vs. Constructor Parameter:**

For this specific value, the right answer is: **pass it as a constructor parameter with a default, sourced from the existing `config.js` defaults object.** Here is why:

| Pattern | Pros | Cons | Verdict |
|---------|------|------|---------|
| chrome.storage.local | User-configurable at runtime, persists across sessions | Async-only access; ElementCache is constructed synchronously at content script load; would need to defer cache construction or use a sentinel value until async config loads | Overkill for this |
| Config object (config.js defaults) | Already exists; single source of truth for tuning knobs; synchronous access from content script if injected before content.js | Content scripts don't currently import config.js (it is used in background/options contexts) | Close, but requires injection ordering |
| Constructor parameter with default | Simple; testable; no external dependency; the caller can source the value however it wants | Not user-configurable from options page without additional plumbing | Best for now |
| Hardcoded constant at top of file | Visible; easy to find; better than buried in constructor | Still hardcoded, just relocated | Acceptable intermediate step |

**Recommendation:** Use a named constant at the top of the relevant module, with a clear comment, and accept it as a constructor parameter:

```javascript
const DEFAULT_ELEMENT_CACHE_SIZE = 100;

class ElementCache {
  constructor(maxSize = DEFAULT_ELEMENT_CACHE_SIZE) {
    this.cache = new Map();
    this.stateVersion = 0;
    this.observer = null;
    this.maxCacheSize = maxSize;
  }
}
```

If the value should be user-configurable from the options page, add `elementCacheSize` to the `config.js` defaults and read it via chrome.storage in the initialization path that creates the ElementCache instance. But this is a performance tuning parameter, not a user-facing setting -- most users would not understand "element cache size." Keep it as a developer constant for now.

**Why NOT chrome.storage for this specific value:**
- chrome.storage is async; ElementCache is constructed synchronously at script load time
- The content script would need to defer cache construction until after an async storage read, which changes initialization ordering and adds complexity
- This is an internal performance knob, not a user preference

**When TO use chrome.storage:** For values that users configure through the options page (API keys, model selection, maxIterations, debugMode -- which FSB already does correctly via config.js + options.js).

**Complexity:** Low
**Risk:** Very Low

**Sources:**
- [Chrome Storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) -- async-only access, 10MB local limit
- content.js line 619: `this.maxCacheSize = 100` -- current hardcoded value
- config.js: demonstrates the existing chrome.storage pattern for user-facing settings

---

### TS-4: Content Script Decomposition -- Module Boundary Identification

**Why Expected:** A 13,429-line single file is well past the point where maintenance, review, and navigation become painful. The Chrome Extension Manifest V3 `content_scripts.js` array allows multiple files injected in order, with all files sharing the same isolated world (meaning later files can access variables/functions defined by earlier files).

**Current Logical Sections in content.js (identified from section comments and function clustering):**

| Section | Lines (approx) | Functions/Classes | Description |
|---------|----------------|-------------------|-------------|
| Guard + Logging Setup | 1-38 | Re-injection guard, logger fallback | Script initialization |
| Utility Functions | 39-162 | getClassName, stripUnicodeControl, findElementByNormalizedAriaLabel, shallowEqual, isFsbElement | Low-level helpers |
| DOMStateManager | 163-608 | class DOMStateManager | DOM diffing and state tracking |
| ElementCache + RefMap | 609-890 | class ElementCache, class RefMap, checkDocumentReady, getElementIndexes | Caching infrastructure |
| Visual Feedback | 895-2129 | class HighlightManager, class ProgressOverlay, class ViewportGlow, class ActionGlowOverlay, class ElementInspector | All UI overlay code |
| IFrame Support | 2130-2327 | getFrameAwareSelector, collectChildFramesDom | Cross-frame DOM access |
| Rich Text / Markdown | 2328-2900 | isCanvasBasedEditor, hasMarkdownFormatting, markdownToHTML, clipboardPasteHTML, isUniversalMessageInput, generateMessagingSelectors | Text handling for contenteditable |
| Selector Generation | 2900-3334 | findAlternativeSelectors, generateSelector, isClickable, sanitizeSelector, querySelectorWithShadow, resolveRef | CSS selector utilities |
| Accessibility Tree | 3335-4573 | getInputRole, getImplicitRole, computeAccessibleName, isElementActionable, checkElementVisibility, checkElementEnabled, checkElementStable, smartEnsureReady, ensureElementReady, waitForActionable (DEAD) | Accessibility inspection |
| Coordinate Fallback | 4578-4752 | validateCoordinates, ensureCoordinatesVisible, clickAtCoordinates | Coordinate-based clicking |
| Action Verification | 4754-5543 | captureActionState, EXPECTED_EFFECTS, detectChanges, verifyActionEffect, ActionRecorder, waitForPageStability | Pre/post action state comparison |
| Tool Functions (tools object) | 5544-9252 | tools.scroll, tools.click, tools.type, tools.keyPress, etc. (~25+ tools) | The core action execution engine |
| DOM Serialization | 9253-9530 | hashElement, isInViewport, slugify, generateSemanticElementId, class OptimizedDOMSerializer, validateSelectorUniqueness, validateXPathUniqueness | Element serialization |
| Advanced Selectors | 9530-10760 | AUTO_GENERATED_ID_PATTERN, filterDynamicClasses, generateSelectors, generateSelectorsForAction, inferElementPurpose, getRelationshipContext, generateElementDescription | Advanced selector strategies |
| Page Context Detection | 10760-11582 | detectPageContext, detectSearchNoResults, extractErrorMessages, isElementVisible, detectCompletionSignals, inferPageIntent, prioritizeElements, diffDOM, extractRelevantHTML | Page intelligence |
| Compact Snapshot | 11583-12050 | generateCompactSnapshot | Token-efficient DOM representation |
| Message Handler | 12050-12464 | chrome.runtime.onMessage listener, handleAsyncActions | Chrome messaging bridge |
| Site Explorer | 12465-12693 | collectExplorerData, explorerExtract*, explorerDetect* | Site reconnaissance |
| DOM Analysis Entry Point | 12693-13380 | analyzeDOMForAutomation (the main entry called by background) | Orchestrates DOM analysis |
| Error Handlers | 13382-13430 | window error/rejection listeners, re-injection guard close | Cleanup |

**Recommended Module Boundaries for Splitting:**

The Chrome content script `js` array executes files in order, and all files share the same execution context (variables are global within the isolated world). This means the split is purely organizational -- no import/export needed. Files listed earlier in the manifest are available to files listed later.

**Proposed file structure:**

```
content/
  00-guard.js            -- Re-injection guard open, logger setup (~38 lines)
  01-utils.js            -- getClassName, stripUnicodeControl, shallowEqual, isFsbElement (~125 lines)
  02-cache.js            -- ElementCache, RefMap, checkDocumentReady, getElementIndexes (~280 lines)
  03-visual-feedback.js  -- HighlightManager, ProgressOverlay, ViewportGlow, ActionGlowOverlay, ElementInspector (~1235 lines)
  04-selectors.js        -- generateSelector, querySelectorWithShadow, sanitizeSelector, findAlternativeSelectors, generateMessagingSelectors, advanced selector generation (~1600 lines)
  05-accessibility.js    -- Accessibility tree functions, element readiness checks, visibility, stability (~1240 lines)
  06-coordinates.js      -- Coordinate fallback utilities (~175 lines)
  07-verification.js     -- Action state capture, verification, diagnostics, ActionRecorder (~790 lines)
  08-tools.js            -- The tools object with all 25+ action functions (~3710 lines)
  09-dom-analysis.js     -- DOM serialization, page context, compact snapshot, e-commerce extraction (~2830 lines)
  10-iframe.js           -- IFrame support, cross-frame DOM (~200 lines)
  11-rich-text.js        -- Markdown, clipboard paste, contenteditable utilities (~575 lines)
  12-message-handler.js  -- chrome.runtime.onMessage, handleAsyncActions (~415 lines)
  13-site-explorer.js    -- Site explorer data collection (~230 lines)
  14-init.js             -- analyzeDOMForAutomation entry point, error handlers, guard close (~750 lines)
```

**manifest.json update:**
```json
"content_scripts": [{
  "js": [
    "utils/automation-logger.js",
    "content/00-guard.js",
    "content/01-utils.js",
    "content/02-cache.js",
    "content/03-visual-feedback.js",
    "content/04-selectors.js",
    "content/05-accessibility.js",
    "content/06-coordinates.js",
    "content/07-verification.js",
    "content/08-tools.js",
    "content/09-dom-analysis.js",
    "content/10-iframe.js",
    "content/11-rich-text.js",
    "content/12-message-handler.js",
    "content/13-site-explorer.js",
    "content/14-init.js"
  ],
  "matches": ["<all_urls>"]
}]
```

**Key ordering constraints (dependency graph):**
```
00-guard.js          -- must be first (opens re-injection guard)
01-utils.js          -- no deps (foundational)
02-cache.js          -- depends on 01 (uses getClassName)
03-visual-feedback.js-- depends on 01 (uses isFsbElement)
04-selectors.js      -- depends on 01, 02 (uses getClassName, elementCache)
05-accessibility.js  -- depends on 04 (uses querySelectorWithShadow, generateSelector)
06-coordinates.js    -- depends on 04 (uses querySelectorWithShadow)
07-verification.js   -- depends on 04, 05 (uses selector utilities, actionability checks)
08-tools.js          -- depends on 02, 03, 04, 05, 06, 07 (uses everything above)
09-dom-analysis.js   -- depends on 01, 02, 04, 05 (uses selectors, cache, utils)
10-iframe.js         -- depends on 04 (uses selectors)
11-rich-text.js      -- depends on 04 (uses selectors)
12-message-handler.js-- depends on 03, 08, 09, 13 (dispatches to tools, DOM analysis)
13-site-explorer.js  -- standalone (only uses basic DOM APIs)
14-init.js           -- must be last (closes re-injection guard, sets up error handlers)
```

**Complexity:** High (mechanical but requires careful extraction and testing)
**Risk:** Medium -- the extraction is safe because all files share the same global scope within the content script isolated world. The main risk is accidentally splitting in the middle of a closure or missing a dependency.

**Sources:**
- [Chrome Content Scripts docs](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- "Files are injected in the order they appear in this array" and share the same isolated world
- [Chrome Manifest content_scripts reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- js array specification

---

### TS-5: Duplicate Code Elimination

**Why Expected:** The codebase has at least one confirmed duplicate: `getClassName()` is defined in content.js (line 49) and an equivalent `getClassNameSafe()` exists in utils/action-verification.js (line 7). Both do the same thing (handle SVGAnimatedString). Duplicated utility functions diverge over time and create confusion about which version to use.

**Identified duplicates:**
1. `getClassName()` (content.js:49) vs `getClassNameSafe()` (action-verification.js:7) -- identical logic
2. `generateSelector()` defined twice in content.js itself (line 2986 and line 10759) -- the second one at line 10759 is a simpler version. This is likely a naming collision where the second definition shadows the first within the same file scope.

**What to Do:**
- Consolidate to a single canonical `getClassName()` in the utilities module
- Resolve the dual `generateSelector` definitions -- rename the simpler one (e.g., `generateBasicSelector` which already exists at line 10526) or remove it if it duplicates `generateBasicSelector`

**Complexity:** Low
**Risk:** Low (but requires verifying which callers use which version)

---

## Differentiators

Features that make this cleanup especially valuable beyond basic hygiene. These transform a tedious chore into a genuine improvement in developer velocity and code quality.

---

### D-1: Establish Clear Module Contracts at Split Boundaries

**Value Proposition:** Splitting content.js into 14 files is mechanical. The real value comes from defining what each module is responsible for and what it exposes. If the split just moves code around without clarifying contracts, the next developer still has to read all 14 files to understand how things work.

**What to Do:**
- Each file gets a header comment block declaring:
  - Purpose (one sentence)
  - Dependencies (which other content/ files it needs)
  - Exports (what globals it defines for downstream files)
  - Does NOT depend on (explicit exclusions to prevent coupling creep)

Example:
```javascript
/**
 * content/04-selectors.js -- CSS selector generation and querying
 *
 * Dependencies: 01-utils.js (getClassName, stripUnicodeControl), 02-cache.js (elementCache)
 * Provides: generateSelector, querySelectorWithShadow, querySelectorAllWithShadow,
 *           sanitizeSelector, findAlternativeSelectors, resolveRef
 * Does NOT use: tools object, HighlightManager, chrome.runtime messaging
 */
```

**Complexity:** Low (documentation, done during the split)
**Risk:** None

---

### D-2: Named Constants for All Magic Numbers

**Value Proposition:** Beyond `maxCacheSize`, content.js is full of magic numbers that are tuning parameters or thresholds. Extracting them to named constants at the top of each module makes the codebase self-documenting and tunable.

**Identified magic numbers worth extracting:**

| Current Location | Value | Proposed Name | Context |
|-----------------|-------|---------------|---------|
| ElementCache constructor (L619) | 100 | DEFAULT_ELEMENT_CACHE_SIZE | Max cached selectors |
| ElementCache MutationObserver (L630) | 20 | MUTATION_THRESHOLD_FOR_INVALIDATION | Mutations before full cache clear |
| waitForActionable (L4437) | 300 | DOM_STABLE_THRESHOLD_MS | Time with no mutations = stable |
| waitForActionable (L4478) | 500 | FAST_FAIL_STABLE_MS | DOM stable + no loading = fail fast |
| tools.scroll (L5557) | 300 | SCROLL_SETTLE_MS | Wait after scroll |
| click coordinate fallback | Various | CLICK_RETRY_DELAY_MS | Wait between click attempts |
| generateCompactSnapshot (L11592) | 80 | DEFAULT_MAX_SNAPSHOT_ELEMENTS | Max elements in AI snapshot |
| extractEcommerceProducts (L11339) | 20 | MAX_ECOMMERCE_PRODUCTS | Product extraction limit |
| HTML truncation | 1000 | MAX_HTML_CONTEXT_LENGTH | HTML context for AI |

**Complexity:** Low-Medium (find-and-replace with testing)
**Risk:** Very Low

---

### D-3: Consistent Error Handling Patterns Across Modules

**Value Proposition:** After splitting, each module should follow the same error handling pattern. Currently, error handling is inconsistent -- some functions return `{ success: false, error: ... }`, some throw, some silently swallow errors, some log and continue. Standardizing during the split prevents the modules from developing divergent conventions.

**Recommended Pattern for content script modules:**
- Tool functions (in tools object): Always return `{ success: boolean, error?: string, ... }` -- never throw
- Utility functions: Throw on programmer errors (bad arguments), return null/false on expected failures (element not found)
- Classes: Throw in constructor on invalid config, return values in methods

**Complexity:** Medium (requires auditing error handling in each module)
**Risk:** Low

---

### D-4: Add JSDoc @fileoverview and Function-Level Type Hints

**Value Proposition:** When splitting into 14 files, adding `@fileoverview` and consistent `@param`/`@returns` JSDoc enables IDE navigation and autocomplete. The existing codebase has partial JSDoc (some functions documented, many not). Completing it during the split means the new modular structure is immediately navigable.

**Complexity:** Medium (documentation pass on each new module)
**Risk:** None

---

## Anti-Features

Things to deliberately NOT do during this cleanup. These are common mistakes that turn a focused tech debt sprint into a scope-creeping rewrite.

---

### AF-1: Do NOT Introduce a Build System / Bundler

**Why Avoid:** The temptation when splitting files is to add webpack/rollup/esbuild to bundle them back together. This is wrong for this cleanup because:

- Chrome Manifest V3 natively supports multiple content script files in order -- no bundler needed
- Adding a build step changes the development workflow for all contributors
- Build tooling introduces its own maintenance burden (config files, dependency updates, sourcemap debugging)
- The current zero-build-step workflow is a feature, not a limitation, for a Chrome Extension

**What to Do Instead:** Use the manifest.json `js` array for file ordering. Each file is plain JavaScript that runs in the content script isolated world. No imports, no exports, no build step.

**Exception:** If the team later wants TypeScript, a bundler becomes necessary. But that is a separate decision, not part of this cleanup.

---

### AF-2: Do NOT Refactor the tools Object API

**Why Avoid:** The `tools` object (lines 5544-9252, ~3700 lines) is the core action execution engine. Every tool function has a contract with the AI prompt engineering layer (the AI generates action names matching tool keys) and with the message handler. Changing tool function signatures, renaming tools, or restructuring the tools object would require coordinated changes in:

- ai-integration.js (prompt templates reference tool names)
- background.js (action dispatch)
- The AI's learned behavior (models have been tuned against current tool names)

The tools object should be extracted to its own file AS-IS. Refactoring its API is a separate, much larger effort.

---

### AF-3: Do NOT Convert to ES Modules / import-export

**Why Avoid:** Chrome content scripts do not natively support static ES module `import`/`export`. Dynamic `import()` works but requires files to be listed in `web_accessible_resources`, which exposes them to web pages. This changes the security model.

More importantly, the current codebase relies on all content script files sharing a single global scope in the isolated world. Converting to modules would mean every cross-file reference needs explicit imports, which is a massive mechanical change unrelated to the cleanup goals.

**What to Do Instead:** Continue using the shared global scope pattern. Prefix module-internal functions with underscore or use revealing module pattern (IIFE) if encapsulation is needed later.

---

### AF-4: Do NOT Add chrome.storage Reads to Content Script Initialization

**Why Avoid:** It is tempting to read configuration from `chrome.storage` at content script load time to configure values like `maxCacheSize`. But `chrome.storage` is async-only, and content scripts execute their initialization synchronously. Adding async storage reads to initialization creates:

- Race conditions (script runs before config loads)
- Complexity (need to defer all initialization behind an async boundary)
- Performance cost (extra storage read on every page load)

**What to Do Instead:** For content script tuning parameters, use hardcoded named constants (see D-2). If values truly need to be configurable at runtime, have the background script send them via `chrome.runtime.sendMessage` after loading config, and update the content script's state in response. This is already the pattern FSB uses for session management.

---

### AF-5: Do NOT Attempt to Split the DOMStateManager Class Out of content.js

**Why Avoid:** There is already a `utils/dom-state-manager.js` file that defines a `DOMStateManager` class. Content.js also defines its own `DOMStateManager` class (lines 163-608, ~445 lines) with different implementation details. Attempting to reconcile or merge these during cleanup is scope creep -- it requires understanding which version is loaded when, which methods differ, and whether both are needed.

**What to Do Instead:** During the split, move the content.js `DOMStateManager` to its own content script file. Add a TODO comment noting the duplication with `utils/dom-state-manager.js`. Reconciliation is a separate task.

---

### AF-6: Do NOT Optimize ElementCache Eviction Strategy

**Why Avoid:** The current FIFO eviction (remove first inserted key when cache is full) is simple and correct. It is tempting to implement LRU, LFU, or score-based eviction. But cache eviction strategy is a performance optimization question that requires profiling data, not a tech debt cleanup item. Without evidence that the eviction strategy is causing cache misses that impact automation success, changing it is premature optimization.

**What to Do Instead:** Make `maxCacheSize` configurable (TS-3) so it CAN be tuned. Leave eviction strategy for a future performance-focused milestone with profiling data.

---

## Feature Dependencies

```
TS-1 (dead code removal)     --> standalone, do first
TS-2 (constructor bug fix)   --> standalone, do anytime
TS-3 (configurable cache)    --> standalone, trivial
TS-5 (duplicate elimination) --> should be done BEFORE or DURING TS-4
TS-4 (content script split)  --> depends on TS-1, TS-3, TS-5 being done first
                                 (remove dead code and fix duplicates before splitting)
D-1 (module contracts)       --> done during TS-4
D-2 (named constants)        --> done during TS-4
D-3 (error handling)         --> done during or after TS-4
D-4 (JSDoc completion)       --> done during or after TS-4
```

**Critical ordering insight:** Do TS-1, TS-2, TS-3, TS-5 BEFORE TS-4. It is much easier to remove dead code and fix bugs in a single file than to do it after splitting into 14 files. The split should operate on clean code.

---

## MVP Recommendation

For a focused tech debt cleanup milestone:

**Must do (table stakes):**
1. TS-1: Remove `waitForActionable` dead code (low effort, immediate value)
2. TS-2: Fix `UniversalProvider` constructor args in memory-extractor.js (bug fix, one line)
3. TS-3: Make `ElementCache.maxCacheSize` a named constant and constructor parameter (low effort)
4. TS-5: Eliminate duplicate `getClassName`/`getClassNameSafe` and resolve dual `generateSelector` (low effort)
5. TS-4: Split content.js into modules following the proposed boundary map (high effort, high value)

**Should do during split (differentiators):**
6. D-1: Module contract headers in each new file
7. D-2: Named constants for magic numbers (at least in the modules being split)

**Defer to later:**
- D-3: Error handling standardization (can be done incrementally)
- D-4: Full JSDoc completion (can be done incrementally)

---

## Confidence Assessment

| Item | Confidence | Rationale |
|------|------------|-----------|
| TS-1: waitForActionable is dead | HIGH | grep confirms zero call sites; replacement functions exist |
| TS-2: Constructor bug | HIGH | Direct code inspection; constructor signature verified |
| TS-3: Config pattern recommendation | HIGH | Chrome Storage API docs confirm async-only; constructor param is correct pattern |
| TS-4: Module boundary map | HIGH | Section comments and function analysis from actual codebase; Chrome docs confirm shared scope |
| TS-5: Duplicates identified | HIGH | Direct code inspection |
| D-1 through D-4 | HIGH | Standard engineering practices, no uncertainty |
| AF-1 through AF-6 | HIGH | Based on Chrome Extension architecture constraints (verified with official docs) |

---

## Sources

- [Chrome Content Scripts documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- execution order, isolated world, shared scope
- [Chrome Manifest content_scripts reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- js array specification
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- async access, storage limits, content script access
- [Knip dead code detection](https://knip.dev/) -- dead code detection methodology
- [HackerNoon: Remove Dead Code](https://hackernoon.com/refactoring-021-remove-dead-code) -- safe removal practices
- [Chrome Extension File Structure Guide (2025)](https://www.extensionradar.com/blog/chrome-extension-file-structure) -- organization best practices
- Direct codebase analysis of FSB v9.0.2 content.js (13,429 lines), config.js, manifest.json, memory-extractor.js, universal-provider.js, background.js, action-verification.js
