# Phase 91: Adblocker Modal Bypass - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute "disable adblocker" modal bypass with no visible DOM exit button via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Document the pattern of adblocker detection modals and bypass strategies
- Target: news site with adblocker wall or document detection approach
- PASS = adblocker modal bypassed (closed or circumvented)
- Same diagnostic report template
- Claude's discretion: which site, bypass method (CSS override, JS, or element removal)
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, press_key, get_dom_snapshot
- `.planning/REQUIREMENTS.md` -- DARK-05
- `.planning/ROADMAP.md` -- Phase 91 success criteria
</canonical_refs>
<code_context>
- Adblocker modals use overlay divs with no close button
- Bypass via: removing overlay element, CSS display:none, or Escape key
- press_key for Escape, DOM manipulation for element removal
</code_context>
