# Domain Pitfalls: v0.9.11 MCP Tool Quality Fixes

**Domain:** Chrome Extension MV3 browser automation -- fixing 7 systemic MCP tool issues
**Researched:** 2026-03-31
**Confidence:** HIGH (verified against codebase, Chrome docs, and ecosystem experience)

---

## Critical Pitfalls

Mistakes that cause cascading failures, broken automation sessions, or require rework of the fix itself.

---

### Pitfall 1: BF Cache Port Closure Triggers Premature Re-injection

**What goes wrong:** Starting in Chrome 123, when a page enters BF cache, Chrome proactively closes all extension message ports from the content script side. The existing `backgroundPort.onDisconnect` listener in `content/lifecycle.js` (line 514) triggers reconnection attempts with exponential backoff. If the background service worker also detects the disconnect and calls `ensureContentScriptInjected()`, you get two independent code paths both trying to re-inject -- the content script trying to reconnect via `establishBackgroundConnection()` AND the background calling `chrome.scripting.executeScript()` with the full CONTENT_SCRIPT_FILES list.

**Why it happens:** The existing `__FSB_CONTENT_SCRIPT_LOADED__` guard in `content/init.js` (line 6) prevents double initialization when re-injection fires. But the guard is a window-level flag. When the page is restored from BF cache, the original JavaScript context is unfrozen with the flag still set to `true`. This means the re-injection via `chrome.scripting.executeScript()` correctly bails out -- but the EXISTING content script's port is dead. The unfrozen content script tries to reconnect via `establishBackgroundConnection()`, but the background may have already given up waiting (MAX_RECONNECT_ATTEMPTS = 5 with backoff delays).

**Consequences:**
- Silent communication failure: content script is alive but port is dead
- `chrome.tabs.sendMessage()` fails because the port was closed and no new one established
- All subsequent automation actions fail with "Could not establish connection"
- The session appears stuck -- no error visible to user

**Prevention:**
1. Add `pageshow` event listener in `content/lifecycle.js` that fires BEFORE the `onDisconnect` backoff logic:
   ```javascript
   window.addEventListener('pageshow', (event) => {
     if (event.persisted) {
       // BF cache restore -- reset port and re-establish immediately
       backgroundPort = null;
       reconnectAttempts = 0;
       establishBackgroundConnection();
     }
   });
   ```
2. In the background's BF_CACHE recovery handler (line 2410), do NOT call `ensureContentScriptInjected()` as the first step. Instead, wait for the content script's own `pageshow` reconnection, with a 2-second timeout before fallback to re-injection.
3. Add a `pagehide` listener that distinguishes BF cache entry from actual unload:
   ```javascript
   window.addEventListener('pagehide', (event) => {
     if (event.persisted) {
       // Going into BF cache -- port will be closed by Chrome
       // Mark state so pageshow handler knows to reconnect
     }
   });
   ```

**Detection:** Content script port is null but `__FSB_CONTENT_SCRIPT_LOADED__` is true. Background `checkContentScriptHealth()` returns false despite tab being active and page loaded.

**Phase relevance:** BF cache resilience phase. Must be implemented first because all other fixes depend on reliable content script communication.

---

### Pitfall 2: Re-injection Guard Blocks Necessary Re-injection After Navigation

**What goes wrong:** The `window.__FSB_CONTENT_SCRIPT_LOADED__` guard in `content/init.js` prevents duplicate injection. But after certain navigation types -- particularly SPA navigations that replace the document (rare but real: `document.open()`/`document.write()` patterns, some heavy SPA frameworks) -- the window object persists but the DOM is entirely replaced. The guard flag remains `true`, so `ensureContentScriptInjected()` injects the files but `init.js` sees the flag and sets `__FSB_SKIP_INIT__` to `true`, causing every subsequent module to skip initialization.

**Why it happens:** The guard checks `window.__FSB_CONTENT_SCRIPT_LOADED__` but not whether the FSB namespace and its modules are actually functional. The flag is a boolean; it cannot distinguish between "fully loaded and working" vs "flag survived but context is broken."

**Consequences:**
- Content script injection appears to succeed (no error thrown)
- All modules bail out silently (`if (window.__FSB_SKIP_INIT__) return;`)
- Background thinks injection worked because `chrome.scripting.executeScript()` resolved
- All message handlers are gone -- actions fail silently

**Prevention:**
1. Change the guard to validate FSB namespace health, not just flag existence:
   ```javascript
   const isHealthy = window.__FSB_CONTENT_SCRIPT_LOADED__ &&
     window.FSB &&
     window.FSB._modules &&
     Object.keys(window.FSB._modules).length >= 8; // minimum expected modules
   ```
2. If the flag is set but modules are missing, treat as a broken state: clear the flag and reinitialize.
3. In `ensureContentScriptInjected()` (background.js line 2680+), after injection, verify health with a ping that checks FSB namespace completeness, not just message response.

**Detection:** `checkContentScriptHealth()` returns false even after successful `executeScript()` call. The tab shows the page normally but no FSB operations work.

---

### Pitfall 3: MutationObserver Infinite Loop in DOM Stability Detection

**What goes wrong:** Both `waitForDOMStable` (actions.js line 3530) and `waitForPageStability` (actions.js line 1138) create new MutationObservers that watch for DOM changes. If the code that CHECKS stability itself triggers DOM changes (e.g., reading `getComputedStyle()` forces reflow that triggers attribute changes, or the existing lifecycle MutationObserver in lifecycle.js line 381 fires `chrome.runtime.sendMessage()` which triggers UI updates in an SPA), the stability check never resolves.

**Why it happens:** The existing observer in `lifecycle.js` already filters insignificant mutations (style-only, hidden elements, script/style tags). But the waitForDOMStable observer uses a DIFFERENT filter -- it only skips `.loading`, `.spinner`, `.progress` class mutations. Some sites have CSS animations on hover states, cursor blinks in text inputs, live clocks, ad rotations, or chat notification badges that continuously mutate the DOM. The stableTime of 500ms is never reached because mutations arrive every 100-300ms.

**Consequences:**
- `waitForDOMStable` always times out (hits maxWait of 5000ms)
- Every action takes 5 seconds instead of ~500ms
- Sessions that should take 30 seconds take 5+ minutes
- On sites with aggressive animations (trading dashboards, social feeds), the timeout is hit on EVERY action

**Prevention:**
1. Align the mutation filter in `waitForDOMStable` with the more sophisticated filter in `lifecycle.js` `isSignificantMutation()`.
2. Add CSS animation detection: mutations caused by CSS animations/transitions should be excluded:
   ```javascript
   // Skip elements currently animating
   if (mutation.target.getAnimations && mutation.target.getAnimations().length > 0) {
     return false;
   }
   ```
3. Implement a "diminishing returns" threshold: if mutation rate is constant (not decreasing), declare stable after observing the pattern for 1 second regardless of individual stableTime gaps.
4. The lifecycle observer and stability observer should share a single observer instance or at least share the filter function, not define separate filters.

**Detection:** Every `waitForDOMStable` call returns `{ timedOut: true }` on a particular site. Check `changeCount` in the result -- if it is consistently high (>50) but the page looks stable to a human, the filter is too permissive.

---

### Pitfall 4: fetch/XHR Monkey-Patching Leak in Stability Detection

**What goes wrong:** Both `waitForPageStability` (line 1159) and `waitForDOMStable` (line 3537) monkey-patch `window.fetch` and `XMLHttpRequest.prototype.open/send` to track network activity. If the stability check times out or an error is thrown before the cleanup code runs, the patched versions remain. Worse: if two stability checks overlap (one from `waitForStability('click')` and another triggered by a different message handler), the second patch wraps the first patch, and the cleanup only restores the second's saved reference -- leaving the first patch permanently installed.

**Why it happens:** The cleanup is in a finally block or at the end of the setTimeout chain, but there is no protection against overlapping calls. The pattern `const originalFetch = window.fetch; window.fetch = function(...args) { ... return originalFetch.apply(this, args); }` is fragile when called re-entrantly.

**Consequences:**
- `pendingRequestCount` becomes permanently inflated (never returns to 0)
- Subsequent stability checks always report "network busy" even when it is not
- fetch/XHR calls get double-wrapped, tripling call overhead
- Memory leak from closure chains
- In extreme cases (rapid automation on fetch-heavy SPAs), page performance degrades noticeably

**Prevention:**
1. Use a shared singleton for network tracking instead of per-call monkey-patching:
   ```javascript
   // Single shared network tracker, initialized once
   if (!FSB._networkTracker) {
     FSB._networkTracker = { pending: 0, lastActivity: 0 };
     // Patch once, track globally
   }
   ```
2. The stability functions should READ from the shared tracker, not create their own patches.
3. Add a safety guard: if `window.fetch` is already patched by FSB (check for a marker property), skip re-patching.
4. Alternatively, use PerformanceObserver with `resource` entry type instead of monkey-patching -- it is non-invasive and does not risk pollution.

**Detection:** After running several automation actions, check `window.fetch.toString()` -- if it contains FSB closure code, the patch leaked. Or check network timing: if stability always reports high `pendingRequestCount` even on pages with no XHR, patches are stacked.

---

## Moderate Pitfalls

Issues that cause incorrect behavior on specific sites but do not break the entire system.

---

### Pitfall 5: scrollIntoView Lands Behind Fixed/Sticky Headers

**What goes wrong:** The existing `scrollIntoViewIfNeeded()` in `accessibility.js` (line 828) uses `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`. On pages with fixed headers (nav bars, banners), the element IS scrolled to the visual center of the viewport -- but `block: 'center'` means center of the CSS viewport, which includes the area behind the fixed header. For tall fixed headers (80-120px on many sites), the element ends up partially or fully behind the header. The subsequent `getBoundingClientRect()` check at line 875 confirms the element is "in viewport" (its rect is within 0 to innerHeight), but the element is actually obscured by the fixed header.

Then when the click dispatches mouse events at `clickRect.left + clickRect.width / 2, clickRect.top + clickRect.height / 2` (actions.js line 1668-1669), the click hits the fixed header instead of the target element.

**Why it happens:** `scrollIntoView` and `getBoundingClientRect` do not account for CSS `position: fixed` or `position: sticky` elements. The viewport rect includes area under fixed elements. There is no standard API to determine "usable viewport" minus fixed overlays.

**Consequences:**
- Clicks hit the wrong element (the fixed header/nav) instead of the target
- The click may trigger unintended navigation (header links)
- No error is reported because a click DID happen, just on the wrong element
- Verification may incorrectly report "no effect" because the header link navigation changed the page state

**Prevention:**
1. Before scrolling, detect fixed/sticky elements that consume top viewport space:
   ```javascript
   function getFixedHeaderHeight() {
     const candidates = document.querySelectorAll(
       'header, nav, [role="banner"], [class*="header"], [class*="navbar"]'
     );
     let maxBottom = 0;
     for (const el of candidates) {
       const style = getComputedStyle(el);
       if (style.position === 'fixed' || style.position === 'sticky') {
         const rect = el.getBoundingClientRect();
         if (rect.top <= 0 && rect.bottom > maxBottom) {
           maxBottom = rect.bottom;
         }
       }
     }
     return maxBottom;
   }
   ```
2. After `scrollIntoView`, verify the element's top is BELOW the fixed header bottom. If not, scroll further.
3. After scrolling, use `document.elementFromPoint(centerX, centerY)` to verify the TARGET element (not a fixed overlay) receives the click. If not, scroll further.
4. Also handle fixed BOTTOM bars (cookie consent banners, chat widgets) consuming bottom viewport.

**Detection:** The click action returns `success: true` but verification shows the clicked element's tag/class does not match the intended target. Or the page navigates unexpectedly after a click that should have been on a form button but hit a nav link.

---

### Pitfall 6: Site Search Detection False Positives

**What goes wrong:** A site-aware search tool that detects search inputs by heuristic (looking for `input[type="search"]`, `[role="search"]`, `input[name*="search"]`, `input[placeholder*="search"]`) will match non-search inputs on many sites. Examples:
- Filter inputs in data tables (spreadsheet column filters, admin panels)
- Address/zip code fields with placeholder "Search address..."
- Login forms where username field has `autocomplete="username"` but class includes "search-input" due to CSS reuse
- Newsletter subscription inputs inside elements with class "search-section"
- CMS admin page builders where "search" is content being edited, not a search function

**Why it happens:** The word "search" appears in too many contexts. Site-specific search implementations vary wildly: some use `<form action="/search">`, some use client-side JS with `fetch()`, some use combobox patterns with `role="combobox"` and a listbox dropdown, some use URL hash navigation.

**Consequences:**
- Typing a search query into a filter input corrupts the page state
- Typing into a login field and pressing Enter submits credentials as a "search"
- On SPAs, typing triggers client-side filtering that removes content the user wanted to see
- Autocomplete dropdowns from the wrong input obscure the actual page content

**Prevention:**
1. Require MULTIPLE signals to confirm a search input, not just one:
   - Input has search-related attributes AND
   - Input is inside a form or `[role="search"]` container AND
   - Input is prominently positioned (near top of page, full-width or in header)
2. Exclude inputs that are clearly NOT search:
   - Inside `<table>`, `[role="grid"]`, `[role="rowgroup"]` (table filters)
   - Inside login forms (check for password field sibling)
   - Inside modals/dialogs (likely a filter, not page search)
3. Prefer the site guide's known search pattern if one exists in the site-guides system (the infrastructure already routes by domain).
4. Validate by checking if the input has a visible submit button or search icon within its containing form.
5. For SPA search detection, check if typing triggers URL changes or client-side content filtering by monitoring URL and DOM after a test character is typed.

**Detection:** After "searching," the page content changes in unexpected ways (table rows disappear, page navigates to login, newsletter confirmation appears). The AI will report being on an unexpected page.

---

### Pitfall 7: Content Extraction Truncation Loses Critical Information

**What goes wrong:** The existing `extractPageText()` in `dom-analysis.js` (line 2698) has a hard cap of `MAX_CHARS = 50000` and viewport-only filtering via `getBoundingClientRect()`. When implementing intelligent truncation to ~5K characters, the naive approach of "take the first 5K characters" or "take viewport text only" loses critical content:
- On article pages, the first 5K is the header, nav, sidebar, and ad -- the article body starts at 6K
- On search results pages, the first result is cut mid-sentence
- On forms, the submit button text and error messages are at the bottom
- On product pages, the price and "Add to Cart" are below the fold

The current viewport-only mode (`viewportOnly: true`) means if the viewport happens to be scrolled to the middle of the page, the header with the page title is missing and the footer with the price is missing.

**Why it happens:** Viewport filtering uses `getBoundingClientRect()` which returns coordinates relative to the current scroll position. This is intentional for DOM snapshots (showing what is visible), but for readPage (extracting content for the AI to reason about), viewport limitation means the AI gets a random slice of the page depending on scroll position.

**Consequences:**
- AI makes decisions based on incomplete information
- readPage returns navigation menus instead of article content
- Form error messages are truncated, AI does not know why form submission failed
- Product prices/availability cut off, AI reports "couldn't find price"

**Prevention:**
1. Implement content prioritization, not just truncation:
   - Use `<main>`, `<article>`, `[role="main"]` to identify primary content area
   - If found, extract THAT content first (budget: 70% of cap)
   - Then add page metadata (title, URL, breadcrumbs: 10%)
   - Then add form state, error messages, CTAs: 20%
2. Strip boilerplate BEFORE truncation:
   - Remove `<nav>`, `<footer>`, `[role="navigation"]`, `[role="complementary"]`
   - Remove ad containers (`[class*="ad-"]`, `[id*="ad-"]`, `.advertisement`)
   - Remove social sharing widgets
   - Remove cookie banners and overlays
3. For viewport mode, expand the viewport window by 1 screen height above and below to capture nearby content.
4. Preserve structured data even when truncating: never cut inside a table row, list item, or form field group.

**Detection:** readPage returns text that starts with "Home | About | Contact | Login" (navigation boilerplate) instead of page content. Or returns mid-sentence text because viewport was in an arbitrary position.

---

### Pitfall 8: Cookie Consent Dismissal Breaks Site Functionality

**What goes wrong:** A cookie consent auto-dismisser that clicks "Accept All" or "Reject All" buttons can break sites in several ways:
1. **False positive detection:** Modals that look like cookie banners but are actually age verification gates, newsletter signup prompts, or login walls. Dismissing these makes the site unusable.
2. **Wrong button clicked:** Clicking "Manage Preferences" instead of "Accept All" opens a complex settings panel. Clicking "Reject All" on sites where cookie rejection breaks the experience (some paywalled sites require cookies).
3. **Timing issues:** Dismissing the banner before it is fully rendered clicks a transparent overlay that is positioned over page content, triggering unintended actions on elements behind it.
4. **Race with page load:** On SPAs, the consent banner may re-appear after dismissal because the app re-renders and re-checks cookie status.

**Why it happens:** Cookie consent implementations use 200+ different CMPs (Consent Management Platforms) with completely different DOM structures, button labels (in every language), and behavior patterns. There is no standard. The Consent-O-Matic extension maintains 200+ CMP-specific rulesets and still has coverage gaps.

**Consequences:**
- Age verification dismissed: site shows adult content or blocks access
- Login wall dismissed: site requires re-login, session broken
- Paywall modal dismissed: content remains locked but overlay is gone, clicks fall through to locked elements
- Cookie preferences opened: complex UI confuses the AI, wastes iteration budget
- On some sites, rejecting cookies causes infinite redirect loops

**Prevention:**
1. Only auto-dismiss elements that match ALL of these criteria:
   - Fixed/sticky positioning OR overlay with high z-index
   - Contains cookie/consent/privacy-related text (not just "accept" alone -- many buttons say "accept")
   - Does NOT contain password/login/age verification keywords
   - Is NOT the only content on the page (rules out login-wall sites)
2. Prefer "Accept All" over "Reject All" for maximum compatibility.
3. Wait for the banner to be fully visible (opacity > 0.9, rect height > 50px) before attempting dismiss.
4. After dismissal, verify the overlay is actually gone. If it re-appears within 2 seconds, do not retry (likely a non-consent modal).
5. NEVER dismiss if the overlay is inside `<main>` or `[role="main"]` -- consent banners are always outside main content.
6. Rate-limit: only attempt once per page load. If dismissed and it comes back, leave it.

**Detection:** After auto-dismiss, the page requires login (was a login wall, not consent). Or the page enters an infinite reload loop. Or a complex cookie preferences panel is now open.

---

### Pitfall 9: waitForDOMStable + readPage Merge Creates Double-Wait

**What goes wrong:** The planned merge of `wait_for_stable` into `read_page` (auto-stability before extraction) creates a dependency problem with the existing automation loop. The loop currently calls `waitForDOMStable` explicitly before certain actions, then calls `readPage` separately. If `readPage` now internally waits for stability, and the calling code ALSO waits for stability before calling readPage, you get double-waiting: 5 seconds from the caller's stability check + 5 seconds from readPage's internal stability check = 10 seconds per read operation.

**Why it happens:** The existing callers of `readPage` in background.js and the MCP tools do not know whether `readPage` will internally wait for stability. There is no mechanism to signal "I already waited, skip your internal wait." The merge breaks the implicit contract that `readPage` is a fast, synchronous-ish operation.

**Consequences:**
- Every `readPage` call takes 5-10 seconds instead of <500ms
- Session pace drops dramatically
- On dynamic SPAs, the double-wait causes the DOM to change between checks, leading to inconsistent reads

**Prevention:**
1. Add an explicit `skipStability` parameter to readPage:
   ```javascript
   readPage: (params) => {
     const skipStability = params.skipStability === true;
     if (!skipStability) {
       await waitForPageStability({ maxWait: 3000, stableTime: 300 });
     }
     // ... extraction logic
   }
   ```
2. The internal stability wait should use SHORTER timeouts than the standalone `waitForDOMStable` (e.g., 2 seconds max vs 5 seconds).
3. In the autopilot loop and MCP tools, remove the explicit `waitForDOMStable` calls that precede `readPage` -- let readPage handle its own stability.
4. Return stability metadata in the readPage response so callers know if it waited and for how long:
   ```javascript
   return { success: true, text, stabilityInfo: { waited: true, waitTime: 1200, timedOut: false } };
   ```

**Detection:** readPage calls consistently take 8-10 seconds. Check logs for back-to-back stability waits.

---

## Minor Pitfalls

Issues with limited blast radius but worth knowing about.

---

### Pitfall 10: getBoundingClientRect Returns Stale Values After CSS Transform

**What goes wrong:** Some sites use CSS transforms for animations (page transitions, card flips, modal slide-ins). `getBoundingClientRect()` returns the TRANSFORMED position, not the original layout position. During a CSS transition, the rect changes every frame. If `scrollIntoViewIfNeeded` reads the rect during a transform animation, it gets coordinates that are only valid for that instant and may scroll to the wrong position.

**Prevention:** After scrollIntoView, wait for animations to complete before reading the rect:
```javascript
await new Promise(r => setTimeout(r, 100)); // brief settle
const animations = element.getAnimations({ subtree: false });
if (animations.length > 0) {
  await Promise.all(animations.map(a => a.finished)).catch(() => {});
}
const rect = element.getBoundingClientRect(); // now stable
```

---

### Pitfall 11: Search Input Autocomplete Dropdown Steals Focus/Clicks

**What goes wrong:** When using a site's search input, typing triggers an autocomplete dropdown. The dropdown may cover the search submit button, or pressing Enter selects an autocomplete suggestion instead of submitting the search. On some sites (Amazon, Google), pressing Enter in the search input DOES submit. On others (Notion, Jira), Enter selects the first autocomplete option which may be wrong.

**Prevention:**
1. After typing the search query, wait 500ms for autocomplete to appear.
2. Check if autocomplete dropdown is visible. If so, press Escape to dismiss it before pressing Enter.
3. Alternatively, find and click the search submit button directly instead of pressing Enter.
4. For sites with known autocomplete behavior, use the site guide system to specify the correct submission method.

---

### Pitfall 12: Cookie Consent Detection in Non-English Sites

**What goes wrong:** Keyword matching for "cookie", "consent", "accept" fails on non-English sites. French: "accepter les cookies". German: "Cookies akzeptieren". Japanese/Chinese: completely different character sets. The false negative rate for non-English sites is high.

**Prevention:**
1. Match on CMP framework identifiers (OneTrust, CookieBot, TrustArc class names) rather than text content.
2. Use structural detection: fixed-position overlay at bottom of page + buttons + privacy-related links.
3. Check for common CMP script sources in the DOM: `onetrust.com`, `cookiebot.com`, `trustarc.com`.
4. Fall back to text matching only as a supplement, not primary detection.

---

### Pitfall 13: Content Script Injection Timing on about:blank Intermediate Pages

**What goes wrong:** During navigation, Chrome briefly shows `about:blank` before the target page loads. If `ensureContentScriptInjected()` is called during this brief window (because a previous action triggered navigation and the background is trying to send a follow-up message), injection succeeds on `about:blank` but the script is immediately discarded when the real page loads. The background thinks injection succeeded and proceeds to send messages, which fail.

**Prevention:**
1. In `ensureContentScriptInjected()`, check the tab URL before injecting:
   ```javascript
   const tab = await chrome.tabs.get(tabId);
   if (!tab.url || tab.url === 'about:blank' || tab.status !== 'complete') {
     await pageLoadWatcher.waitForPageReady(tabId, { maxWait: 5000 });
   }
   ```
2. The existing `isRestrictedURL()` check (line 2433) already blocks `about:blank`, but it is called AFTER the health check, not before the injection decision. Move it earlier in the flow.

---

### Pitfall 14: Viewport Scroll Miscalculation with CSS zoom/scale

**What goes wrong:** Some sites (accessibility features, design tools) use `zoom` or `transform: scale()` on the `<body>` or `<html>` element. This creates a mismatch between CSS pixels and viewport pixels. `window.innerHeight` reports the unscaled viewport, but `getBoundingClientRect()` returns scaled coordinates. The scroll calculations in `scrollIntoViewIfNeeded()` and `ensureCoordinatesVisible()` produce wrong results because they mix scaled and unscaled values.

**Prevention:**
1. Detect viewport scaling before scroll calculations:
   ```javascript
   const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
   const effectiveViewportHeight = window.innerHeight / zoom;
   ```
2. Apply the inverse zoom to coordinates from `getBoundingClientRect()` when comparing against viewport dimensions.

---

### Pitfall 15: press_enter Submit Fallback Clicks Wrong Form's Button

**What goes wrong:** After Enter fails to submit, the fallback logic finds a `button[type="submit"]` that belongs to a different form on the page (e.g., a newsletter signup form in the footer) instead of the form the AI was interacting with.

**Prevention:** Scope the submit button search to the same `<form>` element as the input that received the Enter key. Use `element.closest('form')` to find the containing form, then `form.querySelector('button[type="submit"]')`. Only fall back to page-wide button search if no containing form is found.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| BF cache resilience | Pitfall 1 (port closure race), Pitfall 2 (guard blocks re-injection) | Implement pageshow/pagehide listeners BEFORE modifying background recovery. Test with Chrome's BFCache DevTools panel. |
| Content script re-injection | Pitfall 2 (guard flag), Pitfall 13 (about:blank timing) | Health-check guard (not boolean flag). Always verify tab URL and status before injecting. |
| Site-aware search | Pitfall 6 (false positives), Pitfall 11 (autocomplete interference) | Require 3+ signals for search detection. Handle autocomplete dismiss before submit. |
| DOM stability detection | Pitfall 3 (infinite mutation loop), Pitfall 4 (fetch monkey-patch leak) | Share mutation filter with lifecycle.js. Use singleton network tracker. Add animation exclusion. |
| Content truncation | Pitfall 7 (losing critical content), Pitfall 9 (double-wait with stability merge) | Content-region prioritization (main > nav > footer). Add skipStability parameter. |
| Cookie consent dismissal | Pitfall 8 (false positive detection), Pitfall 12 (non-English) | Multi-signal detection. CMP framework matching over text matching. Never dismiss content inside main. |
| Viewport scroll for click | Pitfall 5 (fixed header overlap), Pitfall 10 (CSS transform stale rects), Pitfall 14 (zoom/scale) | Detect fixed header height. Post-scroll elementFromPoint verification. Wait for animations. |

---

## Integration-Specific Gotchas with Existing Architecture

### Gotcha A: Messaging Module Load Order

The content script modules load in a strict dependency order defined in `CONTENT_SCRIPT_FILES` (background.js line 245). Any new module added for cookie consent detection or search input detection MUST be inserted at the correct position in this array. If inserted after `messaging.js`, it will not have access to message handlers. If inserted before `init.js`, the FSB namespace will not exist.

**Rule:** New modules go after `dom-analysis.js` and before `dom-stream.js` (the domain modules slot). They must follow the IIFE + `__FSB_SKIP_INIT__` guard pattern.

### Gotcha B: Service Worker Lifecycle

The background service worker can go idle and restart. Any global state used for tracking (like BF cache status, content script health maps) must either be stored in `chrome.storage.session` or be reconstructable from tab state. The existing `contentScriptHealth` Map and `contentScriptReadyStatus` Map are in-memory only -- they are lost on service worker restart.

**Rule:** Critical tracking state should survive service worker restart. Use `chrome.storage.session` for cross-restart state or accept that the state will be rebuilt on first interaction.

### Gotcha C: CDP Debugger Contention

The existing codebase uses `chrome.debugger` for CDP mouse clicks and keyboard events. Only one debugger can attach to a tab at a time. If a cookie consent dismissal uses CDP (e.g., for clicking a button in a shadow DOM), and an automation action also needs CDP at the same time, you get debugger contention. The v0.9.9 milestone already fixed this for Excalidraw (Phase P109), but new code paths must follow the same contention-avoidance pattern.

**Rule:** All CDP interactions go through the existing CDP routing layer. Never call `chrome.debugger.attach()` directly from new code.

### Gotcha D: Frame Targeting

The existing code targets `frameId: 0` (main frame only) for message sending (background.js line 806). Cookie consent banners are sometimes rendered in iframes (CMP vendor iframes). If the cookie banner is in an iframe, sending `dismissCookieConsent` to frameId 0 will not find it.

**Rule:** Cookie consent detection should first check the main frame. If not found, optionally check `document.querySelectorAll('iframe')` and attempt detection in each iframe via `chrome.scripting.executeScript` with the specific frameId. But be cautious: many iframes are cross-origin ad iframes that cannot be accessed.

### Gotcha E: Site Guide System Integration

The existing site guide system (50+ guide files) provides per-site intelligence. New fixes (search input detection, cookie patterns) should integrate with the guide system, not bypass it. If a site guide already specifies a search input selector, the generic heuristic should defer to it.

**Rule:** Check `window.FSB._siteGuide` (if it exists) for site-specific overrides before applying generic heuristics. This applies to search detection, cookie patterns, and any site-specific behavior.

---

## Sources

- [Chrome Developer Blog: BFCache Extension Messaging Changes](https://developer.chrome.com/blog/bfcache-extension-messaging-changes)
- [web.dev: Back/Forward Cache](https://web.dev/articles/bfcache)
- [W3C WebExtensions: BFCache Port Behavior Discussion](https://github.com/w3c/webextensions/issues/474)
- [Chromium Extensions Group: Avoiding Duplicate Content Script Injections](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/uNXEDCsrgHc)
- [Chrome Developers: Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Playwright Issue #3105: scrollIntoView with Sticky Headers](https://github.com/microsoft/playwright/issues/3105)
- [MDN: Element.scrollIntoView()](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
- [Consent-O-Matic: Cookie Consent Detection Patterns](https://github.com/cavi-au/Consent-O-Matic)
- [MDN: getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
- [Angular Issue #26948: MutationObserver Browser Hang](https://github.com/angular/angular/issues/26948)
- [DuckDuckGo Autoconsent: False Positive Handling](https://github.com/duckduckgo/autoconsent)
- [Playwright Actionability: Element Obscured](https://playwright.dev/docs/actionability)
- Existing FSB site guide: `site-guides/utilities/cookie-opt-out.js`
- FSB codebase: `content/init.js`, `content/lifecycle.js`, `content/actions.js`, `content/accessibility.js`, `content/dom-analysis.js`, `background.js`
