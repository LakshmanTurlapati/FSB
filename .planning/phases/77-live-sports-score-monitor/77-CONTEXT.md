# Phase 77: Live Sports Score Monitor - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute 30-minute live sports ticker monitoring with score change logging via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions

### Target & Workflow
- Use a live sports score site (ESPN, NBA.com, or sports ticker)
- Monitor scores over time by periodically reading page content
- Log score changes as they occur
- PASS = detected and logged at least one score change during monitoring
- PARTIAL = monitoring worked but no score changes occurred (no live games)
- Same diagnostic report template

### Claude's Discretion
- Which sports score site, monitoring interval, how to detect score changes
</decisions>

<canonical_refs>
## Canonical References
- `mcp-server/src/tools/manual.ts` -- read_page, get_dom_snapshot, navigate
- `.planning/REQUIREMENTS.md` -- LONG-01
- `.planning/ROADMAP.md` -- Phase 77 success criteria
</canonical_refs>

<code_context>
## Existing Code Insights
- read_page for periodic score extraction
- Comparison between reads detects changes
- No new tools needed -- polling with read_page
</code_context>

<specifics>
- Live scores update via WebSocket/AJAX -- DOM changes without page reload
- Polling every 30-60 seconds to detect score updates
- ESPN scoreboard has structured score elements
</specifics>

<deferred>
None
</deferred>
