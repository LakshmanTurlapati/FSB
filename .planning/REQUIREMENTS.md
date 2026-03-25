# Requirements: FSB v0.9.9 Excalidraw Mastery

**Defined:** 2026-03-23
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.9 Requirements

Requirements for full Excalidraw mastery. Each maps to roadmap phases.

### Engine Fixes

- [x] **ENGINE-01**: FSB recognizes Excalidraw as a canvas editor for progress detection (isCanvasEditorUrl)
- [x] **ENGINE-02**: FSB uses CDP direct path for text entry on Excalidraw (isCanvasBasedEditor)
- [x] **ENGINE-03**: Every Excalidraw session begins with modal dismissal, canvas clear, and zoom reset

### Drawing Primitives

- [x] **DRAW-01**: User can draw rectangles on Excalidraw canvas
- [x] **DRAW-02**: User can draw ellipses/circles on Excalidraw canvas
- [x] **DRAW-03**: User can draw diamonds on Excalidraw canvas
- [x] **DRAW-04**: User can draw straight lines on Excalidraw canvas
- [x] **DRAW-05**: User can draw arrows on Excalidraw canvas
- [x] **DRAW-06**: User can freedraw with pen tool on Excalidraw canvas
- [x] **DRAW-07**: User can draw frames (containers) on Excalidraw canvas

### Text Entry

- [x] **TEXT-01**: User can add standalone text labels on Excalidraw canvas
- [x] **TEXT-02**: User can add text inside shapes (double-click shape or select+Enter)
- [x] **TEXT-03**: User can edit existing text on shapes

### Canvas Operations

- [x] **CANVAS-01**: User can undo and redo actions (Ctrl+Z / Ctrl+Y)
- [x] **CANVAS-02**: User can clear the entire canvas
- [x] **CANVAS-03**: User can zoom in, zoom out, and reset zoom
- [x] **CANVAS-04**: User can pan the canvas
- [x] **CANVAS-05**: User can select all elements
- [x] **CANVAS-06**: User can zoom to fit all content (Shift+1)

### Element Editing

- [x] **EDIT-01**: User can select and move elements
- [x] **EDIT-02**: User can delete elements
- [x] **EDIT-03**: User can duplicate elements
- [x] **EDIT-04**: User can resize elements
- [x] **EDIT-05**: User can rotate elements
- [x] **EDIT-06**: User can group and ungroup elements
- [x] **EDIT-07**: User can lock and unlock elements
- [x] **EDIT-08**: User can copy and paste style between elements

### Connectors & Arrows

- [x] **CONN-01**: User can draw arrows that auto-bind to shape edges
- [x] **CONN-02**: User can create elbow (orthogonal) arrow routing
- [x] **CONN-03**: User can change arrowhead styles (arrow/bar/dot/triangle/none)
- [x] **CONN-04**: User can add labels to arrows/connectors

### Styling

- [x] **STYLE-01**: User can change stroke color of elements
- [x] **STYLE-02**: User can change fill/background color of elements
- [x] **STYLE-03**: User can change stroke width of elements
- [x] **STYLE-04**: User can change stroke style (solid/dashed/dotted)
- [x] **STYLE-05**: User can change fill pattern (transparent/solid/hachure/cross-hatch)
- [x] **STYLE-06**: User can change element opacity
- [x] **STYLE-07**: User can change font size, family, and text alignment

### Alignment & Layout

- [x] **ALIGN-01**: User can align multiple elements (left/right/top/bottom/center)
- [x] **ALIGN-02**: User can distribute elements evenly (horizontal/vertical)
- [x] **ALIGN-03**: User can change layer ordering (bring forward/back, front/back)

### Export

- [x] **EXPORT-01**: User can export drawing as PNG to clipboard
- [x] **EXPORT-02**: User can export drawing as SVG
- [x] **EXPORT-03**: User can copy drawing to clipboard

### Natural Language Diagrams

- [x] **NL-01**: User can generate a flowchart from a natural language description
- [x] **NL-02**: User can generate an architecture diagram from a natural language description
- [x] **NL-03**: User can generate a mind map from a natural language description
- [x] **NL-04**: Generated diagrams have consistent spacing using a coordinate grid convention
- [x] **NL-05**: Generated diagrams include text labels on all shapes and connectors

### Canvas Vision

- [x] **VISION-01**: FSB intercepts Canvas 2D draw calls (fillRect, fillText, lineTo, arc, etc.) via prototype proxy injected at document_start in MAIN world
- [ ] **VISION-02**: Draw call log is summarized into structured text (texts, rectangles, paths with coordinates and colors) and injected into DOM snapshots
- [x] **VISION-03**: For already-loaded pages, FSB triggers canvas re-render (resize event) to capture draw calls retroactively
- [x] **VISION-04**: Pixel-based fallback extracts color regions and edge outlines when draw call interception is unavailable
- [ ] **VISION-05**: Canvas scene description appears in every DOM snapshot markdown so the AI sees canvas content on every iteration
- [ ] **VISION-06**: FSB can verify its own drawing actions by reading the canvas state after drawing
- [ ] **VISION-07**: Canvas vision works on at least 10 of the 15 canvas-based apps in FSB scope

## Future Requirements

### Advanced Diagram Types

- **NL-06**: User can generate sequence diagrams from natural language
- **NL-07**: User can generate ER diagrams from natural language
- **NL-08**: User can generate swimlane diagrams from natural language

### Advanced Features

- **ADV-01**: Image insertion on Excalidraw canvas
- **ADV-02**: Custom library shape import
- **ADV-03**: Mermaid/PlantUML import conversion

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pixel-perfect layout | Canvas coordinates are approximate; AI cannot pixel-match a reference image |
| Screenshot verification | No screenshot analysis pipeline exists; action counting suffices |
| Excalidraw API injection | Content scripts cannot access page JS context (isolated world) |
| Real-time collaboration | Out of scope, requires authentication |
| Excalidraw+ paid features | Authentication-gated |
| Pressure-sensitive drawing | Hardware-dependent, not automatable via CDP |
| EyeDropper color picking | OS-level UI, not automatable |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENGINE-01 | Phase 107 | Complete |
| ENGINE-02 | Phase 107 | Complete |
| ENGINE-03 | Phase 107 | Complete |
| DRAW-01 | Phase 108 | Complete |
| DRAW-02 | Phase 108 | Complete |
| DRAW-03 | Phase 108 | Complete |
| DRAW-04 | Phase 108 | Complete |
| DRAW-05 | Phase 108 | Complete |
| DRAW-06 | Phase 108 | Complete |
| DRAW-07 | Phase 108 | Complete |
| TEXT-01 | Phase 108 | Complete |
| TEXT-02 | Phase 108 | Complete |
| TEXT-03 | Phase 108 | Complete |
| CANVAS-01 | Phase 109 | Complete |
| CANVAS-02 | Phase 109 | Complete |
| CANVAS-03 | Phase 109 | Complete |
| CANVAS-04 | Phase 109 | Complete |
| CANVAS-05 | Phase 109 | Complete |
| CANVAS-06 | Phase 109 | Complete |
| EDIT-01 | Phase 110 | Complete |
| EDIT-02 | Phase 110 | Complete |
| EDIT-03 | Phase 110 | Complete |
| EDIT-04 | Phase 110 | Complete |
| EDIT-05 | Phase 110 | Complete |
| EDIT-06 | Phase 110 | Complete |
| EDIT-07 | Phase 110 | Complete |
| EDIT-08 | Phase 110 | Complete |
| CONN-01 | Phase 111 | Complete |
| CONN-02 | Phase 111 | Complete |
| CONN-03 | Phase 111 | Complete |
| CONN-04 | Phase 111 | Complete |
| STYLE-01 | Phase 112 | Complete |
| STYLE-02 | Phase 112 | Complete |
| STYLE-03 | Phase 112 | Complete |
| STYLE-04 | Phase 112 | Complete |
| STYLE-05 | Phase 112 | Complete |
| STYLE-06 | Phase 112 | Complete |
| STYLE-07 | Phase 112 | Complete |
| ALIGN-01 | Phase 112 | Complete |
| ALIGN-02 | Phase 112 | Complete |
| ALIGN-03 | Phase 112 | Complete |
| EXPORT-01 | Phase 113 | Complete |
| EXPORT-02 | Phase 113 | Complete |
| EXPORT-03 | Phase 113 | Complete |
| NL-01 | Phase 114 | Complete |
| NL-02 | Phase 114 | Complete |
| NL-03 | Phase 114 | Complete |
| NL-04 | Phase 114 | Complete |
| NL-05 | Phase 114 | Complete |

**Coverage:**
- v0.9.9 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
