# Phase 81: Multi-Step Checkout with Correction - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute multi-step checkout with wrong zip entry, correction, and tax update verification via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Use a demo checkout page or e-commerce site test mode
- Enter shipping info with intentionally wrong zip code
- Correct the zip code
- Verify tax amount updates after zip correction
- PASS = checkout flow navigated, zip corrected, tax update verified
- PARTIAL = checkout started but correction or verification failed
- skip-auth if site requires login for checkout
- Same diagnostic report template
- Claude's discretion: which checkout site, test data
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, type_text, clear_input, read_page, get_attribute
- `.planning/REQUIREMENTS.md` -- CONTEXT-05
- `.planning/ROADMAP.md` -- Phase 81 success criteria
</canonical_refs>

<code_context>
- click + type_text for form filling
- clear_input for correcting zip code
- read_page/get_attribute for tax verification
- Form navigation via click on next/continue buttons
</code_context>
