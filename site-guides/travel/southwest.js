/**
 * Site Guide: Southwest Airlines
 * Per-site guide for Southwest Airlines flight search and booking.
 */

registerSiteGuide({
  site: 'Southwest Airlines',
  category: 'Travel & Booking',
  patterns: [
    /southwest\.com/i
  ],
  guidance: `SOUTHWEST AIRLINES-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for flights
  click e5    # origin input
  type e5 "DAL"
  click e8    # destination input
  type e8 "HOU"
  click e12   # departure date
  click e15   # calendar day
  click e20   # search button

FLIGHT SEARCH:
1. Origin: #originationAirportCode -- type airport code or city name
2. Destination: #destinationAirportCode -- type airport code or city name
3. Departure date: #departureDate
4. Return date: #returnDate (for round trip)
5. Search button: #form-mixin--submit-button

DATE PICKER:
- Click the date input to open the calendar
- Navigate months and click specific days
- Do NOT type dates directly

RESULTS:
- Fare cards: .fare-button
- Southwest shows Wanna Get Away, Anytime, and Business Select fare classes
- All fares include free checked bags (2 bags) and no change fees

UNIQUE SOUTHWEST FEATURES:
- Southwest does NOT appear on aggregator sites (Kayak, Google Flights, etc.)
- Must search southwest.com directly
- Open seating -- no assigned seats
- Rapid Rewards points can be used for booking`,
  selectors: {
    origin: '#originationAirportCode',
    destination: '#destinationAirportCode',
    departDate: '#departureDate',
    returnDate: '#returnDate',
    searchButton: '#form-mixin--submit-button',
    fareCard: '.fare-button'
  },
  workflows: {
    searchFlights: [
      'Enter origin airport code in #originationAirportCode',
      'Enter destination airport code in #destinationAirportCode',
      'Click departure date to open calendar and select date',
      'Click return date to open calendar and select date (if round trip)',
      'Click Search button (#form-mixin--submit-button)',
      'Wait for results to load',
      'Compare fare options (Wanna Get Away, Anytime, Business Select)',
      'Report findings with fare details'
    ]
  },
  warnings: [
    'Southwest does not appear on aggregator sites -- must search southwest.com directly',
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'All Southwest fares include 2 free checked bags and no change fees',
    'Southwest uses open seating -- no seat assignments',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
