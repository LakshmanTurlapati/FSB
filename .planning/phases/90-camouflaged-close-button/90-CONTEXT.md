# Phase 90: Camouflaged Close Button - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute pop-up ad close where X is camouflaged against the background via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Document the pattern of camouflaged close buttons on pop-up ads
- Target: demo site with hidden close buttons or document detection strategy
- PASS = close button found and clicked despite visual camouflage
- Same diagnostic report template
- Claude's discretion: which demo, how to find camouflaged X button
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, get_dom_snapshot, get_attribute, click_at
- `.planning/REQUIREMENTS.md` -- DARK-04
- `.planning/ROADMAP.md` -- Phase 90 success criteria
</canonical_refs>
<code_context>
- DOM inspection reveals close buttons even when visually hidden
- aria-label="Close", role="button" with small dimensions
- Opacity/color matching background -- invisible visually but present in DOM
</code_context>
