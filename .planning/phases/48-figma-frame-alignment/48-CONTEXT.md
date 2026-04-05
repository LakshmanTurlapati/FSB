# Phase 48: Figma Frame Alignment - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Figma-like editor frame creation and rectangle alignment via MCP manual tools. Use Excalidraw (free, no auth) as the target app. Fix any canvas interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target app
- Use Excalidraw (excalidraw.com) -- fully free, no auth required
- No fallback to other editors -- if Excalidraw fails, document the failure
- Create site guide at site-guides/design/excalidraw.js with discovered selectors and workflows

### Test workflow
- Full workflow: create a frame, draw 3 shapes inside it, align all 3 using toolbar alignment buttons
- Alignment via Excalidraw's toolbar align buttons (align-left, center, distribute), not manual drag-to-snap
- Multi-select shapes before alignment (likely shift+click or drag-select)

### Pass/fail criteria
- PASS = frame created + 3 shapes drawn + alignment applied via toolbar buttons
- PARTIAL = some steps worked (e.g., shapes drawn but alignment or frame creation failed)
- FAIL = couldn't draw on canvas at all
- Structured autopilot diagnostic report required (same template as Phase 47)

### Tool strategy
- Start with existing tools: click_at, drag, click, type from Phase 47
- Add new tools only if Excalidraw requires capabilities those can't handle
- Any new tools should be generalized/reusable (e.g., press_key for keyboard shortcuts, shift_click for multi-select), not Excalidraw-specific
- New tools go in manual.ts + content/actions.js following established patterns

### Claude's Discretion
- How to select the rectangle/frame tools in Excalidraw (keyboard shortcut vs toolbar click)
- Exact canvas coordinates for shape placement
- How to multi-select shapes (shift+click vs drag-select box)
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP tools (where new tools get added)
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools including click_at and drag from Phase 47
- `content/actions.js` -- Content script tools including cdpClickAt and cdpDrag from Phase 47
- `background.js` -- CDP mouse handlers including handleCDPMouseDrag

### Phase 47 artifacts (prior art)
- `.planning/phases/47-tradingview-fibonacci/47-CONTEXT.md` -- Canvas interaction strategy decisions
- `.planning/phases/47-tradingview-fibonacci/47-DIAGNOSTIC.md` -- Diagnostic report template (PASS outcome)
- `site-guides/finance/tradingview.js` -- Example site guide with canvas workflow

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-02 requirement definition
- `.planning/ROADMAP.md` -- Phase 48 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates -- proven on TradingView canvas
- `drag` MCP tool: CDP mousePressed -> mouseMoved -> mouseReleased sequence -- available but TradingView used click-click not drag
- `cdpClickAt` / `cdpDrag` content script relays in actions.js
- `handleCDPMouseDrag` in background.js -- CDP drag handler with interpolation and delays
- `execAction()` helper in manual.ts for registering new MCP tools

### Established Patterns
- MCP tools: `server.tool(name, description, zodSchema, async handler)` pattern
- Actions funnel through `execAction(bridge, queue, toolName, fsbVerb, params)`
- Site guides: module.exports with selectors object + workflows object + toolPreferences
- Diagnostic reports: Metadata, Prompt, Result Summary, Step-by-Step Log, What Worked/Failed, Tool Gaps, Recommendations

### Integration Points
- New MCP tools register in `registerManualTools()` in manual.ts
- New content script tools add to the `tools` object in actions.js
- New site guide goes in `site-guides/design/excalidraw.js`

</code_context>

<specifics>
## Specific Ideas

- Excalidraw uses keyboard shortcuts for tool selection (R = rectangle, F = frame) -- may be faster than clicking toolbar
- Phase 47 confirmed click-click pattern works on canvas -- Excalidraw may use similar pattern or may require drag
- Alignment toolbar appears after multi-selecting shapes -- need to discover the multi-select mechanism first

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 48-figma-frame-alignment*
*Context gathered: 2026-03-19*
