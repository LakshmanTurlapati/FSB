# Phase 108: Drawing Primitives & Text Entry - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the Excalidraw site guide with complete drawing primitive workflows (all 7 shape types) and the transient textarea text entry workflow. After this phase, FSB can reliably draw any shape and add text labels on the Excalidraw canvas.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- site guide expansion phase.

Key technical context from research:
- Tool keyboard shortcuts: R=rectangle, O=ellipse, D=diamond, L=line, A=arrow, P=pen/freedraw, T=text, F=frame, E=eraser
- Excalidraw auto-switches to selection tool (V) after each shape draw -- must re-press tool key
- Minimum drag distance ~50px in both axes to avoid click/drag ambiguity
- Text entry uses transient textarea (class excalidraw-wysiwyg) -- cdpInsertText after 200-400ms wait
- Double-click shape or select+Enter to edit text inside shapes
- Coordinate grid convention: 150px horizontal spacing, 120px vertical, 150x80px default shapes
- Phase 107 already added SESSION SETUP and TEXT ENTRY WORKFLOW sections to site guide

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- existing site guide with SESSION SETUP and TEXT ENTRY WORKFLOW from Phase 107
- Phase 107 added sessionSetup and textEntry workflow arrays
- cdpInsertText already in toolPreferences

### Established Patterns
- Site guides use guidance strings + workflows arrays + selectors objects
- Keyboard shortcut documentation follows the pattern established in other site guides
- Tool-key re-press rules should be documented as warnings

### Integration Points
- site-guides/design/excalidraw.js guidance string -- add DRAWING PRIMITIVES section
- site-guides/design/excalidraw.js workflows -- add per-shape drawing workflows
- ai-integration.js injects site guide content into AI system prompt automatically

</code_context>

<specifics>
## Specific Ideas

Research specifies all keyboard shortcuts and interaction patterns. This phase adds them to the site guide so the AI knows how to use each tool.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>
