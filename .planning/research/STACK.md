# Stack Research: Progress Overlay Refinement for FSB

**Domain:** Browser extension progress overlay -- vanilla CSS/JS in Shadow DOM
**Researched:** 2026-04-12
**Confidence:** HIGH (existing implementation reviewed, patterns verified against authoritative sources)

## Executive Summary

This research covers the CSS techniques, animation patterns, typography choices, and UX approaches needed to refine FSB's existing progress overlay from a developer-debug display into a clean, human-readable task status indicator. The overlay already works structurally -- Shadow DOM isolation, Popover API top-layer promotion, lifecycle management, and state normalization are all solid. The refinement is purely about what gets displayed and how it looks.

The existing overlay (`content/visual-feedback.js` ProgressOverlay class + `utils/overlay-state.js` state builder) has a good foundation: 320px fixed-width card, black background with orange accent, header/task/step/meta/progress-bar layout. The changes needed are about stripping developer noise (iteration counts, token stats, cost), fixing the progress bar to use GPU-friendly animation, making the elapsed timer stable with tabular figures, and showing concise action summaries.

No npm dependencies are needed. No new libraries. Every technique below is vanilla CSS + vanilla JS, Shadow DOM compatible, and tested in production by the patterns they come from.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CSS `font-variant-numeric: tabular-nums` | CSS3 (baseline) | Prevent layout jitter on elapsed time / action count displays | System fonts used by FSB (SF Pro via -apple-system, Segoe UI, Roboto) all support the `tnum` OpenType feature. Without it, numbers like "1:23" and "1:09" have different widths and cause the display to jump. MDN confirms baseline support across all modern browsers. |
| CSS `transform: scaleX()` for progress fill | CSS3 (baseline) | GPU-composited progress bar animation | Animating `width` triggers layout recalculation every frame. Using `scaleX()` with `transform-origin: left` keeps the animation on the compositor thread -- zero layout/paint cost. Smashing Magazine and Chrome DevRel both confirm transform+opacity are the only two properties guaranteed to skip layout and paint. |
| CSS `transition` on transform | CSS3 (baseline) | Smooth progress advancement | `transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)` gives a natural ease-out feel when progress jumps (e.g., 30% to 45%). The cubic bezier starts fast and decelerates -- this matches NNG's recommendation that progress should feel like it accelerates early. |
| CSS `contain: layout paint` | CSS Containment L1 | Prevent overlay reflows from affecting host page | Already present in the existing overlay. Keeps all layout/paint calculations scoped to the overlay element, preventing reflow from leaking into the host page DOM. |
| `performance.now()` + `requestAnimationFrame` | Web API | Smooth elapsed time counter | `setInterval` drifts and can miss ticks when the tab is backgrounded. `performance.now()` gives sub-millisecond precision. rAF ensures updates sync with display refresh. The timer only needs to update once per second visually, but rAF handles the scheduling cleanly. |
| CSS `@keyframes` with `translateX` | CSS3 (baseline) | Indeterminate progress sweep animation | The existing `fsbProgressSweep` keyframe already uses translateX -- good. This stays on the GPU compositor. No changes needed to the indeterminate pattern. |
| Popover API (`showPopover()`) | HTML (Chrome 114+) | Top-layer rendering above all stacking contexts | Already implemented in the existing overlay. Popover API reached Baseline Widely Available in April 2025. Ensures the overlay renders above any z-index or overflow:hidden on the host page. |
| Shadow DOM (open mode) | Web Components | Complete style isolation from host page | Already implemented. Using `all: initial` on the host element prevents inherited styles from leaking in. The open mode is correct -- FSB needs to read/update shadow DOM elements programmatically. |

### Supporting Patterns

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| `will-change: transform` on progress fill | Hint browser to pre-promote element to its own compositing layer | Apply to `.fsb-progress-fill` only. Do NOT apply to the whole overlay -- over-promoting wastes GPU memory. Remove `will-change` when progress is hidden (indeterminate mode) to free the layer. |
| `@media (prefers-reduced-motion: reduce)` | Respect user accessibility preferences | Already partially implemented. Extend to cover the elapsed timer pulse and any new fade transitions. Replace animations with instant state changes. |
| CSS custom properties (variables) for theming | Centralize color/sizing tokens inside Shadow DOM | Use `--fsb-accent: #FF8C00`, `--fsb-bg: #000`, `--fsb-text: #fff`, `--fsb-muted: rgba(255,255,255,0.5)` at `:host` level. Makes future theming changes single-point edits. |
| `textContent` over `innerHTML` for updates | XSS safety + performance | Already used in the `update()` method for text updates. Keep this pattern -- never use innerHTML for dynamic content from AI-generated summaries. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Chrome DevTools Performance panel | Profile animation frame rate | Use "Paint flashing" to verify the overlay is not triggering host page repaints. Record a 5-second session and check that the overlay progress bar stays on the compositor thread (no "Layout" or "Paint" entries for the overlay). |
| Chrome DevTools Layers panel | Verify GPU compositing | Confirm `.fsb-progress-fill` gets its own compositing layer when `will-change: transform` is applied. Should show as a separate layer in the 3D view. |
| Chrome `--show-paint-rects` flag | Visualize paint regions | Verify that overlay updates don't cause paint rectangles on the host page content behind the overlay. |

## Installation

```bash
# No installation required.
# Everything is vanilla CSS + vanilla JS.
# No npm dependencies. No build step.
#
# The techniques below are implemented directly in:
#   content/visual-feedback.js  (ProgressOverlay class)
#   utils/overlay-state.js      (state normalization)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `transform: scaleX()` for progress | `width` transition | Never for this use case. `width` triggers layout on every frame. The existing code already uses `width` + `transition: width 0.3s` -- this should be replaced with scaleX. |
| `performance.now()` + rAF for timer | `setInterval(1000)` | Never for display-critical timers. setInterval drifts under load, can stack callbacks, and does not sync with display refresh. |
| `font-variant-numeric: tabular-nums` | Monospace font for numbers | Only if you need guaranteed fixed-width for ALL characters, not just digits. `tabular-nums` is better because it keeps the proportional letter-spacing of the UI font while fixing only the digit widths. |
| Inline `textContent` updates | DOM diffing / virtual DOM | Never. The overlay has 6 text nodes. Direct `textContent` assignment is faster than any diffing library for this scale. |
| CSS custom properties | Inline style overrides | Only for one-off dynamic values (like progress percentage). All static theming should use custom properties for maintainability. |
| Cubic bezier easing on progress | Linear transition | Only when progress genuinely moves at a constant rate (e.g., file download with known size). For AI automation where step duration varies, the ease-out bezier feels more natural. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `width` animation on progress bar | Forces layout recalculation on every frame. Causes jank on complex pages where FSB is automating. The browser must recalculate the geometry of the fill element and potentially its siblings. | `transform: scaleX(progress/100)` with `transform-origin: left`. Set the fill to `width: 100%` permanently and scale it down. |
| `setInterval` for elapsed time | Drifts under CPU load, does not pause when tab is backgrounded (wastes resources), can stack callbacks if interval fires faster than handler. | `requestAnimationFrame` with `performance.now()` delta calculation. Only update the DOM when the displayed second changes. |
| `rem` units inside Shadow DOM | Host page CSS resets (like `html { font-size: 62.5% }`) leak into Shadow DOM host sizing. This causes the overlay to render at wrong sizes on pages that use rem scaling. | `px` units for all sizing. The existing overlay already uses px correctly -- keep this pattern. |
| Animating `opacity` on the whole overlay for pulse effects | Promotes the entire overlay to a GPU layer unnecessarily. Wastes compositing memory. | If a pulse is needed, apply it to a small accent element (like the step badge) only. |
| `innerHTML` for dynamic text updates | XSS vector if AI-generated summaries contain HTML. Also slower than textContent because the browser must parse HTML. | `textContent` for all dynamic text. Already done correctly in the existing code. |
| Third-party animation libraries (GSAP, anime.js, etc.) | Adds weight, requires bundling, not needed for the 2-3 animations this overlay uses. CSS transitions handle all the cases. | CSS `transition` for deterministic progress. CSS `@keyframes` for indeterminate sweep. Both are already in use. |
| `backdrop-filter: blur()` on overlay | Extremely expensive on GPU. On complex pages with many layers (Sheets, Docs), this can drop the host page to 15fps. | Solid background (`background: #000`) with slight transparency if desired (`rgba(0,0,0,0.95)`). |

## Specific CSS Implementation Patterns

### Progress Bar: scaleX Pattern

Replace the current `width` animation with GPU-composited `scaleX`:

```css
.fsb-progress-fill {
  width: 100%;                    /* Always full width */
  height: 100%;
  background: linear-gradient(90deg, var(--fsb-accent), var(--fsb-accent-dark));
  border-radius: 2px;
  transform-origin: left center;
  transform: scaleX(0);           /* Controlled by JS */
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform;
}
```

Update in JS:
```javascript
fill.style.transform = 'scaleX(' + (progress.percent / 100) + ')';
```

### Elapsed Timer: Tabular Figures

```css
.fsb-elapsed {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 3.5em;              /* Prevents container resize */
  text-align: right;
}
```

### Step Badge: Compact Phase Indicator

```css
.fsb-step-number {
  background: rgba(255, 140, 0, 0.15);
  color: #FF8C00;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;  /* For "3/7" style counts */
  white-space: nowrap;
  flex-shrink: 0;
}
```

### Smooth Fade Transitions

```css
.fsb-overlay {
  opacity: 1;
  transition: opacity 0.2s ease-out;
}

.fsb-overlay.hidden {
  opacity: 0;
  pointer-events: none;
}

/* Detail text crossfade when action summary changes */
.fsb-step-text {
  transition: opacity 0.15s ease;
}
```

### Reduced Motion Compliance

```css
@media (prefers-reduced-motion: reduce) {
  .fsb-overlay,
  .fsb-progress-fill,
  .fsb-step-text {
    transition: none !important;
  }

  .fsb-progress-bar.indeterminate .fsb-progress-fill {
    animation: none;
    transform: scaleX(0.45);     /* Static bar instead of sweep */
  }

  .fsb-elapsed {
    /* No pulse animation */
  }
}
```

## Elapsed Timer Implementation Pattern

```javascript
// Efficient elapsed time display using rAF
class ElapsedTimer {
  constructor(displayElement) {
    this.el = displayElement;
    this.startTime = 0;
    this.rafId = null;
    this.lastDisplayedSecond = -1;
  }

  start() {
    this.startTime = performance.now();
    this.lastDisplayedSecond = -1;
    this._tick();
  }

  _tick() {
    var elapsed = Math.floor((performance.now() - this.startTime) / 1000);
    if (elapsed !== this.lastDisplayedSecond) {
      this.lastDisplayedSecond = elapsed;
      var mins = Math.floor(elapsed / 60);
      var secs = elapsed % 60;
      // Use textContent, not innerHTML
      this.el.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
```

Key details:
- Only touches the DOM when the displayed second actually changes (max 1 DOM write/second)
- Uses `performance.now()` for drift-free timing
- rAF automatically pauses when tab is backgrounded (saves battery)
- `bind(this)` is called once and cached in a real implementation

## Version Compatibility

| Feature | Chrome | Edge | Safari | Notes |
|---------|--------|------|--------|-------|
| `font-variant-numeric: tabular-nums` | 52+ | 79+ | 9.1+ | All system fonts in FSB's font stack support tnum |
| `transform: scaleX()` | 36+ | 12+ | 9+ | Baseline for years |
| `transition` on transform | 36+ | 12+ | 9+ | Baseline for years |
| `will-change` | 36+ | 79+ | 9.1+ | Use sparingly -- only on animated elements |
| `contain: layout paint` | 52+ | 79+ | 15.4+ | Already in use |
| `performance.now()` | 24+ | 12+ | 8+ | Baseline for years |
| `requestAnimationFrame` | 24+ | 12+ | 6.1+ | Baseline for years |
| Popover API | 114+ | 114+ | 17+ | Already in use with fallback |
| Shadow DOM (open) | 53+ | 79+ | 10+ | Already in use |
| CSS custom properties | 49+ | 15+ | 9.1+ | Baseline for years |

All features are well within FSB's Chrome 88+ minimum requirement. No compatibility concerns.

## Sources

- [Smashing Magazine: CSS GPU Animation](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/) -- transform vs layout animation performance (HIGH confidence)
- [Nielsen Norman Group: Progress Indicators](https://www.nngroup.com/articles/progress-indicators/) -- when to use determinate vs indeterminate, what information to display (HIGH confidence)
- [Smart Interface Design Patterns: Loading and Progress UX](https://smart-interface-design-patterns.com/articles/designing-better-loading-progress-ux/) -- wait duration thresholds, progress bar movement psychology (HIGH confidence)
- [MDN: font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric) -- tabular-nums specification and support (HIGH confidence)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) -- timing callback API (HIGH confidence)
- [MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) -- top-layer rendering specification (HIGH confidence)
- [MDN: Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) -- encapsulation model (HIGH confidence)
- [Cloudscape: Progressive Steps Pattern](https://cloudscape.design/patterns/genai/progressive-steps/) -- AI task progress display pattern (HIGH confidence)
- [Snook.ca: Animating Progress](https://snook.ca/archives/html_and_css/animating-progress) -- transform-based progress bar technique (MEDIUM confidence)
- [Chrome DevRel: Hardware Accelerated Animations](https://developer.chrome.com/blog/hardware-accelerated-animations) -- compositor thread animation properties (HIGH confidence)
- [web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion) -- accessibility compliance for motion (HIGH confidence)
- Existing FSB code: `content/visual-feedback.js`, `utils/overlay-state.js` -- current implementation baseline (HIGH confidence, direct inspection)

---
*Stack research for: FSB v0.9.26 Progress Overlay Refinement*
*Researched: 2026-04-12*
