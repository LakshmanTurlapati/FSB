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

- [ ] **CANVAS-01**: User can undo and redo actions (Ctrl+Z / Ctrl+Y)
- [ ] **CANVAS-02**: User can clear the entire canvas
- [ ] **CANVAS-03**: User can zoom in, zoom out, and reset zoom
- [ ] **CANVAS-04**: User can pan the canvas
- [ ] **CANVAS-05**: User can select all elements
- [ ] **CANVAS-06**: User can zoom to fit all content (Shift+1)

### Element Editing

- [ ] **EDIT-01**: User can select and move elements
- [ ] **EDIT-02**: User can delete elements
- [ ] **EDIT-03**: User can duplicate elements
- [ ] **EDIT-04**: User can resize elements
- [ ] **EDIT-05**: User can rotate elements
- [ ] **EDIT-06**: User can group and ungroup elements
- [ ] **EDIT-07**: User can lock and unlock elements
- [ ] **EDIT-08**: User can copy and paste style between elements

### Connectors & Arrows

- [ ] **CONN-01**: User can draw arrows that auto-bind to shape edges
- [ ] **CONN-02**: User can create elbow (orthogonal) arrow routing
- [ ] **CONN-03**: User can change arrowhead styles (arrow/bar/dot/triangle/none)
- [ ] **CONN-04**: User can add labels to arrows/connectors

### Styling

- [ ] **STYLE-01**: User can change stroke color of elements
- [ ] **STYLE-02**: User can change fill/background color of elements
- [ ] **STYLE-03**: User can change stroke width of elements
- [ ] **STYLE-04**: User can change stroke style (solid/dashed/dotted)
- [ ] **STYLE-05**: User can change fill pattern (transparent/solid/hachure/cross-hatch)
- [ ] **STYLE-06**: User can change element opacity
- [ ] **STYLE-07**: User can change font size, family, and text alignment

### Alignment & Layout

- [ ] **ALIGN-01**: User can align multiple elements (left/right/top/bottom/center)
- [ ] **ALIGN-02**: User can distribute elements evenly (horizontal/vertical)
- [ ] **ALIGN-03**: User can change layer ordering (bring forward/back, front/back)

### Export

- [ ] **EXPORT-01**: User can export drawing as PNG to clipboard
- [ ] **EXPORT-02**: User can export drawing as SVG
- [ ] **EXPORT-03**: User can copy drawing to clipboard

### Natural Language Diagrams

- [ ] **NL-01**: User can generate a flowchart from a natural language description
- [ ] **NL-02**: User can generate an architecture diagram from a natural language description
- [ ] **NL-03**: User can generate a mind map from a natural language description
- [ ] **NL-04**: Generated diagrams have consistent spacing using a coordinate grid convention
- [ ] **NL-05**: Generated diagrams include text labels on all shapes and connectors

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
| CANVAS-01 | Phase 109 | Pending |
| CANVAS-02 | Phase 109 | Pending |
| CANVAS-03 | Phase 109 | Pending |
| CANVAS-04 | Phase 109 | Pending |
| CANVAS-05 | Phase 109 | Pending |
| CANVAS-06 | Phase 109 | Pending |
| EDIT-01 | Phase 110 | Pending |
| EDIT-02 | Phase 110 | Pending |
| EDIT-03 | Phase 110 | Pending |
| EDIT-04 | Phase 110 | Pending |
| EDIT-05 | Phase 110 | Pending |
| EDIT-06 | Phase 110 | Pending |
| EDIT-07 | Phase 110 | Pending |
| EDIT-08 | Phase 110 | Pending |
| CONN-01 | Phase 111 | Pending |
| CONN-02 | Phase 111 | Pending |
| CONN-03 | Phase 111 | Pending |
| CONN-04 | Phase 111 | Pending |
| STYLE-01 | Phase 112 | Pending |
| STYLE-02 | Phase 112 | Pending |
| STYLE-03 | Phase 112 | Pending |
| STYLE-04 | Phase 112 | Pending |
| STYLE-05 | Phase 112 | Pending |
| STYLE-06 | Phase 112 | Pending |
| STYLE-07 | Phase 112 | Pending |
| ALIGN-01 | Phase 112 | Pending |
| ALIGN-02 | Phase 112 | Pending |
| ALIGN-03 | Phase 112 | Pending |
| EXPORT-01 | Phase 113 | Pending |
| EXPORT-02 | Phase 113 | Pending |
| EXPORT-03 | Phase 113 | Pending |
| NL-01 | Phase 114 | Pending |
| NL-02 | Phase 114 | Pending |
| NL-03 | Phase 114 | Pending |
| NL-04 | Phase 114 | Pending |
| NL-05 | Phase 114 | Pending |

**Coverage:**
- v0.9.9 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
