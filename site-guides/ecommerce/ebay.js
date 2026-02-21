/**
 * Site Guide: eBay
 * Per-site guide for eBay e-commerce and auction platform.
 */

registerSiteGuide({
  site: 'eBay',
  category: 'E-Commerce & Shopping',
  patterns: [
    /ebay\.(com|co\.\w+|de|fr|com\.au)/i
  ],
  guidance: `EBAY-SPECIFIC INTELLIGENCE:

eBay is an auction and fixed-price marketplace. Items can be listed as:
- Buy It Now (fixed price) -- immediate purchase available
- Auction -- bidding required, check current bid and time remaining
- Best Offer -- seller accepts offers below listed price

SEARCH & NAVIGATION:
- Search box: #gh-ac
- Search button: #gh-btn
- Results are listed in .s-item containers
- Check if item is auction or Buy It Now before attempting purchase

PRODUCT PAGE:
- Product title: .x-item-title__mainTitle
- Price: .x-price-primary span
- Bid price (auctions): .x-price-approx__price
- Add to cart: #atcBtn_btn_1
- Buy it now: #binBtn_btn_1`,
  selectors: {
    searchBox: '#gh-ac',
    searchButton: '#gh-btn',
    price: '.x-price-primary span',
    productTitle: '.x-item-title__mainTitle',
    addToCart: '#atcBtn_btn_1',
    buyNow: '#binBtn_btn_1',
    results: '.s-item',
    bidPrice: '.x-price-approx__price'
  },
  workflows: {
    addToCart: [
      'Search for the product using the search box',
      'Analyze results and select best match',
      'Click on the product to open its page',
      'Verify product title matches the request',
      'Check if item is Buy It Now or auction',
      'Click Add to Cart or Buy It Now button',
      'Confirm item was added'
    ]
  },
  warnings: [
    'eBay items may be auction-based -- check if Buy It Now is available',
    'Third-party sellers may have different return policies',
    'Check seller ratings and feedback scores before recommending'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'navigate']
});
