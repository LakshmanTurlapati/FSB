/**
 * Site Guide: GOG
 * Per-site guide for the GOG (Good Old Games) DRM-free game store.
 */

registerSiteGuide({
  site: 'GOG',
  category: 'Gaming Platforms',
  patterns: [
    /gog\.com/i
  ],
  guidance: `GOG-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a game
  click e5    # search input
  type e5 "Witcher 3"
  enter
  click e10   # game result
  gettext e15   # price (DRM-free)

SEARCH:
- Search input: input[name="search"]
- Type the game name and press Enter to search
- GOG has a clean search interface with filtering options

GAME LISTINGS:
- Game cards: .product-tile
- Price display: .product-tile__price
- Cards show title, price, discount, and GOG rating
- Filter by price, genre, features, and OS compatibility

KEY FEATURES:
- GOG is a DRM-free game store -- all games can be downloaded without DRM
- Prices may differ from Steam for the same game
- GOG Galaxy client is optional (games can be downloaded directly)
- GOG often has sales with significant discounts
- Older/classic games are a specialty`,
  selectors: {
    searchBox: 'input[name="search"]',
    gameCard: '.product-tile',
    price: '.product-tile__price'
  },
  workflows: {
    priceCheck: [
      'Navigate to gog.com',
      'Use the search input to find the game',
      'Press Enter to submit the search',
      'Click the correct game from results',
      'Extract the price from the game store page',
      'Report the price, any discounts, and DRM-free status'
    ],
    browseStore: [
      'Navigate to gog.com/games',
      'Use filters for genre, price, or features',
      'Browse game tiles for titles of interest',
      'Click tiles for detailed game info and pricing'
    ]
  },
  warnings: [
    'GOG is DRM-free -- prices may differ from Steam for the same game',
    'GOG specializes in older/classic games that may not be on other platforms',
    'Some newer titles may not be available on GOG'
  ],
  toolPreferences: ['click', 'type', 'pressEnter', 'scroll', 'getText', 'waitForElement', 'navigate', 'getAttribute']
});
