# Phase 83: 2FA Multi-Tab Auth Flow - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute 2FA flow with new tab email code fetch and return to complete login via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Document the 2FA multi-tab workflow pattern (open email tab, get code, switch back, enter code)
- Target: demo 2FA site or skip-auth if no suitable demo exists
- PASS = 2FA code fetched from email tab + entered in auth tab + login completed
- skip-auth = no demo 2FA site available for testing
- Same diagnostic report template
- Claude's discretion: which 2FA demo, email provider simulation
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- open_tab, switch_tab, list_tabs, read_page, type_text, click
- `.planning/REQUIREMENTS.md` -- CONTEXT-07
- `.planning/ROADMAP.md` -- Phase 83 success criteria
</canonical_refs>

<code_context>
- open_tab/switch_tab/list_tabs for multi-tab workflow (from Phase 80)
- type_text for code entry, read_page for code extraction
- Multi-tab context retention patterns from Phase 80 google-travel.js
</code_context>
