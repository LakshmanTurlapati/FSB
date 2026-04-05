# Phase 76: News Site Date-Stop Scroll - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute infinite-scroll news site scroll stopping at yesterday's articles via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions

### Target & Workflow
- Use a news site with infinite scroll and date-stamped articles (CNN, BBC, or similar)
- Scroll through articles checking dates until reaching yesterday's articles
- Stop scrolling when articles from yesterday are found
- PASS = scrolled to yesterday's articles and stopped, extracted article info
- Same diagnostic report template

### Claude's Discretion
- Which news site, how to detect article dates, stopping criteria
</decisions>

<canonical_refs>
## Canonical References
- `mcp-server/src/tools/manual.ts` -- scroll, read_page, get_dom_snapshot
- `.planning/REQUIREMENTS.md` -- SCROLL-10
- `.planning/ROADMAP.md` -- Phase 76 success criteria
</canonical_refs>

<code_context>
## Existing Code Insights
- scroll + read_page for date detection during infinite scroll
- Similar to Phase 69 (dashboard date search) but on news content
</code_context>

<specifics>
- News sites use relative ("2 hours ago") or absolute dates
- date/time elements with datetime attributes for parsing
</specifics>

<deferred>
None
</deferred>
