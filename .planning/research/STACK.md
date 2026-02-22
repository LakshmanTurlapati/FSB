# Technology Stack: Content Script Modularization

**Project:** FSB v9.0.2 - Tech Debt Cleanup / Content Script Split
**Researched:** 2026-02-21
**Mode:** Ecosystem (Stack dimension)
**Constraint:** Vanilla JS, no build system, no transpilation, Chrome Extension MV3
**Overall confidence:** HIGH

---

## Executive Summary

FSB's `content.js` is 13,429 lines in a single file. All code lives inside a re-injection guard (`if/else` block from line 5 to line 13430). The file contains 7 distinct functional domains: DOM state management, visual feedback (Shadow DOM overlays), element utilities, accessibility/ARIA helpers, action verification, the tools registry (25+ browser actions), DOM serialization/snapshot, and the message handler. These domains have clear boundaries but share a flat scope with ~30 top-level `function` declarations, ~10 `class` definitions, ~15 `const`/`let` module-level variables, and one massive `const tools = {}` object.

The recommended modularization approach is **manifest-declared multi-file content scripts** with a **shared namespace object** pattern. No build system is needed. Chrome's content script injection guarantees sequential file execution within the same isolated world scope, meaning top-level `var`, `const`, `let`, `function`, and `class` declarations in earlier files are directly accessible to later files.

Key finding: The current programmatic injection via `chrome.scripting.executeScript({ files: [...] })` already supports multi-file arrays with the same shared-scope guarantee as manifest-declared `content_scripts`. The migration can happen incrementally -- extract one module at a time, add it to the `files` array before `content.js`, and verify.

---

## 1. Content Script Loading Mechanics (Verified)

### How Files Share Scope

**Confidence: HIGH** (Verified against Chrome official documentation)

Chrome Extension content scripts -- whether declared in `manifest.json` or injected via `chrome.scripting.executeScript` -- all execute in the same **isolated world** per frame per extension. This means:

1. **All files in a `content_scripts[].js` array share the same global scope.** Variables declared with `var`, `const`, `let`, `function`, or `class` at the top level of file A are accessible to file B if file A appears earlier in the array.

2. **All files in a `chrome.scripting.executeScript({ files: [...] })` call share the same scope.** The behavior is identical to manifest-declared scripts.

3. **Files execute sequentially in array order.** This is guaranteed by Chrome. File [0] finishes before file [1] begins.

4. **The isolated world persists across injection calls for the same tab/frame.** If you call `executeScript` twice on the same tab, the second call's scripts can access variables from the first call (they share the same isolated world).

**Source:** [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome Manifest content_scripts Reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)

### Current Injection Pattern

FSB currently injects content scripts programmatically:

```javascript
// background.js line 1636-1641
await chrome.scripting.executeScript({
  target: { tabId, frameIds: [0] },
  files: ['utils/automation-logger.js', 'content.js'],
  world: 'ISOLATED',
  injectImmediately: true
});
```

This pattern already demonstrates multi-file injection with ordering dependency (`automation-logger.js` must load before `content.js`). The modularization simply extends this pattern to more files.

### ES Modules: NOT Available

**Confidence: HIGH** (Verified against Chrome docs and Chromium issue tracker)

ES modules (`import`/`export`) are **not supported** in content scripts. Chrome does not support `type="module"` for content script injection. The `chrome.scripting.executeScript` API has no module support parameter. Dynamic `import()` requires files to be listed in `web_accessible_resources` and runs in the page's MAIN world, breaking isolated world access to `chrome.runtime` APIs.

**Do not attempt ES modules.** All modularization must use classic script patterns.

---

## 2. Recommended Architecture: Shared Namespace Object

### Pattern: `window.FSB` Namespace

Use a single namespace object on `window` (or just as a top-level `const` since all files share scope). Each module file contributes its exports to this namespace.

**Why `window.FSB` over bare top-level declarations:**

| Approach | Pros | Cons |
|----------|------|------|
| Bare top-level functions (current) | Simple, no boilerplate | No module boundaries, name collision risk, hard to trace origins, can't test individual modules |
| `window.FSB` namespace | Clear ownership, discoverable API, debug-friendly (`window.FSB` in console), explicit dependencies | Slightly more verbose |
| IIFE per file | True encapsulation, private state | Complex, requires explicit export of every function, breaks existing call patterns |

**Recommendation: Use `window.FSB` namespace** because:
- It works across both manifest-declared and programmatically-injected scripts
- It survives the re-injection guard pattern (accessible via `window`)
- It is inspectable in DevTools console
- It makes module boundaries explicit without requiring code inside each function to change
- It matches the existing `window.__FSB_CONTENT_SCRIPT_LOADED__` and `window.automationLogger` patterns already in use

### Proposed File Structure

```
content/
  _namespace.js          # Creates window.FSB = {} and re-injection guard
  dom-state.js           # DOMStateManager, ElementCache, RefMap classes
  visual-feedback.js     # HighlightManager, ProgressOverlay, ViewportGlow, ActionGlowOverlay, ElementInspector
  element-utils.js       # Selector generation, element visibility, editable checks, ARIA helpers
  action-verification.js # captureActionState, verifyActionEffect, ActionRecorder, diagnostics
  tools.js               # The 25+ tool functions (scroll, click, type, etc.)
  dom-serializer.js      # getStructuredDOM, generateCompactSnapshot, DOM diffing
  explorer.js            # Site explorer data collection functions
  message-handler.js     # handleBackgroundMessage, MutationObserver, connection management
```

### File Loading Order (Critical)

The dependency graph determines load order. Based on code analysis:

```
_namespace.js           # No dependencies (creates FSB namespace)
   |
dom-state.js            # Depends on: namespace, automationLogger
   |
visual-feedback.js      # Depends on: namespace, isFsbElement, automationLogger
   |
element-utils.js        # Depends on: namespace, getClassName, stripUnicodeControl, automationLogger
   |
action-verification.js  # Depends on: namespace, element-utils functions, automationLogger
   |
tools.js                # Depends on: namespace, element-utils, dom-state, visual-feedback, action-verification
   |
dom-serializer.js       # Depends on: namespace, element-utils, dom-state, tools
   |
explorer.js             # Depends on: namespace, element-utils
   |
message-handler.js      # Depends on: ALL of the above (dispatches to tools, serializer, etc.)
```

### Manifest/Injection Array

```javascript
// background.js - updated executeScript call
await chrome.scripting.executeScript({
  target: { tabId, frameIds: [0] },
  files: [
    'utils/automation-logger.js',
    'content/_namespace.js',
    'content/dom-state.js',
    'content/visual-feedback.js',
    'content/element-utils.js',
    'content/action-verification.js',
    'content/tools.js',
    'content/dom-serializer.js',
    'content/explorer.js',
    'content/message-handler.js'
  ],
  world: 'ISOLATED',
  injectImmediately: true
});
```

---

## 3. Implementation Pattern: File Template

### Namespace Bootstrap (`_namespace.js`)

```javascript
// content/_namespace.js - MUST be loaded first
// Creates the FSB namespace and re-injection guard

if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  // Already loaded - skip re-injection
} else {
  window.__FSB_CONTENT_SCRIPT_LOADED__ = true;

  // Central namespace for all content script modules
  window.FSB = {
    version: '9.0.2',
    // Module registrations (populated by subsequent files)
    domState: null,
    visual: null,
    elements: null,
    verification: null,
    tools: null,
    serializer: null,
    explorer: null,
    // Shared state
    currentSessionId: null
  };

  // Get automationLogger from window or create fallback
  window.FSB.logger = window.automationLogger || {
    log: function() {},
    error: function(msg, data) { console.error('[FSB Fallback]', msg, data || ''); },
    // ... (existing fallback pattern)
  };
}
```

### Module File Template (e.g., `dom-state.js`)

```javascript
// content/dom-state.js - DOM state management
// Dependencies: _namespace.js, automation-logger.js

(function(FSB) {
  'use strict';

  // Guard: skip if namespace not ready or already loaded
  if (!FSB || FSB.domState) return;

  const logger = FSB.logger;

  class DOMStateManager {
    // ... (moved from content.js lines 163-606)
  }

  class ElementCache {
    // ... (moved from content.js lines 614-727)
  }

  class RefMap {
    // ... (moved from content.js lines 739-780)
  }

  // Export to namespace
  FSB.domState = {
    DOMStateManager,
    ElementCache,
    RefMap,
    manager: new DOMStateManager(),
    cache: new ElementCache(),
    refMap: new RefMap()
  };

})(window.FSB);
```

### Why IIFE Wrapper Inside Namespace Pattern

Each module file uses an IIFE `(function(FSB) { ... })(window.FSB)` for two reasons:

1. **Private scope for module internals.** Helper functions, constants, and variables that should not leak to other modules stay private inside the IIFE.

2. **Fail-safe guard.** If a file loads out of order or `window.FSB` is undefined, the IIFE receives `undefined` and the guard `if (!FSB)` prevents crashes.

3. **Existing functions remain callable.** Functions that other modules need are placed on the namespace object. Functions that are only used within the module stay private inside the IIFE.

---

## 4. Handling Cross-Module Dependencies

### Problem: Current Flat Scope

Currently all ~100 functions are siblings in the same scope. Any function can call any other function. After splitting, a function in `tools.js` that calls `checkElementVisibility()` (defined in `element-utils.js`) needs to find it somewhere.

### Solution: Three Tiers of Access

**Tier 1: Namespace exports** (cross-module public API)
Functions that other modules call. These go on `window.FSB.moduleName.functionName`.

```javascript
// In element-utils.js
FSB.elements = {
  checkVisibility: checkElementVisibility,
  generateSelector: generateSelector,
  sanitizeSelector: sanitizeSelector,
  // ...
};

// In tools.js
const visibility = FSB.elements.checkVisibility(element);
```

**Tier 2: Top-level convenience aliases** (backward compatibility)
For the transition period, critical functions can also be assigned to the global scope so existing code that calls them by name still works. This is a temporary bridge, not a permanent pattern.

```javascript
// In element-utils.js (temporary backward compat)
window.checkElementVisibility = checkElementVisibility;
window.generateSelector = generateSelector;
```

**Tier 3: IIFE-private** (module internals)
Helper functions, constants, and variables that no other module needs. These stay inside the IIFE and are not exported.

### Dependency Direction Rule

Dependencies must flow **downward** in the file loading order. If `tools.js` depends on `element-utils.js`, `element-utils.js` must load first. Circular dependencies between files are forbidden.

If two modules need each other, they must be merged or the shared parts extracted to a third module that loads before both.

---

## 5. The Re-Injection Guard Pattern

### Current Pattern (Must Preserve)

```javascript
if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  // skip
} else {
  window.__FSB_CONTENT_SCRIPT_LOADED__ = true;
  // ... 13,400 lines ...
}
```

### Multi-File Guard Strategy

**Option A: Single global guard + per-module guards (RECOMMENDED)**

The namespace file (`_namespace.js`) owns the global guard. Each subsequent module has its own guard checking if it has already registered on the namespace.

```javascript
// _namespace.js
if (window.__FSB_CONTENT_SCRIPT_LOADED__) { /* skip */ }
else { window.__FSB_CONTENT_SCRIPT_LOADED__ = true; window.FSB = { ... }; }

// dom-state.js
(function(FSB) {
  if (!FSB || FSB.domState) return;  // per-module guard
  // ...
  FSB.domState = { ... };
})(window.FSB);
```

This works because:
- If the entire set of files is re-injected, `_namespace.js` skips (global guard), and since `window.FSB` already has `domState`, each module also skips
- If only one module file is somehow re-injected, its own guard prevents double-registration

**Option B: Each file has full guard (NOT recommended)**
Verbose, duplicates the flag-checking logic, and makes it harder to reason about initialization order.

---

## 6. Handling the `tools` Object

### Current State

The `tools` object (lines 5546-9252) is a single object literal with ~3,700 lines containing 25+ tool functions. It is referenced by the message handler to dispatch `executeAction` requests.

### Recommended Split: Tool Registration Pattern

Instead of one monolithic object, use a registration pattern:

```javascript
// In _namespace.js
window.FSB.tools = {};

// In tools.js (or multiple tool files if desired)
(function(FSB) {
  if (!FSB) return;

  // Scroll tools
  FSB.tools.scroll = async (params) => { ... };
  FSB.tools.scrollToTop = async () => { ... };
  FSB.tools.scrollToBottom = async () => { ... };

  // Click tools
  FSB.tools.click = async (params) => { ... };
  FSB.tools.rightClick = async (params) => { ... };
  FSB.tools.doubleClick = async (params) => { ... };

  // ... etc.
})(window.FSB);
```

The message handler then does:

```javascript
// In message-handler.js
const toolFn = FSB.tools[request.tool];
if (!toolFn) { sendResponse({ error: 'Unknown tool' }); return; }
const result = await toolFn(request.params);
```

This is identical to the current pattern (`tools[action.tool]`) but uses the namespace instead of a local variable.

### Optional: Further Tool Splitting

If desired, tools can be split into sub-files:

```
content/tools/
  scroll-tools.js
  click-tools.js
  input-tools.js
  navigation-tools.js
  query-tools.js
```

Each file registers its tools on `FSB.tools`. The message handler does not care which file registered the tool -- it just looks up by name. This is a later optimization, not needed for the initial split.

---

## 7. Message Handler Refactoring

### Current Pattern

The `handleBackgroundMessage` function (lines 12804-13105) is a large switch/if-else that dispatches to various functions. It references:
- `tools` object (for `executeAction`)
- `getStructuredDOM()` (for `getDOM`)
- `checkDocumentReady()` (for `healthCheck`)
- `progressOverlay` (for status updates)
- Various DOM analysis functions

### After Modularization

```javascript
// In message-handler.js
(function(FSB) {
  if (!FSB || FSB._messageHandlerRegistered) return;
  FSB._messageHandlerRegistered = true;

  function handleBackgroundMessage(request, sender, sendResponse) {
    if (request.sessionId) {
      FSB.currentSessionId = request.sessionId;
    }

    FSB.logger.logComm(FSB.currentSessionId, 'receive', request.action, true, {});

    if (request.action === 'executeAction') {
      handleAsyncMessage(request, sendResponse);
      return true;
    }

    if (request.action === 'getDOM') {
      const dom = FSB.serializer.getStructuredDOM(request.options);
      sendResponse(dom);
      return true;
    }

    // ... etc., all references go through FSB namespace
  }

  chrome.runtime.onMessage.addListener(handleBackgroundMessage);

  // MutationObserver, connection management, etc.
  // ...
})(window.FSB);
```

---

## 8. Migration Strategy: Incremental Extraction

### Do NOT rewrite all at once.

Extract one module at a time, in this order:

| Step | Module | Lines | Risk | Verification |
|------|--------|-------|------|-------------|
| 1 | `_namespace.js` | ~40 | LOW | Extension loads, guard works, `window.FSB` exists |
| 2 | `dom-state.js` | ~620 | LOW | `DOMStateManager`, `ElementCache`, `RefMap` work |
| 3 | `visual-feedback.js` | ~1,000 | MEDIUM | Overlays, highlights, glow effects render correctly |
| 4 | `element-utils.js` | ~2,200 | MEDIUM | Selector generation, visibility checks, ARIA helpers work |
| 5 | `action-verification.js` | ~730 | LOW | Action state capture and verification work |
| 6 | `tools.js` | ~3,700 | HIGH | All 25+ tools execute correctly (most critical) |
| 7 | `dom-serializer.js` | ~2,200 | MEDIUM | `getStructuredDOM`, `generateCompactSnapshot` return correct data |
| 8 | `explorer.js` | ~200 | LOW | Site explorer data collection works |
| 9 | `message-handler.js` | ~630 | HIGH | All message types handled, MutationObserver works |

**After each step:** Test the full automation flow. Load extension, run a task, verify no regressions.

### Step-by-Step Process for Each Module

1. Create the new file in `content/`
2. Copy the relevant functions/classes from `content.js` into the IIFE
3. Add namespace exports
4. Update `background.js` `executeScript` calls to include the new file before `content.js`
5. Delete the moved code from `content.js`
6. Test

The key insight: during migration, the remaining `content.js` and the new module files coexist in the same scope. Functions that have been moved to `FSB.elements.checkVisibility` can still be called as bare `checkElementVisibility()` if you add the Tier 2 backward-compat aliases. This lets you migrate callers gradually.

---

## 9. Updating Background Script Injection Points

### All Injection Sites (Must Update)

There are **3 injection points** in `background.js` that need updating:

| Line | Context | Current Files | Action |
|------|---------|---------------|--------|
| 1636-1641 | Primary injection (ensureContentScriptInjected) | `['utils/automation-logger.js', 'content.js']` | Replace with full file array |
| 8104-8106 | New tab injection (setTimeout fallback) | `['content.js']` | Replace with full file array (include logger) |
| 6204 | Comment-only reference | N/A (comment says "manifest.json content_scripts" but is wrong) | Update comment |

**Recommendation:** Create a constant array in `background.js`:

```javascript
const CONTENT_SCRIPT_FILES = [
  'utils/automation-logger.js',
  'content/_namespace.js',
  'content/dom-state.js',
  'content/visual-feedback.js',
  'content/element-utils.js',
  'content/action-verification.js',
  'content/tools.js',
  'content/dom-serializer.js',
  'content/explorer.js',
  'content/message-handler.js'
];

// Then at each injection point:
await chrome.scripting.executeScript({
  target: { tabId, frameIds: [0] },
  files: CONTENT_SCRIPT_FILES,
  world: 'ISOLATED',
  injectImmediately: true
});
```

This ensures all injection points stay in sync.

---

## 10. Alternatives Considered

| Approach | Verdict | Why Not |
|----------|---------|---------|
| **Webpack/Rollup bundler** | REJECTED | Project constraint is no build system. Adds toolchain complexity, npm dependency management, build step to dev workflow. |
| **Dynamic `import()`** | REJECTED | Requires `web_accessible_resources`, runs in MAIN world (loses isolated world access to `chrome.runtime`), blocked by some site CSPs. |
| **Single file with regions/folding** | REJECTED | Does not reduce cognitive load, does not enable independent testing, does not reduce git merge conflicts. 13K lines is objectively too large. |
| **Manifest `content_scripts` instead of programmatic** | DEFERRED | Would simplify injection but loses programmatic control (frameIds targeting, injectImmediately, conditional injection). Current programmatic approach is fine. |
| **Web Workers for heavy computation** | REJECTED for this milestone | Workers cannot access DOM. All content script functions need DOM access. Not applicable to modularization. |

---

## 11. Important Caveats and Edge Cases

### `const`/`let` vs `var` Across Files

All three declaration types work across files in the same content script scope:
- `var` declarations are hoisted and globally accessible (attached to the global object in non-strict mode)
- `const` and `let` declarations are block-scoped but at the top level of a script, they are accessible to subsequent scripts in the same execution context
- `function` declarations are hoisted and globally accessible

**However**, inside an IIFE wrapper, `const`/`let`/`var` are scoped to the IIFE. Only values explicitly attached to `window.FSB` (or `window`) are accessible to other files. This is the desired behavior -- it prevents accidental leaks.

### Re-Injection with Partial File Sets

Line 8104-8106 in `background.js` injects only `['content.js']` without `automation-logger.js`. After modularization, ALL files must be injected together. Using the `CONTENT_SCRIPT_FILES` constant prevents this bug.

### Error in One File Breaks Subsequent Files

If `dom-state.js` throws an error during top-level execution, `visual-feedback.js` and all subsequent files may still load (Chrome injects all files in the array) but they will find `FSB.domState` as `null`. Each module's guard `if (!FSB || FSB.domState)` handles this gracefully by skipping initialization.

For the message handler (last to load), a missing dependency should be reported:

```javascript
// In message-handler.js
if (!FSB.tools || !FSB.serializer) {
  console.error('[FSB] Critical modules failed to load. tools:', !!FSB.tools, 'serializer:', !!FSB.serializer);
}
```

### Performance: Many Small Files vs One Large File

Chrome's `executeScript` with a `files` array fetches all files from the extension package (local disk, not network). The overhead of loading 10 files vs 1 file is negligible (sub-millisecond per file). The parsing cost is identical since the same total code is parsed. There is no measurable performance regression from splitting.

---

## 12. Dead Code Identification Strategy

While splitting, use the extraction process to identify dead code:

1. **Track function references.** When moving a function to a module, search the entire codebase for callers. If no callers exist outside the function's own file, it may be dead.

2. **The `tools` object is the source of truth for action tools.** Any tool function not in the `tools` object is dead code (unless called internally by another tool).

3. **`generateSelector` is defined twice** (lines 2986 and 10759). One is likely dead or a legacy version.

4. **Explorer functions** (`explorerBuildSelector`, `explorerExtractNavigation`, etc.) appear to be used only by `collectExplorerData`. If site explorer is disabled, these are candidates for conditional loading.

---

## 13. Hardcoded Values to Extract

During modularization, extract these hardcoded values to a config module:

```javascript
// content/_config.js (load after _namespace.js)
window.FSB.config = {
  ELEMENT_INDEX_TTL: 2000,        // line 874
  MAX_RECONNECT_ATTEMPTS: 5,      // line 13255
  MUTATION_DEBOUNCE_MS: 300,      // inferred from observer code
  VERSION: '9.0.2',               // repeated in multiple places
  // Shadow DOM host IDs
  HOST_IDS: new Set([
    'fsb-highlight-host',
    'fsb-progress-host',
    'fsb-glow-host',
    'fsb-action-glow-host',
    'fsb-inspector-host'
  ])
};
```

---

## Sources

- [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- HIGH confidence, official
- [Chrome Manifest content_scripts Reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- HIGH confidence, official
- [Chrome scripting API Reference](https://developer.chrome.com/docs/extensions/reference/api/scripting) -- HIGH confidence, official
- [Chromium Issue #41017694: Content script global variables stomp on each other](https://issues.chromium.org/issues/41017694) -- HIGH confidence, official bug tracker
- [ESM Module Import Support in Content Scripts](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/uz5-maxDJFA) -- MEDIUM confidence, official Chromium Extensions group
- [Multiple Content Scripts in Manifest](https://riptutorial.com/google-chrome-extension/example/9651/multiple-content-scripts-in-the-manifest) -- MEDIUM confidence, community tutorial
- Codebase analysis of `content.js` (13,429 lines), `background.js` (injection points), `utils/automation-logger.js` (existing multi-file pattern) -- HIGH confidence, direct inspection
