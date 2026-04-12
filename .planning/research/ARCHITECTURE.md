# Architecture Patterns: Progress Overlay Refinement

**Domain:** Browser extension progress overlay -- component structure and data flow
**Researched:** 2026-04-12

## Recommended Architecture

The overlay refinement does not change the system architecture. It changes what data flows through existing pipes and how one component renders it.

### Component Boundaries (Existing, Unchanged)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `background.js` (agent loop) | Emits overlay state updates via `chrome.tabs.sendMessage` | content/messaging.js |
| `utils/overlay-state.js` | Normalizes raw status data into canonical overlay state object | Imported by background.js and content scripts |
| `content/messaging.js` | Receives messages, routes to visual-feedback | content/visual-feedback.js |
| `content/visual-feedback.js` (ProgressOverlay) | Renders overlay state into Shadow DOM | Shadow DOM (isolated) |
| `content/dom-stream.js` | Broadcasts overlay state to dashboard | WebSocket relay |

### Data Flow (Existing, Unchanged)

```
Agent loop iteration completes
  -> background.js builds statusData object
  -> overlay-state.js buildOverlayState(statusData, session)
  -> Returns normalized { lifecycle, phase, display, progress, highlight }
  -> chrome.tabs.sendMessage({ type: 'updateOverlay', state })
  -> content/messaging.js receives
  -> progressOverlay.update(state)
  -> Shadow DOM elements updated via textContent
  -> dom-stream broadcasts to dashboard (if streaming)
```

**What changes in v0.9.26:** The shape of the normalized state object stays the same. What changes is:
1. **Input filtering:** background.js stops putting developer metrics into statusData
2. **Display content:** `display.detail` carries human-readable action descriptions instead of debug text
3. **Progress data:** `progress.label` uses action counts ("3 actions") instead of iteration counts
4. **New field:** `display.elapsed` carries elapsed seconds (or the timer runs locally in the overlay)

## Patterns to Follow

### Pattern 1: Local Timer, Not Server-Pushed Time

**What:** The elapsed timer runs inside ProgressOverlay using `performance.now()`, not pushed from background.js.

**When:** Always for elapsed time display.

**Why:** Message passing between background.js and the content script has variable latency (10-200ms). If the timer is driven by background.js sending "elapsed: 7s" messages, the display will stutter because messages arrive at irregular intervals. A local timer in the content script, started when the overlay first appears and stopped when lifecycle becomes 'final', is perfectly smooth.

**Example:**
```javascript
// In ProgressOverlay class
create() {
  // ... existing code ...
  this._timerStart = 0;
  this._timerRafId = null;
  this._timerLastSecond = -1;
}

_startTimer() {
  this._timerStart = performance.now();
  this._timerLastSecond = -1;
  this._tickTimer();
}

_tickTimer() {
  var elapsed = Math.floor((performance.now() - this._timerStart) / 1000);
  if (elapsed !== this._timerLastSecond) {
    this._timerLastSecond = elapsed;
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var el = this.container.querySelector('.fsb-elapsed');
    if (el) el.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
  }
  this._timerRafId = requestAnimationFrame(this._tickTimer.bind(this));
}

_stopTimer() {
  if (this._timerRafId) {
    cancelAnimationFrame(this._timerRafId);
    this._timerRafId = null;
  }
}
```

### Pattern 2: scaleX Progress Instead of Width

**What:** Set progress fill to `width: 100%` permanently. Control visible width with `transform: scaleX(fraction)`.

**When:** All determinate progress updates.

**Why:** `width` triggers layout recalculation. `transform: scaleX()` is compositor-only -- zero layout or paint cost. This matters because FSB automates complex pages (Google Sheets, Docs) where layout thrashing from the overlay would compete with the page's own rendering.

**Example:**
```javascript
// In update() method, replace:
//   fill.style.width = progress.percent + '%';
// With:
fill.style.transform = 'scaleX(' + (progress.percent / 100) + ')';
```

```css
.fsb-progress-fill {
  width: 100%;
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

### Pattern 3: Action Count from Session State

**What:** Display "N actions" derived from the session's action count, not iteration count.

**When:** During all running lifecycle states.

**Why:** Actions (click, type, navigate) are user-visible and tangible. Iterations are internal agent loop cycles that include planning, analysis, and retry -- invisible to the user. Showing "12 iterations" when only 4 visible actions happened is confusing.

**Example:**
```javascript
// In buildOverlayState or the update path:
var actionCount = (session && session.actionCount) || 0;
// Include in display or progress:
display.actionCount = actionCount;
```

### Pattern 4: Debounced Detail Text Updates

**What:** Apply a short debounce (200-300ms) to `display.detail` text changes to prevent flickering when rapid updates arrive.

**When:** When the agent loop emits multiple status updates in quick succession (e.g., during batch actions).

**Why:** Already partially implemented with the 300ms phase label debounce. Extend to detail text. The existing code documents this: "Only debounce generic labels, bypass for explicit statusText."

## Anti-Patterns to Avoid

### Anti-Pattern 1: Pushing Elapsed Time from Background

**What:** Having background.js calculate elapsed seconds and include them in every overlay state update.

**Why bad:** Message passing latency makes the timer stutter. Updates arrive at 500ms-3000ms intervals depending on agent loop speed. A timer that jumps from "0:03" to "0:05" to "0:06" looks broken.

**Instead:** Run the timer locally in the content script's ProgressOverlay class. Start on first show(), stop on lifecycle=final.

### Anti-Pattern 2: Rich HTML in Action Summaries

**What:** Using innerHTML to render formatted action descriptions (bold keywords, links, etc.).

**Why bad:** XSS vector if AI-generated text contains HTML. Also unnecessary -- a plain text sentence like "Clicked the Submit button" is clear without formatting.

**Instead:** Always use textContent. The existing sanitizeOverlayText() already strips markdown. Keep this.

### Anti-Pattern 3: Percentage Display as Primary Progress

**What:** Showing "47%" as the main progress indicator.

**Why bad:** NNG research shows exact percentages lose credibility when progress stalls or jumps backward. For AI automation, progress estimation is inherently imprecise. A percentage that says "60%" then drops to "45%" (if the task turns out to be harder than estimated) destroys user trust.

**Instead:** Use the progress bar as visual-only (no number label). Show the phase badge ("Navigating", "Filling form") as the primary status indicator. If a label is needed, use action counts ("5 actions").

### Anti-Pattern 4: Animating the Whole Overlay

**What:** Adding fade, slide, or scale animations to the entire overlay container on state changes.

**Why bad:** Promotes the full overlay (including text, which cannot be composited) to a GPU layer. Wastes memory and can cause text rendering artifacts (blurry text from subpixel positioning).

**Instead:** Only animate the progress fill (transform) and the overlay visibility (opacity on show/hide). Text updates should be instant (textContent assignment).

## Scalability Considerations

Not applicable for this refinement. The overlay is a single DOM element in a Shadow DOM. It renders on exactly one tab at a time. There are no scalability concerns.

## Sources

- Existing FSB code: `content/visual-feedback.js` lines 230-578, `utils/overlay-state.js` full file -- direct inspection (HIGH confidence)
- [NNG: Progress Indicators](https://www.nngroup.com/articles/progress-indicators/) -- percentage credibility warning (HIGH confidence)
- [Smashing Magazine: CSS GPU Animation](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/) -- transform vs layout animation (HIGH confidence)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) -- timing callback behavior (HIGH confidence)

---
*Architecture patterns for: FSB v0.9.26 Progress Overlay Refinement*
*Researched: 2026-04-12*
