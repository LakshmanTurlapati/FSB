# Phase 84: Google Doc Word Replace - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute manual Google Doc word replacement of "synergy" with "collaboration" (no Find/Replace) via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Use Google Docs (docs.google.com) -- requires auth for editing
- Manually find "synergy" by reading text, then select and replace with "collaboration"
- No Find/Replace (Ctrl+H) -- must use manual text selection + typing
- skip-auth if Google Docs requires login (likely)
- Same diagnostic report template
- Claude's discretion: which doc, how to find word without Find/Replace
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- select_text_range, type_text, read_page, click_at, press_key
- `.planning/REQUIREMENTS.md` -- CONTEXT-08
- `.planning/ROADMAP.md` -- Phase 84 success criteria
</canonical_refs>

<code_context>
- select_text_range from Phase 60 for precise text selection
- type_text to replace selected text
- Google Docs renders on canvas -- may need CDP tools
- Similar to Photopea (Phase 51) -- canvas-rendered editor
</code_context>
