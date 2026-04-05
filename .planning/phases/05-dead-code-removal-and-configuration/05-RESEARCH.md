# Phase 5: Dead Code Removal and Configuration - Research

**Researched:** 2026-02-22
**Domain:** Chrome Extension codebase cleanup and configuration plumbing
**Confidence:** HIGH

## Summary

This phase has two distinct workstreams: (1) removing the `waitForActionable` function and sweeping all extension files for other dead code, and (2) making the ElementCache `maxCacheSize` a user-configurable setting on the Options page. Research confirms `waitForActionable` is defined in `content/accessibility.js` (lines 1104-1251), exported to `FSB.waitForActionable` (line 1277), and has zero callers anywhere in the codebase. The `content.js.bak` file also contains a copy but is itself dead (a backup from Phase 4 modularization). The dead code sweep found no other clearly dead functions in the content modules -- all FSB namespace exports are referenced by at least one consumer. The `speedMode` setting in `config.js` is marked deprecated but is still used for legacy migration logic in `options.js` and `ai-integration.js`, so it should be preserved.

For configuration, the ElementCache class lives in `content/dom-state.js` (lines 462-573) with `maxCacheSize` hardcoded to 100 on line 467. The options page already has a "DOM Analysis" settings card in the Advanced Settings section with a similar slider pattern (`maxDOMElements`). Content scripts have access to `chrome.storage.local` (proven by `content/actions.js` line 2574). The `chrome.storage.onChanged` listener in `background.js` (line 8952) already handles DOM setting changes. The immediate-effect mechanism can use the same `chrome.storage.onChanged` pattern, listened to directly in the content script.

**Primary recommendation:** Remove `waitForActionable` (function + export + comments), delete `content.js.bak`, add `elementCacheSize` to the config/storage/options pipeline using the exact same patterns as `maxDOMElements`, and read it in `content/dom-state.js` at construction time with a `chrome.storage.onChanged` listener for live updates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove waitForActionable and ALL references (primary target from ROADMAP.md)
- Additionally sweep ALL extension files for other dead code (not just content modules)
- Scope includes: content/, background.js, ai-integration.js, options.js, popup.js, sidepanel.js, and all other JS files
- Verification method: grep-confirmed zero references PLUS logical analysis of unreachable code paths
- Remove confirmed dead code regardless of size -- no size threshold
- Exception: preserve any scaffolding/placeholders related to future background agent functionality
- Clean up orphaned comments, TODOs, and JSDoc that reference deleted functions/code
- ElementCache maxCacheSize configurable from the Options page UI
- Setting lives in the existing Advanced Settings section (not a new section)
- Input control: preset dropdown with manual input option
- Presets include descriptive hints (e.g., "100 (Light pages)", "200 (Standard)", "500 (Heavy SPAs)")
- Manual input validated against a maximum limit of 1000 elements
- Value stored via existing config/storage patterns
- Default cache size increased from 100 to 200 elements
- Changes take effect immediately on next page load or content script injection -- no extension reload required
- When cache size is reduced below current cached element count, clear entire cache and start fresh
- Backward compatibility: if no custom value is stored, default to 200

### Claude's Discretion
- Exact preset values for the dropdown (suggested: 50, 100, 200, 500)
- Minimum allowed cache size
- Implementation of the immediate-effect mechanism (storage listener vs message passing)
- How to structure the config read path in the content script modules

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

No external libraries needed. This phase operates entirely within the existing Chrome Extension APIs and codebase patterns.

### Core
| Technology | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Chrome Extension Manifest V3 | Current | Extension framework | Already in use |
| chrome.storage.local | Chrome 88+ | Persistent settings storage | Already used for all settings |
| chrome.storage.onChanged | Chrome 88+ | Live setting propagation | Already used in background.js and config.js |

### Supporting
| Pattern | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| `defaultSettings` object | `ui/options.js` line 4 | Default values for all settings | Add new default here |
| `config.defaults` object | `config/config.js` line 16 | Config class defaults | Add new default here |
| `cacheElements()` function | `ui/options.js` line 111 | DOM element caching | Register new UI elements |
| `loadSettings()` function | `ui/options.js` line 506 | Load from chrome.storage | Add read logic for new setting |
| `saveSettings()` function | `ui/options.js` line 601 | Save to chrome.storage | Add write logic for new setting |

## Architecture Patterns

### Pattern 1: Settings Pipeline (Existing Pattern)
**What:** Every configurable setting follows a 5-step pipeline: defaults -> storage -> options UI -> save -> consumers read.
**When to use:** Adding any new user-configurable setting.
**Files touched (in order):**

1. `config/config.js` -- Add to `this.defaults` object (line ~16-49)
2. `ui/options.js` -- Add to `defaultSettings` object (line ~4-28)
3. `ui/options.html` -- Add UI control in the appropriate section
4. `ui/options.js` -- Add to `cacheElements()`, `loadSettings()`, `saveSettings()`, and `formInputs[]` array
5. Consumer code -- Read from `chrome.storage.local.get()` or `config.loadFromStorage()`

**Example (maxDOMElements pattern):**
```javascript
// config.js defaults
maxDOMElements: 2000,

// options.js defaultSettings
maxDOMElements: 2000,

// options.html (inside settings-card-content)
<div class="setting-item">
  <div class="setting-label">
    <span>Element Limit</span>
    <span class="setting-value-display" id="maxDOMElementsDisplay">2000</span>
  </div>
  <input type="range" id="maxDOMElementsSlider" min="500" max="5000" value="2000" step="500" class="modern-slider">
  <input type="hidden" id="maxDOMElements" value="2000">
  <div class="setting-hint">Balance between coverage and speed</div>
</div>

// options.js loadSettings
const maxDOM = settings.maxDOMElements || 2000;
if (elements.maxDOMElements) elements.maxDOMElements.value = maxDOM;

// options.js saveSettings
maxDOMElements: parseInt(elements.maxDOMElements?.value) || 2000,
```

### Pattern 2: Dropdown with Custom Input (Hybrid Control)
**What:** A `<select>` dropdown with preset values, plus a "Custom" option that reveals a number input.
**When to use:** When the user specified "preset dropdown with manual input option."
**Implementation approach:**

```html
<div class="setting-item">
  <div class="setting-label">
    <span>Element Cache Size</span>
    <span class="setting-value-display" id="elementCacheSizeDisplay">200</span>
  </div>
  <select id="elementCacheSizePreset" class="form-select small">
    <option value="50">50 (Minimal - simple pages)</option>
    <option value="100">100 (Light - standard pages)</option>
    <option value="200" selected>200 (Standard - recommended)</option>
    <option value="500">500 (Heavy - complex SPAs)</option>
    <option value="custom">Custom...</option>
  </select>
  <input type="number" id="elementCacheSizeCustom" class="form-input"
         min="10" max="1000" style="display: none; margin-top: 8px;"
         placeholder="Enter value (10-1000)">
  <input type="hidden" id="elementCacheSize" value="200">
  <div class="setting-hint">Number of element lookups to cache. Higher values improve speed on complex pages but use more memory.</div>
</div>
```

### Pattern 3: chrome.storage.onChanged for Live Updates (Existing Pattern)
**What:** Content scripts listen for storage changes and update behavior immediately.
**When to use:** When a setting must take effect without page reload.
**Example from background.js (line 8952-8971):**

```javascript
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    const domKeys = ['domOptimization', 'maxDOMElements', 'prioritizeViewport'];
    const hasDomChange = domKeys.some(key => key in changes);
    if (hasDomChange) {
      for (const [, session] of activeSessions) {
        if (session.domSettings) {
          if ('maxDOMElements' in changes) session.domSettings.maxDOMElements = changes.maxDOMElements.newValue;
        }
      }
    }
  }
});
```

### Pattern 4: Content Script Config Read at Init (Recommended)
**What:** The ElementCache reads its config from `chrome.storage.local` when constructed, with a fallback default.
**Where:** `content/dom-state.js`, inside the ElementCache constructor.
**Implementation:**

```javascript
class ElementCache {
  constructor(maxCacheSize = 200) {
    this.cache = new Map();
    this.stateVersion = 0;
    this.observer = null;
    this.maxCacheSize = maxCacheSize;
  }
  // ...
}

// After class definition, read config and create singleton
const DEFAULT_ELEMENT_CACHE_SIZE = 200;
const elementCache = new ElementCache(DEFAULT_ELEMENT_CACHE_SIZE);

// Async config read (updates the instance after creation)
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.get(['elementCacheSize'], (result) => {
    if (result.elementCacheSize && Number.isFinite(result.elementCacheSize)) {
      const newSize = Math.max(10, Math.min(1000, result.elementCacheSize));
      if (newSize !== elementCache.maxCacheSize) {
        elementCache.maxCacheSize = newSize;
        if (elementCache.cache.size > newSize) {
          elementCache.invalidate(); // Clear if reduced below current count
        }
      }
    }
  });

  // Live update listener
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.elementCacheSize) {
      const newSize = Math.max(10, Math.min(1000, changes.elementCacheSize.newValue || DEFAULT_ELEMENT_CACHE_SIZE));
      elementCache.maxCacheSize = newSize;
      if (elementCache.cache.size > newSize) {
        elementCache.invalidate();
      }
    }
  });
}
```

### Anti-Patterns to Avoid
- **Message passing for config:** Don't use `chrome.runtime.sendMessage` to ask background.js for the cache size. Content scripts have direct `chrome.storage.local` access -- use it.
- **Synchronous config read:** Don't try to make the initial `chrome.storage.local.get` synchronous. Start with default, update async. The cache works fine with default-then-update.
- **Removing `speedMode`:** It looks deprecated but still has active legacy migration logic in `options.js` (line 510-514) and `ai-integration.js` (line 438-439). Removing it would break upgrades from older versions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings storage | Custom IPC or file-based config | `chrome.storage.local` | Already used for all 20+ settings, handles persistence, sync, and change events |
| Change propagation | Custom event bus | `chrome.storage.onChanged` | Built-in, already used in background.js and config.js, fires cross-context |
| Form validation | Custom validation framework | Standard HTML `min`/`max` + JS parseInt clamping | Simple numeric range, not worth a library |
| Dropdown with custom input | Complex component | Standard `<select>` + conditional `<input>` | The pattern is simple enough; see Architecture Pattern 2 |

**Key insight:** Every piece of infrastructure needed for this phase already exists in the codebase. The config pipeline, storage patterns, onChanged listeners, and UI component styles are all established. The implementation is purely additive to existing patterns.

## Common Pitfalls

### Pitfall 1: Incomplete Dead Code Removal
**What goes wrong:** Removing the function but leaving orphaned comments, JSDoc references, or variable names that mention it.
**Why it happens:** Grep catches exact string matches but misses paraphrases or abbreviations.
**How to avoid:** After removing `waitForActionable`, grep for partial matches like `waitFor`, `actionable`, `Phase 5`, and manually inspect each hit for orphaned references.
**Warning signs:** Comments mentioning "dead code kept" or "Phase 5 will evaluate" still present after removal.

### Pitfall 2: Forgetting content.js.bak
**What goes wrong:** The 486KB backup file `content.js.bak` still contains the old `waitForActionable` function. If the success criterion is "zero results for waitForActionable in the entire codebase," this file must be deleted.
**Why it happens:** Backup files are easy to overlook since they don't affect runtime.
**How to avoid:** Delete `content.js.bak` as part of dead code removal. It served its purpose during Phase 4 modularization and is no longer needed.
**Warning signs:** `grep -r waitForActionable` still returns results from `.bak` file.

### Pitfall 3: Config Race Condition
**What goes wrong:** The ElementCache is created with default maxCacheSize, then the async `chrome.storage.local.get` updates it, but in between the cache has already started filling with the wrong limit.
**Why it matters:** For practical purposes, this is a non-issue. The default (200) is the most common value, and the async update happens in milliseconds. But the code should handle the transition cleanly.
**How to avoid:** When the async config arrives and the size is different from current, just update `maxCacheSize`. Don't clear the cache unless the new size is smaller than current cache count (per user decision).

### Pitfall 4: Dropdown/Custom Input State Sync
**What goes wrong:** User selects "Custom" in dropdown, types 300, then saves. On reload, the dropdown shows "Custom" but the display value shows 300. If user then changes dropdown to "200 (Standard)" and back to "Custom", the custom input might still show 300 or might be blank.
**Why it happens:** Two-control UI (dropdown + input) has state that must be kept in sync.
**How to avoid:** On load, check if stored value matches any preset. If yes, select that preset. If no, select "Custom" and populate the custom input. On save, always read from the hidden input (which both controls write to).

### Pitfall 5: Breaking the Save Bar Workflow
**What goes wrong:** Adding a new setting but forgetting to add it to the `formInputs` array for change detection. Result: changing the setting doesn't show the save bar.
**Why it happens:** The save bar mechanism uses a separate event listener array (options.js line 200-222).
**How to avoid:** Add the new dropdown (and custom input) to the `formInputs` array and add appropriate change/input event listeners that call `markUnsavedChanges()`.

## Code Examples

### Dead Code Removal: waitForActionable

**File: `content/accessibility.js`**
Lines to remove:
- Lines 1094-1251: The `waitForActionable` function definition (including the NOTE comment on line 1097)
- Line 1276: The comment `// Dead code kept for now (Phase 5 will evaluate)`
- Line 1277: `FSB.waitForActionable = waitForActionable;`

**File: `content.js.bak`**
- Delete the entire file (486KB backup from Phase 4 modularization)

### ElementCache Configuration

**File: `content/dom-state.js`** (line 462-576)
Change the constructor to accept a parameter and read config:

```javascript
// Named constant for the default
const DEFAULT_ELEMENT_CACHE_SIZE = 200;

class ElementCache {
  constructor(maxCacheSize = DEFAULT_ELEMENT_CACHE_SIZE) {
    this.cache = new Map();
    this.stateVersion = 0;
    this.observer = null;
    this.maxCacheSize = maxCacheSize;
  }
  // ... rest unchanged
}
```

**File: `config/config.js`** -- Add to defaults:
```javascript
elementCacheSize: 200,
```

**File: `ui/options.js`** -- Add to defaultSettings:
```javascript
elementCacheSize: 200,
```

**File: `ui/options.html`** -- Add inside the DOM Analysis settings card:
```html
<div class="setting-item">
  <div class="setting-label">
    <span>Element Cache Size</span>
    <span class="setting-value-display" id="elementCacheSizeDisplay">200</span>
  </div>
  <select id="elementCacheSizePreset" class="form-select small">
    <option value="50">50 (Minimal - simple pages)</option>
    <option value="100">100 (Light - standard pages)</option>
    <option value="200" selected>200 (Standard - recommended)</option>
    <option value="500">500 (Heavy - complex SPAs)</option>
    <option value="custom">Custom...</option>
  </select>
  <input type="number" id="elementCacheSizeCustom" class="form-input"
         min="10" max="1000" style="display: none; margin-top: 8px;"
         placeholder="Enter value (10-1000)">
  <input type="hidden" id="elementCacheSize" value="200">
  <div class="setting-hint">Cached element lookups for faster repeated queries. Higher values speed up complex pages.</div>
</div>
```

## Discretion Recommendations

### Preset Values
Use: **50, 100, 200, 500**
- 50 (Minimal - simple pages): For lightweight pages with few interactive elements
- 100 (Light - standard pages): Previous default, good for basic browsing
- 200 (Standard - recommended): New default, balanced for typical automation targets
- 500 (Heavy - complex SPAs): For React/Angular apps with hundreds of interactive components

### Minimum Allowed Cache Size
Use: **10 elements**
- Below 10 would cause constant eviction, making the cache counterproductive
- 10 is low enough for extreme memory-constrained scenarios while still being useful
- Enforced via `min="10"` on the custom input and clamping in JS

### Immediate-Effect Mechanism
Use: **`chrome.storage.onChanged` listener in content/dom-state.js**
- Content scripts have full access to `chrome.storage.onChanged` -- no message passing needed
- This is the same pattern `config/config.js` uses (line 58-64) to invalidate its cache
- The listener should be registered right after the `elementCache` singleton is created
- When the new size is smaller than current cache count, call `elementCache.invalidate()` (full clear per user decision)
- When the new size is larger or equal, just update `maxCacheSize` -- no need to clear

### Config Read Path in Content Script
Use: **Async read at module load + onChanged listener**
1. Create `elementCache` with `DEFAULT_ELEMENT_CACHE_SIZE` (200) synchronously
2. Immediately after creation, call `chrome.storage.local.get(['elementCacheSize'])` to read any stored value
3. Register `chrome.storage.onChanged` listener for live updates
4. This pattern matches how the captcha config is read in `content/actions.js` (line 2574) -- proven to work in content scripts

## Codebase Inventory

### Files Requiring Modification
| File | Changes | Risk |
|------|---------|------|
| `content/accessibility.js` | Remove `waitForActionable` (lines 1094-1277) | Low - zero callers confirmed |
| `content/dom-state.js` | Add `DEFAULT_ELEMENT_CACHE_SIZE`, parameterize constructor, add storage read + listener | Low - additive change |
| `config/config.js` | Add `elementCacheSize: 200` to defaults | Low - additive |
| `ui/options.html` | Add dropdown + custom input in DOM Analysis card | Low - additive |
| `ui/options.js` | Add to defaultSettings, cacheElements, loadSettings, saveSettings, formInputs, event listeners | Low - follows existing pattern exactly |

### Files Requiring Deletion
| File | Size | Reason |
|------|------|--------|
| `content.js.bak` | 486KB | Backup from Phase 4 modularization, contains dead `waitForActionable` copy, no longer needed |

### Files Requiring Dead Code Sweep (No Changes Expected)
| File | Sweep Result |
|------|-------------|
| `background.js` | No dead code found (no TODOs, no unreferenced functions) |
| `ai/ai-integration.js` | `speedMode` migration logic is still needed for legacy upgrades -- not dead |
| `ai/universal-provider.js` | No dead code found |
| `ai/ai-providers.js` | No dead code found |
| `ui/popup.js` | Needs verification sweep |
| `ui/sidepanel.js` | Needs verification sweep |
| `ui/options.js` | `speedMode` migration logic still needed -- not dead |
| `config/config.js` | `speedMode` default still needed for migration -- not dead |
| `config/init-config.js` | Needs verification sweep |
| `config/secure-config.js` | Needs verification sweep |
| `utils/automation-logger.js` | Needs verification sweep |
| `utils/analytics.js` | Needs verification sweep |
| `content/utils.js` | All exports referenced by consumers |
| `content/dom-state.js` | All exports referenced by consumers |
| `content/selectors.js` | All exports referenced by consumers |
| `content/visual-feedback.js` | All exports referenced by consumers |
| `content/actions.js` | Needs verification sweep for internal dead paths |
| `content/dom-analysis.js` | All exports referenced by consumers |
| `content/messaging.js` | All exports referenced by consumers |
| `content/lifecycle.js` | All exports referenced by consumers |
| `content/init.js` | No functions to be dead -- just setup |

## Open Questions

1. **utils/dom-state-manager.js**: This file in the `utils/` directory appears to be a standalone copy of DOMStateManager (used outside the content script context, possibly in tests or utilities). It should be verified during the sweep -- if nothing imports it and it's not in the injection pipeline, it may be dead code.
   - What we know: It exists at `utils/dom-state-manager.js`, has its own `elementCache` Map (not the ElementCache class), and is not in the `CONTENT_SCRIPT_FILES` array.
   - What's unclear: Whether background.js or any other file uses it.
   - Recommendation: Grep for imports/references. If none found, flag for removal.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files mentioned in this document
- `content/accessibility.js` -- waitForActionable function (lines 1094-1277)
- `content/dom-state.js` -- ElementCache class (lines 462-573)
- `config/config.js` -- Config class and defaults
- `ui/options.js` -- Settings pipeline (loadSettings, saveSettings, cacheElements)
- `ui/options.html` -- Advanced Settings section structure
- `background.js` -- chrome.storage.onChanged listener (lines 8952-8971)
- `manifest.json` -- No content_scripts (programmatic injection only)

### Verification
- Grep for `waitForActionable` across entire codebase: 3 results (definition, export, .bak copy) -- zero callers
- Grep for all `FSB.*=` exports in content/: all verified to have at least one consumer except `waitForActionable`
- Grep for `chrome.storage.local` in content/: confirmed content scripts can access chrome.storage (actions.js line 2574)

## Metadata

**Confidence breakdown:**
- Dead code identification: HIGH - grep-verified zero callers for waitForActionable, all other exports have consumers
- Configuration plumbing: HIGH - exact same pattern already exists for maxDOMElements, maxIterations, debugMode
- UI implementation: HIGH - using existing CSS classes and HTML patterns
- Live update mechanism: HIGH - chrome.storage.onChanged already used in background.js and config.js

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable -- internal codebase, no external dependencies)
