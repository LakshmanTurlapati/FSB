# Architecture: v0.9.9 Excalidraw Mastery

**Domain:** Canvas-based diagramming automation within existing Chrome Extension
**Researched:** 2026-03-23

## Recommended Architecture

No new architectural components needed. The milestone is pure *intelligence augmentation* of the existing site guide system.

### Component Map (Existing -- No Changes)

| Component | Role in Excalidraw Mastery | Changes Needed |
|-----------|---------------------------|----------------|
| background.js | CDP tool dispatch (press_key, cdpDrag, cdpInsertText, cdpClickAt) | None |
| keyboard-emulator.js | Key dispatch via Input.dispatchKeyEvent | None |
| content/actions.js | DOM-based actions (click, type, getAttribute) | None |
| cli-parser.js | Parse AI CLI commands | None |
| ai-integration.js | System prompt, continuation prompt | Site guide injection (existing mechanism) |
| site-guides/design/excalidraw.js | Excalidraw-specific intelligence | MAJOR UPDATE -- this is where all work goes |

### Data Flow for Excalidraw Automation

```
User: "Draw a flowchart with 3 boxes connected by arrows, labeled Start, Process, End"
  |
  v
AI receives prompt + Excalidraw site guide (keyboard shortcuts, tool patterns)
  |
  v
AI plans coordinate layout:
  - Box 1: (200, 200) to (350, 280) -- "Start"
  - Box 2: (200, 380) to (350, 460) -- "Process"
  - Box 3: (200, 560) to (350, 640) -- "End"
  - Arrow 1: (275, 280) to (275, 380)
  - Arrow 2: (275, 460) to (275, 560)
  |
  v
AI emits CLI commands:
  press_key r                          # Rectangle tool
  cdpDrag 200 200 350 280              # Draw box 1
  press_key t                          # Text tool
  cdpClickAt 275 240                   # Click center of box 1
  [wait for textarea.excalidraw-wysiwyg]
  cdpInsertText "Start"                # Type label
  press_key Escape                     # Commit text
  press_key r                          # Rectangle tool again
  cdpDrag 200 380 350 460              # Draw box 2
  ... (repeat for box 3)
  press_key a                          # Arrow tool
  cdpDrag 275 280 275 380              # Arrow from box 1 bottom to box 2 top
  ... (repeat for arrow 2)
```

### Interaction Pattern Categories

**Category 1: Pure CDP (canvas interactions)**
- Drawing shapes: press_key + cdpDrag
- Moving elements: V tool + cdpDrag from element center
- Drawing arrows: press_key a + cdpDrag edge-to-edge
- Canvas pan: H tool + cdpDrag (or Space+drag)
- Text placement: T tool + cdpClickAt

**Category 2: Pure keyboard shortcuts**
- Tool selection: single letter keys
- Undo/redo: Ctrl+Z / Ctrl+Y
- Select all: Ctrl+A
- Delete: Delete/Backspace
- Layer ordering: Ctrl+[ / Ctrl+]
- Alignment: Ctrl+Shift+Arrow
- Copy as PNG: Shift+Alt+C
- Group/ungroup: Ctrl+G / Ctrl+Shift+G
- Zoom: Ctrl++/-/0, Shift+1

**Category 3: CDP text insertion**
- Text entry: cdpInsertText into focused textarea
- Only used after textarea.excalidraw-wysiwyg appears in DOM

**Category 4: DOM clicks (toolbar/menu interactions)**
- Color picker swatches: click on color in palette
- Menu items: click on data-testid buttons
- Export dialog buttons: click on format/download buttons
- Alignment buttons: click on aria-label buttons (alternative to shortcuts)
- Properties panel: RadioSelection buttons for stroke/fill/font

### Site Guide Structure (Updated)

The excalidraw.js site guide should be organized into these sections:

```
1. AUTOPILOT STRATEGY HINTS (existing, expand)
2. KEYBOARD SHORTCUTS -- complete reference (all categories)
3. TEXT ENTRY WORKFLOW -- step-by-step cdpInsertText sequence
4. SHAPE DRAWING PATTERNS -- each primitive with coordinates guidance
5. CONNECTOR/ARROW PATTERNS -- binding, multi-point, labeled
6. STYLING WORKFLOW -- colors, stroke, fill via S/G shortcuts + DOM
7. ALIGNMENT WORKFLOW -- shortcuts and DOM button fallbacks
8. EXPORT WORKFLOW -- PNG clipboard shortcut, menu-based SVG
9. CANVAS OPERATIONS -- clear, zoom, pan, undo/redo
10. VERIFICATION SELECTORS -- what DOM elements confirm state
11. LAYOUT PLANNING GUIDE -- coordinate spacing conventions for AI
```

## Patterns to Follow

### Pattern 1: Keyboard-First, DOM-Fallback
**What:** Always try keyboard shortcuts before DOM interaction
**When:** Every operation that has a keyboard shortcut
**Why:** Keyboard shortcuts are version-stable, faster, and don't depend on React DOM structure

### Pattern 2: Wait-for-Element Before Text Entry
**What:** After activating text mode + clicking canvas, poll for textarea.excalidraw-wysiwyg
**When:** Every text entry operation
**Why:** Textarea is created asynchronously by React; inserting text before it exists fails silently

### Pattern 3: Re-activate Tool Before Each Shape
**What:** Press the tool shortcut letter before every new shape draw
**When:** Drawing multiple shapes of the same type
**Why:** Excalidraw auto-switches to selection tool after each shape

### Pattern 4: Edge-to-Edge Drag for Connected Arrows
**What:** Start drag on source shape edge, end on target shape edge
**When:** Creating connected arrows between shapes
**Why:** Arrow binding only activates when cursor is near shape boundary

### Pattern 5: Coordinate Grid Planning
**What:** AI should plan shapes on a rough grid with consistent spacing
**When:** Natural language diagram generation
**Why:** Without a grid convention, shapes overlap or spread chaotically
**Convention:** 150px horizontal spacing, 120px vertical spacing, shapes 150x80px default

## Anti-Patterns to Avoid

### Anti-Pattern 1: Trying to Query Canvas State via DOM
**What:** Looking for SVG elements or shape DOM nodes after drawing
**Why bad:** Excalidraw renders to `<canvas>`, not SVG. Shapes are not DOM elements.
**Instead:** Track what was drawn via action history; use Stats panel (Alt+/) for element count

### Anti-Pattern 2: Using `type` Tool for Excalidraw Text
**What:** Using FSB's standard `type` action to enter text
**Why bad:** `type` needs a stable selector for the input; Excalidraw's textarea is ephemeral
**Instead:** Use `cdpInsertText` which targets the currently-focused element

### Anti-Pattern 3: Clicking Toolbar Buttons for Tool Selection
**What:** Using DOM click on `[data-testid="toolbar-rectangle"]` to select rectangle tool
**Why bad:** Slower, depends on React class names, may fail across Excalidraw versions
**Instead:** Press `R` key via `press_key`

### Anti-Pattern 4: Drawing Very Small Shapes
**What:** cdpDrag with less than 30px distance
**Why bad:** Excalidraw interprets small drags as clicks, not shape creation
**Instead:** Minimum 50px drag in both X and Y axes

## Sources

- Existing FSB codebase: background.js, keyboard-emulator.js, content/actions.js, excalidraw.js site guide
- [Excalidraw textWysiwyg.tsx source](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx)
- [Excalidraw keyboard shortcuts](https://csswolf.com/excalidraw-keyboard-shortcuts-pdf/)
