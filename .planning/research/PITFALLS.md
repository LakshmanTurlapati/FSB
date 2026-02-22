# Domain Pitfalls: Content Script Modularization & Tech Debt Cleanup

**Domain:** Splitting a 13K-line Chrome Extension content script into modules without a build system
**Researched:** 2026-02-21
**Confidence:** HIGH (based on Chrome official docs, Chromium issue tracker, and direct codebase analysis)

---

## Critical Pitfalls

Mistakes that cause the extension to stop working or require reverting the entire change.

---

### Pitfall 1: Inconsistent Injection File Arrays Across background.js

**What goes wrong:** After splitting content.js into multiple files, some `chrome.scripting.executeScript` calls in background.js include the full file list while others include only a subset. The extension loads correctly on the first injection but breaks on re-injection or new-tab injection because critical modules are missing.

**Why it happens:** FSB has 3 separate injection points in background.js:
- Line 1636-1641: Primary injection in `ensureContentScriptInjected` (injects `['utils/automation-logger.js', 'content.js']`)
- Line 8104-8106: New tab injection via setTimeout (injects only `['content.js']` -- already missing the logger)
- Line 6204: Comment says "Content script is now injected via manifest.json content_scripts" (misleading -- it is actually programmatic)

After modularization, 9+ files need to be injected. If even one call site uses a stale file list, content scripts load partially: the namespace exists but tools or the message handler are missing. The extension appears to work (healthCheck responds) but automation fails silently.

**Consequences:**
- Automation works on initial page load but fails after navigation
- New tabs opened by automation have no tool registration
- Error appears only as "Unknown tool" or null reference, not as a clear "file missing" error
- Extremely difficult to debug because the failure depends on WHICH injection path was taken

**Prevention:**
1. Create a single `CONTENT_SCRIPT_FILES` constant at the top of background.js that ALL injection points reference
2. Add a module count verification in the message handler: on `healthCheck`, report how many modules loaded (e.g., `FSB.tools ? 'tools:ok' : 'tools:missing'`)
3. Search background.js for ALL occurrences of `executeScript` and `content.js` before merging
4. Add a comment at each injection site: `// SYNC: Uses CONTENT_SCRIPT_FILES -- do not hardcode file list`

**Detection:** After modularization, grep background.js for any remaining hardcoded `'content.js'` references. There should be zero.

**Severity:** CRITICAL -- silent partial failure, hard to reproduce

---

### Pitfall 2: Breaking the Re-Injection Guard with Multi-File Split

**What goes wrong:** The current re-injection guard wraps ALL 13,429 lines in a single `if/else` block. When splitting into multiple files, if the guard logic is not carefully replicated, re-injection either (a) double-initializes modules (duplicate event listeners, duplicate MutationObservers) or (b) skips initialization of new modules added after the first injection.

**Why it happens:** The guard `window.__FSB_CONTENT_SCRIPT_LOADED__` is set in the first file. When `chrome.scripting.executeScript` is called again on the same tab (which FSB does -- see line 8104), the guard fires and skips initialization. But if new module files were added between injections, those modules also see the guard and skip. The result: modules that were NOT present in the first injection never initialize.

The more dangerous case: if individual module files do NOT have guards and re-injection occurs, Chrome runtime listeners stack up. `chrome.runtime.onMessage.addListener(handleBackgroundMessage)` is called twice, meaning every message gets processed twice, causing duplicate actions.

**Consequences:**
- Duplicate message handlers cause every action to execute twice (double clicks, double typing)
- Or modules fail to initialize on tabs where content script was already partially loaded
- MutationObserver attached twice causes performance degradation and duplicate `domChanged` notifications

**Prevention:**
1. Use the recommended pattern: global guard in namespace file + per-module guards checking namespace properties
2. Each module file checks `if (FSB.moduleName) return;` before registering
3. The message handler specifically guards against double-registration: `if (FSB._messageHandlerRegistered) return;`
4. Test re-injection explicitly: load extension, navigate, verify automation still works after re-injection

**Detection:** Open a tab, run automation, navigate to a new page (triggers re-injection), check console for "[FSB Content] automation-logger.js already loaded" messages. If multiple modules log "already loaded," guards are working.

**Severity:** CRITICAL -- duplicate event handlers cause double actions, which is worse than no automation

---

### Pitfall 3: File Loading Order Mismatch Causes Undefined References

**What goes wrong:** Module B references a function from Module A, but Module B is listed before Module A in the files array. Since content scripts execute sequentially, Module B runs first and the function is `undefined`. This causes a ReferenceError that crashes Module B's initialization, preventing its exports from registering on the namespace.

**Why it happens:** The dependency order is not enforced by any tooling. It is purely a matter of the array order in background.js (or manifest.json). During development, someone reorders the array for organizational reasons, or adds a new module at the wrong position, and the dependency chain breaks.

Unlike ES modules where the dependency graph is explicit via `import` statements, classic scripts have implicit dependencies through global scope references. Nothing warns you at "compile time" that a dependency is unmet.

**Consequences:**
- Module fails silently (IIFE catches the error internally)
- Downstream modules that depend on the failed module also fail
- Cascading failure: one wrong ordering can break the entire content script
- Error shows as `Cannot read properties of null (reading 'checkVisibility')` -- no indication which FILE caused the issue

**Prevention:**
1. Document dependencies in each module file's header comment
2. Each module should check its dependencies and log a clear error: `if (!FSB.elements) console.error('[FSB dom-serializer] FATAL: element-utils not loaded. Check file ordering in CONTENT_SCRIPT_FILES');`
3. Add the dependency graph as a comment next to the `CONTENT_SCRIPT_FILES` constant
4. Consider a simple load-order validation: the namespace file assigns a load sequence number, each module increments it and verifies the expected sequence

**Detection:** Check browser console on page load for any ReferenceError or "not loaded" messages from content script files.

**Severity:** CRITICAL -- cascading failure breaks all automation

---

## Moderate Pitfalls

Mistakes that cause bugs or regressions in specific scenarios but do not break the extension entirely.

---

### Pitfall 4: `const`/`let` Declarations Are Not Window Properties

**What goes wrong:** After splitting, a developer expects that `const tools = { ... }` in `tools.js` is accessible as `window.tools` in `message-handler.js`. It is not. Top-level `const` and `let` declarations are accessible in the shared scope (via bare name `tools`) but are NOT properties of `window`. Code that checks `window.tools` or `typeof window.tools` will see `undefined`.

**Why it happens:** In JavaScript's strict mode and in Chrome's content script isolated world:
- `var` declarations at the top level create properties on `window` (or the global object)
- `const` and `let` declarations at the top level are in the script's scope but NOT on `window`
- `function` declarations are hoisted and available globally

The current content.js uses `const tools = { ... }` (line 5546), which works because everything is in the same file. After splitting, if `message-handler.js` references `tools` by bare name, it works because they share the same scope. But if anyone writes `window.tools` or destructures from `window`, it fails.

**Consequences:**
- Subtle bug: code works when referencing `tools` directly but fails when using `window.tools`
- DevTools console cannot access `const`/`let` variables from content scripts (they are not on `window`)
- Any dynamic property lookup like `window[moduleName]` fails for `const`/`let` declarations

**Prevention:**
1. When using the `window.FSB` namespace pattern, attach all exports to the namespace object, not as bare `const`/`let` declarations
2. For the transition period, if a module needs to be accessible from DevTools, explicitly assign: `window.FSB.tools = tools;`
3. Do NOT mix patterns: either everything goes through `window.FSB` or everything is bare declarations. The namespace approach is recommended.

**Detection:** Try accessing module exports from DevTools console. If `window.FSB.tools` works but `window.tools` does not, the namespace pattern is correctly isolating things.

**Severity:** MODERATE -- causes debugging confusion and breaks any code using `window.xxx` access patterns

---

### Pitfall 5: Dead Code Removal Breaks Undiscovered Internal Callers

**What goes wrong:** A function appears to have zero callers (grep finds nothing), so it is removed during the modularization cleanup. Later, it turns out the function was called dynamically (via string-based lookup, computed property access, or by the AI's action response specifying a tool name).

**Why it happens:** FSB uses dynamic dispatch for tools: `tools[action.tool](params)`. The tool name comes from the AI response, not from a static call site in the code. Grepping for `tools.scrollToElement` finds zero results because it is called as `tools["scrollToElement"]` at runtime via the `action.tool` string.

Similarly, some functions may be called from `background.js` via message passing. The function name appears only in the background script's message object, not as a direct call in the content script.

**Consequences:**
- Removing a "dead" tool function causes runtime errors when the AI tries to use that tool
- Removing a message handler case breaks a specific background-to-content communication path
- The failure only appears when the AI happens to choose that specific tool/action

**Prevention:**
1. NEVER remove tool functions from the `tools` object during modularization. All tools are "live" because the AI can invoke any of them.
2. For non-tool functions, verify callers in ALL files (content.js, background.js, ai-integration.js), not just the file being modified
3. Mark suspected dead code as `// SUSPECTED_DEAD_CODE: no callers found [date]` and leave it for one release cycle before removing
4. Check message handler switch/case entries -- each `case` label represents a function that background.js calls

**Detection:** Run the extension with debug logging enabled. Any "Unknown tool" errors in the console indicate a removed function that was not actually dead.

**Severity:** MODERATE -- breaks specific automation scenarios that depend on the removed code

---

### Pitfall 6: Shadow DOM Overlay Initialization Timing

**What goes wrong:** Visual overlay classes (HighlightManager, ProgressOverlay, ViewportGlow, etc.) create Shadow DOM elements during construction or on first `.show()` call. If the visual feedback module loads before `document.body` exists (e.g., when `injectImmediately: true` is used), Shadow DOM host creation fails silently because `document.body.appendChild()` throws.

**Why it happens:** FSB uses `injectImmediately: true` in the primary injection (line 1640). This injects scripts before `document_idle`, potentially before `document.body` is available. The current monolithic content.js handles this with deferred initialization patterns, but when split into modules, the timing between module load and DOM readiness may change.

The overlay singletons are created at module load time (`const progressOverlay = new ProgressOverlay()`). If the constructor tries to create a Shadow DOM host element immediately, it needs `document.body`. If `document.body` is null at module load time, the singleton is in a broken state.

**Consequences:**
- No visual feedback during automation (no progress bar, no glow effects)
- Error buried in console: "Cannot read properties of null (reading 'appendChild')"
- Automation itself works, but user sees no visual indication of progress

**Prevention:**
1. All overlay classes should use lazy initialization: create the Shadow DOM host on first `.show()` call, not in the constructor
2. The existing `ProgressOverlay` already does this (creates host in `_createHost()`), but verify all 5 overlay classes follow this pattern
3. Add a `document.body` existence check before any DOM insertion: `if (!document.body) return;`
4. Test with `injectImmediately: true` on a slow-loading page

**Detection:** Load the extension on about:blank, then navigate to a real page and trigger automation. Visual overlays should appear. If they do not, check console for DOM-related errors.

**Severity:** MODERATE -- visual feedback broken, automation still works

---

### Pitfall 7: Duplicate `generateSelector` Function Causes Wrong Selector Usage

**What goes wrong:** There are two functions named `generateSelector` in content.js -- one at line 2986 (advanced multi-strategy) and one at line 10759 (simpler version for `extractRelevantHTML`). After splitting into modules, one shadows the other depending on load order. Callers that expected the advanced version get the simple one, or vice versa.

**Why it happens:** In a single file, JavaScript allows two `function` declarations with the same name. The second one wins (overwrites the first). After splitting into separate files, the behavior depends on which file loads last. If both files define `function generateSelector()`, the last-loaded one wins globally.

With the IIFE + namespace pattern, this is less of a problem (each IIFE has its own scope), but if backward-compatibility aliases are used (`window.generateSelector = ...`), one will overwrite the other.

**Consequences:**
- `extractRelevantHTML` uses the wrong selector generation strategy, producing incorrect selectors
- Or DOM snapshot generation uses the simplified version, reducing selector quality
- Subtle accuracy degradation that is hard to trace to a duplicate function name

**Prevention:**
1. Rename the simple version to `generateSimpleSelectorForHTML()` or `generateInlineSelector()` during extraction
2. Search for ALL callers of `generateSelector` to determine which version each caller actually needs
3. In the namespace, export only the authoritative version as `FSB.elements.generateSelector`
4. Place the other in its consuming module as a private function inside the IIFE

**Detection:** After modularization, search all files for `generateSelector` -- there should be exactly one public version on the namespace.

**Severity:** MODERATE -- causes subtle selector quality issues

---

## Minor Pitfalls

Mistakes that cause inconvenience or minor issues but are straightforward to fix.

---

### Pitfall 8: Large Git Diff Makes Code Review Difficult

**What goes wrong:** Extracting 3,700 lines from content.js into tools.js and deleting them from content.js produces a diff that shows 3,700 deletions and 3,700 additions. Git does not recognize this as a "move" -- it looks like entirely new code and entirely deleted code. Reviewers cannot verify that the code was moved without modification.

**Why it happens:** Git tracks file-level renames but cannot track code moved between files. A function moved from content.js to content/tools.js appears as deleted code in one file and added code in another. With 7+ modules being extracted, the total diff is ~13,000 lines changed.

**Consequences:**
- Code review becomes impractical
- Accidental modifications introduced during the move are not caught
- Git blame loses history for all moved code

**Prevention:**
1. Extract ONE module per commit. Each commit moves a specific section with minimal other changes.
2. In the commit message, explicitly state: "Moved lines X-Y from content.js to content/module.js. No logic changes."
3. Use `git diff --no-index content.js.backup content/module.js` to verify the moved code matches
4. Make functional changes (renaming, refactoring) in SEPARATE commits from the move commits

**Detection:** Review each extraction commit by checking that `wc -l` of the new file plus the reduction in content.js match.

**Severity:** MINOR -- review quality problem, not a runtime issue

---

### Pitfall 9: DevTools Debugging Difficulty with Multi-File Content Scripts

**What goes wrong:** After splitting into 9+ files, debugging in Chrome DevTools becomes harder. The Sources panel shows many small files instead of one searchable file. Breakpoints set in the wrong file do not trigger. Stack traces span multiple files, making it harder to follow execution flow.

**Why it happens:** Chrome DevTools lists each injected content script file separately under the extension's source tree. With 9 files, the developer must remember which module contains the function they want to debug.

**Consequences:**
- Slower debugging workflow
- Confusion about which file contains a specific function

**Prevention:**
1. Use consistent naming: prefix all module functions' error messages with the module name: `[FSB tools]`, `[FSB elements]`
2. In DevTools, use the "Search in all files" feature (Ctrl+Shift+F) to find functions across modules
3. Keep the file count reasonable (7-10 files, not 20+)

**Detection:** N/A -- this is a workflow issue, not a bug

**Severity:** MINOR -- developer experience issue

---

### Pitfall 10: Forgotten Config Extraction Leaves Magic Numbers

**What goes wrong:** During modularization, hardcoded values that should be configurable are left scattered across module files instead of being centralized. After the split, there are now 9 files to search instead of 1 when trying to find and update a timeout value or a retry count.

**Why it happens:** The focus during modularization is on moving code, not on improving it. Hardcoded values like `_ELEMENT_INDEX_TTL = 2000` (line 874), `MAX_RECONNECT_ATTEMPTS = 5` (line 13255), and mutation debounce timings are moved as-is into their respective modules.

**Consequences:**
- Tuning performance requires editing multiple files
- Related constants are spread across modules
- No single place to see all configurable values

**Prevention:**
1. Create a `_config.js` file (loaded second, after namespace) that centralizes all hardcoded values
2. During each module extraction, identify magic numbers and move them to config
3. Reference config values as `FSB.config.ELEMENT_INDEX_TTL` instead of inline constants

**Detection:** After modularization, grep for numeric literals and string constants that appear to be tunable settings.

**Severity:** MINOR -- maintainability issue, not a runtime bug

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Namespace bootstrap creation | #2: Guard logic must work for both initial load and re-injection | Test re-injection explicitly after creating namespace file |
| DOM state module extraction | #3: Other modules reference DOMStateManager singleton by bare name | Verify all callers work after extraction, add namespace alias |
| Visual feedback extraction | #6: Shadow DOM timing with injectImmediately | Verify lazy initialization pattern in all 5 overlay classes |
| Element utils extraction | #7: Duplicate generateSelector function | Rename the simpler version before extracting |
| Tools extraction | #5: Dynamic dispatch makes tools appear "dead" | Never remove any tool function |
| Message handler extraction | #1: All injection points must use updated file list | Create CONTENT_SCRIPT_FILES constant first |
| Dead code removal | #5: Dynamic callers not found by grep | Mark as suspected-dead for one release before removing |
| Config extraction | #10: Magic numbers left in modules | Extract to FSB.config during each module move |

---

## Sources

- Direct analysis of `content.js` (13,429 lines) -- function dependencies, re-injection guard, duplicate definitions
- Direct analysis of `background.js` -- 3 injection points identified at lines 1636, 6204, 8104
- [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- isolated world scope behavior
- [Chromium Issue #41017694](https://issues.chromium.org/issues/41017694) -- content script global variable collision behavior
- [Chrome Manifest content_scripts Reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- file ordering guarantees
