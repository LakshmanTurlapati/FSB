/**
 * Shared Category Guidance: E-Commerce & Shopping
 * Category-level guidance that applies to all e-commerce sites.
 */

registerCategoryGuidance({
  category: 'E-Commerce & Shopping',
  icon: 'fa-cart-shopping',
  guidance: `E-COMMERCE SHOPPING INTELLIGENCE:

PRODUCT SEARCH & SELECTION:
1. IDENTIFY PRODUCT LISTINGS: Look for product cards with title, price, rating, and seller info.
2. SKIP SPONSORED RESULTS: Sponsored/Ad products appear first. Skip them unless the user explicitly wants sponsored items.
3. MATCH EXACTLY: "PS5 Controller" is NOT "PS5 Console". Match the exact product type requested.
4. SELECTION PRIORITY:
   - Exact product name match (not accessories or related items)
   - Non-sponsored over sponsored
   - Higher ratings (4+ stars) with substantial review count
   - Reputable sellers (manufacturer, official stores)
   - Reasonable price (suspiciously low prices = scam or wrong item)

VERIFICATION BEFORE ACTION:
- State which product you selected and WHY (price, rating, seller)
- If no good match exists, explain and scroll for more results
- On product page, verify title/specs before adding to cart

CART & CHECKOUT:
- Prefer "Add to Cart" over "Buy with 1-Click" (safer, user can review)
- After adding to cart, verify the cart confirmation message
- For checkout tasks, proceed step by step and report each stage

PRICE INTELLIGENCE:
- Prices may show ranges -- click to see actual price
- Watch for "List Price" vs "Deal Price" distinction
- Note if item is on sale/deal and the discount percentage`,
  warnings: [
    'Cookie/location popups may appear on first visit and need dismissing',
    'Third-party sellers may have different return policies'
  ]
});
