/**
 * Site Guide: Horizontal Carousel
 * Per-site guide for horizontal carousels and sliders found on e-commerce,
 * news, and media sites.
 *
 * Carousels present items in a horizontal row with overflow, requiring
 * horizontal-only scrolling or arrow button clicks to reveal more items.
 * The key challenge is scrolling horizontally WITHOUT triggering vertical
 * page scroll.
 *
 * Three interaction approaches in priority order:
 * 1. Arrow buttons (click) -- safest, no vertical scroll risk
 * 2. scroll_at with deltaX (horizontal wheel event) -- for overflow-x containers
 * 3. drag (horizontal swipe) -- for touch-style carousels
 *
 * Created for Phase 62, MICRO-06 edge case validation.
 * Target: scroll horizontally through carousel without vertical scroll.
 */

registerSiteGuide({
  site: 'Horizontal Carousel',
  category: 'Utilities',
  patterns: [
    /amazon\.(com|co\.\w+|in|de|fr|jp|ca)/i,
    /netflix\.com/i,
    /bestbuy\.com/i,
    /target\.com/i,
    /walmart\.com/i,
    /ebay\.(com|co\.\w+)/i,
    /cnn\.com/i,
    /bbc\.com/i,
    /nytimes\.com/i
  ],
  guidance: `HORIZONTAL CAROUSEL SCROLL INTELLIGENCE:

CAROUSEL ANATOMY:
- A horizontal carousel is a row of items (cards, images, products) inside a
  scrollable container. Only a subset of items is visible at once.
- Common implementations:
  1. overflow-x: scroll/auto container with items in a flex row
  2. CSS transform: translateX() shifts a track element left/right
  3. JS-managed: framework controls visibility (React, Slick, Swiper, Flickity)
- Most carousels have ARROW BUTTONS (next/prev) to advance one page of items.
- Some carousels have DOT INDICATORS showing the current page/position.

INTERACTION PRIORITY ORDER:
1. ARROW BUTTONS (PREFERRED -- safest, zero vertical scroll risk):
   - Look for next/prev buttons near the carousel edges
   - Common selectors: [aria-label*="Next"], [aria-label*="Previous"],
     [aria-label*="next"], [aria-label*="prev"], button.slick-next,
     button.slick-prev, .carousel-control-next, .carousel-control-prev,
     .swiper-button-next, .swiper-button-prev
   - Amazon: .a-carousel-goto-nextpage, .a-carousel-goto-prevpage
   - Click the next arrow button to advance the carousel one page right
   - After clicking, verify new items appeared (different text/images)

2. SCROLL_AT WITH DELTAX (for overflow-x containers):
   - CRITICAL: Use deltaY=0 and deltaX > 0 (positive = scroll right)
   - scroll_at(x, y, deltaY=0, deltaX=300) sends a horizontal-only wheel event
   - The x,y coordinates MUST be inside the carousel container element
   - If coordinates are outside the carousel, the wheel event goes to the page
     and may trigger vertical scroll
   - Typical deltaX values: 200-400 per scroll (one card width)
   - VERIFY after each scroll: check that vertical scroll position did NOT change
   - The CDP mouseWheel event with deltaX dispatches a WheelEvent with deltaX
     property, which overflow-x containers respond to

3. DRAG / HORIZONTAL SWIPE (fallback for touch-style carousels):
   - drag(startX, startY, endX, endY) where startY == endY (horizontal only)
   - Swipe LEFT to reveal items to the right: startX > endX (drag left)
   - startX = carousel center + 100, endX = carousel center - 100
   - Use steps=15, stepDelayMs=20 for smooth swipe
   - Keep Y coordinates identical to prevent vertical movement

IDENTIFYING THE CAROUSEL CONTAINER:
- Use get_dom_snapshot to find the carousel wrapper element
- Look for: overflow-x: scroll/auto in CSS, role="region" or role="list",
  [class*="carousel"], [class*="slider"], [class*="swiper"],
  [data-testid*="carousel"], ul/div with horizontal flex layout
- The container is the element whose children overflow horizontally
- Get the container's bounding rect to calculate scroll_at coordinates
- Target the CENTER of the container for scroll_at (x = left + width/2, y = top + height/2)

VERIFYING HORIZONTAL-ONLY SCROLL:
- BEFORE scrolling: record the current vertical scroll position
  - Use JavaScript: window.scrollY or document.documentElement.scrollTop
  - Can check via read_page or get_dom_snapshot which may report scroll position
- AFTER scrolling: verify vertical position has NOT changed
  - If vertical scroll changed, the scroll_at went to the page instead of carousel
  - Fix: re-target scroll_at coordinates to be inside the carousel element bounds
- Verify NEW items appeared: check that the carousel content changed
  - Compare item text/count before and after scroll
  - Arrow buttons may become disabled at the end of the carousel

AMAZON-SPECIFIC CAROUSEL PATTERNS:
- Homepage "Deal of the Day", "Customers also bought", "Inspired by..." rows
- Product page "Customers who bought this also bought" row
- Next arrow: .a-carousel-goto-nextpage (visible on hover or always visible)
- Previous arrow: .a-carousel-goto-prevpage
- Carousel container: .a-carousel-viewport, [class*="a-carousel"]
- Items inside: .a-carousel-card, li inside .a-carousel
- Amazon carousels use CSS transform (not overflow-x) -- arrow buttons are the
  reliable interaction method

STUCK RECOVERY:
- If arrow buttons are not visible: they may appear on hover. Use hover tool
  on the carousel container first, then look for arrow buttons.
- If scroll_at triggers vertical scroll: coordinates are outside the carousel.
  Use get_dom_snapshot to find the exact carousel element bounds and re-target.
- If drag does not move the carousel: the carousel may use CSS transform instead
  of scroll position. Only arrow buttons work for transform-based carousels.
- If no items change after scroll/click: the carousel may be at the end.
  Try scrolling/clicking in the opposite direction to verify it works.
- If carousel items are lazy-loaded: wait 500-1000ms after scrolling for new
  items to render before checking content.`,
  selectors: {
    // Generic carousel selectors
    carouselContainer: '[class*="carousel"], [class*="slider"], [class*="swiper"], [role="region"][aria-label*="carousel" i], [data-testid*="carousel"]',
    nextButton: '[aria-label*="Next" i], [aria-label*="next" i], button.slick-next, .carousel-control-next, .swiper-button-next, [class*="carousel-next"], [class*="arrow-right"], [class*="nav-next"]',
    prevButton: '[aria-label*="Previous" i], [aria-label*="prev" i], button.slick-prev, .carousel-control-prev, .swiper-button-prev, [class*="carousel-prev"], [class*="arrow-left"], [class*="nav-prev"]',
    carouselItem: '[class*="carousel-item"], [class*="slide"], .slick-slide, .swiper-slide, [class*="card"]',
    dotIndicator: '[class*="dot"], [class*="indicator"], .slick-dots, .swiper-pagination',
    // Amazon-specific
    amazonNext: '.a-carousel-goto-nextpage',
    amazonPrev: '.a-carousel-goto-prevpage',
    amazonContainer: '.a-carousel-viewport, [class*="a-carousel"]',
    amazonItem: '.a-carousel-card'
  },
  workflows: {
    scrollCarouselHorizontally: [
      'Navigate to a page with a horizontal carousel (e.g., amazon.com homepage) using navigate tool',
      'Use read_page to verify the page loaded. Dismiss any cookie/consent popups via click if present.',
      'Use get_dom_snapshot to map the page elements. Identify the carousel container and its child items. Look for elements matching carousel/slider/swiper class patterns, or Amazon-specific .a-carousel classes. Record the carousel container element reference and note at least 2-3 visible item texts for before/after comparison.',
      'RECORD VERTICAL SCROLL POSITION: Note the current vertical scroll position from the page state (window.scrollY or scrollPosition in DOM snapshot). This is the baseline to verify no vertical scroll occurs.',
      'CHOOSE INTERACTION METHOD: (a) If arrow buttons (next/prev) are visible in the DOM snapshot, use click on the next arrow button -- this is the safest method. (b) If the carousel has overflow-x scroll and no arrow buttons, use scroll_at with coordinates inside the carousel container, deltaY=0, deltaX=300. (c) As fallback, use drag for a horizontal swipe (keep startY == endY).',
      'EXECUTE SCROLL: Perform the chosen interaction. For arrow buttons: click the next button. For scroll_at: use scroll_at(carouselCenterX, carouselCenterY, deltaY=0, deltaX=300). For drag: drag from (centerX+150, centerY) to (centerX-150, centerY) with steps=15.',
      'VERIFY HORIZONTAL SCROLL SUCCEEDED: Use get_dom_snapshot or read_page to check: (a) New items are now visible in the carousel (different text/images from step 3). (b) The vertical scroll position has NOT changed from the baseline recorded in step 4. Both conditions must be true for PASS.',
      'If vertical scroll changed: the scroll went to the page, not the carousel. Try a different method (arrow buttons preferred). If no items changed: carousel may be at the end, or the interaction did not reach the carousel element. Re-examine element bounds and retry.',
      'REPORT: Document which interaction method was used, whether new items appeared, and whether vertical scroll position was preserved.'
    ]
  },
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'click', 'scroll_at', 'drag', 'scroll', 'hover', 'waitForElement']
});
