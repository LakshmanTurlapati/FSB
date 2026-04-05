# Phase 86: Session Expiry Re-Auth - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute session expiration modal handling, re-authentication, and task resumption via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Document the session expiry handling pattern (detect modal, re-auth, resume task)
- Target: demo site with session timeout or skip-auth if no suitable demo
- PASS = session expiry modal detected + re-auth completed + original task resumed
- skip-auth = no demo site with session expiry available
- Same diagnostic report template
- Claude's discretion: which demo site, session timeout simulation
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, type_text, read_page, get_dom_snapshot, wait_for_element
- `.planning/REQUIREMENTS.md` -- CONTEXT-10
- `.planning/ROADMAP.md` -- Phase 86 success criteria
</canonical_refs>

<code_context>
- Modal detection via get_dom_snapshot (aria-modal, dialog elements)
- Re-auth via type_text for credentials + click for submit
- Task state preservation across re-auth
</code_context>
