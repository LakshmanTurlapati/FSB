# Phase 47: TradingView Fibonacci - Research

**Researched:** 2026-03-19
**Domain:** Canvas interaction via Chrome DevTools Protocol (CDP) + TradingView drawing tools
**Confidence:** MEDIUM

## Summary

This phase requires drawing a Fibonacci retracement on TradingView's canvas-based chart. TradingView charts use HTML5 canvas with event listeners for `mousedown`, `mousemove`, `mouseup` (and touch equivalents). Content script `dispatchEvent()` calls produce **untrusted** events that canvas apps commonly ignore. The proven approach is to use **Chrome DevTools Protocol (CDP) `Input.dispatchMouseEvent`** which produces trusted, browser-level events indistinguishable from real user input.

The FSB extension already has a CDP mouse click handler (`handleCDPMouseClick` in background.js) and the `debugger` permission in manifest.json. However, the existing handler only does a simple press-release click at coordinates -- it does NOT support mouse drag (mousePressed -> mouseMoved -> mouseReleased sequences). The core work is: (1) add a CDP-based drag tool, (2) select the Fibonacci drawing tool via DOM click on TradingView's toolbar, (3) CDP-drag from point A to point B on the chart canvas to draw the retracement.

**Primary recommendation:** Extend the existing CDP infrastructure to support coordinate-based drag operations, expose as a new MCP `click_at` and `drag` tool, then orchestrate the TradingView Fibonacci workflow: navigate -> select Fib tool from toolbar -> CDP-drag on canvas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Canvas interaction strategy: Analyze first, build specific. Reverse-engineer event sequences. New tools in manual.ts as reusable MCP tools, content script helpers in content/actions.js exposed via MCP bridge.
- Test site: Free TradingView (tradingview.com/chart) without login. Dismiss sign-up prompts. Fallback to alternative free charting site if auth blocks drawing tools.
- Pass/fail criteria: Pass = Fibonacci lines visibly drawn. Partial = tool selected but drawing failed. Fail = couldn't interact with canvas at all. Structured autopilot diagnostic report required.
- Bug fix scope: Add specific MCP tools for canvas coordinate interaction (click_at, drag, etc.) based on analysis. Don't over-engineer. Update site-guides/finance/tradingview.js.

### Claude's Discretion
- Exact event types to dispatch (mouse vs pointer vs custom) -- determined by analysis
- How to identify price coordinates on the canvas for Fibonacci placement
- Diagnostic report template structure (will become reusable across all 50 phases)
- Whether to add a dedicated "canvas interaction" module or extend existing actions.js

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANVAS-01 | MCP can interact with TradingView chart elements (draw Fibonacci retracement from local low to local high) | CDP Input.dispatchMouseEvent for trusted canvas events; new click_at and drag MCP tools; TradingView toolbar DOM interaction for tool selection |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome DevTools Protocol (CDP) | 1.3 | Trusted mouse event dispatch via `chrome.debugger` | Already used by extension for keyboard and mouse; produces `isTrusted: true` events that canvas apps accept |
| MCP SDK | existing | Tool registration via `server.tool()` | Established pattern in manual.ts |
| Zod | existing | Schema validation for MCP tool params | Already used for all 25 manual tools |

### Supporting (No New Dependencies)
No new npm packages required. All work extends existing infrastructure.

## Architecture Patterns

### Recommended Approach: CDP-Based Canvas Interaction

```
MCP Tool (manual.ts)
  -> execAction() via WebSocket bridge
    -> background.js message handler
      -> chrome.debugger.sendCommand('Input.dispatchMouseEvent', ...)
        -> Trusted mouse event on canvas
```

**Key insight:** The content script path (`dispatchEvent()`) produces untrusted events. Canvas libraries like TradingView's check `event.isTrusted` and ignore synthetic events. The CDP path through `chrome.debugger` produces truly trusted events at the browser level.

### Pattern 1: CDP Mouse Drag Sequence
**What:** A new background.js handler that performs mousePressed -> N x mouseMoved -> mouseReleased via CDP
**When to use:** Any canvas interaction requiring click-and-drag (drawing tools, sliders, map panning)
**Example:**
```javascript
// In background.js - new handler
async function handleCDPMouseDrag(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { startX, startY, endX, endY, steps = 10, stepDelayMs = 20 } = request;

  try {
    await chrome.debugger.attach({ tabId }, '1.3');

    // Press at start
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1
    });

    // Move in steps
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(startX + (endX - startX) * t);
      const y = Math.round(startY + (endY - startY) * t);
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved', x, y, button: 'left', buttons: 1
      });
      if (stepDelayMs > 0) await new Promise(r => setTimeout(r, stepDelayMs));
    }

    // Release at end
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1
    });

    await chrome.debugger.detach({ tabId });
    sendResponse({ success: true, method: 'cdp_drag' });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}
```

### Pattern 2: CDP Click at Coordinates
**What:** Expose existing `handleCDPMouseClick` as an MCP tool via content script relay
**When to use:** Clicking canvas elements, toolbar buttons that need trusted events
**Example:**
```javascript
// In content/actions.js - new tool
cdpClickAt: async (params) => {
  const { x, y } = params;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'cdpMouseClick', x, y },
      (response) => resolve(response || { success: false, error: 'No response' })
    );
  });
},
```

### Pattern 3: TradingView Fibonacci Workflow
**What:** Multi-step sequence: select tool -> drag on chart
**When to use:** TradingView drawing operations
**Steps:**
1. Navigate to `tradingview.com/chart`
2. Dismiss any sign-up/cookie modals
3. Click the drawing toolbar's Fibonacci tool button (DOM element, not canvas)
4. Identify two chart points (can use viewport percentages since exact price coords aren't critical for validation)
5. CDP-drag from point A to point B on the canvas
6. Verify Fibonacci lines appeared (check for new DOM elements or canvas state changes)

### Anti-Patterns to Avoid
- **Content script dispatchEvent on canvas:** Canvas libraries check `isTrusted` -- untrusted events are silently dropped. Always use CDP for canvas interactions.
- **Pixel-based coordinate hardcoding:** TradingView's layout is responsive. Use relative positions (e.g., chart center +/- offset) rather than fixed pixel coordinates.
- **Single-step drag:** TradingView's mouse handler tracks manhattan distance to distinguish click from drag (5px threshold). Must send intermediate `mouseMoved` events, not just press and release at different points.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trusted mouse events on canvas | Content script `dispatchEvent()` | CDP `Input.dispatchMouseEvent` via `chrome.debugger` | Canvas apps check `isTrusted`; only CDP produces trusted events |
| Drag simulation | Simple mousedown+mouseup at different coords | CDP mousePressed -> mouseMoved steps -> mouseReleased | TradingView needs intermediate move events to register drag intent (5px manhattan distance threshold) |
| Finding chart coordinates | Manual pixel calculation | `element.getBoundingClientRect()` on chart container + relative offsets | Chart container position changes with viewport; use live bounding rect |

## Common Pitfalls

### Pitfall 1: Untrusted Events Ignored by Canvas
**What goes wrong:** Dispatching MouseEvent from content script; canvas app silently ignores it
**Why it happens:** `new MouseEvent()` via `dispatchEvent()` sets `isTrusted: false`; TradingView's event handler checks this
**How to avoid:** Route ALL canvas interactions through CDP `Input.dispatchMouseEvent`
**Warning signs:** Click/drag actions return success but nothing happens on the chart

### Pitfall 2: TradingView Sign-Up Modal Blocking Interaction
**What goes wrong:** A modal overlay blocks the chart on first visit
**Why it happens:** TradingView shows sign-up/feature prompts to unauthenticated users
**How to avoid:** Detect and dismiss modals before attempting chart interaction. Look for `.tv-dialog` or overlay elements with close buttons.
**Warning signs:** Click coordinates land on modal instead of chart

### Pitfall 3: Debugger Already Attached Error
**What goes wrong:** `chrome.debugger.attach()` fails with "Another debugger is already attached"
**Why it happens:** Previous CDP operation didn't clean up, or DevTools is open
**How to avoid:** Follow existing pattern: try attach, catch "already attached", force-detach, retry. See `handleCDPInsertText` in background.js for the pattern.
**Warning signs:** Error message contains "Another debugger"

### Pitfall 4: Drawing Tool Not in Default Toolbar State
**What goes wrong:** Fibonacci tool is nested in a dropdown, not directly visible
**Why it happens:** TradingView's drawing toolbar groups tools; Fib Retracement may be under a "Gann and Fibonacci tools" submenu
**How to avoid:** First click the parent toolbar group button, then select Fib Retracement from the expanded dropdown
**Warning signs:** Cannot find the Fibonacci tool button in DOM

### Pitfall 5: Insufficient Drag Distance / Steps
**What goes wrong:** TradingView interprets the drag as a click (no drawing created)
**Why it happens:** Lightweight-charts mouse handler uses 5px manhattan distance threshold to distinguish click from drag; too few intermediate move events
**How to avoid:** Use at least 10 intermediate `mouseMoved` steps with reasonable spacing (20ms delays). Ensure total drag distance exceeds 50px.
**Warning signs:** Click registered instead of drag; no drawing appears

### Pitfall 6: CDP Coordinates Are Viewport-Relative
**What goes wrong:** Events land at wrong position because document coords were used instead of viewport coords
**Why it happens:** CDP `Input.dispatchMouseEvent` x/y are CSS pixels relative to the viewport, not the document
**How to avoid:** Always use `getBoundingClientRect()` which returns viewport-relative coordinates, not `offsetTop/offsetLeft` which are document-relative
**Warning signs:** Events fire but at wrong chart positions

## Code Examples

### Existing CDP Mouse Click (background.js lines 11957-11980)
```javascript
// Already working - just mousePressed + mouseReleased
async function handleCDPMouseClick(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { x, y } = request;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1
    });
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1
    });
    await chrome.debugger.detach({ tabId });
    sendResponse({ success: true, x, y, method: 'cdp_mouse' });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}
```

### Existing execAction Pattern (manual.ts)
```typescript
// Standard pattern for adding new MCP tools
server.tool(
  'tool_name',
  'Description',
  { param: z.string().describe('description') },
  async ({ param }) => execAction(bridge, queue, 'tool_name', 'fsbVerb', { param }),
);
```

### Existing dragdrop Tool (content/actions.js lines 4638-4798)
The existing `dragdrop` tool uses three fallback methods (HTML5 DragEvent, PointerEvent sequence, MouseEvent sequence) but operates through content script `dispatchEvent()` -- producing untrusted events. For canvas apps, the new CDP-based approach is needed. The existing tool remains useful for standard DOM drag-and-drop (Trello, Jira cards, etc.).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Content script `dispatchEvent()` for all interactions | CDP `Input.dispatchMouseEvent` for canvas | Already implemented for click in background.js | Trusted events work on canvas; existing click_at works but drag is missing |
| Single mousePressed+mouseReleased for CDP click | Need mousePressed + N mouseMoved + mouseReleased for drag | This phase | Enables canvas drawing tools, sliders, map interactions |

**What exists vs. what's needed:**
- EXISTS: `handleCDPMouseClick` (press+release at point) -- background.js line 11957
- EXISTS: `cdpMouseClick` message handler -- background.js line 4919
- MISSING: CDP drag handler (press -> move steps -> release)
- MISSING: MCP `click_at` tool (coordinate-based CDP click)
- MISSING: MCP `drag` tool (coordinate-based CDP drag)
- MISSING: Content script `cdpClickAt` and `cdpDrag` tools that relay to background.js

## TradingView-Specific Analysis

### Drawing Tool Selection (DOM, not Canvas)
TradingView's drawing toolbar is standard HTML DOM, not canvas-rendered. The Fibonacci Retracement tool is typically accessed via:
1. A left-side toolbar with drawing tool categories
2. Clicking a category button (likely "Gann and Fibonacci tools" group)
3. Selecting "Fib Retracement" from the dropdown

These toolbar interactions use standard DOM clicks (existing `click` MCP tool works).

### Chart Canvas Interaction
After selecting the Fib Retracement tool, the user clicks two points on the chart canvas:
1. First click on the starting price point (e.g., local low)
2. Second click on the ending price point (e.g., local high)

For this phase, exact price accuracy is NOT required -- we just need to demonstrate the drawing tool works. Using relative chart positions (e.g., lower-left quadrant to upper-right quadrant) is sufficient.

### Free Tier Access
TradingView's free tier allows drawing tools without login. The URL `tradingview.com/chart` opens a chart with drawing tools available. Sign-up modals may appear but can be dismissed.

## Diagnostic Report Template

The diagnostic report should be a reusable template for all 50 edge case phases:

```markdown
# Autopilot Diagnostic Report: Phase XX - [Name]

## Metadata
- Phase: XX
- Requirement: [REQ-ID]
- Date: YYYY-MM-DD
- Outcome: PASS | PARTIAL | FAIL | SKIP-AUTH

## Prompt Executed
[The exact edge case prompt attempted]

## Result Summary
[1-2 sentence outcome]

## Step-by-Step Log
| Step | Action | Target | Result | Notes |
|------|--------|--------|--------|-------|
| 1 | navigate | tradingview.com/chart | success | |
| 2 | ... | ... | ... | |

## What Worked
- [bullet points]

## What Failed
- [bullet points with error details]

## Tool Gaps Identified
- [Missing MCP tools or capabilities]

## Bugs Fixed In-Phase
- [Description of any bugs found and fixed]

## Autopilot Recommendations
- [Recommendations for future autopilot improvements]
```

## Open Questions

1. **TradingView toolbar exact DOM structure**
   - What we know: Drawing tools are in a left-side toolbar, Fibonacci is in a submenu group
   - What's unclear: Exact CSS selectors, data attributes, whether structure varies between visits
   - Recommendation: Phase implementation must include a DOM inspection step to discover selectors dynamically. Use `get_dom_snapshot` to find toolbar elements.

2. **Whether TradingView checks isTrusted on canvas events**
   - What we know: TradingView lightweight-charts library listens for standard mouse events (mousedown, mousemove, mouseup). Many canvas apps check isTrusted.
   - What's unclear: Whether the production TradingView site specifically checks isTrusted or has additional protections
   - Recommendation: Start with CDP approach (guaranteed trusted). If it still fails, investigate further.

3. **Two-click vs drag for Fibonacci drawing**
   - What we know: TradingView docs say "draw a trend line between two extreme points" for Fibonacci. Could be two separate clicks OR a click-drag.
   - What's unclear: Whether the drawing tool uses click-click or click-drag-release
   - Recommendation: Implement both CDP click_at and drag tools. Try click-click first (simpler). Fall back to drag if click-click doesn't work.

## Sources

### Primary (HIGH confidence)
- TradingView lightweight-charts mouse-event-handler.ts (GitHub) - confirms mousedown/mousemove/mouseup event handling, 5px manhattan distance threshold
- Chrome DevTools Protocol Input domain docs - confirms Input.dispatchMouseEvent types and parameters
- FSB codebase: background.js handleCDPMouseClick (lines 11957-11980) - existing CDP mouse infrastructure
- FSB codebase: manual.ts - existing MCP tool registration pattern
- FSB codebase: manifest.json - confirms `debugger` permission present

### Secondary (MEDIUM confidence)
- [TradingView Drawing Tools Support](https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/) - Fibonacci Retracement is a standard drawing tool
- [TradingView Fib Retracement Guide](https://www.tradingview.com/support/solutions/43000518158-fib-retracement/) - Drawing workflow: select tool, click two points
- [Automating Clicks in Chromium](https://medium.com/@aslushnikov/automating-clicks-in-chromium-a50e7f01d3fb) - CDP events are trusted, dispatchEvent is not
- [CDP Input.dispatchMouseEvent Issue #130](https://github.com/ChromeDevTools/devtools-protocol/issues/130) - Known quirks with cursor position during CDP dispatch

### Tertiary (LOW confidence)
- TradingView exact DOM selectors for drawing toolbar - needs live inspection, not documented publicly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all infrastructure already exists in the codebase
- Architecture: HIGH - CDP approach is proven (existing click handler works), just needs drag extension
- Pitfalls: MEDIUM - TradingView-specific behaviors (modals, toolbar structure) need live discovery
- TradingView DOM selectors: LOW - must be discovered during implementation via DOM inspection

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (TradingView may update their UI)
