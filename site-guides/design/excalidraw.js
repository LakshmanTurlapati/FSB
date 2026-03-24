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
  Ctrl+Z = Undo last action
  Ctrl+Y = Redo (or Ctrl+Shift+Z)
  Ctrl+Shift+G = Ungroup selected elements
  Ctrl+Alt+C = Copy style from selected element
  Ctrl+Alt+V = Paste style onto selected element
  Ctrl+= = Zoom in
  Ctrl+- = Zoom out
  Ctrl+0 = Reset zoom to 100%
  Shift+1 = Zoom to fit all content

CANVAS OPERATIONS (keyboard shortcuts):

  UNDO / REDO (CANVAS-01):
    Undo: press_key z ctrl=true (Ctrl+Z)
    Redo: press_key y ctrl=true (Ctrl+Y)
    Alternative redo: press_key z ctrl=true shift=true (Ctrl+Shift+Z)
    NOTE: Undo/redo operate on the Excalidraw internal history stack -- works for draws, deletes, moves, style changes.

  CLEAR CANVAS (CANVAS-02):
    Step 1: press_key a ctrl=true (Ctrl+A) to select all elements
    Step 2: press_key Delete to delete all selected elements
    NOTE: Use Delete not Backspace -- Delete is more reliable on Excalidraw. This is the same sequence as session setup steps 2-3.

  ZOOM IN (CANVAS-03):
    press_key = ctrl=true (Ctrl+=) to zoom in one step
    Repeat for additional zoom levels.

  ZOOM OUT (CANVAS-03):
    press_key - ctrl=true (Ctrl+-) to zoom out one step
    Repeat for additional zoom levels.

  ZOOM RESET (CANVAS-03):
    press_key 0 ctrl=true (Ctrl+0) to reset zoom to 100%.

  ZOOM TO FIT (CANVAS-06):
    press_key 1 shift=true (Shift+1) to zoom and pan so all elements fit in the viewport.
    NOTE: Only useful when elements exist on canvas. On empty canvas this is a no-op.

  PAN CANVAS (CANVAS-04):
    Hold Space then cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15) to pan the viewport.
    Implementation: press_key Space (keyDown only, do not release), then cdpDrag to pan, then release Space.
    Alternative: Use scroll wheel -- scroll(deltaX, deltaY) on the canvas element pans when not over a shape.
    NOTE: Panning shifts the viewport without moving elements. Coordinates in subsequent actions are viewport-relative.

  SELECT ALL (CANVAS-05):
    press_key a ctrl=true (Ctrl+A) to select all elements on the canvas.
    After select-all, shapes show combined selection handles (resize corners around the group).

ELEMENT EDITING (keyboard shortcuts + cdpDrag):

    SELECT AND MOVE (EDIT-01):
      Step 1: press_key V (or 1) to activate selection tool
      Step 2: cdpClickAt(elementX, elementY) to select the element -- selection handles appear around it
      Step 3: cdpDrag(elementX, elementY, newX, newY, steps=15, stepDelayMs=15) to move the element to new position
      NOTE: For multi-select before move, use Ctrl+click (click_at with ctrl=true) or rubber-band drag with V tool.
      NOTE: Moving snaps to grid when grid is visible. Hold Alt during drag to disable snapping.

    DELETE ELEMENT (EDIT-02):
      Step 1: cdpClickAt(elementX, elementY) to select the element
      Step 2: press_key Delete to delete the selected element
      Alternative: press_key Backspace also works but Delete is more reliable
      NOTE: For bulk delete, Ctrl+A then Delete clears everything (same as clearCanvas workflow).

    DUPLICATE ELEMENT (EDIT-03):
      Step 1: cdpClickAt(elementX, elementY) to select the element
      Step 2: press_key d ctrl=true (Ctrl+D) to duplicate -- clone appears offset ~10px right and down
      Alternative: Alt+drag to duplicate and place in one motion -- hold Alt, then cdpDrag from element to destination
      NOTE: Duplicate preserves all styles, text, and properties of the original.

    RESIZE ELEMENT (EDIT-04):
      Step 1: cdpClickAt(elementX, elementY) to select the element -- 8 resize handles appear at corners and midpoints
      Step 2: Identify the resize handle position. Handles are at the element bounding box corners and edge midpoints.
        - Bottom-right corner handle is at approximately (elementX + width/2, elementY + height/2) relative to element center
        - Top-left corner handle is at approximately (elementX - width/2, elementY - height/2)
      Step 3: cdpDrag(handleX, handleY, newHandleX, newHandleY, steps=10, stepDelayMs=15) from the handle to the desired new position
      NOTE: Corner handles resize proportionally. Edge midpoint handles resize in one dimension only.
      NOTE: Hold Shift during resize to maintain aspect ratio. Hold Alt to resize from center.

    ROTATE ELEMENT (EDIT-05):
      Step 1: cdpClickAt(elementX, elementY) to select the element
      Step 2: The rotation handle appears as a small circle above the top edge of the selection box, approximately 20-25px above the top-center
      Step 3: cdpDrag(rotateHandleX, rotateHandleY, targetX, targetY, steps=15, stepDelayMs=15) in a circular arc to rotate
      NOTE: Rotation handle position is approximately (elementCenterX, elementTop - 25). Drag clockwise to rotate clockwise.
      NOTE: Hold Shift while dragging to snap rotation to 15-degree increments.

    GROUP ELEMENTS (EDIT-06):
      Step 1: Multi-select elements via Ctrl+A (all) or shift+cdpClickAt on each element, or rubber-band selection with V tool
      Step 2: press_key g ctrl=true (Ctrl+G) to group selected elements -- they now move/scale as a unit
      UNGROUP: select the group, then press_key g ctrl=true shift=true (Ctrl+Shift+G) to ungroup
      NOTE: Grouped elements share selection handles. Double-click a group to enter it and select individual elements.
      NOTE: Groups can be nested (group of groups).

    LOCK ELEMENT (EDIT-07):
      Step 1: cdpClickAt(elementX, elementY) to select the element
      Step 2: Right-click the element to open context menu (or look for lock icon in the properties toolbar)
      Step 3: Click the "Lock" option in context menu, or click the lock icon button in the toolbar
      Alternative keyboard shortcut: There is no dedicated keyboard shortcut for lock in default Excalidraw -- use context menu
      UNLOCK: Select locked element, right-click, choose "Unlock" from context menu
      NOTE: Locked elements cannot be moved, resized, or rotated. They can still be selected and deleted.
      NOTE: Lock icon selector: look for [aria-label*="Lock"] or [data-testid*="lock"] in toolbar/context menu.

    COPY/PASTE STYLE (EDIT-08):
      Step 1: cdpClickAt(sourceX, sourceY) to select the source element (the one whose style you want to copy)
      Step 2: press_key c ctrl=true alt=true (Ctrl+Alt+C) to copy style from the selected element
      Step 3: cdpClickAt(targetX, targetY) to select the target element (the one to apply the style to)
      Step 4: press_key v ctrl=true alt=true (Ctrl+Alt+V) to paste style onto the target element
      NOTE: Style includes stroke color, fill color, stroke width, stroke style, fill pattern, opacity, font properties.
      NOTE: Copy/paste style works across different shape types (e.g., copy rectangle style to ellipse).

CONNECTORS AND ARROWS:

  1. ARROW BINDING TO SHAPES (CONN-01):
    Step 1: Draw two shapes first (e.g., rectangles at known coordinates)
    Step 2: press_key A to activate arrow tool
    Step 3: cdpDrag from the SOURCE shape EDGE to the TARGET shape EDGE using steps=20, stepDelayMs=20
    CRITICAL: Start the drag at the edge midpoint of the source shape, NOT the center. For a 150x80 shape at (200,200): right edge midpoint is (275, 240), bottom edge midpoint is (275, 280), left edge midpoint is (200, 240), top edge midpoint is (237, 200).
    Edge coordinate formula: for a shape with top-left at (x,y) and size (w,h): right-edge=(x+w, y+h/2), left-edge=(x, y+h/2), top-edge=(x+w/2, y), bottom-edge=(x+w/2, y+h).
    Similarly, end the drag at the target shape edge midpoint, not center.
    Endpoints must land within ~5px of shape boundary for Excalidraw to auto-bind.
    NOTE: When bound, moving either shape will keep the arrow attached. Unbound arrows stay fixed in place.
    NOTE: Tool auto-switches to V after drawing -- re-press A before each subsequent arrow.

  2. ELBOW / ORTHOGONAL ROUTING (CONN-02):
    Step 1: Draw an arrow between two shapes (using binding workflow above)
    Step 2: Click the arrow via cdpClickAt at the arrow midpoint to select it
    Step 3: In the properties panel that appears, look for the routing/line-type buttons. Excalidraw shows line type options: straight line, curved, and elbow (orthogonal/sharp right-angle segments).
    Step 4: Click the elbow/orthogonal routing button. Selector hints: look for [aria-label*="Elbow"], [aria-label*="elbowed"], or the third line-type icon in the properties panel group. Also try [data-testid*="elbow"] or [data-testid*="sharp"].
    Step 5: The arrow redraws with right-angle segments that route around obstacles.
    NOTE: Elbow routing only applies to arrows/connectors, not to plain lines (L tool).
    NOTE: Default arrow type in Excalidraw is "round" (curved). Elbow is the third option (after straight and round).

  3. ARROWHEAD STYLES (CONN-03):
    Step 1: Click the arrow via cdpClickAt at the arrow midpoint to select it
    Step 2: In the properties panel, look for arrowhead endpoint buttons. Excalidraw shows start-point and end-point arrowhead selectors separately.
    Step 3: Click the desired arrowhead style button. Available styles: arrow (default pointed), bar (flat line perpendicular to arrow), dot (circle at endpoint), triangle (filled triangle), none (no arrowhead).
    Selector hints: look for [aria-label*="Arrowhead"], [data-testid*="arrowhead"], or button groups labeled "Start" and "End" in the arrow properties section. The buttons typically show small icons of each arrowhead shape.
    Step 4: To change the START arrowhead (the tail end), click the corresponding button in the start arrowhead group.
    Step 5: To change the END arrowhead (the tip), click the corresponding button in the end arrowhead group.
    NOTE: By default arrows have "none" at start and "arrow" (pointed) at end.
    NOTE: Use arrowhead styles to create: one-way arrows (none/arrow), bidirectional arrows (arrow/arrow), association lines (none/none), or connector-bar diagrams (bar/arrow).

  4. LABELED ARROWS / CONNECTORS (CONN-04):
    Step 1: Click the arrow via cdpClickAt at the arrow midpoint to select it
    Step 2: Double-click the arrow via two rapid cdpClickAt calls 50ms apart at the arrow midpoint, OR press_key Enter after selecting the arrow
    Step 3: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus
    Step 4: cdpInsertText "label text" to add the label
    Step 5: press_key Escape to commit the text
    NOTE: The label appears centered on the arrow midpoint. It moves with the arrow when endpoints are dragged.
    NOTE: To edit an existing arrow label, click arrow to select, press Enter, wait 300ms, Ctrl+A to select existing text, cdpInsertText replacement, Escape to commit -- same as TEXT-03 edit workflow.
    NOTE: Arrow labels use the same transient textarea as shape text -- ALWAYS use cdpInsertText, NEVER the type tool.

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
- Minimum drag distance should be 50+ pixels for Excalidraw to register as a shape (not a click)
- After drawing, Excalidraw auto-switches back to selection tool (V) -- re-press R before each rectangle
- Shapes appear as DOM-accessible SVG-like objects tracked by Excalidraw internal state

DRAWING PRIMITIVES (per-shape workflows):
  RECTANGLE (DRAW-01): press_key R, then cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag in both axes. Tool auto-switches to V after draw -- re-press R before next rectangle.
  ELLIPSE (DRAW-02): press_key O, then cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag in both axes. Tool auto-switches to V after draw -- re-press O before next ellipse.
  DIAMOND (DRAW-03): press_key D, then cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag in both axes. Tool auto-switches to V after draw -- re-press D before next diamond.
  LINE (DRAW-04): press_key L, then cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag. Tool auto-switches to V after draw -- re-press L before next line.
  ARROW (DRAW-05): press_key A, then cdpDrag(startX, startY, endX, endY, steps=20, stepDelayMs=20). Use 20+ steps for reliable arrow binding to shapes. Min 50px drag. Tool auto-switches to V after draw -- re-press A before next arrow.
  FREEDRAW (DRAW-06): press_key P, then cdpDrag(startX, startY, endX, endY, steps=30, stepDelayMs=10). Use 30+ steps for smooth freehand stroke. Tool auto-switches to V after draw -- re-press P before next stroke.
  FRAME (DRAW-07): press_key F, then cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Frames act as named containers for shapes inside them. Double-click frame label to rename. Tool auto-switches to V after draw -- re-press F before next frame.

  CRITICAL RULE: Excalidraw auto-switches to selection tool (V) after EVERY shape draw. You MUST re-press the tool key (R, O, D, L, A, P, F) before each subsequent shape. Without re-pressing, cdpDrag creates a selection box instead of a shape. CDP reports success either way so the error is silent.

  COORDINATE CONVENTION: Use 150px horizontal spacing, 120px vertical spacing, and 150x80px default shape size for consistent diagram layouts. Example: first shape at (200, 200), second at (350, 200), third at (500, 200) for a horizontal row.

TEXT ENTRY WORKFLOW (3 modes):

  MODE 1 -- STANDALONE TEXT LABEL (TEXT-01):
    Step 1: press_key T to activate text tool
    Step 2: cdpClickAt(x, y) on the canvas where the text should appear -- this creates a new text element and opens the editor
    Step 3: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus
    Step 4: cdpInsertText "your text here" -- text appears in the textarea
    Step 5: press_key Escape to commit the text and close the textarea
    NOTE: After placing text, tool auto-switches to V. Re-press T before placing the next standalone text.

  MODE 2 -- TEXT INSIDE A SHAPE (TEXT-02):
    Step 1: Double-click the shape center via two rapid cdpClickAt(shapeX, shapeY) calls (50ms apart) -- this opens the in-shape text editor
    Alternative: Click the shape once via cdpClickAt to select it, then press_key Enter to open the text editor
    Step 2: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus
    Step 3: cdpInsertText "your label text" -- text appears inside the shape
    Step 4: press_key Escape to commit the text and close the textarea
    NOTE: The text will be centered within the shape boundary automatically.

  MODE 3 -- EDIT EXISTING TEXT (TEXT-03):
    Step 1: Click the text element or shape with text via cdpClickAt(elementX, elementY) to select it
    Step 2: press_key Enter to re-open the text editor on the selected element
    Step 3: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount -- it will contain the existing text
    Step 4: Select all existing text: press_key a ctrl=true (Ctrl+A inside the textarea selects textarea content, not canvas elements)
    Step 5: cdpInsertText "replacement text" -- overwrites the selected text
    Step 6: press_key Escape to commit the updated text
    NOTE: To append instead of replace, skip Step 4 and just cdpInsertText the additional text.

  COMMON RULES FOR ALL TEXT MODES:
    - ALWAYS use cdpInsertText, NEVER use the type tool -- the textarea is transient and not in DOM snapshots
    - ALWAYS wait 300ms after activating text mode before cdpInsertText
    - ALWAYS press Escape to commit -- clicking elsewhere may lose the text
    - For multi-line text, use press_key Enter (without ctrl) between lines within the textarea
    - The textarea class is excalidraw-wysiwyg -- if you need to verify it mounted, check for this class in DOM

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
    layerUI: '.layer-ui__wrapper, [class*="layer-ui"]',
    textareaWysiwyg: 'textarea.excalidraw-wysiwyg, textarea[data-type="wysiwyg"]'
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
      'Press F via press_key to activate frame tool',
      'Draw frame by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press F before drawing the next frame',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawRectangle: [
      'Press R via press_key to activate rectangle tool',
      'Draw rectangle by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press R before drawing the next rectangle',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawEllipse: [
      'Press O via press_key to activate ellipse tool',
      'Draw ellipse by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press O before drawing the next ellipse',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawDiamond: [
      'Press D via press_key to activate diamond tool',
      'Draw diamond by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press D before drawing the next diamond',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawLine: [
      'Press L via press_key to activate line tool',
      'Draw line by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press L before drawing the next line',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawArrow: [
      'Press A via press_key to activate arrow tool',
      'Draw arrow by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=20, stepDelayMs=20) -- minimum 50px drag, use 20+ steps for reliable arrow binding to shapes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press A before drawing the next arrow',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawFreedraw: [
      'Press P via press_key to activate freedraw (pencil) tool',
      'Draw freehand stroke by dragging on canvas: cdpDrag(startX, startY, endX, endY, steps=30, stepDelayMs=10) -- use 30+ steps for smooth freehand stroke',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press P before drawing the next stroke',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
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
    // Generic text entry workflow (backward compatibility). See textStandalone, textInShape, textEdit for mode-specific workflows.
    textEntry: [
      'Activate text mode: press T for standalone text, or double-click shape center via cdpClickAt for in-shape text',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type text using cdpInsertText (NOT the type tool)',
      'Press Escape via press_key to commit text and close textarea',
      'Text is now rendered on the canvas'
    ],
    textStandalone: [
      'Press T via press_key to activate text tool',
      'Click canvas position via cdpClickAt(x, y) to create text element and open editor',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type text using cdpInsertText (NOT the type tool)',
      'Press Escape via press_key to commit text and close textarea',
      'Tool auto-switches to V after text placement -- re-press T for next standalone text'
    ],
    textInShape: [
      'Double-click shape center via two rapid cdpClickAt(shapeX, shapeY) calls 50ms apart to open in-shape text editor',
      'Alternative: click shape once via cdpClickAt to select, then press_key Enter to open text editor',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type label text using cdpInsertText (NOT the type tool)',
      'Press Escape via press_key to commit text -- text centers within shape boundary automatically'
    ],
    textEdit: [
      'Click text element or shape with text via cdpClickAt to select it',
      'Press Enter via press_key to re-open text editor on selected element',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount with existing text',
      'Select all existing text: press_key(a, ctrl=true) to select textarea content',
      'Type replacement text using cdpInsertText to overwrite selected text',
      'Press Escape via press_key to commit updated text'
    ],
    undoRedo: [
      'Undo last action: press_key(z, ctrl=true) -- Ctrl+Z',
      'Redo undone action: press_key(y, ctrl=true) -- Ctrl+Y',
      'Alternative redo: press_key(z, ctrl=true, shift=true) -- Ctrl+Shift+Z',
      'Repeat as needed -- undo/redo operate on Excalidraw internal history stack'
    ],
    clearCanvas: [
      'Select all elements: press_key(a, ctrl=true) -- Ctrl+A',
      'Delete all selected: press_key Delete -- use Delete not Backspace for reliability',
      'Canvas is now empty and ready for new content'
    ],
    zoomIn: [
      'Zoom in one step: press_key(=, ctrl=true) -- Ctrl+=',
      'Repeat press_key(=, ctrl=true) for additional zoom levels'
    ],
    zoomOut: [
      'Zoom out one step: press_key(-, ctrl=true) -- Ctrl+-',
      'Repeat press_key(-, ctrl=true) for additional zoom levels'
    ],
    zoomReset: [
      'Reset zoom to 100%: press_key(0, ctrl=true) -- Ctrl+0'
    ],
    zoomToFit: [
      'Zoom to fit all content: press_key(1, shift=true) -- Shift+1',
      'Viewport adjusts to show all elements -- no-op on empty canvas'
    ],
    panCanvas: [
      'Hold Space key then drag to pan: press_key Space (hold), cdpDrag(startX, startY, endX, endY, steps=15, stepDelayMs=15), release Space',
      'Alternative: scroll on canvas element to pan viewport',
      'Panning shifts viewport without moving elements -- subsequent coordinates are viewport-relative'
    ],
    selectAll: [
      'Select all elements: press_key(a, ctrl=true) -- Ctrl+A',
      'All shapes show combined selection handles (resize corners around group)',
      'Use for bulk operations: delete, move, align, group, duplicate'
    ],
    selectAndMove: [
      'Press V via press_key to activate selection tool',
      'Click element via cdpClickAt(elementX, elementY) to select it -- selection handles appear',
      'Drag element to new position via cdpDrag(elementX, elementY, newX, newY, steps=15, stepDelayMs=15)',
      'For multi-select: use Ctrl+A (all) or shift+cdpClickAt on each element before dragging'
    ],
    deleteElement: [
      'Click element via cdpClickAt(elementX, elementY) to select it',
      'Press Delete via press_key to delete the selected element',
      'For bulk delete: press_key(a, ctrl=true) then press_key Delete'
    ],
    duplicateElement: [
      'Click element via cdpClickAt(elementX, elementY) to select it',
      'Press Ctrl+D via press_key(d, ctrl=true) to duplicate -- clone appears offset ~10px right and down',
      'Alternative: Alt+drag to duplicate and position in one motion'
    ],
    resizeElement: [
      'Click element via cdpClickAt(elementX, elementY) to select it -- 8 resize handles appear',
      'Identify target resize handle at corner or edge midpoint of selection box',
      'Drag handle via cdpDrag(handleX, handleY, newHandleX, newHandleY, steps=10, stepDelayMs=15)',
      'Corner handles resize proportionally; edge handles resize one dimension only',
      'Hold Shift to maintain aspect ratio; hold Alt to resize from center'
    ],
    rotateElement: [
      'Click element via cdpClickAt(elementX, elementY) to select it',
      'Rotation handle is a small circle ~25px above the top-center of the selection box',
      'Drag rotation handle via cdpDrag(handleX, handleY, targetX, targetY, steps=15, stepDelayMs=15) in circular arc',
      'Hold Shift to snap rotation to 15-degree increments'
    ],
    groupElements: [
      'Multi-select elements: Ctrl+A (all) or shift+cdpClickAt on each, or rubber-band with V tool',
      'Press Ctrl+G via press_key(g, ctrl=true) to group -- elements move/scale as a unit',
      'To ungroup: select group, press Ctrl+Shift+G via press_key(g, ctrl=true, shift=true)',
      'Double-click a group to enter it and select individual elements inside'
    ],
    lockElement: [
      'Click element via cdpClickAt(elementX, elementY) to select it',
      'Right-click element to open context menu or find lock icon in properties toolbar',
      'Click Lock option in context menu or lock icon button',
      'To unlock: select locked element, right-click, choose Unlock',
      'Locked elements cannot be moved, resized, or rotated but can be selected and deleted'
    ],
    copyPasteStyle: [
      'Click source element via cdpClickAt(sourceX, sourceY) to select it',
      'Copy style: press_key(c, ctrl=true, alt=true) -- Ctrl+Alt+C',
      'Click target element via cdpClickAt(targetX, targetY) to select it',
      'Paste style: press_key(v, ctrl=true, alt=true) -- Ctrl+Alt+V',
      'Copies stroke color, fill, width, style, opacity, and font properties'
    ],
    arrowBindToShapes: [
      'Draw source and target shapes first (e.g., press R, cdpDrag for each rectangle)',
      'Press A via press_key to activate arrow tool',
      'Calculate source shape edge midpoint: for shape at (x,y) size (w,h), right-edge is (x+w, y+h/2)',
      'Calculate target shape edge midpoint similarly',
      'cdpDrag(sourceEdgeX, sourceEdgeY, targetEdgeX, targetEdgeY, steps=20, stepDelayMs=20) -- must land within ~5px of shape boundary for auto-bind',
      'Tool auto-switches to V after draw -- re-press A before next arrow',
      'Verify binding: moving a shape should keep the arrow attached'
    ],
    elbowRouting: [
      'Draw or select an arrow between two shapes',
      'Click arrow midpoint via cdpClickAt to select it -- properties panel appears',
      'Find line-type/routing buttons in properties panel: look for [aria-label*="Elbow"] or [data-testid*="elbow"]',
      'Click elbow/orthogonal button (third line-type option after straight and round)',
      'Arrow redraws with right-angle segments routing around obstacles'
    ],
    changeArrowhead: [
      'Click arrow midpoint via cdpClickAt to select it -- properties panel appears',
      'Find arrowhead buttons: look for [aria-label*="Arrowhead"] or [data-testid*="arrowhead"]',
      'Two groups: Start arrowhead (tail) and End arrowhead (tip)',
      'Click desired style: arrow (pointed), bar (flat perpendicular), dot (circle), triangle (filled), none',
      'Default is none at start and arrow at end'
    ],
    labelArrow: [
      'Click arrow via cdpClickAt at arrow midpoint to select it',
      'Double-click arrow via two rapid cdpClickAt calls 50ms apart, or select arrow then press_key Enter',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type label using cdpInsertText (NOT the type tool)',
      'Press Escape via press_key to commit label text',
      'Label appears centered on arrow and moves with it when endpoints change'
    ]
  },
  warnings: [
    'Excalidraw canvas requires CDP trusted events (cdpClickAt/cdpDrag) -- content script events are untrusted and ignored',
    'After drawing each shape, Excalidraw auto-switches to selection tool -- re-press the tool shortcut (R, F, etc.) before next draw',
    'Minimum drag distance of 50px in both axes needed for Excalidraw to register as a shape draw (not a click) -- research verified this threshold',
    'Use 15+ intermediate steps in cdpDrag with 15ms delay for smooth and reliable shape rendering',
    'Ctrl+A selects ALL shapes including the frame -- if only specific shapes are needed, use shift+click instead',
    'Excalidraw DOM snapshots can be large due to React virtual DOM -- use targeted selectors to minimize token usage',
    'Frame tool (F key) may not be available in all Excalidraw versions -- use large rectangle as fallback',
    'Alignment buttons are standard HTML DOM elements in the toolbar -- use regular click, not CDP events',
    'ALWAYS run session setup (Escape, Ctrl+A, Delete, Ctrl+0) before any Excalidraw automation -- skipping causes stale content, blocked shortcuts, and coordinate errors',
    'For in-shape text (double-click), ensure the cdpClickAt coordinates target the CENTER of the shape, not an edge -- edge clicks may start a resize or connector instead of opening the text editor',
    'Pan (Space+drag) requires holding Space before starting cdpDrag -- releasing Space mid-drag cancels pan mode',
    'Resize and rotate handles are canvas-rendered (not DOM elements) -- use coordinate offsets from the element bounding box center to target them with cdpDrag',
    'Arrow binding requires starting/ending cdpDrag at shape EDGE midpoints, not shape centers -- use edge coordinate formula: right-edge=(x+w, y+h/2), left-edge=(x, y+h/2), top-edge=(x+w/2, y), bottom-edge=(x+w/2, y+h)',
    'Arrow labels use the same transient textarea as shape text -- double-click or select+Enter to open editor, cdpInsertText to type, Escape to commit'
  ],
  toolPreferences: ['click', 'press_key', 'cdpClickAt', 'cdpDrag', 'cdpInsertText', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
