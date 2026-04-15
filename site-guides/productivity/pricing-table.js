/**
 * Site Guide: SaaS Pricing Table
 * Per-site guide for extracting data from SaaS pricing comparison tables.
 *
 * Covers viewport-gated feature comparison tables where rows only become
 * visible when scrolled into view. Primary target: Notion pricing page
 * (notion.so/pricing). Also covers common pricing table patterns across
 * SaaS sites (Airtable, Slack, Asana, GitHub, etc.).
 *
 * Created for Phase 75, SCROLL-09 edge case validation.
 * Target: extract all pricing rows from a table that only loads visible rows.
 */

registerSiteGuide({
  site: 'SaaS Pricing Table',
  category: 'Productivity',
  patterns: [
    /notion\.so\/pricing/i,
    /airtable\.com\/pricing/i,
    /slack\.com\/pricing/i,
    /asana\.com\/pricing/i,
    /github\.com\/pricing/i,
    /atlassian\.com.*pricing/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic SCROLL-09):
- [scroll] Notion pricing is server-rendered -- try full read_page before scroll loop
- [scroll] Scroll 400-600px increments to avoid skipping feature rows (~40-60px each)
- [scroll] Deduplicate by feature name text; detect checkmarks via PlanFeatures_check__
- [scroll] Use class*="PricingGrid_row__" partial match for CSS Module hashed classes
- [scroll] Verify last section (Support) captured to confirm completeness

SAAS PRICING TABLE INTELLIGENCE:

TABLE STRUCTURE:
- SaaS pricing pages typically have a feature comparison table/grid below the hero pricing cards
- The comparison table has plan columns (Free, Pro, Business, Enterprise) as headers
- Feature rows list capabilities with checkmarks, X marks, or specific values per plan
- Tables can have 20-100+ feature rows organized into sections/categories
- Rows below the viewport fold may be lazy-loaded, virtualized, or simply off-screen
- Some sites use HTML <table> elements, others use CSS grid or flexbox layouts

VIEWPORT-GATED BEHAVIOR:
- "Viewport-only" means rows outside the visible area may not have full data loaded
- Common patterns: lazy rendering (IntersectionObserver), content-visibility:auto CSS, virtual scrolling
- Most SaaS pricing tables are NOT truly virtualized -- rows exist in DOM but are off-screen
- The key challenge: reading all rows requires scrolling to bring each section into viewport
- After scrolling, wait for any lazy content to render before reading

PRIMARY TARGET -- NOTION (notion.so/pricing):
- URL: https://www.notion.so/pricing
- Notion pricing page has hero pricing cards (Free, Plus, Business, Enterprise) at top
- Below the cards: "Compare plans" section with a comprehensive feature comparison table
- Table is organized into feature categories (Content, Collaboration, Sharing, Admin, etc.)
- Each category has expandable/collapsible rows
- Table uses a sticky header row with plan names
- Feature rows have the feature name on the left and check/cross/value per plan column
- The table extends well below the initial viewport -- scrolling required to see all rows

FALLBACK TARGET -- AIRTABLE (airtable.com/pricing):
- Airtable pricing has a feature comparison grid below pricing cards
- Similar structure: plan columns, feature rows, category sections
- Use if Notion pricing page structure changes or is inaccessible

COMMON PRICING TABLE SELECTORS (cross-site patterns):
- Table containers: table, [role="table"], [role="grid"], div[class*="comparison"], div[class*="feature"], section[class*="pricing"]
- Table headers (plan names): thead th, [role="columnheader"], div[class*="plan-name"], div[class*="tier"]
- Feature rows: tbody tr, [role="row"], div[class*="feature-row"], div[class*="comparison-row"]
- Feature name cell: td:first-child, [role="rowheader"], div[class*="feature-name"], div[class*="feature-label"]
- Feature value cell: td, [role="gridcell"], div[class*="cell"], div[class*="check"]
- Checkmark indicators: svg (check icon), span containing check unicode, [aria-label*="included"], [aria-label*="check"]
- Cross/X indicators: svg (x icon), span containing dash or X, [aria-label*="not included"]
- Category headers: th[colspan], tr[class*="category"], div[class*="section-header"], div[class*="group-header"]
- Billing toggle: button[class*="toggle"], input[type="checkbox"], [role="switch"], div[class*="billing"]
- Sticky header: thead[class*="sticky"], div[class*="sticky"], position:sticky elements

NOTION-SPECIFIC SELECTORS:
- Pricing hero cards: div[class*="pricingCard"], section containing plan name + price
- Compare plans section: section or div containing "Compare plans" heading text
- Feature table container: table element or div[role="table"] below Compare plans heading
- Feature category row: row with bold/larger text spanning columns (e.g., "Content", "Collaboration")
- Feature value row: row with feature name + check/cross/value per plan
- Plan column headers: typically in first row or sticky header (Free, Plus, Business, Enterprise)
- Expand/collapse toggle: button or clickable element within category headers

SCROLL STRATEGY FOR TABLE EXTRACTION:
- Step 1: Identify the pricing comparison table container on the page
- Step 2: Read the table header row to extract plan names (column identifiers)
- Step 3: Read all currently visible feature rows
- Step 4: Scroll down by 400-600px (smaller than typical page scroll to avoid skipping rows)
- Step 5: Wait for DOM to stabilize (lazy content render)
- Step 6: Read newly visible rows
- Step 7: Deduplicate by feature name (same feature text = already captured)
- Step 8: Repeat scroll-read-deduplicate until no new rows appear for 2 consecutive scrolls
- Step 9: Assemble complete data: plan headers + all feature rows with values

DEDUPLICATION STRATEGY:
- Use feature name text as the unique identifier for each row
- After each scroll, extract feature names from visible rows
- Compare against already-captured feature names
- Only add rows with NEW feature names to the result set
- When 2 consecutive scrolls yield 0 new rows, extraction is complete

DATA EXTRACTION FORMAT:
- Output should be structured: { plans: [plan names], features: [{name, values: {plan: value}}] }
- Values can be: "check" (included), "cross" (not included), or specific text (e.g., "5 GB", "Unlimited")
- Include the feature category/section as a grouping label`,
  selectors: {
    // Generic pricing table selectors
    pricingTableContainer: 'table, [role="table"], [role="grid"], div[class*="comparison"], section[class*="pricing-table"], section[class*="compare"]',
    tableHeader: 'thead, [role="rowgroup"]:first-child, div[class*="header-row"]',
    planColumnHeader: 'thead th, [role="columnheader"], th[scope="col"]',
    featureRow: 'tbody tr, [role="row"], div[class*="feature-row"], div[class*="comparison-row"]',
    featureNameCell: 'td:first-child, th[scope="row"], [role="rowheader"], div[class*="feature-name"]',
    featureValueCell: 'td, [role="gridcell"], div[class*="cell"]',
    checkmarkIndicator: 'svg[class*="check"], [aria-label*="included"], [aria-label*="Included"], span[class*="check"]',
    crossIndicator: 'svg[class*="cross"], svg[class*="x"], [aria-label*="not included"], [aria-label*="Not included"], span[class*="dash"]',
    categoryHeader: 'th[colspan], tr[class*="category"], tr[class*="section"], div[class*="section-header"], div[class*="group-header"]',
    billingToggle: 'button[class*="toggle"], [role="switch"], input[type="checkbox"][class*="billing"], div[class*="billing-toggle"]',
    stickyHeader: 'thead[style*="sticky"], div[style*="sticky"], [class*="sticky-header"]',
    comparePlansLink: 'a[href*="compare"], button:has-text("Compare"), a:has-text("Compare plans")',
    // Notion-specific selectors
    notionPricingCards: 'div[class*="pricingCard"], div[class*="planCard"]',
    notionCompareSection: 'section[class*="compare"], div[class*="compare"]',
    notionFeatureTable: 'table[class*="feature"], div[class*="feature-table"]',
    notionCategoryRow: 'tr[class*="category"], tr[class*="group"], div[class*="category-header"]',
    notionFeatureValueRow: 'tr[class*="feature"], tr:not([class*="category"])',
    // Scroll detection
    scrollContainer: 'main, [role="main"], div[class*="content"], div[class*="pricing-content"]',
    loadingIndicator: 'div[class*="loading"], div[class*="spinner"], [class*="skeleton"]'
  },
  workflows: {
    extractPricingTableRows: [
      'Navigate to the SaaS pricing page (e.g., notion.so/pricing) using navigate tool',
      'Wait for page to fully load via wait_for_stable -- verify pricing content visible',
      'Dismiss any cookie consent banners or promotional overlays if present',
      'Scroll down past the hero pricing cards to find the feature comparison table section (look for "Compare plans" or similar heading)',
      'Use read_page or get_dom_snapshot to identify the table container element (table, role=table, or comparison grid)',
      'Extract the table header row to identify plan column names (e.g., Free, Plus, Business, Enterprise)',
      'Read all currently visible feature rows -- for each row extract: feature name, and value per plan column (check, cross, or text)',
      'Store extracted rows in a deduplication set keyed by feature name text',
      'Scroll down 400-600px to bring more table rows into viewport',
      'Wait for DOM to stabilize after scroll (lazy content may need to render)',
      'Read newly visible feature rows and add only NEW rows (by feature name) to the result set',
      'Repeat scroll-read-deduplicate cycle until 2 consecutive scrolls yield 0 new feature rows',
      'Assemble final output: plan names as columns, all feature rows with their per-plan values',
      'Verify extraction completeness: check that the last category section was fully captured (e.g., "Admin" or "Security" rows at bottom of table)',
      'Report: total feature rows extracted, plan column count, feature categories found, whether any rows appeared empty or failed to load'
    ],
    extractPricingCards: [
      'Navigate to pricing page',
      'Read hero pricing card section at top of page',
      'Extract plan name, monthly price, annual price, and tagline from each card',
      'Identify the recommended/highlighted plan (usually has a "Popular" or "Recommended" badge)',
      'Report plan names and prices'
    ]
  },
  warnings: [
    'Pricing comparison tables can have 50-100+ feature rows -- expect multiple scroll cycles to capture all rows',
    'Some pricing tables use CSS content-visibility:auto which defers rendering of off-screen rows -- scroll slowly (400-600px) and wait for DOM stable after each scroll',
    'Feature rows may use SVG icons for checkmarks instead of text -- check for svg elements or aria-label attributes to determine included/not-included',
    'Sticky headers can cause duplicate readings if the header row re-renders on scroll -- deduplicate by feature name text',
    'Some SaaS sites (Notion, Slack) use React/Next.js with client-side rendering -- pricing tables may not exist in server HTML',
    'Billing toggle (monthly vs annual) affects displayed prices -- document which billing period is active when extracting',
    'Category header rows span all columns and should be captured as grouping labels, not as feature rows',
    'Notion pricing page may restructure their comparison table layout -- fallback to generic table selectors if Notion-specific ones fail'
  ],
  toolPreferences: ['navigate', 'scroll', 'read_page', 'get_dom_snapshot', 'getText', 'click', 'waitForElement', 'waitForDOMStable', 'wait_for_stable']
});
