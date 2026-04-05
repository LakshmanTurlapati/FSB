# Phase 58: Click-and-Hold Record - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute 5-second click-and-hold then release on voice memo record button via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use an online voice recorder (onlinevoicerecorder.com, vocaroo.com, or similar)
- No auth required -- free voice recorder sites work without login
- May need to grant microphone permission (browser prompt)
- Dismiss any cookie/consent popups before interacting

### Test Workflow
- Navigate to online voice recorder
- Identify the record button (DOM or canvas)
- Execute mousedown on record button, hold for 5 seconds, then mouseup (release)
- Verify recording occurred (timer visible, recording indicator, or playback available)

### Pass/Fail & Diagnostics
- PASS = mousedown held for 5 seconds then released, recording captured
- PARTIAL = button clicked but hold duration not maintained or recording not captured
- FAIL = couldn't interact with record button at all
- May need a new "click_and_hold" tool or use CDP mousePressed + delay + mouseReleased sequence
- Same diagnostic report template as Phase 47-57

### Claude's Discretion
- Which voice recorder site to use
- How to implement 5-second hold (existing drag tool with same start/end? or new tool?)
- How to handle microphone permission prompts
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools
- `content/actions.js` -- Content script tools
- `background.js` -- CDP handlers (mousePressed/mouseReleased available)

### Prior art
- `.planning/phases/49-google-maps-path-tracing/49-DIAGNOSTIC.md` -- CDP mouse event patterns

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-02 requirement
- `.planning/ROADMAP.md` -- Phase 58 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP mousePressed + mouseReleased (but no delay between)
- `drag` MCP tool: CDP mousePressed -> mouseMoved -> mouseReleased (has delay but moves cursor)
- May need to add a `click_and_hold` tool: CDP mousePressed, wait N ms, mouseReleased at same coordinates
- `navigate`, `read_page`, `get_dom_snapshot`, `press_key`

### Established Patterns
- CDP Input.dispatchMouseEvent with type: 'mousePressed' and 'mouseReleased'
- The drag tool already does pressed -> delay -> released but moves between points
- A click_and_hold at same coordinates = drag with startX==endX, startY==endY

### Integration Points
- New tool (if needed) in manual.ts + actions.js + background.js
- New site guide in `site-guides/media/` or `site-guides/utilities/`

</code_context>

<specifics>
## Specific Ideas

- Could use existing drag tool with same start/end coordinates and long stepDelay to simulate click-and-hold
- drag(x, y, x, y, steps=1, stepDelayMs=5000) would press at (x,y), wait 5s, release at (x,y)
- Alternative: add a dedicated click_and_hold(x, y, holdMs) tool for cleaner semantics
- Online voice recorders typically have a large circular record button in the center

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 58-click-and-hold-record*
*Context gathered: 2026-03-21*
