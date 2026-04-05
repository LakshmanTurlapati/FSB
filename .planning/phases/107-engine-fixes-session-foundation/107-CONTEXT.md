# Phase 107: Engine Fixes & Session Foundation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two gating engine bugs that prevent multi-step Excalidraw automation from working, and establish a mandatory session setup sequence. After this phase, FSB's automation loop survives 10+ iterations on Excalidraw and text entry reaches the canvas via CDP.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase.

Key technical context from research:
- `isCanvasEditorUrl()` in background.js (line ~11074) needs excalidraw.com added to regex
- `isCanvasBasedEditor()` in content/messaging.js (line ~217) needs excalidraw hostname detection
- Unify `canvasUrl` regex in validateCompletion (line ~4908) with isCanvasEditorUrl for consistency
- Session setup sequence: Escape (dismiss modals) -> Ctrl+A then Delete (clear canvas) -> Ctrl+0 (reset zoom)
- Site guide must document session setup as mandatory first step

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isCanvasEditorUrl()` in background.js -- existing regex for canvas detection (currently only docs.google.com)
- `isCanvasBasedEditor()` in content/messaging.js -- existing hostname check for CDP direct path
- `canvasUrl` regex in validateCompletion -- used for dynamic page fast-path completion
- Existing excalidraw.js site guide in site-guides/design/

### Established Patterns
- Canvas URL detection uses regex patterns on the current URL
- CDP direct path routing bypasses content-to-background nested message round-trip
- Site guides document session setup workflows in guidance strings

### Integration Points
- background.js: isCanvasEditorUrl() for progress detection
- content/messaging.js: isCanvasBasedEditor() for CDP direct text entry path
- background.js: validateCompletion canvasUrl for dynamic page fast-path
- site-guides/design/excalidraw.js: guidance string with session setup workflow

</code_context>

<specifics>
## Specific Ideas

Research identified exact file locations and line numbers for all three fixes. This is a mechanical regex/hostname extension phase.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>
