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
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-02):
- [canvas] Prefer keyboard shortcuts (R, F, V) over toolbar DOM clicks for tool selection
- [canvas] Shape draw pattern: press_key(tool letter) then cdpDrag -- re-press key before each shape
- [canvas] Multi-select: Ctrl+A (all) or shift+click_at on each shape; rubber-band must fully enclose
- [canvas] Alignment buttons are standard DOM elements -- use regular click, not CDP events
- [canvas] React DOM can be very large -- use targeted data-testid selectors to reduce tokens
- [canvas] ALWAYS run session setup first: Escape, Ctrl+A, Delete, Ctrl+0 -- clears modals, old content, and zoom

SESSION SETUP (MANDATORY -- run before ANY drawing):
  Step 1: press_key Escape                   -- dismiss any welcome modal or dialog
  Step 2: press_key a ctrl=true              -- select all existing elements (Ctrl+A)
  Step 3: press_key Delete                   -- delete selected elements (clear canvas)
  Step 4: press_key 0 ctrl=true              -- reset zoom to 100% (Ctrl+0)
  WHY: Excalidraw auto-saves to localStorage. Without clearing, previous session content contaminates new diagrams. Modals from first visit block all keyboard shortcuts. Zoom/pan state affects all coordinate calculations.

EXCALIDRAW-SPECIFIC INTELLIGENCE:

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

TEXT ENTRY WORKFLOW (for typing text on Excalidraw canvas):
  Step 1: Activate text mode -- either press T (standalone text) or double-click a shape via cdpClickAt (in-shape text)
  Step 2: Wait 300ms for the transient textarea to mount (Excalidraw creates textarea.excalidraw-wysiwyg dynamically)
  Step 3: Use cdpInsertText to type the text (NOT the type tool -- the textarea is ephemeral and not in DOM snapshots)
  Step 4: Press Escape via press_key to commit the text and close the textarea
  IMPORTANT: The textarea auto-focuses on creation. Do NOT try to find or click it. Just wait and use cdpInsertText.
  IMPORTANT: Never use the type tool for Excalidraw text -- it cannot find the transient textarea reliably.

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
    sessionSetup: [
      'Press Escape via press_key to dismiss any welcome modal or dialog',
      'Press Ctrl+A via press_key(a, ctrl=true) to select all existing elements',
      'Press Delete via press_key to delete all selected elements (clear canvas)',
      'Press Ctrl+0 via press_key(0, ctrl=true) to reset zoom to 100%',
      'Canvas is now clean and ready for drawing'
    ],
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
      'Run session setup: press Escape (dismiss modals), Ctrl+A then Delete (clear canvas), Ctrl+0 (reset zoom)',
      'Create a frame: press F, then cdpDrag to define frame bounds',
      'Draw rectangle 1: press R, cdpDrag inside frame area (upper-left region)',
      'Draw rectangle 2: press R, cdpDrag inside frame area (middle region, deliberately offset)',
      'Draw rectangle 3: press R, cdpDrag inside frame area (lower region, deliberately offset)',
      'Select all shapes: press_key(a, ctrl=true)',
      'Get DOM snapshot to find alignment toolbar buttons',
      'Click align-left or center-horizontally button via DOM click',
      'Verify alignment applied by checking shape positions or visual state'
    ],
    textEntry: [
      'Activate text mode: press T for standalone text, or double-click shape center via cdpClickAt for in-shape text',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type text using cdpInsertText (NOT the type tool)',
      'Press Escape via press_key to commit text and close textarea',
      'Text is now rendered on the canvas'
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
    'Alignment buttons are standard HTML DOM elements in the toolbar -- use regular click, not CDP events',
    'ALWAYS run session setup (Escape, Ctrl+A, Delete, Ctrl+0) before any Excalidraw automation -- skipping causes stale content, blocked shortcuts, and coordinate errors'
  ],
  toolPreferences: ['click', 'press_key', 'cdpClickAt', 'cdpDrag', 'cdpInsertText', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
