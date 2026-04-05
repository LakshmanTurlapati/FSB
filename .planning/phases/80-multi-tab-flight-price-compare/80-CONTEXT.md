# Phase 80: Multi-Tab Flight Price Compare - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute 5-tab flight price comparison then return to cheapest tab via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Open flight search results in 5 separate tabs (different airlines/dates)
- Extract price from each tab
- Compare prices and identify the cheapest
- Switch back to the tab with the cheapest flight
- PASS = 5 tabs opened, prices compared, returned to cheapest tab
- PARTIAL = some tabs opened but comparison incomplete
- Use open_tab, switch_tab, read_page for multi-tab workflow
- Same diagnostic report template
- Claude's discretion: which flight search site, comparison method
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- open_tab, switch_tab, list_tabs, read_page, navigate
- `.planning/REQUIREMENTS.md` -- CONTEXT-04
- `.planning/ROADMAP.md` -- Phase 80 success criteria
</canonical_refs>

<code_context>
- open_tab, switch_tab, list_tabs MCP tools for multi-tab management
- read_page for price extraction per tab
- Numeric comparison for cheapest identification
</code_context>
