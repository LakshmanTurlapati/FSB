/**
 * Site Guide: Canvas Browser Games (HTML5 / WebGL)
 * Per-site guide for browser games that render their ENTIRE UI on an HTML5 canvas element.
 *
 * Unlike Google Solitaire (Phase 50) which renders cards as DOM elements (divs with
 * background-image sprites), many HTML5 browser games -- especially those built with
 * game engines like Phaser, Construct 3, Unity WebGL, Godot, or GameMaker -- paint
 * ALL UI elements (buttons, menus, text, HUD) directly on a single canvas element.
 * There are ZERO clickable DOM nodes for game buttons like "Play", "Start", or "Menu".
 *
 * The ONLY viable interaction method for canvas-painted buttons is CDP click_at at
 * the correct pixel coordinates within the canvas viewport area. DOM click will never
 * work because there are no DOM elements to target inside the canvas.
 *
 * This guide covers itch.io-hosted HTML5 games as the primary target, since itch.io
 * is the largest host of free, publicly accessible HTML5 browser games. Many itch.io
 * games embed in an iframe with a DOM "Run game" launcher button on the host page.
 *
 * Created for Phase 53, CANVAS-07 diagnostic.
 * Pixel-coordinate interaction patterns based on Photopea (Phase 51) and Excalidraw
 * (Phase 48) prior art with canvas-rendered applications.
 */

registerSiteGuide({
  site: 'Canvas Browser Game (HTML5/WebGL)',
  category: 'Games',
  patterns: [
    /itch\.io\/.*\/.*$/i,
    /html5games\./i,
    /newgrounds\.com\/portal\/view\//i,
    /kongregate\.com\/games\//i,
    /crazygames\.com\/game\//i,
    /poki\.com\/en\/g\//i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-07):
- [canvas] Two-phase pattern: DOM click host "Run game" button, then CDP click_at for canvas buttons
- [canvas] Express button positions as % of canvas dims (Play ~50%W, 60%H); compute from bounding rect
- [canvas] If canvas is in iframe, add iframe offset to coordinates for main viewport click_at
- [canvas] Fallback: press_key(Enter) or press_key(Space) if click_at misses canvas Play button
- [canvas] Wait 3-10s after "Run game" for engine init before attempting canvas button clicks

CANVAS BROWSER GAME INTELLIGENCE:

GAME LAUNCH:
- Navigate to the game page URL (e.g., an itch.io game page like https://example.itch.io/game-name)
- On itch.io: the game page has a DOM "Run game" button that must be clicked FIRST
- The "Run game" button is a standard DOM element on the host page -- use DOM click for this
- After clicking "Run game", an iframe loads containing the actual HTML5 game canvas
- Wait 3-10 seconds for the game engine to initialize and the canvas to render the title screen
- Some games show a loading bar or splash screen before the main menu appears
- Non-itch.io games may load the canvas directly on the page without an iframe launcher
- Always dismiss any cookie consent banners or notification popups on the host page first

CANVAS RENDERING:
- The game UI is FULLY canvas-rendered -- all buttons, menus, text, score displays, and
  game elements are painted as pixels on a single HTML5 canvas element
- There are NO clickable DOM elements for any in-game button (Play, Start, Menu, Options, etc.)
- DOM click tool will NOT work for any game UI element inside the canvas
- get_dom_snapshot will show the canvas element itself but NOT any content painted on it
- Canvas-rendered text is NOT readable via read_page or DOM text extraction
- The only DOM content around the canvas may be the iframe container and host page elements
- Game engines that produce this pattern: Phaser, Construct 3, Unity WebGL, Godot HTML5,
  GameMaker HTML5, Pixi.js, Babylon.js, Three.js (for 3D games)

BUTTON LOCATIONS:
- Canvas-painted buttons have fixed positions relative to the canvas dimensions
- Express button positions as percentages of canvas width/height for viewport independence:
  * "Play" or "Start" button: typically centered horizontally (~50% of canvas width),
    positioned at 55-70% of canvas height (lower-center of title screen)
  * "Options" or "Settings": often below Play button at ~75-85% height, same horizontal center
  * Game title/logo: upper area at 20-40% height, centered horizontally
  * Menu items in a vertical list: all at ~50% width, spaced 8-12% height apart starting at ~45%
- To calculate pixel coordinates from percentages:
  * pixelX = canvasRect.left + (canvasRect.width * percentageX / 100)
  * pixelY = canvasRect.top + (canvasRect.height * percentageY / 100)
- IMPORTANT: if the game is in an iframe, coordinates must be relative to the MAIN viewport,
  not the iframe origin -- add the iframe bounding rect offset to the canvas position
- Always get the canvas element bounding rect from get_dom_snapshot BEFORE calculating coordinates

INTERACTION PATTERN:
- Step 1: Use get_dom_snapshot to locate the canvas element and get its bounding rectangle
- Step 2: If canvas is inside an iframe, also get the iframe bounding rect for offset calculation
- Step 3: Calculate the target button pixel coordinates using canvas rect + percentage position
- Step 4: Execute click_at(pixelX, pixelY) to click the canvas-painted button
- Step 5: Wait 1-2 seconds for the game to respond (canvas re-render, scene transition)
- Step 6: Verify the click registered by checking for observable changes
- For keyboard-driven games: use press_key for game input after the canvas has focus
- Canvas gets focus automatically after a click_at on it
- Some games respond to Enter or Space to start -- try press_key as a fallback if click_at misses

STATE VERIFICATION:
- Canvas content changes are NOT reflected in DOM snapshots -- you cannot inspect game state via DOM
- Observable signals that a button click registered:
  * The page URL hash changed (some games update location.hash on scene transitions)
  * The iframe URL changed (some games navigate to a new page for different scenes)
  * DOM elements around the canvas changed (score overlays, ad placements reshuffled)
  * A brief wait_for_stable shows DOM mutations triggered by the game engine
  * Audio started playing (not detectable via MCP, but noted for human verification)
- If none of these signals appear after click_at, the click likely missed the button:
  * Recalculate coordinates -- canvas may have resized or repositioned
  * Try clicking slightly different offsets (10-20px in each direction)
  * Check if a loading screen or overlay is still covering the button area

COMMON OBSTACLES:
- Cookie consent popups on the host page (itch.io, Newgrounds, etc.) -- dismiss via DOM click first
- "Run game" iframe launcher buttons (itch.io pattern) -- click via DOM before canvas interaction
- Loading screens: game engines often show a loading bar for 3-10 seconds before the title screen
- Fullscreen prompts: some games request fullscreen mode -- can usually be dismissed or ignored
- Ad overlays: itch.io and similar hosts may show ads before or during game loading
- Sound permission banners: browsers may show "click to enable audio" overlays
- iframe sandbox restrictions: some hosting platforms restrict CDP interaction within sandboxed iframes
- Canvas resize on window resize: coordinates become invalid if viewport dimensions change
- WebGL context loss: GPU-intensive games may lose WebGL context, causing a blank canvas`,

  selectors: {
    // Canvas element selectors (try multiple patterns)
    gameCanvas: 'canvas, canvas#canvas, canvas.game-canvas, canvas[data-engine], #gameCanvas',
    gameCanvasFallback: 'iframe canvas, #game_drop canvas, .game_frame canvas',
    gameCanvasWebGL: 'canvas[data-engine="unity"], canvas.emscripten, canvas#unity-canvas',

    // Game iframe selectors (for itch.io and similar hosts)
    gameIframe: 'iframe#game_drop, iframe.game_frame, iframe[src*="html"], iframe[src*="game"]',
    gameIframeFallback: 'iframe[allowfullscreen], iframe[allow*="gamepad"], .iframe_placeholder iframe',

    // Host page launcher buttons
    runGameButton: 'button.load_iframe_btn, .play_btn, a.load_iframe_btn, button[data-action="play"]',
    runGameButtonFallback: '.game_frame button, [class*="play" i] button, .start_game_btn',

    // Fullscreen controls
    fullscreenButton: 'button.fullscreen_btn, [aria-label*="Fullscreen" i], .fullscreen-toggle',
    fullscreenButtonFallback: 'button[title*="fullscreen" i], .game_footer button, #fullscreen-btn',

    // Host page overlays to dismiss
    consentDialog: 'form[action*="consent"], div[aria-modal="true"], .cookie-bar, .gdpr-consent',
    consentAccept: 'button[aria-label*="Accept" i], .cookie-accept, button[data-action="accept"]',

    // Loading indicators
    loadingOverlay: '.loading, .preloader, #loading, .splash-screen, [class*="loading" i]',
    progressBar: '.progress-bar, .load-progress, progress, [role="progressbar"]'
  },

  workflows: {
    launchGame: [
      'Navigate to the game page URL via navigate tool',
      'Wait for page to load via wait_for_stable',
      'Dismiss cookie/consent overlay if present (use DOM click on Accept button)',
      'Use get_dom_snapshot to find the "Run game" launcher button (for itch.io-hosted games)',
      'Click the "Run game" button via DOM click (this is a host page DOM element, NOT a canvas element)',
      'Wait 5-10 seconds for the game iframe and canvas to load (use wait_for_stable)',
      'Use get_dom_snapshot to confirm the canvas element is present and get its bounding rect',
      'Wait an additional 3-5 seconds for the game engine to finish loading and render the title screen',
      'The game title screen with canvas-painted buttons should now be visible'
    ],
    clickCanvasButton: [
      'Use get_dom_snapshot to locate the canvas element and record its bounding rect (left, top, width, height)',
      'If canvas is inside an iframe, also record the iframe bounding rect for coordinate offset',
      'Determine which button to click and its approximate percentage position on the canvas:',
      '  - Play/Start button: approximately 50% width, 60% height (center-lower area)',
      '  - First menu item: approximately 50% width, 50% height',
      '  - Second menu item: approximately 50% width, 60% height',
      '  - Third menu item: approximately 50% width, 70% height',
      'Calculate pixel coordinates: pixelX = canvasLeft + (canvasWidth * percentX / 100)',
      'Calculate pixel coordinates: pixelY = canvasTop + (canvasHeight * percentY / 100)',
      'If in iframe: add iframe bounding rect offset (iframeLeft, iframeTop) to canvas coordinates',
      'Execute click_at(pixelX, pixelY) to click the canvas-painted button',
      'Wait 1-2 seconds via wait_for_stable for the game to process the click and re-render'
    ],
    verifyButtonClick: [
      'After click_at on a canvas button, wait 2 seconds for the game to respond',
      'Use wait_for_stable to detect any DOM mutations triggered by the scene transition',
      'Check if the page URL or URL hash changed (some games update hash on scene change)',
      'Use get_dom_snapshot to see if any DOM elements around the canvas changed',
      'If no observable changes: the click may have missed -- recalculate coordinates and retry',
      'Try slight coordinate offsets: +/- 10-20px in X and Y directions from the original target',
      'As a fallback, try press_key(Enter) or press_key(Space) which some games accept to start',
      'If the game started (new scene loaded), the button click was successful'
    ]
  },

  warnings: [
    'Game UI is fully canvas-rendered -- DOM selectors CANNOT target individual buttons, text, or game elements inside the canvas',
    'Canvas button coordinates are approximate -- games may render at different sizes depending on viewport and iframe dimensions',
    'Always get canvas element bounding rect from DOM snapshot before calculating click coordinates',
    'Loading screens may take 3-10 seconds before the title screen with clickable buttons appears',
    'If game is in an iframe, click_at coordinates are relative to the main viewport, not the iframe -- calculate the iframe offset first',
    'Canvas-rendered text is invisible to read_page and get_dom_snapshot -- game state is opaque to DOM inspection',
    'WebGL games may require GPU acceleration -- headless or software-rendered browsers may show blank canvas',
    'After window resize, all previously calculated pixel coordinates become invalid -- recalculate from canvas bounding rect',
    'Some game engines capture all keyboard input when canvas has focus -- press_key may trigger game actions instead of browser shortcuts'
  ],

  toolPreferences: [
    'ALWAYS use click_at for canvas button interaction -- never use DOM click on canvas-painted elements',
    'Use get_dom_snapshot to find canvas element position and dimensions before clicking',
    'Use wait_for_stable after click_at to allow canvas to re-render after button press',
    'For iframe-hosted games: first click DOM "Run game" button, then use click_at for in-canvas interactions',
    'Use press_key for keyboard-driven game input after canvas has focus from a prior click_at',
    'Use navigate to load the game page, then DOM click for host page elements, then click_at for canvas elements',
    'Prefer click_at over drag for button clicks -- drag is for in-game movement (e.g., moving pieces)',
    'If click_at does not trigger a response, try press_key(Enter) or press_key(Space) as fallback start triggers'
  ]
});
