/**
 * Site Guide: Nike 3D Product Viewer
 * Per-site guide for 3D product viewers on Nike.com and Sketchfab fallback.
 *
 * Nike product pages may feature 3D/360 viewers using <model-viewer> web component
 * or embedded WebGL canvas. Rotation is controlled by horizontal CDP drag on the
 * canvas element. Sketchfab uses iframe-embedded WebGL viewers.
 *
 * Also matches Sketchfab as fallback 3D viewer platform.
 *
 * Tested via MCP manual tools (Phase 52, CANVAS-06 diagnostic).
 */

registerSiteGuide({
  site: 'Nike 3D Viewer',
  category: 'E-Commerce & Shopping',
  patterns: [
    /nike\.com/i,
    /sketchfab\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-06):
- [canvas] Half-width horizontal drag = ~180deg rotation; startX=25% width, endX=75% width
- [canvas] Use steps=30, stepDelayMs=20 for smooth rotation -- fewer steps risk jerky/missed input
- [canvas] Dismiss cookie consent and region modals BEFORE any canvas interaction
- [canvas] Shadow DOM in model-viewer: use click_at/drag with outer element bounds, not inner canvas
- [canvas] Sketchfab is reliable fallback if Nike product lacks 3D view (no auth required)

3D PRODUCT VIEWER INTELLIGENCE:

VIEWER TECHNOLOGY:
- Nike may use <model-viewer> web component (Google's 3D viewer library)
- model-viewer creates a shadow DOM with an internal canvas
- Sketchfab uses iframe with embedded WebGL canvas
- Both respond to horizontal mouse drag for Y-axis orbit rotation

ACTIVATING 3D VIEW:
- On Nike product pages, look for "3D View" or "360" button/icon in the image carousel
- Some products have 3D as a thumbnail option in the image gallery
- Clicking the 3D trigger loads the WebGL viewer (may take 1-3 seconds)
- On Sketchfab, the 3D viewer loads automatically on model pages

ROTATION VIA DRAG:
- Horizontal drag left-to-right = clockwise rotation (front to back view)
- Horizontal drag right-to-left = counter-clockwise rotation
- Full canvas-width drag approximately equals 360-degree rotation
- HALF canvas-width drag approximately equals 180-degree rotation (the goal)
- Keep Y coordinate constant (same vertical level) to avoid tilting
- Use 20-40 steps in the drag for smooth rotation (too few = jerky, may not register)

CALCULATING 180-DEGREE DRAG:
1. Get canvas element bounds via DOM inspection
2. Calculate center Y coordinate: centerY = canvas.top + canvas.height / 2
3. Calculate start X: startX = canvas.left + canvas.width * 0.25 (quarter from left)
4. Calculate end X: endX = canvas.left + canvas.width * 0.75 (quarter from right)
5. This gives a half-width drag = approximately 180 degrees
6. Use drag(startX, centerY, endX, centerY, steps=30, stepDelayMs=20)

COOKIE/POPUP DISMISSAL:
- Nike shows OneTrust cookie consent banner on first visit
- Look for "Accept All" or cookie dismiss button
- May also show country/region selection modal
- Dismiss all popups before interacting with the 3D viewer

VERIFYING ROTATION:
- After drag, the shoe should show a different angle (e.g., back/heel view)
- No programmatic way to read rotation angle from DOM
- Verification relies on visual inspection during human checkpoint
- Alternatively: check if canvas content changed after drag (canvas pixels differ)`,
  selectors: {
    // Nike product page selectors (research-based -- validate in Plan 02 live test)
    cookieConsent: '#onetrust-accept-btn-handler, button[id*="onetrust-accept"], .onetrust-accept-btn-handler',
    cookieBanner: '#onetrust-banner-sdk, div[class*="onetrust"], div[role="dialog"][aria-label*="cookie"]',
    productImageArea: 'div[data-testid="HeroImage"], div[class*="product-hero"], div.css-1rehvup',
    threeDButton: 'button[aria-label*="3D"], button[aria-label*="360"], button[data-testid*="3d"], button[data-testid*="360"]',
    modelViewer: 'model-viewer, [is="model-viewer"], div[class*="model-viewer"], div[class*="three-d"]',
    canvas: 'model-viewer canvas, canvas[class*="webgl"], canvas[class*="three"], div[class*="model-viewer"] canvas',
    imageCarousel: 'div[data-testid="ThumbnailCarousel"], div[class*="thumbnail"], ul[class*="carousel"]',
    regionModal: 'div[data-testid="countryModal"], div[class*="country-modal"], div[aria-label*="country"]',
    regionDismiss: 'button[data-testid="hf-modal-close"], button[aria-label="Close Modal"], div[class*="country-modal"] button[class*="close"]',
    // Sketchfab fallback selectors (research-based -- validate in Plan 02 live test)
    sketchfabViewer: 'iframe.player, iframe[src*="sketchfab"], div.viewer, div[class*="viewer-container"]',
    sketchfabCanvas: 'canvas#canvas-target, canvas[class*="viewer"], canvas[id*="canvas"]',
    sketchfabPlayButton: 'button[class*="play"], button[aria-label*="Load"], div.viewer-button--load'
  },
  workflows: {
    dismissPopups: [
      'navigate to Nike product page URL',
      'wait_for_stable for page to load',
      'check get_dom_snapshot for cookie consent banner (#onetrust-banner-sdk)',
      'click #onetrust-accept-btn-handler to dismiss cookie banner if present',
      'check for country/region selection modal and click close button if present',
      'wait_for_stable after popup dismissal'
    ],
    activate3DView: [
      'look for 3D View / 360 button in product image area or carousel thumbnails',
      'click_at on the 3D trigger button coordinates',
      'wait_for_stable for WebGL viewer to load (1-3 seconds)',
      'verify canvas/model-viewer element appeared in DOM via get_dom_snapshot'
    ],
    rotate180Degrees: [
      'get canvas/model-viewer bounds from get_dom_snapshot',
      'calculate centerY = top + height/2',
      'calculate startX = left + width*0.25, endX = left + width*0.75',
      'drag(startX, centerY, endX, centerY, steps=30, stepDelayMs=20)',
      'wait_for_stable for rendering to settle',
      'shoe should now show approximately 180-degree rotated view (back/heel visible)'
    ],
    rotate180DegreesSketchfab: [
      'navigate to Sketchfab model page',
      'wait_for_stable for viewer to load',
      'click play/load button if model is not auto-playing (button[class*="play"])',
      'locate the viewer canvas via get_dom_snapshot',
      'get canvas bounds (may be inside iframe -- use click_at on iframe coordinates)',
      'calculate centerY and startX/endX same as Nike workflow',
      'drag(startX, centerY, endX, centerY, steps=30, stepDelayMs=20)',
      'viewer should show rotated model view'
    ]
  },
  warnings: [
    '3D viewer uses WebGL canvas -- CDP drag required, DOM dispatchEvent will NOT work',
    'Nike product pages are heavy (5-10 MB) -- wait_for_stable may need extra time',
    'model-viewer creates shadow DOM -- selectors may not reach internal canvas directly',
    'Cookie consent banner MUST be dismissed before any canvas interaction',
    'Some Nike products do NOT have 3D view -- verify 3D button exists before attempting',
    'Sketchfab iframe isolation may require click_at on iframe coordinates rather than canvas selectors',
    'Drag steps=30 with stepDelayMs=20 gives smooth rotation; fewer steps may skip rotation detection',
    'Keep drag Y coordinate constant to avoid vertical tilt during rotation'
  ],
  toolPreferences: ['drag', 'click_at', 'click', 'get_dom_snapshot', 'navigate', 'wait_for_stable', 'wait_for_element']
});
