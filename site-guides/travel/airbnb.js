/**
 * Site Guide: Airbnb
 * Per-site guide for Airbnb vacation rental and accommodation platform.
 */

registerSiteGuide({
  site: 'Airbnb',
  category: 'Travel & Booking',
  patterns: [
    /airbnb\.com/i
  ],
  guidance: `AIRBNB-SPECIFIC INTELLIGENCE:

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
- Check cancellation policy before booking`,
  selectors: {
    destination: '#bigsearch-query-location-input',
    checkIn: '[data-testid="structured-search-input-field-split-dates-0"]',
    checkOut: '[data-testid="structured-search-input-field-split-dates-1"]',
    guests: '[data-testid="structured-search-input-field-guests-button"]',
    searchButton: '[data-testid="structured-search-input-search-button"]',
    listingCard: '[data-testid="card-container"]',
    price: '._1y74zjx'
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
    ]
  },
  warnings: [
    'Airbnb prices shown are nightly -- total price appears in details or on hover',
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airbnb uses hashed CSS class names (like ._1y74zjx) which may change between deployments',
    'Check cancellation policy carefully -- policies vary by host',
    'Service fees and cleaning fees are added to the nightly rate'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
