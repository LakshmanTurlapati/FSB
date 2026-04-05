# Phase 95: Skip Ad Countdown - Context
**Gathered:** 2026-03-22
**Status:** Ready for planning
<domain>
## Phase Boundary
Execute video player Skip Ad button click after 5-second countdown completes via MCP manual tools; fix blockers.
</domain>
<decisions>
## Implementation Decisions
- Document the pattern of video ad Skip buttons that appear after countdown
- Target: YouTube or video site with pre-roll ads and skip button
- Wait for countdown to complete, then click Skip Ad
- PASS = waited for countdown + clicked Skip Ad successfully
- Same diagnostic report template
- Claude's discretion: which video site, how to detect countdown completion
</decisions>
<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, wait_for_element, read_page, click_at
- `.planning/REQUIREMENTS.md` -- DARK-09
- `.planning/ROADMAP.md` -- Phase 95 success criteria
</canonical_refs>
<code_context>
- wait_for_element for Skip Ad button appearance
- YouTube skip button: .ytp-ad-skip-button, .ytp-ad-skip-button-modern
- Countdown element shows seconds remaining
</code_context>
