# Phase 50: Browser Solitaire - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute browser solitaire card move to target via MCP manual tools. Fix any canvas interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Google Solitaire (search "solitaire" on Google) -- free, no auth, built-in browser game
- Navigate to google.com, search "solitaire", click "Play" on the game card
- Dismiss any cookie or promo overlays before game interaction

### Test Workflow
- Card move = drag a card from one pile to a valid target pile (e.g., tableau to foundation)
- Attempt 2-3 valid card moves to demonstrate capability
- Identify cards and targets via DOM inspection -- Google Solitaire likely uses DOM elements not canvas
- Try DOM click first, fall back to cdpDrag if canvas-based

### Pass/Fail & Diagnostics
- PASS = at least 1 successful card move from tableau to foundation or between tableau piles
- PARTIAL = game launched and cards visible but move failed
- FAIL = couldn't launch or interact with the solitaire game at all
- Reuse click_at + drag from prior phases, add double_click if needed for card flip
- Same diagnostic report template as Phase 47-49

### Claude's Discretion
- Exact card selection strategy (which card to move first based on game state)
- Whether Google Solitaire uses DOM elements or canvas rendering
- How to detect valid move targets
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP tools (where new tools get added)
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools including click_at, drag, scroll_at
- `content/actions.js` -- Content script tools including cdpClickAt, cdpDrag, cdpScrollAt
- `background.js` -- CDP mouse handlers

### Phase 47-49 artifacts (prior art)
- `.planning/phases/47-tradingview-fibonacci/47-DIAGNOSTIC.md` -- Diagnostic report template (PASS outcome)
- `.planning/phases/49-google-maps-path-tracing/49-DIAGNOSTIC.md` -- Most recent diagnostic (PARTIAL outcome with live test data)

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-04 requirement definition
- `.planning/ROADMAP.md` -- Phase 50 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates
- `drag` MCP tool: CDP mousePressed -> mouseMoved -> mouseReleased with modifier support
- `scroll_at` MCP tool: CDP mouseWheel at viewport coordinates (added Phase 49)
- `double_click` MCP tool: Double-click on DOM elements
- `press_key` MCP tool: Keyboard shortcuts
- `read_page` / `get_dom_snapshot` for identifying card elements

### Established Patterns
- MCP tools: `server.tool(name, description, zodSchema, async handler)` pattern
- Site guides: module.exports with selectors object + workflows object + toolPreferences
- Diagnostic reports: Metadata, Prompt, Result Summary, Step-by-Step Log, What Worked/Failed, Tool Gaps, Recommendations

### Integration Points
- New site guide goes in `site-guides/games/google-solitaire.js`
- New MCP tools register in `registerManualTools()` in manual.ts if needed

</code_context>

<specifics>
## Specific Ideas

- Google Solitaire may use DOM elements (divs with background images for cards) rather than canvas -- making DOM-based click/drag possible
- Card games typically involve drag-and-drop or click-to-select-then-click-target patterns
- If canvas-based, coordinates of card positions can be computed from the game layout grid

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 50-browser-solitaire*
*Context gathered: 2026-03-20*
