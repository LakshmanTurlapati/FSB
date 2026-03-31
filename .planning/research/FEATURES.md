# Feature Landscape: v0.9.11 MCP Tool Quality

**Domain:** Browser automation tool reliability improvements (Chrome Extension MCP tools)
**Researched:** 2026-03-31

## Table Stakes

Features users expect from any competent browser automation tool. Missing = tool feels broken.

| # | Feature | Why Expected | Complexity | Existing Architecture Dependency | Notes |
|---|---------|--------------|------------|----------------------------------|-------|
| 1 | Site-aware search | Every site has its own search box; redirecting to Google is wrong for "search this site" intent | Medium | `actions.js:searchGoogle` hardcodes Google URL; `lifecycle.js:explorerDetectLayout` already detects `[role="search"]` | Playwright/Puppeteer never impose a search engine -- they type into whatever input the user targets |
| 2 | DOM stability before read_page | JS-heavy sites (React, Next.js, SPA) show skeleton/loading states; reading before hydration returns garbage | Low | `waitForPageStability()` in `actions.js` already exists with MutationObserver + network tracking; `readPage` does NOT call it | Playwright auto-waits before every action; Puppeteer has `networkidle0/2` for page.goto |
| 3 | Click survives page transitions (BF cache) | Clicking a link navigates away; content script dies; next action fails with "extension not responding" | Medium | `background.js` has BF_CACHE failure type + recovery handler; `sendMessageWithRetry` detects BFCache but recovery is reactive, not proactive | Chrome 123+ proactively closes message ports on BFCache entry; `pageshow` event with `event.persisted` is the canonical detection |
| 4 | Scroll-before-interact for off-viewport elements | Click/hover on elements below the fold must work; user expects "click the footer link" to just work | Low | `accessibility.js:scrollIntoViewIfNeeded` exists and runs in `ensureElementReady`; hover calls `smartEnsureReady` which includes scroll | Current implementation works for click; verify hover path actually scrolls (it calls `smartEnsureReady` at line 4117) |
| 5 | press_enter submits forms reliably | After filling a form, Enter should submit; autocomplete dropdowns intercept Enter for selection instead | Low | `actions.js:pressEnter` dispatches KeyboardEvent; no fallback to submit button detection | Playwright's `page.press('Enter')` also just sends the key -- but Playwright tests explicitly click submit buttons |
| 6 | Content extraction returns useful text, not 50K of noise | read_page returning entire page DOM text overwhelms AI context window; AI cannot find the answer | Medium | `extractPageText` has 50K char MAX_CHARS; no main-content detection; no Readability-style scoring | Mozilla Readability (401K weekly npm downloads) is the standard; Defuddle (by Obsidian team, 2025) improves on it with mobile-style analysis |
| 7 | Cookie consent banners do not block interaction | GDPR/CCPA banners overlay the entire page; clicking through them wastes AI actions and confuses flow | Medium | `ai-integration.js` has "PHASE 0 -- COOKIE BANNER DISMISSAL" in autopilot prompt; site-guides have OneTrust/Quantcast/Cookiebot selectors; NO automatic detection in MCP mode | DuckDuckGo's `autoconsent` library (200+ CMPs) and Consent-O-Matic (200+ CMPs) are production-grade solutions |

## Differentiators

Features that set FSB apart from basic browser automation. Not expected, but valued.

| # | Feature | Value Proposition | Complexity | Existing Dependency | Notes |
|---|---------|-------------------|------------|---------------------|-------|
| D1 | Smart search routing (site-specific vs Google) | AI-level intelligence: "search for X" on amazon.com uses Amazon's search bar, not Google; "google X" explicitly uses Google | High | Site guides already have per-site search selectors (e.g., Amazon `#twotabsearchtextbox`); `explorerDetectLayout` finds `[role="search"]` | No automation tool does this well -- Playwright/Puppeteer leave it to the test author; this is uniquely valuable for AI agents |
| D2 | Proactive content script re-injection | Instead of failing then recovering, pre-emptively re-inject content script on navigation events via `webNavigation.onCommitted` | Medium | `ensureContentScriptInjected` exists in background.js; currently reactive only | Chrome's `webNavigation.onCommitted` with `documentId` prevents duplicate injection; `pageshow` event in content script handles BFCache restore |
| D3 | Readability-scored content extraction | Extract only the "article" or "main content" using DOM scoring, not the entire page | High | `extractPageText` walks the entire DOM; no scoring system exists | Readability.js scores elements by text density, comma frequency, link density, class name patterns; Defuddle adds mobile-style analysis and site-specific extractors |
| D4 | Cookie consent auto-dismiss with CMP detection | Detect which CMP platform (OneTrust, Cookiebot, Quantcast, etc.) is present and click the right reject/accept button automatically | High | `cookie-opt-out.js` site guide has extensive CMP selector knowledge; `dom-analysis.js` already skips cookie/consent elements in snapshots | Could port autoconsent's rule engine (JSON-based, 200+ CMPs) or build a lighter version using existing site guide selectors |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full Readability.js library integration | 27KB library, requires JSDOM or document cloning, adds significant bundle size to content script | Implement a lightweight scoring heuristic inspired by Readability's algorithm: find `<article>`, `<main>`, `[role="main"]`, then fall back to highest-scoring `<div>` by text density. ~100 lines vs 27KB library |
| Cookie consent preference management | Full GDPR-compliant "reject all non-essential" requires multi-step CMP navigation (open preferences, toggle categories, save) -- complex and fragile | Simple dismiss: click the most prominent dismiss/accept/reject button. Goal is clearing the overlay, not privacy optimization. User can manage preferences manually |
| Full autoconsent library integration | 200+ CMP rules, complex rule engine, ongoing maintenance burden | Build a tiered selector approach: check 8-10 common CMP selectors covering ~90% of sites (OneTrust, Cookiebot, Quantcast, TrustArc, Didomi, Sourcepoint + generic patterns) |
| AI-powered search box detection | Using the AI model to identify search inputs adds latency and cost per page load | Use deterministic DOM heuristics: `[role="search"]`, `input[type="search"]`, `form[action*="search"]`, `input[name*="search"]`, `input[placeholder*="search" i]` -- these cover 95%+ of sites |
| Headless browser page.goto-style waiting | Puppeteer's `networkidle0` monitors at the browser level (all network connections); content scripts cannot see all network traffic | Existing `waitForPageStability` already monitors fetch/XHR + MutationObserver, which is the best a content script can do. Enhance, do not replace |
| Multi-step BFCache recovery chains | Complex retry-wake-reinject-verify chains with multiple fallback strategies | Single proactive path: listen for `webNavigation.onCommitted` in background.js, re-inject content script, verify with ping. One path, not five fallbacks |

## Feature Details and Ecosystem Patterns

### 1. Site-Aware Search

**Current behavior:** `search` MCP tool always calls `searchGoogle()` which navigates to `google.com/search?q=...`. When the AI says "search for wireless mouse" while on amazon.com, it leaves Amazon and goes to Google.

**How Playwright/Puppeteer handle it:** They do not have a "search" concept. Test authors explicitly find the search input, type text, and press Enter. The decision of where to search is made by the human writing the test.

**What FSB should do (because it has an AI agent making decisions):**

Detection heuristic (ordered by specificity):
1. `input[type="search"]` -- semantic HTML search input
2. `[role="search"] input, [role="search"] textarea` -- ARIA search landmark containing input
3. `form[action*="search"] input[type="text"], form[action*="search"] input:not([type])` -- form with search action
4. `input[name*="search" i], input[name*="query" i], input[name="q"]` -- common search parameter names
5. `input[placeholder*="search" i], input[aria-label*="search" i]` -- labeled search inputs
6. Fall through to Google as explicit fallback

**Confidence:** HIGH -- MDN documents `input[type="search"]` and `[role="search"]` as standard patterns. Every major site uses at least one of these.

**Architecture dependency:** New logic in `actions.js` replacing `searchGoogle`. MCP tool `search` in `manual.ts` changes verb from `searchGoogle` to new `siteSearch` verb. Background.js routing unchanged (already passes through `executeAction`).

**Complexity:** Medium. The detection is straightforward; the tricky part is handling autocomplete dropdowns (Amazon, YouTube) that intercept Enter key.

---

### 2. DOM Stability Before read_page

**Current behavior:** `readPage` immediately extracts text. On JS-heavy sites (React SPAs, Next.js with hydration), this captures skeleton screens, loading spinners, or partially-rendered content.

**How Playwright handles it:**
- Every action auto-waits for the element to be visible, stable, and enabled
- `page.waitForLoadState('networkidle')` waits for zero network connections for 500ms (discouraged in 2025 -- too brittle)
- `page.waitForLoadState('domcontentloaded')` waits for initial HTML parse
- Recommended: use locator assertions that auto-retry until condition met

**How Puppeteer handles it:**
- `page.goto(url, { waitUntil: 'networkidle2' })` -- no more than 2 connections for 500ms
- `page.waitForSelector(selector)` -- wait for specific element
- `page.waitForFunction(() => condition)` -- arbitrary JS condition

**What FSB should do:**
Call `waitForPageStability()` inside `readPage()` before extraction, with a lightweight profile:
```javascript
// Before extracting text
await waitForPageStability({
  maxWait: 3000,      // Cap at 3s -- don't block forever
  stableTime: 300,    // DOM quiet for 300ms
  networkQuietTime: 200 // Network quiet for 200ms
});
```

**Confidence:** HIGH -- `waitForPageStability` is already implemented and battle-tested in FSB. This is purely wiring it into `readPage`.

**Architecture dependency:** `actions.js:readPage` needs to become `async` (currently synchronous). `messaging.js` handler at line 782 already awaits the action result, so this is safe.

**Complexity:** Low. Single function call addition. The stability function already exists with proper cleanup.

---

### 3. Click Navigation Resilience (BF Cache)

**Current behavior:** Click triggers page navigation. Content script in old page is destroyed. Background.js tries to send next action to dead content script, gets communication failure. Recovery handler (`FAILURE_TYPES.BF_CACHE`) then tries to wake the page and re-inject. This reactive approach means every navigation-click wastes one action cycle on failure + recovery.

**How Chrome extensions should handle it (Chrome 123+ pattern):**

Background.js side:
```javascript
// Listen for navigation completions proactively
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) { // Main frame only
    await ensureContentScriptInjected(details.tabId);
    // Verify script is responsive
    await pageLoadWatcher.pingContentScript(details.tabId, 2000);
  }
});
```

Content script side:
```javascript
// Handle BFCache restore
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Page restored from BFCache -- reconnect to extension
    chrome.runtime.connect(); // Fresh port
    // Re-initialize any state
  }
});
```

**Key Chrome 123+ detail:** When a page with an open extension message port enters BFCache, Chrome now proactively closes the port from the content script side. The extension receives `onDisconnect`. When the user navigates back, the page is restored but the port stays closed -- the content script must reconnect via `pageshow`.

**Confidence:** HIGH -- Chrome's official documentation explicitly describes this pattern. FSB already has `ensureContentScriptInjected` and `pingContentScript`.

**Architecture dependency:** `background.js` needs `webNavigation.onCommitted` listener (manifest already has `webNavigation` permission). `content/init.js` needs `pageshow` event listener. `content/messaging.js` needs reconnection logic.

**Complexity:** Medium. The individual pieces exist; wiring them together proactively instead of reactively requires careful ordering (inject after commit, wait for load before ping).

---

### 4. Viewport-Aware Click/Hover

**Current behavior:** `smartEnsureReady` (accessibility.js line 980) calls `scrollIntoViewIfNeeded` at step 3. Both `click` and `hover` call `smartEnsureReady`. The diagnostic at actions.js line 595 checks `inViewport` and suggests scrolling.

**How Playwright handles it:**
- `scrollIntoViewIfNeeded` is a built-in action that only checks "Stable" (element not animating)
- Before click, Playwright scrolls the element into view automatically
- "Element is outside of the viewport" error occurs when scroll fails (e.g., element in a non-scrollable overflow:hidden container)

**What FSB should verify:**
The path `hover` -> `smartEnsureReady` -> `ensureElementReady` -> `scrollIntoViewIfNeeded` at accessibility.js line 1057 should already handle this. The reported bug may be that:
1. `scrollIntoView({ behavior: 'instant', block: 'center' })` can fail for elements inside scrollable containers (not the main document scroll)
2. After scrolling, the element may need a stability re-check before the hover fires
3. Fixed-position overlays (headers, cookie banners) may cover the element after scroll

**Confidence:** MEDIUM -- Need to verify actual failure mode. The architecture supports viewport scrolling; the bug may be in edge cases (nested scrollable containers, sticky headers eating viewport space).

**Architecture dependency:** `accessibility.js:scrollIntoViewIfNeeded`. May need enhancement to handle nested scroll containers.

**Complexity:** Low if the fix is just ensuring hover uses the same path as click. Medium if nested scroll containers need addressing.

---

### 5. Smart press_enter Fallback

**Current behavior:** `pressEnter` dispatches `keydown`/`keyup` KeyboardEvent for Enter key. Works on simple forms. Fails when autocomplete dropdowns (Google, Amazon, combobox patterns) intercept Enter to select the highlighted suggestion instead of submitting the form.

**How Playwright handles it:**
Playwright does not solve this automatically. Test authors explicitly choose between:
- `page.keyboard.press('Enter')` -- sends the key
- `page.click('button[type="submit"]')` -- clicks submit button
The human decides which is appropriate for the context.

**What FSB should do (because the AI agent needs a reliable submit path):**

After Enter key dispatch, check if a form was actually submitted:
1. Check if URL changed (navigation = submission succeeded)
2. Check if a success message appeared
3. If neither, look for a submit button:
   - `button[type="submit"]`
   - `input[type="submit"]`
   - `button:has-text("Submit")`, `button:has-text("Search")`, `button:has-text("Go")`
   - The form's own submit button within the same `<form>` element
4. Click the found submit button as fallback

**Confidence:** HIGH -- The pattern is simple and deterministic. Form submission is well-understood.

**Architecture dependency:** `actions.js:pressEnter` handler. Needs to become async (check post-state). May need the form detection logic from `lifecycle.js:explorerDetectLayout` which already finds `[role="form"]`.

**Complexity:** Low. Check URL change after Enter, if no change look for submit button, click it.

---

### 6. Intelligent Content Truncation for read_page

**Current behavior:** `extractPageText` walks entire DOM (or viewport), outputs markdown-lite text, caps at 50K characters. No prioritization of main content vs. navigation, sidebar, footer, ads.

**How content extraction libraries work:**

**Mozilla Readability (standard, 401K weekly npm downloads):**
1. Score leaf nodes (paragraphs, pre, td) by text quality: comma frequency, text length, link density penalty
2. Propagate scores upward to parent containers with decreasing weight
3. Select "top candidate" container with highest accumulated score
4. Merge sibling elements with substantial text
5. Clean up: remove scripts, styles, empty elements, fix URLs

**Defuddle (2025, by Obsidian/Kepano):**
- Multi-pass detection with recovery on empty results
- Extractor Registry for known sites (site-specific extractors)
- Uses page's mobile styles to identify removable elements
- Outputs standardized markdown (not raw HTML like Readability)

**What FSB should do (lightweight, no external library):**

A content-scoring heuristic inspired by Readability, ~100-150 lines:
1. Try semantic containers first: `<article>`, `<main>`, `[role="main"]`, `#content`, `#main-content`, `.post-content`, `.article-body`
2. If none found, score top-level `<div>` elements by:
   - Text density (text length / total inner length including tags)
   - Paragraph count (more `<p>` tags = more likely content)
   - Link density penalty (high link ratio = navigation, not content)
   - Class/ID bonus: "content", "article", "post", "body" patterns
   - Class/ID penalty: "sidebar", "nav", "footer", "header", "comment", "ad", "widget"
3. Extract from winning container
4. Cap at ~8K characters (enough for AI context, not overwhelming)
5. Include truncation note if capped

**Confidence:** MEDIUM -- The heuristic approach works well for article-style pages but may struggle with non-article pages (dashboards, email clients, social feeds). The semantic container approach (`<article>`, `<main>`) has high confidence as it follows web standards.

**Architecture dependency:** `dom-analysis.js:extractPageText`. New scoring function. The existing `isVisibleForSnapshot` and viewport filtering can be reused.

**Complexity:** Medium. The scoring algorithm is non-trivial to tune, but a "good enough" version covering 80% of cases is straightforward.

---

### 7. Cookie Consent Auto-Dismiss

**Current behavior:** In autopilot mode, the AI prompt includes "PHASE 0 -- COOKIE BANNER DISMISSAL" instructions. In MCP manual mode, cookie banners block interaction and the AI must manually detect and dismiss them, wasting actions. The `dom-analysis.js` at line 1221 already skips cookie/consent elements in snapshots, making them invisible to the AI.

**How production tools handle this:**

**DuckDuckGo autoconsent (github.com/duckduckgo/autoconsent):**
- Library of rules for 200+ CMPs
- Three rule types: JSON rulesets, AutoCMP interface classes, Consent-O-Matic compatible rules
- Each rule defines: CMP detection (is this CMP present?), popup visibility check, opt-in/opt-out steps
- Used in DuckDuckGo browser for automatic handling

**Consent-O-Matic (github.com/cavi-au/Consent-O-Matic):**
- 200+ CMP rules in a single Rules.json file
- DOM selection with parent/target, CSS selectors, text/style/display filters
- JSON entries per CMP: detectors (present + showing matchers), ordered methods (actions)
- Supports iframe checks and shadow DOM

**"I Don't Care About Cookies" extension:**
- Maintains a curated list of CSS selectors per site
- In most cases, just hides the banner via CSS
- When hiding breaks functionality, clicks Accept automatically
- User reporting mechanism for uncovered sites

**What FSB should do (tiered approach for MCP mode):**

Run once on page load (or on first MCP tool call per page):
1. **Tier 1 -- Known CMP selectors (covers ~80% of consent banners):**
   ```
   OneTrust:    #onetrust-accept-btn-handler, .onetrust-close-btn-handler
   Cookiebot:   #CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept
   Quantcast:   .qc-cmp2-summary-buttons button[mode="primary"], button.css-47sehv
   TrustArc:    #truste-consent-button, .truste-consent-close
   Didomi:      #didomi-notice-agree-button, button[class*="didomi"]
   Sourcepoint: button.sp_choice_type_11, button[title="Accept"]
   ```
2. **Tier 2 -- Generic patterns (covers additional ~15%):**
   ```
   button[id*="accept" i][id*="cookie" i]
   button[class*="accept" i][class*="cookie" i]
   button[aria-label*="accept" i][aria-label*="cookie" i]
   [class*="consent"] button[class*="accept" i]
   [class*="cookie-banner"] button:first-of-type
   ```
3. **Tier 3 -- Overlay dismissal (last resort):**
   - Detect full-page overlay (`position:fixed` with high z-index covering >50% viewport)
   - Find any button inside it with dismiss-like text ("OK", "Accept", "Got it", "Continue", "Agree")
   - Click it

**Confidence:** HIGH for Tier 1 (well-documented CMP selectors from existing site guide). MEDIUM for Tier 2/3 (generic patterns may have false positives).

**Architecture dependency:** New function in `content/actions.js` or new module. Called from `background.js` after page load detection (in `webNavigation.onCompleted` or after `waitForPageStability`). MCP mode: called automatically before first tool execution per page.

**Complexity:** Medium. The selector lists are straightforward; the challenge is timing (banners may load asynchronously after initial page load) and avoiding false positives (not every overlay is a cookie banner).

## Feature Dependencies

```
Site-aware search (1) -- standalone, no dependencies

read_page stability (2) --> Content truncation (6)
  (stability must work before truncation logic runs on stable content)

BF cache resilience (3) -- standalone, but benefits all click-based features

Viewport scroll (4) -- standalone, already mostly works

press_enter fallback (5) -- standalone, no dependencies

Content truncation (6) -- depends on (2) for stable input

Cookie dismiss (7) --> All other features
  (must clear overlays before any interaction tool works properly)
```

## MVP Recommendation

**Implement in this order (dependency + impact):**

1. **Cookie consent auto-dismiss (7)** -- Unblocks all other tools on GDPR sites. Without this, click/hover/type all fail when an overlay is present. Highest impact per line of code. Start with Tier 1 selectors only (8 CMP patterns, ~50 lines).

2. **read_page + stability merge (2)** -- Single-line wiring change (add `await waitForPageStability()` call inside `readPage`). Highest reliability improvement for lowest effort. Already-existing function just needs to be called.

3. **Site-aware search (1)** -- Replace `searchGoogle` with site-search-first heuristic. The DOM detection heuristics are deterministic and well-understood. High visibility improvement for MCP users.

4. **BF cache proactive re-injection (3)** -- Add `webNavigation.onCommitted` listener and `pageshow` handler. Eliminates the most common MCP failure mode (click succeeds but next action fails).

5. **Smart press_enter fallback (5)** -- Check if Enter submitted, if not find submit button. Small change, clear logic.

6. **Content truncation (6)** -- Implement lightweight content scoring. Depends on (2) being done. More complex but high value for AI context quality.

7. **Viewport-aware hover fix (4)** -- Verify existing scroll path works for hover. May be as simple as confirming `smartEnsureReady` is called (it already is at actions.js line 4117). Lowest priority because it may already work.

**Defer:** Full Readability.js integration, full autoconsent library, AI-powered search detection. These are over-engineered for the problem scope.

## Sources

- [Playwright Auto-waiting / Actionability Checks](https://playwright.dev/docs/actionability)
- [BrowserStack: Playwright Wait Types 2026](https://www.browserstack.com/guide/playwright-wait-types)
- [BrowserStack: Playwright waitForLoadState 2026](https://www.browserstack.com/guide/playwright-waitforloadstate)
- [Puppeteer waitForNavigation](https://www.webshare.io/academy-article/puppeteer-waitfornavigation)
- [Puppeteer waitUntil options](https://www.browserless.io/blog/waituntil-option-for-puppeteer-and-playwright)
- [Mozilla Readability Algorithm Explained](https://webcrawlerapi.com/blog/mozilla-readability-algorithm-readabilityjs)
- [Mozilla Readability GitHub (10.3K stars, 401K weekly downloads)](https://github.com/mozilla/readability)
- [Defuddle -- Modern Alternative to Readability](https://github.com/kepano/defuddle)
- [Defuddle vs Postlight Parser Comparison](https://jocmp.com/2025/07/12/full-content-extractors-comparing-defuddle/)
- [Chrome BFCache Extension Messaging Changes (Chrome 123+)](https://developer.chrome.com/blog/bfcache-extension-messaging-changes)
- [Chrome webNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [DuckDuckGo autoconsent (200+ CMP rules)](https://github.com/duckduckgo/autoconsent)
- [Consent-O-Matic Rules.json](https://github.com/cavi-au/Consent-O-Matic/blob/master/Rules.json)
- [MDN: ARIA search role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/search_role)
- [MDN: input type="search"](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/search)
- [npm trends: Readability vs Mercury Parser](https://npmtrends.com/@mozilla/readability-vs-@postlight/mercury-parser-vs-html-to-text-vs-node-readability)
