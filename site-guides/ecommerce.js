/**
 * Site Guide: E-Commerce & Shopping
 * Covers Amazon, eBay, Walmart, Target, BestBuy, Newegg, Etsy, AliExpress, Flipkart
 */

const ECOMMERCE_GUIDE = {
  name: 'E-Commerce & Shopping',

  patterns: [
    /amazon\.(com|co\.\w+|in|de|fr|jp|ca|com\.au|com\.br|com\.mx)/i,
    /ebay\.(com|co\.\w+|de|fr|com\.au)/i,
    /walmart\.com/i,
    /bestbuy\.com/i,
    /target\.com/i,
    /newegg\.com/i,
    /etsy\.com/i,
    /aliexpress\.com/i,
    /flipkart\.com/i,
    /shopify\.com/i,
    /costco\.com/i,
    /homedepot\.com/i,
    /lowes\.com/i
  ],

  guidance: `E-COMMERCE SHOPPING INTELLIGENCE:

AMAZON-SPECIFIC INTELLIGENCE:

NAVIGATION:
- Search box: [aria-label="Search Amazon"] or [role="searchbox"] or #twotabsearchtextbox
- Search submit: #nav-search-submit-button (input[type="submit"])
- Category menu ("All"): [aria-label="Open All Categories Menu"] (#nav-hamburger-menu)
- Cart: #nav-cart with item count in #nav-cart-count
- Account/Sign-in: [aria-controls="nav-flyout-accountList"] (shows "Hello, sign in / Account & Lists")
- Orders: #nav-orders (shows "Returns & Orders")
- Location: #nav-global-location-popover-link (shows "Delivering to [city] [zip] / Update location")
- Sign in button: .nav-action-signin-button
- Language/Country: [aria-label="Expand to Change Language or Country"]
- Category nav bar links (Best Sellers, Today's Deals, Amazon Basics, etc.): use .nav-a class

SEARCH RESULTS PAGE:
- Results: [data-component-type="s-search-result"] containers
- Sponsored items: marked with [aria-label="Leave feedback on Sponsored ad"]
- Category filter dropdown: #searchDropdownBox
- Add-to-cart from results: [name="submit.addToCart"] (some items have direct add-to-cart)
- Pagination: .s-pagination-next

CAROUSELS (Homepage & Product Pages):
- Previous: .a-carousel-goto-prevpage
- Next: .a-carousel-goto-nextpage

PRODUCT SEARCH & SELECTION:
1. IDENTIFY PRODUCT LISTINGS: Look for product cards with title, price, rating, and seller info.
2. SKIP SPONSORED RESULTS: Sponsored/Ad products appear first. Skip them unless the user explicitly wants sponsored items. Look for [aria-label="Leave feedback on Sponsored ad"] markers.
3. MATCH EXACTLY: "PS5 Controller" is NOT "PS5 Console". Match the exact product type requested.
4. SELECTION PRIORITY:
   - Exact product name match (not accessories or related items)
   - Non-sponsored over sponsored
   - Higher ratings (4+ stars) with substantial review count
   - Reputable sellers (Amazon, manufacturer, official stores)
   - Reasonable price (suspiciously low prices = scam or wrong item)

VERIFICATION BEFORE ACTION:
- State which product you selected and WHY (price, rating, seller)
- If no good match exists, explain and scroll for more results
- On product page, verify title/specs before adding to cart

CART & CHECKOUT:
- Prefer "Add to Cart" (#add-to-cart-button) over "Buy with 1-Click" (safer, user can review)
- After adding to cart, verify the cart confirmation message
- For checkout tasks, proceed step by step and report each stage

PRICE INTELLIGENCE:
- Prices may show ranges ($29.99 - $49.99) -- click to see actual price
- Watch for "List Price" vs "Deal Price" distinction
- Note if item is on sale/deal and the discount percentage`,

  selectors: {
    amazon: {
      searchBox: '[aria-label="Search Amazon"], [role="searchbox"], #twotabsearchtextbox',
      searchButton: '#nav-search-submit-button',
      allMenu: '#nav-hamburger-menu',
      cart: '#nav-cart',
      cartCount: '#nav-cart-count',
      account: '[aria-controls="nav-flyout-accountList"]',
      orders: '#nav-orders',
      location: '#nav-global-location-popover-link',
      signIn: '.nav-action-signin-button',
      languageCountry: '[aria-label="Expand to Change Language or Country"]',
      addToCart: '#add-to-cart-button',
      addToCartSearch: '[name="submit.addToCart"]',
      buyNow: '#buy-now-button',
      price: '.a-price .a-offscreen',
      productTitle: '#productTitle',
      rating: '.a-icon-star-small .a-icon-alt',
      results: '[data-component-type="s-search-result"]',
      sponsoredLabel: '[aria-label="Leave feedback on Sponsored ad"]',
      nextPage: '.s-pagination-next',
      categoryDropdown: '#searchDropdownBox',
      carouselPrev: '.a-carousel-goto-prevpage',
      carouselNext: '.a-carousel-goto-nextpage',
      deliveryDate: '#mir-layout-DELIVERY_BLOCK .a-text-bold'
    },
    ebay: {
      searchBox: '#gh-ac',
      searchButton: '#gh-btn',
      price: '.x-price-primary span',
      productTitle: '.x-item-title__mainTitle',
      addToCart: '#atcBtn_btn_1',
      buyNow: '#binBtn_btn_1',
      results: '.s-item',
      bidPrice: '.x-price-approx__price'
    },
    walmart: {
      searchBox: 'input[name="q"]',
      addToCart: '[data-testid="add-to-cart-btn"]',
      price: '[data-testid="price-wrap"]',
      productTitle: '[data-testid="product-title"]',
      results: '[data-testid="list-view"]'
    },
    target: {
      searchBox: '#search',
      addToCart: '[data-test="addToCartButton"]',
      price: '[data-test="product-price"]',
      productTitle: '[data-test="product-title"]'
    },
    bestbuy: {
      searchBox: '#gh-search-input',
      addToCart: '.add-to-cart-button',
      price: '.priceView-customer-price span',
      productTitle: '.sku-title h1'
    }
  },

  workflows: {
    addToCart: [
      'Search for the product using the search box',
      'Analyze results and select best match (skip sponsored)',
      'Click on the product to open its page',
      'Verify product title and specs match the request',
      'Click Add to Cart button',
      'Confirm item was added to cart'
    ],
    priceCheck: [
      'Search for the product',
      'Extract prices from multiple listings',
      'Compare prices across results',
      'Report the best price with seller info'
    ],
    checkout: [
      'Verify cart contents',
      'Proceed to checkout',
      'Fill shipping information if needed',
      'Select shipping method',
      'Review order summary',
      'Report final total before confirming'
    ]
  },

  warnings: [
    'Amazon sponsored results appear first -- identify via [aria-label="Leave feedback on Sponsored ad"]. Skip unless specifically requested.',
    'Prices may show a range -- click the product to see the actual price',
    'Third-party sellers may have different return policies',
    'Many Amazon pages require sign-in (orders, wishlist, etc.) -- redirects to sign-in page',
    'Amazon search results have direct add-to-cart buttons via [name="submit.addToCart"]',
    'Category department dropdown uses #searchDropdownBox to narrow search scope',
    'Cookie/location popups may appear on first visit and need dismissing',
    'eBay items may be auction-based -- check if Buy It Now is available',
    'Walmart and Target may show in-store-only items -- check availability',
    'AliExpress shipping times can be weeks -- note the delivery estimate'
  ],

  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'selectOption', 'navigate', 'scrollToElement']
};

registerSiteGuide(ECOMMERCE_GUIDE);
