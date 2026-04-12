# Domain Pitfalls: Progress Overlay Refinement

**Domain:** Browser extension progress overlay -- CSS/JS in Shadow DOM
**Researched:** 2026-04-12

## Critical Pitfalls

Mistakes that cause visual breakage or performance degradation on host pages.

### Pitfall 1: Animating `width` on the Progress Bar

**What goes wrong:** The current implementation uses `fill.style.width = progress.percent + '%'` with `transition: width 0.3s`. Every frame of this transition triggers a layout recalculation for the fill element and potentially its parent. On complex pages (Google Sheets with thousands of cells, Google Docs with many layers), the overlay's layout thrashing competes with the page's own rendering, contributing to frame drops.

**Why it happens:** `width` is a layout property. Changing it forces the browser to recalculate the geometry of the element and all elements that might be affected by its size change. Even inside Shadow DOM, the host element still participates in the document's layout flow.

**Consequences:** Choppy progress bar animation. On heavy pages, the overlay update can cause the page itself to stutter (visible in DevTools Performance panel as "Layout" events correlated with overlay updates).

**Prevention:** Use `transform: scaleX(fraction)` instead. Set `width: 100%` permanently on the fill element and control its visual width via scaleX. Transform animations are compositor-only -- they skip layout and paint entirely.

**Detection:** Open Chrome DevTools > Performance panel. Record a 5-second session with the overlay active. Look for "Layout" events that coincide with progress bar updates. If present, width is the cause.

### Pitfall 2: rem Units in Shadow DOM Styles

**What goes wrong:** Some websites (particularly CSS framework-heavy ones) set `html { font-size: 62.5% }` to make rem calculations easier (1rem = 10px). If the overlay uses rem units, all sizing would be based on 10px instead of the expected 16px, making the overlay tiny and unreadable.

**Why it happens:** Shadow DOM provides style isolation for the shadow tree, but the `:host` element inherits computed styles from its parent in the document tree. The `rem` unit is always relative to the root element's font-size, which crosses Shadow DOM boundaries.

**Consequences:** Overlay renders at wrong size on approximately 15-20% of websites that use the 62.5% rem reset pattern.

**Prevention:** Use `px` units for all sizing inside the overlay. The existing implementation already does this correctly. Do not introduce rem units during refinement.

**Detection:** Test the overlay on a Bootstrap 4/5 site or any site using `html { font-size: 62.5% }`.

### Pitfall 3: Timer Drift with setInterval

**What goes wrong:** Using `setInterval(fn, 1000)` for an elapsed time display causes the timer to drift under CPU load. After 60 seconds of automation (during which the CPU is busy with DOM analysis and AI calls), the displayed elapsed time can be 2-5 seconds behind actual elapsed time.

**Why it happens:** setInterval is not guaranteed to fire at exact intervals. If the event loop is busy when the interval fires, the callback is delayed. These delays accumulate over time. Additionally, Chrome throttles timers in background tabs to once per second (or slower), which can cause missed ticks.

**Consequences:** Inaccurate elapsed time display. The timer might jump from "0:23" to "0:26" when a CPU-heavy operation completes, visibly catching up.

**Prevention:** Use `performance.now()` for the time source and `requestAnimationFrame` for scheduling. Calculate elapsed time as `now - startTime` on every frame, not by incrementing a counter. This is drift-free because it reads absolute time, not relative intervals.

**Detection:** Run an automation on a complex page for 2+ minutes. Compare the overlay's elapsed time to a reference clock. With setInterval, they will diverge by seconds.

## Moderate Pitfalls

### Pitfall 4: Layout Jitter from Proportional-Width Digits

**What goes wrong:** The digits 0-9 have different widths in proportional fonts. When the elapsed timer changes from "1:09" to "1:10", the total width of the text changes because "1" is narrower than "0". This causes the timer element (and anything positioned relative to it) to shift horizontally on every tick.

**Prevention:** Apply `font-variant-numeric: tabular-nums` to all elements displaying numeric values (elapsed time, action count). This forces equal-width digits while keeping the proportional letter-spacing of the UI font. Also set `min-width` on the timer element to prevent container resizing. The system fonts in FSB's font stack (SF Pro via -apple-system, Segoe UI, Roboto) all support the `tnum` OpenType feature.

### Pitfall 5: over-Promoting Elements with will-change

**What goes wrong:** Applying `will-change: transform` to the entire overlay container (or to many elements) wastes GPU memory by creating separate compositing layers for each element. Each layer consumes GPU texture memory proportional to its pixel area.

**Prevention:** Apply `will-change: transform` only to `.fsb-progress-fill` -- the one element that actually animates via transform. Remove `will-change` when the progress bar is in indeterminate mode (since the indeterminate animation uses keyframes, not JS-driven transform updates). The overlay text, header, and container should never have `will-change`.

### Pitfall 6: Text Blur from Subpixel Transform Positioning

**What goes wrong:** When an element has a transform applied, the browser may render it on a non-integer pixel boundary, causing text inside to appear blurry. This is most visible at small font sizes (11-13px range, exactly what the overlay uses).

**Prevention:** The progress fill contains no text, so scaleX on it is safe. Never apply transforms to elements containing text in the overlay. The show/hide animation uses opacity (which does not cause subpixel issues), not transform.

### Pitfall 7: Stale Timer After Page Navigation

**What goes wrong:** When FSB navigates the page (e.g., clicking a link), the content script is destroyed and re-injected on the new page. The elapsed timer's `_timerStart` value is lost, and the timer resets to 0:00 on the new page.

**Prevention:** Store the timer start timestamp in `FSB.overlayState` (which persists via the messaging system from background.js). When the overlay is recreated on a new page, read the original start time from the state object and resume the timer from where it was. The background.js session already tracks session start time -- pass it through the overlay state.

### Pitfall 8: Progress Bar Regression During Task Re-estimation

**What goes wrong:** The phase-weighted progress model (navigation 0-30%, extraction 30-70%, writing 70-100%) can cause the progress bar to jump backward if the task phase is re-estimated. For example, if the system thinks it is in the "extraction" phase at 45% but then the AI decides it needs to navigate to another page, the phase resets to "navigation" and progress drops to 25%.

**Prevention:** Never allow the displayed progress to decrease. In the update method, clamp the new percentage to be at least as high as the current displayed percentage: `var displayPercent = Math.max(currentPercent, newPercent)`. This is a simple one-line guard that prevents backward jumps while still allowing forward progress.

## Minor Pitfalls

### Pitfall 9: Indeterminate Animation After Completion

**What goes wrong:** If the overlay receives a lifecycle=final state but the indeterminate animation CSS class is not properly removed, the sweep animation continues playing on a completed task, confusing users.

**Prevention:** The existing code already handles this in the `update()` method (lines 519-526 of visual-feedback.js). Verify that the scaleX refactor preserves this logic. When lifecycle is 'final', remove the indeterminate class AND set scaleX(1) for a full bar.

### Pitfall 10: Font Stack Fallback Breaks Tabular Nums

**What goes wrong:** If the browser falls through the entire font stack to a generic sans-serif that does not support `tnum`, the `font-variant-numeric: tabular-nums` declaration silently does nothing. The layout jitter returns.

**Prevention:** This is extremely unlikely on Chrome (which always has at least Roboto or the system font available), but as a belt-and-suspenders measure, combine `font-variant-numeric: tabular-nums` with `min-width` on numeric elements. The min-width ensures the container never resizes, even if tabular-nums is not active.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Strip developer metrics | Removing fields that other consumers (dashboard, sidepanel) rely on | Only strip from the overlay display path. Keep full data in the session state and in messages sent to the dashboard/sidepanel. Do not remove fields from buildOverlayState -- filter at the display layer. |
| scaleX progress bar | Breaking the indeterminate sweep animation | The indeterminate animation uses `@keyframes` with `translateX`, not width. Verify that `width: 100%` on the fill does not interfere with the translateX sweep. Test both modes after the change. |
| Elapsed timer | Timer not starting because overlay is created before first state update | Start the timer in `show()` if not already started, not in `update()`. The show() call is the reliable signal that the overlay is visible and timing should begin. |
| Action summary cleanup | AI-generated summaries arriving too late (after the 2.5s timeout) | The fire-and-forget pattern means sometimes no AI summary arrives. Always have a fallback: use the phase-based default detail from `getDefaultDetail()`. Never show a blank detail line. |
| UX polish | Changing dimensions that break the Popover API top-layer position | Do not change the overlay width (320px) or position (top: 16px, right: 16px). These values are tuned to work across sites. Adjusting them risks clipping on narrow viewports or overlapping with site-specific fixed headers. |

## Sources

- [Smashing Magazine: CSS GPU Animation](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/) -- transform vs layout property animation costs (HIGH confidence)
- [NNG: Progress Indicators](https://www.nngroup.com/articles/progress-indicators/) -- backward progress destroying trust (HIGH confidence)
- [MDN: Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) -- style inheritance behavior across shadow boundaries (HIGH confidence)
- [web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion) -- accessibility compliance for vestibular disorders (HIGH confidence)
- [MDN: font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric) -- tabular-nums behavior and fallback (HIGH confidence)
- Existing FSB code: `content/visual-feedback.js`, `utils/overlay-state.js` -- current implementation pitfall surface (HIGH confidence)
- [DEV Community: Shadow DOM CSS in Chrome Extensions](https://dev.to/developertom01/solving-css-and-javascript-interference-in-chrome-extensions-a-guide-to-react-shadow-dom-and-best-practices-9l) -- rem inheritance issue (MEDIUM confidence)

---
*Domain pitfalls for: FSB v0.9.26 Progress Overlay Refinement*
*Researched: 2026-04-12*
