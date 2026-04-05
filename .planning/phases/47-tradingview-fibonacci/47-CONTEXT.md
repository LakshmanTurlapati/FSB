# Phase 47: TradingView Fibonacci - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute TradingView Fibonacci retracement drawing via MCP manual tools. Fix any canvas interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Canvas interaction strategy
- Analyze first, build specific: navigate to TradingView, inspect what DOM/canvas events fire during Fibonacci drawing
- Reverse-engineer the event sequence TradingView uses (mousedown/mousemove/mouseup, pointer events, or custom chart library events)
- Build new MCP manual tools based on discovered event patterns, not generic guesses
- New tools go in mcp-server/src/tools/manual.ts as reusable MCP tools (not one-off scripts)
- Content script helpers added to content/actions.js, then exposed via MCP bridge

### Test site & auth
- Use free TradingView (tradingview.com/chart) without login -- drawing tools available on free tier
- Dismiss any sign-up prompts if they appear
- If TradingView blocks drawing tools with persistent auth modals, fall back to an alternative free charting site
- Document any auth blockers encountered in the diagnostic report

### Pass/fail criteria
- Pass = Fibonacci retracement lines visibly drawn on the chart between two price points
- Partial = drawing tool selected but drawing failed (events not working on canvas)
- Fail = couldn't interact with canvas at all
- Structured autopilot diagnostic report required with standardized sections (reusable template for all 50 phases)

### Bug fix scope
- Fix what this phase needs: add specific MCP tools for canvas coordinate interaction (click_at, drag, etc.) based on analysis findings
- Don't over-engineer for future phases -- each CANVAS phase adds what it needs
- Update site-guides/finance/tradingview.js with discovered drawing tool workflows, canvas selectors, and event patterns

### Claude's Discretion
- Exact event types to dispatch (mouse vs pointer vs custom) -- determined by analysis
- How to identify price coordinates on the canvas for Fibonacci placement
- Diagnostic report template structure (will become reusable across all 50 phases)
- Whether to add a dedicated "canvas interaction" module or extend existing actions.js

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP tools (where new tools get added)
- `mcp-server/src/tools/manual.ts` -- All 25 manual browser action tools; new canvas tools go here
- `mcp-server/src/bridge.ts` -- WebSocket bridge for sending actions to extension
- `mcp-server/src/queue.ts` -- TaskQueue for mutation serialization

### Content script actions (canvas event dispatch)
- `content/actions.js` -- Contains existing moveMouse(x,y) with coordinate dispatch, all 25+ browser action functions, coordinate fallback utilities
- `content/messaging.js` -- Message handler that routes MCP actions to content script tools

### TradingView site guide
- `site-guides/finance/tradingview.js` -- Current TradingView guide (warns about canvas limitations, has selectors for search/price/chart)

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-01 requirement definition
- `.planning/ROADMAP.md` -- Phase 47 success criteria (attempted + bugs fixed + diagnostic report)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/actions.js:moveMouse(x, y)`: Already dispatches mouseover/mousemove at coordinates -- can be extended for canvas interactions
- `content/actions.js:validateCoordinates(x, y)`: Checks if coordinates point to a clickable element via elementFromPoint
- `content/actions.js:scrollToDocumentCoordinates()`: Converts document coords to viewport coords
- `execAction()` helper in manual.ts: Standard pattern for adding new MCP tools (check bridge, enqueue, send verb, map result)

### Established Patterns
- MCP tools follow: `server.tool(name, description, zodSchema, async handler)` pattern
- All actions funnel through `execAction(bridge, queue, toolName, fsbVerb, params)`
- Content script tools are functions on the `tools` object in actions.js
- Message routing: MCP -> WebSocket bridge -> background.js -> content script messaging -> actions.js

### Integration Points
- New MCP tools register in `registerManualTools()` in manual.ts
- New content script tools add to the `tools` object in actions.js
- Message handler in messaging.js routes `mcp:execute-action` payloads to content script tools

</code_context>

<specifics>
## Specific Ideas

- "It's a web app and it has code. We have to find a way to analyze this drag and drop thing -- once we do that we know exactly what's happening and what to do."
- Approach: treat canvas interactions as event sequences that can be replayed, not visual/pixel operations
- The key insight is that even canvas-based apps respond to standard DOM events -- the question is WHICH events and with WHAT parameters

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 47-tradingview-fibonacci*
*Context gathered: 2026-03-19*
