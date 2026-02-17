# Phase 1: Signal Accuracy Fixes - Research

**Researched:** 2026-02-14
**Domain:** Chrome Extension content script -- DOM viewport detection, CAPTCHA identification, Shadow DOM traversal
**Confidence:** HIGH

## Summary

This phase fixes three broken signals in `content.js` that corrupt all downstream AI decisions: viewport visibility classification, CAPTCHA presence detection, and Shadow DOM element resolution. All three are surgical edits to existing functions -- no new files, no new dependencies, no build tools.

The codebase has two viewport check functions: `isElementInViewport()` (line 8467, used for element data `position.inViewport`) and `isInViewportRect()` (line 10593, used to classify elements into viewport vs offscreen arrays). Both need the overlap-based fix, but `isInViewportRect` already does partial overlap checks correctly (any overlap qualifies). The critical bug is in `isElementInViewport()` which requires the ENTIRE element to be inside the viewport -- failing for any element partially clipped by a split-pane boundary. The CAPTCHA detection uses two independent paths that both produce false positives: a page-level `hasCaptcha` selector (line 10098) matching generic CSS classes like `.captcha-container`, and element-level `isCaptcha` flagging (line 10740) that matches any element whose class name contains "recaptcha" or "captcha" strings. The `waitForElement` tool (line 6714) uses `document.querySelector()` while `click` and all other tools use `querySelectorWithShadow()`, creating an inconsistency where `waitForElement` times out on elements that exist in shadow DOM.

**Primary recommendation:** Fix `isElementInViewport()` to use overlap-ratio calculation with 25% threshold, replace CAPTCHA CSS-class matching with `data-sitekey` + visibility + dimension checks, and swap `document.querySelector` for `querySelectorWithShadow` in `waitForElement`.

## Standard Stack

This phase uses no external libraries. All changes are pure vanilla JavaScript within Chrome Extension content scripts (Manifest V3).

### Core
| Technology | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension Manifest V3 | Chrome 88+ | Extension runtime | Project already uses MV3 |
| `getBoundingClientRect()` | Web API (all browsers) | Element position/size relative to viewport | Already used throughout codebase, synchronous, reliable |
| `chrome.dom` | Chrome 88+ | Access open AND closed shadow roots | Available in content scripts, no additional permissions needed |

### Supporting
| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `window.getComputedStyle()` | Web API | Visibility checks for CAPTCHA elements | Verify computed display/visibility/opacity |
| `MutationObserver` | Web API | Already used in `waitForActionable` | Not needed for this phase, already integrated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `getBoundingClientRect()` overlap calc | `IntersectionObserver` | IO is async/callback-based, not suitable for synchronous element classification during DOM traversal. `getBoundingClientRect()` is correct here because the function is called per-element during a synchronous traversal loop. |
| `chrome.dom.openOrClosedShadowRoot()` | Manual `element.shadowRoot` check | Manual check only works for open shadow roots. `chrome.dom` handles both open AND closed. However, the existing `querySelectorWithShadow` only checks `element.shadowRoot` (open mode). Upgrading to `chrome.dom` is a potential enhancement but NOT required for SIG-03 -- the bug is that `waitForElement` doesn't call `querySelectorWithShadow` at all. |

**Installation:** None needed. All APIs are built into Chrome 88+.

## Architecture Patterns

### Pattern 1: Overlap-Ratio Viewport Detection
**What:** Calculate the intersection area between an element's bounding rect and the viewport rect, then divide by the element's total area. If the ratio meets the threshold (25%), classify as "in viewport."
**When to use:** Any time you need to determine if an element is "visible enough" to interact with in a split-pane, scrollable, or clipped layout.
**Why 25% threshold:** The roadmap specifies 25%. This means an element that is 75% clipped by a panel boundary still counts as in-viewport. This is appropriate for automation -- the AI needs to know the element exists and can be scrolled into full view or clicked.

```javascript
// Overlap-ratio viewport check
function isElementInViewport(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Calculate overlap region
  const overlapLeft = Math.max(rect.left, 0);
  const overlapTop = Math.max(rect.top, 0);
  const overlapRight = Math.min(rect.right, vw);
  const overlapBottom = Math.min(rect.bottom, vh);

  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);
  const overlapArea = overlapWidth * overlapHeight;

  const elementArea = rect.width * rect.height;
  if (elementArea <= 0) return false;

  return (overlapArea / elementArea) >= 0.25;
}
```

### Pattern 2: Multi-Signal CAPTCHA Detection
**What:** Verify CAPTCHA presence using multiple required signals: (1) a known CAPTCHA container element with `data-sitekey` attribute OR a CAPTCHA iframe with known src pattern, (2) the element must be visible (computed display/visibility/opacity), and (3) the element must have meaningful dimensions (not 0x0 hidden iframes).
**When to use:** Replacing CSS-class-only matching that produces false positives on sites like LinkedIn.

### Pattern 3: Consistent Shadow DOM Resolution
**What:** Use the same element resolution function (`querySelectorWithShadow`) in all tool handlers, ensuring `waitForElement` finds the same elements that `click`, `type`, `hover`, etc. can find.
**When to use:** Any tool that resolves a selector to a DOM element.

### Anti-Patterns to Avoid
- **Full-containment viewport check:** `rect.top >= 0 && rect.left >= 0 && rect.bottom <= vh && rect.right <= vw` excludes ANY partially-visible element. This is the current bug.
- **CSS class-only CAPTCHA detection:** Classes like `.captcha-container`, `.captcha-challenge`, or substring matches on "recaptcha"/"captcha" in class names produce false positives on sites that reuse these class names for non-CAPTCHA UI (e.g., LinkedIn's security challenge layouts).
- **Different query functions for different tools:** Using `document.querySelector` in `waitForElement` but `querySelectorWithShadow` in `click` means waiting for an element that exists but cannot be found, then finding it instantly when clicking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shadow DOM access for closed roots | Custom tree walker for closed shadow DOM | `chrome.dom.openOrClosedShadowRoot()` | Content scripts have access to `chrome.dom` API which pierces both open and closed shadow roots. Not required for SIG-03 (the bug is simpler) but good to know for future. |
| Viewport overlap math | Complex geometry library | Simple `Math.max`/`Math.min` rectangle intersection | Standard rectangle intersection is 6 lines of code -- well-understood geometry, no library needed. |
| CAPTCHA provider detection | Regex-heavy class name scanning | Known DOM signatures (`data-sitekey`, specific iframe src patterns) | Each CAPTCHA provider (reCAPTCHA, hCaptcha, Turnstile) publishes well-documented DOM structures. Match those structures, not arbitrary class names. |

**Key insight:** All three fixes are about narrowing overly-broad detection to precise, signal-verified detection. The existing code casts a wide net (any overlap = viewport, any class name match = CAPTCHA, standard querySelector = element found) and each wide net catches false positives/negatives. The fix in every case is to add specificity.

## Common Pitfalls

### Pitfall 1: Zero-Area Elements in Viewport Calculation
**What goes wrong:** Elements with `width: 0` or `height: 0` (hidden inputs, collapsed elements) produce `elementArea = 0`, causing division by zero or `NaN` in the overlap ratio.
**Why it happens:** Hidden form inputs, `<br>` tags, and collapsed containers have valid bounding rects but zero area.
**How to avoid:** Check `elementArea > 0` before computing ratio. Return `false` for zero-area elements.
**Warning signs:** `NaN` in `position.inViewport` field, or zero-size elements classified as in-viewport.

### Pitfall 2: Negative Overlap from Completely Off-Screen Elements
**What goes wrong:** If `overlapRight < overlapLeft` or `overlapBottom < overlapTop`, the overlap width/height is negative, producing incorrect area calculations.
**Why it happens:** Elements completely outside the viewport produce a negative overlap region.
**How to avoid:** Clamp overlap dimensions with `Math.max(0, ...)` before computing area.
**Warning signs:** Off-screen elements reported as in-viewport.

### Pitfall 3: CAPTCHA Iframes in Cross-Origin Contexts
**What goes wrong:** CAPTCHA widgets (reCAPTCHA, hCaptcha, Turnstile) render inside iframes. Content scripts cannot access iframe contents from a different origin.
**Why it happens:** Same-origin policy prevents cross-origin iframe DOM access.
**How to avoid:** Detect CAPTCHA by examining the **iframe element itself** (its `src` attribute, its dimensions, its visibility) from the parent document, not by trying to access its contents. The existing code already does this for `iframe[src*="recaptcha"]` etc. -- just add visibility and dimension gating.
**Warning signs:** Attempting `iframe.contentDocument` on a cross-origin frame throws a SecurityError.

### Pitfall 4: LinkedIn Security UI Triggering False CAPTCHA
**What goes wrong:** LinkedIn uses CSS class names that contain "captcha" or "challenge" strings for non-CAPTCHA security UI elements. The current `.captcha-container` and `.captcha-challenge` selectors match these.
**Why it happens:** The current page-level selector at line 10098 includes generic selectors: `.captcha-container, .captcha-challenge`. LinkedIn has elements matching these classes that are NOT actual interactive CAPTCHA challenges.
**How to avoid:** Remove `.captcha-container` and `.captcha-challenge` from the selector. Only match elements that have a `data-sitekey` attribute (reCAPTCHA/hCaptcha/Turnstile all require it) OR iframes with known CAPTCHA provider URLs. Additionally gate all matches with visibility and dimension checks.
**Warning signs:** `captchaPresent: true` on pages with no actual CAPTCHA widget. `pageIntent` set to `captcha-challenge` when it should be something else.

### Pitfall 5: Element-Level CAPTCHA Substring Matching Too Broad
**What goes wrong:** The element-level check at line 10741-10744 uses `classNames.includes('recaptcha')` and `classNames.includes('hcaptcha')`. Any class containing these substrings triggers false positives. For example, a class like `no-recaptcha-needed` would match.
**Why it happens:** String `includes()` matches substrings, not whole class names.
**How to avoid:** Require `data-sitekey` attribute as the primary signal for element-level CAPTCHA detection. If using class checks, split on spaces and match whole class names, or better yet, don't rely on class names at all.
**Warning signs:** Elements flagged as `isCaptcha: true` that have no `data-sitekey`, no CAPTCHA iframe, and no interactive challenge.

### Pitfall 6: waitForElement Polling Interval vs querySelectorWithShadow Cost
**What goes wrong:** `querySelectorWithShadow` does more work than `document.querySelector` -- it sanitizes selectors, checks cache, handles XPath, handles shadow DOM piercing, and does aria-label fallback. Running it every 100ms in a polling loop could be more expensive.
**Why it happens:** The original `waitForElement` uses `document.querySelector` in a 100ms `setInterval`.
**How to avoid:** The existing caching in `querySelectorWithShadow` (via `elementCache.get`) mitigates this. However, be aware the cache may return stale results -- cached elements that were removed from DOM. For `waitForElement`, the cache is actually helpful since we are polling for an element that doesn't exist yet (cache miss until it appears). Once found, the cache hit on the next poll confirms it's still there. The 100ms interval is fine for the shadow DOM traversal.
**Warning signs:** High CPU during `waitForElement` calls.

### Pitfall 7: Two Viewport Functions, One Fix Needed or Two?
**What goes wrong:** The codebase has TWO viewport check functions: `isElementInViewport()` (line 8467) and `isInViewportRect()` (line 10593). Fixing only one leaves the other broken.
**Why it happens:** `isElementInViewport()` is used for the `position.inViewport` property on each element's data. `isInViewportRect()` is used to classify elements into `viewportElements[]` vs `offscreenElements[]` arrays for the viewport-priority budget.
**How to avoid:** `isInViewportRect()` already does an overlap-based check (any overlap with viewport = in viewport). It does NOT require full containment. So it works correctly for split-pane layouts. The bug is specifically in `isElementInViewport()` at line 8467 which requires full containment. Only `isElementInViewport()` needs the 25% overlap threshold fix.
**Warning signs:** Inconsistency between `position.inViewport` (from `isElementInViewport`) and the viewport/offscreen array classification (from `isInViewportRect`). An element could be in `viewportElements[]` but have `position.inViewport: false`.

## Code Examples

### SIG-01: Overlap-Based Viewport Detection (Replace `isElementInViewport` at line 8467)

```javascript
// BEFORE (current - full containment, fails on split-pane layouts):
function isElementInViewport(rect) {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

// AFTER (overlap-ratio with 25% threshold):
function isElementInViewport(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Calculate overlap between element rect and viewport
  const overlapLeft = Math.max(rect.left, 0);
  const overlapTop = Math.max(rect.top, 0);
  const overlapRight = Math.min(rect.right, vw);
  const overlapBottom = Math.min(rect.bottom, vh);

  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);
  const overlapArea = overlapWidth * overlapHeight;

  const elementArea = rect.width * rect.height;
  // Zero-area elements (hidden inputs, collapsed) are not in viewport
  if (elementArea <= 0) return false;

  // 25% threshold: element is "in viewport" if at least 25% of its area is visible
  return (overlapArea / elementArea) >= 0.25;
}
```

### SIG-02a: Page-Level CAPTCHA Detection (Replace selector at line 10098)

```javascript
// BEFORE (current - matches generic CSS classes):
hasCaptcha: document.querySelector(
  '.g-recaptcha, .h-captcha, .cf-turnstile, .captcha-container, .captcha-challenge, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]'
) !== null,

// AFTER (require data-sitekey or known iframe src, plus visibility/dimension checks):
hasCaptcha: (() => {
  // Known CAPTCHA container selectors -- all require data-sitekey
  const captchaContainers = document.querySelectorAll(
    '[data-sitekey], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]'
  );
  for (const el of captchaContainers) {
    // Must be visible
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    // Must have meaningful dimensions (not a hidden 0x0 tracking pixel)
    const rect = el.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 30) continue;
    // Found a visible, sized CAPTCHA element
    return true;
  }
  return false;
})(),
```

### SIG-02b: Element-Level CAPTCHA Detection (Replace check at line 10740-10746)

```javascript
// BEFORE (current - class name substring matching):
const classNames = node.className ? String(node.className) : '';
if (classNames.includes('g-recaptcha') || classNames.includes('recaptcha') ||
    classNames.includes('h-captcha') || classNames.includes('hcaptcha') ||
    classNames.includes('cf-turnstile') || classNames.includes('turnstile')) {
  elementData.isCaptcha = true;
}

// AFTER (require data-sitekey attribute + visibility/size check):
if (node.hasAttribute('data-sitekey')) {
  const style = window.getComputedStyle(node);
  const captchaRect = node.getBoundingClientRect();
  if (style.display !== 'none' && style.visibility !== 'hidden' &&
      style.opacity !== '0' && captchaRect.width >= 30 && captchaRect.height >= 30) {
    elementData.isCaptcha = true;
  }
}
```

### SIG-03: waitForElement Shadow DOM Consistency (Replace querySelector at line 6720)

```javascript
// BEFORE (current - uses document.querySelector, misses shadow DOM):
waitForElement: async (params) => {
  const { selector, timeout = 5000 } = params;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const element = document.querySelector(selector);  // BUG: no shadow DOM
      if (element || Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve({
          success: !!element,
          found: !!element,
          selector,
          waitTime: Date.now() - startTime
        });
      }
    }, 100);
  });
},

// AFTER (use querySelectorWithShadow for consistency with click/type/etc):
waitForElement: async (params) => {
  const { selector, timeout = 5000 } = params;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const element = querySelectorWithShadow(selector);  // FIXED: matches click/type/etc
      if (element || Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve({
          success: !!element,
          found: !!element,
          selector,
          waitTime: Date.now() - startTime
        });
      }
    }, 100);
  });
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-containment viewport check | Overlap-ratio check (IntersectionObserver uses this internally) | Always been the correct approach | Fixes split-pane layouts like Gmail, LinkedIn, Slack |
| CSS class name CAPTCHA detection | `data-sitekey` attribute + iframe src + visibility gating | reCAPTCHA/hCaptcha/Turnstile all document `data-sitekey` as required | Eliminates false positives on LinkedIn and similar sites |
| `element.shadowRoot` (open only) | `chrome.dom.openOrClosedShadowRoot()` (open + closed) | Chrome 88+ (MV3 requirement) | Not needed for SIG-03 but available for future enhancement |

**Deprecated/outdated:**
- `.captcha-container` / `.captcha-challenge` CSS selectors: These are NOT standardized CAPTCHA selectors. They are generic class names that any website can use for any purpose. Drop them entirely.
- Substring-based class name matching for CAPTCHA (e.g., `classNames.includes('recaptcha')`): Too broad. Match specific elements with known attributes.

## Open Questions

1. **Should `isInViewportRect()` also get the 25% threshold?**
   - What we know: `isInViewportRect()` (line 10593) already uses any-overlap logic (not full containment). It classifies an element as "viewport" if even 1 pixel overlaps.
   - What's unclear: Should there be consistency between the two functions? Having `isInViewportRect` say "viewport" (any overlap) while `isElementInViewport` says "not in viewport" (less than 25% overlap) creates different classifications for the same element.
   - Recommendation: Accept this asymmetry for now. `isInViewportRect` controls budget allocation (which elements get sent to AI) -- being generous here is fine. `isElementInViewport` controls the `position.inViewport` flag the AI sees -- the 25% threshold gives the AI useful signal about what's actually visible. The AI seeing `inViewport: false` for a 5%-visible element correctly tells it to scroll.

2. **CAPTCHA iframe detection for invisible reCAPTCHA v3**
   - What we know: reCAPTCHA v3 is invisible -- it has no visible widget. It loads via `<script>` tag and runs in the background.
   - What's unclear: Does the current iframe selector `iframe[src*="recaptcha"]` match reCAPTCHA v3 iframes? If so, the dimension check (>= 30px) would correctly filter them out since v3 iframes are typically 0x0 or very small.
   - Recommendation: The dimension check naturally handles this. Invisible CAPTCHAs (v3, invisible reCAPTCHA v2) should NOT set `captchaPresent: true` since there is nothing for the user/AI to solve. The 30px minimum dimension threshold correctly excludes them.

3. **`chrome.dom.openOrClosedShadowRoot` for enhanced shadow DOM access**
   - What we know: `chrome.dom` is available in content scripts without additional permissions (confirmed via Chrome docs). It can access closed shadow roots that `element.shadowRoot` cannot.
   - What's unclear: Whether any real-world sites that FSB interacts with use closed shadow roots.
   - Recommendation: Do NOT change `querySelectorWithShadow` to use `chrome.dom` in this phase. The SIG-03 fix is simply changing `document.querySelector` to `querySelectorWithShadow` in `waitForElement`. Adding `chrome.dom` support is a separate enhancement for a future phase.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of `content.js` lines: 8467-8474 (`isElementInViewport`), 10593-10598 (`isInViewportRect`), 10098-10100 (page-level CAPTCHA), 10740-10746 (element-level CAPTCHA), 6714-6731 (`waitForElement` tool), 2609-2694 (`querySelectorWithShadow`), 5002-5020 (`click` tool)
- **MDN getBoundingClientRect** - https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect - Confirmed viewport-relative coordinates, DOMRect properties
- **Chrome Extensions Content Scripts** - https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts - Confirmed `chrome.dom` is available in content scripts
- **Chrome dom API** - https://developer.chrome.com/docs/extensions/reference/api/dom - `openOrClosedShadowRoot()` available Chrome 88+
- **Google reCAPTCHA v2 docs** - https://developers.google.com/recaptcha/docs/display - Confirmed `data-sitekey` attribute on `.g-recaptcha` div
- **hCaptcha docs** - https://docs.hcaptcha.com/ - Confirmed `.h-captcha` class with `data-sitekey` attribute
- **Cloudflare Turnstile docs** - https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ - Confirmed `.cf-turnstile` class with `data-sitekey` attribute, iframe from challenges.cloudflare.com

### Secondary (MEDIUM confidence)
- **IntersectionObserver vs getBoundingClientRect comparison** - Multiple web sources confirm getBoundingClientRect is appropriate for synchronous per-element checks during DOM traversal (IO is async/callback-based)

### Tertiary (LOW confidence)
- **LinkedIn false CAPTCHA** - No specific documentation found on which CSS classes LinkedIn uses that trigger false positives. The diagnosis is based on the roadmap's investigation findings (#3 False CAPTCHA detection on every LinkedIn page) and code analysis showing `.captcha-container`/`.captcha-challenge` are in the selector.

## Metadata

**Confidence breakdown:**
- Viewport fix (SIG-01): HIGH - Based on direct code reading and well-documented `getBoundingClientRect` API. The overlap-ratio math is standard rectangle intersection geometry.
- CAPTCHA fix (SIG-02): HIGH - reCAPTCHA, hCaptcha, and Turnstile all document `data-sitekey` as their primary DOM marker. Dropping generic CSS class matching is clearly correct.
- Shadow DOM fix (SIG-03): HIGH - Direct code reading shows `waitForElement` uses `document.querySelector` while `click` uses `querySelectorWithShadow`. The fix is a one-line change.
- Pitfall analysis: HIGH - All pitfalls identified from direct code analysis and standard web API behavior.

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable -- Chrome Extension APIs and DOM APIs are mature and change slowly)
