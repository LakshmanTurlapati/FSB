# Phase 111: Connectors & Arrows - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add connector and arrow workflows to the Excalidraw site guide: auto-binding arrows to shape edges, elbow/orthogonal routing, arrowhead style changes, labeled arrows.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- site guide expansion.

Key patterns from research:
- Arrow tool: press A, then cdpDrag from shape edge to shape edge
- Auto-binding: endpoints must land within ~5px of shape boundary for binding
- Elbow/orthogonal routing: after drawing arrow, change routing via properties panel
- Arrowhead styles: arrow, bar, dot, triangle, none -- selectable via DOM property panel buttons
- Labeled arrows: double-click arrow or select+Enter to add text label
- Arrow endpoint binding requires edge-coordinate calculation (center of shape edge, not center of shape)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- current site guide with SESSION SETUP, DRAWING PRIMITIVES, TEXT ENTRY, CANVAS OPERATIONS, ELEMENT EDITING

### Integration Points
- Add CONNECTORS AND ARROWS section to guidance string
- Add workflow arrays for each connector operation

</code_context>

<specifics>
## Specific Ideas
Arrow binding precision is the key challenge -- the AI needs explicit guidance on targeting shape edges rather than shape centers.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
