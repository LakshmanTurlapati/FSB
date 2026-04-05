# Phase 96: Anti-Scrape Site Text Extraction - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute text extraction from site blocking right-clicks, disabling selection, and masking CSS classes via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Document strategies for extracting text from anti-scrape protected sites
- Target: site with right-click disabled, text selection disabled, obfuscated CSS
- PASS = text extracted despite anti-scrape protections
- Same diagnostic report template
- Claude's discretion: which site, extraction method (DOM inspection bypasses CSS protections)
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- read_page, get_dom_snapshot, get_text, select_text_range
- `.planning/REQUIREMENTS.md` -- DARK-10
- `.planning/ROADMAP.md` -- Phase 96 success criteria
</canonical_refs>
<code_context>
- read_page extracts text regardless of CSS user-select:none
- get_dom_snapshot sees DOM regardless of right-click disabling
- Content script runs in page context -- bypasses JS-based protections
- select_text_range uses Range API -- not affected by CSS selection blocking
</code_context>
