# Phase 125: Remote Control - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

User can interact with the real browser by clicking, typing, and scrolling directly in the dashboard preview. A toggle button switches between view-only and interactive mode. All input is forwarded via WebSocket to the extension, which dispatches events via Chrome DevTools Protocol (CDP) on the real browser tab. CONTROL-04 (stop button) is already implemented by Phase 122.2 -- not in scope here.

</domain>

<decisions>
## Implementation Decisions

### Click forwarding (CONTROL-01)
- **D-01:** CDP dispatch -- capture click events on the preview iframe overlay, reverse-scale coordinates using `previewScale` (realX = clickX / previewScale, realY = clickY / previewScale), send as `dash:remote-click` WS message, extension dispatches via CDP `Input.dispatchMouseEvent` (mousePressed + mouseReleased) on the real browser tab.
- **D-02:** Use existing `cdpClickAt` infrastructure in background.js (line 12459) -- same pattern: `chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })`.
- **D-03:** Clicks are captured on a transparent overlay div on top of the preview iframe, not directly on the iframe content (avoids cross-origin issues).

### Text input forwarding (CONTROL-02)
- **D-04:** CDP key events -- capture keydown/keyup events on the dashboard (when remote control mode is active), forward as `dash:remote-key` WS message, extension dispatches via CDP `Input.dispatchKeyEvent` on the real browser tab.
- **D-05:** Use existing CDP key dispatch pattern from background.js (lines 12085-12119) -- `Input.dispatchKeyEvent` with type: keyDown/keyUp, text, key, code fields.
- **D-06:** User must first click an element in the preview (which triggers a CDP click on the real browser, focusing the element) before typing. No separate focus-forwarding needed.

### Scroll forwarding (CONTROL-03)
- **D-07:** Wheel events via CDP -- capture wheel/mousewheel events on the preview overlay, forward as `dash:remote-scroll` WS message with deltaX/deltaY, extension dispatches via CDP `Input.dispatchMouseEvent` with type: `mouseWheel` and deltaX/deltaY.
- **D-08:** Coordinates for scroll events use the same reverse-scale mapping as clicks.

### Interaction mode toggle
- **D-09:** Toggle button in the preview header -- "Remote Control" button alongside existing maximize/PiP buttons. Uses the shared `.dash-preview-btn` class from Phase 123.
- **D-10:** When ON: transparent overlay div gets `pointer-events: auto`, cursor changes to crosshair, all click/key/scroll events are captured and forwarded.
- **D-11:** When OFF: overlay goes back to `pointer-events: none`, cursor returns to default. Current view-only behavior.
- **D-12:** Remote control mode requires an active stream. If stream is not running, the toggle button is disabled/grayed.

### Claude's Discretion
- Whether to show a cursor indicator on the preview (small dot/crosshair at the last clicked position)
- Debounce interval for scroll forwarding (every frame vs throttled)
- Whether to forward modifier keys (Ctrl, Alt, Shift) with click/key events
- Visual feedback when remote control mode is active (e.g., blue border on preview vs orange automation border)
- Whether to forward right-click / double-click events or just left-click

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CDP event dispatch
- `background.js` lines 12459-12471 -- `cdpClickAt`: `Input.dispatchMouseEvent` mousePressed/mouseReleased pattern with modifier support
- `background.js` lines 12085-12119 -- CDP key dispatch: `Input.dispatchKeyEvent` keyDown/keyUp/char with text, key, code fields
- `background.js` lines 12523-12540 -- `cdpScrollAt`: `Input.dispatchMouseEvent` mouseWheel with deltaX/deltaY

### Preview scaling
- `showcase/js/dashboard.js` line 53 -- `previewScale` variable (float, e.g., 0.5 means preview is half size)
- `showcase/js/dashboard.js` line 1732 -- `updatePreviewScale()`: calculates scale from container width / page width
- `showcase/js/dashboard.js` line 1755 -- `previewScale = containerWidth / pageWidth`

### WS message protocol
- `ws/ws-client.js` lines 247-270 -- `_handleMessage` switch for `dash:*` messages
- `background.js` lines 5833-5851 -- DOM stream message forwarding
- Pattern: `{ type: 'dash:remote-*', payload: { x, y, ... }, ts: Date.now() }`

### Preview UI
- `showcase/js/dashboard.js` -- `.dash-preview-btn` class from Phase 123 for header buttons
- `showcase/dashboard.html` -- Preview container with iframe, glow overlay, status elements
- `showcase/css/dashboard.css` -- Preview styles including `.dash-preview-btn`

### Prior phase context
- `.planning/phases/122-connection-auto-start/122-CONTEXT.md` -- WS protocol, tab tracking
- `.planning/phases/123-layout-modes/123-CONTEXT.md` -- Preview header buttons pattern
- `.planning/phases/122.2-stop-signal-fix/122.2-CONTEXT.md` -- Stop button (CONTROL-04 done)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cdpClickAt` in background.js: Already dispatches CDP mouse events with coordinates and modifiers -- reuse for remote clicks
- `cdpScrollAt` in background.js: Already dispatches CDP wheel events with deltaX/deltaY -- reuse for remote scroll
- CDP key dispatch pattern: Already handles keyDown/keyUp/char with text/key/code -- reuse for remote typing
- `previewScale` variable in dashboard.js: Already calculated and maintained -- use for coordinate reverse-mapping
- `.dash-preview-btn` CSS class: Shared button style for preview header -- use for toggle button

### Established Patterns
- WS messages: `{ type: 'dash:*', payload: {...}, ts: Date.now() }` for dashboard-to-extension
- `_dashboardTaskTabId` in background.js: Tracks which tab is the dashboard task target -- reuse for remote control target
- Chrome debugger: Already attached for CDP tools during automation -- need to attach/keep attached for remote control mode

### Key Considerations
- Chrome debugger attachment: CDP requires `chrome.debugger.attach({ tabId })`. During automation, the debugger is already attached. For remote control outside automation, need to handle attach/detach lifecycle.
- Preview iframe is sandboxed: Can't directly capture events inside the iframe content. Need a transparent overlay div on top.
- Event coordinate mapping: dashboard click coordinates -> divide by previewScale -> real browser coordinates. Account for iframe scroll position in the preview.

</code_context>

<specifics>
## Specific Ideas

- Remote control should feel like VNC/screen sharing -- click where you see, type what you want
- The toggle should be prominent but not intrusive -- a button in the preview header is the right level
- CDP approach means it works on any site regardless of CSP or JS framework
- Scroll should feel natural -- 1:1 mapping of wheel delta, not position syncing

</specifics>

<deferred>
## Deferred Ideas

- Touch event forwarding (for mobile viewport simulation) -- future capability
- Drag and drop forwarding (mousedown + mousemove + mouseup sequence) -- complex, future
- File input forwarding (clicking file inputs and selecting files) -- requires separate mechanism
- Multi-cursor collaboration (multiple dashboard users controlling same browser) -- future

</deferred>

---

*Phase: 125-remote-control*
*Context gathered: 2026-03-30*
