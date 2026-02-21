/**
 * Site Guide: Target
 * Per-site guide for Target e-commerce platform.
 */

registerSiteGuide({
  site: 'Target',
  category: 'E-Commerce & Shopping',
  patterns: [
    /target\.com/i
  ],
  guidance: `TARGET-SPECIFIC INTELLIGENCE:

Target.com offers both shipping and in-store pickup/same-day delivery options.

SEARCH & NAVIGATION:
- Search box: #search
- Product title: [data-test="product-title"]
- Price: [data-test="product-price"]
- Add to cart: [data-test="addToCartButton"]

IMPORTANT NOTES:
- Target Circle members get special discounts
- Some items may be in-store only
- Same-day delivery (Shipt) and order pickup options available`,
  selectors: {
    searchBox: '#search',
    addToCart: '[data-test="addToCartButton"]',
    price: '[data-test="product-price"]',
    productTitle: '[data-test="product-title"]'
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
    'Target may show in-store-only items -- check availability'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'navigate']
});
