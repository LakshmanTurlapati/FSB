/**
 * Site Guide: Booking.com
 * Per-site guide for Booking.com hotel and accommodation search.
 */

registerSiteGuide({
  site: 'Booking.com',
  category: 'Travel & Booking',
  patterns: [
    /booking\.com/i
  ],
  guidance: `BOOKING.COM-SPECIFIC INTELLIGENCE:

HOTEL SEARCH:
1. Enter destination in the search input (#ss or input[name="ss"])
2. Select check-in date: [data-testid="date-display-field-start"]
3. Select check-out date: [data-testid="date-display-field-end"]
4. Set guests/rooms: #xp__guests__toggle
5. Click the search button (button[type="submit"])
6. Wait for results to load

DATE PICKER:
- Click the date display fields to open the calendar
- Navigate months using arrows
- Click the specific day on the calendar
- Do NOT type dates directly

RESULTS:
- Hotel cards: [data-testid="property-card"]
- Price display: [data-testid="price-and-discounted-price"]
- Results load dynamically -- wait with waitForDOMStable
- Sorting and filter options are at the top/sidebar

BOOKING FLOW:
- Click a property card to see full details
- "See availability" or "Reserve" buttons proceed to booking
- Multiple room types may be available for each property`,
  selectors: {
    destination: '#ss, input[name="ss"]',
    checkIn: '[data-testid="date-display-field-start"]',
    checkOut: '[data-testid="date-display-field-end"]',
    guests: '#xp__guests__toggle',
    searchButton: 'button[type="submit"]',
    hotelCard: '[data-testid="property-card"]',
    price: '[data-testid="price-and-discounted-price"]'
  },
  workflows: {
    bookHotel: [
      'Enter destination city in search input (#ss)',
      'Select check-in date from calendar',
      'Select check-out date from calendar',
      'Set number of guests/rooms',
      'Click Search button',
      'Wait for results to load',
      'Compare top options by price and rating',
      'Report findings'
    ]
  },
  warnings: [
    'Booking.com shows "Genius" member prices that require login',
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Prices shown may not include taxes/fees until the final booking step',
    'Cookie/location popups may appear on first visit and need dismissing'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
