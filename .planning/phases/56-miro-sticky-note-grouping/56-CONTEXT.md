# Phase 56: Miro Sticky Note Grouping - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Miro board sticky note clustering via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Miro (miro.com) -- free tier allows board creation, may require sign-in
- If auth is required, document as skip-auth outcome
- Fallback: use a public Miro board template or similar whiteboard app (FigJam, Excalidraw)
- Dismiss any onboarding/tutorial overlays

### Test Workflow
- Navigate to Miro and open/create a board
- Create 2-3 sticky notes using the sticky note tool
- Drag sticky notes to cluster them together in one area
- Verify clustering (notes are in proximity)

### Pass/Fail & Diagnostics
- PASS = sticky notes created + dragged to cluster in one area
- PARTIAL = board loaded but note creation or drag failed
- FAIL = couldn't access Miro or interact with the board
- skip-auth = Miro requires login and blocks board creation
- Reuse click_at for board interactions, drag for moving notes, type_text for note content
- Same diagnostic report template as Phase 47-55

### Claude's Discretion
- Whether to use Miro free tier or fallback to another whiteboard app
- How to handle auth requirements
- Sticky note content text
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools
- `content/actions.js` -- Content script tools
- `background.js` -- CDP handlers

### Prior art
- `.planning/phases/48-figma-frame-alignment/48-CONTEXT.md` -- Excalidraw canvas (similar whiteboard)

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-10 requirement
- `.planning/ROADMAP.md` -- Phase 56 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at`, `drag`, `press_key`, `type_text`, `navigate`, `read_page`, `get_dom_snapshot`
- All CDP tools confirmed working through canvas and iframe surfaces

### Established Patterns
- Whiteboard apps (Excalidraw from Phase 48) use canvas rendering with keyboard shortcuts
- Canvas interaction requires CDP click_at/drag at pixel coordinates

### Integration Points
- New site guide in `site-guides/design/miro.js` or `site-guides/collaboration/`

</code_context>

<specifics>
## Specific Ideas

- Miro uses canvas rendering similar to Excalidraw -- keyboard shortcuts for tools
- Sticky note tool may be activated via toolbar click or keyboard shortcut (N key)
- Double-click on canvas creates a sticky note in Miro
- Drag to move notes to cluster them

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 56-miro-sticky-note-grouping*
*Context gathered: 2026-03-21*
