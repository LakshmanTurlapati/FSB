/**
 * Site Guide: Miro
 * Per-site guide for Miro online whiteboard and collaboration tool.
 *
 * Miro is a React-based canvas app at miro.com.
 * All board content renders on an HTML5 <canvas> element.
 * Sticky notes are created via keyboard shortcut (N), toolbar button, or double-click.
 * Moving/clustering sticky notes requires CDP trusted drag events on the canvas.
 *
 * Created for MCP manual tools (Phase 56, CANVAS-10 diagnostic).
 */

registerSiteGuide({
  site: 'Miro',
  category: 'Design & Whiteboard',
  patterns: [
    /miro\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-10):
- [canvas] Check for login wall first via read_page; if auth required, fallback to Excalidraw
- [canvas] Prefer N key shortcut for sticky note creation over toolbar clicks
- [canvas] Must press V (selection mode) BEFORE dragging -- N mode creates new notes on click
- [canvas] cdpDrag needs 20+ steps, 15ms delay, and 30px+ distance for Miro to register as move
- [canvas] Press Escape after type_text to exit edit mode before next action

MIRO-SPECIFIC INTELLIGENCE:

KEYBOARD SHORTCUTS (preferred over toolbar clicks):
  N = Sticky note tool
  S = Sticky note tool (alternate shortcut)
  V = Select / pointer tool
  Ctrl+A = Select all elements on board
  Ctrl+D = Duplicate selected element(s)
  Delete / Backspace = Delete selected element(s)
  Escape = Deselect / cancel current tool / exit edit mode
  Space+drag = Pan canvas (hold Space, then drag)

CANVAS ELEMENT:
- Miro renders all board content on an HTML5 <canvas> element
- Canvas selectors: canvas, [class*="canvas"], [class*="viewport"]
- Canvas does NOT respond to content script dispatchEvent() -- events are untrusted
- ALL canvas interactions MUST use cdpClickAt and cdpDrag exclusively
- Get canvas bounds via getBoundingClientRect() for accurate viewport coordinates

TOOLBAR STRUCTURE:
- Left-side vertical toolbar or bottom horizontal toolbar with shape/tool icons
- Sticky note tool has a square-with-folded-corner icon
- Look for: [data-testid*="sticky"], [aria-label*="Sticky note"], [aria-label*="Sticky Note"]
- Tool buttons also found via: [class*="sticky-note"], [class*="toolbar"] button
- Active tool shows highlighted/selected state via aria-pressed or class

STICKY NOTE CREATION:
  Method 1 (preferred): Double-click on empty canvas area via cdpClickAt to open quick-add, then type text
  Method 2: Press N to activate sticky note tool, then click on canvas to place note
  Method 3: Click sticky note tool in toolbar, then click on canvas to place note
- After any method, the new sticky note enters edit mode automatically
- Use type_text to enter content while in edit mode
- Press Escape to exit edit mode and deselect the note

TYPING IN STICKY NOTES:
- After creating a sticky note, it enters edit mode automatically
- Use type_text to enter content -- text appears on the note
- Press Escape to exit edit mode when done typing
- Do NOT click elsewhere to exit -- Escape is more reliable

MOVING STICKY NOTES (for clustering):
- Must be in selection mode (V) before dragging -- press V first
- Click on a sticky note center to select it via cdpClickAt
- Drag to target position: cdpDrag(startX, startY, endX, endY, steps=20, stepDelayMs=15)
  where startX/Y is the center of the sticky note and endX/Y is the target cluster location
- Minimum drag distance of 30px needed for Miro to register as a move, not a click
- Use 20+ intermediate steps with 15ms delay for smooth, reliable drag on Miro canvas

ONBOARDING / AUTH:
- Miro may require sign-in for board creation -- if login wall blocks, document as skip-auth outcome
- Onboarding tutorial overlays can be dismissed via Escape or clicking close/skip buttons
- Look for: [class*="onboarding"], [class*="modal"], [class*="overlay"], [data-testid*="close"], [aria-label="Close"]
- Cookie consent banners may appear -- dismiss via accept/close button

BOARD CREATION:
- Miro may offer templates on new board -- skip/dismiss and use blank board
- Look for: [data-testid*="blank"], [class*="blank-board"], text containing "Blank board"
- Click blank board option to start with an empty canvas
- If no template chooser appears, board opens directly to canvas`,
  selectors: {
    canvas: 'canvas, [class*="canvas"], [class*="viewport"]',
    toolbar: '[class*="toolbar"], [role="toolbar"], [data-testid*="toolbar"]',
    stickyNoteTool: '[data-testid*="sticky"], [aria-label*="Sticky note"], [aria-label*="Sticky Note"], [class*="sticky-note-tool"]',
    selectTool: '[data-testid*="select"], [aria-label*="Select"], [class*="select-tool"]',
    onboardingOverlay: '[class*="onboarding"], [class*="modal"], [class*="overlay"], [class*="tutorial"]',
    onboardingClose: '[class*="onboarding"] button[class*="close"], [aria-label="Close"], [data-testid*="close"], [class*="skip"]',
    boardTemplates: '[class*="template"], [data-testid*="template"]',
    blankBoard: '[data-testid*="blank"], [class*="blank"]',
    contextMenu: '[class*="context-menu"], [role="menu"]',
    noteEditor: '[class*="note-editor"], [contenteditable="true"], textarea'
  },
  workflows: {
    createStickyNote: [
      'Dismiss any onboarding overlays or modals (press Escape or click close/skip button)',
      'Activate sticky note tool: press N key via press_key (preferred) or click sticky note tool in toolbar',
      'Click on canvas at desired position via cdpClickAt(x, y) to place the sticky note',
      'Sticky note enters edit mode automatically -- use type_text to enter content',
      'Press Escape via press_key to exit edit mode and deselect the note',
      'Verify note creation via get_dom_snapshot or read_page',
      'Repeat steps 2-5 for each additional sticky note at different positions'
    ],
    dragToCluster: [
      'Press V via press_key to switch to selection/pointer tool',
      'Click on sticky note center via cdpClickAt(x, y) to select it',
      'Drag note to target cluster position: cdpDrag(startX, startY, endX, endY, steps=20, stepDelayMs=15)',
      'Verify note moved to new position (check visually or via read_page)',
      'Repeat steps 2-4 for each note that needs to be moved to the cluster'
    ],
    fullClusteringWorkflow: [
      'Navigate to miro.com and wait for page to load',
      'Handle auth if required -- sign in or document as skip-auth outcome',
      'Dismiss onboarding overlays (Escape key or click close/skip)',
      'Create or open a blank board (click blank board option if template chooser appears)',
      'Create sticky note 1: press N, cdpClickAt(400, 300), type_text "Idea A", press Escape',
      'Create sticky note 2: press N, cdpClickAt(700, 500), type_text "Idea B", press Escape',
      'Create sticky note 3: press N, cdpClickAt(300, 600), type_text "Idea C", press Escape',
      'Switch to selection mode: press V',
      'Drag note 2 to cluster: cdpDrag(700, 500, 450, 350, steps=20, stepDelayMs=15)',
      'Drag note 3 to cluster: cdpDrag(300, 600, 350, 400, steps=20, stepDelayMs=15)',
      'All three notes should now be within ~200px of each other near (400, 350)',
      'Verify clustering via read_page or get_dom_snapshot -- notes in proximity confirms success'
    ]
  },
  warnings: [
    'Miro canvas requires CDP trusted events (cdpClickAt/cdpDrag) -- content script dispatchEvent() events are untrusted and ignored',
    'Miro may require sign-in for board creation -- if login wall appears, document as skip-auth outcome',
    'Dismiss onboarding/tutorial overlays before interacting with the board',
    'After creating a sticky note, it auto-enters edit mode -- type_text works, then press Escape to exit',
    'Must be in selection mode (V) before dragging notes -- N mode will create new notes on click instead of moving',
    'Minimum drag distance of 30px needed for Miro to register as a move, not a click',
    'Use 20+ intermediate steps in cdpDrag with 15ms delay for smooth and reliable drag on Miro canvas',
    'DOM snapshots of Miro can be very large due to React/framework DOM -- use targeted selectors to minimize token usage'
  ],
  toolPreferences: ['click', 'press_key', 'cdpClickAt', 'cdpDrag', 'type_text', 'waitForDOMStable', 'navigate', 'get_dom_snapshot', 'read_page']
});
