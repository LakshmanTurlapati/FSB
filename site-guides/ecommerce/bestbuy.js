/**
 * Site Guide: Best Buy
 * Per-site guide for Best Buy electronics retailer.
 */

registerSiteGuide({
  site: 'Best Buy',
  category: 'E-Commerce & Shopping',
  patterns: [
    /bestbuy\.com/i
  ],
  guidance: `BEST BUY-SPECIFIC INTELLIGENCE:

Best Buy specializes in electronics, computers, appliances, and tech products.

SEARCH & NAVIGATION:
- Search box: #gh-search-input
- Product title: .sku-title h1
- Price: .priceView-customer-price span
- Add to cart: .add-to-cart-button

IMPORTANT NOTES:
- Best Buy offers in-store pickup and same-day delivery in some areas
- Open-box deals may be available at lower prices
- Member deals require a Best Buy account
- Check product availability at nearby stores`,
  selectors: {
    searchBox: '#gh-search-input',
    addToCart: '.add-to-cart-button',
    price: '.priceView-customer-price span',
    productTitle: '.sku-title h1'
  },
  workflows: {
    addToCart: [
      'Search for the product using the search box',
      'Analyze results and select best match',
      'Click on the product to open its page',
      'Verify product title and specs',
      'Click Add to Cart button',
      'Confirm item was added to cart'
    ]
  },
  warnings: [
    'Some popular electronics may show as "Sold Out" -- check availability',
    'Open-box items have different condition levels (Excellent, Satisfactory, Fair)'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'navigate']
});
