/**
 * Site Guide: Google Solitaire
 * Per-site guide for the Google Search embedded solitaire card game.
 *
 * Google Solitaire launches when searching "solitaire" on Google.
 * The game widget embeds directly in Google Search results inside a
 * self-contained container (not a separate page). The game renders
 * cards as DOM elements (divs with background-image sprites for card
 * faces) rather than raw HTML5 canvas, making DOM-based click and
 * drag interactions feasible.
 *
 * Card interaction uses click-to-move (click source card, then click
 * destination pile) and double-click to auto-send to foundation.
 * Drag-and-drop is also supported for moving cards between piles.
 *
 * Created for Phase 50, CANVAS-04 diagnostic.
 * Selectors based on Google Solitaire DOM structure research.
 * To be validated during live MCP test (Plan 02).
 */

registerSiteGuide({
  site: 'Google Solitaire',
  category: 'Games',
  patterns: [
    /google\.com\/search\?.*q=solitaire/i,
    /google\.com.*[?&]q=solitaire/i
  ],
  guidance: `GOOGLE SOLITAIRE-SPECIFIC INTELLIGENCE:

GAME LAUNCH:
- Search "solitaire" on Google -- game widget appears directly in search results
- The game container is embedded in the search results page (not a separate URL)
- Click the "Play" button to start the game (may show difficulty selection first)
- Select difficulty: Easy (1-card draw) or Hard (3-card draw) if prompted
- The game may appear inside a container with class or data attributes identifying it

GAME RENDERING:
- Google Solitaire renders cards as DOM elements (divs with background-image CSS sprites)
- Cards are NOT drawn on an HTML5 canvas -- they are clickable/draggable DOM nodes
- Each card element has visual representation via CSS background-position on a sprite sheet
- Card elements are nested inside pile/column container divs
- Face-down cards have a distinct back pattern and are not interactive until flipped

GAME LAYOUT (Standard Klondike Solitaire):
- Stock pile: top-left, face-down cards to draw from (click to draw)
- Waste/Talon pile: next to stock, shows the most recently drawn card(s)
- Foundation piles: 4 piles at top-right area, build Ace to King by suit
- Tableau: 7 columns below the top row, build King down to Ace alternating colors
- Each tableau column has face-down cards underneath with one face-up card on top

CARD INTERACTION PATTERNS:
- Click stock pile to draw card(s) to waste pile (1 card in Easy mode, 3 in Hard mode)
- Click a face-up card to select it (card highlights to show selection)
- Click a valid destination pile/card to move the selected card there
- Double-click a card to auto-move it to the foundation if a valid move exists
- Drag a card from source to destination for direct card movement
- Click an empty stock pile to recycle waste pile back to stock
- Multiple face-up cards in a tableau column can be moved as a group (click the topmost card of the sequence)

GAME CONTROLS:
- Undo button: reverses the last move (typically at bottom or top of game area)
- New Game / restart button: starts a fresh game
- Score display: shows current score and move count
- Timer: tracks elapsed time since game start
- Autocomplete may trigger when all cards are face-up and moves are obvious

GOOGLE CONSENT AND OVERLAYS:
- Cookie consent overlay may appear on first visit (especially in EU/GDPR regions)
- Dismiss consent before interacting with the game
- Google account prompts or sign-in banners may partially obscure the game area

CDP VS DOM INTERACTION:
- Since cards are DOM elements, standard DOM click tool should work for card selection
- If DOM clicks do not register (event listeners on parent container intercept), fall back to click_at with viewport coordinates
- For drag moves, use drag tool with start coordinates on the card and end coordinates on the target pile
- Always use get_dom_snapshot first to identify the actual selectors on the live page`,
  selectors: {
    // Game container and structure
    gameContainer: '[data-game="solitaire"], .solitaire-container, .EIaa9b, #solitaire',
    gameCanvas: '.solitaire-game, .card-game-area, [data-game-area]',
    playButton: '[data-action="play"], .solitaire-play-btn, button[aria-label*="Play"]',

    // Difficulty selection
    difficultyEasy: '[data-difficulty="easy"], [aria-label*="Easy"], .difficulty-easy',
    difficultyHard: '[data-difficulty="hard"], [aria-label*="Hard"], .difficulty-hard',

    // Pile areas
    stockPile: '.stock-pile, [data-pile="stock"], .solitaire-stock',
    wastePile: '.waste-pile, [data-pile="waste"], .solitaire-waste',
    foundationPiles: '.foundation-pile, [data-pile="foundation"], .solitaire-foundation',
    tableauColumns: '.tableau-column, [data-pile="tableau"], .solitaire-tableau',

    // Card elements
    cardElements: '.card, [data-card], .solitaire-card',
    faceUpCard: '.card.face-up, [data-face="up"], .card-face-up',
    faceDownCard: '.card.face-down, [data-face="down"], .card-face-down',
    selectedCard: '.card.selected, .card.highlighted, [data-selected="true"]',

    // Game controls
    undoButton: '[data-action="undo"], button[aria-label*="Undo"], .undo-btn',
    newGameButton: '[data-action="new-game"], button[aria-label*="New game"], .new-game-btn',
    scoreDisplay: '.score, [data-score], .solitaire-score',
    timerDisplay: '.timer, [data-timer], .solitaire-timer',
    moveCounter: '.moves, [data-moves], .solitaire-moves',

    // Google overlays
    consentDialog: 'form[action*="consent"], div[aria-modal="true"], .consent-bump',
    consentAccept: 'button[aria-label="Accept all"], form[action*="consent"] button:first-of-type'
  },
  workflows: {
    launchGame: [
      'Navigate to https://www.google.com/search?q=solitaire via navigate tool',
      'Wait for page to load via wait_for_stable',
      'Dismiss cookie/consent overlay if present (click Accept all button)',
      'Use get_dom_snapshot to find the Play button selector in the game widget',
      'Click the Play button to start the game',
      'If difficulty selection appears, click Easy (1-card draw) for simpler gameplay',
      'Wait for game to initialize via wait_for_stable',
      'Use get_dom_snapshot to identify card elements and pile layout'
    ],
    drawFromStock: [
      'Use get_dom_snapshot to locate the stock pile element',
      'Click the stock pile to draw card(s) to the waste pile',
      'In Easy mode, 1 card is drawn; in Hard mode, 3 cards are drawn',
      'Wait briefly for card animation to complete',
      'The top card of the waste pile is now available for play',
      'If stock pile is empty, clicking it recycles the waste pile back to stock'
    ],
    moveCardToFoundation: [
      'Use get_dom_snapshot to identify face-up cards and foundation piles',
      'Find a card that can go to a foundation (Ace starts a foundation, then 2, 3... by suit)',
      'Double-click the card to auto-send it to the correct foundation pile',
      'If double-click does not work, click the card to select it, then click the foundation pile',
      'If DOM click fails, use click_at at the card center coordinates, then click_at on the foundation pile',
      'Verify the card moved by checking DOM changes (card removed from source, added to foundation)'
    ],
    moveCardBetweenTableau: [
      'Use get_dom_snapshot to identify face-up tableau cards and valid moves',
      'A card can move to another tableau column if the target top card is one rank higher and opposite color',
      'Click the source card to select it, then click the target column/card',
      'Alternatively, use drag tool from source card coordinates to target pile coordinates',
      'Kings can be moved to empty tableau columns',
      'Moving a card reveals the face-down card underneath (auto-flips)',
      'Verify the move via get_dom_snapshot showing updated pile contents'
    ]
  },
  warnings: [
    'Google Solitaire is embedded in search results -- NOT a standalone page, URL stays as google.com/search',
    'Actual CSS selectors on the live page may differ from research -- always verify with get_dom_snapshot before interacting',
    'Card positions change as game progresses -- always re-inspect DOM before each move',
    'Cookie consent overlay may block game interaction on first visit -- dismiss before playing',
    'The game widget container may use dynamically generated class names -- prefer data attributes and aria labels over class selectors',
    'Face-down cards cannot be clicked/moved directly -- they flip automatically when the card above is moved away',
    'If DOM clicks do not register on cards, switch to click_at with viewport coordinates from element bounding rects',
    'Card drag animations may briefly delay DOM updates -- use wait_for_stable between moves'
  ],
  toolPreferences: ['click_at', 'drag', 'click', 'double_click', 'get_dom_snapshot', 'navigate', 'wait_for_stable', 'press_key', 'read_page']
});
