# Phase 123: Layout Modes - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

User can view the live DOM stream preview in different sizes: inline (current default), maximized (takes over dashboard), picture-in-picture (floating draggable), and fullscreen (browser fullscreen API). The preview viewport dynamically matches the actual browser viewport dimensions.

</domain>

<decisions>
## Implementation Decisions

### Maximize/minimize
- **Maximize takes over entire dashboard content area** -- preview replaces all dashboard content (stats bar, agents, etc.). Task progress bar overlays on top of the preview so user can still see automation status.
- **Minimize returns to inline** -- back to the default `min-height: 60vh` inline position below the task area
- Toggle via a maximize/minimize button in the preview header (next to the existing pause toggle)
- Implementation: add a `dash-preview-maximized` CSS class that sets `position: fixed; inset: 0; z-index: 100; min-height: 100vh; border-radius: 0;`. Task bar gets `z-index: 101` when maximized so it stays on top.

### Viewport-match resize
- **Dynamic match** -- preview container aspect ratio changes to match actual browser viewport dimensions from `ext:dom-snapshot` payload (`viewportWidth` x `viewportHeight`)
- `updatePreviewScale()` already scales to width. Container height should be set dynamically: `containerHeight = (viewportHeight / viewportWidth) * containerWidth` after snapshot arrives
- Removes the fixed `min-height: 60vh` in favor of computed height based on snapshot data

### Picture-in-picture
- **CSS position:fixed overlay** -- floating draggable preview window
- Default size: 400px wide, positioned bottom-right with 16px margin
- Draggable via mousedown/mousemove on a drag handle bar at top
- Stays on top while user scrolls dashboard
- Toggle via a PiP button in the preview header
- Implementation: `dash-preview-pip` CSS class with `position: fixed; bottom: 16px; right: 16px; width: 400px; z-index: 50; border-radius: var(--radius-lg); resize: both;`

### Fullscreen
- **Browser Fullscreen API** -- `previewContainer.requestFullscreen()`
- **Minimal overlay** -- small exit button (X) in top-right corner, fades in on mouse move, auto-hides after 2s of no movement
- Status dot stays visible in fullscreen
- Escape key exits fullscreen (browser default behavior)
- Toggle via a fullscreen button in the preview header

### Button layout in preview header
- Left side: status dot + tooltip (existing)
- Right side: PiP button | Maximize button | Fullscreen button | Pause toggle (existing)
- All buttons use same style as existing toggle (24px, rounded, backdrop-blur)
- All buttons hidden by default, visible on preview hover (existing pattern)

### Claude's Discretion
- Exact drag handle implementation for PiP (mousedown vs HTML drag API)
- Animation transitions between layout modes
- Whether to save last-used mode to localStorage
- Mobile behavior -- PiP and fullscreen may not make sense on small screens

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard preview infrastructure
- `showcase/js/dashboard.js` -- `setPreviewState()` (line 1572), `updatePreviewScale()` (line 1688), `handleDOMSnapshot()` (line 1640), preview element refs (lines 86-120)
- `showcase/css/dashboard.css` -- `.dash-preview` (line 1548), `.dash-preview-iframe` (line 1571), `.dash-preview-header` (line 1700), `.dash-preview-toggle` (line 1750), responsive breakpoints at 768px and 480px
- `showcase/dashboard.html` -- Preview container structure (lines 199-225): header, iframe, glow, progress, status overlays

### Phase 122 context
- `.planning/phases/122-connection-auto-start/122-CONTEXT.md` -- Prior decisions: stream trigger, tab scope, recovery, status badge

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.dash-preview-header` -- already has flex layout with left (status) and right (toggle) areas. Add more buttons to the right side.
- `.dash-preview-toggle` -- existing button style (24px, rounded, backdrop-blur, hidden until hover). Clone for new buttons.
- `updatePreviewScale()` -- already computes scale from container vs page dimensions. Extend to handle dynamic container sizing.
- `previewContainer`, `previewIframe` -- already referenced as JS variables.

### Established Patterns
- Preview header hidden until `.dash-preview:hover` (CSS opacity transition)
- Buttons use Font Awesome icons (`fa-solid fa-pause`)
- State managed via CSS classes added/removed in JS

### Integration Points
- `showcase/dashboard.html` -- add PiP/maximize/fullscreen buttons to `.dash-preview-header`
- `showcase/css/dashboard.css` -- add `.dash-preview-maximized`, `.dash-preview-pip`, fullscreen overlay styles
- `showcase/js/dashboard.js` -- add click handlers, fullscreen API calls, drag logic for PiP

</code_context>

<specifics>
## Specific Ideas

- Maximize should feel like the preview "takes over" -- smooth transition, task bar floating on top
- PiP should feel like a mini TV in the corner -- always visible while managing agents
- Fullscreen should feel immersive -- just the browser view, minimal chrome

</specifics>

<deferred>
## Deferred Ideas

- Resize handle on PiP window for custom sizing -- future enhancement
- Snap PiP to corners on drag release -- future enhancement
- Remember last layout mode across sessions (localStorage) -- future enhancement

</deferred>

---

*Phase: 123-layout-modes*
*Context gathered: 2026-03-29*
