# Phase 49: Google Maps Path Tracing - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Google Maps zoom and walking path trace around Central Park reservoir via MCP manual tools. Fix any canvas interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Navigation
- Use google.com/maps -- free, no auth needed
- Search "Central Park Reservoir NYC" in Maps search bar to navigate
- Dismiss any consent/cookie popups or overlays before interacting with map
- Zoom to street level where walking path is visible around the reservoir

### Test Workflow
- Path tracing = click-drag sequence tracing the walking path around the reservoir perimeter
- 4-6 drag segments forming rough outline around reservoir
- Verify zoom worked by checking zoom level indicator or map scale change after zoom action
- Use mouse scroll simulation via CDP at map center for zooming

### Pass/Fail & Diagnostics
- PASS = map zoomed to reservoir level + at least 3 drag movements tracing the path
- PARTIAL = zoom works but drag/path trace fails OR only 1-2 segments traced
- FAIL = couldn't interact with map canvas at all
- Reuse click_at + drag from Phase 47-48, add scroll_at if needed for map zoom
- Same diagnostic report template as Phase 47-48

### Claude's Discretion
- Exact coordinates for drag start/end points around the reservoir
- Number of scroll events needed to reach appropriate zoom level
- Whether scroll_at tool needs to be added or existing scroll tool suffices
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP tools (where new tools get added)
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools including click_at and drag from Phase 47
- `content/actions.js` -- Content script tools including cdpClickAt and cdpDrag from Phase 47
- `background.js` -- CDP mouse handlers including handleCDPMouseDrag

### Phase 47-48 artifacts (prior art)
- `.planning/phases/47-tradingview-fibonacci/47-CONTEXT.md` -- Canvas interaction strategy decisions
- `.planning/phases/47-tradingview-fibonacci/47-DIAGNOSTIC.md` -- Diagnostic report template (PASS outcome)
- `.planning/phases/48-figma-frame-alignment/48-CONTEXT.md` -- Excalidraw canvas decisions
- `site-guides/finance/tradingview.js` -- Example site guide with canvas workflow

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-03 requirement definition
- `.planning/ROADMAP.md` -- Phase 49 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates -- proven on TradingView and Excalidraw
- `drag` MCP tool: CDP mousePressed -> mouseMoved -> mouseReleased sequence with modifier support
- `scroll` MCP tool: Existing scroll capability (may need scroll_at variant for coordinate-targeted scrolling)
- `press_key` MCP tool: Keyboard shortcuts added in Phase 48
- `cdpClickAt` / `cdpDrag` content script relays in actions.js

### Established Patterns
- MCP tools: `server.tool(name, description, zodSchema, async handler)` pattern
- Actions funnel through `execAction(bridge, queue, toolName, fsbVerb, params)`
- Site guides: module.exports with selectors object + workflows object + toolPreferences
- Diagnostic reports: Metadata, Prompt, Result Summary, Step-by-Step Log, What Worked/Failed, Tool Gaps, Recommendations

### Integration Points
- New MCP tools register in `registerManualTools()` in manual.ts
- New content script tools add to the `tools` object in actions.js
- New site guide goes in `site-guides/maps/google-maps.js`

</code_context>

<specifics>
## Specific Ideas

- Google Maps uses canvas-based rendering similar to TradingView -- CDP mouse events should work for drag interactions
- Map scroll/zoom typically uses wheel events -- may need to dispatch WheelEvent via CDP Input.dispatchMouseEvent with type "mouseWheel"
- Central Park reservoir has a clear oval walking path that makes a good visual target for tracing

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 49-google-maps-path-tracing*
*Context gathered: 2026-03-20*
