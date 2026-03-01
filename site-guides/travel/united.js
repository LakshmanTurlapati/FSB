/**
 * Site Guide: United Airlines
 * Per-site guide for United Airlines flight search and booking.
 */

registerSiteGuide({
  site: 'United Airlines',
  category: 'Travel & Booking',
  patterns: [
    /united\.com/i
  ],
  guidance: `UNITED AIRLINES-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for flights
  click e5    # origin input
  type e5 "EWR"
  click e8    # destination input
  type e8 "LAX"
  click e12   # departure date
  click e15   # calendar day
  click e20   # search button

FLIGHT SEARCH:
1. Origin: #bookFlightOriginInput -- type airport code or city name
2. Destination: #bookFlightDestinationInput -- type airport code or city name
3. Departure date: #DepartDate
4. Return date: #ReturnDate (for round trip)
5. Search button: #bookFlightForm button[type="submit"]

DATE PICKER:
- Click the date input to open the calendar
- Navigate months and click specific days
- Do NOT type dates directly

RESULTS:
- United shows multiple fare classes (Basic Economy, Economy, Business, etc.)
- Results include flight duration, stops, and departure/arrival times
- Baggage fees vary by fare class

BOOKING FLOW:
- Select a flight and fare class
- Proceed through passenger information
- Select seats (available for most fares except Basic Economy)
- Review and confirm booking`,
  selectors: {
    origin: '#bookFlightOriginInput',
    destination: '#bookFlightDestinationInput',
    departDate: '#DepartDate',
    returnDate: '#ReturnDate',
    searchButton: '#bookFlightForm button[type="submit"]'
  },
  workflows: {
    searchFlights: [
      'Enter origin airport in #bookFlightOriginInput',
      'Enter destination airport in #bookFlightDestinationInput',
      'Click departure date (#DepartDate) to open calendar and select date',
      'Click return date (#ReturnDate) to open calendar and select date (if round trip)',
      'Click Search button',
      'Wait for results to load',
      'Compare fare options and flight times',
      'Report findings with fare details'
    ]
  },
  warnings: [
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion',
    'Basic Economy fares have significant restrictions (no seat selection, last to board, etc.)',
    'Baggage fees vary by fare class -- check before booking',
    'United may require authentication for MileagePlus features'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
