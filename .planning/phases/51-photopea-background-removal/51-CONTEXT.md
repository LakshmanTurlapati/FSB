# Phase 51: Photopea Background Removal - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Photopea image upload and magic wand background removal via MCP manual tools. Fix any canvas interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Photopea (photopea.com) -- free, no auth needed, Photoshop-like web editor
- Dismiss any splash/welcome dialogs before interacting with the canvas
- Use Photopea's built-in sample/demo image or navigate to a simple test image URL

### Test Workflow
- Open a sample image in Photopea
- Select Magic Wand tool from the toolbar (keyboard shortcut W or click toolbar icon)
- Click on the background area of the image with magic wand to select it
- Press Delete key to remove the background (checkerboard pattern should appear)

### Pass/Fail & Diagnostics
- PASS = magic wand selected background area + Delete key pressed (checkerboard visible or selection made)
- PARTIAL = Photopea loaded and tools accessible but selection or deletion failed
- FAIL = couldn't interact with Photopea canvas at all
- Reuse click_at for canvas tool selection + wand click, press_key for Delete
- Same diagnostic report template as Phase 47-50

### Claude's Discretion
- Which sample image to use (Photopea default or external URL)
- Exact magic wand tolerance settings
- Whether to use keyboard shortcut (W) or toolbar click for tool selection
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
- `.planning/phases/48-figma-frame-alignment/48-CONTEXT.md` -- Excalidraw canvas interaction (similar editor pattern)
- `.planning/phases/49-google-maps-path-tracing/49-DIAGNOSTIC.md` -- Recent diagnostic template

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-05 requirement definition
- `.planning/ROADMAP.md` -- Phase 51 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates -- works through canvas and iframe
- `drag` MCP tool: CDP drag sequence -- confirmed on canvas apps
- `scroll_at` MCP tool: CDP mouseWheel (added Phase 49, needs server restart)
- `press_key` MCP tool: Keyboard shortcuts (added Phase 48)
- `navigate`, `read_page`, `get_dom_snapshot` for page interaction

### Established Patterns
- Site guides: module.exports with selectors + workflows + toolPreferences
- Diagnostic reports: Metadata, Prompt, Result Summary, Step-by-Step Log, What Worked/Failed, Tool Gaps, Recommendations
- Canvas apps require CDP tools (click_at, drag) -- DOM clicks don't work on canvas elements

### Integration Points
- New site guide goes in `site-guides/design/photopea.js`
- Register in background.js importScripts

</code_context>

<specifics>
## Specific Ideas

- Photopea is a Photoshop clone that renders on HTML5 canvas -- similar to Excalidraw from Phase 48
- Magic Wand tool is activated by pressing W key or clicking the toolbar icon
- Background removal is a common Photopea workflow: Magic Wand -> click background -> Delete
- Photopea supports keyboard shortcuts similar to Photoshop (W for wand, Delete for clear)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 51-photopea-background-removal*
*Context gathered: 2026-03-20*
