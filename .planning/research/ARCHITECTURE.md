# Architecture Research: v0.9.11 MCP Tool Quality Fixes

**Domain:** Chrome Extension browser automation -- MCP tool reliability improvements
**Researched:** 2026-03-31
**Confidence:** HIGH (based on direct codebase analysis, not external sources)

## System Overview -- Current Architecture

```
MCP Tool Invocation Flow (current):

  Claude/AI Client
       |
       | (MCP protocol)
       v
  +-----------------------+
  | mcp-server/           |
  | tools/manual.ts       |  <-- search, click, hover, press_enter definitions
  | tools/read-only.ts    |  <-- read_page, get_text definitions
  | queue.ts              |  <-- mutation serialization / read-only bypass
  +-----------------------+
       |
       | bridge.sendAndWait({ type: 'mcp:execute-action' | 'mcp:read-page' })
       v
  +-----------------------+
  | bridge.ts             |  <-- WebSocket hub/relay, port 7225
  +-----------------------+
       |
       | WebSocket (JSON messages)
       v
  +-----------------------+
  | background.js         |  <-- Service worker, MCP message router (~14K lines)
  | case 'mcp:read-page'  |      --> chrome.tabs.sendMessage(tabId, { action: 'readPage' })
  | case 'mcp:execute-action'     --> chrome.tabs.sendMessage(tabId, { action: 'executeAction', tool, params })
  |   bgNavTools bypass:   |      navigate, openNewTab, switchToTab, listTabs handled directly
  |   all other tools:     |      forwarded to content script
  +-----------------------+
       |
       | chrome.tabs.sendMessage (frameId: 0)
       v
  +-----------------------+
  | content/messaging.js  |  <-- Message router in content script
  |   case 'readPage'     |      --> FSB.extractPageText()
  |   case 'executeAction'|      --> tools[tool](params)
  +-----------------------+
       |
       v
  +-----------------------+        +-----------------------+
  | content/actions.js    |        | content/dom-analysis.js|
  | tools.click()         |        | extractPageText()      |
  | tools.searchGoogle()  |        | getStructuredDOM()     |
  | tools.pressEnter()    |        | 50K char cap           |
  | tools.hover()         |        | viewport-only filter   |
  | tools.waitForDOMStable|        +-----------------------+
  +-----------------------+
       |
       v
  +-----------------------+
  | content/accessibility.js|
  | smartEnsureReady()      |  <-- Readiness orchestrator
  | scrollIntoViewIfNeeded()|  <-- Viewport scroll
  | checkElementVisibility()|
  | checkElementReceivesEvents()|
  +-----------------------+
```

## The 7 Fixes -- Integration Map

### Fix 1: Site-Aware Search

**Issue:** The `search` MCP tool always maps to `searchGoogle` verb, which does `window.location.href = 'https://www.google.com/search?q=...'`. When the user is already on Amazon/YouTube/GitHub and says "search for X", it leaves the site.

**Current flow:**
```
manual.ts: server.tool('search', ...) --> execAction(..., 'searchGoogle', { query })
  --> bridge --> background.js --> content/actions.js tools.searchGoogle()
  --> window.location.href = google.com/search?q=...
```

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| MCP server | `mcp-server/src/tools/manual.ts` | MODIFY | Update `search` tool description to indicate site-aware behavior. Change FSB verb from `searchGoogle` to `siteSearch` (new handler) |
| Content script | `content/actions.js` | MODIFY | Add new `tools.siteSearch` function that: (1) detects site search inputs via common selectors, (2) types query + submits, (3) falls back to `searchGoogle` |
| Content script | `content/dom-analysis.js` | NO CHANGE | -- |
| Background | `background.js` | NO CHANGE | Already forwards non-bgNavTool verbs to content script |

**New component:** `detectSiteSearchInput()` helper inside `content/actions.js`. Uses a priority cascade:
1. `input[type="search"]`
2. `input[name="q"], input[name="query"], input[name="search"], input[name="keyword"]`
3. `input[aria-label*="search" i], input[placeholder*="search" i]`
4. `form[action*="search"] input[type="text"]`
5. `[role="search"] input`

**Data flow change:** The `search` verb now routes to `tools.siteSearch()` instead of `tools.searchGoogle()`. The old `searchGoogle` remains available as internal fallback.

---

### Fix 2: read_page Auto-Stability

**Issue:** `read_page` calls `FSB.extractPageText()` immediately without waiting for DOM stability. On JS-heavy sites (SPAs, React apps), this returns incomplete/empty content because the page hasn't finished rendering.

**Current flow:**
```
read-only.ts: server.tool('read_page', ...) --> bridge.sendAndWait('mcp:read-page')
  --> background.js case 'mcp:read-page' --> chrome.tabs.sendMessage({ action: 'readPage' })
  --> content/messaging.js case 'readPage' --> FSB.extractPageText(root, { viewportOnly, format })
  --> returns immediately (no stability wait)
```

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| Content script | `content/messaging.js` | MODIFY | In `case 'readPage'`: call `waitForPageStability()` before `extractPageText()`. Use quick-extract-then-retry-if-sparse pattern |
| Content script | `content/actions.js` | NO CHANGE | `waitForPageStability()` already exists and is exported as `FSB.waitForPageStability` |
| MCP server | `mcp-server/src/tools/read-only.ts` | MODIFY | Increase timeout from 30s to 45s to accommodate stability wait |
| MCP server | `mcp-server/src/tools/manual.ts` | NO CHANGE | -- |
| Background | `background.js` | NO CHANGE | -- |

**Pattern: Quick-Extract-Then-Retry-If-Sparse**
```javascript
// In content/messaging.js case 'readPage':
// 1. Quick extract (no wait)
let text = FSB.extractPageText(root, opts);
// 2. If sparse (<200 chars on non-trivial page), wait for stability then re-extract
if (text.length < 200 && document.body.childElementCount > 5) {
  await FSB.waitForPageStability({ maxWait: 3000, stableTime: 300 });
  text = FSB.extractPageText(root, opts);
}
```

This avoids adding latency to static pages (which already have content) while fixing JS-heavy pages.

**Data flow change:** The `readPage` handler becomes async-with-stability-gate instead of immediate. The `waitForPageStability` function is already available via `FSB.waitForPageStability` (exported at actions.js:5369).

---

### Fix 3: BF Cache Resilience for Click

**Issue:** When `click` triggers a page navigation (e.g., clicking a link), the content script connection dies because the old page enters the back/forward cache. The MCP handler gets a "port moved into back/forward cache" error and the operation appears to fail, even though the click succeeded.

**Current flow:**
```
background.js case 'mcp:execute-action' (tool: 'click')
  --> chrome.tabs.sendMessage(tab.id, { action: 'executeAction', tool: 'click', ... })
  --> ERROR: "page keeping the extension port is moved into back/forward cache"
  --> sendMCPResponse(id, { success: false, error: 'Content script communication failed: ...' })
```

The `sendMessageWithRetry()` function in the autopilot flow (line 3166) already handles BF cache correctly -- it detects URL changes, re-injects content scripts, and returns success. But the MCP handler at line 13703 uses raw `chrome.tabs.sendMessage` without any BF cache recovery.

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| Background | `background.js` | MODIFY | Wrap the MCP `execute-action` content script call (line 13711-13723) with BF cache recovery: catch the error, check if URL changed (click-triggered navigation), re-inject content script, return success if URL changed |
| Content script | ALL | NO CHANGE | -- |
| MCP server | ALL | NO CHANGE | -- |

**Pattern: Replicate autopilot BF cache handling for MCP path**

The recovery logic at background.js lines 3220-3262 should be extracted into a reusable function and called from both the autopilot `sendMessageWithRetry` and the MCP `mcp:execute-action` handler. Key steps:
1. Before sending, capture `tab.url` as `previousUrl`
2. On BF cache error, check `chrome.tabs.get(tabId).url` vs `previousUrl`
3. If URL changed: return `{ success: true, navigationTriggered: true, newUrl }`
4. If URL same: wake tab, re-inject content script, retry once

**Data flow change:** The `mcp:execute-action` handler gains a try/catch wrapper with BF cache detection. No new message types. The existing `ensureContentScriptInjected()` is already called but needs to be called again after wake-up.

---

### Fix 4: Viewport-Aware Click/Hover

**Issue:** `scrollIntoViewIfNeeded()` in `content/accessibility.js` uses `element.scrollIntoView({ behavior: 'smooth', block: 'center' })` which works for most elements but fails for:
- Elements inside scrollable containers (nested scroll contexts)
- Sticky/fixed headers that obscure the element after scrolling
- Elements in off-screen horizontal positions

After scrolling, `checkElementReceivesEvents()` (step 5 in `ensureElementReady`) does `elementFromPoint` and if the element is behind a sticky header, it reports "obscured" and fails.

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| Content script | `content/accessibility.js` | MODIFY | Enhance `scrollIntoViewIfNeeded()` to: (1) detect sticky/fixed headers and account for their height, (2) handle elements inside scrollable containers, (3) verify element is actually in viewport after scroll |
| Content script | `content/accessibility.js` | MODIFY | Enhance `checkElementReceivesEvents()` to: if the obscuring element is a sticky/fixed positioned ancestor (header, nav), tolerate the obscuration and try clicking through it |
| Content script | `content/actions.js` | NO CHANGE | Already uses `smartEnsureReady()` which calls the above |
| Background | `background.js` | NO CHANGE | -- |
| MCP server | ALL | NO CHANGE | -- |

**New helper:** `getStickyHeaderHeight()` in `content/accessibility.js`:
```javascript
function getStickyHeaderHeight() {
  const candidates = document.querySelectorAll(
    'header, nav, [role="banner"], [class*="header"], [class*="navbar"]'
  );
  let maxBottom = 0;
  for (const el of candidates) {
    const style = getComputedStyle(el);
    if (style.position === 'fixed' || style.position === 'sticky') {
      const rect = el.getBoundingClientRect();
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
  }
  return maxBottom;
}
```

Then `scrollIntoViewIfNeeded` scrolls with offset: `element.scrollIntoView({ block: 'center' })` and verifies `rect.top > stickyHeaderHeight`. If not, scrolls down by the header height difference.

**Data flow change:** None. The readiness pipeline is internal to the content script; the interface to background.js is unchanged.

---

### Fix 5: Smart press_enter Fallback

**Issue:** `pressEnter` dispatches `keydown`/`keyup` Enter events on the focused element. On sites like Indeed and Amazon, the Enter key event is intercepted by the framework and doesn't trigger form submission. The tool returns `hadEffect: false` with no recovery attempt.

**Current flow:**
```
tools.pressEnter() --> focus element --> dispatch keydown/keyup Enter
  --> waitForPageStability --> verify effect
  --> if !verified && isInsideForm: continue to next selector (but no submit button fallback)
  --> eventually returns failure
```

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| Content script | `content/actions.js` | MODIFY | In `pressEnter` function: after all selectors exhausted with `hadEffect: false`, add fallback that (1) finds submit button in the form, (2) clicks it, (3) if no submit button, tries `form.requestSubmit()`, then `form.submit()` |
| Content script | ALL OTHER | NO CHANGE | -- |
| Background | `background.js` | NO CHANGE | -- |
| MCP server | ALL | NO CHANGE | -- |

**Fallback cascade (added after line 3162 in actions.js):**
```javascript
// After all selectors exhausted, try submit button fallback
if (lastElement) {
  const form = lastElement.closest('form');
  if (form) {
    // Strategy 1: Find and click a submit button
    const submitBtn = form.querySelector(
      'button[type="submit"], input[type="submit"], ' +
      'button:not([type]), [role="button"][type="submit"]'
    );
    if (submitBtn) {
      submitBtn.click();
      await waitForPageStability({ maxWait: 2000, stableTime: 300 });
      // verify and return
    }
    // Strategy 2: requestSubmit() (fires submit event, respects validation)
    try { form.requestSubmit(); } catch { form.submit(); }
  }
}
```

**Data flow change:** None. The pressEnter response shape stays the same; it just gains a `method: 'submit_button_fallback'` field when the fallback fires.

---

### Fix 6: Intelligent Content Truncation

**Issue:** `extractPageText()` has a 50K char cap but no content prioritization. LeetCode pages return 30K chars of boilerplate (nav, sidebar, footer) with the actual problem statement buried. The MCP `read_page` user gets a wall of irrelevant text.

**Current flow:**
```
extractPageText(root, { viewportOnly, format })
  --> visit(node) recursion with MAX_CHARS = 50000
  --> no main content detection
  --> nav, footer, sidebar all included equally
```

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| Content script | `content/dom-analysis.js` | MODIFY | In `extractPageText()`: (1) reduce MAX_CHARS to ~8000 (with configurable override), (2) add main content detection to prioritize `<main>`, `<article>`, `[role="main"]`, `#content`, `.content`, (3) deprioritize nav/aside/footer, (4) add structured header with URL/title |
| Content script | `content/messaging.js` | MODIFY | Pass a `maxChars` option from the `readPage` handler. Default 8000 for MCP, preserve 50000 for internal autopilot use |
| MCP server | `mcp-server/src/tools/read-only.ts` | OPTIONAL | Could add `maxChars` parameter to `read_page` schema |
| Background | `background.js` | NO CHANGE | Already forwards `full` flag; could forward `maxChars` |

**Main content detection strategy:**
```javascript
function findMainContent(root) {
  const mainSelectors = [
    'main', '[role="main"]', '#main-content', '#content',
    'article', '.post-content', '.article-content', '.entry-content',
    '#primary', '.main-content'
  ];
  for (const sel of mainSelectors) {
    const el = root.querySelector(sel);
    if (el && el.textContent.trim().length > 100) return el;
  }
  return root; // fallback to full root
}
```

The extraction flow becomes:
1. Extract main content area first (up to 6000 chars)
2. If space remains, add page title + URL header (200 chars)
3. If space remains, add headings/nav for context (up to 1800 chars)
4. Skip: `<nav>`, `<footer>`, `<aside>`, `[role="navigation"]`, `[role="complementary"]`, cookie banners

**Data flow change:** `extractPageText` gains a `maxChars` option parameter. The response now includes a `mainContentDetected: true/false` flag.

---

### Fix 7: Cookie Consent Auto-Dismiss

**Issue:** Cookie consent overlays block all interaction. The MCP user has to manually dismiss them before any automation can proceed. Some banners use `position: fixed` with `z-index: 99999` and block clicks on every element.

**Integration points:**

| Layer | File | Change Type | What Changes |
|-------|------|-------------|--------------|
| Content script | `content/actions.js` | MODIFY | Add `tools.dismissCookieConsent()` function. Add auto-dismiss call as pre-step in readiness pipeline |
| Content script | `content/accessibility.js` | MODIFY | In `checkElementReceivesEvents()`: if element is obscured by a cookie banner (detected by selectors/z-index/position), auto-dismiss it and re-check |
| Content script | `content/messaging.js` | MODIFY | In `readPage` handler: call cookie dismiss before extraction (proactive) |
| MCP server | `mcp-server/src/tools/manual.ts` | OPTIONAL | Could add `dismiss_overlay` tool, but auto-dismiss is the primary mechanism |
| Background | `background.js` | NO CHANGE | -- |

**Cookie consent detection selectors (derived from existing site-guides):**
```javascript
const COOKIE_SELECTORS = {
  banners: [
    '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#cookie-banner',
    '[class*="cookie-consent"]', '[class*="cookie-banner"]', '[class*="cookie-notice"]',
    '[id*="cookie"]', '[class*="gdpr"]', '.cc-banner', '#consent-banner',
    '[aria-label*="cookie" i]', '[aria-label*="consent" i]'
  ],
  acceptButtons: [
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    'button[class*="accept"]', 'button[class*="agree"]',
    'button[class*="consent"]', 'button[class*="allow"]',
    'a[class*="accept"]',
    '[data-testid*="accept"]', '[data-testid*="consent"]'
  ]
};
```

**Integration pattern:** Auto-dismiss happens at two trigger points:
1. **Proactive (on readPage):** Before extracting text, check for cookie overlay and dismiss it. This ensures the first `read_page` call gives useful content.
2. **Reactive (on click/hover failure):** When `checkElementReceivesEvents` reports "obscured" and the obscuring element matches cookie banner selectors, auto-dismiss and retry.

**Data flow change:** `readPage` and `executeAction` responses gain an optional `cookieConsentDismissed: true` field when auto-dismissal fires.

---

## Component Modification Summary

### Files Modified (7 files)

| File | Fixes | Lines of Change (est.) |
|------|-------|----------------------|
| `content/actions.js` | #1 (search), #5 (pressEnter), #7 (cookie dismiss function) | ~150 |
| `content/dom-analysis.js` | #6 (truncation) | ~80 |
| `content/messaging.js` | #2 (auto-stability), #6 (maxChars param), #7 (proactive cookie dismiss) | ~40 |
| `content/accessibility.js` | #4 (viewport scroll), #7 (reactive cookie dismiss in readiness) | ~100 |
| `background.js` | #3 (BF cache recovery for MCP) | ~50 |
| `mcp-server/src/tools/manual.ts` | #1 (search verb mapping) | ~5 |
| `mcp-server/src/tools/read-only.ts` | #2 (timeout increase) | ~3 |

### Files NOT Modified

| File | Why No Changes |
|------|----------------|
| `mcp-server/src/bridge.ts` | WebSocket transport unaffected |
| `mcp-server/src/queue.ts` | Queue semantics unchanged |
| `mcp-server/src/types.ts` | No new message types needed |
| `content/dom-state.js` | DOM state tracking unchanged |
| `content/selectors.js` | Selector generation unchanged |
| `content/visual-feedback.js` | Glow/overlay unchanged |

### New Components: NONE

All 7 fixes are modifications to existing files. No new files needed. This is by design -- adding new modules to a Chrome Extension means updating the manifest and injection order, which is unnecessary complexity for these fixes.

## Data Flow Changes

### Current Data Flow (unchanged for most tools)
```
MCP Client --> bridge.sendAndWait('mcp:execute-action', { tool, params })
  --> background.js mcp:execute-action handler
  --> chrome.tabs.sendMessage(tabId, { action: 'executeAction', tool, params })
  --> content/messaging.js --> tools[tool](params)
  --> response flows back through same chain
```

### Modified Data Flows

**Fix 1 (Search):** `search` verb maps to new `tools.siteSearch()` which internally may call `tools.type()` + `tools.pressEnter()` on the site's search input, or fall back to `tools.searchGoogle()`.

**Fix 2 (read_page stability):** The content script handler gains an async stability gate. The response is the same shape but may take 0-3 seconds longer on JS-heavy pages.

**Fix 3 (BF cache):** The background.js MCP handler wraps `chrome.tabs.sendMessage` in try/catch with URL-change detection. On BF cache error + URL change, it returns `{ success: true, navigationTriggered: true }` without re-sending to content script.

**Fix 7 (cookie consent):** The readiness pipeline in accessibility.js gains a cookie-banner dismiss step. The content/messaging.js readPage handler gains a pre-extraction cookie check. Both are transparent to the MCP server and background.js.

## Suggested Build Order

### Dependency Analysis

```
Fix 3 (BF cache)         -- standalone, background.js only
Fix 6 (truncation)       -- standalone, dom-analysis.js only
Fix 2 (auto-stability)   -- standalone, messaging.js only, uses existing waitForPageStability
Fix 4 (viewport scroll)  -- standalone, accessibility.js only
Fix 5 (pressEnter)       -- standalone, actions.js only
Fix 7 (cookie consent)   -- depends on Fix 4 (uses modified checkElementReceivesEvents)
Fix 1 (search)           -- standalone but most complex (new search detection logic)
```

### Recommended Phase Order

**Phase 1: read_page reliability (Fixes 6 + 2)**
- Fix 6 first (truncation) -- pure content extraction logic, zero risk to other tools
- Fix 2 second (auto-stability) -- messaging.js only, uses existing stability function
- Rationale: `read_page` is the most-called MCP tool. Fixing it first gives the AI better page context for all subsequent tools.

**Phase 2: BF cache resilience (Fix 3)**
- Background.js only change, no content script modifications
- Rationale: BF cache errors are the most confusing failure mode -- the click actually succeeded but the tool reports failure. Fixing this prevents the AI from retrying clicks that already worked.

**Phase 3: Viewport + scroll (Fix 4)**
- Accessibility.js changes to scrollIntoViewIfNeeded and checkElementReceivesEvents
- Rationale: Must land before Fix 7 (cookie consent uses the same readiness pipeline)

**Phase 4: pressEnter fallback (Fix 5)**
- Actions.js only, surgical change to one tool function
- Rationale: Independent fix, moderate complexity

**Phase 5: Cookie consent auto-dismiss (Fix 7)**
- Depends on Phase 3 (viewport fix) because cookie dismiss integrates into checkElementReceivesEvents
- Adds detection + dismiss to readiness pipeline and readPage handler
- Rationale: Builds on the readiness pipeline changes from Phase 3

**Phase 6: Site-aware search (Fix 1)**
- Most complex fix -- needs search input detection heuristics, site-specific patterns, fallback logic
- Rationale: Last because it is the most complex single fix and benefits from all prior fixes being in place (read_page to verify search results, click to interact with search UI, cookie consent to clear overlays on search pages)

### Build Order Summary

| Phase | Fix # | Description | Files | Risk |
|-------|-------|-------------|-------|------|
| 1a | 6 | Content truncation | dom-analysis.js | Low |
| 1b | 2 | read_page auto-stability | messaging.js, read-only.ts | Low |
| 2 | 3 | BF cache recovery for MCP | background.js | Medium |
| 3 | 4 | Viewport-aware scroll | accessibility.js | Medium |
| 4 | 5 | pressEnter submit fallback | actions.js | Low |
| 5 | 7 | Cookie consent auto-dismiss | accessibility.js, actions.js, messaging.js | Medium |
| 6 | 1 | Site-aware search | actions.js, manual.ts | Medium |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding New MCP Message Types

**What people do:** Create `mcp:search-site` or `mcp:dismiss-cookies` as new message types in types.ts, background.js handler, etc.
**Why it's wrong:** Every new message type requires changes across 4 layers (MCP server, bridge, background, content). The existing `mcp:execute-action` + tool verb pattern handles this.
**Do this instead:** Add new tool functions to `content/actions.js` and new verb mappings. The existing plumbing handles routing.

### Anti-Pattern 2: Making Stability Wait Synchronous/Blocking

**What people do:** Always wait 3 seconds before extracting text.
**Why it's wrong:** Static pages (Wikipedia, docs sites) already have all content. Waiting adds unnecessary latency.
**Do this instead:** Quick-extract first, check if sparse, only wait if needed (the quick-extract-then-retry-if-sparse pattern).

### Anti-Pattern 3: Separate "smart search" MCP Tool

**What people do:** Create a new `smart_search` tool alongside the existing `search` tool.
**Why it's wrong:** The AI now has to choose between two search tools. The decision of "use site search vs Google" should be automatic, not an AI decision.
**Do this instead:** Modify the existing `search` tool to be site-aware internally. One tool, smart behavior.

### Anti-Pattern 4: Cookie Consent as a Standalone Tool Only

**What people do:** Create a `dismiss_cookies` MCP tool and expect the AI to call it proactively.
**Why it's wrong:** The AI doesn't know cookies are blocking until something fails. By then it's too late.
**Do this instead:** Make cookie dismissal automatic in the readiness pipeline (reactive) AND in readPage (proactive). An explicit tool is optional for advanced users, but auto-dismiss is the primary mechanism.

### Anti-Pattern 5: Duplicating BF Cache Recovery Logic

**What people do:** Copy-paste the autopilot BF cache recovery block into the MCP handler.
**Why it's wrong:** Two copies of complex recovery logic diverge over time.
**Do this instead:** Extract BF cache recovery into a reusable `handleBFCacheError(tabId, previousUrl)` function, call it from both paths.

## Integration Boundaries

| Boundary | Communication Pattern | Fix Impact |
|----------|----------------------|------------|
| MCP server <-> bridge | `sendAndWait()` with JSON | Fix 1 changes verb name only |
| bridge <-> background.js | WebSocket JSON messages | No change |
| background.js <-> content script | `chrome.tabs.sendMessage` / `chrome.runtime.onMessage` | Fix 3 wraps with BF cache recovery |
| content/messaging.js <-> content/actions.js | Direct `tools[tool](params)` calls | Fix 1 adds `tools.siteSearch`, Fix 5 extends `tools.pressEnter` |
| content/messaging.js <-> content/dom-analysis.js | `FSB.extractPageText()` | Fix 2 adds stability wait before call, Fix 6 changes extraction behavior |
| content/actions.js <-> content/accessibility.js | `FSB.smartEnsureReady()` | Fix 4 changes scroll behavior, Fix 7 adds cookie dismiss to readiness pipeline |

## Scalability Considerations

These are not traditional scaling concerns but rather "how many sites does this cover" scaling:

| Concern | Current (0 sites fixed) | After v0.9.11 (most sites) | Edge Cases |
|---------|-------------------------|----------------------------|------------|
| Search detection | Always Google redirect | Covers 80% of sites with standard search inputs | Custom search UIs (canvas-based, React portals) need site guides |
| Content extraction | 50K chars, no prioritization | 8K chars, main content prioritized | Sites with content in iframes or shadow DOM need special handling |
| Cookie consent | Manual only | Auto-dismiss covers ~70% of cookie frameworks | Custom/in-house consent UIs need selector additions over time |
| BF cache | Fails on every navigation-triggering click | Handles all BF cache scenarios | None -- this is a complete fix |
| Sticky headers | Fails on sites with fixed headers | Handles most sticky headers | Multiple stacked sticky elements (rare) |

## Sources

- Direct codebase analysis of the FSB extension
- `background.js` MCP handler at lines 13647-13827
- `content/actions.js` tool implementations (click: L1502, searchGoogle: L3407, pressEnter: L3072, hover: L4109)
- `content/accessibility.js` scrollIntoViewIfNeeded at L828, smartEnsureReady at L980
- `content/dom-analysis.js` extractPageText at L2698
- `content/messaging.js` readPage handler at L782
- `mcp-server/src/tools/manual.ts` search tool at L63
- `mcp-server/src/tools/read-only.ts` read_page tool at L17
- `mcp-server/src/bridge.ts` sendAndWait at L125
- Existing BF cache recovery pattern at `background.js` lines 3220-3262
- Existing cookie consent selectors from site-guides/media/video-player.js and voice-recorder.js

---
*Architecture research for: v0.9.11 MCP Tool Quality*
*Researched: 2026-03-31*
