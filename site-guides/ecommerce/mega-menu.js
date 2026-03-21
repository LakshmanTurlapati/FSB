/**
 * Site Guide: Mega-Menu Navigation
 * Per-site guide for CSS hover-triggered mega-menu navigation on e-commerce
 * and large content sites.
 *
 * Mega-menus are large dropdown panels that appear when hovering over
 * top-level navigation items. They contain categorized sub-links arranged
 * in multi-column layouts. The challenge is maintaining hover state while
 * navigating from the trigger item to a nested sub-link.
 *
 * Two interaction strategies:
 * A. DOM hover + click (JS-based menus) -- preferred
 * B. CDP coordinate hover path + click_at (CSS :hover menus) -- fallback
 *
 * Created for Phase 63, MICRO-07 edge case validation.
 * Target: hover nav, wait for animation, click nested sub-link.
 */

registerSiteGuide({
  site: 'Mega-Menu Navigation',
  category: 'E-Commerce & Shopping',
  patterns: [
    /bestbuy\.com/i,
    /homedepot\.com/i,
    /lowes\.com/i,
    /macys\.com/i,
    /nordstrom\.com/i,
    /costco\.com/i,
    /wayfair\.com/i,
    /newegg\.com/i,
    /overstock\.com/i
  ],
  guidance: `MEGA-MENU NAVIGATION INTELLIGENCE:

MEGA-MENU ANATOMY:
- A mega-menu is a large dropdown panel that appears when hovering over a
  top-level navigation item (e.g., "Products", "Departments", "Categories").
- The panel typically contains:
  - Category headings (bold text or styled links)
  - Sub-category links arranged in 2-6 columns
  - Sometimes featured images, promotions, or "Shop All" links
- The panel is positioned absolutely or fixed below the nav bar.
- The panel opens via CSS :hover or JavaScript mouseenter event on the trigger.
- The panel closes when the mouse leaves BOTH the trigger and the panel area.

INTERACTION STRATEGY A -- DOM HOVER + CLICK (PREFERRED):
Most modern mega-menus use JavaScript mouseenter/mouseleave events, not pure
CSS :hover. The MCP hover tool dispatches mouseenter + mouseover events, which
triggers the menu opening. Steps:
1. Use get_dom_snapshot to identify the top-level nav items.
   Look for: nav > ul > li > a, [role="menubar"] > [role="menuitem"],
   header a[href], .nav-link, .menu-item, .main-nav a
2. Use hover tool on the top-level nav item that contains the target category.
   Example: hover('[data-lid="hdr_menu_Brands"]') or hover('.nav-link:contains("Products")')
3. WAIT: After hovering, the mega-menu needs time to animate open.
   Most menus have a 200-400ms CSS transition or JS delay.
   Use a brief pause (the MCP tool chain has natural latency that often suffices).
4. Use get_dom_snapshot AGAIN to find the now-visible mega-menu panel and its sub-links.
   The panel was hidden before hover and is now visible in the DOM.
   Look for: [role="menu"], .mega-menu, .dropdown-menu, [class*="flyout"],
   [class*="submenu"], [aria-expanded="true"] ~ div, nav ul ul
5. Use click tool on the specific nested sub-link within the mega-menu.
   Example: click('a[href="/site/computer-accessories"]')
6. Verify navigation occurred: URL changed to the target category page.

INTERACTION STRATEGY B -- CDP COORDINATE PATH (FALLBACK):
If Strategy A fails (hover tool does not open the menu), the menu likely uses
pure CSS :hover which requires the browser's real cursor position. Steps:
1. Use get_dom_snapshot to find the bounding rect of the top-level nav item.
   Record: navX = left + width/2, navY = top + height/2 (center of nav item)
2. Use drag tool to move the CDP cursor to the nav item center:
   drag(navX, navY, navX, navY+1, steps=2, stepDelayMs=50)
   This sends CDP mouseMoved events at the nav item coordinates, triggering
   CSS :hover. The +1 pixel endY makes it a micro-drag, not zero-distance.
3. WAIT 300-500ms for the mega-menu to open and animate.
4. Use get_dom_snapshot to find the mega-menu panel and locate the target sub-link.
   Record: linkX = link left + width/2, linkY = link top + height/2
5. HOVER PATH: Move the cursor from the nav item INTO the mega-menu panel.
   This is critical -- if you jump directly to the sub-link, the cursor may
   pass over other nav items, closing this menu and opening another.
   Strategy: Move vertically down first (into the panel), then horizontally to the link.
   drag(navX, navY, navX, panelTopY+10, steps=5, stepDelayMs=30)
   then: drag(navX, panelTopY+10, linkX, linkY, steps=5, stepDelayMs=30)
   This L-shaped path avoids crossing other nav items.
6. Use click_at(linkX, linkY) to click the sub-link.
7. Verify navigation occurred.

BEST BUY MEGA-MENU PATTERNS:
- Top nav: .hamburger-menu-flyout-list .nav-link (Products, Deals, etc.)
- Menu trigger: elements with data-lid="hdr_menu_*" attribute
- Mega-menu panel: .hamburger-menu-flyout, [class*="flyout"]
- Sub-links: .hamburger-menu-flyout a[href*="/site/"]
- Sub-categories: organized in columns with heading + link lists
- Menu opens on mouseenter, closes on mouseleave with ~200ms delay

HOME DEPOT MEGA-MENU PATTERNS:
- Top nav: .MainNav__item, [class*="MainNav"] a
- Mega-menu panel: .MyDropdown, [class*="dropdown-content"]
- Sub-links: .MyDropdown a[href*="/b/"]
- Categories: organized by department with "Shop All" link

LOWES MEGA-MENU PATTERNS:
- Top nav: .main-navigation a, [role="menubar"] [role="menuitem"]
- Mega-menu panel: [role="menu"], .mega-menu-content
- Sub-links: .mega-menu-content a[href*="/c/"]

TIMING CONSIDERATIONS:
- CSS transitions: 200-400ms is typical for mega-menu open/close animation
- Hover intent delay: Some menus wait 150-300ms before opening to prevent
  accidental triggers. This means the hover must be sustained, not instant.
- Close delay: Most menus have a 200-500ms grace period after mouse leaves
  before closing. This provides time to move from nav item to the panel.
- The MCP tool chain natural latency (tool call -> response -> next tool call)
  is typically 500ms-2s, which usually covers both the open delay and provides
  enough sustained hover time.

IDENTIFYING MEGA-MENU ELEMENTS:
- Nav items: elements inside header/nav with hover-triggered children
- Menu panels: absolutely/fixed positioned elements that appear on hover
- Aria attributes: aria-expanded changes from "false" to "true" on hover,
  aria-haspopup="true" on nav items with dropdowns
- Visibility: display:none -> display:block, visibility:hidden -> visible,
  opacity:0 -> opacity:1, max-height:0 -> max-height:auto

STUCK RECOVERY:
- If hover tool does not open menu: try Strategy B (CDP coordinate hover).
- If menu opens but closes before click: the click tool may be too slow.
  Use get_dom_snapshot immediately after hover to find the sub-link selector,
  then click it in the SAME tool call sequence (minimize latency).
- If menu opens wrong panel: the hover targeted the wrong nav item.
  Re-examine the nav structure and use a more specific selector.
- If sub-link is not found in mega-menu: the panel content may be lazy-loaded.
  Wait and re-snapshot. Or the sub-link text may differ from expectation.
- If CDP drag triggers menu but click_at misses: recalculate coordinates from
  a fresh get_dom_snapshot (panel position may shift during animation).
- If the nav bar is sticky/fixed: coordinates are viewport-relative, which
  is correct for click_at and drag. No scroll adjustment needed.`,
  selectors: {
    // Generic mega-menu selectors
    navBar: 'nav, [role="navigation"], header nav, [class*="main-nav"], [class*="primary-nav"]',
    navItem: 'nav > ul > li > a, [role="menubar"] > [role="menuitem"], [role="menubar"] li > a, .nav-link, [class*="menu-item"] > a, header nav a',
    menuTrigger: '[aria-haspopup="true"], [aria-expanded], [data-toggle="dropdown"], [class*="has-dropdown"], [class*="has-submenu"], [class*="has-megamenu"]',
    megaMenuPanel: '[role="menu"], .mega-menu, [class*="mega-menu"], [class*="flyout"], [class*="dropdown-menu"], [class*="submenu"], [class*="sub-menu"], [aria-expanded="true"] ~ div, [aria-expanded="true"] ~ ul',
    subLink: '[role="menu"] a, .mega-menu a, [class*="mega-menu"] a, [class*="flyout"] a, [class*="submenu"] a, [class*="dropdown-menu"] a',
    categoryHeading: '[role="menu"] h2, [role="menu"] h3, .mega-menu h2, .mega-menu h3, [class*="mega-menu"] strong, [class*="category-heading"]',
    // Best Buy specific
    bestBuyNavLink: '.hamburger-menu-flyout-list .nav-link, [data-lid^="hdr_menu_"]',
    bestBuyFlyout: '.hamburger-menu-flyout, [class*="flyout"]',
    bestBuySubLink: '.hamburger-menu-flyout a[href*="/site/"]',
    // Home Depot specific
    homeDepotNav: '.MainNav__item, [class*="MainNav"] a',
    homeDepotPanel: '.MyDropdown, [class*="dropdown-content"]',
    homeDepotSubLink: '.MyDropdown a[href*="/b/"]',
    // Lowes specific
    lowesNav: '.main-navigation a, [role="menubar"] [role="menuitem"]',
    lowesPanel: '[role="menu"], .mega-menu-content',
    lowesSubLink: '.mega-menu-content a[href*="/c/"]'
  },
  workflows: {
    navigateMegaMenu: [
      'Navigate to a site with a mega-menu (e.g., bestbuy.com, homedepot.com, lowes.com) using navigate tool. Dismiss any cookie/consent popups via click if present.',
      'Use get_dom_snapshot to map the page elements. Identify the top-level navigation bar and its menu items. Look for nav elements, [role="menubar"], header nav, or site-specific nav selectors. Note the text and selector of each top-level nav item. Identify which nav item corresponds to the target category (e.g., "Products", "Departments", "Appliances").',
      'STRATEGY A -- DOM HOVER: Use the hover tool on the top-level nav item CSS selector to trigger the mega-menu. Example: hover("[data-lid=hdr_menu_Products]") or hover(".nav-link") targeting the correct item.',
      'WAIT for mega-menu animation: The menu needs 200-400ms to open. The natural MCP tool chain latency usually covers this. Proceed to the next step.',
      'Use get_dom_snapshot AGAIN to find the now-visible mega-menu panel. The panel was hidden before hover and is now rendered/visible. Look for [role="menu"], .mega-menu, [class*="flyout"], [class*="dropdown-menu"]. Inside the panel, find the specific nested sub-link to click. Record its CSS selector.',
      'Use click on the nested sub-link CSS selector found in step 5. Example: click("a[href=/site/computer-accessories]").',
      'VERIFY navigation: Use read_page to confirm the URL changed to the target category page. The page title should reflect the sub-category navigated to.',
      'If Strategy A FAILED (hover did not open menu): Switch to STRATEGY B. Use get_dom_snapshot to find nav item coordinates, then use drag(navX, navY, navX, navY+1, steps=2, stepDelayMs=50) to CDP-hover over the nav item, triggering CSS :hover. Then use get_dom_snapshot for the mega-menu panel, and click_at at the sub-link coordinates.',
      'REPORT: Document which strategy was used (A or B), whether the mega-menu opened, whether the sub-link was clicked, and whether navigation occurred.'
    ]
  },
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'hover', 'click', 'click_at', 'drag', 'waitForElement']
});
