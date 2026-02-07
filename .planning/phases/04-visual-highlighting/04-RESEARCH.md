# Phase 4: Visual Highlighting - Research

**Researched:** 2026-02-03
**Domain:** CSS visual effects, Shadow DOM isolation, Chrome Extension content scripts
**Confidence:** HIGH

## Summary

Visual highlighting for browser automation requires two primary components: (1) element highlighting with an orange glow effect before actions, and (2) a floating progress overlay showing task status. The key challenge is CSS isolation - ensuring the extension's visual elements don't conflict with arbitrary host page styles while remaining visible above all page content.

The standard approach uses **Shadow DOM for the overlay component** to achieve complete style isolation, while **direct inline style injection** works best for element highlights (since highlights must appear on the target element itself). CSS `box-shadow` with rgba values creates the glow effect, and `transform`/`opacity` properties should be used for any animations to ensure GPU acceleration and smooth performance.

The existing `highlightElement` implementation in content.js uses a basic red outline - this needs enhancement to use orange glow with proper timing, cleanup, and isolation from host page styles.

**Primary recommendation:** Use Shadow DOM for the progress overlay, direct inline styles with `!important` for element highlights, and `will-change`/`transform` for GPU-accelerated animations.

## Standard Stack

### Core (No External Libraries Needed)
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Shadow DOM | Native Web API | Overlay style isolation | Built into browsers, no dependencies, perfect encapsulation |
| CSS box-shadow | Native CSS | Orange glow effect | No JS libraries needed, hardware-acceleratable |
| CSS Transforms | Native CSS | Smooth animations | GPU-accelerated, 60fps capable |
| requestAnimationFrame | Native JS | Animation timing | Browser-optimized frame scheduling |

### Supporting
| Technology | Purpose | When to Use |
|------------|---------|-------------|
| CSS `will-change` | GPU layer promotion | Before animations start |
| CSS `all: initial` | Reset inherited styles | Inside Shadow DOM container |
| `position: fixed` | Overlay positioning | For progress indicator |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shadow DOM | iframe | iframes work but have messaging overhead and CSP issues |
| Inline styles | CSS class injection | Classes can be overridden by host page |
| box-shadow | filter: drop-shadow() | drop-shadow follows element shape but less control |

**Installation:**
```bash
# No npm packages needed - all native browser APIs
```

## Architecture Patterns

### Recommended Module Structure
```
content.js additions:
├── HighlightManager         # Manages element highlighting lifecycle
│   ├── showHighlight()      # Add orange glow to element
│   ├── hideHighlight()      # Remove highlight cleanly
│   └── cleanup()            # Remove all highlights
├── ProgressOverlay          # Shadow DOM isolated progress UI
│   ├── create()             # Create overlay in Shadow DOM
│   ├── update()             # Update step/progress display
│   └── destroy()            # Clean removal
└── VisualFeedbackSystem     # Coordinates both components
    ├── beforeAction()       # Show highlight + update progress
    └── afterAction()        # Hide highlight + update progress
```

### Pattern 1: Shadow DOM Overlay Container
**What:** Create isolated container for progress overlay using Shadow DOM
**When to use:** For any UI elements that must not be affected by host page CSS
**Example:**
```javascript
// Source: MDN Shadow DOM / Chrome Extension best practices
function createIsolatedOverlay() {
  // Host element - minimal footprint on page
  const host = document.createElement('div');
  host.id = 'fsb-overlay-host';
  host.style.cssText = 'all: initial !important; position: fixed !important; z-index: 2147483647 !important; top: 0 !important; left: 0 !important; pointer-events: none !important;';

  // Attach shadow root for style isolation
  const shadow = host.attachShadow({ mode: 'open' });

  // All styles defined INSIDE shadow are isolated
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial !important;
    }
    .fsb-progress {
      position: fixed;
      top: 16px;
      right: 16px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      z-index: 1;
    }
  `;

  shadow.appendChild(style);
  document.body.appendChild(host);

  return shadow;
}
```

### Pattern 2: Inline Style Element Highlighting
**What:** Apply orange glow directly to target element using inline styles
**When to use:** When highlighting elements on the host page that must be visible
**Example:**
```javascript
// Source: Selenium/Playwright highlighting patterns
function highlightElement(element, duration = 500) {
  if (!element) return Promise.resolve();

  // Store original styles for clean restoration
  const originalOutline = element.style.outline;
  const originalBoxShadow = element.style.boxShadow;
  const originalTransition = element.style.transition;
  const originalZIndex = element.style.zIndex;
  const originalPosition = element.style.position;

  // Apply orange glow - use !important to override host styles
  const glowColor = 'rgba(255, 140, 0, 0.8)'; // Dark orange
  element.style.cssText += `
    outline: 3px solid #FF8C00 !important;
    box-shadow: 0 0 10px ${glowColor}, 0 0 20px ${glowColor}, 0 0 30px rgba(255, 140, 0, 0.4) !important;
    transition: box-shadow 0.15s ease-out !important;
    position: relative !important;
    z-index: 2147483646 !important;
  `;

  return new Promise(resolve => {
    setTimeout(() => {
      // Restore original styles
      element.style.outline = originalOutline;
      element.style.boxShadow = originalBoxShadow;
      element.style.transition = originalTransition;
      element.style.zIndex = originalZIndex;
      element.style.position = originalPosition;
      resolve();
    }, duration);
  });
}
```

### Pattern 3: GPU-Accelerated Animation
**What:** Use transform/opacity for smooth animations
**When to use:** For any visual transitions (pulse, fade)
**Example:**
```javascript
// Source: Chrome DevDocs hardware-accelerated animations
// Hint browser about upcoming animation
element.style.willChange = 'transform, opacity';

// Animate only composite properties
const animation = element.animate([
  { opacity: 0.7, transform: 'scale(1)' },
  { opacity: 1, transform: 'scale(1.02)' },
  { opacity: 0.7, transform: 'scale(1)' }
], {
  duration: 800,
  iterations: Infinity,
  easing: 'ease-in-out'
});

// Cleanup
animation.cancel();
element.style.willChange = 'auto';
```

### Anti-Patterns to Avoid
- **Modifying `width`, `height`, `top`, `left`, `margin`, `padding`:** These trigger layout recalculation and are slow. Use `transform: translate()` instead.
- **Using CSS classes for highlights:** Host page can override with higher specificity. Use inline styles with `!important`.
- **Forgetting to restore original styles:** Creates visual artifacts. Always save and restore.
- **Using arbitrary z-index values like 999:** May be below host page elements. Use 2147483647 (max 32-bit signed int).
- **Creating new elements for each highlight:** Memory leaks. Reuse a single highlight container.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Style isolation | CSS namespacing/prefixing | Shadow DOM | Prefixing doesn't protect against global resets or !important rules |
| Smooth animations | setTimeout chains | requestAnimationFrame or Web Animations API | RAF syncs with display refresh for 60fps |
| Orange color | Arbitrary hex values | Use established UI orange: #FF8C00 (dark orange) | Consistent, proven visibility |
| Cleanup timing | Manual setTimeout | Promise-based with cleanup callback | Ensures cleanup even on errors |

**Key insight:** Browser-native APIs (Shadow DOM, Web Animations, requestAnimationFrame) solve these problems better than custom JavaScript solutions. They're optimized, tested across millions of pages, and handle edge cases.

## Common Pitfalls

### Pitfall 1: Host Page CSS Overriding Highlights
**What goes wrong:** Element highlight appears incorrect or invisible because host page has `outline: none !important` or aggressive CSS resets
**Why it happens:** Inline styles have lower specificity than `!important` in stylesheets
**How to avoid:**
1. Use `!important` on all highlight properties
2. Apply multiple redundant visual indicators (outline + box-shadow + border)
3. Create an overlay element that sits above the target rather than styling the target directly
**Warning signs:** Highlight looks different on different sites, or doesn't appear at all

### Pitfall 2: Z-Index Stacking Context Traps
**What goes wrong:** Overlay appears behind page elements even with high z-index
**Why it happens:** Parent element creates new stacking context with lower z-index
**How to avoid:**
1. Append overlay container directly to `document.body`
2. Use `position: fixed` to escape relative positioning contexts
3. Use maximum z-index: 2147483647
**Warning signs:** Overlay visible on some pages but hidden on others

### Pitfall 3: Style Restoration Leaving Artifacts
**What goes wrong:** After highlight removal, element looks different than before (broken layout, weird borders)
**Why it happens:** Incomplete restoration of original styles, or element didn't have inline styles before (empty string vs. 'none')
**How to avoid:**
1. Store ALL style properties that will be modified before changing
2. Check if property was previously unset (empty string) vs. explicitly set
3. Use `element.style.removeProperty()` for complete removal
4. Test on elements with no inline styles AND elements with existing inline styles
**Warning signs:** Elements appear broken after automation completes

### Pitfall 4: Memory Leaks from Uncleaned Elements
**What goes wrong:** After many actions, page becomes slow, memory usage increases
**Why it happens:** Creating new DOM elements for each highlight without removing old ones
**How to avoid:**
1. Maintain a single highlight container, reposition rather than recreate
2. Use WeakMap to track highlighted elements
3. Implement cleanup on page unload and navigation
4. Set maximum highlight history with automatic cleanup
**Warning signs:** Performance degrades over automation session duration

### Pitfall 5: Animation Jank
**What goes wrong:** Glow animation stutters, appears choppy
**Why it happens:** Animating properties that trigger layout (width, height, position) instead of composite properties
**How to avoid:**
1. Only animate `transform`, `opacity`, `filter`
2. Use `will-change` sparingly and clean up after animation
3. Use Web Animations API instead of CSS transitions for programmatic control
**Warning signs:** Animation runs at less than 60fps, CPU spikes during animation

## Code Examples

### Complete Highlight Manager Implementation
```javascript
// Source: Synthesized from Playwright/Selenium patterns + MDN best practices
class HighlightManager {
  constructor() {
    this.activeHighlight = null;
    this.originalStyles = new WeakMap();
  }

  async show(element, options = {}) {
    const {
      duration = 500,
      color = '#FF8C00',
      glowColor = 'rgba(255, 140, 0, 0.8)',
      pulse = false
    } = options;

    // Clean up any existing highlight
    this.hide();

    if (!element || !element.style) return;

    // Store original styles
    this.originalStyles.set(element, {
      outline: element.style.outline,
      boxShadow: element.style.boxShadow,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position
    });

    this.activeHighlight = element;

    // Apply highlight with !important to override host styles
    element.style.setProperty('outline', `3px solid ${color}`, 'important');
    element.style.setProperty('box-shadow', `0 0 10px ${glowColor}, 0 0 20px ${glowColor}, 0 0 30px rgba(255, 140, 0, 0.4)`, 'important');
    element.style.setProperty('transition', 'box-shadow 0.15s ease-out', 'important');
    element.style.setProperty('z-index', '2147483646', 'important');

    // Ensure visibility
    const computedPosition = window.getComputedStyle(element).position;
    if (computedPosition === 'static') {
      element.style.setProperty('position', 'relative', 'important');
    }

    // Optional pulse animation
    if (pulse) {
      this._startPulse(element, glowColor);
    }

    // Return promise that resolves after duration
    return new Promise(resolve => {
      setTimeout(() => {
        this.hide();
        resolve();
      }, duration);
    });
  }

  hide() {
    if (!this.activeHighlight) return;

    const element = this.activeHighlight;
    const original = this.originalStyles.get(element);

    if (original) {
      // Restore each property individually
      this._restoreProperty(element, 'outline', original.outline);
      this._restoreProperty(element, 'boxShadow', original.boxShadow);
      this._restoreProperty(element, 'transition', original.transition);
      this._restoreProperty(element, 'zIndex', original.zIndex);
      this._restoreProperty(element, 'position', original.position);

      this.originalStyles.delete(element);
    }

    this.activeHighlight = null;
  }

  _restoreProperty(element, property, value) {
    if (value === '' || value === undefined) {
      element.style.removeProperty(property.replace(/([A-Z])/g, '-$1').toLowerCase());
    } else {
      element.style[property] = value;
    }
  }

  _startPulse(element, glowColor) {
    // Use Web Animations API for smooth pulse
    const animation = element.animate([
      { boxShadow: `0 0 10px ${glowColor}, 0 0 20px ${glowColor}` },
      { boxShadow: `0 0 20px ${glowColor}, 0 0 35px ${glowColor}` },
      { boxShadow: `0 0 10px ${glowColor}, 0 0 20px ${glowColor}` }
    ], {
      duration: 800,
      iterations: Infinity,
      easing: 'ease-in-out'
    });

    // Store for cleanup
    element._fsbPulseAnimation = animation;
  }

  cleanup() {
    this.hide();
    // Cancel any running animations
    if (this.activeHighlight?._fsbPulseAnimation) {
      this.activeHighlight._fsbPulseAnimation.cancel();
    }
  }
}
```

### Complete Progress Overlay Implementation
```javascript
// Source: Shadow DOM MDN docs + Chrome Extension best practices
class ProgressOverlay {
  constructor() {
    this.host = null;
    this.shadow = null;
    this.container = null;
  }

  create() {
    if (this.host) return; // Already created

    // Create host element
    this.host = document.createElement('div');
    this.host.id = 'fsb-progress-host';
    // Reset all inherited styles and position at top of stack
    this.host.style.cssText = `
      all: initial !important;
      position: fixed !important;
      z-index: 2147483647 !important;
      top: 0 !important;
      right: 0 !important;
      pointer-events: none !important;
    `;

    // Create shadow root for isolation
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject styles (these are completely isolated from host page)
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial !important;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .fsb-overlay {
        position: fixed;
        top: 16px;
        right: 16px;
        min-width: 200px;
        max-width: 300px;
        background: rgba(20, 20, 25, 0.95);
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 140, 0, 0.3);
        pointer-events: auto;
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.2s ease-out, opacity 0.2s ease-out;
      }

      .fsb-overlay.hidden {
        transform: translateY(-20px);
        opacity: 0;
        pointer-events: none;
      }

      .fsb-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .fsb-logo {
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #FF8C00, #FF6600);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 10px;
      }

      .fsb-title {
        font-weight: 600;
        color: #ffffff;
        font-size: 13px;
      }

      .fsb-task {
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        margin-bottom: 8px;
        word-break: break-word;
      }

      .fsb-step {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }

      .fsb-step-number {
        background: rgba(255, 140, 0, 0.2);
        color: #FF8C00;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .fsb-step-text {
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        flex: 1;
      }

      .fsb-progress-bar {
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .fsb-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #FF8C00, #FF6600);
        border-radius: 2px;
        transition: width 0.3s ease-out;
      }
    `;

    this.shadow.appendChild(style);

    // Create overlay container
    this.container = document.createElement('div');
    this.container.className = 'fsb-overlay';
    this.container.innerHTML = `
      <div class="fsb-header">
        <div class="fsb-logo">F</div>
        <span class="fsb-title">FSB Automating</span>
      </div>
      <div class="fsb-task">-</div>
      <div class="fsb-step">
        <span class="fsb-step-number">Step 0</span>
        <span class="fsb-step-text">Initializing...</span>
      </div>
      <div class="fsb-progress-bar">
        <div class="fsb-progress-fill" style="width: 0%"></div>
      </div>
    `;

    this.shadow.appendChild(this.container);
    document.body.appendChild(this.host);
  }

  update({ taskName, stepNumber, stepText, progress }) {
    if (!this.container) return;

    if (taskName !== undefined) {
      this.container.querySelector('.fsb-task').textContent = taskName;
    }
    if (stepNumber !== undefined) {
      this.container.querySelector('.fsb-step-number').textContent = `Step ${stepNumber}`;
    }
    if (stepText !== undefined) {
      this.container.querySelector('.fsb-step-text').textContent = stepText;
    }
    if (progress !== undefined) {
      this.container.querySelector('.fsb-progress-fill').style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  }

  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  destroy() {
    if (this.host) {
      this.host.remove();
      this.host = null;
      this.shadow = null;
      this.container = null;
    }
  }
}
```

### Integration with Action Execution
```javascript
// Source: Pattern from research, adapted for FSB architecture
const highlightManager = new HighlightManager();
const progressOverlay = new ProgressOverlay();

async function executeActionWithVisualFeedback(action, element, context) {
  const { taskName, stepNumber, totalSteps } = context;

  // Show/update progress overlay
  progressOverlay.create();
  progressOverlay.update({
    taskName: taskName,
    stepNumber: stepNumber,
    stepText: `${action.type}: ${action.description || 'Executing...'}`,
    progress: (stepNumber / totalSteps) * 100
  });

  // Highlight target element if present
  if (element) {
    await highlightManager.show(element, {
      duration: 500, // VIS-03: 500ms minimum
      color: '#FF8C00',
      pulse: false
    });
  }

  // Execute the actual action
  const result = await performAction(action, element);

  // VIS-04: Highlight already cleaned up by show() promise resolution

  return result;
}

// Cleanup on session end
function endSession() {
  highlightManager.cleanup();
  progressOverlay.destroy();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS class injection | Inline styles with !important | Always was better | Guaranteed visibility over host styles |
| iframe isolation | Shadow DOM | ~2020 stable | Simpler API, no message passing needed |
| setTimeout animations | Web Animations API + RAF | ~2018 stable | 60fps performance, cancellable |
| Fixed z-index values (999) | Max int (2147483647) | Best practice | Guaranteed top layer |

**Deprecated/outdated:**
- Using `<style>` tags in content script without Shadow DOM: Still works but conflicts with host page
- jQuery-based animations: Use native Web Animations API instead

## Open Questions

1. **Element Position Changes During Highlight**
   - What we know: Elements can move during the 500ms highlight period due to animations or lazy loading
   - What's unclear: Best strategy for tracking moving elements
   - Recommendation: Accept that highlight shows initial position; for critical accuracy, implement MutationObserver tracking

2. **Multiple Elements Highlighted Simultaneously**
   - What we know: Current design highlights one element at a time
   - What's unclear: Whether future requirements need batch highlighting
   - Recommendation: Design for single highlight now; HighlightManager can be extended later

3. **High-contrast/Accessibility Mode Compatibility**
   - What we know: Some users use forced colors mode or high contrast
   - What's unclear: Whether orange glow is visible in all accessibility modes
   - Recommendation: Test on Windows High Contrast mode; add fallback border if needed

## Sources

### Primary (HIGH confidence)
- [MDN Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) - Shadow DOM creation patterns
- [Chrome DevDocs Hardware-Accelerated Animations](https://developer.chrome.com/blog/hardware-accelerated-animations) - GPU animation properties
- [Chrome DevDocs Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) - CSS injection and isolation
- [MDN z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index) - Maximum z-index value

### Secondary (MEDIUM confidence)
- [DEV.to Shadow DOM in Extensions](https://dev.to/developertom01/solving-css-and-javascript-interference-in-chrome-extensions-a-guide-to-react-shadow-dom-and-best-practices-9l) - Shadow DOM + CSS isolation practical guide
- [Courier Shadow DOM Guide](https://www.courier.com/blog/how-to-use-the-shadow-dom-to-isolate-styles-on-a-dom-that-isnt-yours) - Step-by-step isolation
- [Highlight Elements Blog](https://glebbahmutov.com/blog/highlight-element/) - Testing highlight patterns
- [Lexo CSS GPU Acceleration](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/) - will-change best practices

### Tertiary (LOW confidence)
- Various CSS glow generators - Orange color values (verified against standard)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on MDN and Chrome official documentation
- Architecture: HIGH - Patterns from established testing frameworks (Playwright, Selenium) and Chrome Extension best practices
- Pitfalls: MEDIUM - Based on community experience and common patterns; some edge cases may exist

**Research date:** 2026-02-03
**Valid until:** 2026-04-03 (60 days - stable browser APIs, unlikely to change)
