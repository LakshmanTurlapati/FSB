/**
 * Site Guide: Epic Games Store
 * Per-site guide for the Epic Games Store platform.
 */

registerSiteGuide({
  site: 'Epic Games Store',
  category: 'Gaming Platforms',
  patterns: [
    /store\.epicgames\.com/i
  ],
  guidance: `EPIC GAMES STORE-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search the store
  click e5    # search input
  type e5 "Fortnite"
  enter
  click e10   # game result
  gettext e15   # price
  # check free games
  scroll down
  gettext e20   # free game title

SEARCH:
- Search: use the search icon/input in the top nav
- Search input: input[placeholder*="Search"]
- Type your query and press Enter or wait for autocomplete

FREE GAMES:
- Free games section is prominently featured on the homepage
- Free games element: [data-testid="free-games"]
- Epic often has exclusive deals and free weekly games
- Check the free games section for currently available free titles

GAME LISTINGS:
- Game cards: [data-testid="offer-card"]
- Cards show title, price, and discount info
- Click a card to go to the game's store page for full details

NAVIGATION:
- Epic Games Store is fully React-based
- Pages may need extra wait time for content to load
- Dynamic content loads via API calls -- waitForElement is recommended`,
  selectors: {
    searchBox: 'input[placeholder*="Search"]',
    freeGames: '[data-testid="free-games"]',
    gameCard: '[data-testid="offer-card"]'
  },
  workflows: {
    priceCheck: [
      'Navigate to store.epicgames.com',
      'Use the search input to find the game',
      'Press Enter or wait for autocomplete results',
      'Click the correct game from results',
      'Extract the price from the game store page',
      'Report the price, any discounts, and availability'
    ],
    checkFreeGames: [
      'Navigate to store.epicgames.com',
      'Scroll to the free games section',
      'Extract titles and availability dates of free games',
      'Report the currently free and upcoming free games'
    ]
  },
  warnings: [
    'Epic Games Store pages are fully React-based and may need extra wait time for content to load',
    'Free weekly games rotate on Thursdays -- check availability dates',
    'Some games are Epic Store exclusives and not available on other platforms'
  ],
  toolPreferences: ['click', 'type', 'pressEnter', 'scroll', 'getText', 'waitForElement', 'navigate', 'getAttribute']
});
