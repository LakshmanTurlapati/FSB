# Phase 94: Buried Login Link - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute login link discovery on homepage dominated by Sign Up CTAs via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Document the pattern of buried login links among prominent signup CTAs
- Target: SaaS site where login is hard to find (small text, footer, etc.)
- PASS = login link found and clicked despite being visually buried
- Same diagnostic report template
- Claude's discretion: which site, how to find login vs signup
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, read_page, get_dom_snapshot, scroll
- `.planning/REQUIREMENTS.md` -- DARK-08
- `.planning/ROADMAP.md` -- Phase 94 success criteria
</canonical_refs>
<code_context>
- Text search for "log in", "sign in", "already have an account"
- DOM analysis for small/subtle link elements
- Often in header, footer, or below prominent signup buttons
</code_context>
