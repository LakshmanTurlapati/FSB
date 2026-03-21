# Autopilot Diagnostic Report: Phase 62 - Horizontal Carousel Scroll

## Metadata
- Phase: 62
- Requirement: MICRO-06
- Date: 2026-03-21
- Outcome: PARTIAL (carousel site guide validated against live Target.com DOM, two carousels with arrow buttons confirmed, Amazon blocked by WAF CAPTCHA, live MCP execution blocked by WebSocket bridge disconnect)
- Live MCP Testing: NO (WebSocket bridge disconnected -- ports 3711/3712 not listening, MCP server process running PID 80445)

## Prompt Executed
"Navigate to amazon.com, find a horizontal product carousel, scroll it to the right to reveal more items, and verify that the page did not scroll vertically."

## Result Summary
Live MCP test was attempted but could not execute through the full MCP tool chain. Amazon.com returned a WAF CAPTCHA challenge page (2,007 bytes, AWS WAF JavaScript challenge) blocking HTTP-based access entirely. Target.com was used as the alternative site and returned a full 394,929-byte homepage with two horizontal carousels confirmed: `filmstrip-deals-carousel` and `filmstrip-products-carousel`. Both carousels use Target's NDS (Nucleus Design System) carousel component with `aria-label="Next Page"` arrow buttons, `ul`-based item lists with 10 items each (indexed 0-9, 185px wide, 16px gap), and CSS module hashed class names. The carousel arrow button click (METHOD A -- preferred) was identified as the viable interaction method. Classification: PARTIAL -- carousel structure fully validated against live DOM, arrow buttons and item containers confirmed, but no physical browser interaction executed due to WebSocket bridge disconnect.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | https://www.amazon.com/ | NOT EXECUTED (MCP) / FAILED (HTTP) | WebSocket bridge disconnected (ports 3711/3712 not listening). HTTP fetch returned 2,007-byte AWS WAF CAPTCHA challenge page. Amazon blocks non-browser requests with JavaScript challenge (awsWafCookieDomainList, gokuProps encrypted token). Site is unreachable without a real browser session. |
| 2 | navigate | https://www.target.com/ (alternative) | NOT EXECUTED (MCP) / SIMULATED (HTTP) | Target.com successfully fetched via HTTP: 394,929 bytes. Full homepage HTML received with product content. Target does not block HTTP requests with CAPTCHA, making it a reliable carousel test target. |
| 3 | read_page | Target.com homepage content | NOT EXECUTED (MCP) / SIMULATED (HTML parsing) | Page content confirmed. No title tag rendered (React SSR hydration). Two heading elements with empty spans precede the carousel sections (content populated client-side). Four `role="region"` sections identified in the page structure. |
| 4 | get_dom_snapshot | Carousel containers and items | NOT EXECUTED (MCP) / SIMULATED (HTML parsing) | Identified two carousels: (1) `data-test="filmstrip-deals-carousel"` (deals section) and (2) `data-test="filmstrip-products-carousel"` (products section). Both wrapped in `styles_ndsCarousel__yMTV9` container div. Each carousel contains a `ul.styles_unorderedList__Q95jr` with `li.styles_ndsCarouselItem__dnUkr` items indexed via `data-io-i="0"` through `data-io-i="9"` (10 items per carousel). Item width: 185px CSS variable (`--nds-placeholder-width:185px`), item gap: 16px (`--item-gap:16px`). |
| 5 | (identification) | Arrow buttons | SIMULATED -- IDENTIFIED | Each carousel has a "Next Page" button: `button[aria-label="Next Page"]` with classes `styles_paginationButton__vMqww styles_next__rUa5_`. Button contains an SVG chevron-right icon (`chevron-right.svg`). Two "Next Page" buttons found (one per carousel). The `aria-label="Next Page"` selector from the site guide matches. Generic `[aria-label*="Next" i]` selector from site guide also matches. |
| 6 | (baseline) | Vertical scroll position | NOT EXECUTED (MCP) | Would record `window.scrollY` from get_dom_snapshot scroll position data. Expected baseline: scrollY = 0 (top of page). In a live MCP session, this value would come from the DOM snapshot's scrollPosition field or a JavaScript evaluation via read_page. |
| 7 | click | button[aria-label="Next Page"] (METHOD A -- preferred) | NOT EXECUTED (MCP) | Would click the first "Next Page" button to advance the deals carousel. METHOD A (arrow buttons) is the preferred interaction method per the site guide priority order. The button is a standard HTML button element, not a canvas or custom widget, so the MCP click tool should work via CSS selector targeting. No coordinate calculation needed. |
| 8 | scroll_at | Carousel center coordinates (METHOD B -- secondary) | NOT EXECUTED (MCP) | Would use `scroll_at(x, y, deltaY=0, deltaX=300)` targeting the center of the carousel container. The deltaX=300 value aligns with approximately 1.5 item widths (185px + 16px gap = 201px per item). Method B is secondary because Target carousels may use CSS transform-based sliding (like Amazon) rather than overflow-x scroll, which would not respond to horizontal wheel events. |
| 9 | drag | Horizontal swipe across carousel (METHOD C -- fallback) | NOT EXECUTED (MCP) | Would use `drag(startX, startY, endX, endY)` with `startY == endY` for horizontal-only swipe. Start from carousel center + 150px, end at carousel center - 150px. Steps=15, stepDelayMs=20 for smooth swipe. Method C is the fallback for touch-style carousels. |
| 10 | get_dom_snapshot | Verify new carousel items visible | NOT EXECUTED (MCP) | Would check if carousel items have changed after interaction. Look for different `data-io-i` indexes visible, or different product card content. Since items are lazy-loaded via React hydration, may need to wait 500ms after scroll for new items to render. |
| 11 | (verification) | Check vertical scroll position unchanged | NOT EXECUTED (MCP) | Would verify `window.scrollY` is still at the baseline value from Step 6. If vertical scroll changed, the interaction leaked to the page level. For METHOD A (arrow button click), vertical scroll should not change because clicking a button does not generate wheel/scroll events. For METHOD B (scroll_at), vertical scroll could change if coordinates miss the carousel container bounds. |

## What Worked
- MCP server process confirmed running (node mcp-server/build/index.js, PID 80445) -- server is operational
- scroll_at MCP tool confirmed in manual.ts with deltaX parameter (optional, default 0) for horizontal scrolling
- click, drag, and scroll_at tools all registered and available for carousel interaction
- Target.com homepage fetched successfully (394,929 bytes) as alternative when Amazon was blocked
- Two horizontal carousels identified in live Target.com HTML: filmstrip-deals-carousel and filmstrip-products-carousel
- Arrow button selector validated: `aria-label="Next Page"` matches the site guide's `[aria-label*="Next" i]` generic selector
- Carousel container selector validated: `styles_ndsCarousel__yMTV9` matches site guide's `[class*="carousel"]` pattern
- Carousel items confirmed as `li` elements inside `ul` with indexed `data-io-i` attributes (10 items per carousel)
- Item dimensions confirmed: 185px wide with 16px gap (CSS custom properties)
- Target uses NDS (Nucleus Design System) carousel component with standard HTML button navigation
- `data-test` attributes present for test automation (`data-test="filmstrip-deals-carousel"`, `data-test="filmstrip-products-carousel"`)

## What Failed
- Live MCP execution not performed: WebSocket bridge between MCP server and Chrome extension was disconnected (ports 3711/3712 not listening)
- Amazon.com unreachable via HTTP: AWS WAF CAPTCHA challenge returned (2,007-byte JavaScript challenge page). Amazon requires a real browser session with JavaScript execution to pass the WAF challenge. This means MCP automation on Amazon requires the browser to already be on the Amazon page, or the navigate tool must handle WAF challenges transparently.
- Best Buy unreachable: Connection failed (curl exit code 92) -- site may have IP-based blocking or was temporarily down
- No physical click on arrow buttons: Cannot confirm that MCP click tool targets the button[aria-label="Next Page"] element and advances the carousel
- No physical scroll_at execution: Cannot confirm that scroll_at with deltaX=300, deltaY=0 produces horizontal-only scrolling in the Target carousel
- Vertical scroll verification not performed: Cannot confirm that arrow button click or scroll_at leaves window.scrollY unchanged
- Target carousel content is client-side rendered: The HTML returned via HTTP contains placeholder divs (`--nds-placeholder-width:185px`, `--nds-placeholder-height:100%`) without actual product data. Product names, images, and prices are populated by React hydration. This means the before/after comparison of carousel items (Step 10) requires a real browser with JavaScript execution.
- Cannot confirm carousel scrolling mechanism: Whether Target uses overflow-x scroll or CSS transform for carousel sliding is not determinable from server-side HTML alone -- this requires computed styles from a live browser

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-62):** The MCP server runs in stdio mode and requires the WebSocket bridge process on ports 3711/3712 to reach Chrome. This bridge has been disconnected in Phases 55, 56, 57, 58, 59, 60, 61, and now 62. Without it, no tool (DOM or CDP based) can execute. This is the primary blocker for all live MCP testing in this milestone.
- **No get_bounding_rect tool (carried from Phase 57):** Carousel scroll_at (METHOD B) requires knowing the exact viewport coordinates of the carousel container to position the mouse wheel event inside it. Currently, the AI must estimate from DOM snapshot element data or CSS dimensions. A dedicated `get_bounding_rect(selector)` returning `{top, left, width, height}` from `getBoundingClientRect()` would make scroll_at coordinate targeting reliable. For carousels specifically, the container bounds define the safe zone where horizontal wheel events are captured instead of leaking to the page.
- **scroll_at horizontal scroll behavior unverified:** The CDP `Input.dispatchMouseEvent` for mouseWheel with deltaX dispatches a WheelEvent with deltaX property. It is unverified whether overflow-x containers on Target or Amazon respond to this deltaX value and scroll horizontally. Some carousel frameworks intercept wheel events and only respond to deltaY (vertical), translating it to horizontal movement internally. Others use CSS scroll-snap with overflow-x which should respond to deltaX natively.
- **No CSS computed style inspection tool:** To determine whether a carousel uses overflow-x scroll (responds to scroll_at deltaX) vs CSS transform (only responds to button clicks or JS API), the AI would need to inspect the computed CSS of the carousel container. A `get_computed_style(selector, property)` tool would help distinguish carousel implementation types.
- **Amazon WAF CAPTCHA handling:** Amazon's AWS WAF challenge requires JavaScript execution to generate a token. The MCP navigate tool sends Chrome to the URL, but the CAPTCHA challenge may block page load. The AI needs a way to detect and wait for WAF challenges to resolve, or a fallback to retry after the browser completes the challenge. This is a site-specific blocker for Amazon carousel testing.
- **React SSR hydration delay:** Target.com serves placeholder HTML that React hydrates client-side. Carousel item content (product names, images, prices) is not present in the initial HTML. After navigate, the AI must wait for React hydration to complete before reading carousel items. The existing `waitForElement` tool could help, but the AI needs to know which selector to wait for (e.g., wait for img tags inside carousel items to have src attributes).

## Bugs Fixed In-Phase
- **Plan 01 -- Carousel site guide created (89983f0):** Created site-guides/utilities/carousel.js with scrollCarouselHorizontally workflow, three-method interaction priority, and selectors for Amazon and generic carousel patterns. Wired into background.js imports.
- **No bugs found in Plan 02:** No code was executed that could reveal runtime bugs. The diagnostic is limited to DOM structure validation.

## Autopilot Recommendations

1. **Arrow buttons are the preferred interaction method for carousels:** Always check for next/prev arrow buttons first. They work on all carousel types (overflow-x, CSS transform, JS-managed) because they trigger the carousel's own navigation logic. Click the button with `click('[aria-label="Next Page"]')` or site-specific selectors like `.a-carousel-goto-nextpage` for Amazon. Arrow buttons produce zero vertical scroll risk because clicking a button does not generate scroll/wheel events.

2. **Carousel container identification using DOM class patterns and data attributes:** Look for these patterns in get_dom_snapshot output: `[class*="carousel"]`, `[class*="slider"]`, `[class*="swiper"]`, `[data-test*="carousel"]`, `[data-testid*="carousel"]`, `role="region"` with adjacent navigation buttons. Target uses `data-test="filmstrip-*-carousel"` and `styles_ndsCarousel__*` CSS module classes. Amazon uses `.a-carousel-viewport` and `.a-carousel`. Generic frameworks: Slick uses `.slick-slider`, Swiper uses `.swiper-container` or `.swiper`, Bootstrap uses `.carousel`, Flickity uses `.flickity-slider`.

3. **scroll_at with deltaX requires precise coordinate targeting:** When using `scroll_at(x, y, deltaY=0, deltaX=300)`, the (x, y) coordinates MUST be inside the carousel container's bounding rectangle. If coordinates fall outside the container, the wheel event goes to the page body and triggers vertical scroll instead. Use get_dom_snapshot element position data to calculate carousel center: `x = element.left + element.width/2`, `y = element.top + element.height/2`. Recommended deltaX range: 200-400 per tick (roughly one card width for most carousels). Always set deltaY=0 to prevent any vertical scroll component.

4. **Vertical scroll position verification is mandatory before and after interaction:** Before any carousel interaction, record `window.scrollY` as the baseline (from DOM snapshot scrollPosition field or JavaScript evaluation). After interaction, check scrollY again. PASS = scrollY unchanged AND new items visible. If scrollY changed, the interaction leaked to the page level -- switch to METHOD A (arrow buttons) which has zero vertical scroll risk. For autopilot, implement as a two-snapshot pattern: snapshot_before -> interact -> snapshot_after -> compare scrollY values.

5. **Handle lazy-loaded carousel items with post-interaction wait:** Many carousels lazy-load items as they scroll into view. After arrow button click or scroll_at, wait 500-1000ms before checking for new items. Use `waitForElement` targeting a new carousel item selector (e.g., `li[data-io-i="10"]` for the 11th item, or `img[src]` inside a carousel item that previously had no src). Target.com uses React hydration which populates placeholders client-side, so the initial DOM snapshot may show placeholder containers without product content.

6. **Amazon-specific carousel patterns require browser-level WAF bypass:** Amazon homepages use `.a-carousel` classes with CSS transform-based sliding. The `.a-carousel-goto-nextpage` arrow button is the only reliable interaction method (scroll_at does not work on transform-based carousels). However, Amazon's AWS WAF CAPTCHA blocks non-browser HTTP requests. Autopilot must: (a) navigate in a real Chrome tab where WAF challenge resolves automatically, (b) wait for the page to fully load past the WAF challenge, (c) then interact with carousels. For HTTP-simulated testing, use Target.com or Best Buy instead.

7. **Carousel end detection to avoid infinite scroll attempts:** Check for these signals that the carousel has reached its end: (a) next arrow button becomes disabled (`disabled` attribute or `aria-disabled="true"`), (b) next arrow button disappears from DOM, (c) carousel items do not change after interaction (same content as before), (d) dot indicators show last position active. Autopilot should try at most 3 scroll/click attempts -- if no new items appear after 3 attempts, declare the carousel fully scrolled.

8. **Generic carousel framework detection from DOM class patterns:** Identify the carousel framework to select the best interaction method: Slick (`.slick-slider`, `.slick-track`, `.slick-next`) -- use arrow buttons; Swiper (`.swiper`, `.swiper-wrapper`, `.swiper-button-next`) -- use arrow buttons or swipe gesture; Bootstrap (`.carousel`, `.carousel-inner`, `.carousel-control-next`) -- use arrow buttons; Flickity (`.flickity-slider`, `.flickity-prev-next-button`) -- use arrow buttons; NDS/Target (`styles_ndsCarousel__*`, `aria-label="Next Page"`) -- use arrow buttons; Amazon (`.a-carousel`, `.a-carousel-goto-nextpage`) -- use arrow buttons only.

9. **Handling carousels that require hover to show arrow buttons:** Some carousels (including Amazon) only display arrow buttons when the mouse hovers over the carousel container. If get_dom_snapshot does not show arrow buttons but class patterns indicate a carousel exists, use the `hover` tool on the carousel container first, then re-check for arrow buttons. Target's NDS carousel buttons appear to be always visible (present in initial HTML), but Amazon's `.a-carousel-goto-nextpage` may be hidden until hover.

10. **Multiple carousels on one page -- targeting strategy:** Pages like Target.com and Amazon have multiple horizontal carousels (deals, products, recommendations). Autopilot should: (a) identify all carousels on the page, (b) describe them by section heading or data-test attribute to disambiguate, (c) scroll to the target carousel viewport position before interacting (if it is below the fold), (d) interact with the specific carousel's arrow button (not a generic next button selector that might match the wrong carousel). Use `data-test` attributes (Target) or section heading text (Amazon) to target the correct carousel.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| `[class*="carousel"]` (site guide generic) | Carousel container element | FOUND: `styles_ndsCarousel__yMTV9` matches on Target.com (2 instances) | YES |
| `[aria-label*="Next" i]` (site guide generic nextButton) | Next/forward arrow button | FOUND: `aria-label="Next Page"` on Target.com (2 instances, one per carousel) | YES |
| `[class*="carousel-next"]` (site guide generic) | Next arrow button by class | NOT FOUND on Target.com -- Target uses `styles_next__rUa5_` (CSS module hash, no "carousel-next" substring) | NO MATCH |
| `[class*="carousel-item"]` (site guide generic carouselItem) | Carousel item element | NOT FOUND on Target.com -- Target uses `styles_ndsCarouselItem__dnUkr` (contains "CarouselItem" but CSS module hash breaks wildcard match due to case sensitivity) | PARTIAL (case-sensitive miss) |
| `[class*="card"]` (site guide generic carouselItem fallback) | Product card element | NOT TESTED -- Target items use NDS component classes, not "card" class | UNTESTED |
| `[role="region"]` (site guide container identification) | Carousel region wrapper | FOUND: 4 `role="region"` elements on Target.com (not all are carousels -- some are non-carousel sections) | PARTIAL (over-matches) |
| `.a-carousel-goto-nextpage` (site guide Amazon-specific) | Amazon next arrow button | NOT TESTABLE -- Amazon returns WAF CAPTCHA, cannot inspect live DOM | UNTESTABLE |
| `.a-carousel-viewport` (site guide Amazon-specific) | Amazon carousel container | NOT TESTABLE -- Amazon returns WAF CAPTCHA | UNTESTABLE |
| `.a-carousel-card` (site guide Amazon-specific) | Amazon carousel item | NOT TESTABLE -- Amazon returns WAF CAPTCHA | UNTESTABLE |
| `[data-testid*="carousel"]` (site guide generic) | Carousel by test ID | NOT FOUND (Target uses `data-test`, not `data-testid`) | NO MATCH (attribute name differs) |
| `[data-test*="carousel"]` (not in site guide) | Target carousel by data-test | FOUND: `data-test="filmstrip-deals-carousel"` and `data-test="filmstrip-products-carousel"` | YES (but not in site guide) |
| `button.slick-next` (site guide Slick framework) | Slick carousel next button | NOT FOUND on Target.com -- Target does not use Slick | N/A (different framework) |
| `.swiper-button-next` (site guide Swiper framework) | Swiper carousel next button | NOT FOUND on Target.com -- Target does not use Swiper | N/A (different framework) |
| `.carousel-control-next` (site guide Bootstrap) | Bootstrap carousel next | NOT FOUND on Target.com -- Target uses NDS, not Bootstrap | N/A (different framework) |

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| (none) | -- | No new MCP tools added for this phase. Existing scroll_at (with deltaX param), click, and drag tools are sufficient for carousel horizontal scrolling. | -- |
| carousel.js (site guide) | site-guides/utilities/carousel.js | Site guide artifact providing carousel interaction intelligence, scrollCarouselHorizontally workflow, three-method priority (arrow > scroll_at > drag), selectors for Amazon and generic carousel patterns. Created in Plan 01. | (site guide, not a tool) |

---
*Phase: 62-horizontal-carousel-scroll*
*Diagnostic generated: 2026-03-21*
