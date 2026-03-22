/**
 * Site Guide: Google Travel / Google Flights
 * Per-site guide for Google Travel and Google Flights search.
 */

registerSiteGuide({
  site: 'Google Travel',
  category: 'Travel & Booking',
  patterns: [
    /google\.com\/travel/i,
    /google\.com\/flights/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CONTEXT-04):
- [context] Open tabs sequentially: open_tab + read price + store record, then next
- [context] Extract ONLY price text per tab (~50 chars), not full DOM (50-200KB each)
- [context] Store compact {tabId, price, airline, url} records -- under 200 chars each
- [context] Parse prices aggressively: strip $, commas, convert to integer cents
- [context] switch_tab to cheapest ONCE after comparison, not during extraction

GOOGLE TRAVEL / FLIGHTS-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for flights
  click e5    # origin input
  type e5 "Boston"
  click e8    # destination input
  type e8 "Miami"
  click e12   # departure date
  click e15   # calendar day
  click e20   # search button

FLIGHT SEARCH:
1. Origin: [aria-label="Where from?"] input
2. Destination: [aria-label="Where to?"] input
3. Departure date: [aria-label="Departure"] input
4. Return date: [aria-label="Return"] input
5. Search button: [aria-label="Search"]

DATE PICKER:
- Click the date input to open the calendar
- Navigate months and click specific days
- Do NOT type dates directly

RESULTS:
- Result cards: .pIav2d
- Price display: .YMlIz
- Google Flights aggregates results from multiple airlines and booking sites
- Results show direct links to airline websites for booking

FEATURES:
- Google Flights shows price trends and graphs
- "Track prices" option to get alerts on price changes
- Explore feature shows cheapest destinations on a map
- Filters for stops, airlines, times, and duration

HOTEL SEARCH (Google Travel):
- Google Travel also covers hotels with similar search patterns
- Hotel results aggregate from multiple booking platforms

MULTI-TAB FLIGHT PRICE COMPARISON (CONTEXT-04):
- This workflow opens flight search results in 5 separate tabs, extracts price from each, compares, and returns to the cheapest tab
- The challenge is MULTI-TAB CONTEXT RETENTION: as you switch between 5 tabs, you must remember which tabId has which price
- Strategy: maintain a compact tabId-to-price mapping array as you visit each tab, never re-read a tab you have already priced

TAB LIFECYCLE:
- open_tab({url}): Opens a new tab and returns the tabId (numeric). The new tab becomes active.
- list_tabs(): Returns array of all open tabs with {id, title, url, active} for each. Use to enumerate available tabs.
- switch_tab({tabId}): Activates an existing tab by its numeric ID. read_page reads from the ACTIVE tab only.
- After open_tab: the new tab is active, so you can immediately read_page on it before opening the next tab.

WORKFLOW APPROACH (SEQUENTIAL OPEN-AND-READ):
1. Start on Google Flights results page (after searchFlights workflow)
2. For each of 5 result links: open_tab with the booking/airline URL, wait for page load, extract price with read_page, store {tabId, price, airline, route} in memory, then continue to next result
3. After all 5 tabs are opened and priced: compare stored prices numerically, identify the minimum
4. switch_tab to the tabId with the lowest price
5. Verify: read_page on the cheapest tab to confirm the price matches stored value

ALTERNATIVE APPROACH (GOOGLE FLIGHTS RESULTS PAGE):
- Google Flights shows multiple results with prices on a SINGLE page (no need to open separate airline tabs)
- If the goal is comparing prices shown on the Google Flights results page itself: extract all 5 prices from result cards (.pIav2d) with price elements (.YMlIz) on the same page
- For the CONTEXT-04 edge case: the requirement specifically asks for 5 SEPARATE TABS, so use open_tab to open each result in its own tab even though Google Flights shows prices inline
- Open each result by clicking the result card or "View Deal" link, which opens the airline/booking site in a new tab

PRICE EXTRACTION PER TAB:
- On Google Flights: price in .YMlIz elements within result cards .pIav2d
- On airline sites (opened tabs): price format varies by site, look for:
  (a) Elements with "$" or currency symbol followed by digits
  (b) [class*="price"], [class*="fare"], [class*="cost"] selectors
  (c) aria-label containing "price" or "total"
  (d) Largest prominent number on the booking summary
- Parse price: strip "$", commas, and non-numeric characters, convert to number for comparison
- Store as integer cents if precision matters (e.g., "$342.50" -> 34250)

CONTEXT BLOAT MITIGATION FOR 5-TAB WORKFLOWS:
- Do NOT get_dom_snapshot on each tab -- use targeted read_page with price-specific selectors only
- Each tab DOM can be 50-200KB -- reading all 5 fully would consume 250KB-1MB of context
- Instead: on each tab, read ONLY the price element text (a few bytes), store compactly
- Target context per tab: under 500 characters (tabId + price + airline name + route)
- Total context for 5 tabs: under 2500 characters vs 250KB+ for full DOM reads
- After comparison: no need to re-read any tab, just switch_tab to the winner

TARGET SELECTION (CLAUDE'S DISCRETION):
- Primary target: Google Flights (google.com/flights) -- shows multiple flight options with inline prices
- Search route: any common domestic route (e.g., SFO to JFK, LAX to ORD, BOS to MIA)
- Dates: any future weekday pair (round trip or one-way)
- For 5 separate tabs: click 5 different result cards that link to airline/booking sites, each opens in a new tab
- Alternative: if Google Flights does not open separate tabs for results, use Kayak (kayak.com) which redirects to provider sites, or manually open 5 airline URLs (united.com, delta.com, southwest.com, etc.) with the same route search
- Simplest approach for testing: open 5 tabs directly to different flight search URLs with the same route query, then compare the results page prices`,
  selectors: {
    origin: '[aria-label="Where from?"] input',
    destination: '[aria-label="Where to?"] input',
    departDate: '[aria-label="Departure"] input',
    returnDate: '[aria-label="Return"] input',
    searchButton: '[aria-label="Search"]',
    resultCard: '.pIav2d',
    price: '.YMlIz'
  },
  workflows: {
    searchFlights: [
      'Enter origin airport in [aria-label="Where from?"] input',
      'Enter destination in [aria-label="Where to?"] input',
      'Click departure date to open calendar and select date',
      'Click return date to open calendar and select date (if round trip)',
      'Click Search button [aria-label="Search"]',
      'Wait for results to load',
      'Report top results with prices, airlines, and duration'
    ],
    bookHotel: [
      'Navigate to Google Travel hotels section',
      'Enter destination city',
      'Select check-in and check-out dates',
      'Set number of guests',
      'Click Search',
      'Wait for results to load',
      'Compare options from multiple providers',
      'Report findings'
    ],
    compareFlightsMultiTab: [
      'Start on Google Flights results page (run searchFlights workflow first, or navigate directly to a results URL)',
      'Use read_page to identify 5 flight result cards with prices -- record the price text and booking link for each result',
      'Initialize empty price tracking array: prices = []',
      'TAB 1: Use open_tab with the first result booking URL. Wait for page load via wait_for_stable.',
      'On Tab 1: Use read_page with price-specific selectors ([class*="price"], [class*="fare"], or "$" text) to extract the displayed price. Store {tabId: <returned-id>, price: <number>, airline: <name>, source: <url>} in prices array.',
      'TAB 2: Use open_tab with the second result booking URL. Wait for page load.',
      'On Tab 2: Extract price via read_page. Store {tabId, price, airline, source} in prices array.',
      'TAB 3: Use open_tab with the third result booking URL. Wait for page load.',
      'On Tab 3: Extract price via read_page. Store {tabId, price, airline, source} in prices array.',
      'TAB 4: Use open_tab with the fourth result booking URL. Wait for page load.',
      'On Tab 4: Extract price via read_page. Store {tabId, price, airline, source} in prices array.',
      'TAB 5: Use open_tab with the fifth result booking URL. Wait for page load.',
      'On Tab 5: Extract price via read_page. Store {tabId, price, airline, source} in prices array.',
      'COMPARE: Sort prices array by price (numeric). Identify the entry with the lowest price.',
      'Use list_tabs to verify all 5 tabs are still open and confirm tabIds match stored values.',
      'RETURN TO CHEAPEST: Use switch_tab with the tabId of the lowest-price entry.',
      'VERIFY: Use read_page on the now-active cheapest tab to confirm the price matches the stored value.',
      'Report: "Cheapest flight: $X on [airline] (tab [tabId]). Compared 5 options: [list all 5 with prices]."'
    ]
  },
  warnings: [
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion',
    'Google Flights redirects to airline/booking sites for actual booking',
    'Prices shown may differ from final price on the booking site',
    'Google Travel aggregates from multiple sources -- prices vary by provider',
    'For CONTEXT-04 (5-tab flight compare): do NOT read full DOM on each tab. Extract ONLY the price element text. Store compact {tabId, price, airline} records. Total stored context for 5 tabs should be under 2500 characters.',
    'Multi-tab workflow: open_tab returns tabId immediately. Always store the tabId before opening the next tab. switch_tab requires the exact numeric tabId from open_tab or list_tabs.'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus', 'open_tab', 'switch_tab', 'list_tabs']
});
