# Phase 4: Content Script Modularization - Research

**Researched:** 2026-02-21
**Domain:** Chrome Extension MV3 content script architecture, file splitting, programmatic injection
**Confidence:** HIGH

## Summary

This research investigates how to decompose the 13,429-line `content.js` monolith into separate module files under a `content/` directory, using the `window.FSB` namespace pattern for inter-module communication and `chrome.scripting.executeScript` for programmatic injection.

The key technical foundation is confirmed: **all content scripts from the same extension share a single global scope per frame** (MDN documentation, verified). This means files injected via `chrome.scripting.executeScript({ files: [...] })` execute sequentially in array order and can access each other's variables, functions, and classes. The `window.FSB` namespace pattern is the correct approach for organizing shared state.

The primary risk areas are: (1) the re-injection guard must be adapted for multi-file loading, (2) three injection points in `background.js` must all switch to a shared file list constant, (3) a duplicate `generateSelector` function at lines 2986 and 10759 must be resolved, and (4) module load order must respect dependency chains (classes/utilities before consumers).

**Primary recommendation:** Extract content.js into 8-10 module files under `content/`, with a thin `content/init.js` bootstrap that sets up the `window.FSB` namespace, re-injection guard, and ready signal. Each module attaches its exports to `window.FSB`. Background.js reads the file list from a single constant.

## Standard Stack

### Core (Already in Use -- No New Libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chrome.scripting API | MV3 | Programmatic content script injection | Chrome built-in, already used at 3 injection points |
| window.FSB namespace | N/A | Module communication pattern | Decision from STATE.md -- shared scope in isolated world confirmed |
| ISOLATED world | Default | Content script execution environment | Default Chrome behavior, extension already uses it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| automation-logger.js | Current | Logging dependency, must load before content modules | Already injected first in executeScript files array |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| window.FSB namespace | ES modules (import/export) | ES modules require `type: "module"` in manifest and change scoping semantics; not compatible with current programmatic injection pattern. Decision locked: use window.FSB. |
| window.FSB namespace | Bare globals (current approach) | Bare globals pollute the isolated world scope and are harder to track. Namespace provides organization. Decision locked. |
| Programmatic injection | manifest.json content_scripts | Static injection cannot be conditional, cannot control timing, harder to update file lists. Decision locked: use programmatic injection. |

**Installation:** No new dependencies. This is a file reorganization.

## Architecture Patterns

### Recommended Project Structure

```
content/
  init.js              # Re-injection guard, namespace setup, automationLogger fallback, ready signal, error handlers
  dom-state.js         # DOMStateManager class, ElementCache class, RefMap class, checkDocumentReady, element indexes
  utils.js             # getClassName, stripUnicodeControl, findElementByNormalizedAriaLabel, isFsbElement, shallowEqual, sanitizeSelector
  selectors.js         # generateSelector (CANONICAL -- resolves duplicate), generateSelectors, generateSelectorsForAction, generateBasicSelector, selector validation, ID/class filtering patterns
  visual-feedback.js   # HighlightManager, ProgressOverlay, ViewportGlow, ActionGlowOverlay, ElementInspector, promoteToTopLayer/demoteFromTopLayer
  accessibility.js     # getInputRole, getImplicitRole, computeAccessibleName, getARIARelationships, isElementActionable, all element readiness/visibility/stability checks
  actions.js           # tools object (all 25+ tool functions), coordinate utilities, action verification, diagnostics, ActionRecorder
  dom-analysis.js      # hashElement, isInViewport, OptimizedDOMSerializer, element purpose/relationship/description, diffDOM, extractRelevantHTML, detectPageContext, completionSignals, ecommerce extraction, getStructuredDOM, generateCompactSnapshot
  messaging.js         # handleAsyncMessage, handleBackgroundMessage, chrome.runtime.onMessage listener, markdown/clipboard helpers, iframe support, messaging selectors, alternative selectors
  lifecycle.js         # MutationObserver setup, SPA navigation detection, background port connection, body observation init, collectExplorerData, directLogin
```

### Pattern 1: window.FSB Namespace Bootstrap

**What:** First loaded file creates the namespace; subsequent files attach to it.
**When to use:** Every content module file.
**Example:**

```javascript
// content/init.js (loaded FIRST)
// Re-injection guard -- if already loaded, skip ALL subsequent files
if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  // Set flag so subsequent files can check and skip
  window.__FSB_SKIP_INIT__ = true;
} else {
  window.__FSB_CONTENT_SCRIPT_LOADED__ = true;
  window.__FSB_SKIP_INIT__ = false;

  // Create namespace
  window.FSB = window.FSB || {};

  // Logger fallback (automation-logger.js should already be loaded)
  window.FSB.logger = window.automationLogger || { /* fallback stubs */ };
  window.FSB.sessionId = null;
}
```

```javascript
// content/utils.js (loaded after init.js)
(function() {
  if (window.__FSB_SKIP_INIT__) return;

  const FSB = window.FSB;

  function getClassName(element) {
    // ... existing implementation unchanged ...
  }

  function stripUnicodeControl(str) {
    // ... existing implementation unchanged ...
  }

  // Attach to namespace
  FSB.getClassName = getClassName;
  FSB.stripUnicodeControl = stripUnicodeControl;
  // etc.
})();
```

```javascript
// content/selectors.js (loaded after utils.js)
(function() {
  if (window.__FSB_SKIP_INIT__) return;

  const FSB = window.FSB;

  // Use shared utilities from FSB namespace
  const getClassName = FSB.getClassName;

  function generateSelector(element) {
    // ... CANONICAL version (line 2986 version -- more thorough) ...
  }

  FSB.generateSelector = generateSelector;
  FSB.generateSelectors = generateSelectors;
})();
```

### Pattern 2: Shared File List Constant in background.js

**What:** Single constant defines the ordered file list for all injection points.
**When to use:** background.js -- replaces all hardcoded file arrays.
**Example:**

```javascript
// background.js (top of file, near other constants)
const CONTENT_SCRIPT_FILES = [
  'utils/automation-logger.js',
  'content/init.js',
  'content/utils.js',
  'content/dom-state.js',
  'content/selectors.js',
  'content/visual-feedback.js',
  'content/accessibility.js',
  'content/actions.js',
  'content/dom-analysis.js',
  'content/messaging.js',
  'content/lifecycle.js'
];

// Injection point 1 (line ~1636): Main injection with all options
await chrome.scripting.executeScript({
  target: { tabId, frameIds: [0] },
  files: CONTENT_SCRIPT_FILES,
  world: 'ISOLATED',
  injectImmediately: true
});

// Injection point 2 (line ~8104): New tab injection
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: CONTENT_SCRIPT_FILES
});
```

### Pattern 3: Re-injection Guard for Multi-File Loading

**What:** Guard in init.js sets a skip flag; all other files check it and bail out immediately.
**When to use:** Every content module file must check `window.__FSB_SKIP_INIT__` at the top.
**Why critical:** Chrome re-injects ALL files on navigation. Without this guard, duplicate message handlers, observers, and overlays are created.

```javascript
// Every module file starts with:
(function() {
  if (window.__FSB_SKIP_INIT__) return;
  // ... module code ...
})();
```

### Pattern 4: Internal References Use Namespace

**What:** Functions within a module call other functions from the namespace, not bare names.
**When to use:** Cross-module calls. Within the same module, direct function calls are fine.
**Example:**

```javascript
// In dom-analysis.js, calling generateSelector from selectors.js:
const selector = FSB.generateSelector(element);

// Within the same module (e.g., two functions both in actions.js):
// Can use direct calls since they share the same IIFE scope
const result = clickAtCoordinates(params);
```

### Anti-Patterns to Avoid

- **Bare global function declarations across modules:** `function foo()` in the global scope causes "already declared" errors on re-injection. Wrap in IIFE + namespace pattern.
- **Circular dependencies between modules:** Module A requires B which requires A. The file load order makes this impossible. Solution: put co-dependent code in the same module.
- **Re-registering message listeners:** `chrome.runtime.onMessage.addListener(handleBackgroundMessage)` must only execute once. The named function reference helps Chrome dedupe, but the guard is still essential.
- **Storing module-scoped state outside the namespace:** State like `currentSessionId`, `lastActionStatusText`, `backgroundPort` must live on `window.FSB` so all modules can access/modify it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module bundling | Custom build pipeline (webpack, rollup) | Direct file concatenation via chrome.scripting.executeScript files array | Build tools add complexity for a pure file-split refactor; Chrome handles load order natively |
| Dependency injection framework | Custom DI container | window.FSB namespace with explicit attach pattern | The namespace IS the DI -- simple, debuggable, zero overhead |
| File list synchronization | Multiple hardcoded arrays in different functions | Single CONTENT_SCRIPT_FILES constant at top of background.js | Exactly matches Success Criterion #5 |
| Re-injection prevention | Complex per-module guards with versions | Single `__FSB_CONTENT_SCRIPT_LOADED__` flag + `__FSB_SKIP_INIT__` propagation | Current pattern works; just extend it to multi-file |

**Key insight:** This is a file-split refactor, not an architecture change. The existing code is correct and working. The goal is to move existing code into separate files with minimal changes (primarily replacing bare function references with `FSB.functionName` for cross-module calls).

## Common Pitfalls

### Pitfall 1: Duplicate generateSelector Functions

**What goes wrong:** Two different `generateSelector` implementations exist at lines 2986 and 10759. The line-2986 version is more thorough (accessibility-first, ARIA, role-based selectors). The line-10759 version is simpler (just ID, data-testid, aria-label, class, nth-child). Both are called from different parts of the code.
**Why it happens:** Organic code growth -- the advanced version was written later but the old one was never removed.
**How to avoid:** During extraction to `content/selectors.js`, keep ONLY the line-2986 version (the comprehensive one) as `FSB.generateSelector`. The line-10759 version is strictly weaker and can be replaced. Verify all call sites (lines 2932, 2946, 2970, 10654, 10893, 11381, 11395) work with the comprehensive version.
**Warning signs:** If any call site relied on the simpler version's `:contains()` pseudo-selector behavior (line 10795), that's a CSS pseudo-class Chrome doesn't actually support in `querySelector`. It's dead code already.

### Pitfall 2: Variable Hoisting with var vs. let/const

**What goes wrong:** The current content.js uses `var` for some variables (e.g., `var automationLogger`, `var currentSessionId`). When splitting into IIFEs, `var` declarations inside an IIFE are scoped to that IIFE, not hoisted to the global scope.
**Why it happens:** `var` in a function/IIFE is function-scoped, unlike `var` at the top level which is global.
**How to avoid:** All shared state must be explicitly attached to `window.FSB`. Do NOT rely on `var` hoisting. Replace shared `var` declarations with `window.FSB.variableName = value`.
**Warning signs:** `ReferenceError: variableName is not defined` in console after split.

### Pitfall 3: Class Instance Singletons Must Be on Namespace

**What goes wrong:** Several singletons are created at module scope: `domStateManager`, `elementCache`, `refMap`, `highlightManager`, `progressOverlay`, `viewportGlow`, `actionGlowOverlay`, `elementInspector`, `actionRecorder`. If created inside an IIFE, they're only accessible within that IIFE.
**Why it happens:** IIFE scoping hides variables from other modules.
**How to avoid:** Attach all singletons to `window.FSB` immediately after creation:
```javascript
const domStateManager = new DOMStateManager();
FSB.domStateManager = domStateManager;
```
**Warning signs:** `TypeError: Cannot read property 'method' of undefined` when a function in one module tries to use a singleton from another.

### Pitfall 4: Incomplete Injection Point Updates

**What goes wrong:** Background.js has injection points at lines ~1636, ~8104, and potentially more. Missing even one causes content scripts to load partially, producing cryptic runtime errors.
**Why it happens:** Find-and-replace misses one injection point, especially the new-tab injection at line 8104 which currently injects `['content.js']` without `automation-logger.js`.
**How to avoid:** (1) Create the `CONTENT_SCRIPT_FILES` constant, (2) search for ALL `executeScript` calls in background.js, (3) replace every `files:` array referencing `content.js`, (4) verify no other files reference the old path.
**Warning signs:** "automation-logger.js was not loaded" warning in console on new tabs. Or partial FSB initialization.

### Pitfall 5: IIFE Return vs. Early Return

**What goes wrong:** Using `return` inside an IIFE to bail out on re-injection guard check. This works but must be at the IIFE level, not nested inside another function.
**Why it happens:** Misplacing the guard check inside a nested function instead of at the IIFE top level.
**How to avoid:** Guard check must be the very first statement in each IIFE:
```javascript
(function() {
  if (window.__FSB_SKIP_INIT__) return; // CORRECT: returns from IIFE
  // ... rest of module
})();
```

### Pitfall 6: Message Handler Registration Timing

**What goes wrong:** The `chrome.runtime.onMessage.addListener(handleBackgroundMessage)` call at line 13108 must happen exactly once, after all tool functions are defined. If it runs before `tools` object exists, action execution fails.
**Why it happens:** Load order issue -- messaging.js loads before actions.js.
**How to avoid:** Either (a) put the listener registration in lifecycle.js (loaded last), or (b) put it in messaging.js but ensure actions.js loads first by file order. Recommended: option (a) -- lifecycle.js is the "boot" module that wires everything together after all definitions are in place.

## Code Examples

### Example 1: Complete init.js Bootstrap

```javascript
// content/init.js -- First content module loaded
// Re-injection guard (preserves existing behavior from content.js lines 1-9)
if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  window.__FSB_SKIP_INIT__ = true;
} else {
  window.__FSB_CONTENT_SCRIPT_LOADED__ = true;
  window.__FSB_SKIP_INIT__ = false;

  // Create namespace
  window.FSB = {};

  // Logger setup (automation-logger.js loaded before this file)
  window.FSB.logger = window.automationLogger || {
    log: function() {},
    error: function(msg, data) { console.error('[FSB Fallback]', msg, data || ''); },
    warn: function(msg, data) { console.warn('[FSB Fallback]', msg, data || ''); },
    info: function(msg, data) { console.log('[FSB Fallback]', msg, data || ''); },
    debug: function() {},
    logComm: function() {},
    logInit: function() {},
    logDOMOperation: function() {},
    logAction: function() {},
    logAI: function() {},
    logTiming: function() {},
    logNavigation: function() {},
    logSessionStart: function() {},
    logSessionEnd: function() {},
    logServiceWorker: function() {},
    getSessionLogs: function() { return []; },
    saveSession: function() { return Promise.resolve(false); },
    persistLogs: function() {},
    recordAction: function() {},
    logActionExecution: function() {}
  };

  if (!window.automationLogger) {
    console.warn('[FSB Content] automation-logger.js was not loaded. Using fallback logger.');
  }

  // Shared mutable state
  window.FSB.sessionId = null;
  window.FSB.lastActionStatusText = null;
  window.FSB._overlayWatchdogTimer = null;
}
```

### Example 2: CONTENT_SCRIPT_FILES Constant for background.js

```javascript
// Top of background.js, after importScripts
const CONTENT_SCRIPT_FILES = [
  'utils/automation-logger.js',
  'content/init.js',
  'content/utils.js',
  'content/dom-state.js',
  'content/selectors.js',
  'content/visual-feedback.js',
  'content/accessibility.js',
  'content/actions.js',
  'content/dom-analysis.js',
  'content/messaging.js',
  'content/lifecycle.js'
];
```

### Example 3: Module with Cross-Module Dependencies

```javascript
// content/dom-analysis.js -- depends on selectors.js, utils.js, dom-state.js
(function() {
  if (window.__FSB_SKIP_INIT__) return;

  const FSB = window.FSB;
  const logger = FSB.logger;

  // Local aliases for frequently-used cross-module functions
  const generateSelector = FSB.generateSelector;
  const generateSelectors = FSB.generateSelectors;
  const isInViewport = FSB.isInViewport;

  function detectPageContext() {
    // ... existing implementation, references use local aliases or FSB.xxx ...
  }

  function getStructuredDOM(options) {
    // ... existing implementation ...
    // Internal calls to functions in this module use direct names
    // Cross-module calls use FSB.xxx
  }

  // Export to namespace
  FSB.detectPageContext = detectPageContext;
  FSB.getStructuredDOM = getStructuredDOM;
  FSB.generateCompactSnapshot = generateCompactSnapshot;
  // etc.
})();
```

## Detailed Module Boundary Map

Based on line-by-line analysis of content.js, here is the precise extraction plan:

### Module 1: content/init.js (Lines 1-38, 13382-13429)
- Re-injection guard
- Namespace creation
- Logger fallback setup
- Shared state initialization (sessionId, lastActionStatusText, overlayWatchdogTimer)
- Global error handler (`window.addEventListener('error', ...)`)
- Global promise rejection handler (`window.addEventListener('unhandledrejection', ...)`)

### Module 2: content/utils.js (Lines 42-161)
- `currentSessionId` variable (moved to FSB.sessionId)
- `getClassName()`
- `stripUnicodeControl()`
- `findElementByNormalizedAriaLabel()`
- `FSB_HOST_IDS` set
- `isFsbElement()`
- `shallowEqual()`

### Module 3: content/dom-state.js (Lines 163-893)
- `DOMStateManager` class + singleton
- `ElementCache` class + singleton
- `RefMap` class + singleton
- `checkDocumentReady()`
- `previousDOMState`, `domStateCache` variables
- Element index functions (`getElementIndexes`, `invalidateElementIndexes`)

### Module 4: content/selectors.js (Lines 2906-3179, 9465-9610, 9803-9921, 10526-10561)
- `findAlternativeSelectors()`
- `generateSelector()` -- CANONICAL version from line 2986 only (remove duplicate at 10759)
- `isClickable()`
- `sanitizeSelector()`
- `querySelectorWithShadow()`
- `resolveRef()`
- `querySelectorAllWithShadow()`
- `validateSelectorUniqueness()`
- `validateXPathUniqueness()`
- `isAutoGeneratedId()`
- `filterDynamicClasses()`
- `generateSelectors()`
- `generateSelectorsForAction()`
- `isInShadowDOM()`
- `generateBasicSelector()`

### Module 5: content/visual-feedback.js (Lines 895-2129)
- `HighlightManager` class + singleton
- `promoteToTopLayer()`, `demoteFromTopLayer()`
- `ProgressOverlay` class + singleton
- `ViewportGlow` class + singleton
- `ActionGlowOverlay` class + singleton
- `ElementInspector` class + singleton

### Module 6: content/accessibility.js (Lines 3335-4576)
- `getInputRole()`
- `getImplicitRole()`
- `computeAccessibleName()`
- `getARIARelationships()`
- `isElementActionable()`
- `checkElementVisibility()`
- `checkElementEnabled()`
- `checkElementStable()`
- `detectCodeEditor()`
- `checkElementReceivesEvents()`
- `checkElementEditable()`
- `scrollIntoViewIfNeeded()`
- `performQuickReadinessCheck()`
- `smartEnsureReady()`
- `ensureElementReady()`
- `waitForActionable()` -- Note: this is dead code per Phase 5, but keep it for now

### Module 7: content/actions.js (Lines 4578-9252)
- Coordinate utilities (`validateCoordinates`, `ensureCoordinatesVisible`, `clickAtCoordinates`)
- Action state capture and verification (`captureActionState`, `detectChanges`, `verifyActionEffect`)
- `EXPECTED_EFFECTS` constant
- `DIAGNOSTIC_MESSAGES` constant
- `generateDiagnostic()`, `captureElementDetails()`
- `ActionRecorder` class + singleton
- `detectActionOutcome()`
- `waitForPageStability()`
- `tools` object (all 25+ tool functions: scroll, click, type, navigate, etc.)

### Module 8: content/dom-analysis.js (Lines 9254-11582)
- `hashElement()`
- `isInViewport()`, `isElementInViewport()`
- `slugify()`, `generateSemanticElementId()`
- `OptimizedDOMSerializer` class
- `inferElementPurpose()`
- `getRelationshipContext()`
- `generateElementDescription()`
- `getColorName()`, `getElementCluster()`, `getVisualProperties()`, `getShadowPath()`
- `prioritizeElements()`
- `diffDOM()`
- `extractRelevantHTML()` -- this contains the DUPLICATE generateSelector at 10759, remove it
- `detectPageContext()`
- `detectSearchNoResults()`, `extractErrorMessages()`
- `isElementVisible()`
- `detectCompletionSignals()`
- `inferPageIntent()`
- `extractEcommerceProducts()`
- `calculateElementScore()`
- `getFilteredElements()`
- `generateCompactSnapshot()`
- `getStructuredDOM()`

### Module 9: content/messaging.js (Lines 2130-2823, 12248-12463, 12804-13108)
- Iframe support (isInIframe, frameId, frameContext)
- `getFrameAwareSelector()`
- `collectChildFramesDom()`
- Markdown utilities (`isCanvasBasedEditor`, `hasMarkdownFormatting`, `markdownToHTML`, `applyInlineFormatting`, `clipboardPasteHTML`, `stripMarkdown`)
- `isUniversalMessageInput()`
- `generateMessagingSelectors()`
- `handleAsyncMessage()`
- `handleBackgroundMessage()`
- `chrome.runtime.onMessage.addListener(handleBackgroundMessage)`

### Module 10: content/lifecycle.js (Lines 13110-13380, 12465-12693)
- DOM mutation observer setup (isSignificantMutation, observer creation, body observation)
- SPA navigation detection (Google-specific pushState/replaceState hooks)
- Background port connection (`establishBackgroundConnection`)
- Ready signal IIFE
- `collectExplorerData()` and explorer helper functions
- `executeDirectLogin()`

## Dependency Load Order (Critical)

Files MUST be loaded in this exact order:

```
1. utils/automation-logger.js  -- External dependency, defines window.automationLogger
2. content/init.js             -- Guard + namespace setup (depends on: nothing)
3. content/utils.js            -- Basic utilities (depends on: init.js)
4. content/dom-state.js        -- State management classes (depends on: utils.js for shallowEqual)
5. content/selectors.js        -- Selector generation (depends on: utils.js for getClassName)
6. content/visual-feedback.js  -- UI overlays (depends on: utils.js for isFsbElement)
7. content/accessibility.js    -- Element checks (depends on: selectors.js, utils.js)
8. content/actions.js          -- Tool functions (depends on: selectors.js, accessibility.js, visual-feedback.js, dom-state.js)
9. content/dom-analysis.js     -- DOM serialization (depends on: selectors.js, accessibility.js, dom-state.js)
10. content/messaging.js       -- Message handlers (depends on: actions.js [tools], dom-analysis.js, visual-feedback.js, dom-state.js)
11. content/lifecycle.js       -- Observers and boot (depends on: messaging.js, visual-feedback.js, dom-state.js)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic content.js | Multi-file with namespace pattern | This phase | Maintainability, readability, enables Phase 5 dead code removal |
| Bare global var declarations | IIFE + window.FSB namespace | This phase | Prevents re-injection bugs, cleaner scope |
| Hardcoded file arrays in background.js | Single CONTENT_SCRIPT_FILES constant | This phase | Single source of truth for injection |
| Duplicate generateSelector | Single canonical version | This phase | Consistency, reduced confusion |

**Deprecated/outdated:**
- `generateSelector` at line 10759: Weaker duplicate, uses unsupported `:contains()` pseudo-class. Remove, keep line 2986 version.
- The `window.__FSB_CONTENT_SCRIPT_LOADED__` wrapping the ENTIRE file in an if/else: Still needed but moves to init.js with a simpler skip-flag propagation to other files.

## Open Questions

1. **background.js injection point at line 8104 is missing automation-logger.js**
   - What we know: Line 1636 injects `['utils/automation-logger.js', 'content.js']` but line 8104 injects only `['content.js']`. This means new tabs may not have the logger.
   - What's unclear: Whether this is intentional (the tab may already have it) or a bug.
   - Recommendation: The `CONTENT_SCRIPT_FILES` constant approach fixes this automatically -- all injection points use the same complete file list. The re-injection guard prevents double-loading.

2. **Cross-module function reference count**
   - What we know: Functions like `generateSelector`, `getClassName`, `querySelectorWithShadow` are called from many locations across what will become different modules.
   - What's unclear: The exact count of cross-module vs. intra-module references.
   - Recommendation: During implementation, create local aliases at the top of each IIFE (`const generateSelector = FSB.generateSelector;`) for readability and to minimize code changes from the original.

3. **The `tools` object references to cross-module functions**
   - What we know: The `tools` object (25+ functions) calls many utility and readiness-check functions that will be in other modules.
   - What's unclear: Whether all tool functions should remain in a single file or be further split.
   - Recommendation: Keep all tool functions in a single `actions.js` file. They are tightly coupled and splitting further adds complexity without benefit. Use namespace aliases for external dependencies.

## Sources

### Primary (HIGH confidence)
- MDN Content Scripts documentation (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts) -- Confirmed: "There is only one global scope per frame, per extension. This means that variables from a content script can be accessed by any other content scripts, regardless of how the content script was loaded."
- Chrome Extensions content scripts documentation (https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- Confirmed: Isolated world behavior, file injection order guarantee
- Chrome scripting API reference (https://developer.chrome.com/docs/extensions/reference/api/scripting) -- Confirmed: executeScript files parameter injects in array order
- Direct code analysis of content.js (13,429 lines) and background.js injection points

### Secondary (MEDIUM confidence)
- Chrome manifest content_scripts reference (https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- Confirmed: JS files injected in array order
- Chrome scripting blog post (https://developer.chrome.com/blog/crx-scripting-api) -- Background on MV3 scripting API changes

### Tertiary (LOW confidence)
- None -- all critical claims verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries, pure file reorganization of existing working code
- Architecture: HIGH -- window.FSB namespace pattern is standard practice for Chrome extensions, shared scope per extension per frame confirmed by MDN docs
- Pitfalls: HIGH -- All pitfalls identified from direct code analysis of the 13K-line file, duplicate function verified at exact line numbers
- Load order: HIGH -- Dependency chain traced through function call analysis of actual code

**Research date:** 2026-02-21
**Valid until:** Indefinite (Chrome extension fundamentals, no fast-moving dependencies)
