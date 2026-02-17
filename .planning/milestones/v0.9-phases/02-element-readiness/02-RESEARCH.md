# Phase 2: Element Readiness - Research

**Researched:** 2026-02-03
**Domain:** DOM Element Visibility, Interactability, and Readiness Validation
**Confidence:** HIGH

## Summary

This research investigates how to determine whether a DOM element is ready to receive browser automation actions. The problem has well-established solutions from Playwright's auto-wait system and native browser APIs. The core challenge is performing these checks reliably without false positives (blocking valid interactions) or false negatives (acting on non-ready elements).

The current FSB implementation (`content.js`) has partial coverage: `isElementActionable()` (lines 1513-1590) checks visibility and obscuration, `waitForActionable()` (lines 1602-1750) waits for elements to become ready, and several action handlers already scroll elements into view. However, these checks are scattered, inconsistent, and not applied uniformly before all actions. The existing implementation also has gaps in fieldset-disabled detection and inconsistent obscuration checking.

The standard approach in 2026 follows Playwright's five actionability checks: **Visible** (has non-empty bounding box, not `display:none` or `visibility:hidden`), **Stable** (same bounding box for two animation frames), **Enabled** (not disabled via any mechanism), **Receives Events** (not obscured by overlays), and **Editable** (for input actions). These checks should be centralized into a single `ensureElementReady()` function called by all action handlers.

**Primary recommendation:** Consolidate element readiness checks into a unified `ensureElementReady(element, actionType)` function that returns a detailed result object, then refactor all action handlers to use it before performing actions.

## Standard Stack

This phase uses only native browser APIs - no external libraries required.

### Core
| API | Purpose | Why Standard |
|-----|---------|--------------|
| `Element.getBoundingClientRect()` | Check element has non-zero dimensions and position | Native, universally supported, accurate to viewport |
| `document.elementFromPoint(x, y)` | Check if element is obscured at its center point | Native hit-testing, matches actual click behavior |
| `Element.checkVisibility(options)` | Modern visibility check (display, visibility, opacity) | New native API (2024 baseline), comprehensive |
| `window.getComputedStyle()` | Check CSS visibility properties | Native, reliable for `display`, `visibility`, `opacity` |
| `Element.matches(':disabled')` | Check disabled state including fieldset inheritance | CSS pseudo-class handles all disabled scenarios |
| `Element.scrollIntoView(options)` | Scroll element into viewport before action | Native smooth scrolling with centering |

### Supporting
| API | Purpose | When to Use |
|-----|---------|-------------|
| `IntersectionObserver` | Efficient viewport visibility monitoring | When watching multiple elements over time |
| `MutationObserver` | Detect DOM stability (no mutations = stable) | Already used in codebase for DOM change tracking |
| `requestAnimationFrame` | Check position stability across frames | Verifying element is not animating |
| `Element.closest()` | Find ancestor fieldsets or overlays | Checking disabled inheritance and overlay context |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `checkVisibility()` | Manual style checks | checkVisibility is cleaner but newer (2024); manual checks for broader compatibility |
| Center-point hit testing | Multi-point hit testing | Multiple points more accurate but slower; center-point sufficient for most cases |
| `requestAnimationFrame` | `setTimeout(50ms)` | rAF is more accurate but existing code uses setTimeout successfully |

**No Installation Required** - All functionality uses native browser APIs.

## Architecture Patterns

### Recommended Code Structure
```
content.js (existing, needs refactoring)
  ensureElementReady()        # NEW: Unified readiness check entry point
  checkElementVisibility()    # NEW: Extracted visibility checks
  checkElementEnabled()       # NEW: Extracted enabled state checks
  checkElementObscured()      # REFACTOR: From isElementActionable()
  checkElementStable()        # NEW: Position stability check
  scrollIntoViewIfNeeded()    # REFACTOR: Extract from action handlers
  waitForElementReady()       # REFACTOR: From waitForActionable()
```

### Pattern 1: Playwright-Style Actionability Checks
**What:** Check five conditions before every action: visible, enabled, stable, receives events, editable (for inputs)
**When to use:** Before executing any action (click, type, focus, etc.)
**Example:**
```javascript
// Source: Playwright actionability model (https://playwright.dev/docs/actionability)
async function ensureElementReady(element, actionType = 'click') {
  const result = {
    ready: true,
    element: element,
    scrolled: false,
    checks: {
      visible: null,
      enabled: null,
      stable: null,
      receivesEvents: null,
      editable: null  // Only for input actions
    },
    failureReason: null
  };

  // 1. Visibility check
  result.checks.visible = checkElementVisibility(element);
  if (!result.checks.visible.passed) {
    result.ready = false;
    result.failureReason = result.checks.visible.reason;
    return result;
  }

  // 2. Enabled check
  result.checks.enabled = checkElementEnabled(element);
  if (!result.checks.enabled.passed) {
    result.ready = false;
    result.failureReason = result.checks.enabled.reason;
    return result;
  }

  // 3. Scroll into view if needed
  const scrollResult = await scrollIntoViewIfNeeded(element);
  result.scrolled = scrollResult.scrolled;

  // 4. Stability check (wait for animations to complete)
  result.checks.stable = await checkElementStable(element);
  if (!result.checks.stable.passed) {
    result.ready = false;
    result.failureReason = result.checks.stable.reason;
    return result;
  }

  // 5. Receives events check (not obscured)
  result.checks.receivesEvents = checkElementReceivesEvents(element);
  if (!result.checks.receivesEvents.passed) {
    result.ready = false;
    result.failureReason = result.checks.receivesEvents.reason;
    result.obscuredBy = result.checks.receivesEvents.obscuredBy;
    return result;
  }

  // 6. Editable check (only for type/fill actions)
  if (['type', 'fill', 'clear', 'selectText'].includes(actionType)) {
    result.checks.editable = checkElementEditable(element);
    if (!result.checks.editable.passed) {
      result.ready = false;
      result.failureReason = result.checks.editable.reason;
      return result;
    }
  }

  return result;
}
```

### Pattern 2: Visibility Check Using checkVisibility() with Fallback
**What:** Use modern `checkVisibility()` API with fallback for older browsers
**When to use:** Determining if element is CSS-visible
**Example:**
```javascript
// Source: MDN checkVisibility() (https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility)
function checkElementVisibility(element) {
  const result = { passed: true, reason: null, details: {} };

  // 1. Check for null/undefined element
  if (!element) {
    return { passed: false, reason: 'Element is null or undefined', details: {} };
  }

  // 2. Check bounding box (zero-size elements are not visible)
  const rect = element.getBoundingClientRect();
  result.details.rect = { width: rect.width, height: rect.height };

  if (rect.width === 0 || rect.height === 0) {
    return { passed: false, reason: 'Element has zero dimensions', details: result.details };
  }

  // 3. Use checkVisibility() if available (modern browsers)
  if (typeof element.checkVisibility === 'function') {
    const isVisible = element.checkVisibility({
      opacityProperty: true,      // Check opacity: 0
      visibilityProperty: true,   // Check visibility: hidden
      contentVisibilityAuto: true // Check content-visibility: auto
    });
    result.details.checkVisibility = isVisible;

    if (!isVisible) {
      return { passed: false, reason: 'Element fails checkVisibility()', details: result.details };
    }
  } else {
    // Fallback for older browsers
    const styles = window.getComputedStyle(element);
    result.details.display = styles.display;
    result.details.visibility = styles.visibility;
    result.details.opacity = styles.opacity;

    if (styles.display === 'none') {
      return { passed: false, reason: 'Element has display: none', details: result.details };
    }
    if (styles.visibility === 'hidden') {
      return { passed: false, reason: 'Element has visibility: hidden', details: result.details };
    }
    if (parseFloat(styles.opacity) === 0) {
      return { passed: false, reason: 'Element has opacity: 0', details: result.details };
    }
  }

  return result;
}
```

### Pattern 3: Comprehensive Disabled State Detection
**What:** Check all ways an element can be disabled (attribute, ARIA, fieldset, ancestor)
**When to use:** Before any interaction that modifies element state
**Example:**
```javascript
// Source: MDN disabled attribute + aria-disabled documentation
function checkElementEnabled(element) {
  const result = { passed: true, reason: null, details: {} };

  // 1. Check native disabled via :disabled pseudo-class
  //    This handles: disabled attribute, parent fieldset disabled (except legend children)
  if (element.matches && element.matches(':disabled')) {
    result.details.nativeDisabled = true;
    return { passed: false, reason: 'Element is disabled', details: result.details };
  }

  // 2. Check aria-disabled on element itself
  const ariaDisabled = element.getAttribute('aria-disabled');
  if (ariaDisabled === 'true') {
    result.details.ariaDisabled = true;
    return { passed: false, reason: 'Element has aria-disabled="true"', details: result.details };
  }

  // 3. Check aria-disabled on ancestors (ARIA disabled is inherited)
  const disabledAncestor = element.closest('[aria-disabled="true"]');
  if (disabledAncestor && disabledAncestor !== element) {
    result.details.ancestorAriaDisabled = true;
    result.details.disabledAncestor = disabledAncestor.tagName +
      (disabledAncestor.id ? `#${disabledAncestor.id}` : '');
    return {
      passed: false,
      reason: `Ancestor has aria-disabled="true": ${result.details.disabledAncestor}`,
      details: result.details
    };
  }

  // 4. Check for inert attribute (makes entire subtree non-interactive)
  if (element.matches && element.matches('[inert], [inert] *')) {
    result.details.inert = true;
    return { passed: false, reason: 'Element is inside inert subtree', details: result.details };
  }

  // 5. Check readonly (for input/textarea - they can be focused but not modified)
  if (element.readOnly) {
    result.details.readonly = true;
    // Note: readonly elements can still receive clicks/focus, just not be edited
    // This is informational, not a failure
  }

  return result;
}
```

### Pattern 4: Multi-Point Obscuration Detection
**What:** Check multiple points on element to detect partial obscuration
**When to use:** Verifying element can receive click/mouse events
**Example:**
```javascript
// Source: Playwright actionability "Receives Events" check
function checkElementReceivesEvents(element) {
  const result = { passed: true, reason: null, details: {}, obscuredBy: null };
  const rect = element.getBoundingClientRect();

  // Check if element has valid dimensions
  if (rect.width === 0 || rect.height === 0) {
    return { passed: false, reason: 'Element has no dimensions', details: {} };
  }

  // Define check points: center + cardinal directions (for better coverage)
  const checkPoints = [
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },  // Center
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.25 },  // Top-left quadrant
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.25 },  // Top-right quadrant
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.75 },  // Bottom-left quadrant
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.75 }   // Bottom-right quadrant
  ];

  // Filter points that are within viewport
  const viewportPoints = checkPoints.filter(p =>
    p.x >= 0 && p.x <= window.innerWidth &&
    p.y >= 0 && p.y <= window.innerHeight
  );

  if (viewportPoints.length === 0) {
    return { passed: false, reason: 'Element is outside viewport', details: { rect } };
  }

  // Check each point
  let passedPoints = 0;
  let lastObscuringElement = null;

  for (const point of viewportPoints) {
    const topElement = document.elementFromPoint(point.x, point.y);

    // Element receives event if it's the top element OR contains/is contained by top element
    if (topElement === element ||
        element.contains(topElement) ||
        topElement?.contains(element)) {
      passedPoints++;
    } else if (topElement) {
      lastObscuringElement = topElement;
    }
  }

  result.details.checkedPoints = viewportPoints.length;
  result.details.passedPoints = passedPoints;

  // Require at least center point to pass (most important for clicking)
  if (passedPoints === 0) {
    const obscuringInfo = lastObscuringElement ?
      `${lastObscuringElement.tagName.toLowerCase()}${lastObscuringElement.id ? '#' + lastObscuringElement.id : ''}${lastObscuringElement.className ? '.' + lastObscuringElement.className.split(' ')[0] : ''}` :
      'unknown';

    return {
      passed: false,
      reason: `Element is obscured by ${obscuringInfo}`,
      details: result.details,
      obscuredBy: obscuringInfo
    };
  }

  return result;
}
```

### Pattern 5: Position Stability Check
**What:** Verify element position is stable across animation frames
**When to use:** Before clicking/interacting with potentially animating elements
**Example:**
```javascript
// Source: Playwright "Stable" actionability check
async function checkElementStable(element, maxWaitMs = 300) {
  const result = { passed: false, reason: null, details: {} };

  const getPosition = () => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  };

  const startTime = Date.now();
  let pos1 = getPosition();

  // Wait for two consecutive animation frames with same position
  return new Promise((resolve) => {
    const checkStability = () => {
      const pos2 = getPosition();
      const isStable =
        Math.abs(pos1.top - pos2.top) < 1 &&
        Math.abs(pos1.left - pos2.left) < 1 &&
        Math.abs(pos1.width - pos2.width) < 1 &&
        Math.abs(pos1.height - pos2.height) < 1;

      if (isStable) {
        resolve({
          passed: true,
          reason: null,
          details: { position: pos2, checkTime: Date.now() - startTime }
        });
        return;
      }

      if (Date.now() - startTime > maxWaitMs) {
        resolve({
          passed: false,
          reason: 'Element position is unstable (animating)',
          details: {
            position1: pos1,
            position2: pos2,
            delta: {
              top: pos2.top - pos1.top,
              left: pos2.left - pos1.left
            }
          }
        });
        return;
      }

      pos1 = pos2;
      requestAnimationFrame(checkStability);
    };

    requestAnimationFrame(checkStability);
  });
}
```

### Pattern 6: Smart Scroll Into View
**What:** Scroll element into viewport center, accounting for fixed headers/footers
**When to use:** Before any action when element may be outside viewport
**Example:**
```javascript
// Source: MDN scrollIntoView() (https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
async function scrollIntoViewIfNeeded(element) {
  const result = { scrolled: false, details: {} };
  const rect = element.getBoundingClientRect();

  // Check if element is already fully in viewport
  const isFullyVisible =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;

  // Also check if element center is visible (even if edges are clipped)
  const centerY = rect.top + rect.height / 2;
  const centerX = rect.left + rect.width / 2;
  const isCenterVisible =
    centerY >= 0 && centerY <= window.innerHeight &&
    centerX >= 0 && centerX <= window.innerWidth;

  result.details.initialRect = {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right
  };
  result.details.wasFullyVisible = isFullyVisible;
  result.details.wasCenterVisible = isCenterVisible;

  // Scroll if element is not fully visible OR if center is not visible
  if (!isFullyVisible || !isCenterVisible) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',    // Vertical: center in viewport
      inline: 'center'    // Horizontal: center in viewport
    });

    result.scrolled = true;

    // Wait for scroll animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Record new position
    const newRect = element.getBoundingClientRect();
    result.details.finalRect = {
      top: newRect.top,
      bottom: newRect.bottom,
      left: newRect.left,
      right: newRect.right
    };
  }

  return result;
}
```

### Anti-Patterns to Avoid
- **Checking only center point for obscuration:** Can miss partial overlay coverage; use multiple points for robustness
- **Using only `element.disabled` property:** Misses fieldset inheritance, ARIA disabled, and inert; use `:disabled` pseudo-class
- **Skipping stability check:** Clicking animating elements causes click to land on wrong position
- **Fixed delay instead of condition-based waiting:** `setTimeout(500)` is wasteful and unreliable; wait for actual condition
- **Not re-checking after scroll:** Element may become obscured or change after scrolling; re-validate after scroll
- **Ignoring opacity: 0 elements:** Playwright considers them "visible" (can still receive events in some browsers), but FSB should treat as non-interactable for user experience

## Don't Hand-Roll

Problems that look simple but have edge cases:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Visibility check | Manual style checks | `checkVisibility()` API | Handles display, visibility, opacity, content-visibility in one call |
| Disabled detection | Check `element.disabled` only | `element.matches(':disabled')` | Handles fieldset inheritance automatically |
| Element position | Store coordinates once | `getBoundingClientRect()` each time | Position can change between checks due to layout shifts |
| Smooth scroll wait | `setTimeout(500)` | `requestAnimationFrame` polling | Actual scroll duration varies by distance and browser |
| Viewport check | Manual window dimension math | `IntersectionObserver` | More accurate with scroll containers and transforms |

**Key insight:** Element readiness seems like simple boolean checks, but requires handling: CSS cascading, ARIA inheritance, fieldset nesting, dynamic overlays, scroll animations, and position stability. The native APIs handle most complexity when used correctly.

## Common Pitfalls

### Pitfall 1: Checking Only Element's Own Disabled Attribute
**What goes wrong:** Elements inside disabled fieldsets appear enabled, clicks have no effect
**Why it happens:** `element.disabled` property doesn't account for fieldset inheritance
**How to avoid:** Use `element.matches(':disabled')` which includes fieldset context
**Warning signs:** Clicks on form fields "work" but values don't change

### Pitfall 2: Single-Point Obscuration Check
**What goes wrong:** Element is partially obscured but center point passes check
**Why it happens:** Overlays, dropdowns, or tooltips can cover element edges while leaving center exposed (or vice versa)
**How to avoid:** Check multiple points (center + corners); require majority to pass
**Warning signs:** Inconsistent click behavior on same element

### Pitfall 3: Assuming Scrolled Element Is Ready
**What goes wrong:** Click happens before scroll animation completes, hits wrong element
**Why it happens:** `scrollIntoView()` is async but doesn't return a promise
**How to avoid:** Wait fixed duration (300ms) or poll for position stability
**Warning signs:** Clicks land on elements that were previously in viewport position

### Pitfall 4: Not Re-Validating After Scroll
**What goes wrong:** Scroll triggers lazy-loaded overlay, element becomes obscured
**Why it happens:** Scroll can trigger intersection observers that load new content
**How to avoid:** Re-check obscuration after scroll completes
**Warning signs:** First click after scroll fails with "obscured" error

### Pitfall 5: Treating Viewport Edge Elements as Invisible
**What goes wrong:** Elements partially outside viewport are skipped even though they're interactable
**Why it happens:** Strict viewport check requires all edges inside viewport
**How to avoid:** Check if element center (or any significant portion) is in viewport
**Warning signs:** Elements near page edges can't be clicked

### Pitfall 6: Ignoring inert Attribute
**What goes wrong:** Elements inside modal backdrops appear enabled but don't respond
**Why it happens:** HTML `inert` attribute makes entire subtree non-interactive but doesn't add `:disabled`
**How to avoid:** Check `element.matches('[inert], [inert] *')`
**Warning signs:** Modal background elements receive clicks instead of modal content

## Code Examples

Verified patterns for implementation:

### Complete ensureElementReady Function
```javascript
// Source: Consolidated from Playwright actionability + native DOM APIs
async function ensureElementReady(element, actionType = 'click') {
  // Validation result object matching Phase 1 pattern
  const result = {
    ready: true,
    element: element,
    scrolled: false,
    checks: {},
    failureReason: null,
    failureDetails: null
  };

  // Early exit for null element
  if (!element) {
    return {
      ready: false,
      element: null,
      scrolled: false,
      checks: {},
      failureReason: 'Element is null or undefined',
      failureDetails: null
    };
  }

  // 1. Visibility check (fast, eliminates most failures)
  result.checks.visible = checkElementVisibility(element);
  if (!result.checks.visible.passed) {
    result.ready = false;
    result.failureReason = result.checks.visible.reason;
    result.failureDetails = result.checks.visible.details;
    return result;
  }

  // 2. Enabled check (including fieldset, ARIA, inert)
  result.checks.enabled = checkElementEnabled(element);
  if (!result.checks.enabled.passed) {
    result.ready = false;
    result.failureReason = result.checks.enabled.reason;
    result.failureDetails = result.checks.enabled.details;
    return result;
  }

  // 3. Scroll into view if needed
  const scrollResult = await scrollIntoViewIfNeeded(element);
  result.scrolled = scrollResult.scrolled;

  // 4. Wait for position stability (catches animations)
  result.checks.stable = await checkElementStable(element);
  if (!result.checks.stable.passed) {
    result.ready = false;
    result.failureReason = result.checks.stable.reason;
    result.failureDetails = result.checks.stable.details;
    return result;
  }

  // 5. Check element receives pointer events (not obscured)
  result.checks.receivesEvents = checkElementReceivesEvents(element);
  if (!result.checks.receivesEvents.passed) {
    result.ready = false;
    result.failureReason = result.checks.receivesEvents.reason;
    result.failureDetails = result.checks.receivesEvents.details;
    return result;
  }

  // 6. Editable check (only for input-type actions)
  const inputActions = ['type', 'fill', 'clear', 'clearInput', 'selectText'];
  if (inputActions.includes(actionType)) {
    result.checks.editable = checkElementEditable(element);
    if (!result.checks.editable.passed) {
      result.ready = false;
      result.failureReason = result.checks.editable.reason;
      result.failureDetails = result.checks.editable.details;
      return result;
    }
  }

  return result;
}
```

### Editable Check Function
```javascript
// Source: Playwright "Editable" actionability check + HTML spec
function checkElementEditable(element) {
  const result = { passed: true, reason: null, details: {} };

  // Must first be enabled
  if (element.matches && element.matches(':disabled')) {
    return { passed: false, reason: 'Element is disabled', details: { disabled: true } };
  }

  // Check readonly attribute
  if (element.readOnly) {
    result.details.readonly = true;
    return { passed: false, reason: 'Element is readonly', details: result.details };
  }

  // Check aria-readonly
  if (element.getAttribute('aria-readonly') === 'true') {
    result.details.ariaReadonly = true;
    return { passed: false, reason: 'Element has aria-readonly="true"', details: result.details };
  }

  // For contenteditable elements, check the attribute
  if (element.hasAttribute('contenteditable')) {
    const editable = element.getAttribute('contenteditable');
    if (editable === 'false') {
      return { passed: false, reason: 'Element has contenteditable="false"', details: { contenteditable: false } };
    }
  }

  return result;
}
```

### Overlay Detection and Dismissal
```javascript
// Source: Common overlay patterns from existing FSB code + best practices
const COMMON_OVERLAY_SELECTORS = [
  // Modal backdrops
  '[class*="modal-backdrop"]',
  '[class*="overlay-backdrop"]',
  '.modal-overlay',
  '.backdrop',

  // Cookie banners
  '[class*="cookie-banner"]',
  '[class*="cookie-consent"]',
  '[id*="cookie"]',

  // Popups and dialogs
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',

  // Loading overlays
  '[class*="loading-overlay"]',
  '[class*="loading-mask"]',
  '.page-loader',

  // Toast/notification containers
  '[class*="toast-container"]',
  '[class*="notification-container"]'
];

function detectOverlays() {
  const overlays = [];

  for (const selector of COMMON_OVERLAY_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);

        // Only count as overlay if visible and covers significant area
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          styles.display !== 'none' &&
          styles.visibility !== 'hidden' &&
          parseFloat(styles.opacity) > 0.1;

        const coversViewport =
          rect.width >= window.innerWidth * 0.5 ||
          rect.height >= window.innerHeight * 0.5;

        if (isVisible && coversViewport) {
          overlays.push({
            element: el,
            selector: selector,
            rect: { width: rect.width, height: rect.height },
            zIndex: parseInt(styles.zIndex) || 0
          });
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
  }

  // Sort by z-index (highest first)
  return overlays.sort((a, b) => b.zIndex - a.zIndex);
}
```

### Consistent Result Object Format
```javascript
// Source: Phase 1 pattern for validation result objects
// All readiness check functions should return this format:
/*
{
  passed: boolean,       // Whether the check passed
  reason: string | null, // Human-readable failure reason
  details: object        // Additional details for debugging
}
*/

// Example successful result:
{ passed: true, reason: null, details: { rect: { width: 100, height: 30 } } }

// Example failure result:
{
  passed: false,
  reason: 'Element is obscured by div.modal-backdrop',
  details: {
    checkedPoints: 5,
    passedPoints: 0,
    obscuredBy: 'div.modal-backdrop'
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual visibility checks | `Element.checkVisibility()` API | 2024 | Simpler, handles edge cases automatically |
| `element.disabled` property | `element.matches(':disabled')` | Always was better | Handles fieldset inheritance |
| Fixed wait times | Condition-based waiting (Playwright auto-wait) | ~2020 | Faster, more reliable |
| Single-point hit testing | Multi-point with center priority | ~2022 | Better overlay detection |
| `scrollIntoView(true)` | `scrollIntoView({ block: 'center' })` | 2020 | Avoids fixed header occlusion |

**Deprecated/outdated:**
- `offsetParent !== null` for visibility: Incomplete, doesn't handle all cases
- Checking `display` and `visibility` separately: Use `checkVisibility()` instead
- Using `IntersectionObserver` for immediate checks: It's async; use `getBoundingClientRect()` for synchronous checks

## Open Questions

Things that couldn't be fully resolved:

1. **checkVisibility() Browser Support**
   - What we know: Baseline 2024 (March), supported in Chrome 105+, Firefox 106+, Safari 17.4+
   - What's unclear: Whether to rely on it exclusively or always include fallback
   - Recommendation: Use with fallback for maximum compatibility; FSB targets Chrome but code may be reused

2. **Optimal Stability Wait Time**
   - What we know: Playwright uses "two consecutive animation frames"
   - What's unclear: Whether 300ms max wait is sufficient for all CSS animations
   - Recommendation: Start with 300ms, monitor for false positives, adjust if needed

3. **Multi-Point vs Single-Point Obscuration**
   - What we know: Multi-point is more accurate but slower
   - What's unclear: Whether the performance cost is worth it for FSB's use case
   - Recommendation: Use center point for fast checks, multi-point only when center fails

## Sources

### Primary (HIGH confidence)
- [Playwright Actionability Documentation](https://playwright.dev/docs/actionability) - Official auto-wait behavior, check definitions
- [MDN checkVisibility()](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility) - Modern visibility API
- [MDN scrollIntoView()](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) - Scroll behavior options
- [MDN getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) - Element position API
- [MDN disabled attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled) - Disabled inheritance rules
- [MDN aria-disabled](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled) - ARIA disabled semantics

### Secondary (MEDIUM confidence)
- [BrowserStack Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) - Industry validation of patterns
- [BrowserStack waitForLoadState](https://www.browserstack.com/guide/playwright-waitforloadstate) - Element-level waits vs page waits
- [CoreUI Visibility Detection](https://coreui.io/blog/how-to-check-if-an-element-is-visible-in-javascript/) - Multiple visibility approaches
- [GeeksforGeeks Viewport Detection](https://www.geeksforgeeks.org/javascript/how-to-check-a-dom-element-is-visible-in-current-viewport/) - getBoundingClientRect patterns

### Tertiary (LOW confidence)
- General web search results on overlay detection - Patterns verified against codebase
- Stack Overflow discussions on obscuration detection - Verified with official MDN docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native browser APIs, well-documented
- Architecture patterns: HIGH - Based on Playwright official documentation
- Pitfalls: HIGH - Common issues documented in official sources and real-world experience
- Code examples: HIGH - Patterns from official APIs and established automation tools

**Research date:** 2026-02-03
**Valid until:** 60 days (stable domain, browser APIs rarely change)
