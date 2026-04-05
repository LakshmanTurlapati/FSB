# Phase 87: Freeware Download Ad Avoidance - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute freeware site real download while ignoring fake "Download Now" ad buttons via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Find a freeware download site with fake download ads (SourceForge, Softonic, or similar)
- Identify the real download link vs fake ad download buttons
- Click only the real download link
- PASS = real download link identified and clicked, fake ads ignored
- Same diagnostic report template
- Claude's discretion: which site, how to distinguish real vs fake links
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, read_page, get_dom_snapshot, get_attribute
- `.planning/REQUIREMENTS.md` -- DARK-01
- `.planning/ROADMAP.md` -- Phase 87 success criteria
</canonical_refs>
<code_context>
- get_dom_snapshot for analyzing link attributes (href, data-*, ad indicators)
- get_attribute for checking link destinations before clicking
- Ad detection via class names, iframe sources, sponsored indicators
</code_context>
