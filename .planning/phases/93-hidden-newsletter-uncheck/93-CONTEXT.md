# Phase 93: Hidden Newsletter Uncheck - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute hidden pre-checked newsletter subscription uncheck before form submit via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Document the pattern of pre-checked newsletter checkboxes hidden in forms
- Target: e-commerce checkout or registration form with hidden newsletter opt-in
- PASS = hidden checkbox found and unchecked before form submission
- Same diagnostic report template
- Claude's discretion: which site, how to detect hidden pre-checked checkboxes
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- check_box, click, get_dom_snapshot, get_attribute, scroll
- `.planning/REQUIREMENTS.md` -- DARK-07
- `.planning/ROADMAP.md` -- Phase 93 success criteria
</canonical_refs>
<code_context>
- check_box MCP tool for toggling checkboxes
- get_dom_snapshot to find all input[type=checkbox] with checked attribute
- Scroll to find checkboxes below the fold
</code_context>
