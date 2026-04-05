# Phase 59: Drag-and-Drop Reorder - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Jira/Trello card drag-and-drop from bottom to top of another list via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Trello (trello.com) -- free tier allows board creation, may require sign-in
- If Trello requires auth, try a public Trello board or use skip-auth outcome
- Fallback: use a free Kanban board tool (Kanbanize demo, WeKan, or similar drag-and-drop demo page)
- Dismiss any cookie/consent/onboarding popups

### Test Workflow
- Navigate to a Kanban board with multiple lists/columns and cards
- Identify a card at the bottom of one list
- Drag the card from the bottom of list A to the top of list B
- Verify the card moved (appears at top of list B, no longer in list A)

### Pass/Fail & Diagnostics
- PASS = card dragged from bottom of one list to top of another list
- PARTIAL = drag initiated but card didn't land in target or snapped back
- FAIL = couldn't interact with the Kanban board
- skip-auth = Trello requires login and blocks board access
- Reuse drag MCP tool for card movement
- Same diagnostic report template as Phase 47-58

### Claude's Discretion
- Which Kanban board site to use
- How to identify card and list elements
- Exact drag coordinates and timing
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- drag, click_at, click_and_hold
- `content/actions.js` -- CDP tools
- `background.js` -- CDP handlers

### Prior art
- `.planning/phases/52-3d-product-viewer-rotation/52-DIAGNOSTIC.md` -- Drag interaction

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-03 requirement
- `.planning/ROADMAP.md` -- Phase 59 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drag` MCP tool: CDP drag sequence with configurable steps and delay
- `click_at`, `click_and_hold`, `navigate`, `read_page`, `get_dom_snapshot`

### Established Patterns
- Drag-and-drop in web apps uses HTML5 drag events or custom mouse event handlers
- CDP drag dispatches mousePressed -> mouseMoved -> mouseReleased which may or may not trigger HTML5 DnD events
- Some apps require specific event sequences (dragstart, dragenter, dragover, drop)

### Integration Points
- New site guide in `site-guides/productivity/kanban.js`

</code_context>

<specifics>
## Specific Ideas

- Trello uses React DnD library for card drag-and-drop
- CDP drag may not trigger React DnD's synthetic events -- may need HTML5 drag event dispatch
- Slow drag speed (high stepDelay) may help DnD libraries detect the drag operation
- Vertical drag within a list + horizontal drag between lists

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 59-drag-and-drop-reorder*
*Context gathered: 2026-03-21*
