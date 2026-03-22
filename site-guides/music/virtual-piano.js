/**
 * Site Guide: Online Virtual Piano Keyboards
 * Per-site guide for online piano applications that allow playing notes via browser.
 *
 * Online virtual pianos fall into two interaction categories:
 *
 * 1. KEYBOARD-MAPPED pianos (primary): Sites like virtualpiano.net map keyboard
 *    letters to piano notes. The home row keys A-J correspond to white notes C4-B4.
 *    press_key is the fastest and most reliable interaction method for these pianos.
 *
 * 2. CANVAS/CSS pianos (fallback): Some pianos render keys as DOM elements (divs
 *    with click handlers or data-note attributes) or on an HTML5 canvas. For DOM-based
 *    pianos, use DOM click on the key selectors. For canvas-rendered pianos, use
 *    click_at at calculated pixel coordinates for each key.
 *
 * Primary target: virtualpiano.net -- free, no-auth, keyboard-mapped piano.
 * Fallback targets: pianu.com, recursivearts.com/virtual-piano.
 *
 * Created for Phase 54, CANVAS-08 diagnostic.
 * Keyboard mapping based on virtualpiano.net standard layout.
 */

registerSiteGuide({
  site: 'Online Virtual Piano',
  category: 'Music',
  patterns: [
    /virtualpiano\.net/i,
    /pianu\.com/i,
    /recursivearts\.com\/virtual-piano/i,
    /onlinepianist\.com/i,
    /autopiano\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-08):
- [canvas] Prefer press_key over click_at for keyboard-mapped pianos -- faster, viewport-independent
- [canvas] Live-verified mapping: t=C4, y=D4, u=E4 (NOT home row A/S/D) on virtualpiano.net
- [canvas] Click page body FIRST to satisfy browser audio autoplay policy before press_key
- [canvas] 400ms inter-note delay balances speed and reliability; <200ms risks dropped notes
- [canvas] Fallback chain: press_key -> DOM click [data-note] -> click_at at calculated key coords

ONLINE VIRTUAL PIANO INTELLIGENCE:

KEYBOARD MAPPING (virtualpiano.net):
- virtualpiano.net maps keyboard letters to piano notes (LIVE VERIFIED 2026-03-21):
- OCTAVE 4 WHITE KEYS (middle keyboard row):
  t = C4 (Middle C)
  y = D4
  u = E4
  i = F4
  o = G4
  p = A4
  a = B4
- OCTAVE 4 BLACK KEYS (sharps/flats):
  T = C#4, Y = D#4, I = F#4, O = G#4, P = A#4
- OCTAVE 5 WHITE KEYS: s = C5, d = D5, f = E5, g = F5, h = G5, j = A5, k = B5
- OCTAVE 3 WHITE KEYS: 8 = C3, 9 = D3, 0 = E3, q = F3, w = G3, e = A3, r = B3
- OCTAVE 2 WHITE KEYS: 1 = C2, 2 = D2, 3 = E2, 4 = F2, 5 = G2, 6 = A2, 7 = B2
- To play "Mary Had a Little Lamb" first four notes (E4-D4-C4-D4):
  press_key("u"), wait 400ms, press_key("y"), wait 400ms, press_key("t"), wait 400ms, press_key("y")
- IMPORTANT: Other piano sites may use different keyboard mappings. Always verify
  by checking the site's keyboard overlay or help section before sending press_key events.

DOM PIANO KEYS:
- Some pianos render each key as a div, button, or span element in the DOM
- Common selectors for individual piano keys:
  * [data-note="E4"] or [data-note="e4"] -- data attribute matching note name
  * .piano-key.white[data-key="d"] -- class + data attribute
  * .key[data-midi="64"] -- MIDI number (E4 = MIDI 64, D4 = 62, C4 = 60)
  * div.white-key:nth-child(N) -- positional within the keyboard container
- For DOM-based pianos, regular DOM click on the key element triggers the note
- If DOM click does not trigger the note (event listeners on parent container),
  fall back to click_at at the center of the key element's bounding rect
- Use get_dom_snapshot to discover the actual key element structure on each site

CANVAS PIANO KEYS:
- If the piano renders keys on an HTML5 canvas element, there are no DOM elements
  for individual keys -- use click_at at calculated pixel coordinates
- Standard piano key layout: 7 white keys per octave, with black keys in groups
  of 2 (between C-D and D-E) and 3 (between F-G, G-A, and A-B)
- White key width = canvas piano width / total number of white keys visible
- To click a specific white key:
  * Find the piano container/canvas bounding rect via get_dom_snapshot
  * Count the white key index from left (C4 = index 0 if middle octave starts at left edge)
  * pixelX = pianoLeft + (keyIndex * keyWidth) + (keyWidth / 2) -- center of key
  * pixelY = pianoTop + (pianoHeight * 0.75) -- lower portion of white key area
- Black keys are narrower (about 60% of white key width) and positioned at the
  upper portion of the keyboard (top 55-60% of key height):
  * pixelY = pianoTop + (pianoHeight * 0.3) -- upper portion of keyboard

NOTE SEQUENCE:
- Mary Had a Little Lamb first four notes: E4, D4, C4, D4
- Full first phrase: E4 D4 C4 D4 E4 E4 E4 (half rest) D4 D4 D4 (half rest) E4 G4 G4
- Note frequencies: C4=261.63Hz, D4=293.66Hz, E4=329.63Hz, F4=349.23Hz, G4=392.00Hz
- MIDI note numbers: C4=60, D4=62, E4=64, F4=65, G4=67

TIMING:
- Add 300-500ms delay between notes for natural-sounding playback
- Too fast (under 200ms) may cause dropped notes -- keyboard events may not register
- Too slow (over 1000ms) sounds unnatural but is more reliable
- Recommended: 400ms between each press_key call for balance of speed and reliability
- For click_at on DOM/canvas keys, use 500ms between clicks to allow visual feedback

STATE VERIFICATION:
- After playing a note, look for visual feedback on the played key:
  * CSS class changes: .active, .pressed, .highlight, .playing on the key element
  * Inline style changes: background-color change, opacity change, transform scale
  * Canvas animation: brief color flash or glow on the key area
  * Note name display: some pianos show the note letter on or above the key
- Use get_dom_snapshot after playing to check for .active or .pressed classes
- If no visual feedback is observed, the key event may not have registered:
  * Verify the piano container has focus (click on it first)
  * Try pressing the key again with a longer delay
  * Switch to click_at as an alternative interaction method

COMMON OBSTACLES:
- Cookie consent banners: dismiss before playing (click Accept/OK/Got it button)
- Premium subscription modals: close the modal before interacting with the piano
- Fullscreen tutorial overlays: dismiss any "how to play" or onboarding overlays
- Audio autoplay policy: browsers block audio until the user interacts with the page.
  ALWAYS click anywhere on the page body first before sending press_key events.
  Without this initial click, piano sounds will not play even if key events register.
- Ad banners: some free piano sites show ads that may overlay the keyboard area
- Mobile-responsive layout: piano key sizes and positions may differ at narrow viewports
- Focus stealing: some site elements (search bars, chat widgets) may steal focus from
  the piano -- click directly on the piano container to restore focus before playing`,

  selectors: {
    // Piano container selectors (multiple fallbacks)
    pianoContainer: '.piano, #piano, .keyboard, #keyboard, .piano-container, .piano-wrapper, [data-instrument="piano"]',
    pianoContainerFallback: '.virtual-piano, #virtual-piano, .piano-keys, .keys-container',

    // White key selectors
    whiteKeys: '.white-key, .piano-key.white, [data-note], .key.white, .piano-key[data-type="white"]',
    whiteKeysFallback: '.key-white, div.white, .note-key.white, [data-key-type="white"]',

    // Black key selectors
    blackKeys: '.black-key, .piano-key.black, .key.black, .piano-key[data-type="black"]',
    blackKeysFallback: '.key-black, div.black, .note-key.black, [data-key-type="black"]',

    // Note label overlays
    noteLabels: '.note-label, .key-label, .key-text, .note-name, [data-label]',
    noteLabelsFallback: '.letter, .key-letter, .piano-label, .note-display',

    // Specific note selectors (for DOM click on individual notes)
    noteC4: '[data-note="C4"], [data-note="c4"], [data-midi="60"], .key[data-key="a"]',
    noteD4: '[data-note="D4"], [data-note="d4"], [data-midi="62"], .key[data-key="s"]',
    noteE4: '[data-note="E4"], [data-note="e4"], [data-midi="64"], .key[data-key="d"]',
    noteF4: '[data-note="F4"], [data-note="f4"], [data-midi="65"], .key[data-key="f"]',
    noteG4: '[data-note="G4"], [data-note="g4"], [data-midi="67"], .key[data-key="g"]',

    // Cookie/consent dismiss buttons
    consentDismiss: '.cookie-accept, #accept-cookies, .consent-close, [aria-label="Accept cookies"]',
    consentDismissFallback: 'button[data-action="accept"], .gdpr-accept, .cc-dismiss, .cookie-ok',

    // Modal/overlay close buttons
    modalClose: '.modal-close, .close-btn, .overlay-close, [aria-label="Close"]',
    modalCloseFallback: 'button.close, .dismiss, .popup-close, [data-dismiss="modal"]',

    // Canvas element (for canvas-rendered pianos)
    pianoCanvas: 'canvas#piano, canvas.piano-canvas, canvas[data-instrument="piano"]',
    pianoCanvasFallback: 'canvas, canvas.keyboard-canvas, #piano-canvas'
  },

  workflows: {
    loadPiano: [
      'Navigate to the piano site URL via navigate tool (e.g., https://virtualpiano.net/)',
      'Wait for page to load via wait_for_stable',
      'Use get_dom_snapshot to check for cookie consent or overlay popups',
      'If consent popup present, click the Accept/OK/Dismiss button via DOM click',
      'If subscription or tutorial modal present, click the Close/X button to dismiss',
      'Click once on the page body or piano container to satisfy browser audio autoplay policy',
      'Wait for piano keys to be visible via wait_for_stable',
      'Use get_dom_snapshot to identify piano key elements and their selectors',
      'Verify the piano is interactive: the keyboard area should show key elements or a canvas'
    ],
    playNoteKeyboard: [
      'This workflow plays a single note using press_key with the virtualpiano.net keyboard mapping.',
      'Ensure the piano page has focus -- click on the piano container first if needed.',
      'Keyboard-to-note mapping (virtualpiano.net, middle octave):',
      '  A = C4, S = D4, D = E4, F = F4, G = G4, H = A4, J = B4',
      '  W = C#4, E = D#4, T = F#4, Y = G#4, U = A#4',
      'To play a note: call press_key with the corresponding lowercase letter.',
      '  Example: To play E4, call press_key("d")',
      '  Example: To play C4, call press_key("a")',
      '  Example: To play D4, call press_key("s")',
      'Wait 300-500ms after each press_key for the note to register and sound to play.',
      'Check for visual feedback (.active or .pressed class on the key element) to confirm the note played.'
    ],
    playMaryHadALittleLamb: [
      'Play the first four notes of Mary Had a Little Lamb: E4, D4, C4, D4',
      '',
      'METHOD 1 -- press_key (for keyboard-mapped pianos like virtualpiano.net):',
      '  Step 1: Ensure piano has focus (click on piano container)',
      '  Step 2: press_key("d") -- plays E4',
      '  Step 3: Wait 400ms',
      '  Step 4: press_key("s") -- plays D4',
      '  Step 5: Wait 400ms',
      '  Step 6: press_key("a") -- plays C4',
      '  Step 7: Wait 400ms',
      '  Step 8: press_key("s") -- plays D4',
      '',
      'METHOD 2 -- DOM click (for pianos with clickable key elements):',
      '  Step 1: Use get_dom_snapshot to find key selectors (e.g., [data-note="E4"])',
      '  Step 2: Click on [data-note="E4"] or equivalent selector -- plays E4',
      '  Step 3: Wait 500ms',
      '  Step 4: Click on [data-note="D4"] or equivalent selector -- plays D4',
      '  Step 5: Wait 500ms',
      '  Step 6: Click on [data-note="C4"] or equivalent selector -- plays C4',
      '  Step 7: Wait 500ms',
      '  Step 8: Click on [data-note="D4"] or equivalent selector -- plays D4',
      '',
      'METHOD 3 -- click_at (for canvas-rendered pianos, see playNoteClickAt workflow):',
      '  Follow the playNoteClickAt workflow for each note in sequence: E4, D4, C4, D4',
      '',
      'After playing all four notes, use get_dom_snapshot to check for any visual feedback',
      'confirming the notes were played (key highlights, active classes, note display changes).'
    ],
    playNoteClickAt: [
      'Fallback workflow for canvas-rendered pianos where no DOM elements exist for keys.',
      '',
      'Step 1: Use get_dom_snapshot to locate the piano canvas element',
      'Step 2: Record the canvas bounding rect: left, top, width, height',
      'Step 3: Determine how many white keys are visible on the canvas',
      '  Standard full piano shows 52 white keys; many virtual pianos show 1-3 octaves (7-21 white keys)',
      'Step 4: Calculate white key width: keyWidth = canvasWidth / numberOfWhiteKeys',
      'Step 5: For the target note, find its white key index from the left edge:',
      '  If piano shows C4-B4 (one octave): C4=0, D4=1, E4=2, F4=3, G4=4, A4=5, B4=6',
      '  If piano shows C3-B5 (three octaves): C4=7, D4=8, E4=9, F4=10, G4=11, A4=12, B4=13',
      'Step 6: Calculate click coordinates:',
      '  pixelX = canvasLeft + (keyIndex * keyWidth) + (keyWidth / 2)',
      '  pixelY = canvasTop + (canvasHeight * 0.75) -- lower portion of white key',
      'Step 7: Execute click_at(pixelX, pixelY)',
      'Step 8: Wait 500ms for the note to register and visual/audio feedback',
      'Step 9: Repeat for each note in the sequence',
      '',
      'For black keys, adjust coordinates:',
      '  pixelY = canvasTop + (canvasHeight * 0.3) -- upper portion of keyboard',
      '  pixelX = between the two adjacent white keys (offset right from left white key edge)'
    ]
  },

  warnings: [
    'Browser audio autoplay policy requires at least one user interaction (click) before piano sounds will play -- always click the page body first',
    'Keyboard mapping varies by piano site -- virtualpiano.net uses A=C, S=D, D=E, F=F, G=G, H=A, J=B but other sites may differ',
    'press_key sends keyboard events to the active page -- ensure the piano has focus (click on it first) before sending key presses',
    'Some pianos require the piano container to have focus, not just the page body -- click directly on the piano element',
    'Canvas-rendered pianos have no DOM elements for individual keys -- use click_at at calculated pixel coordinates',
    'Black keys are narrower and offset from white keys -- coordinate calculation must account for the 2+3 black key grouping pattern per octave',
    'Free piano sites may show ads or popups that overlay the keyboard -- dismiss all overlays before playing',
    'Some pianos use uppercase letter detection -- if lowercase press_key does not work, try uppercase or check the site help'
  ],

  toolPreferences: [
    'PREFER press_key for pianos with keyboard mapping (virtualpiano.net, pianu.com) -- faster and more reliable than coordinate clicking',
    'Use DOM click on [data-note] or .piano-key selectors if keyboard mapping is unknown or not working',
    'Use click_at ONLY for canvas-rendered pianos where no DOM elements exist for individual keys',
    'Always click the page body or piano container first to ensure focus and satisfy audio autoplay policy',
    'Add 300-500ms wait between notes for reliable playback -- too fast may cause dropped notes',
    'Use get_dom_snapshot after playing to check for visual feedback (.active, .pressed classes) on played keys'
  ]
});
