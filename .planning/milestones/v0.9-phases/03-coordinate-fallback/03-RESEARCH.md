# Phase 3: Coordinate Fallback - Research

**Researched:** 2026-02-03
**Domain:** Coordinate-Based Element Clicking as Selector Fallback
**Confidence:** HIGH

## Summary

This research investigates how to implement coordinate-based clicking as a last-resort fallback when all CSS/XPath selectors fail to find an element. The FSB codebase already stores element position data (x, y, width, height) during DOM analysis and has an existing `moveMouse` tool that uses `document.elementFromPoint()`. The technical foundation exists; this phase focuses on integrating coordinate fallback into the selector failure path.

The core challenge is coordinate system consistency: `getBoundingClientRect()` returns viewport coordinates (relative to visible window), and `elementFromPoint()` also expects viewport coordinates. However, the stored position data may become stale if the page scrolls between DOM capture and click attempt. The solution is to: (1) detect when coordinates are stale due to scroll, (2) scroll to make the target area visible if needed, (3) use `elementFromPoint()` to verify something clickable exists at coordinates, and (4) dispatch proper mouse events at the center point.

The existing codebase pattern in the `click` tool already calculates center coordinates (`centerX`, `centerY`) and dispatches `mousedown`, `mouseup`, and `click` events. The coordinate fallback should reuse this proven pattern, just without relying on a selector to find the element first.

**Primary recommendation:** Add `clickAtCoordinates(x, y, width, height)` tool that scrolls coordinates into view, verifies via `elementFromPoint()`, dispatches mouse events at center, and logs that selector fallback was used.

## Standard Stack

This phase uses only native browser APIs already available in content scripts.

### Core
| API | Purpose | Why Standard |
|-----|---------|--------------|
| `document.elementFromPoint(x, y)` | Find element at viewport coordinates | Native, fast, widely supported |
| `Element.getBoundingClientRect()` | Get current element position | Native viewport coordinates |
| `window.scrollX/scrollY` | Detect scroll offset changes | Track coordinate staleness |
| `Element.scrollIntoView()` | Bring target area into viewport | Native smooth scrolling |
| `MouseEvent` constructor | Create click events with coordinates | Standard DOM events |
| `EventTarget.dispatchEvent()` | Fire mouse events on elements | Native event dispatch |

### Supporting
| API | Purpose | When to Use |
|-----|---------|-------------|
| `window.innerHeight/innerWidth` | Viewport dimensions | Validate coordinates in view |
| `document.elementFromPoint()` | Verify clickable element exists | Pre-click validation |
| `window.scrollTo()` | Precise scroll positioning | When scrollIntoView insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| elementFromPoint validation | Blind coordinate click | Less reliable - might click wrong element |
| Mouse events | element.click() | Less realistic - some sites need event sequence |
| Center point calculation | Top-left click | Center is more reliable for variable-size elements |

**No Installation Required** - All functionality uses native browser APIs.

## Architecture Patterns

### Recommended Integration Point

The coordinate fallback integrates into the existing click flow at the "element not found" branch:

```
Current click flow:
1. querySelectorWithShadow(selector)
2. If found -> wait for actionable -> click
3. If not found -> findAlternativeSelectors() -> return error

New flow with coordinate fallback:
1. querySelectorWithShadow(selector)
2. If found -> wait for actionable -> click
3. If not found -> findAlternativeSelectors()
4. If alternatives exist -> try alternatives
5. If all selectors fail AND coordinates provided -> clickAtCoordinates()
6. Log fallback usage
```

### Pattern 1: Coordinate Validation Before Click
**What:** Always verify `elementFromPoint()` returns a valid element before dispatching events
**When to use:** Every coordinate-based click attempt
**Example:**
```javascript
// Source: MDN elementFromPoint + existing FSB moveMouse pattern
function validateCoordinates(x, y) {
  // Check coordinates are within viewport
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return { valid: false, reason: 'coordinates_outside_viewport' };
  }

  const element = document.elementFromPoint(x, y);
  if (!element) {
    return { valid: false, reason: 'no_element_at_coordinates' };
  }

  // Check element is interactable (not hidden, not disabled)
  const style = window.getComputedStyle(element);
  if (style.pointerEvents === 'none' || style.visibility === 'hidden') {
    return { valid: false, reason: 'element_not_interactable', element };
  }

  return { valid: true, element };
}
```

### Pattern 2: Scroll-Then-Click for Stale Coordinates
**What:** If stored coordinates are outside viewport, scroll to make them visible first
**When to use:** When stored coordinates fall outside current viewport
**Example:**
```javascript
// Source: Native scrollTo + coordinate transformation
async function ensureCoordinatesVisible(docX, docY, width, height) {
  // Convert stored document coordinates to current viewport coordinates
  const viewportX = docX - window.scrollX;
  const viewportY = docY - window.scrollY;

  // Check if already visible (with padding for element size)
  const padding = 50; // Extra space around element
  const isVisible = viewportX >= padding &&
                    viewportY >= padding &&
                    viewportX + width <= window.innerWidth - padding &&
                    viewportY + height <= window.innerHeight - padding;

  if (!isVisible) {
    // Scroll to center the target area
    window.scrollTo({
      left: docX - window.innerWidth / 2 + width / 2,
      top: docY - window.innerHeight / 2 + height / 2,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Return current viewport coordinates
  return {
    x: docX - window.scrollX,
    y: docY - window.scrollY,
    scrolled: !isVisible
  };
}
```

### Pattern 3: Full Mouse Event Sequence
**What:** Dispatch mousedown, mouseup, and click events with proper coordinates
**When to use:** Every coordinate-based click (already proven in existing click tool)
**Example:**
```javascript
// Source: Existing FSB click tool pattern (content.js lines 1912-1936)
function dispatchClickAtCoordinates(element, x, y) {
  const mouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x + window.screenX,
    screenY: y + window.screenY,
    button: 0,
    buttons: 1
  };

  // Full mouse event sequence for JS handler compatibility
  element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  element.dispatchEvent(new MouseEvent('click', mouseEventInit));

  // Also try native click as fallback
  if (typeof element.click === 'function') {
    element.click();
  }
}
```

### Anti-Patterns to Avoid
- **Clicking without elementFromPoint validation:** Coordinates might hit a different element than intended (overlay, popup, moved element)
- **Using stored coordinates without scroll check:** Coordinates are viewport-relative at capture time; if page scrolled, they're stale
- **Single click event only:** Some sites require full mousedown/mouseup/click sequence
- **Ignoring pointer-events:none:** Elements can be visually present but not clickable
- **No logging of fallback usage:** Users need to know when selector-based approach failed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element at point detection | Manual bounds checking | `document.elementFromPoint()` | Handles z-index, overlays, pointer-events correctly |
| Coordinate system conversion | Custom math | `getBoundingClientRect()` + scroll offsets | Browser handles transform, zoom, etc. |
| Mouse event creation | Custom event objects | `new MouseEvent()` constructor | Proper event initialization with all properties |
| Smooth scrolling | Manual scroll animation | `scrollIntoView({behavior: 'smooth'})` or `scrollTo` | Browser-native smooth scrolling |
| Viewport bounds checking | Manual width/height comparison | `elementFromPoint()` returns null if outside | Already handles edge cases |

**Key insight:** The coordinate click problem is simpler than selector generation because `elementFromPoint()` and `MouseEvent` handle most complexity. The main work is proper integration into the existing click failure path.

## Common Pitfalls

### Pitfall 1: Coordinate System Confusion
**What goes wrong:** Using document coordinates with `elementFromPoint()` which expects viewport coordinates
**Why it happens:** `getBoundingClientRect()` returns viewport coords, but they're stored without scroll context
**How to avoid:** Always convert stored coords: `viewportX = storedX - currentScrollX`
**Warning signs:** Clicks landing in wrong position, especially after scrolling

### Pitfall 2: Stale Coordinates After Page Changes
**What goes wrong:** Stored coordinates point to where element WAS, not where it IS now
**Why it happens:** Dynamic content, animations, responsive layout changes
**How to avoid:** Use coordinates as "last known position" hint, not absolute truth; validate with elementFromPoint
**Warning signs:** Clicking empty space or wrong elements after DOM mutations

### Pitfall 3: Clicking Through Overlays
**What goes wrong:** Click goes to overlay/modal instead of intended element beneath
**Why it happens:** `elementFromPoint()` returns topmost element at z-index
**How to avoid:** Log what element was actually found; if it's an overlay, report as blocked
**Warning signs:** Click succeeds but wrong action occurs; modal/popup interactions unexpected

### Pitfall 4: Elements with pointer-events:none
**What goes wrong:** `elementFromPoint()` returns the element beneath, not the visible one
**Why it happens:** Browser spec: pointer-events:none elements are skipped
**How to avoid:** This is actually correct behavior - you click what receives events
**Warning signs:** None - this is working as intended

### Pitfall 5: Cross-Origin Iframe Coordinates
**What goes wrong:** Coordinates inside cross-origin iframe return the iframe itself
**Why it happens:** Security restriction - can't access cross-origin content
**How to avoid:** Detect when `elementFromPoint()` returns an iframe; report as limitation
**Warning signs:** All clicks inside iframe hit the iframe container

### Pitfall 6: Center Point Calculation Errors
**What goes wrong:** Click lands at edge of element instead of center
**Why it happens:** Incorrect formula: using `x + width` instead of `x + width/2`
**How to avoid:** Formula: `centerX = x + width/2`, `centerY = y + height/2`
**Warning signs:** Clicks on element borders, inconsistent behavior on small elements

## Code Examples

Verified patterns from official sources and existing FSB code:

### Complete clickAtCoordinates Tool
```javascript
// Source: Combination of MDN elementFromPoint, existing FSB click pattern
async function clickAtCoordinates(params) {
  const { x, y, width, height, originalSelector, reason } = params;

  // Log that we're using coordinate fallback
  automationLogger.warn('Using coordinate fallback', {
    sessionId: currentSessionId,
    reason: reason || 'all_selectors_failed',
    originalSelector,
    targetCoordinates: { x, y, width, height }
  });

  // Calculate center point
  const centerX = x + (width || 0) / 2;
  const centerY = y + (height || 0) / 2;

  // Ensure coordinates are visible (scroll if needed)
  const scrollResult = await ensureCoordinatesVisible(x, y, width || 0, height || 0);

  // Convert to current viewport coordinates
  const viewportX = centerX - window.scrollX;
  const viewportY = centerY - window.scrollY;

  // Validate there's a clickable element at these coordinates
  const validation = validateCoordinates(viewportX, viewportY);
  if (!validation.valid) {
    return {
      success: false,
      error: `Coordinate fallback failed: ${validation.reason}`,
      coordinates: { x: viewportX, y: viewportY },
      fallbackUsed: true
    };
  }

  const element = validation.element;

  // Dispatch mouse events at the center point
  dispatchClickAtCoordinates(element, viewportX, viewportY);

  // Wait for potential effects
  await new Promise(resolve => setTimeout(resolve, 300));

  return {
    success: true,
    fallbackUsed: true,
    clickedElement: {
      tag: element.tagName,
      id: element.id,
      class: element.className?.substring?.(0, 50)
    },
    coordinates: { x: viewportX, y: viewportY },
    scrolled: scrollResult.scrolled,
    message: 'Clicked using coordinate fallback (selector-based approach failed)'
  };
}
```

### Integration into Existing Click Tool
```javascript
// Source: Existing FSB click tool (modified)
click: async (params) => {
  // ... existing overlay dismissal code ...

  // Try selector-based approach first
  const waitResult = await waitForActionable(params.selector, {
    timeout: 3000,
    waitFor: ['visible', 'enabled', 'stable']
  });

  if (waitResult.success) {
    // ... existing click implementation ...
  }

  // Selector failed - try alternatives
  const alternatives = findAlternativeSelectors(params.selector, 'click');
  for (const altSelector of alternatives.slice(0, 3)) {
    const altElement = querySelectorWithShadow(altSelector);
    if (altElement) {
      // ... click the alternative ...
      return { success: true, usedAlternative: altSelector };
    }
  }

  // All selectors failed - try coordinate fallback if coordinates provided
  if (params.coordinates) {
    const { x, y, width, height } = params.coordinates;
    return await clickAtCoordinates({
      x, y, width, height,
      originalSelector: params.selector,
      reason: 'all_selectors_failed'
    });
  }

  // No coordinates available
  return {
    success: false,
    error: 'Element not found and no coordinates available for fallback',
    selector: params.selector,
    alternatives: alternatives.slice(0, 3)
  };
}
```

### Coordinate Storage in DOM Analysis
```javascript
// Source: Existing FSB getStructuredDOM (content.js ~line 5884)
// Position data is already captured correctly:
position: {
  x: Math.round(rect.left),      // Viewport X at capture time
  y: Math.round(rect.top),       // Viewport Y at capture time
  width: Math.round(rect.width),
  height: Math.round(rect.height),
  inViewport: isElementInViewport(rect)
}

// To support coordinate fallback, AI needs to include coordinates in click params:
// Example AI response:
{
  "tool": "click",
  "params": {
    "selector": "[data-testid='submit-button']",
    "coordinates": { "x": 450, "y": 320, "width": 120, "height": 40 }
  }
}
```

### Logging Coordinate Fallback Usage
```javascript
// Source: Existing FSB automation-logger pattern
function logCoordinateFallback(sessionId, params, result) {
  automationLogger.log(
    result.success ? 'info' : 'warn',
    'Coordinate fallback ' + (result.success ? 'succeeded' : 'failed'),
    {
      sessionId,
      originalSelector: params.originalSelector,
      coordinates: params.coordinates,
      clickedElement: result.clickedElement,
      reason: params.reason,
      scrolled: result.scrolled,
      timestamp: new Date().toISOString()
    }
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Selector-only clicking | Selector + coordinate fallback | ~2023 (Playwright vision mode) | Higher success rate on dynamic sites |
| Fixed coordinate clicks | Center-point calculation | Established | More reliable for variable-size elements |
| Single click event | mousedown/mouseup/click sequence | ~2020 | Better JS handler compatibility |
| Synchronous click | Async with scroll wait | Established | Works with smooth scrolling |

**Current best practices:**
- Coordinate clicking is a fallback, not primary approach (selectors preferred for resilience)
- Always validate with `elementFromPoint()` before clicking
- Log when fallback is used so users understand automation behavior
- Center-point clicking is standard (not top-left)

**Note on Playwright MCP Vision Mode:**
The Playwright MCP (Model Context Protocol) documentation mentions "Vision Mode" as a fallback for visual tasks requiring coordinate-based interactions. This validates the approach of using coordinates as a last resort when DOM-based methods fail.

## Open Questions

Things that could not be fully resolved:

1. **Scroll offset tracking during DOM capture**
   - What we know: Position data uses `getBoundingClientRect()` which returns viewport coordinates
   - What's unclear: Should we store scroll offset at capture time for accurate reconstruction?
   - Recommendation: Store `captureScrollX` and `captureScrollY` alongside position data for accurate conversion

2. **Coordinate fallback for elements in iframes**
   - What we know: `elementFromPoint()` returns the iframe element for cross-origin content
   - What's unclear: Can we meaningfully click inside iframes using coordinates?
   - Recommendation: Report as limitation; coordinate fallback works only for same-origin content

3. **Threshold for "coordinates are stale"**
   - What we know: If page scrolled since DOM capture, stored viewport coords are wrong
   - What's unclear: How long before coordinates should be considered stale?
   - Recommendation: Always convert from document coords (stored + scroll offset at capture) to current viewport coords

## Sources

### Primary (HIGH confidence)
- [MDN Document.elementFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint) - Official API documentation
- [MDN MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent) - Mouse event constructor
- Existing FSB content.js click implementation (lines 1912-1936) - Proven mouse event pattern
- Existing FSB content.js moveMouse tool (lines 2729-2741) - elementFromPoint usage pattern

### Secondary (MEDIUM confidence)
- [JavaScript.info Coordinates](https://javascript.info/coordinates) - Coordinate system explanation
- [How to Simulate a Click by Using x, y Coordinates](https://javascript.plainenglish.io/how-to-simulate-a-click-by-using-x-y-coordinates-in-javascript-82b745e4a6b1) - Click simulation pattern

### Tertiary (LOW confidence)
- Playwright MCP Vision Mode concept - Validates coordinate fallback approach for automation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only native browser APIs, well-documented
- Architecture patterns: HIGH - Based on existing FSB code patterns and MDN documentation
- Pitfalls: HIGH - Coordinate systems well-understood, verified against official docs
- Code examples: HIGH - Adapted from existing working FSB code

**Research date:** 2026-02-03
**Valid until:** 90 days (stable domain - DOM APIs and coordinate systems rarely change)
