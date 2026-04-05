# Phase 75: Viewport-Only Pricing Table - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute viewport-gated pricing table row extraction via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions

### Target & Workflow
- Find a SaaS pricing page with a comparison table that requires scrolling to see all rows
- Extract pricing data from rows that are only visible when scrolled into viewport
- Scroll + read_page cycles to capture all table rows
- PASS = all pricing rows extracted including ones initially below viewport
- Same diagnostic report template

### Claude's Discretion
- Which pricing page to use, extraction method, verification approach
</decisions>

<canonical_refs>
## Canonical References
- `mcp-server/src/tools/manual.ts` -- scroll, read_page, get_dom_snapshot
- `.planning/REQUIREMENTS.md` -- SCROLL-09
- `.planning/ROADMAP.md` -- Phase 75 success criteria
</canonical_refs>

<code_context>
## Existing Code Insights
- scroll + read_page for viewport-gated content extraction
- get_dom_snapshot captures only in-viewport elements (viewport priority mode)
</code_context>

<specifics>
- SaaS pricing tables often have 20+ feature rows with horizontal scrolling
- Viewport-gated means rows only render/populate when scrolled into view
</specifics>

<deferred>
None
</deferred>
