/**
 * Site Guide: Humble Bundle
 * Per-site guide for the Humble Bundle game store and bundle platform.
 */

registerSiteGuide({
  site: 'Humble Bundle',
  category: 'Gaming Platforms',
  patterns: [
    /humblebundle\.com/i
  ],
  guidance: `HUMBLE BUNDLE-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a game
  click e5    # search input
  type e5 "indie game"
  enter
  click e10   # game or bundle result
  gettext e15   # price or tier info
  # browse bundles
  scroll down
  click e20   # bundle card

SEARCH:
- Search input: input[name="search"]
- Type the game name and press Enter to search

BUNDLES:
- Bundle deals with pay-what-you-want pricing
- Bundle cards: .bundle-card
- Bundles have multiple tiers with different price points and game collections
- Charity component shown on bundle pages (portion goes to charity)

STORE:
- Store section has individual game purchases
- Store items: .entity-card
- Search available in the top nav
- Humble Choice is a monthly subscription with curated game selections

PRICING:
- Bundle prices vary by tier -- report all tier options
- Store prices are standard but often discounted
- Humble Choice members get additional discounts`,
  selectors: {
    searchBox: 'input[name="search"]',
    bundleCard: '.bundle-card',
    storeItem: '.entity-card'
  },
  workflows: {
    priceCheck: [
      'Navigate to humblebundle.com',
      'Use the search input to find the game',
      'Press Enter to submit the search',
      'Click the correct game from results',
      'Extract the price and any bundle availability',
      'Report the price, discounts, and bundle options'
    ],
    browseBundles: [
      'Navigate to humblebundle.com',
      'Scroll to view active bundles',
      'Click a bundle card for details',
      'Extract tier prices and included games',
      'Report all tiers with their prices and game lists'
    ]
  },
  warnings: [
    'Humble Bundle prices vary by tier for bundles -- report all tier options',
    'Some bundle games provide Steam keys, others provide DRM-free downloads -- check the key type',
    'Humble Choice is a subscription service -- distinguish between store purchases and Choice selections'
  ],
  toolPreferences: ['click', 'type', 'pressEnter', 'scroll', 'getText', 'waitForElement', 'navigate', 'getAttribute']
});
