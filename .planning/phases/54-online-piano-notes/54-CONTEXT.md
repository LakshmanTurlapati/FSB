# Phase 54: Online Piano Notes - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute online piano note playing (Mary Had a Little Lamb, first four notes) via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use virtualpiano.net or similar free online piano (no auth)
- Fallback: pianu.com or recursivearts.com/virtual-piano
- Dismiss any cookie/consent popups or ads before playing

### Test Workflow
- Navigate to online piano
- Play first 4 notes of "Mary Had a Little Lamb": E-D-C-D
- Use click_at on piano key positions OR press_key if piano responds to keyboard (many do -- keys mapped to keyboard letters)
- Verify notes played (visual feedback on keys or sound indicator)

### Pass/Fail & Diagnostics
- PASS = 4 notes played in sequence (E-D-C-D) with visual/audio feedback
- PARTIAL = piano loaded but some notes didn't register or wrong keys hit
- FAIL = couldn't interact with piano at all
- Try keyboard shortcuts first (many online pianos map to keyboard), fall back to click_at
- Same diagnostic report template as Phase 47-53

### Claude's Discretion
- Which specific piano site to use
- Whether to use keyboard mapping or click_at for note playing
- Timing between notes
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools
- `content/actions.js` -- Content script tools
- `background.js` -- CDP handlers

### Prior art
- `.planning/phases/53-canvas-painted-button-click/53-DIAGNOSTIC.md` -- Canvas click patterns

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-08 requirement definition
- `.planning/ROADMAP.md` -- Phase 54 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` MCP tool: CDP trusted click at viewport coordinates
- `press_key` MCP tool: Keyboard shortcuts -- online pianos often map keys to keyboard letters
- `navigate`, `read_page`, `get_dom_snapshot`

### Established Patterns
- Canvas apps require CDP click_at; DOM-based pianos can use press_key
- Site guides with selectors + workflows + toolPreferences

### Integration Points
- New site guide in `site-guides/music/` or similar category

</code_context>

<specifics>
## Specific Ideas

- Virtual Piano maps keyboard keys to piano notes (e.g., "E" key plays E note)
- Many online pianos use DOM elements for keys (divs with click handlers) -- may work with regular click
- If canvas-based, use click_at at the position of each key

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 54-online-piano-notes*
*Context gathered: 2026-03-21*
