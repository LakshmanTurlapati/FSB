# Phase 8: Site Guides Viewer - Research

**Researched:** 2026-02-21
**Domain:** Chrome Extension UI (vanilla JS/CSS), data restructuring (JS modules)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Guide Data Restructuring
- Split each category file (ecommerce.js, social.js, etc.) into per-site files (amazon.js, ebay.js, linkedin.js, etc.)
- Organize in category subdirectories: `site-guides/ecommerce/amazon.js`, `site-guides/social/linkedin.js`, etc.
- Each site file is self-contained with its own selectors, workflows, warnings, and guidance
- Shared category-level guidance preserved alongside per-site overrides (both layers exist)
- When AI loads a guide for a URL: load the matched site's guide + the shared category guidance (lean context, not the whole category)

#### Viewer Placement
- Separate sub-section below the memory list in the Memory tab, with a clear visual break (distinct section header, subtle background or divider)
- Section always visible (not collapsed by default)
- Section header shows title with site coverage count (e.g., "Built-in Site Guides -- 42 sites covered")
- Category-specific FontAwesome icons per guide category (cart for ecommerce, comments for social, chart-line for finance, plane for travel, envelope for email, code for coding, briefcase for career, gamepad for gaming, tasks for productivity)

#### Viewer List Structure
- Flat list of all individual sites, grouped by category with header labels
- Category headers are collapsible -- users can collapse categories they don't care about
- Each site item shows: site name + category badge
- Expanding a site uses inline accordion (same as memory detail panels)
- One site expanded at a time (accordion behavior -- opening one collapses any other)

#### Expanded Site Content
- Content organized as collapsible sub-sections within the expanded site panel (Guidance, Selectors, Workflows, Warnings)
- All sub-sections collapsed by default when a site is first expanded
- Tool preferences are NOT shown in the viewer (purely internal AI context)

#### Search and Filtering
- Extend the existing Memory tab search box to also filter site guides
- Search matches against site names and category names only (not guide content)
- Matching filters the guide list -- non-matching sites and empty category headers are hidden
- The type filter dropdown (Episodic/Semantic/Procedural) remains for memories only; Site Guides section is always visible regardless of type filter selection

### Claude's Discretion
- Exact display format for selectors (table vs code block) -- depends on restructured data format
- Exact display format for workflows (ordered list, etc.)
- Exact display format for warnings
- How guidance text is rendered (plain text, formatted sections, etc.)
- Exact icons chosen per category
- CSS styling details matching existing detail panel patterns
- How category-level shared guidance vs site-specific guidance is presented in the viewer
- Whether sub-sections show item counts in their headers

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Summary

This phase involves two intertwined tasks: (1) restructuring the 9 existing site guide category files into per-site granular files organized in category subdirectories, and (2) building a read-only viewer UI in the Memory tab to browse these guides. The codebase is vanilla JavaScript (no frameworks), uses Chrome Extension Manifest V3, and loads site guides via `importScripts()` in the background service worker. The options page (where the Memory tab lives) is a single-page dashboard with sidebar navigation, already containing memory list rendering with accordion-style detail panels.

The current site guide architecture uses a registration pattern: each category file defines a single guide object and calls `registerSiteGuide()` to add it to `SITE_GUIDES_REGISTRY`. The AI integration then uses `getGuideForUrl()` or `getGuideForTask()` to find the matching guide. The restructuring must preserve this pattern while enabling per-site granularity. The viewer UI must integrate seamlessly with the existing Memory tab, sharing the search input but not the type filter dropdown.

**Primary recommendation:** Split the work into two parallel tracks -- data restructuring (per-site files + registry refactor) first, then UI viewer construction that reads from the new registry. Keep the `registerSiteGuide()` pattern but extend it to support per-site registration with category metadata.

## Standard Stack

This phase uses NO external libraries beyond what the project already uses. The entire implementation is vanilla JavaScript and CSS within a Chrome Extension.

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FontAwesome | 6.6.0 | Icons for categories and UI elements | Already loaded via CDN in options.html |
| Chrome Extension APIs | MV3 | Storage, messaging, importScripts | Required by architecture |
| Vanilla JS (ES2021+) | N/A | All logic, DOM manipulation, rendering | Project standard, no frameworks |
| CSS Custom Properties | N/A | Theming (light/dark), consistent styling | Already used throughout options.css |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| D3 Force (minified) | In-project | Graph visualization for site maps | NOT needed for this phase |
| Chart.js | In-project | Dashboard analytics | NOT needed for this phase |

### No New Dependencies Required
This phase introduces zero new dependencies. Everything is achievable with the existing vanilla JS + CSS approach already used in the codebase.

## Architecture Patterns

### Current Site Guide Structure
```
site-guides/
  index.js          # Registry, getGuideForUrl(), getGuideForTask()
  ecommerce.js      # Single object: ECOMMERCE_GUIDE with all sites mixed
  social.js         # Single object: SOCIAL_GUIDE with all sites mixed
  coding.js         # Single object: CODING_GUIDE
  travel.js         # Single object: TRAVEL_GUIDE
  finance.js        # Single object: FINANCE_GUIDE
  email.js          # Single object: EMAIL_GUIDE
  gaming-platforms.js  # Single object: GAMING_PLATFORMS_GUIDE
  career.js         # Single object: CAREER_GUIDE
  productivity.js   # Single object: PRODUCTIVITY_GUIDE
```

### Recommended New Structure
```
site-guides/
  index.js                    # Enhanced registry with per-site and category-level support
  ecommerce/
    _shared.js                # Category-level shared guidance, warnings, workflows
    amazon.js                 # Amazon-specific: selectors, workflows, warnings, guidance
    ebay.js
    walmart.js
    target.js
    bestbuy.js
  social/
    _shared.js
    linkedin.js
    twitter.js                # Also covers x.com
    facebook.js
    reddit.js
    instagram.js
    youtube.js
  finance/
    _shared.js
    yahoo-finance.js
    google-finance.js
    tradingview.js
    robinhood.js
    coinbase.js
    finviz.js
  travel/
    _shared.js
    booking.js
    expedia.js
    airbnb.js
    kayak.js
    southwest.js
    united.js
    google-travel.js
  email/
    _shared.js
    gmail.js
    outlook.js
    yahoo-mail.js
  coding/
    _shared.js
    leetcode.js
    hackerrank.js
    github.js
    codeforces.js
    geeksforgeeks.js
    stackoverflow.js
  career/
    _shared.js
    indeed.js
    glassdoor.js
    builtin.js
    generic.js                # Generic career page patterns
  gaming/
    _shared.js
    steam.js
    epic-games.js
    gog.js
    humble-bundle.js
  productivity/
    _shared.js
    google-sheets.js
    google-docs.js
```

### Pattern 1: Per-Site Registration with Category Metadata
**What:** Each site file registers itself with category information so the registry can group sites and load appropriate shared guidance.
**When to use:** Every per-site file.
**Example:**
```javascript
// site-guides/ecommerce/amazon.js
registerSiteGuide({
  site: 'Amazon',
  category: 'E-Commerce & Shopping',
  patterns: [
    /amazon\.(com|co\.\w+|in|de|fr|jp|ca|com\.au|com\.br|com\.mx)/i
  ],
  guidance: `AMAZON-SPECIFIC INTELLIGENCE:
    ...`,
  selectors: {
    searchBox: '[aria-label="Search Amazon"], ...',
    addToCart: '#add-to-cart-button',
    ...
  },
  workflows: {
    addToCart: [...],
    priceCheck: [...]
  },
  warnings: [
    'Sponsored results appear first...',
    ...
  ],
  toolPreferences: ['click', 'type', 'scroll', ...]
});
```

### Pattern 2: Shared Category Guidance
**What:** A `_shared.js` file per category provides category-level guidance that the AI receives alongside the matched site's guide.
**When to use:** Each category directory.
**Example:**
```javascript
// site-guides/ecommerce/_shared.js
registerCategoryGuidance({
  category: 'E-Commerce & Shopping',
  icon: 'fa-cart-shopping',
  guidance: `E-COMMERCE SHOPPING INTELLIGENCE:

PRODUCT SEARCH & SELECTION:
1. IDENTIFY PRODUCT LISTINGS: Look for product cards...
2. SKIP SPONSORED RESULTS: ...
...`,
  warnings: [
    'Cookie/location popups may appear on first visit...',
    ...
  ]
});
```

### Pattern 3: Enhanced Registry for Viewer
**What:** The registry exposes methods to enumerate all sites grouped by category for the viewer UI.
**When to use:** The options page viewer needs to iterate all registered guides.
**Example:**
```javascript
// In index.js -- additional methods
function getAllSiteGuides() {
  return SITE_GUIDES_REGISTRY;
}

function getSiteGuidesByCategory() {
  const grouped = {};
  for (const guide of SITE_GUIDES_REGISTRY) {
    const cat = guide.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(guide);
  }
  return grouped;
}

function getCategoryMeta() {
  return CATEGORY_META; // icon, name, shared guidance
}
```

### Pattern 4: Viewer Accordion (Matching Existing Memory Detail Panel Pattern)
**What:** The viewer uses the same expand/collapse pattern as the memory detail panels.
**When to use:** Expanding a site guide item in the viewer.
**Example:**
```javascript
// Same pattern as toggleMemoryDetail() in options.js
function toggleGuideDetail(guideItem) {
  if (guideItem.classList.contains('guide-expanded')) {
    collapseGuideDetail(guideItem);
    return;
  }
  // Collapse any other expanded guide (accordion behavior)
  const existingExpanded = document.querySelector('.guide-item.guide-expanded');
  if (existingExpanded) collapseGuideDetail(existingExpanded);

  const panelHtml = renderGuideDetailPanel(guide);
  const panelDiv = document.createElement('div');
  panelDiv.className = 'guide-detail-panel';
  panelDiv.innerHTML = panelHtml;
  guideItem.classList.add('guide-expanded');
  guideItem.after(panelDiv);
}
```

### Pattern 5: Collapsible Sub-sections within Expanded Content
**What:** Within an expanded site guide, the Guidance/Selectors/Workflows/Warnings sections are collapsible headers.
**When to use:** Rendering guide detail content.
**Example:**
```javascript
function renderGuideSubSection(title, content, count, collapsed = true) {
  const countBadge = count !== null ? ` (${count})` : '';
  return `
    <div class="guide-subsection ${collapsed ? 'collapsed' : ''}">
      <div class="guide-subsection-header" onclick="this.parentElement.classList.toggle('collapsed')">
        <i class="fas fa-chevron-right guide-subsection-chevron"></i>
        <span>${title}${countBadge}</span>
      </div>
      <div class="guide-subsection-content">
        ${content}
      </div>
    </div>
  `;
}
```

### Anti-Patterns to Avoid
- **Loading all guide JS files in options.html via script tags:** The options page does NOT need to execute guide registration. Instead, either import the data as static JSON-like structures or use a separate data export mechanism.
- **Duplicating guide data between background.js and options.html:** The guide data should have a single source of truth. The viewer should read from the same files, or from the registry via message passing.
- **Re-implementing the accordion from scratch:** Reuse the existing `toggleMemoryDetail` pattern.
- **Putting viewer logic into the existing options.js monster file (4700+ lines):** Create a separate `site-guides-viewer.js` file loaded by options.html.

## Data Access Strategy

### Problem: Options Page vs Background Worker
The site guide files are currently loaded via `importScripts()` in background.js (service worker context). The options page (where the viewer lives) is a separate HTML page with its own JS context. The options page cannot directly call `importScripts()`.

### Recommended Approach: Load Guide Data in Options Page
**Confidence:** HIGH (verified from codebase)

The simplest approach is to add `<script>` tags for the site guide files in options.html, just as background.js uses `importScripts()`. The per-site files use the same `registerSiteGuide()` function which writes to a global `SITE_GUIDES_REGISTRY` array. Since the options page already loads numerous script files (14+ scripts), adding the site guide scripts is the established pattern.

```html
<!-- In options.html -->
<script src="../site-guides/index.js"></script>
<script src="../site-guides/ecommerce/_shared.js"></script>
<script src="../site-guides/ecommerce/amazon.js"></script>
<!-- ... etc -->
```

**Alternative considered:** Message passing to background worker to request guide data. This is more complex (async, requires serialization) and unnecessary since the guide data is static and read-only.

**Alternative considered:** Generating a single JSON manifest file at build time. This project has no build step, so this adds complexity.

### The Selected Approach
Load the site guide scripts directly in options.html. The `registerSiteGuide()` and related registry functions from `index.js` will be available globally, and the viewer JS can call `getAllSiteGuides()` / `getSiteGuidesByCategory()` to get the data for rendering.

## Current Data Inventory

### Sites per Category (from codebase analysis)

| Category | Sites with Selectors | Additional Pattern-Matched Sites | Total |
|----------|---------------------|----------------------------------|-------|
| E-Commerce & Shopping | 5 (amazon, ebay, walmart, target, bestbuy) | 8 (newegg, etsy, aliexpress, flipkart, shopify, costco, homedepot, lowes) | 13 |
| Social Media | 6 (linkedin, twitter/x, facebook, reddit, instagram, youtube) | 4 (threads, mastodon, bsky, tiktok) | 10 |
| Finance & Trading | 6 (yahoo-finance, google, tradingview, robinhood, coinbase, finviz) | 12 (schwab, etrade, binance, bloomberg, etc.) | 18 |
| Travel & Booking | 7 (booking, expedia, airbnb, kayak, southwest, united, google-travel) | 16 (hotels, skyscanner, tripadvisor, delta, etc.) | 23 |
| Email Platforms | 3 (gmail, outlook, yahoo-mail) | 1 (protonmail) | 4 |
| Coding Platforms | 6 (leetcode, hackerrank, github, codeforces, geeksforgeeks, stackoverflow) | 6 (codepen, codesandbox, replit, gitlab, codechef, atcoder) | 12 |
| Career & Job Search | 4 (indeed, glassdoor, builtin, generic) | 6 (lever, greenhouse, ashby, workday, icims, jobvite) | 10 |
| Gaming Platforms | 4 (steam, epic-games, gog, humble-bundle) | 0 | 4 |
| Productivity Tools | 2 (google-sheets, google-docs) | 0 | 2 |

**Total sites with dedicated selectors:** 43
**Total sites matched by URL patterns:** ~96

**Decision point:** Sites that only have URL patterns but NO selectors should NOT get their own per-site files. They should be covered by the shared category guidance. Only sites with dedicated selectors objects get their own files. This keeps the restructuring focused and avoids creating empty shell files.

**Recommended count for viewer header:** Count sites that have per-site files (i.e., those with selectors) -- approximately 43 sites.

## Display Format Recommendations (Claude's Discretion)

### Selectors: Use Table Format
**Recommendation:** Display selectors as a two-column table (Name | Selector). This matches the existing `detail-table` CSS pattern used in memory semantic detail panels.

```html
<table class="detail-table">
  <tbody>
    <tr><td class="detail-code">searchBox</td><td class="detail-code">[aria-label="Search Amazon"]</td></tr>
    <tr><td class="detail-code">addToCart</td><td class="detail-code">#add-to-cart-button</td></tr>
  </tbody>
</table>
```

**Why:** Selectors are key-value pairs. The table provides clean alignment. Using `detail-code` on both columns gives the monospace font appropriate for CSS selectors. This reuses existing CSS.

### Workflows: Use Ordered Lists
**Recommendation:** Display workflows as named sections with numbered steps.

```html
<div class="guide-workflow">
  <div class="detail-label">addToCart</div>
  <ol class="detail-list detail-list-ordered">
    <li>Search for the product using the search box</li>
    <li>Analyze results and select best match</li>
    ...
  </ol>
</div>
```

**Why:** Workflows are sequential steps. Ordered lists convey sequence. The existing `detail-list-ordered` CSS class already supports this.

### Warnings: Use Bulleted List with Warning Icon
**Recommendation:** Display warnings as a bulleted list, each prefixed with a subtle warning icon or marker.

```html
<ul class="detail-list">
  <li>Sponsored results appear first -- identify via...</li>
  <li>Prices may show a range -- click the product...</li>
</ul>
```

### Guidance: Use Pre-formatted Plain Text
**Recommendation:** Render guidance as pre-formatted text in a scrollable container, preserving the original line breaks and structure. The guidance text is already well-structured with headers (ALL CAPS sections) and indentation.

```html
<div class="guide-guidance-text">
  <pre class="guide-guidance-pre">${escapeHtml(guidance)}</pre>
</div>
```

**Why:** The guidance text contains structured sections with CAPS headers, numbered lists, and dash-prefixed items. Preserving the original formatting is clearer than trying to parse and reformat it.

### Category vs Site Guidance in Viewer
**Recommendation:** Show a "Category Guidance" sub-section (from `_shared.js`) at the top when a site is expanded, followed by "Site-Specific" sub-sections (Selectors, Workflows, Warnings). This makes it clear which guidance is shared vs specific.

### Sub-section Item Counts
**Recommendation:** YES, show counts. Selectors show count (e.g., "Selectors (24)"), Workflows show count (e.g., "Workflows (3)"), Warnings show count (e.g., "Warnings (5)"). Guidance does not show a count.

### Category Icons
**Recommendation:**
| Category | Icon Class | Rationale |
|----------|------------|-----------|
| E-Commerce & Shopping | `fa-cart-shopping` | Standard shopping cart |
| Social Media | `fa-comments` | Conversation/messaging |
| Finance & Trading | `fa-chart-line` | Stock chart line |
| Travel & Booking | `fa-plane` | Air travel |
| Email Platforms | `fa-envelope` | Standard email |
| Coding Platforms | `fa-code` | Code brackets |
| Career & Job Search | `fa-briefcase` | Professional briefcase |
| Gaming Platforms | `fa-gamepad` | Game controller |
| Productivity Tools | `fa-list-check` | Task checklist |

**Note:** `fa-tasks` (mentioned in CONTEXT.md) is the FA5 name; `fa-list-check` is the FA6 equivalent. Since the project uses FA 6.6.0, use `fa-list-check`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion expand/collapse | New animation/toggle system | Existing `toggleMemoryDetail` pattern | Already proven in memory tab, consistent UX |
| Collapsible sections | Custom show/hide logic | CSS class toggle (`.collapsed`) with CSS transitions | Simpler, GPU-accelerated, less JS |
| Search/filter | New search implementation | Extend existing `searchMemories()` debounced handler | Already handles debounce, type filter |
| HTML escaping | String.replace() | Existing `escapeHtml()` function | Already in options.js, handles all cases |
| Time formatting | New formatter | Existing `formatTimeAgo()` function | Already in options.js |
| Toast notifications | Alert() | Existing `showToast()` function | Already in options.js |

**Key insight:** The options.js already has a comprehensive utility toolbox (escapeHtml, formatTimeAgo, showToast, accordion patterns). The viewer should reuse all of these rather than inventing new approaches.

## Common Pitfalls

### Pitfall 1: Breaking AI Guide Loading in Background Worker
**What goes wrong:** Restructuring guide files changes how `importScripts()` works in background.js. If the new per-site file structure is wrong, the AI loses access to all site guides silently.
**Why it happens:** `importScripts()` is synchronous and fails silently in service workers for some error types. Paths must be relative to the extension root.
**How to avoid:** After restructuring, verify that `getGuideForUrl('https://www.amazon.com')` still returns a guide in the background worker. Add explicit verification in background.js startup.
**Warning signs:** AI stops giving site-specific guidance during automation.

### Pitfall 2: Race Condition Between Script Loading and Viewer Init
**What goes wrong:** The viewer JS tries to read SITE_GUIDES_REGISTRY before all site guide scripts have loaded and registered.
**Why it happens:** Script tags in HTML load in order but registration happens during script execution. If viewer init fires before all guide scripts have executed, the registry is incomplete.
**How to avoid:** Place the viewer script tag AFTER all guide script tags in options.html. The viewer initialization should be triggered by DOMContentLoaded (which fires after all sync scripts).
**Warning signs:** Viewer shows partial list of sites, missing categories.

### Pitfall 3: Options.html Script Tag Explosion
**What goes wrong:** With ~43 per-site files + 9 shared files + index.js, that is ~53 script tags to add to options.html.
**Why it happens:** No build system, no bundling.
**How to avoid:** This is acceptable for a Chrome Extension (all files are local, no network requests). However, consider creating a single `site-guides/all-guides.js` concatenation file that options.html can load as one script instead of 53 individual ones. Alternatively, since the viewer only needs the data (not the AI integration functions), create a lightweight `site-guides/guides-data.js` that exports just the data the viewer needs.
**Warning signs:** Options page load time increases noticeably.

**Recommended approach:** Have each per-site file self-register as before. In background.js, use individual `importScripts()` calls (they support multiple files in one call). In options.html, use a single loader script that dynamically creates script elements or use a pre-built concatenated file. The simplest approach: just add all the script tags. Chrome extensions load local files with zero network latency.

### Pitfall 4: Search Input Dual Duty Confusion
**What goes wrong:** The search input currently filters memories. Adding site guide filtering means two different lists respond to the same input with different filtering logic.
**Why it happens:** The existing `searchMemories()` function only operates on the memory list. The guide filter is a separate concern.
**How to avoid:** Create a wrapper function (e.g., `handleMemorySearch()`) that calls both `searchMemories()` and `filterSiteGuides()` on input change. Keep the filtering logic separate but triggered by the same event.
**Warning signs:** Searching hides site guides entirely, or guide filtering breaks memory filtering.

### Pitfall 5: Collapsible Category Headers State Loss on Search
**What goes wrong:** When user collapses a category, then searches, then clears search, the collapsed state is lost because filtering re-renders the guide list.
**Why it happens:** If the filter function operates by hiding/showing DOM elements rather than re-rendering, this is not an issue. But if it re-renders the HTML, collapsed states are lost.
**How to avoid:** Use CSS visibility (hide/show via class toggle) for search filtering rather than re-rendering the guide list. Only render the guide list once on page load. Search filtering should toggle visibility classes.
**Warning signs:** Category collapse states reset when typing in search.

### Pitfall 6: importScripts Path Changes Break Extension
**What goes wrong:** background.js currently uses `importScripts('site-guides/ecommerce.js')`. Changing to `importScripts('site-guides/ecommerce/amazon.js')` requires updating every path.
**Why it happens:** File paths changed but background.js was not fully updated.
**How to avoid:** Update background.js importScripts in lockstep with file restructuring. Test loading extension after every batch of changes.
**Warning signs:** Extension fails to load, service worker crashes silently.

## Code Examples

### Example 1: Per-Site File Structure (amazon.js)
```javascript
// site-guides/ecommerce/amazon.js
registerSiteGuide({
  site: 'Amazon',
  category: 'E-Commerce & Shopping',
  patterns: [
    /amazon\.(com|co\.\w+|in|de|fr|jp|ca|com\.au|com\.br|com\.mx)/i
  ],
  guidance: `AMAZON-SPECIFIC INTELLIGENCE:

NAVIGATION:
- Search box: [aria-label="Search Amazon"] or [role="searchbox"] or #twotabsearchtextbox
...`,
  selectors: {
    searchBox: '[aria-label="Search Amazon"], [role="searchbox"], #twotabsearchtextbox',
    searchButton: '#nav-search-submit-button',
    cart: '#nav-cart',
    addToCart: '#add-to-cart-button',
    buyNow: '#buy-now-button',
    price: '.a-price .a-offscreen',
    productTitle: '#productTitle',
    results: '[data-component-type="s-search-result"]',
    // ... all amazon-specific selectors
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
    priceCheck: [...]
  },
  warnings: [
    'Sponsored results appear first -- identify via [aria-label="Leave feedback on Sponsored ad"]',
    'Prices may show a range -- click the product to see the actual price',
    // ... amazon-specific warnings
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement']
});
```

### Example 2: Category Shared File (_shared.js)
```javascript
// site-guides/ecommerce/_shared.js
registerCategoryGuidance({
  category: 'E-Commerce & Shopping',
  icon: 'fa-cart-shopping',
  guidance: `E-COMMERCE SHOPPING INTELLIGENCE:

PRODUCT SEARCH & SELECTION:
1. IDENTIFY PRODUCT LISTINGS: Look for product cards with title, price, rating, and seller info.
2. SKIP SPONSORED RESULTS: Sponsored/Ad products appear first. Skip them unless explicitly requested.
...

VERIFICATION BEFORE ACTION:
- State which product you selected and WHY (price, rating, seller)
...

CART & CHECKOUT:
- Prefer "Add to Cart" over "Buy with 1-Click" (safer, user can review)
...`,
  warnings: [
    'Cookie/location popups may appear on first visit and need dismissing',
    'Third-party sellers may have different return policies'
  ]
});
```

### Example 3: Enhanced Registry (index.js additions)
```javascript
// Category metadata and shared guidance storage
const CATEGORY_GUIDANCE = {};

function registerCategoryGuidance(meta) {
  if (meta && meta.category) {
    CATEGORY_GUIDANCE[meta.category] = meta;
  }
}

// Enhanced registration stores category on each guide
function registerSiteGuide(guide) {
  if (guide && guide.patterns) {
    // If new per-site format (has .site), store as-is
    // If old category format (has .name, no .site), also accept
    SITE_GUIDES_REGISTRY.push(guide);
  }
}

// For the viewer: get all guides grouped by category
function getSiteGuidesByCategory() {
  const grouped = {};
  for (const guide of SITE_GUIDES_REGISTRY) {
    const cat = guide.category || guide.name || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(guide);
  }
  return grouped;
}

// For the viewer: get category metadata (icons, shared guidance)
function getCategoryGuidance(category) {
  return CATEGORY_GUIDANCE[category] || null;
}

// For the viewer: get total site count
function getTotalSiteCount() {
  return SITE_GUIDES_REGISTRY.filter(g => g.site).length;
}

// For AI: enhanced lookup that returns site guide + category guidance
function getGuideForUrl(url) {
  if (!url) return null;
  for (const guide of SITE_GUIDES_REGISTRY) {
    if (guide.patterns && guide.patterns.some(pattern => pattern.test(url))) {
      // Attach category guidance for AI context
      if (guide.category) {
        guide._categoryGuidance = CATEGORY_GUIDANCE[guide.category] || null;
      }
      return guide;
    }
  }
  return null;
}
```

### Example 4: Viewer Section HTML
```html
<!-- Site Guides Viewer Section (inside Memory section, after memoryListContainer) -->
<div class="site-guides-section" id="siteGuidesSection">
  <div class="site-guides-header">
    <h3>
      <i class="fas fa-book"></i>
      Built-in Site Guides -- <span id="siteGuideCount">0</span> sites covered
    </h3>
  </div>
  <div class="site-guides-list" id="siteGuidesList">
    <!-- Dynamically rendered by site-guides-viewer.js -->
  </div>
</div>
```

### Example 5: Collapsible Sub-section CSS Pattern
```css
.guide-subsection {
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
  margin-top: 8px;
}

.guide-subsection.collapsed .guide-subsection-content {
  display: none;
}

.guide-subsection-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}

.guide-subsection-header:hover {
  color: var(--primary-color);
}

.guide-subsection-chevron {
  transition: transform 0.2s ease;
  font-size: 0.8em;
}

.guide-subsection:not(.collapsed) .guide-subsection-chevron {
  transform: rotate(90deg);
}
```

### Example 6: Background.js Updated ImportScripts
```javascript
// site-guides/index.js must be first
importScripts('site-guides/index.js');

// Category shared files
importScripts('site-guides/ecommerce/_shared.js');
importScripts('site-guides/social/_shared.js');
// ... etc

// Per-site files
importScripts('site-guides/ecommerce/amazon.js');
importScripts('site-guides/ecommerce/ebay.js');
// ... etc

// OR: use a single concatenated loader
// importScripts('site-guides/all-guides.js');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Category-level guide objects (9 files) | Per-site guide objects (~43 files) | This phase | More granular AI context, leaner prompts |
| Guides only visible to AI | Guides browsable by users | This phase | Users can see what guidance ships with extension |
| Background-only guide loading | Guide loading in background + options page | This phase | Two contexts need the same data |

## Open Questions

1. **Backward Compatibility During Restructuring**
   - What we know: The AI integration calls `getGuideForUrl()` and `getGuideForTask()` from index.js. These functions iterate `SITE_GUIDES_REGISTRY`.
   - What's unclear: Whether the transition from old format (`{ name, patterns, guidance, selectors: { site1: {...}, site2: {...} } }`) to new format (`{ site, category, patterns, selectors: {...} }`) needs a migration period where both formats coexist.
   - Recommendation: Implement the new format and update `_buildTaskGuidance()` in ai-integration.js to handle the new per-site structure (selectors are directly on the guide object, not nested under a site key). This is a one-time migration.

2. **Sites Without Dedicated Selectors**
   - What we know: Many URL patterns (e.g., newegg.com, etsy.com, aliexpress.com in ecommerce) match the category but have no dedicated selectors in the current codebase.
   - What's unclear: Should these be shown in the viewer? They would have category guidance but no site-specific content.
   - Recommendation: Do NOT create per-site files for pattern-only sites. They inherit category guidance automatically. The viewer should only show sites that have their own per-site files with actual content. The header count should reflect this.

3. **Options.html Script Loading Count**
   - What we know: ~53 script files to load (9 shared + ~43 per-site + 1 index).
   - What's unclear: Whether this noticeably impacts options page load time.
   - Recommendation: Start with individual script tags (simplest approach). If performance is a concern, batch them into a single concatenated file later. Chrome extension local file loading is very fast.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 9 site guide files read and analyzed line-by-line
- Codebase analysis: options.html, options.js, options.css read for existing patterns
- Codebase analysis: manifest.json, background.js for loading patterns
- Codebase analysis: ai-integration.js for guide usage in AI context

### Secondary (MEDIUM confidence)
- Chrome Extension MV3 importScripts behavior (from prior project experience, consistent with MV3 documentation)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all vanilla JS/CSS using existing patterns
- Architecture: HIGH - Direct codebase analysis of all files involved, clear patterns established
- Data restructuring: HIGH - Every guide file read, every site/selector catalogued
- UI patterns: HIGH - Existing accordion/detail panel patterns directly observed in options.js/css
- Display format recommendations: MEDIUM - These are judgment calls based on the data structure and existing patterns, but open to adjustment
- Pitfalls: HIGH - Based on direct analysis of how guide loading works in background.js and options page

**Research date:** 2026-02-21
**Valid until:** 60 days (stable codebase patterns, no external dependencies changing)
