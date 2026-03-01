/**
 * Site Guide: Walmart
 * Per-site guide for Walmart e-commerce platform.
 */

registerSiteGuide({
  site: 'Walmart',
  category: 'E-Commerce & Shopping',
  patterns: [
    /walmart\.com/i
  ],
  guidance: `WALMART-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search and add to cart
  click e5    # search box
  type e5 "paper towels"
  enter
  click e12   # product result
  click e20   # add to cart button
  gettext e25   # cart confirmation

Walmart.com offers both online-only and in-store pickup items. Always check availability.

SEARCH & NAVIGATION:
- Search box: input[name="q"]
- Results are listed in [data-testid="list-view"] containers
- Product title: [data-testid="product-title"]
- Price: [data-testid="price-wrap"]
- Add to cart: [data-testid="add-to-cart-btn"]

IMPORTANT NOTES:
- Some items are in-store only -- check availability before reporting
- Walmart+ members get free shipping on eligible orders
- Third-party marketplace sellers exist alongside Walmart direct items`,
  selectors: {
    searchBox: 'input[name="q"]',
    addToCart: '[data-testid="add-to-cart-btn"]',
    price: '[data-testid="price-wrap"]',
    productTitle: '[data-testid="product-title"]',
    results: '[data-testid="list-view"]'
  },
  workflows: {
    addToCart: [
      'Search for the product using the search box',
      'Analyze results and select best match',
      'Click on the product to open its page',
      'Verify product title and check availability',
      'Click Add to Cart button',
      'Confirm item was added to cart'
    ]
  },
  warnings: [
    'Walmart may show in-store-only items -- check availability',
    'Third-party marketplace sellers may have different policies'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'navigate']
});
