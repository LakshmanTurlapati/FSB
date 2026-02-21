/**
 * Shared Category Guidance: Gaming Platforms
 * Category-level guidance that applies to all gaming store sites.
 */

registerCategoryGuidance({
  category: 'Gaming Platforms',
  icon: 'fa-gamepad',
  guidance: `GAMING PLATFORM INTELLIGENCE:

GENERAL WORKFLOW FOR PRICE CHECKS:
1. Navigate to the store or use search
2. Type the game name in the search box
3. Press Enter to search (do NOT click autocomplete suggestions)
4. Click on the correct game from search results
5. Extract the price from the game store page
6. Report the price, any discounts, and availability

PRICE & DISCOUNT EXTRACTION:
- Look for discount blocks that use aria-label attributes with structured price info
- Featured games often contain title, price, and tags (Top Seller, Free To Play, Early Access)
- Search results show game cards with title, price, review score, and tags
- On a game store page, the price area shows current price, any discount, and original price

STORE BROWSING:
- Navigate to store sections or categories for browsing
- Featured/sale/new release sections are usually on the homepage
- Filter by genre, price, features, and OS compatibility where available

AGE VERIFICATION:
- Some stores show age gates on mature content pages
- These require selecting a birth date from dropdowns and clicking a confirm button
- Select a date that makes the user 18+ (e.g., January 1, 1990) and proceed`,
  warnings: [
    'Age verification gates may appear on mature content pages',
    'Two-factor authentication may be required for login -- automation can fill credentials but user must approve',
    'CSS classes on gaming stores are often hashed/dynamic -- prefer aria-label and XPath selectors',
    'React-based store pages may need extra wait time for content to load'
  ]
});
