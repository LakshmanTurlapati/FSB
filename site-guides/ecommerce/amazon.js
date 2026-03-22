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
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic SCROLL-02):
- [scroll] Amazon uses PAGINATION not infinite scroll -- click .s-pagination-next
- [scroll] Deduplicate by data-asin attribute; ~15% overlap between adjacent pages
- [scroll] Detect CAPTCHA: page <10KB or opfcaptcha in source means bot-blocked
- [scroll] Allow 1000-2000ms between page clicks for server-rendered results to load
- [scroll] Break on: target reached, no .s-pagination-next, or 3 pages with 0 new ASINs

AMAZON-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a product
  click e5    # search box
  type e5 "wireless headphones"
  enter
  # select a result (skip sponsored)
  click e12   # product result link
  # add to cart
  click e20   # add to cart button
  gettext e25   # cart confirmation message

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

PAGINATED SEARCH RESULT SCRAPING (500+ ITEMS):

SEARCH RESULTS PAGINATION:
- Amazon search results are PAGINATED, not infinite scroll
- Each page shows ~16-20 product results (varies by category/query)
- Navigate pages via .s-pagination-next ("Next" button at bottom)
- Page numbers shown in .s-pagination-strip
- URL updates with page=N parameter (e.g., &page=2, &page=3)
- After ~400 results (page ~20-25), Amazon may show fewer or different results
- Some search queries cap at ~48 pages maximum

PRODUCT NAME EXTRACTION PER PAGE:
- Each product result is wrapped in [data-component-type="s-search-result"]
- Each result has a data-asin attribute (unique product identifier, e.g., data-asin="B0C3G7KZTN")
- Product name/title: h2 a span.a-text-normal (or h2 a .a-size-medium inside the result container)
- Alternative title selector: h2.a-size-mini a.a-text-normal
- Sponsored results also have product names -- include them in count (they are real products)
- Some results may be "editorial recommendations" or "brands related" sections -- skip these (no data-asin)

DEDUPLICATION WITH ASIN:
- Each search result has a unique data-asin attribute (Amazon Standard Identification Number)
- Use ASIN as unique identifier to avoid double-counting products that appear on multiple pages
- Maintain a Set of seen ASINs across page navigations
- Products appearing as both organic and sponsored should be counted only once
- Some results have data-asin="" (empty) -- these are non-product elements, skip them

METHOD: SCRAPE 500 PRODUCT NAMES FROM SEARCH RESULTS:
Steps:
1. Navigate to amazon.com
2. Dismiss cookie/consent banners if present
3. Search for a broad product category (e.g., "wireless mouse", "phone case", "usb cable") to ensure many results
4. Verify search results loaded: check for [data-component-type="s-search-result"] elements
5. For each [data-component-type="s-search-result"] on current page:
   a. Extract data-asin attribute as unique ID (skip if empty or missing)
   b. Extract product name from h2 a span.a-text-normal (or h2 a .a-size-medium)
   c. If ASIN not in seenASINs set: add to productList and seenASINs
6. After extracting all results on current page, click .s-pagination-next to go to next page
7. Wait for page load (waitForElement on [data-component-type="s-search-result"] or waitForDOMStable)
8. Repeat steps 5-7 until productList.length >= 500 or no next page available
9. If 500 products collected: report count and sample of first 5 and last 5 product names
10. If fewer than 500 after all pages exhausted: report actual count and note the page limit
11. Verify: count of unique ASINs matches productList length, names are non-empty strings

PAGINATION TIMING:
- Allow 1000ms-2000ms after clicking Next for new page to fully load
- Amazon server-renders search results so content is available immediately after page load
- Use waitForElement targeting [data-component-type="s-search-result"] to confirm results loaded
- If next page fails to load after 5 seconds, retry the click once
- Typical rate: 16-20 products per page, ~25-32 pages for 500 products

SEARCH QUERY SELECTION:
- Use broad, generic queries that return many results (avoid niche queries with <500 total results)
- Good queries: "wireless mouse", "phone case", "usb cable", "water bottle", "notebook"
- Bad queries: "left-handed ergonomic keyboard red" (too specific, few results)
- Amazon shows "1-48 of over X results" at the top -- check this to confirm enough results exist
- Aim for queries showing "over 10,000 results" for safety margin`,
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
    deliveryDate: '#mir-layout-DELIVERY_BLOCK .a-text-bold',
    // Paginated search result scraping selectors
    productName: '[data-component-type="s-search-result"] h2 a span.a-text-normal',
    productNameAlt: '[data-component-type="s-search-result"] h2 a .a-size-medium',
    resultContainer: '[data-component-type="s-search-result"]',
    resultAsin: '[data-component-type="s-search-result"][data-asin]',
    paginationNext: '.s-pagination-next',
    paginationStrip: '.s-pagination-strip',
    resultCount: '.s-breadcrumb .a-text-bold:last-child, .sg-col-inner .a-section .a-text-bold'
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
    ],
    scrapeAllSearchResults: [
      'Navigate to amazon.com',
      'Dismiss cookie/consent banners if present',
      'Search for a broad product category (e.g., "wireless mouse") to get many results',
      'Verify results loaded: check for [data-component-type="s-search-result"] elements',
      'Initialize tracking: seenASINs Set, productList array, pageCount = 1',
      'Extract products from current page: data-asin as ID, h2 a span.a-text-normal as name',
      'Skip results with empty or missing data-asin (non-product elements)',
      'Add new unique products to productList (check ASIN not in seenASINs)',
      'Click .s-pagination-next to navigate to next page',
      'Wait for new page to load (waitForElement on search result container)',
      'Increment pageCount, repeat extraction + pagination until 500 products collected',
      'If all pages exhausted before 500: report actual count achieved',
      'Verify: unique ASIN count matches productList length, all names non-empty',
      'Report first 5 and last 5 product names as sample verification'
    ],
    extractProductNames: [
      'Navigate to Amazon search results page for target query',
      'Initialize empty product list and seen-ASINs Set',
      'Loop: extract products from page, click Next, wait for load, repeat',
      'When target count reached, return product name list',
      'Handle pagination end by reporting final count'
    ]
  },
  warnings: [
    'Amazon sponsored results appear first -- identify via [aria-label="Leave feedback on Sponsored ad"]. Skip unless specifically requested.',
    'Prices may show a range -- click the product to see the actual price',
    'Many Amazon pages require sign-in (orders, wishlist, etc.) -- redirects to sign-in page',
    'Amazon search results have direct add-to-cart buttons via [name="submit.addToCart"]',
    'Category department dropdown uses #searchDropdownBox to narrow search scope',
    'Amazon search results are paginated (~16-20 per page), use .s-pagination-next to navigate pages',
    'Use data-asin attribute as unique product identifier for deduplication across pages',
    'Skip results with empty data-asin="" -- these are non-product editorial/brand sections',
    'Allow 1000ms-2000ms after clicking Next for server-rendered results to load',
    'Broad search queries (e.g., "wireless mouse") ensure enough results to reach 500',
    'Amazon may cap results at ~48 pages -- choose queries with "over 10,000 results" for safety'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'selectOption', 'navigate', 'scrollToElement', 'get_dom_snapshot', 'read_page', 'waitForDOMStable']
});
