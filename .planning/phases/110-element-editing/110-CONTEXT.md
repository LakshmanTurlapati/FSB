# Phase 110: Element Editing - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add element editing workflows to the Excalidraw site guide: select/move, delete, duplicate, resize, rotate, group/ungroup, lock/unlock, copy/paste style. All via keyboard shortcuts and cdpDrag.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure site guide expansion.

Key shortcuts from research:
- Select: V tool, click element or rubber-band drag to multi-select
- Move: Select + cdpDrag to new position
- Delete: Select + Delete or Backspace
- Duplicate: Ctrl+D or Alt+drag
- Resize: Select element, cdpDrag corner handles (canvas-rendered, need offset heuristics)
- Rotate: Select element, cdpDrag rotation handle (above selection box)
- Group: Ctrl+G, Ungroup: Ctrl+Shift+G
- Lock: Right-click context menu or toolbar lock button
- Copy style: Ctrl+Alt+C, Paste style: Ctrl+Alt+V

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- current site guide with SESSION SETUP, DRAWING PRIMITIVES, TEXT ENTRY, CANVAS OPERATIONS

### Integration Points
- Add ELEMENT EDITING section to guidance string
- Add workflow arrays for each editing operation

</code_context>

<specifics>
## Specific Ideas
No specific requirements -- standard site guide expansion.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
