# Technology Stack: v0.9.11 MCP Tool Quality

**Project:** FSB (Full Self-Browsing) -- MCP Tool Quality Fixes
**Researched:** 2026-03-31
**Mode:** Ecosystem (Chrome Extension APIs and patterns for 7 specific fixes)

## Existing Stack (No Changes)

The core stack remains unchanged. No new npm dependencies, no build system changes, no new frameworks. Every fix below uses APIs and patterns already available in the Chrome Extension MV3 platform.

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Chrome Extension MV3 | Chrome 123+ | Extension platform | Existing |
| Vanilla JavaScript ES2021+ | N/A | All implementation | Existing |
| chrome.scripting API | MV3 | Content script injection | Existing |
| chrome.webNavigation API | MV3 | Navigation event handling | Existing, needs expansion |
| MutationObserver | Web API | DOM stability detection | Existing |
| Chrome DevTools Protocol | via chrome.debugger | Trusted input events | Existing |
| WebSocket bridge | Custom | MCP server <-> extension | Existing |

## Chrome APIs Needed Per Fix

### Fix 1: BF Cache Resilience for click

**Problem:** After back/forward navigation, the content script's port to the background is dead. `chrome.tabs.sendMessage` fails because the content script's port was proactively closed when the page entered BF cache -- the page was restored from BF cache, not freshly loaded, so content script re-injection does not help (the JS context is preserved, but the messaging channel is dead).

**API:** `pageshow` event with `event.persisted` check (Web Platform API, available in all Chrome versions)

**Why this approach:**
- Chrome 123+ proactively closes extension message ports when a page enters BF cache ([Chrome Developer Blog](https://developer.chrome.com/blog/bfcache-extension-messaging-changes))
- The `pageshow` event fires when a page is restored from BF cache, with `event.persisted === true`
- `chrome.webNavigation.onCommitted` fires for BF cache restores but **skips** `onDOMContentLoaded` -- this makes BF cache restores detectable from the background side, but the content script `pageshow` handler is the simpler fix
- The content script's `window.FSB` namespace survives BF cache (the page's JS context is preserved). The MutationObserver survives. The module state survives. Only the `chrome.runtime.connect()` port is dead.

**Implementation pattern (content script side -- content/lifecycle.js):**
```javascript
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Page restored from BF cache -- port is dead, re-establish
    establishBackgroundConnection();
    // Re-send ready signal so background knows we're alive
    chrome.runtime.sendMessage({
      action: 'contentScriptReady',
      timestamp: Date.now(),
      url: window.location.href,
      readyState: document.readyState,
      bfCacheRestore: true
    }).catch(() => {});
  }
});
```

**Background side (background.js) -- no structural changes needed:**
- The existing `contentScriptReady` message handler already processes ready signals
- Just accept the `bfCacheRestore: true` flag for logging/diagnostics
- The existing `FAILURE_TYPES.BF_CACHE` recovery handler in the `sendMessageToContentScript` retry loop already handles the wake-and-retry pattern -- the `pageshow` handler makes this recovery faster by proactively re-establishing the port before the next MCP command arrives

**Why NOT `chrome.webNavigation.onDOMContentLoaded` absence detection:**
- Fragile -- requires correlating multiple events across time windows
- The content script `pageshow` handler is simpler, more reliable, and proactive
- The content script already has `establishBackgroundConnection()` -- just call it again

**Confidence:** HIGH -- Chrome Developer Blog explicitly documents this pattern for extensions

**Integration notes:**
- `content/lifecycle.js` already has `establishBackgroundConnection()` at line 494
- `content/init.js` has `__FSB_CONTENT_SCRIPT_LOADED__` guard -- BF cache restores do NOT re-inject scripts, the guard stays set, which is correct (we don't want double initialization)
- The MutationObserver started in lifecycle.js survives BF cache restore -- no need to restart it
- The `window.FSB` namespace and all module registrations survive -- all state is preserved

---

### Fix 2: Site-Aware Search Tool

**Problem:** The `search` MCP tool always redirects to Google (`searchGoogle` verb in `content/actions.js:3407` navigates to `google.com/search?q=...`). When the user is already on Amazon, GitHub, YouTube, etc. and wants to search within that site, navigating away is wrong.

**API:** No new Chrome APIs needed. Pure DOM heuristics in the content script.

**Why this approach:**
- Search inputs follow strong accessibility and HTML conventions: `input[type="search"]`, `[role="search"]`, `aria-label` containing "search"
- The content script already has full DOM access and `FSB.findElementByStrategies()`
- A selector priority list covers 90%+ of real-world sites without any per-site configuration

**Search input detection heuristic (priority order):**
```javascript
const SEARCH_SELECTORS = [
  // 1. Semantic HTML -- most reliable, W3C standard
  'input[type="search"]',
  // 2. ARIA landmark role -- second most reliable
  '[role="search"] input:not([type="hidden"])',
  '[role="search"] textarea',
  // 3. ARIA labels -- broad coverage across accessible sites
  'input[aria-label*="search" i]',
  'textarea[aria-label*="search" i]',
  // 4. Common name/ID conventions
  'input[name="q"]',             // Google, many sites
  'input[name="search"]',
  'input[name="query"]',
  'input[name="search_query"]',  // YouTube
  'input[id="search"]',
  'input[id="searchbox"]',
  'input[id="search-input"]',
  'input[id="twotabsearchtextbox"]',  // Amazon
  // 5. Placeholder text -- fallback
  'input[placeholder*="Search" i]',
  'textarea[placeholder*="Search" i]',
  // 6. Data attributes -- framework patterns
  'input[data-testid*="search" i]',
];
```

**Decision logic (content script side, new function `findSiteSearchInput`):**
1. Run selectors in priority order
2. For each match: check visibility (`offsetParent !== null` AND `getBoundingClientRect().width > 0`)
3. Return first visible match, or `null` if no match

**MCP tool routing (background.js):**
1. MCP `search` tool arrives -> send `siteSearch` message to content script
2. Content script runs `findSiteSearchInput()`
3. If found: focus input, clear it, type query, press Enter -> return `{ success: true, method: 'site_search' }`
4. If not found: fall back to `searchGoogle` behavior (navigate to Google)

**Confidence:** HIGH -- standard accessibility patterns, well-understood DOM heuristics

**What NOT to do:**
- Do NOT maintain a per-site search selector database (breaks on redesigns, maintenance burden)
- Do NOT use a library -- 20 lines of selector priority is sufficient
- Do NOT try to detect search results pages -- just find the input and type

---

### Fix 3: Content Script Re-injection After Navigation

**Problem:** After navigating to a new page (not BF cache), `ensureContentScriptInjected` sometimes fails to inject quickly enough, or the content script isn't responsive by the time the first MCP action arrives.

**API:** Already using `chrome.scripting.executeScript` and `chrome.webNavigation.onCommitted`. No new APIs needed.

**Why the existing approach needs refinement, not replacement:**
- `ensureContentScriptInjected` (background.js:2625) is already robust: port check -> ready signal check -> health check -> inject -> wait for ready signal
- The problem is a race condition: the MCP tool sends a command immediately after navigation, before the content script has finished initializing
- The fix is a blocking `waitForContentScriptReady` wrapper in the MCP message handlers

**Pattern (background.js, new helper):**
```javascript
async function waitForContentScriptReady(tabId, maxWait = 3000) {
  // 1. Quick check: port alive and recent heartbeat?
  const portInfo = contentScriptPorts.get(tabId);
  if (portInfo && Date.now() - portInfo.lastHeartbeat < 5000) return true;

  // 2. Inject if needed
  await ensureContentScriptInjected(tabId);

  // 3. Wait for ready signal with polling
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const p = contentScriptPorts.get(tabId);
    if (p && Date.now() - p.lastHeartbeat < 5000) return true;
    const rs = contentScriptReadyStatus.get(tabId);
    if (rs?.ready) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}
```

**Integration point:** Call `waitForContentScriptReady` in the MCP handlers (`mcp:execute-action`, `mcp:get-dom`, `mcp:read-page`) instead of the current `ensureContentScriptInjected` call.

**Confidence:** HIGH -- refinement of existing proven pattern

**What NOT to do:**
- Do NOT use `chrome.scripting.registerContentScripts` for always-on injection -- programmatic injection gives more control and the `__FSB_CONTENT_SCRIPT_LOADED__` guard prevents double-init
- Do NOT add `document_start` injection timing for content scripts -- they depend on `document.body` existing

---

### Fix 4: read_page Auto-Stability (Merge wait_for_stable into read_page)

**Problem:** On JS-heavy sites (SPAs, React apps), `read_page` returns content before the page has finished rendering. The AI user has to manually call `wait_for_stable` then `read_page` -- two tool calls when one should suffice.

**API:** No new APIs. Compose existing `waitForPageStability()` from `content/actions.js:1138` with `extractPageText()` from `content/dom-analysis.js:2698`.

**Implementation (content/messaging.js, in the `readPage` case handler at line 782):**
```javascript
case 'readPage':
  const rpStart = Date.now();
  // AUTO-STABILITY: Wait for DOM to settle before extracting
  await FSB.waitForPageStability({
    maxWait: 2000,      // Cap at 2s -- don't block forever
    stableTime: 300,    // DOM unchanged for 300ms = "settled"
    networkQuietTime: 200
  });
  // Then extract as before
  const rpText = FSB.extractPageText(rpRoot, { ... });
```

**Why 2000ms maxWait:**
- Most SPA renders complete within 500ms-1500ms
- 2s catches lazy-loaded content without blocking the MCP workflow
- The existing `waitForPageStability` returns early when stable before timeout
- `stableTime: 300` means 300ms of zero DOM mutations -- good balance between speed and completeness

**Also apply to the `mcp:read-page` handler in background.js** (line 13800): The auto-stability happens in the content script, transparent to the MCP server and background.

**Confidence:** HIGH -- composing two existing functions that are individually well-tested

**What NOT to do:**
- Do NOT add a separate `read_page_stable` MCP tool -- merge into existing `read_page`
- Do NOT wait for complete network idle -- too slow, many sites have ongoing XHR/WebSocket/analytics
- Do NOT increase timeout beyond 2s -- the MCP agent can always call `wait_for_stable` explicitly if it needs more time

---

### Fix 5: Intelligent Content Truncation (Cap read_page)

**Problem:** `extractPageText` has a 50K char limit (`MAX_CHARS = 50000` at `content/dom-analysis.js:2704`). For MCP tool responses, 50K is far too much -- it overwhelms the AI context window and most of it is noise (nav bars, footers, ads, boilerplate).

**API:** No new APIs. Refine `extractPageText` in `content/dom-analysis.js`.

**Strategy -- Main Content Prioritization:**
```javascript
function findMainContentRoot() {
  // Try semantic landmarks first
  const main = document.querySelector('main, [role="main"]');
  if (main && main.textContent.trim().length > 100) return main;

  const article = document.querySelector('article');
  if (article && article.textContent.trim().length > 100) return article;

  // No landmark -- use full body
  return document.body;
}
```

**Truncation limits:**
| Mode | Current Limit | New Limit | Rationale |
|------|---------------|-----------|-----------|
| Default (viewport) | 50,000 chars | 5,000 chars | Enough for AI to read visible content, fits in prompt budget |
| Full page (`full: true`) | 50,000 chars | 15,000 chars | Extended extraction, still fits in context window |
| Autopilot (internal) | 50,000 chars | No change | Autopilot has its own prompt budget management |

**Skip selectors (strip before extraction):**
```javascript
const NOISE_SELECTORS = [
  'nav', '[role="navigation"]',
  'header', '[role="banner"]',
  'footer', '[role="contentinfo"]',
  'aside', '[role="complementary"]',
  '[role="search"]',
  '[aria-hidden="true"]',
  'script', 'style', 'noscript',
  // Cookie/consent overlaps with Fix 7
  '[class*="cookie" i]', '[id*="cookie" i]',
  '[class*="consent" i]', '[id*="consent" i]',
];
```

**Implementation approach:** Do NOT delete nodes from the DOM. Instead, check each node during the `visit()` traversal in `extractPageText` and skip nodes matching `NOISE_SELECTORS` when the caller is MCP (pass a flag like `{ stripNoise: true }`).

**Confidence:** HIGH -- straightforward DOM traversal refinement

**What NOT to do:**
- Do NOT import Readability.js -- adds a ~15KB dependency, overkill for this use case
- Do NOT use ML-based content extraction -- heuristic landmarks are sufficient
- Do NOT remove the hard cap entirely -- it prevents OOM on massive DOM trees

---

### Fix 6: Smart press_enter Fallback (Auto-Click Submit)

**Problem:** When the AI calls `press_enter` on a form field and the synthetic Enter key dispatch doesn't trigger submission (common in React/SPA forms that intercept keydown), there's no fallback.

**API:** No new APIs. Add fallback logic in the existing `pressEnter` handler in `content/actions.js`.

**Fallback strategy (inside existing pressEnter tool, after Enter key dispatch and verification):**
```javascript
// After dispatching Enter key events and verifying
const postState = captureActionState(element, 'pressEnter');
const verification = verifyActionEffect(preState, postState, 'pressEnter');

if (!verification.verified) {
  // Enter had no effect -- try finding and clicking submit button
  const submitBtn = findNearestSubmitButton(element);
  if (submitBtn) {
    submitBtn.click();
    await waitForPageStability({ maxWait: 2000, stableTime: 300 });
    return {
      success: true,
      method: 'submit_button_fallback',
      buttonText: submitBtn.textContent?.trim()?.substring(0, 50)
    };
  }
}
```

**Submit button finder (new helper function):**
```javascript
function findNearestSubmitButton(inputElement) {
  // 1. Check if input is inside a <form>
  const form = inputElement.closest('form');
  if (form) {
    const submitBtn = form.querySelector(
      'button[type="submit"], input[type="submit"], ' +
      'button:not([type="button"]):not([type="reset"])'
    );
    if (submitBtn && submitBtn.offsetParent !== null) return submitBtn;
  }

  // 2. No form or no submit button in form -- look for nearby button
  const container = inputElement.closest('div, section, fieldset') || document.body;
  const buttons = container.querySelectorAll('button, [role="button"]');
  const submitRegex = /^(submit|send|go|search|sign.?in|log.?in|register|save|apply|continue|next|ok|confirm)$/i;

  for (const btn of buttons) {
    const text = btn.textContent?.trim();
    if (text && submitRegex.test(text) && btn.offsetParent !== null) {
      return btn;
    }
  }

  return null;
}
```

**Confidence:** HIGH -- well-defined DOM traversal, integrates with existing verification infrastructure

**What NOT to do:**
- Do NOT always click submit instead of Enter -- Enter is the correct primary behavior for most sites
- Do NOT call `form.submit()` programmatically -- bypasses validation listeners and event handlers
- Do NOT search the entire document for submit buttons -- scope to the containing form or nearest container

---

### Fix 7: Cookie Consent Auto-Dismiss

**Problem:** Cookie consent overlays block interaction with page elements. The AI wastes tokens figuring out how to dismiss them, and sometimes fails entirely because the overlay intercepts clicks.

**API:** No new Chrome APIs. DOM heuristic detection + auto-click in content script.

**Why NOT use a library:**
- Cookie consent extensions (Cookie Guardian, "I don't care about cookies", etc.) are full extensions with their own manifest and lifecycle
- We need approximately 50-70 lines of heuristic detection, not an external dependency
- The detection pattern is straightforward: find a fixed/sticky overlay with cookie-related identifiers, click the accept/dismiss button

**Detection heuristic (new function `detectAndDismissCookieConsent`):**

**Phase 1 -- Find the banner container (CMP-specific selectors cover ~65% of sites):**
```javascript
const BANNER_SELECTORS = [
  '#onetrust-banner-sdk',              // OneTrust
  '#CybotCookiebotDialog',             // Cookiebot
  '#usercentrics-root',                // Usercentrics
  '.didomi-popup-container',           // Didomi
  '#truste-consent-track',             // TrustArc
  '#cookie-law-info-bar',              // CookieYes
  '#iubenda-cs-banner',               // Iubenda
  '.cc-window',                        // osano/cookieconsent
  // Generic patterns (covers ~25% more)
  '[class*="cookie-banner" i]',
  '[class*="cookie-consent" i]',
  '[class*="cookie-notice" i]',
  '[id*="cookie-banner" i]',
  '[id*="cookie-consent" i]',
  '[id*="gdpr" i]',
  '[class*="consent-banner" i]',
];
```

**Phase 2 -- Find accept/dismiss button within the banner:**
```javascript
const ACCEPT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  'button[class*="accept" i]',
  'button[class*="agree" i]',
  'button[class*="allow" i]',
  'button[id*="accept" i]',
  'a[class*="accept" i]',
];

// Text-based fallback
const ACCEPT_TEXT = /^(accept|accept all|agree|allow|allow all|ok|got it|i agree|i understand|continue|dismiss)$/i;
```

**Phase 3 -- Safety checks before clicking:**
1. Banner container must be fixed or sticky positioned (`position: fixed|sticky` OR `z-index > 1000`)
2. Must contain cookie/consent/privacy-related text (regex check on `textContent`)
3. Must NOT look like a login dialog, terms acceptance, or age gate

**Trigger points:**
1. On content script initialization -- delayed 1500ms to catch async-loaded CMP banners
2. Via MutationObserver -- if a new high-z-index fixed-position element appears with cookie-related content
3. Manually via new `dismiss_overlay` MCP tool
4. Automatically before `read_page` extraction (if an overlay is blocking content)

**Integration:**
- Add detection function to `content/lifecycle.js`
- Expose as `FSB.dismissCookieConsent()` for programmatic invocation
- Add `dismiss_overlay` MCP tool for explicit AI use

**Confidence:** MEDIUM-HIGH -- CMP-specific selectors are HIGH confidence (IDs are stable across versions), generic text matching is MEDIUM (potential false positives with non-cookie "Accept" buttons)

**Safeguards against false positives:**
1. Only target elements with fixed/sticky positioning or very high z-index
2. Require cookie/consent/privacy text in the container
3. Never auto-dismiss if the overlay text mentions "terms of service", "age verification", "sign in", or "subscribe"

**What NOT to do:**
- Do NOT import cookie consent libraries as npm dependencies
- Do NOT try to detect all ~50+ CMP platforms -- the top 8 by market share cover 65%+ of sites
- Do NOT use Shadow DOM piercing -- most CMPs use regular DOM
- Do NOT auto-reject cookies -- always click "Accept All" or "Dismiss" (least disruptive to automation flow)

---

## Viewport-Aware Click/Hover Fix (Fix 4b -- Supplementary)

**Problem:** `scrollIntoView` in `smartEnsureReady` / `ensureElementReady` (content/accessibility.js) sometimes leaves elements behind sticky headers or at the very bottom edge of the viewport.

**API:** Already using `Element.scrollIntoView()` and `Element.getBoundingClientRect()`. No new APIs.

**Refinement -- add sticky header compensation:**
```javascript
function detectStickyHeaderHeight() {
  const candidates = document.querySelectorAll(
    'header, nav, [role="banner"], [class*="header" i], [class*="navbar" i]'
  );
  let maxHeight = 0;
  for (const el of candidates) {
    const style = getComputedStyle(el);
    if (style.position === 'fixed' || style.position === 'sticky') {
      maxHeight = Math.max(maxHeight, el.getBoundingClientRect().height);
    }
  }
  return maxHeight;
}

// After scrollIntoView, verify and adjust
element.scrollIntoView({ behavior: 'instant', block: 'center' });
const rect = element.getBoundingClientRect();
const stickyH = detectStickyHeaderHeight();
if (rect.top < stickyH + 10) {
  window.scrollBy(0, -(stickyH + 20));
}
```

**Integration:** Add to `ensureElementReady` in `content/accessibility.js` after the existing `scrollIntoView` call (around line 1050+).

**Confidence:** HIGH -- standard DOM geometry calculations

---

## Summary: What NOT to Add

| Temptation | Why Avoid |
|------------|-----------|
| Readability.js for content extraction | External dependency (~15KB), overkill for content prioritization |
| Cookie consent extension/library | Adds dependency lifecycle; 50-70 lines of selectors suffice |
| Per-site search selector database | Breaks on redesigns; generic heuristics are more resilient |
| `chrome.scripting.registerContentScripts` | Adds complexity; programmatic injection gives more control |
| Shadow DOM piercing for cookie banners | Very few CMPs use Shadow DOM; handle if encountered later |
| Network idle detection for stability | Too slow; sites with WebSocket/polling never go idle |
| Separate `read_page_stable` MCP tool | Adds tool count; merge behavior into existing `read_page` |
| Third-party DOM diffing library | Existing MutationObserver is sufficient |
| `form.submit()` as fallback | Bypasses validation and event listeners; `.click()` on submit button is safer |

## File Touch Map

| File | Fix(es) | Change Type |
|------|---------|-------------|
| `content/lifecycle.js` | 1, 7 | Add `pageshow` listener for BF cache; add cookie consent auto-dismiss |
| `content/messaging.js` | 4 | Add auto-stability wait before `readPage` extraction |
| `content/dom-analysis.js` | 5 | Add `findMainContentRoot()`, reduce `MAX_CHARS`, add `NOISE_SELECTORS` skip list |
| `content/actions.js` | 2, 6 | Add `findSiteSearchInput()`, add `siteSearch` tool, add `findNearestSubmitButton()` + submit fallback in pressEnter |
| `content/accessibility.js` | 4b | Add sticky header detection and scroll compensation in `ensureElementReady` |
| `background.js` | 1, 2, 3 | Accept `bfCacheRestore` ready signal, route `siteSearch` verb, add `waitForContentScriptReady` |
| `mcp-server/src/tools/manual.ts` | 2 | Update `search` tool description (behavior change is transparent) |
| `mcp-server/src/tools/read-only.ts` | 4, 5 | Update `read_page` description to note auto-stability and smart truncation |

## Chrome API Version Requirements

| API | Minimum Chrome | Our Minimum | Notes |
|-----|---------------|-------------|-------|
| `pageshow` event | All versions | Chrome 88 | Standard web platform API |
| `event.persisted` | All versions | Chrome 88 | Standard web platform API |
| `chrome.scripting.executeScript` | Chrome 88 | Chrome 88 | Already using |
| `chrome.webNavigation.onCommitted` | Chrome 88 | Chrome 88 | Already using |
| `MutationObserver` | All versions | Chrome 88 | Already using |
| `Element.scrollIntoView` | All versions | Chrome 88 | Already using |
| `document.elementFromPoint` | All versions | Chrome 88 | Already using |
| `getComputedStyle` | All versions | Chrome 88 | Already using |

No new Chrome API permissions required. The `manifest.json` already has `webNavigation`, `scripting`, `tabs`, and `<all_urls>` host permissions.

## Sources

- [Chrome Developer Blog: BFCache Extension Messaging Changes](https://developer.chrome.com/blog/bfcache-extension-messaging-changes) -- Chrome 123+ BF cache port behavior (HIGH confidence)
- [web.dev: Back/Forward Cache](https://web.dev/articles/bfcache) -- General BF cache lifecycle (HIGH confidence)
- [Chrome webNavigation API Reference](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) -- Event sequence for BF cache restores, transitionType/transitionQualifiers (HIGH confidence)
- [Chrome scripting API Reference](https://developer.chrome.com/docs/extensions/reference/api/scripting) -- executeScript options (HIGH confidence)
- [Chrome Content Scripts Docs](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- Injection timing, isolated world (HIGH confidence)
- [Cookie Guardian (GitHub)](https://github.com/ardatrkl35/Cookie-guardian) -- CMP detection patterns, heuristic scoring reference (MEDIUM confidence)
- [Cookie Decliner (GitHub)](https://github.com/RuneVed/cookie-decliner) -- TCF API + DOM analysis approach (MEDIUM confidence)
- [CHI 2025: Cross-Country Analysis of GDPR Cookie Banners](https://dl.acm.org/doi/10.1145/3706598.3713648) -- Word corpus + heuristic F1=0.96 finding (MEDIUM confidence)
