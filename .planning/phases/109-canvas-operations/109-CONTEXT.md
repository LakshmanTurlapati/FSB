# Phase 109: Canvas Operations - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add canvas operation workflows to the Excalidraw site guide: undo/redo, clear canvas, zoom in/out/reset/fit, pan, select all. All via keyboard shortcuts.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure site guide expansion.

Key shortcuts from research:
- Undo: Ctrl+Z, Redo: Ctrl+Y (or Ctrl+Shift+Z)
- Clear canvas: Ctrl+A then Delete (not Backspace -- research says Delete is more reliable)
- Zoom in: Ctrl+=, Zoom out: Ctrl+-, Reset zoom: Ctrl+0
- Zoom to fit: Shift+1
- Pan: Space+drag (hold space, then cdpDrag)
- Select all: Ctrl+A

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- current site guide with SESSION SETUP, DRAWING PRIMITIVES, TEXT ENTRY sections from Phases 107-108

### Integration Points
- Add CANVAS OPERATIONS section to guidance string
- Add workflow arrays for each operation

</code_context>

<specifics>
## Specific Ideas
No specific requirements -- standard keyboard shortcut documentation.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
