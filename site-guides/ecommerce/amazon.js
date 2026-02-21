/**
 * Site Guide: Amazon
 * Per-site guide for Amazon e-commerce platform.
 */

registerSiteGuide({
  site: 'Amazon',
  category: 'E-Commerce & Shopping',
  patterns: [
    /amazon\.(com|co\.\w+|in|de|fr|jp|ca|com\.au|com\.br|com\.mx)/i
  ],
  guidance: `AMAZON-SPECIFIC INTELLIGENCE:

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
- Next: .a-carousel-goto-nextpage`,
  selectors: {
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
    'Many Amazon pages require sign-in (orders, wishlist, etc.) -- redirects to sign-in page',
    'Amazon search results have direct add-to-cart buttons via [name="submit.addToCart"]',
    'Category department dropdown uses #searchDropdownBox to narrow search scope'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'selectOption', 'navigate', 'scrollToElement']
});
