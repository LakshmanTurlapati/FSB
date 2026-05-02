/**
 * Site Guide: Photopea
 * Per-site guide for the Photopea online image editor (Photoshop alternative).
 *
 * Photopea is a web-based raster/vector image editor at photopea.com.
 * IMPORTANT: Photopea renders its ENTIRE UI on a single HTML5 canvas element.
 * There are NO DOM elements for toolbars, menus, dialogs, or any editor feature.
 * ALL interaction must use CDP click_at with pixel coordinates or keyboard shortcuts.
 * DOM selectors below are INVALID -- kept as reference only. Use keyboard shortcuts.
 * Keyboard shortcuts mirror Adobe Photoshop conventions.
 *
 * Tested via MCP manual tools (Phase 51, CANVAS-05 diagnostic).
 */

registerSiteGuide({
  site: 'Photopea',
  category: 'Design & Whiteboard',
  patterns: [
    /photopea\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-05):
- [canvas] ENTIRE UI is canvas-rendered -- NO DOM elements for toolbar, menus, or dialogs
- [canvas] Prefer keyboard shortcuts (W=Magic Wand, B=Brush) -- only reliable tool selection
- [canvas] Use URL hash (photopea.com#open:IMAGE_URL) to load images -- avoids menu interaction
- [canvas] Click image corners (offset+10px) for background selection with Magic Wand
- [canvas] Splash/ad dialog is canvas-painted; Escape does NOT work -- use URL hash to bypass

PHOTOPEA-SPECIFIC INTELLIGENCE:

KEYBOARD SHORTCUTS (preferred for tool selection):
  W = Magic Wand tool (Shift+W toggles to Quick Selection)
  V = Move tool
  M = Rectangular Marquee (Shift+M for Elliptical)
  L = Lasso tool (Shift+L for Polygonal/Magnetic)
  C = Crop tool
  B = Brush tool
  E = Eraser tool
  T = Text tool
  G = Paint Bucket / Gradient (Shift+G toggles)
  I = Eyedropper / Color Sampler (Shift+I toggles)
  Z = Zoom tool
  H = Hand tool (pan canvas)
  Delete/Backspace = Clear selected area (removes background when selected)
  Ctrl+D = Deselect all
  Ctrl+A = Select All
  Ctrl+Z = Undo
  Ctrl+Shift+Z = Redo
  Ctrl+Shift+I = Invert Selection
  Ctrl+J = Duplicate Layer
  Ctrl+T = Free Transform
  Ctrl+0 = Fit canvas to window

CANVAS ELEMENT:
- The main image editing canvas is an HTML5 <canvas> element inside a scrollable viewport
- Canvas selector: #canvas or canvas within the main editor area
- Photopea uses a single large canvas element for the image editing viewport
- Canvas does NOT respond to content script dispatchEvent() -- use CDP click_at exclusively
- Get canvas bounds via getBoundingClientRect() for coordinate calculations
- The canvas is centered in the editor workspace and may have scrollbars around it

TOOLBAR STRUCTURE (all canvas-rendered -- NO DOM elements):
- Left vertical toolbar contains tool icons (Photoshop-like column) -- CANVAS PAINTED
- Tools are grouped: selection tools (top), drawing tools (middle), utility tools (bottom)
- Magic Wand is grouped with Quick Selection tool -- use W key (Shift+W to toggle)
- Menu bar at top: File, Edit, Image, Layer, Select, Filter, View, Window, More -- CANVAS PAINTED
- Tool options bar below menu bar -- CANVAS PAINTED
- Layers panel on right side -- CANVAS PAINTED
- CRITICAL: All toolbar, menu, and panel elements are PIXEL-RENDERED on canvas
- DOM selectors CANNOT target any Photopea UI element
- Use keyboard shortcuts (preferred) or click_at with known pixel coordinates

SPLASH DIALOG (canvas-rendered):
- Photopea shows a welcome/splash with ad, recent files, and "New Project" button
- The splash is CANVAS PAINTED -- not a DOM dialog
- Escape key does NOT dismiss it (tested live)
- "Skip Ad" countdown appears (also canvas-rendered)
- To bypass: use Photopea API URL hash (photopea.com#open:IMAGE_URL) to load image directly
- Photopea may also show ads -- these appear as banners (typically right side or top)
- Ad banners do not block canvas interaction but may reduce visible workspace

IMAGE LOADING:
- URL hash method: navigate to https://www.photopea.com#open:IMAGE_URL to load directly
- Menu method: File > Open to browse local files (requires file picker interaction)
- Sample images: File > Open & Place or use a known public domain image URL
- After loading, the image appears on the canvas layer and is ready for editing
- Photopea auto-creates a layer for the loaded image

BACKGROUND REMOVAL WORKFLOW:
1. Open/load an image (URL hash method is simplest for automation)
2. Press W to activate Magic Wand tool
3. In tool options bar, adjust Tolerance if needed (default ~32, higher for broader selection)
4. Click on the background area of the image with click_at on the canvas
5. Marching ants (selection border) should appear around the selected area
6. If background is not fully selected: hold Shift and click additional background areas
7. Press Backspace (Delete) key to clear the selected area
8. Checkerboard pattern appears where background was (indicates transparency)
9. Optionally: Ctrl+D to deselect when done

MAGIC WAND TOOL OPTIONS (in tool options bar when Magic Wand is active):
- Tolerance: controls how similar colors must be to be selected (0-255, default 32)
- Contiguous: if checked, only selects connected pixels of similar color
- Anti-alias: smooths selection edges
- Sample All Layers: samples from all visible layers, not just active layer
- Selection mode buttons: New Selection, Add to Selection, Subtract, Intersect

SELECT MENU OPERATIONS:
- Select > All (Ctrl+A): selects entire canvas
- Select > Deselect (Ctrl+D): removes selection
- Select > Inverse (Ctrl+Shift+I): inverts selection (select everything except current selection)
- Select > Color Range: advanced color-based selection dialog
- Select > Modify > Expand/Contract/Feather: refine selection edges`,
  selectors: {
    // Photopea uses a custom UI framework. Selectors are research-based and
    // will be validated during the Plan 02 live MCP test.
    canvas: '#canvas, canvas',
    toolbar: '.toolbar, .tools, [class*="toolbar"]',
    menuBar: '.menu, .menubar, [class*="menu-bar"]',
    fileMenu: '.menu:first-child, [class*="menu"] > :first-child',
    selectMenu: '.menu [data-label="Select"], [class*="menu"] :nth-child(6)',
    layersPanel: '.layers, .panel-layers, [class*="layers"]',
    toolOptionsBar: '.tool-options, .options-bar, [class*="tool-options"]',
    toleranceInput: '.tool-options input[type="number"], .options-bar input[type="number"]',
    splashDialog: '.splash, .welcome, [class*="splash"], [class*="welcome"]',
    splashCloseButton: '.splash .close, .welcome .close, [class*="splash"] button, [class*="welcome"] button'
  },
  workflows: {
    dismissSplash: [
      'navigate to https://www.photopea.com',
      'wait_for_stable for editor to load (Photopea has a loading phase)',
      'get_dom_snapshot to check for splash/welcome dialog',
      'press_key Escape to dismiss splash, or click close button if visible',
      'wait_for_stable for editor canvas to become interactive'
    ],
    loadImageViaUrl: [
      'navigate to https://www.photopea.com#open:IMAGE_URL (replace IMAGE_URL with actual URL)',
      'wait_for_stable for image to load on canvas',
      'verify image loaded by checking canvas is populated (not blank/checkerboard)',
      'get_dom_snapshot to confirm layers panel shows the loaded image layer'
    ],
    loadSampleImage: [
      'after dismissing splash, check if an image is already loaded on canvas',
      'if no image: click File menu in the menu bar',
      'look for Open or Open & Place option in dropdown',
      'alternatively: navigate to photopea.com#open:IMAGE_URL with a known test image',
      'wait_for_stable for image to render on canvas'
    ],
    selectMagicWand: [
      'press_key w to activate Magic Wand tool (keyboard shortcut)',
      'alternatively: click the Magic Wand button in the left toolbar',
      'verify tool is active by checking tool options bar shows tolerance control',
      'adjust tolerance in tool options bar if needed (default 32 is good for solid backgrounds)'
    ],
    removeBackground: [
      'ensure Magic Wand tool is active (press_key w)',
      'click_at on a background-colored area of the image canvas (use canvas center or known bg area)',
      'wait briefly for marching ants selection to appear around selected region',
      'if selection is incomplete: click_at on additional background areas with shift=true (add to selection)',
      'press_key Backspace to clear/delete the selected area',
      'checkerboard pattern should appear where background was (indicates transparency)',
      'press_key d with ctrl=true to deselect (Ctrl+D)'
    ],
    invertAndDelete: [
      'use Magic Wand to select the foreground subject instead of background',
      'press_key i with ctrl=true and shift=true to invert selection (Ctrl+Shift+I)',
      'now background is selected instead of foreground',
      'press_key Backspace to delete the background',
      'press_key d with ctrl=true to deselect'
    ]
  },
  warnings: [
    'Photopea renders image editing on HTML5 canvas -- CDP click_at required for canvas pixel interaction',
    'Toolbar and menus are DOM elements -- use DOM click or keyboard shortcuts for tool selection',
    'Splash/welcome dialog may appear on first load -- dismiss before interacting with canvas',
    'Ads may appear alongside the editor -- they do not block canvas but may shift layout',
    'Magic Wand tolerance affects selection quality -- default 32 works for solid backgrounds, increase for gradients',
    'Delete key on Mac is Backspace -- use press_key with "Backspace" not "Delete" for clearing selection',
    'Photopea custom UI may not use standard HTML attributes -- selectors need live validation in Plan 02',
    'After loading an image, check that the correct layer is selected in the layers panel before editing',
    'Contiguous mode on Magic Wand only selects connected same-color pixels -- turn off for scattered backgrounds'
  ],
  toolPreferences: ['click_at', 'press_key', 'click', 'get_dom_snapshot', 'navigate', 'wait_for_stable', 'drag', 'read_page']
});
