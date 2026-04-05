# Phase 60: Text Selection Precision - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute precise text selection of second sentence in third Wikipedia paragraph via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Wikipedia (en.wikipedia.org) -- free, no auth, DOM-based text content
- Choose a well-known article with multiple paragraphs (e.g., "Albert Einstein")
- No popups or consent needed (Wikipedia is ad-free)

### Test Workflow
- Navigate to a Wikipedia article
- Identify the third paragraph element
- Locate the second sentence within that paragraph
- Use CDP drag (mousedown at sentence start, mousemove to end, mouseup) to select the text
- Verify text was selected (window.getSelection() or DOM highlight visible)

### Pass/Fail & Diagnostics
- PASS = second sentence of third paragraph is selected (highlighted blue in browser)
- PARTIAL = some text selected but not precisely the target sentence
- FAIL = couldn't select any text at all
- Need precise character-level coordinate targeting for sentence boundaries
- May need a new select_text tool or use existing drag with precise coordinates
- Same diagnostic report template as Phase 47-59

### Claude's Discretion
- Which Wikipedia article to use
- How to calculate exact character coordinates for sentence boundaries
- Whether to add a dedicated text selection tool
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- drag, click_at, click_and_hold
- `content/actions.js` -- Content script tools including selectText if exists
- `background.js` -- CDP handlers

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-04 requirement
- `.planning/ROADMAP.md` -- Phase 60 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drag` MCP tool: CDP drag from point A to point B -- could simulate text selection drag
- `click_at` for positioning cursor at sentence start
- `get_dom_snapshot`, `read_page` for identifying paragraph and sentence content
- Existing `selectText` tool in content/actions.js (if available)

### Established Patterns
- Text selection = mousedown at start position, mousemove to end, mouseup
- CDP drag should work for text selection since it dispatches real mouse events
- Wikipedia uses standard DOM paragraphs -- selectors are straightforward

### Integration Points
- May need select_text MCP tool if drag-based selection is too imprecise
- New site guide in site-guides/reference/ for Wikipedia

</code_context>

<specifics>
## Specific Ideas

- Wikipedia paragraphs are <p> elements inside #mw-content-text
- Third paragraph = document.querySelectorAll('#mw-content-text p')[2]
- Second sentence can be found by splitting paragraph text on '. '
- Character coordinates can be calculated using Range API + getBoundingClientRect

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 60-text-selection-precision*
*Context gathered: 2026-03-21*
