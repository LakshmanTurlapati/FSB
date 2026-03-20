/**
 * Site Guide: Excalidraw
 * Per-site guide for Excalidraw open-source whiteboard and diagramming tool.
 *
 * Excalidraw is a React-based canvas app at excalidraw.com.
 * All drawing happens on an HTML5 <canvas> element.
 * Tool selection uses keyboard shortcuts (fastest) or toolbar buttons (DOM clicks).
 * Shape drawing requires CDP trusted drag events on the canvas.
 * Alignment is available via toolbar buttons after multi-selecting 2+ shapes.
 *
 * Tested via MCP manual tools (Phase 48, CANVAS-02 diagnostic).
 */

registerSiteGuide({
  site: 'Excalidraw',
  category: 'Design & Whiteboard',
  patterns: [
    /excalidraw\.com/i
  ],
  guidance: `EXCALIDRAW-SPECIFIC INTELLIGENCE:

KEYBOARD SHORTCUTS (preferred over toolbar clicks):
  R = Rectangle tool
  D = Diamond tool
  O = Ellipse (oval) tool
  A = Arrow tool
  L = Line tool
  P = Pencil (free draw) tool
  T = Text tool
  F = Frame tool (creates a named frame/group container)
  V or 1 = Selection tool (pointer)
  E = Eraser tool
  Ctrl+A = Select all elements on canvas
  Ctrl+D = Duplicate selected element(s)
  Ctrl+G = Group selected elements
  Delete/Backspace = Delete selected element(s)
  Escape = Deselect / cancel current tool

CANVAS ELEMENT:
- The main drawing canvas is rendered as an HTML5 <canvas> element
- Canvas selector: canvas.interactive (the primary interactive canvas layer)
- Excalidraw renders multiple canvas layers; the interactive one handles mouse events
- Canvas does NOT respond to content script dispatchEvent() -- use cdpClickAt/cdpDrag exclusively
- Get canvas bounds via getBoundingClientRect() for accurate viewport coordinates

TOOLBAR STRUCTURE:
- Top toolbar contains shape tools as icon buttons
- Toolbar container: .App-toolbar, [class*="toolbar"], .Island (floating toolbar island)
- Individual tool buttons: [data-testid="toolbar-rectangle"], [data-testid="toolbar-diamond"], etc.
- The active tool button has an "active" or "selected" visual state (aria-checked or class)
- Style controls (color, stroke, fill) appear in a left side panel when a shape is selected

FRAME TOOL:
- Press F to activate the frame tool
- Draw a frame by dragging on the canvas (cdpDrag from top-left to bottom-right)
- Frames act as containers/groups for shapes drawn inside them
- Frame shows a title/label at the top (editable by double-clicking)
- If F key does not activate frame tool, use a large rectangle as a visual frame instead

DRAWING SHAPES ON CANVAS:
- Activate the tool via keyboard shortcut (e.g., press R for rectangle)
- Draw the shape by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15)
- Minimum drag distance should be 30+ pixels for Excalidraw to register as a shape (not a click)
- After drawing, Excalidraw auto-switches back to selection tool (V) -- re-press R before each rectangle
- Shapes appear as DOM-accessible SVG-like objects tracked by Excalidraw internal state

MULTI-SELECT SHAPES:
Method 1 (recommended): Ctrl+A via press_key with key=a, ctrl=true -- selects ALL shapes on canvas
Method 2: Shift+click each shape using click_at with shift=true at each shape center coordinate
Method 3: Selection box -- press V (selection tool), then cdpDrag over the area containing all shapes
- After multi-select, Excalidraw shows selection handles (resize corners) around the group

ALIGNMENT TOOLBAR (appears after multi-selecting 2+ shapes):
- When multiple shapes are selected, alignment options appear in the top properties bar
- Look for buttons with: [aria-label*="Align"], [data-testid*="align"], or text "Align left/center/right"
- Align left: [aria-label="Align left"] or button with align-left icon
- Center horizontally: [aria-label="Center horizontally"] or [aria-label="Align center horizontally"]
- Align top: [aria-label="Align top"] or button with align-top icon
- Center vertically: [aria-label="Center vertically"] or [aria-label="Align center vertically"]
- These are HTML DOM buttons -- use regular click tool (not CDP) to press them
- Alignment snaps shapes to the same edge/center coordinate
- Excalidraw may also show "Distribute horizontally" / "Distribute vertically" for 3+ shapes

WELCOME DIALOG / MODALS:
- Excalidraw may show a welcome splash screen or tips dialog on first visit
- Dismiss by clicking outside the dialog, pressing Escape, or clicking close button
- Look for: [class*="Modal"], [class*="Dialog"], [data-testid*="dialog"]
- Cookie consent banner may also appear -- dismiss via close/accept button

PROPERTY PANELS:
- When shapes are selected, a left panel shows style properties (color, stroke, fill, opacity)
- Background color picker: [data-testid="background-color"]
- Stroke color picker: [data-testid="stroke-color"]
- Stroke width options and style options appear as button groups`,
  selectors: {
    canvas: 'canvas.interactive, canvas[class*="interactive"]',
    toolbar: '.App-toolbar, [class*="toolbar"], .Island',
    toolRectangle: '[data-testid="toolbar-rectangle"], .ToolIcon_type_rectangle',
    toolDiamond: '[data-testid="toolbar-diamond"], .ToolIcon_type_diamond',
    toolEllipse: '[data-testid="toolbar-ellipse"], .ToolIcon_type_ellipse',
    toolArrow: '[data-testid="toolbar-arrow"], .ToolIcon_type_arrow',
    toolLine: '[data-testid="toolbar-line"], .ToolIcon_type_line',
    toolText: '[data-testid="toolbar-text"], .ToolIcon_type_text',
    toolFrame: '[data-testid="toolbar-frame"], .ToolIcon_type_frame',
    toolSelection: '[data-testid="toolbar-selection"], .ToolIcon_type_selection',
    toolEraser: '[data-testid="toolbar-eraser"], .ToolIcon_type_eraser',
    alignLeft: '[aria-label="Align left"], [data-testid="align-left"]',
    alignCenterH: '[aria-label="Center horizontally"], [data-testid="align-center-horizontally"]',
    alignRight: '[aria-label="Align right"], [data-testid="align-right"]',
    alignTop: '[aria-label="Align top"], [data-testid="align-top"]',
    alignCenterV: '[aria-label="Center vertically"], [data-testid="align-center-vertically"]',
    alignBottom: '[aria-label="Align bottom"], [data-testid="align-bottom"]',
    distributeH: '[aria-label="Distribute horizontally"], [data-testid="distribute-horizontally"]',
    distributeV: '[aria-label="Distribute vertically"], [data-testid="distribute-vertically"]',
    modalOverlay: '[class*="Modal"], [class*="Dialog"], [data-testid*="dialog"]',
    modalClose: '[class*="Modal"] button[aria-label="close"], [class*="Dialog"] .close',
    backgroundColor: '[data-testid="background-color"]',
    strokeColor: '[data-testid="stroke-color"]',
    layerUI: '.layer-ui__wrapper, [class*="layer-ui"]'
  },
  workflows: {
    createFrame: [
      'Dismiss any welcome dialog or modal (press Escape or click outside)',
      'Press F key via press_key to activate frame tool',
      'If frame tool not available, press R for rectangle as fallback frame',
      'Get canvas bounding rect via getBoundingClientRect for viewport coordinates',
      'Draw frame by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15)',
      'Frame appears as a labeled container on the canvas',
      'Verify frame creation via get_dom_snapshot or visual confirmation'
    ],
    drawRectangle: [
      'Press R key via press_key to activate rectangle tool',
      'Draw rectangle by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15)',
      'Ensure drag distance is at least 30px in both axes for reliable shape creation',
      'After drawing, tool auto-switches to selection -- press R again before next rectangle',
      'Repeat for each additional rectangle'
    ],
    alignShapes: [
      'Multi-select all shapes: press_key(a, ctrl=true) for Ctrl+A to select all',
      'Alternative: shift+click each shape using click_at(x, y, shift=true)',
      'Alternative: press V for selection tool, then cdpDrag a selection box over all shapes',
      'After multi-select, look for alignment buttons in top toolbar via get_dom_snapshot',
      'Click alignment button (e.g., [aria-label="Align left"]) using DOM click tool',
      'Verify alignment took effect (shapes repositioned to same edge/center)'
    ],
    fullFrameAlignmentWorkflow: [
      'Navigate to excalidraw.com and wait for canvas to load',
      'Dismiss any welcome dialogs (Escape key or click outside)',
      'Create a frame: press F, then cdpDrag to define frame bounds',
      'Draw rectangle 1: press R, cdpDrag inside frame area (upper-left region)',
      'Draw rectangle 2: press R, cdpDrag inside frame area (middle region, deliberately offset)',
      'Draw rectangle 3: press R, cdpDrag inside frame area (lower region, deliberately offset)',
      'Select all shapes: press_key(a, ctrl=true)',
      'Get DOM snapshot to find alignment toolbar buttons',
      'Click align-left or center-horizontally button via DOM click',
      'Verify alignment applied by checking shape positions or visual state'
    ]
  },
  warnings: [
    'Excalidraw canvas requires CDP trusted events (cdpClickAt/cdpDrag) -- content script events are untrusted and ignored',
    'After drawing each shape, Excalidraw auto-switches to selection tool -- re-press the tool shortcut (R, F, etc.) before next draw',
    'Minimum drag distance of 30px needed for Excalidraw to register as a shape draw (not a click)',
    'Use 15+ intermediate steps in cdpDrag with 15ms delay for smooth and reliable shape rendering',
    'Ctrl+A selects ALL shapes including the frame -- if only specific shapes are needed, use shift+click instead',
    'Excalidraw DOM snapshots can be large due to React virtual DOM -- use targeted selectors to minimize token usage',
    'Frame tool (F key) may not be available in all Excalidraw versions -- use large rectangle as fallback',
    'Alignment buttons are standard HTML DOM elements in the toolbar -- use regular click, not CDP events'
  ],
  toolPreferences: ['click', 'press_key', 'cdpClickAt', 'cdpDrag', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
