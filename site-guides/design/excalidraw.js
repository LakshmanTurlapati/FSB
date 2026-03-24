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
- [canvas] Shape draw pattern: key(tool letter) then drag -- re-press key before each shape
- [canvas] Multi-select: Ctrl+A (all) or shift+click_at on each shape; rubber-band must fully enclose
- [canvas] Alignment buttons are standard DOM elements -- use regular click, not CDP events
- [canvas] React DOM can be very large -- use targeted data-testid selectors to reduce tokens
- [canvas] ALWAYS run session setup first: Escape, Ctrl+A, Delete, Ctrl+0 -- clears modals, old content, and zoom

SESSION SETUP (MANDATORY -- run before ANY drawing):
  Step 1: key Escape                   -- dismiss any welcome modal or dialog
  Step 2: key a --ctrl              -- select all existing elements (Ctrl+A)
  Step 3: key Delete                   -- delete selected elements (clear canvas)
  Step 4: key 0 --ctrl              -- reset zoom to 100% (Ctrl+0)
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
  Shift+Alt+C = Copy canvas as PNG to clipboard
  Ctrl+C = Copy selected elements (Excalidraw format)

CANVAS OPERATIONS (keyboard shortcuts):

  UNDO / REDO (CANVAS-01):
    Undo: key z --ctrl (Ctrl+Z)
    Redo: key y --ctrl (Ctrl+Y)
    Alternative redo: key z --ctrl --shift (Ctrl+Shift+Z)
    NOTE: Undo/redo operate on the Excalidraw internal history stack -- works for draws, deletes, moves, style changes.

  CLEAR CANVAS (CANVAS-02):
    Step 1: key a --ctrl (Ctrl+A) to select all elements
    Step 2: key Delete to delete all selected elements
    NOTE: Use Delete not Backspace -- Delete is more reliable on Excalidraw. This is the same sequence as session setup steps 2-3.

  ZOOM IN (CANVAS-03):
    key = --ctrl (Ctrl+=) to zoom in one step
    Repeat for additional zoom levels.

  ZOOM OUT (CANVAS-03):
    key - --ctrl (Ctrl+-) to zoom out one step
    Repeat for additional zoom levels.

  ZOOM RESET (CANVAS-03):
    key 0 --ctrl (Ctrl+0) to reset zoom to 100%.

  ZOOM TO FIT (CANVAS-06):
    key 1 --shift (Shift+1) to zoom and pan so all elements fit in the viewport.
    NOTE: Only useful when elements exist on canvas. On empty canvas this is a no-op.

  PAN CANVAS (CANVAS-04):
    Hold Space then drag(startX, startY, endX, endY, steps=15, stepDelayMs=15) to pan the viewport.
    Implementation: key Space (keyDown only, do not release), then drag to pan, then release Space.
    Alternative: Use scroll wheel -- scroll(deltaX, deltaY) on the canvas element pans when not over a shape.
    NOTE: Panning shifts the viewport without moving elements. Coordinates in subsequent actions are viewport-relative.

  SELECT ALL (CANVAS-05):
    key a --ctrl (Ctrl+A) to select all elements on the canvas.
    After select-all, shapes show combined selection handles (resize corners around the group).

ELEMENT EDITING (keyboard shortcuts + drag):

    SELECT AND MOVE (EDIT-01):
      Step 1: key V (or 1) to activate selection tool
      Step 2: clickatelementX, elementY) to select the element -- selection handles appear around it
      Step 3: drag(elementX, elementY, newX, newY, steps=15, stepDelayMs=15) to move the element to new position
      NOTE: For multi-select before move, use Ctrl+click (click_at with --ctrl) or rubber-band drag with V tool.
      NOTE: Moving snaps to grid when grid is visible. Hold Alt during drag to disable snapping.

    DELETE ELEMENT (EDIT-02):
      Step 1: clickatelementX, elementY) to select the element
      Step 2: key Delete to delete the selected element
      Alternative: key Backspace also works but Delete is more reliable
      NOTE: For bulk delete, Ctrl+A then Delete clears everything (same as clearCanvas workflow).

    DUPLICATE ELEMENT (EDIT-03):
      Step 1: clickatelementX, elementY) to select the element
      Step 2: key d --ctrl (Ctrl+D) to duplicate -- clone appears offset ~10px right and down
      Alternative: Alt+drag to duplicate and place in one motion -- hold Alt, then drag from element to destination
      NOTE: Duplicate preserves all styles, text, and properties of the original.

    RESIZE ELEMENT (EDIT-04):
      Step 1: clickatelementX, elementY) to select the element -- 8 resize handles appear at corners and midpoints
      Step 2: Identify the resize handle position. Handles are at the element bounding box corners and edge midpoints.
        - Bottom-right corner handle is at approximately (elementX + width/2, elementY + height/2) relative to element center
        - Top-left corner handle is at approximately (elementX - width/2, elementY - height/2)
      Step 3: drag(handleX, handleY, newHandleX, newHandleY, steps=10, stepDelayMs=15) from the handle to the desired new position
      NOTE: Corner handles resize proportionally. Edge midpoint handles resize in one dimension only.
      NOTE: Hold Shift during resize to maintain aspect ratio. Hold Alt to resize from center.

    ROTATE ELEMENT (EDIT-05):
      Step 1: clickatelementX, elementY) to select the element
      Step 2: The rotation handle appears as a small circle above the top edge of the selection box, approximately 20-25px above the top-center
      Step 3: drag(rotateHandleX, rotateHandleY, targetX, targetY, steps=15, stepDelayMs=15) in a circular arc to rotate
      NOTE: Rotation handle position is approximately (elementCenterX, elementTop - 25). Drag clockwise to rotate clockwise.
      NOTE: Hold Shift while dragging to snap rotation to 15-degree increments.

    GROUP ELEMENTS (EDIT-06):
      Step 1: Multi-select elements via Ctrl+A (all) or shift+clickat on each element, or rubber-band selection with V tool
      Step 2: key g --ctrl (Ctrl+G) to group selected elements -- they now move/scale as a unit
      UNGROUP: select the group, then key g --ctrl --shift (Ctrl+Shift+G) to ungroup
      NOTE: Grouped elements share selection handles. Double-click a group to enter it and select individual elements.
      NOTE: Groups can be nested (group of groups).

    LOCK ELEMENT (EDIT-07):
      Step 1: clickatelementX, elementY) to select the element
      Step 2: Right-click the element to open context menu (or look for lock icon in the properties toolbar)
      Step 3: Click the "Lock" option in context menu, or click the lock icon button in the toolbar
      Alternative keyboard shortcut: There is no dedicated keyboard shortcut for lock in default Excalidraw -- use context menu
      UNLOCK: Select locked element, right-click, choose "Unlock" from context menu
      NOTE: Locked elements cannot be moved, resized, or rotated. They can still be selected and deleted.
      NOTE: Lock icon selector: look for [aria-label*="Lock"] or [data-testid*="lock"] in toolbar/context menu.

    COPY/PASTE STYLE (EDIT-08):
      Step 1: clickatsourceX, sourceY) to select the source element (the one whose style you want to copy)
      Step 2: key c --ctrl --alt (Ctrl+Alt+C) to copy style from the selected element
      Step 3: clickattargetX, targetY) to select the target element (the one to apply the style to)
      Step 4: key v --ctrl --alt (Ctrl+Alt+V) to paste style onto the target element
      NOTE: Style includes stroke color, fill color, stroke width, stroke style, fill pattern, opacity, font properties.
      NOTE: Copy/paste style works across different shape types (e.g., copy rectangle style to ellipse).

CONNECTORS AND ARROWS:

  1. ARROW BINDING TO SHAPES (CONN-01):
    Step 1: Draw two shapes first (e.g., rectangles at known coordinates)
    Step 2: key A to activate arrow tool
    Step 3: drag from the SOURCE shape EDGE to the TARGET shape EDGE using steps=20, stepDelayMs=20
    CRITICAL: Start the drag at the edge midpoint of the source shape, NOT the center. For a 150x80 shape at (200,200): right edge midpoint is (275, 240), bottom edge midpoint is (275, 280), left edge midpoint is (200, 240), top edge midpoint is (237, 200).
    Edge coordinate formula: for a shape with top-left at (x,y) and size (w,h): right-edge=(x+w, y+h/2), left-edge=(x, y+h/2), top-edge=(x+w/2, y), bottom-edge=(x+w/2, y+h).
    Similarly, end the drag at the target shape edge midpoint, not center.
    Endpoints must land within ~5px of shape boundary for Excalidraw to auto-bind.
    NOTE: When bound, moving either shape will keep the arrow attached. Unbound arrows stay fixed in place.
    NOTE: Tool auto-switches to V after drawing -- re-press A before each subsequent arrow.

  2. ELBOW / ORTHOGONAL ROUTING (CONN-02):
    Step 1: Draw an arrow between two shapes (using binding workflow above)
    Step 2: Click the arrow via clickat at the arrow midpoint to select it
    Step 3: In the properties panel that appears, look for the routing/line-type buttons. Excalidraw shows line type options: straight line, curved, and elbow (orthogonal/sharp right-angle segments).
    Step 4: Click the elbow/orthogonal routing button. Selector hints: look for [aria-label*="Elbow"], [aria-label*="elbowed"], or the third line-type icon in the properties panel group. Also try [data-testid*="elbow"] or [data-testid*="sharp"].
    Step 5: The arrow redraws with right-angle segments that route around obstacles.
    NOTE: Elbow routing only applies to arrows/connectors, not to plain lines (L tool).
    NOTE: Default arrow type in Excalidraw is "round" (curved). Elbow is the third option (after straight and round).

  3. ARROWHEAD STYLES (CONN-03):
    Step 1: Click the arrow via clickat at the arrow midpoint to select it
    Step 2: In the properties panel, look for arrowhead endpoint buttons. Excalidraw shows start-point and end-point arrowhead selectors separately.
    Step 3: Click the desired arrowhead style button. Available styles: arrow (default pointed), bar (flat line perpendicular to arrow), dot (circle at endpoint), triangle (filled triangle), none (no arrowhead).
    Selector hints: look for [aria-label*="Arrowhead"], [data-testid*="arrowhead"], or button groups labeled "Start" and "End" in the arrow properties section. The buttons typically show small icons of each arrowhead shape.
    Step 4: To change the START arrowhead (the tail end), click the corresponding button in the start arrowhead group.
    Step 5: To change the END arrowhead (the tip), click the corresponding button in the end arrowhead group.
    NOTE: By default arrows have "none" at start and "arrow" (pointed) at end.
    NOTE: Use arrowhead styles to create: one-way arrows (none/arrow), bidirectional arrows (arrow/arrow), association lines (none/none), or connector-bar diagrams (bar/arrow).

  4. LABELED ARROWS / CONNECTORS (CONN-04):
    Step 1: Click the arrow via clickat at the arrow midpoint to select it
    Step 2: Double-click the arrow via two rapid clickat calls 50ms apart at the arrow midpoint, OR key Enter after selecting the arrow
    Step 3: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus
    Step 4: inserttext "label text" to add the label
    Step 5: key Escape to commit the text
    NOTE: The label appears centered on the arrow midpoint. It moves with the arrow when endpoints are dragged.
    NOTE: To edit an existing arrow label, click arrow to select, press Enter, wait 300ms, Ctrl+A to select existing text, inserttext replacement, Escape to commit -- same as TEXT-03 edit workflow.
    NOTE: Arrow labels use the same transient textarea as shape text -- ALWAYS use inserttext, NEVER the type tool.

STYLING (element visual properties):

  STROKE COLOR (STYLE-01):
    Step 1: clickatelementX, elementY) to select the element
    Step 2: key s to open stroke color picker (keyboard shortcut S)
    Step 3: Click desired color swatch in the color picker panel, OR type hex value in the hex input field
    Step 4: key Escape to close color picker
    Step 5: Click canvas to deselect (clickat on empty area)
    Selector hints: [data-testid="color-stroke"], color picker panel buttons are standard DOM elements
    NOTE: S shortcut toggles the stroke color picker. Clicking a swatch immediately applies the color.

  BACKGROUND/FILL COLOR (STYLE-02):
    Step 1: clickatelementX, elementY) to select the element
    Step 2: key g to open background color picker (keyboard shortcut G -- NOT B)
    Step 3: Click desired color swatch or type hex value in hex input
    Step 4: key Escape to close color picker
    Step 5: Click canvas to deselect
    Selector hints: [data-testid="color-background"], color picker swatches
    NOTE: G shortcut toggles the background color picker. Background color only visible if fill pattern is not transparent.

  STROKE WIDTH (STYLE-03):
    Step 1: clickatelementX, elementY) to select the element
    Step 2: In the properties panel (left side), find stroke width buttons: Thin (1), Bold (2), Extra Bold (3-4)
    Step 3: Click the desired stroke width button
    Selector hints: [data-testid="strokeWidth-thin"], [data-testid="strokeWidth-bold"], [data-testid="strokeWidth-extraBold"], or button group with [aria-label*="Stroke width"] or [aria-label*="stroke width"]
    NOTE: These are standard DOM buttons -- use regular click, not CDP events.

  STROKE STYLE (STYLE-04):
    Step 1: clickatelementX, elementY) to select the element
    Step 2: In the properties panel, find stroke style buttons: Solid, Dashed, Dotted
    Step 3: Click the desired stroke style button
    Selector hints: [data-testid="strokeStyle-solid"], [data-testid="strokeStyle-dashed"], [data-testid="strokeStyle-dotted"], or button group with [aria-label*="Stroke style"]
    NOTE: Standard DOM buttons -- use regular click.

  FILL PATTERN (STYLE-05):
    Step 1: clickatelementX, elementY) to select the element
    Step 2: In the properties panel, find fill pattern buttons: Hachure (default), Cross-hatch, Solid, Transparent
    Step 3: Click the desired fill pattern button
    Selector hints: [data-testid="fill-hachure"], [data-testid="fill-cross-hatch"], [data-testid="fill-solid"], [data-testid="fill-transparent"], or button group with [aria-label*="Fill"]
    NOTE: Standard DOM buttons. Transparent fill hides background color. Hachure is hand-drawn diagonal lines. Cross-hatch is overlapping diagonal lines.

  OPACITY (STYLE-06):
    Step 1: clickatelementX, elementY) to select the element
    Step 2: In the properties panel, find the opacity slider or input field
    Step 3: Click the opacity slider/input, clear it, and type the desired value (0-100)
    Selector hints: [data-testid="opacity"], input[type="range"] near opacity label, or [aria-label*="Opacity"]
    NOTE: Opacity 100 = fully opaque, 0 = fully transparent. Applies to the entire element (stroke + fill + text).

  FONT PROPERTIES (STYLE-07):
    Font size: Select text element, find font size buttons in properties panel: Small (S), Medium (M), Large (L), Extra Large (XL). Selector hints: [data-testid="fontSize-small"], [data-testid="fontSize-medium"], [data-testid="fontSize-large"], [data-testid="fontSize-extraLarge"], or button group with [aria-label*="Font size"]
    Font family: Select text element, find font family radio buttons: Virgil (hand-drawn), Helvetica (clean), Cascadia (monospace). Selector hints: [data-testid="font-family-virgil"], [data-testid="font-family-helvetica"], [data-testid="font-family-cascadia"], or [data-testid="font-family-normal"], [data-testid="font-family-code"]
    Text alignment: Select text element, find alignment buttons: Left, Center, Right. Selector hints: [data-testid="align-left"], [data-testid="align-center"], [data-testid="align-right"], or [aria-label*="Text align"] buttons
    NOTE: Font properties only apply to text elements and shapes containing text. All are standard DOM buttons.

ALIGNMENT AND LAYOUT (multi-element arrangement):

  ALIGN ELEMENTS (ALIGN-01):
    Step 1: Multi-select 2+ elements via Ctrl+A (all) or shift+clickat on each element
    Step 2: After multi-select, alignment buttons appear in the top toolbar/properties bar
    Step 3: Click the desired alignment button:
      - Align left: aligns all elements to the leftmost element's left edge
      - Align center horizontally: centers all elements on the horizontal midpoint
      - Align right: aligns all elements to the rightmost element's right edge
      - Align top: aligns all elements to the topmost element's top edge
      - Align center vertically: centers all elements on the vertical midpoint
      - Align bottom: aligns all elements to the bottommost element's bottom edge
    Selector hints: [aria-label="Align left"], [aria-label="Center horizontally"], [aria-label="Align right"], [aria-label="Align top"], [aria-label="Center vertically"], [aria-label="Align bottom"]
    NOTE: Standard DOM buttons -- use regular click, not CDP. Requires 2+ elements selected.
    Alternative keyboard shortcuts: Ctrl+Shift+Left (align left), Ctrl+Shift+Right (align right), Ctrl+Shift+Up (align top), Ctrl+Shift+Down (align bottom)

  DISTRIBUTE ELEMENTS (ALIGN-02):
    Step 1: Multi-select 3+ elements via Ctrl+A (all) or shift+clickat on each
    Step 2: After multi-select of 3+ elements, distribute buttons appear in the toolbar
    Step 3: Click the desired distribute button:
      - Distribute horizontally: spaces elements evenly along horizontal axis
      - Distribute vertically: spaces elements evenly along vertical axis
    Selector hints: [aria-label="Distribute horizontally"], [aria-label="Distribute vertically"], [data-testid="distribute-horizontally"], [data-testid="distribute-vertically"]
    NOTE: Requires 3+ elements selected. Distribution uses equal spacing between element edges, not centers.

  LAYER ORDERING (ALIGN-03):
    Step 1: clickatelementX, elementY) to select the element to reorder
    Step 2: Use keyboard shortcuts to change layer position:
      - Bring forward one layer: key ] --ctrl (Ctrl+])
      - Send backward one layer: key [ --ctrl (Ctrl+[)
      - Bring to front (topmost): key ] --ctrl --shift (Ctrl+Shift+])
      - Send to back (bottommost): key [ --ctrl --shift (Ctrl+Shift+[)
    NOTE: Layer ordering determines which elements render on top of others. Useful when shapes overlap.
    NOTE: These are keyboard shortcuts, not DOM buttons -- use key.

CANVAS ELEMENT:
- The main drawing canvas is rendered as an HTML5 <canvas> element
- Canvas selector: canvas.interactive (the primary interactive canvas layer)
- Excalidraw renders multiple canvas layers; the interactive one handles mouse events
- Canvas does NOT respond to content script dispatchEvent() -- use clickat/drag exclusively
- Get canvas bounds via getBoundingClientRect() for accurate viewport coordinates

TOOLBAR STRUCTURE:
- Top toolbar contains shape tools as icon buttons
- Toolbar container: .App-toolbar, [class*="toolbar"], .Island (floating toolbar island)
- Individual tool buttons: [data-testid="toolbar-rectangle"], [data-testid="toolbar-diamond"], etc.
- The active tool button has an "active" or "selected" visual state (aria-checked or class)
- Style controls (color, stroke, fill) appear in a left side panel when a shape is selected

FRAME TOOL:
- Press F to activate the frame tool
- Draw a frame by dragging on the canvas (drag from top-left to bottom-right)
- Frames act as containers/groups for shapes drawn inside them
- Frame shows a title/label at the top (editable by double-clicking)
- If F key does not activate frame tool, use a large rectangle as a visual frame instead

DRAWING SHAPES ON CANVAS:
- Activate the tool via keyboard shortcut (e.g., press R for rectangle)
- Draw the shape by dragging on canvas: drag(startX, startY, endX, endY, steps=15, stepDelayMs=15)
- Minimum drag distance should be 50+ pixels for Excalidraw to register as a shape (not a click)
- After drawing, Excalidraw auto-switches back to selection tool (V) -- re-press R before each rectangle
- Shapes appear as DOM-accessible SVG-like objects tracked by Excalidraw internal state

DRAWING PRIMITIVES (per-shape workflows):
  RECTANGLE (DRAW-01): key R, then drag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag in both axes. Tool auto-switches to V after draw -- re-press R before next rectangle.
  ELLIPSE (DRAW-02): key O, then drag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag in both axes. Tool auto-switches to V after draw -- re-press O before next ellipse.
  DIAMOND (DRAW-03): key D, then drag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag in both axes. Tool auto-switches to V after draw -- re-press D before next diamond.
  LINE (DRAW-04): key L, then drag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Min 50px drag. Tool auto-switches to V after draw -- re-press L before next line.
  ARROW (DRAW-05): key A, then drag(startX, startY, endX, endY, steps=20, stepDelayMs=20). Use 20+ steps for reliable arrow binding to shapes. Min 50px drag. Tool auto-switches to V after draw -- re-press A before next arrow.
  FREEDRAW (DRAW-06): key P, then drag(startX, startY, endX, endY, steps=30, stepDelayMs=10). Use 30+ steps for smooth freehand stroke. Tool auto-switches to V after draw -- re-press P before next stroke.
  FRAME (DRAW-07): key F, then drag(startX, startY, endX, endY, steps=15, stepDelayMs=15). Frames act as named containers for shapes inside them. Double-click frame label to rename. Tool auto-switches to V after draw -- re-press F before next frame.

  CRITICAL RULE: Excalidraw auto-switches to selection tool (V) after EVERY shape draw. You MUST re-press the tool key (R, O, D, L, A, P, F) before each subsequent shape. Without re-pressing, drag creates a selection box instead of a shape. CDP reports success either way so the error is silent.

  COORDINATE CONVENTION: Use 150px horizontal spacing, 120px vertical spacing, and 150x80px default shape size for consistent diagram layouts. Example: first shape at (200, 200), second at (350, 200), third at (500, 200) for a horizontal row.

TEXT ENTRY WORKFLOW (3 modes):

  MODE 1 -- STANDALONE TEXT LABEL (TEXT-01):
    Step 1: key T to activate text tool
    Step 2: clickatx, y) on the canvas where the text should appear -- this creates a new text element and opens the editor
    Step 3: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus
    Step 4: inserttext "your text here" -- text appears in the textarea
    Step 5: key Escape to commit the text and close the textarea
    NOTE: After placing text, tool auto-switches to V. Re-press T before placing the next standalone text.

  MODE 2 -- TEXT INSIDE A SHAPE (TEXT-02):
    Step 1: Double-click the shape center via two rapid clickatshapeX, shapeY) calls (50ms apart) -- this opens the in-shape text editor
    Alternative: Click the shape once via clickat to select it, then key Enter to open the text editor
    Step 2: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus
    Step 3: inserttext "your label text" -- text appears inside the shape
    Step 4: key Escape to commit the text and close the textarea
    NOTE: The text will be centered within the shape boundary automatically.

  MODE 3 -- EDIT EXISTING TEXT (TEXT-03):
    Step 1: Click the text element or shape with text via clickatelementX, elementY) to select it
    Step 2: key Enter to re-open the text editor on the selected element
    Step 3: Wait 300ms for transient textarea.excalidraw-wysiwyg to mount -- it will contain the existing text
    Step 4: Select all existing text: key a --ctrl (Ctrl+A inside the textarea selects textarea content, not canvas elements)
    Step 5: inserttext "replacement text" -- overwrites the selected text
    Step 6: key Escape to commit the updated text
    NOTE: To append instead of replace, skip Step 4 and just inserttext the additional text.

  COMMON RULES FOR ALL TEXT MODES:
    - ALWAYS use inserttext, NEVER use the type tool -- the textarea is transient and not in DOM snapshots
    - ALWAYS wait 300ms after activating text mode before inserttext
    - ALWAYS press Escape to commit -- clicking elsewhere may lose the text
    - For multi-line text, use key Enter (without ctrl) between lines within the textarea
    - The textarea class is excalidraw-wysiwyg -- if you need to verify it mounted, check for this class in DOM

MULTI-SELECT SHAPES:
Method 1 (recommended): Ctrl+A via key with key=a, --ctrl -- selects ALL shapes on canvas
Method 2: Shift+click each shape using click_at with --shift at each shape center coordinate
Method 3: Selection box -- press V (selection tool), then drag over the area containing all shapes
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
- Stroke width options and style options appear as button groups

EXPORT (EXPORT-01, EXPORT-02, EXPORT-03):

  PNG TO CLIPBOARD (EXPORT-01):
    key c --shift --alt (Shift+Alt+C) -- copies entire canvas as PNG image to clipboard
    NOTE: This is the fastest and most reliable export method -- zero DOM interaction, no dialogs.
    NOTE: Works on entire canvas content (all elements). Select specific elements first if you want partial export.
    NOTE: After copying, the user can paste (Ctrl+V) into any application that accepts images.

  SVG EXPORT (EXPORT-02):
    Step 1: Open export dialog via hamburger menu -- click the menu button (top-left, [class*="menu"], [aria-label="Menu"]) or find the export option
    Step 2: Click "Export image" or similar option in the dropdown menu
    Step 3: In the export dialog, find format selection -- look for SVG radio/button ([data-testid*="svg"], [aria-label*="SVG"])
    Step 4: Click the SVG format option to switch from PNG to SVG
    Step 5: Click the "Export" or "Download" button to download the SVG file
    Step 6: Press Escape to close the export dialog
    NOTE: SVG export requires menu navigation -- no keyboard shortcut exists for direct SVG download.
    NOTE: The export dialog may also offer options for background color and dark mode.

  CLIPBOARD COPY (EXPORT-03):
    Step 1: Select elements to copy -- key(a, --ctrl) for all, or clickat on a specific element
    Step 2: key c --ctrl (Ctrl+C) -- copies selected elements to clipboard in Excalidraw format
    NOTE: Ctrl+C copies the Excalidraw element data, not a rendered image. Pasting (Ctrl+V) works within Excalidraw or another Excalidraw instance.
    NOTE: For image clipboard (PNG), use Shift+Alt+C instead (EXPORT-01 above).

NATURAL LANGUAGE DIAGRAM GENERATION (NL-01 through NL-05):

  The AI can autonomously generate diagrams from natural language descriptions by following these layout planning templates and step-by-step sequences. The key principle is: PLAN all coordinates BEFORE drawing anything.

  LAYOUT PLANNING RULES (NL-04, NL-05):
    Grid convention: 150px horizontal spacing, 120px vertical spacing, default shape size 150x80px.
    Planning step: AI MUST use # comment lines in its first iteration to plan ALL coordinates before drawing anything.
    Execution sequence: plan layout -> draw shapes -> add text labels -> draw connectors -> (optional) align/style.
    Every shape MUST get a text label (per NL-05) -- use in-shape text (double-click shape center, wait 300ms, inserttext, Escape) for rectangles/diamonds/ellipses.
    Every connector MUST get a text label (per NL-05) -- use arrow label workflow (double-click arrow midpoint, wait 300ms, inserttext, Escape).
    Cross-reference: see DRAWING PRIMITIVES for shape draw commands, TEXT ENTRY for labeling modes, CONNECTORS AND ARROWS for arrow binding.

  FLOWCHART TEMPLATE (NL-01):
    Layout: top-to-bottom, single column for linear flow, branches extend right for "No" paths.
    Coordinate template for a 4-step flow:
      Step 1 (rectangle): top-left (300, 200), drag to (450, 280) -- size 150x80
      Step 2 (diamond decision): top-left (300, 320), drag to (450, 400) -- size 150x80
      Step 3a (rectangle, yes branch): top-left (300, 440), drag to (450, 520) -- continues downward
      Step 3b (rectangle, no branch): top-left (550, 320), drag to (700, 400) -- branches right from decision
      Step 4 (rectangle): top-left (300, 560), drag to (450, 640) -- continues below Step 3a
    Connectors:
      Arrow from Step 1 bottom-edge (375, 280) to Step 2 top-edge (375, 320)
      Arrow from Step 2 bottom-edge (375, 400) to Step 3a top-edge (375, 440) -- label "Yes"
      Arrow from Step 2 right-edge (450, 360) to Step 3b left-edge (550, 360) -- label "No"
      Arrow from Step 3a bottom-edge (375, 520) to Step 4 top-edge (375, 560)
    Edge coordinate formula: for shape at (x,y) size (w,h) -- bottom-edge midpoint is (x+w/2, y+h), top-edge midpoint is (x+w/2, y), right-edge midpoint is (x+w, y+h/2), left-edge midpoint is (x, y+h/2).
    All shapes labeled with step names, decision diamond labeled with question text, branch arrows labeled "Yes" / "No".

  ARCHITECTURE DIAGRAM TEMPLATE (NL-02):
    Layout: left-to-right tiers, components stacked vertically within each tier.
    Coordinate template for a 3-tier architecture:
      Tier 1 (Frontend) label: standalone text at (275, 150)
      Tier 1 components: rectangles at (200, 200) to (350, 280), (200, 320) to (350, 400)
      Tier 2 (API/Backend) label: standalone text at (525, 150)
      Tier 2 components: rectangles at (450, 200) to (600, 280), (450, 320) to (600, 400)
      Tier 3 (Database) label: standalone text at (775, 150)
      Tier 3 components: rectangles at (700, 200) to (850, 280), (700, 320) to (850, 400)
    Spacing: horizontal 250px between tier column centers (x=275, 525, 775), vertical 120px between component tops within tier.
    Connectors: horizontal arrows from right-edge of Tier 1 components to left-edge of Tier 2 components, same for Tier 2 to Tier 3.
      Example: arrow from (350, 240) right-edge of Tier 1 row 1 to (450, 240) left-edge of Tier 2 row 1.
    All components labeled with their names, tier labels as standalone text above each column.

  MIND MAP TEMPLATE (NL-03):
    Layout: center node with radial branches extending outward in cardinal directions.
    Coordinate template for a center + 4 branches:
      Center node (ellipse): (525, 340) to (675, 420) -- center at (600, 380)
      Right branch node (rectangle): (800, 340) to (950, 420) -- arrow from center right-edge (675, 380) to node left-edge (800, 380)
      Top branch node (rectangle): (525, 180) to (675, 260) -- arrow from center top-edge (600, 340) to node bottom-edge (600, 260)
      Left branch node (rectangle): (250, 340) to (400, 420) -- arrow from center left-edge (525, 380) to node right-edge (400, 380)
      Bottom branch node (rectangle): (525, 500) to (675, 580) -- arrow from center bottom-edge (600, 420) to node top-edge (600, 500)
    Sub-branches: extend 200px further in same direction from each branch node.
    Center node uses ellipse (O key), branch nodes use rectangles (R key).
    All nodes labeled: center with main topic, branches with subtopics.

  GENERAL SCALING RULES:
    For more than 4 steps in a flowchart, continue adding 120px vertical spacing per row.
    For more tiers or components, add 250px per tier column, 120px per component row.
    For more mind map branches, use diagonal positions (e.g., top-right at (800, 180), bottom-left at (250, 500)).
    If diagram would exceed ~1200px in any direction, note that zoom-to-fit (Shift+1) is needed after drawing.`,
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
    textareaWysiwyg: 'textarea.excalidraw-wysiwyg, textarea[data-type="wysiwyg"]',
    strokeColorPicker: '[data-testid="color-stroke"], [data-testid="stroke-color"]',
    backgroundColorPicker: '[data-testid="color-background"], [data-testid="background-color"]',
    strokeWidthThin: '[data-testid="strokeWidth-thin"]',
    strokeWidthBold: '[data-testid="strokeWidth-bold"]',
    strokeWidthExtraBold: '[data-testid="strokeWidth-extraBold"]',
    strokeStyleSolid: '[data-testid="strokeStyle-solid"]',
    strokeStyleDashed: '[data-testid="strokeStyle-dashed"]',
    strokeStyleDotted: '[data-testid="strokeStyle-dotted"]',
    fillHachure: '[data-testid="fill-hachure"]',
    fillCrossHatch: '[data-testid="fill-cross-hatch"]',
    fillSolid: '[data-testid="fill-solid"]',
    fillTransparent: '[data-testid="fill-transparent"]',
    opacitySlider: '[data-testid="opacity"], input[aria-label*="Opacity"]',
    fontSizeSmall: '[data-testid="fontSize-small"]',
    fontSizeMedium: '[data-testid="fontSize-medium"]',
    fontSizeLarge: '[data-testid="fontSize-large"]',
    fontSizeExtraLarge: '[data-testid="fontSize-extraLarge"]',
    fontFamilyVirgil: '[data-testid="font-family-virgil"], [data-testid="font-family-normal"]',
    fontFamilyHelvetica: '[data-testid="font-family-helvetica"]',
    fontFamilyCascadia: '[data-testid="font-family-cascadia"], [data-testid="font-family-code"]',
    textAlignLeft: '[data-testid="text-align-left"], [aria-label*="Align text left"]',
    textAlignCenter: '[data-testid="text-align-center"], [aria-label*="Align text center"]',
    textAlignRight: '[data-testid="text-align-right"], [aria-label*="Align text right"]',
    exportMenuButton: '[class*="menu"], [aria-label="Menu"], button[class*="hamburger"]',
    exportDialog: '[class*="ExportDialog"], [data-testid*="export"]',
    exportSvgOption: '[data-testid*="svg"], [aria-label*="SVG"]',
    exportDownload: '[data-testid*="export-button"], button[aria-label*="Export"]'
  },
  workflows: {
    sessionSetup: [
      'Press Escape via key to dismiss any welcome modal or dialog',
      'Press Ctrl+A via key(a, --ctrl) to select all existing elements',
      'Press Delete via key to delete all selected elements (clear canvas)',
      'Press Ctrl+0 via key(0, --ctrl) to reset zoom to 100%',
      'Canvas is now clean and ready for drawing'
    ],
    createFrame: [
      'Press F via key to activate frame tool',
      'Draw frame by dragging on canvas: drag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press F before drawing the next frame',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawRectangle: [
      'Press R via key to activate rectangle tool',
      'Draw rectangle by dragging on canvas: drag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press R before drawing the next rectangle',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawEllipse: [
      'Press O via key to activate ellipse tool',
      'Draw ellipse by dragging on canvas: drag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press O before drawing the next ellipse',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawDiamond: [
      'Press D via key to activate diamond tool',
      'Draw diamond by dragging on canvas: drag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag in both axes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press D before drawing the next diamond',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawLine: [
      'Press L via key to activate line tool',
      'Draw line by dragging on canvas: drag(startX, startY, endX, endY, steps=15, stepDelayMs=15) -- minimum 50px drag',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press L before drawing the next line',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawArrow: [
      'Press A via key to activate arrow tool',
      'Draw arrow by dragging on canvas: drag(startX, startY, endX, endY, steps=20, stepDelayMs=20) -- minimum 50px drag, use 20+ steps for reliable arrow binding to shapes',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press A before drawing the next arrow',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    drawFreedraw: [
      'Press P via key to activate freedraw (pencil) tool',
      'Draw freehand stroke by dragging on canvas: drag(startX, startY, endX, endY, steps=30, stepDelayMs=10) -- use 30+ steps for smooth freehand stroke',
      'After drawing, Excalidraw auto-switches to selection tool (V) -- re-press P before drawing the next stroke',
      'Use 150px horizontal spacing and 120px vertical spacing between shapes for consistent layouts'
    ],
    alignShapes: [
      'Multi-select all shapes: key(a, --ctrl) for Ctrl+A to select all',
      'Alternative: shift+click each shape using click_at(x, y, --shift)',
      'Alternative: press V for selection tool, then drag a selection box over all shapes',
      'After multi-select, look for alignment buttons in top toolbar via get_dom_snapshot',
      'Click alignment button (e.g., [aria-label="Align left"]) using DOM click tool',
      'Verify alignment took effect (shapes repositioned to same edge/center)'
    ],
    fullFrameAlignmentWorkflow: [
      'Navigate to excalidraw.com and wait for canvas to load',
      'Run session setup: press Escape (dismiss modals), Ctrl+A then Delete (clear canvas), Ctrl+0 (reset zoom)',
      'Create a frame: press F, then drag to define frame bounds',
      'Draw rectangle 1: press R, drag inside frame area (upper-left region)',
      'Draw rectangle 2: press R, drag inside frame area (middle region, deliberately offset)',
      'Draw rectangle 3: press R, drag inside frame area (lower region, deliberately offset)',
      'Select all shapes: key(a, --ctrl)',
      'Get DOM snapshot to find alignment toolbar buttons',
      'Click align-left or center-horizontally button via DOM click',
      'Verify alignment applied by checking shape positions or visual state'
    ],
    // Generic text entry workflow (backward compatibility). See textStandalone, textInShape, textEdit for mode-specific workflows.
    textEntry: [
      'Activate text mode: press T for standalone text, or double-click shape center via clickat for in-shape text',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type text using inserttext (NOT the type tool)',
      'Press Escape via key to commit text and close textarea',
      'Text is now rendered on the canvas'
    ],
    textStandalone: [
      'Press T via key to activate text tool',
      'Click canvas position via clickatx, y) to create text element and open editor',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type text using inserttext (NOT the type tool)',
      'Press Escape via key to commit text and close textarea',
      'Tool auto-switches to V after text placement -- re-press T for next standalone text'
    ],
    textInShape: [
      'Double-click shape center via two rapid clickatshapeX, shapeY) calls 50ms apart to open in-shape text editor',
      'Alternative: click shape once via clickat to select, then key Enter to open text editor',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type label text using inserttext (NOT the type tool)',
      'Press Escape via key to commit text -- text centers within shape boundary automatically'
    ],
    textEdit: [
      'Click text element or shape with text via clickat to select it',
      'Press Enter via key to re-open text editor on selected element',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount with existing text',
      'Select all existing text: key(a, --ctrl) to select textarea content',
      'Type replacement text using inserttext to overwrite selected text',
      'Press Escape via key to commit updated text'
    ],
    undoRedo: [
      'Undo last action: key(z, --ctrl) -- Ctrl+Z',
      'Redo undone action: key(y, --ctrl) -- Ctrl+Y',
      'Alternative redo: key(z, --ctrl, --shift) -- Ctrl+Shift+Z',
      'Repeat as needed -- undo/redo operate on Excalidraw internal history stack'
    ],
    clearCanvas: [
      'Select all elements: key(a, --ctrl) -- Ctrl+A',
      'Delete all selected: key Delete -- use Delete not Backspace for reliability',
      'Canvas is now empty and ready for new content'
    ],
    zoomIn: [
      'Zoom in one step: key(=, --ctrl) -- Ctrl+=',
      'Repeat key(=, --ctrl) for additional zoom levels'
    ],
    zoomOut: [
      'Zoom out one step: key(-, --ctrl) -- Ctrl+-',
      'Repeat key(-, --ctrl) for additional zoom levels'
    ],
    zoomReset: [
      'Reset zoom to 100%: key(0, --ctrl) -- Ctrl+0'
    ],
    zoomToFit: [
      'Zoom to fit all content: key(1, --shift) -- Shift+1',
      'Viewport adjusts to show all elements -- no-op on empty canvas'
    ],
    panCanvas: [
      'Hold Space key then drag to pan: key Space (hold), drag(startX, startY, endX, endY, steps=15, stepDelayMs=15), release Space',
      'Alternative: scroll on canvas element to pan viewport',
      'Panning shifts viewport without moving elements -- subsequent coordinates are viewport-relative'
    ],
    selectAll: [
      'Select all elements: key(a, --ctrl) -- Ctrl+A',
      'All shapes show combined selection handles (resize corners around group)',
      'Use for bulk operations: delete, move, align, group, duplicate'
    ],
    selectAndMove: [
      'Press V via key to activate selection tool',
      'Click element via clickatelementX, elementY) to select it -- selection handles appear',
      'Drag element to new position via drag(elementX, elementY, newX, newY, steps=15, stepDelayMs=15)',
      'For multi-select: use Ctrl+A (all) or shift+clickat on each element before dragging'
    ],
    deleteElement: [
      'Click element via clickatelementX, elementY) to select it',
      'Press Delete via key to delete the selected element',
      'For bulk delete: key(a, --ctrl) then key Delete'
    ],
    duplicateElement: [
      'Click element via clickatelementX, elementY) to select it',
      'Press Ctrl+D via key(d, --ctrl) to duplicate -- clone appears offset ~10px right and down',
      'Alternative: Alt+drag to duplicate and position in one motion'
    ],
    resizeElement: [
      'Click element via clickatelementX, elementY) to select it -- 8 resize handles appear',
      'Identify target resize handle at corner or edge midpoint of selection box',
      'Drag handle via drag(handleX, handleY, newHandleX, newHandleY, steps=10, stepDelayMs=15)',
      'Corner handles resize proportionally; edge handles resize one dimension only',
      'Hold Shift to maintain aspect ratio; hold Alt to resize from center'
    ],
    rotateElement: [
      'Click element via clickatelementX, elementY) to select it',
      'Rotation handle is a small circle ~25px above the top-center of the selection box',
      'Drag rotation handle via drag(handleX, handleY, targetX, targetY, steps=15, stepDelayMs=15) in circular arc',
      'Hold Shift to snap rotation to 15-degree increments'
    ],
    groupElements: [
      'Multi-select elements: Ctrl+A (all) or shift+clickat on each, or rubber-band with V tool',
      'Press Ctrl+G via key(g, --ctrl) to group -- elements move/scale as a unit',
      'To ungroup: select group, press Ctrl+Shift+G via key(g, --ctrl, --shift)',
      'Double-click a group to enter it and select individual elements inside'
    ],
    lockElement: [
      'Click element via clickatelementX, elementY) to select it',
      'Right-click element to open context menu or find lock icon in properties toolbar',
      'Click Lock option in context menu or lock icon button',
      'To unlock: select locked element, right-click, choose Unlock',
      'Locked elements cannot be moved, resized, or rotated but can be selected and deleted'
    ],
    copyPasteStyle: [
      'Click source element via clickatsourceX, sourceY) to select it',
      'Copy style: key(c, --ctrl, --alt) -- Ctrl+Alt+C',
      'Click target element via clickattargetX, targetY) to select it',
      'Paste style: key(v, --ctrl, --alt) -- Ctrl+Alt+V',
      'Copies stroke color, fill, width, style, opacity, and font properties'
    ],
    arrowBindToShapes: [
      'Draw source and target shapes first (e.g., press R, drag for each rectangle)',
      'Press A via key to activate arrow tool',
      'Calculate source shape edge midpoint: for shape at (x,y) size (w,h), right-edge is (x+w, y+h/2)',
      'Calculate target shape edge midpoint similarly',
      'drag(sourceEdgeX, sourceEdgeY, targetEdgeX, targetEdgeY, steps=20, stepDelayMs=20) -- must land within ~5px of shape boundary for auto-bind',
      'Tool auto-switches to V after draw -- re-press A before next arrow',
      'Verify binding: moving a shape should keep the arrow attached'
    ],
    elbowRouting: [
      'Draw or select an arrow between two shapes',
      'Click arrow midpoint via clickat to select it -- properties panel appears',
      'Find line-type/routing buttons in properties panel: look for [aria-label*="Elbow"] or [data-testid*="elbow"]',
      'Click elbow/orthogonal button (third line-type option after straight and round)',
      'Arrow redraws with right-angle segments routing around obstacles'
    ],
    changeArrowhead: [
      'Click arrow midpoint via clickat to select it -- properties panel appears',
      'Find arrowhead buttons: look for [aria-label*="Arrowhead"] or [data-testid*="arrowhead"]',
      'Two groups: Start arrowhead (tail) and End arrowhead (tip)',
      'Click desired style: arrow (pointed), bar (flat perpendicular), dot (circle), triangle (filled), none',
      'Default is none at start and arrow at end'
    ],
    labelArrow: [
      'Click arrow via clickat at arrow midpoint to select it',
      'Double-click arrow via two rapid clickat calls 50ms apart, or select arrow then key Enter',
      'Wait 300ms for transient textarea.excalidraw-wysiwyg to mount and auto-focus',
      'Type label using inserttext (NOT the type tool)',
      'Press Escape via key to commit label text',
      'Label appears centered on arrow and moves with it when endpoints change'
    ],
    changeStrokeColor: [
      'Click element via clickatelementX, elementY) to select it',
      'Press S via key to open stroke color picker',
      'Click desired color swatch in picker panel, or type hex in hex input field',
      'Press Escape via key to close color picker',
      'Click empty canvas area to deselect'
    ],
    changeFillColor: [
      'Click element via clickatelementX, elementY) to select it',
      'Press G via key to open background color picker',
      'Click desired color swatch in picker panel, or type hex in hex input field',
      'Press Escape via key to close color picker',
      'Ensure fill pattern is not transparent -- background color only visible with hachure, cross-hatch, or solid fill'
    ],
    changeStrokeWidth: [
      'Click element via clickatelementX, elementY) to select it',
      'Find stroke width buttons in properties panel: Thin, Bold, Extra Bold',
      'Click desired width button via DOM click (not CDP) -- [data-testid="strokeWidth-thin"] or similar',
      'Width applies immediately to selected element'
    ],
    changeStrokeStyle: [
      'Click element via clickatelementX, elementY) to select it',
      'Find stroke style buttons in properties panel: Solid, Dashed, Dotted',
      'Click desired style button via DOM click (not CDP) -- [data-testid="strokeStyle-solid"] or similar',
      'Style applies immediately to selected element'
    ],
    changeFillPattern: [
      'Click element via clickatelementX, elementY) to select it',
      'Find fill pattern buttons in properties panel: Hachure, Cross-hatch, Solid, Transparent',
      'Click desired pattern button via DOM click (not CDP) -- [data-testid="fill-hachure"] or similar',
      'Pattern applies immediately -- transparent hides background color, others show it'
    ],
    changeOpacity: [
      'Click element via clickatelementX, elementY) to select it',
      'Find opacity slider or input in properties panel -- [data-testid="opacity"] or [aria-label*="Opacity"]',
      'Set desired opacity value (0-100): click input, select all text, type new value',
      'Opacity 100 = fully opaque, 0 = fully transparent'
    ],
    changeFontProperties: [
      'Click text element or shape with text via clickatelementX, elementY) to select it',
      'For font SIZE: click Small/Medium/Large/XL button in properties panel',
      'For font FAMILY: click Virgil (hand-drawn) / Helvetica (clean) / Cascadia (mono) radio button',
      'For text ALIGNMENT: click Left/Center/Right button in properties panel',
      'All font property buttons are standard DOM elements -- use regular click, not CDP'
    ],
    alignElements: [
      'Multi-select 2+ elements: key(a, --ctrl) for all, or shift+clickat each element',
      'Alignment buttons appear in top toolbar after multi-select',
      'Click desired alignment button via DOM click: [aria-label="Align left"], [aria-label="Center horizontally"], etc.',
      'Alternative: Ctrl+Shift+Arrow keys for directional alignment',
      'Alignment snaps selected elements to same edge or center coordinate'
    ],
    distributeElements: [
      'Multi-select 3+ elements: key(a, --ctrl) for all, or shift+clickat each element',
      'Distribute buttons appear in toolbar after selecting 3+ elements',
      'Click distribute button via DOM click: [aria-label="Distribute horizontally"] or [aria-label="Distribute vertically"]',
      'Elements are spaced evenly along the chosen axis'
    ],
    changeLayerOrder: [
      'Click element via clickatelementX, elementY) to select it',
      'Bring forward one layer: key(], --ctrl) -- Ctrl+]',
      'Send backward one layer: key([, --ctrl) -- Ctrl+[',
      'Bring to front: key(], --ctrl, --shift) -- Ctrl+Shift+]',
      'Send to back: key([, --ctrl, --shift) -- Ctrl+Shift+['
    ],
    exportPngToClipboard: [
      'Select elements to export (Ctrl+A for all, or click specific elements) -- unselected elements are still included in full canvas export',
      'Press Shift+Alt+C via key(c, --shift, --alt) to copy canvas as PNG to clipboard',
      'PNG image is now on clipboard -- user can paste into any image-accepting application'
    ],
    exportSvg: [
      'Click hamburger menu button (top-left area) -- look for [class*="menu"], [aria-label="Menu"], or the three-line icon',
      'Click "Export image" option in dropdown menu',
      'In export dialog, find and click SVG format button -- [data-testid*="svg"], [aria-label*="SVG"], or button with "SVG" text',
      'Click "Export" or "Download" button to save SVG file',
      'Press Escape via key to close export dialog'
    ],
    copyToClipboard: [
      'Select elements to copy: key(a, --ctrl) for all, or clickat on specific elements',
      'Press Ctrl+C via key(c, --ctrl) to copy selected elements in Excalidraw format',
      'Elements are on clipboard -- paste with Ctrl+V in same or different Excalidraw instance'
    ],
    generateFlowchart: [
      'Plan layout: use # comments to list all steps, decisions, and branches with (x,y) coordinates using 150px horizontal / 120px vertical grid',
      'Run session setup: Escape, Ctrl+A, Delete, Ctrl+0',
      'Draw all shapes: press R for rectangles, D for diamonds -- drag each shape at planned coordinates -- re-press tool key before each shape',
      'Add text labels to each shape: double-click shape center via clickat, wait 300ms, inserttext label, press Escape',
      'Draw arrows between shapes: press A, drag from source bottom-edge to target top-edge (20 steps, 20ms delay) -- re-press A before each arrow',
      'Label decision arrows: double-click arrow midpoint, wait 300ms, inserttext Yes or No, press Escape',
      'Zoom to fit: key(1, --shift) to show entire diagram',
      'Verify: count shapes and arrows drawn match the plan -- if missing, draw remaining elements'
    ],
    generateArchitectureDiagram: [
      'Plan layout: use # comments to list all tiers and components with (x,y) coordinates -- tiers left-to-right at 250px spacing, components top-to-bottom at 120px spacing',
      'Run session setup: Escape, Ctrl+A, Delete, Ctrl+0',
      'Add tier labels: press T, clickat tier label position, wait 300ms, inserttext tier name, press Escape -- re-press T before each label',
      'Draw all component shapes: press R, drag each rectangle at planned coordinates -- re-press R before each shape',
      'Add text labels to each component: double-click shape center via clickat, wait 300ms, inserttext component name, press Escape',
      'Draw arrows between tiers: press A, drag from source right-edge to target left-edge (20 steps, 20ms delay) -- re-press A before each arrow',
      'Zoom to fit: key(1, --shift) to show entire diagram',
      'Verify: count shapes, labels, and arrows drawn match the plan -- if missing, draw remaining elements'
    ],
    generateMindMap: [
      'Plan layout: use # comments to list center topic and all branches with (x,y) coordinates -- center at (600,380), branches extending 200px in cardinal directions',
      'Run session setup: Escape, Ctrl+A, Delete, Ctrl+0',
      'Draw center node: press O (ellipse), drag at center coordinates',
      'Label center node: double-click center via clickat, wait 300ms, inserttext main topic, press Escape',
      'Draw branch nodes: press R, drag each rectangle at planned branch coordinates -- re-press R before each shape',
      'Label branch nodes: double-click each branch shape center, wait 300ms, inserttext branch topic, press Escape',
      'Draw arrows from center to branches: press A, drag from center edge to branch edge (20 steps, 20ms delay) -- re-press A before each arrow',
      'Zoom to fit: key(1, --shift) to show entire diagram'
    ]
  },
  warnings: [
    'Excalidraw canvas requires CDP trusted events (clickat/drag) -- content script events are untrusted and ignored',
    'After drawing each shape, Excalidraw auto-switches to selection tool -- re-press the tool shortcut (R, F, etc.) before next draw',
    'Minimum drag distance of 50px in both axes needed for Excalidraw to register as a shape draw (not a click) -- research verified this threshold',
    'Use 15+ intermediate steps in drag with 15ms delay for smooth and reliable shape rendering',
    'Ctrl+A selects ALL shapes including the frame -- if only specific shapes are needed, use shift+click instead',
    'Excalidraw DOM snapshots can be large due to React virtual DOM -- use targeted selectors to minimize token usage',
    'Frame tool (F key) may not be available in all Excalidraw versions -- use large rectangle as fallback',
    'Alignment buttons are standard HTML DOM elements in the toolbar -- use regular click, not CDP events',
    'ALWAYS run session setup (Escape, Ctrl+A, Delete, Ctrl+0) before any Excalidraw automation -- skipping causes stale content, blocked shortcuts, and coordinate errors',
    'For in-shape text (double-click), ensure the clickat coordinates target the CENTER of the shape, not an edge -- edge clicks may start a resize or connector instead of opening the text editor',
    'Pan (Space+drag) requires holding Space before starting drag -- releasing Space mid-drag cancels pan mode',
    'Resize and rotate handles are canvas-rendered (not DOM elements) -- use coordinate offsets from the element bounding box center to target them with drag',
    'Arrow binding requires starting/ending drag at shape EDGE midpoints, not shape centers -- use edge coordinate formula: right-edge=(x+w, y+h/2), left-edge=(x, y+h/2), top-edge=(x+w/2, y), bottom-edge=(x+w/2, y+h)',
    'Arrow labels use the same transient textarea as shape text -- double-click or select+Enter to open editor, inserttext to type, Escape to commit',
    'Stroke color shortcut is S, background color shortcut is G -- do not confuse them. B does NOT open background picker.',
    'Fill pattern must be non-transparent (hachure, cross-hatch, or solid) for background color to be visible',
    'Font property buttons (size, family, alignment) only appear when a text element or shape with text is selected',
    'Layer ordering shortcuts use bracket keys: Ctrl+] forward, Ctrl+[ backward, add Shift for front/back',
    'Distribute requires 3+ elements selected -- with only 2 elements the distribute buttons do not appear',
    'Alignment and distribute buttons are standard DOM elements in the toolbar -- use regular click tool, not CDP events',
    'Shift+Alt+C (PNG to clipboard) exports the entire visible canvas -- not just selected elements',
    'SVG export requires navigating the hamburger menu and export dialog -- there is no keyboard-only shortcut for SVG download',
    'Ctrl+C copies Excalidraw element data (not a rendered image) -- use Shift+Alt+C for a PNG image on clipboard',
    'Natural language diagrams require planning coordinates BEFORE drawing -- use # comment lines to lay out all positions first, then draw shapes, then label, then connect. Skipping the planning step causes overlapping shapes and missed connections.'
  ],
  toolPreferences: ['click', 'key', 'clickat', 'drag', 'inserttext', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
