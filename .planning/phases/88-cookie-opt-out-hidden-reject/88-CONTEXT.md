# Phase 88: Cookie Opt-Out Hidden Reject - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute EU news site full cookie opt-out with hidden reject button via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Find an EU news site with a complex cookie consent banner that hides the reject option
- Navigate through the cookie settings to find and click the reject/opt-out option
- PASS = all cookies rejected via the hidden opt-out path
- Same diagnostic report template
- Claude's discretion: which EU site, how to find hidden reject
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, read_page, get_dom_snapshot
- `.planning/REQUIREMENTS.md` -- DARK-02
- `.planning/ROADMAP.md` -- Phase 88 success criteria
</canonical_refs>
<code_context>
- Cookie consent banners use various patterns: CMP iframe, OneTrust, Quantcast
- Hidden reject often behind "Manage preferences" or "Cookie settings" button
- click for navigating through consent layers
</code_context>
