# Phase 113: Export - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add export workflows to the Excalidraw site guide: PNG to clipboard, SVG export, clipboard copy.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- site guide expansion.

Key patterns from research:
- PNG to clipboard: Shift+Alt+C (zero DOM interaction needed, cleanest path)
- SVG export: Menu -> Export image -> select SVG format -> download
- Clipboard copy: Ctrl+C copies selected elements, Ctrl+V pastes
- Export dialog may have format selection buttons (PNG/SVG) -- need live DOM inspection
- For PNG clipboard, the shortcut is the most reliable approach (avoids dialog)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- comprehensive site guide

### Integration Points
- Add EXPORT section to guidance string
- Add workflow arrays for each export operation

</code_context>

<specifics>
## Specific Ideas
Prefer keyboard shortcuts over menu navigation for reliability.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
