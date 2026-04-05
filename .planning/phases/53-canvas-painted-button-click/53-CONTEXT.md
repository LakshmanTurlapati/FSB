# Phase 53: Canvas-Painted Button Click - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute canvas-pixel button click in browser game via MCP manual tools. Fix any canvas interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Find a browser game with canvas-rendered buttons (e.g., HTML5 game on itch.io, or a simple browser game)
- No auth required -- use publicly accessible free browser games
- Dismiss any cookie/consent popups or game loading screens before interaction

### Test Workflow
- Navigate to a browser game with canvas-rendered UI buttons (Play, Start, Menu)
- Identify the approximate pixel coordinates of a canvas-painted button
- Use click_at to click the button at its pixel coordinates
- Verify the button click registered (game state changed -- menu progressed, game started)

### Pass/Fail & Diagnostics
- PASS = click_at successfully clicked a canvas-painted button and triggered a game state change
- PARTIAL = game loaded but button click didn't register or wrong location clicked
- FAIL = couldn't load the game or interact with canvas at all
- Reuse click_at for pixel-based button clicking
- Same diagnostic report template as Phase 47-52

### Claude's Discretion
- Which specific browser game to use
- How to determine exact pixel coordinates of canvas buttons
- Whether to use visual inspection or DOM analysis for button location
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
- `.planning/phases/51-photopea-background-removal/51-DIAGNOSTIC.md` -- Canvas-rendered app (Photopea)
- `.planning/phases/52-3d-product-viewer-rotation/52-DIAGNOSTIC.md` -- WebGL canvas interaction

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-07 requirement definition
- `.planning/ROADMAP.md` -- Phase 53 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates -- works through canvas and iframe
- `drag` MCP tool: CDP drag sequence
- `press_key`, `navigate`, `read_page`, `get_dom_snapshot`

### Established Patterns
- Canvas-rendered apps require CDP click_at at pixel coordinates
- DOM selectors cannot target canvas-painted elements
- Game state changes visible in DOM (score updates) or URL changes

### Integration Points
- New site guide goes in `site-guides/games/`
- Register in background.js importScripts

</code_context>

<specifics>
## Specific Ideas

- HTML5 browser games on itch.io often render entire UI on canvas -- perfect test case
- Canvas buttons typically have fixed positions relative to the game viewport
- Some games use DOM overlays for menus but canvas for gameplay -- need to test a fully canvas-rendered game

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 53-canvas-painted-button-click*
*Context gathered: 2026-03-21*
