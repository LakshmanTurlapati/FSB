# Phase 52: 3D Product Viewer Rotation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute 3D retail shoe viewer 180-degree rotation via MCP manual tools. Fix any canvas/WebGL interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use a retail 3D product viewer (Nike.com, Adidas.com, or similar shoe product page with 3D view)
- Fallback: use a free 3D model viewer like sketchfab.com if retail sites block automation
- No auth required -- product pages are publicly accessible
- Dismiss any cookie/consent popups before interacting with 3D viewer

### Test Workflow
- Navigate to a shoe product page with 3D viewer
- Activate 3D view mode (click "3D View" or "360" button if needed)
- Drag horizontally across the 3D viewer to rotate the shoe 180 degrees
- Verify rotation occurred (viewer shows different angle of the shoe)

### Pass/Fail & Diagnostics
- PASS = 3D viewer activated + drag rotated the shoe approximately 180 degrees (back view visible)
- PARTIAL = 3D viewer loaded but rotation failed or was incomplete
- FAIL = couldn't activate 3D viewer or interact with the canvas at all
- Reuse drag for rotation (horizontal drag = horizontal rotation), click_at for activating 3D mode
- Same diagnostic report template as Phase 47-51

### Claude's Discretion
- Which specific product page and shoe to use
- Exact drag distance and direction for 180-degree rotation
- Whether to use sketchfab.com as alternative if retail sites are problematic
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP tools
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools
- `content/actions.js` -- Content script tools
- `background.js` -- CDP mouse handlers

### Prior art
- `.planning/phases/49-google-maps-path-tracing/49-DIAGNOSTIC.md` -- Google Maps drag interaction
- `.planning/phases/51-photopea-background-removal/51-DIAGNOSTIC.md` -- Canvas-rendered app patterns

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-06 requirement definition
- `.planning/ROADMAP.md` -- Phase 52 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates
- `drag` MCP tool: CDP drag sequence -- confirmed on canvas apps (Maps, Solitaire)
- `press_key`, `navigate`, `read_page`, `get_dom_snapshot`

### Established Patterns
- 3D viewers typically use WebGL canvas -- require CDP drag for rotation
- Horizontal drag = horizontal rotation, vertical drag = vertical tilt
- Site guides with selectors + workflows + toolPreferences

### Integration Points
- New site guide goes in `site-guides/shopping/` or `site-guides/3d/`
- Register in background.js importScripts

</code_context>

<specifics>
## Specific Ideas

- 3D product viewers use WebGL/Three.js for rendering -- drag events control camera orbit
- A full 360 drag across the viewer width typically rotates ~360 degrees, so half-width = ~180 degrees
- Nike/Adidas often use embedded 3D viewers that respond to mouse drag events on the canvas

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 52-3d-product-viewer-rotation*
*Context gathered: 2026-03-20*
