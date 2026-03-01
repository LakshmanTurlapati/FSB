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
  guidance: `GOOGLE TRAVEL / FLIGHTS-SPECIFIC INTELLIGENCE:

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
- Hotel results aggregate from multiple booking platforms`,
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
    ]
  },
  warnings: [
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion',
    'Google Flights redirects to airline/booking sites for actual booking',
    'Prices shown may differ from final price on the booking site',
    'Google Travel aggregates from multiple sources -- prices vary by provider'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
