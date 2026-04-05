# Phase 79: 50-Page PDF Form Fill - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute 50-page PDF read then web form fill from pages 4, 17, 42 via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Use a web-based PDF viewer (pdf.js) to read a multi-page document
- Extract specific data from pages 4, 17, and 42
- Fill a web form with the extracted data
- PASS = data extracted from 3 specific pages + web form filled with that data
- PARTIAL = some pages read or form partially filled
- Same diagnostic report template
- Claude's discretion: which PDF, which form, extraction strategy
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- scroll, read_page, click, type_text, navigate
- `.planning/REQUIREMENTS.md` -- CONTEXT-03
- `.planning/ROADMAP.md` -- Phase 79 success criteria
</canonical_refs>

<code_context>
- Phase 71 pdf-viewer.js site guide for PDF navigation patterns
- read_page + type_text for extraction and form filling
- Page navigation via page number input (from Phase 71)
</code_context>
