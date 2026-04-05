# Phase 85: CRM vs HR Portal Cross-Reference - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute 50-employee name cross-reference between web CRM and HR portal via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Use demo CRM and HR portal sites (or public employee directories)
- Extract employee names from CRM, then cross-reference in HR portal
- PASS = names extracted from both systems and cross-referenced
- skip-auth = CRM/HR sites require login
- Same diagnostic report template
- Claude's discretion: which demo CRM/HR, cross-reference method
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- read_page, scroll, click, open_tab, switch_tab, navigate
- `.planning/REQUIREMENTS.md` -- CONTEXT-09
- `.planning/ROADMAP.md` -- Phase 85 success criteria
</canonical_refs>

<code_context>
- Multi-tab workflow for cross-referencing (from Phase 80)
- read_page for data extraction from both systems
- Pagination/scrolling for large employee lists
</code_context>
