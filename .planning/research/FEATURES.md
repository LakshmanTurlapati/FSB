# Feature Landscape: v0.9.9 Excalidraw Mastery

**Domain:** Canvas-based diagramming automation via browser extension
**Researched:** 2026-03-23

## Table Stakes

Features the AI must handle reliably to claim "Excalidraw mastery."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Draw rectangles | Most basic shape primitive | Low | press_key R + cdpDrag, already proven |
| Draw ellipses | Core shape primitive | Low | press_key O + cdpDrag |
| Draw diamonds | Core shape primitive | Low | press_key D + cdpDrag |
| Draw arrows/lines | Connectors are fundamental to diagrams | Medium | Need binding behavior for connected diagrams |
| Add text labels | Every diagram has text | Medium | THE key problem -- cdpInsertText on textarea |
| Text on shapes | Shapes need labels inside them | Medium | Double-click shape or select + Enter, then type |
| Select/move elements | Basic editing | Low | V tool + cdpDrag for move |
| Delete elements | Basic editing | Low | Select + Delete/Backspace |
| Undo/redo | Error recovery | Low | Ctrl+Z / Ctrl+Y keyboard shortcuts |
| Change colors | Visual differentiation | Medium | S/G shortcuts + color picker DOM interaction |
| Export drawing | Output the result | Medium | Shift+Alt+C for PNG clipboard, menu for file save |
| Multi-select and align | Clean diagram layout | Medium | Ctrl+A or shift+click, then alignment shortcuts |

## Differentiators

Features that elevate FSB from "can draw shapes" to "can create professional diagrams from descriptions."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural language diagram generation | "Draw a flowchart for user login" produces a complete diagram | High | AI plans layout, calculates coordinates, sequences all operations |
| Connected arrow auto-routing | Arrows that bind to shapes and auto-route | Medium | cdpDrag from shape edge to shape edge with binding detection |
| Elbow (orthogonal) arrows | Professional-looking right-angle connectors | Medium | Select arrow type after drawing via properties panel |
| Style copying/pasting | Consistent visual style across elements | Low | Ctrl+Alt+C / Ctrl+Alt+V shortcuts |
| Group/ungroup operations | Organize complex diagrams | Low | Ctrl+G / Ctrl+Shift+G |
| Frame containers | Visual grouping with labels | Medium | F tool + cdpDrag, frame label editing |
| Layer ordering | Control overlap/z-order | Low | Ctrl+[ / Ctrl+] / Ctrl+Shift+[ / Ctrl+Shift+] |
| Distribute evenly | Professional spacing between 3+ elements | Low | Distribution buttons after multi-select |
| Canvas clear + fresh start | Reset for new diagrams | Low | Ctrl+Delete |
| Zoom to fit | Show entire drawing | Low | Shift+1 |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Pixel-perfect layout | Canvas coordinates are approximate; AI cannot pixel-match a reference image | Teach approximate layout with consistent spacing (e.g., 150px between shapes) |
| Screenshot verification | No screenshot analysis pipeline exists; adds massive complexity | Use action counting + DOM state checks for verification |
| Excalidraw API injection | Content scripts cannot access page JS context (isolated world) | All interaction via CDP events and DOM |
| Real-time collaboration features | Out of scope, requires authentication | Single-user drawing automation only |
| Custom library shapes | Complex multi-step import workflow | Use built-in primitives only |
| Image insertion | Requires file picker interaction, complex | Defer to future milestone |
| Mermaid/PlantUML import | Excalidraw supports these but adds conversion complexity | Generate diagrams directly with shapes and arrows |
| Excalidraw+ (paid) features | Authentication-gated | Use excalidraw.com free tier only |

## Feature Dependencies

```
Canvas navigation (zoom, pan) -- no dependencies, needed first
  |
Draw primitives (rect, ellipse, diamond) -- needs canvas ready
  |
Text entry (cdpInsertText on textarea) -- needs draw primitives for shape labels
  |
Connectors (arrows between shapes) -- needs shapes to exist
  |
Styling (colors, stroke, fill) -- needs elements to style
  |
Alignment & distribution -- needs multiple elements
  |
Export (PNG, SVG, clipboard) -- needs completed drawing
  |
Natural language diagrams -- needs ALL above working reliably
```

## MVP Recommendation

Prioritize:
1. **Text entry fix** (table stakes, currently broken) -- unlocks shape labels
2. **All drawing primitives** (table stakes) -- rectangles, ellipses, diamonds, lines, arrows
3. **Connected arrows** (differentiator) -- makes real diagrams possible
4. **Colors and styling** (table stakes) -- visual differentiation
5. **Alignment** (table stakes) -- clean layouts
6. **Export** (table stakes) -- output the result

Defer:
- **Natural language diagram generation** to final phase -- requires all primitives working first
- **Frame containers** -- nice to have, not blocking
- **Elbow arrows** -- cosmetic improvement, sharp arrows work fine

## Sources

- [Excalidraw keyboard shortcuts](https://csswolf.com/excalidraw-keyboard-shortcuts-pdf/)
- [Excalidraw text editor source](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx)
- [Excalidraw export system](https://deepwiki.com/excalidraw/excalidraw/6.6-export-system)
- [Excalidraw arrow binding](https://x.com/excalidraw/status/1786055557645824177)
