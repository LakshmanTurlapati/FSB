/**
 * Site Guide: Airbnb
 * Per-site guide for Airbnb vacation rental and accommodation platform.
 *
 * Map interaction additions (Phase 73, SCROLL-07 edge case validation):
 * - panMapForListings workflow for panning the Airbnb map to discover new listing pins
 * - Map DOM structure documentation (Google Maps / Mapbox canvas + DOM pin overlays)
 * - CDP drag panning strategy adapted from Google Maps site guide
 * - Listing pin detection and verification (count comparison before/after pan)
 * - Cookie/consent popup dismissal guidance
 * - Search-as-you-move-map toggle documentation
 */

registerSiteGuide({
  site: 'Airbnb',
  category: 'Travel & Booking',
  patterns: [
    /airbnb\.com/i
  ],
  guidance: `AIRBNB-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a rental
  click e5    # destination input
  type e5 "Tokyo"
  click e8    # check-in date field
  click e12   # calendar day
  click e15   # check-out date field
  click e18   # calendar day
  click e22   # search button

SEARCH FORM:
1. Destination input: #bigsearch-query-location-input
2. Check-in date: [data-testid="structured-search-input-field-split-dates-0"]
3. Check-out date: [data-testid="structured-search-input-field-split-dates-1"]
4. Guests: [data-testid="structured-search-input-field-guests-button"]
5. Search button: [data-testid="structured-search-input-search-button"]

DATE PICKER:
- Click the date fields to open the calendar
- Navigate months and click specific days
- Do NOT type dates directly

RESULTS:
- Listing cards: [data-testid="card-container"]
- Price display: ._1y74zjx
- Results show nightly price -- total price appears on hover or in details
- Map and list views available

LISTING DETAILS:
- Click a listing card to see full details
- Photos, description, amenities, reviews, and location are on the detail page
- "Reserve" button proceeds to booking
- Check cancellation policy before booking

MAP VIEW (SCROLL-07 -- PAN FOR NEW LISTINGS):
- Airbnb search results show a split view: listing cards on the left, map on the right
- The map is rendered using Google Maps or Mapbox -- uses a <canvas> element for the map tiles
- Map container: div[data-testid="map/GoogleMap"], div[aria-label*="Map"], or the largest canvas-containing div in the right half of the viewport
- Listing pins are DOM elements OVERLAID on the map canvas -- they appear as small price badges (e.g., "$150") positioned absolutely over the map
- Pin selectors: button[data-testid="map/markers/BasePillMarker"], div[data-testid^="map/markers"], or buttons containing price text within the map container
- Each pin corresponds to a listing card in the left panel

MAP PAN INTERACTION:
- Use CDP drag tool to pan the map: drag(startX, startY, endX, endY, steps=20, stepDelayMs=25)
- Target the map canvas center (typically right half of viewport: approximately viewport.width * 0.75, viewport.height * 0.5)
- Drag direction: drag right-to-left to reveal eastern area, drag down-to-up to reveal northern area (same as Google Maps convention)
- After each pan, Airbnb makes an API call to fetch listings for the new viewport area
- Wait 2000-3000ms after panning for new listing pins to load (Airbnb API response + pin rendering is slower than Google Maps tile loading)
- Use wait_for_stable after panning to detect when new pins have finished rendering

SEARCH-AS-YOU-MOVE-MAP:
- Airbnb has a "Search as I move the map" toggle at the top of the map
- When enabled (default), panning the map automatically triggers a new search for the visible area
- When disabled, panning does NOT load new listings -- user must click "Search this area" button
- Ensure this toggle is ON before panning, or click "Search this area" after panning
- Toggle selector: button containing "Search as I move the map" text, or input[type="checkbox"] near the map top
- "Search this area" button: button[data-testid="map/searchThisArea"], or button containing "Search this area" text

COOKIE / CONSENT POPUP:
- Airbnb may show a cookie consent banner on first visit
- Dismiss it before interacting with the map -- the banner can block map interactions
- Cookie banner selector: div[data-testid="main-cookies-banner"], section[aria-label*="cookie"], div[role="dialog"] containing "cookie" or "privacy"
- Accept button: button containing "OK" or "Accept" or "Got it" text within the cookie banner

VERIFYING NEW LISTINGS AFTER PAN:
- Count listing pins on the map BEFORE panning: document.querySelectorAll('button[data-testid="map/markers/BasePillMarker"]').length
- Count listing pins AFTER panning and waiting for stable
- If pin count changed OR pin positions changed, new listings have loaded
- Alternative: count listing cards in the left panel before and after: [data-testid="card-container"] count
- Compare listing prices or titles before/after -- different values = new listings
- The URL may update with new map bounds after panning (check for ne_lat, ne_lng, sw_lat, sw_lng parameters)
- Best verification: read a pin price text before pan, pan significantly, read pin prices after -- different prices confirm new listings

PAN DISTANCE AND DIRECTION:
- Pan at least 300-500px to move the viewport enough for Airbnb to load new area listings
- Small pans (under 100px) may not trigger a new listing search
- For reliable testing: pan the map to the east or south by dragging from center-right to center-left (or center-bottom to center-top)
- Multiple smaller pans (200px each) are more reliable than one large pan`,
  selectors: {
    destination: '#bigsearch-query-location-input',
    checkIn: '[data-testid="structured-search-input-field-split-dates-0"]',
    checkOut: '[data-testid="structured-search-input-field-split-dates-1"]',
    guests: '[data-testid="structured-search-input-field-guests-button"]',
    searchButton: '[data-testid="structured-search-input-search-button"]',
    listingCard: '[data-testid="card-container"]',
    price: '._1y74zjx',
    mapContainer: 'div[data-testid="map/GoogleMap"], div[aria-label*="Map"], div[data-testid="map"]',
    mapCanvas: 'div[data-testid="map/GoogleMap"] canvas, div[aria-label*="Map"] canvas',
    listingPin: 'button[data-testid="map/markers/BasePillMarker"], div[data-testid^="map/markers"] button',
    pinPriceLabel: 'button[data-testid="map/markers/BasePillMarker"] span, div[data-testid^="map/markers"] span',
    searchAsMapMoves: 'button:has(> span:contains("Search as I move"))',
    searchThisArea: 'button[data-testid="map/searchThisArea"]',
    cookieBanner: 'div[data-testid="main-cookies-banner"], section[aria-label*="cookie"]',
    cookieAccept: 'div[data-testid="main-cookies-banner"] button, section[aria-label*="cookie"] button',
    resultsCount: 'div[data-testid="stays-page-heading"], span:contains("places")'
  },
  workflows: {
    bookHotel: [
      'Enter destination in search input (#bigsearch-query-location-input)',
      'Select check-in date from calendar',
      'Select check-out date from calendar',
      'Set number of guests',
      'Click Search button',
      'Wait for results to load',
      'Compare top listings by price and rating',
      'Report findings'
    ],
    panMapForListings: [
      'Navigate to Airbnb search results with map visible: airbnb.com/s/[location]/homes (e.g., airbnb.com/s/San-Francisco/homes)',
      'Wait for page to load via wait_for_stable -- verify both listing cards and map are visible',
      'Dismiss cookie/consent popup if present (click OK/Accept button in cookie banner)',
      'Use read_page or get_dom_snapshot to count current listing pins on the map and listing cards in the left panel -- record as baseline',
      'Identify map canvas center coordinates: approximately (viewport.width * 0.75, viewport.height * 0.5) for the right-side map panel',
      'Use CDP drag to pan the map: drag(centerX + 200, centerY, centerX - 200, centerY, steps=20, stepDelayMs=25) to pan eastward',
      'Wait 2000-3000ms for Airbnb API to fetch and render new listing pins (use wait_for_stable)',
      'Use read_page to count listing pins and cards again -- compare against baseline',
      'If pin count or prices changed: new listings loaded successfully -- record the new listing details',
      'If no change detected: try a larger pan (400px) or verify "Search as I move the map" is enabled',
      'Report: baseline pin/card count, post-pan pin/card count, sample listing prices before and after, verification that new area listings appeared'
    ]
  },
  warnings: [
    'Airbnb prices shown are nightly -- total price appears in details or on hover',
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airbnb uses hashed CSS class names (like ._1y74zjx) which may change between deployments',
    'Check cancellation policy carefully -- policies vary by host',
    'Service fees and cleaning fees are added to the nightly rate',
    'Airbnb map requires CDP trusted events (drag, click_at) for panning -- same as Google Maps canvas interaction',
    'After panning, wait 2000-3000ms for Airbnb API response and pin rendering -- faster panning may show stale pins',
    'Listing pins are DOM elements overlaid on the map canvas, NOT part of the canvas pixels -- they are queryable via data-testid selectors',
    'The "Search as I move the map" toggle must be ON for panning to automatically load new listings',
    'Airbnb uses hashed/dynamic CSS classes that may change between deployments -- prefer data-testid selectors over class selectors',
    'Map canvas center is offset to the right since listing cards occupy the left portion of the viewport'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus', 'drag', 'click_at', 'wait_for_stable', 'read_page', 'get_dom_snapshot']
});
