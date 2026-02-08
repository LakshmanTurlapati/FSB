/**
 * Site Guide: Travel & Booking
 * Covers airlines, hotels, and booking platforms
 */

const TRAVEL_GUIDE = {
  name: 'Travel & Booking',

  patterns: [
    /booking\.com/i,
    /expedia\.com/i,
    /airbnb\.com/i,
    /hotels\.com/i,
    /kayak\.com/i,
    /skyscanner\.(com|net)/i,
    /tripadvisor\.com/i,
    /priceline\.com/i,
    /southwest\.com/i,
    /united\.com/i,
    /delta\.com/i,
    /aa\.com/i,
    /jetblue\.com/i,
    /spirit\.com/i,
    /frontier\.com/i,
    /alaskaair\.com/i,
    /marriott\.com/i,
    /hilton\.com/i,
    /hyatt\.com/i,
    /vrbo\.com/i,
    /hotwire\.com/i,
    /google\.com\/travel/i,
    /google\.com\/flights/i
  ],

  guidance: `TRAVEL & BOOKING INTELLIGENCE:

FLIGHT SEARCH:
1. FORM FILLING ORDER: Fill fields in this order -- Origin, Destination, Departure Date, Return Date (if round trip), Passengers.
2. DATE PICKERS: These are the trickiest part of travel sites.
   - Click the date input to open the calendar widget
   - Navigate months using arrows (do NOT type dates directly)
   - Click the specific day on the calendar
   - Wait for the calendar to update before selecting return date
3. AIRPORT CODES: Type city name or airport code. Wait for the autocomplete dropdown, then click the correct suggestion. Do NOT just type and press Enter -- the input needs the selected airport object.
4. PASSENGERS: Find the passenger count selector. Usually a dropdown or +/- buttons. Adjust as needed.

HOTEL SEARCH:
1. Enter destination city/area
2. Select check-in and check-out dates using the date picker
3. Set number of guests/rooms
4. Click Search
5. Results may take several seconds to load

RESULTS NAVIGATION:
- Results load dynamically -- wait for them with waitForDOMStable
- Sorting options (price, rating, duration) are usually at the top
- Filters (stops, airlines, price range) are usually on the left sidebar
- Click a result to see full details
- Watch for "Sponsored" or "Ad" results at the top

PRICE AWARENESS:
- Displayed prices may not include taxes/fees
- "From $X" means starting price, actual price may be higher
- Compare multiple options before recommending
- Note if price is per person or total
- Check baggage fees for budget airlines

MULTI-STEP FORMS:
- Travel booking often has 3-5 steps (search, select, passenger info, payment, confirm)
- Report progress at each step
- Do NOT auto-fill payment unless explicitly asked

EXPEDIA-SPECIFIC INTELLIGENCE:

SEARCH FORM:
- Search button: #search_button
- Destination (Going to): [aria-label="Going to"] -- this is a BUTTON trigger, not a direct text input. Click it first, then type in the revealed input field.
- Origin (Leaving from): [aria-label="Leaving from"] -- also a button trigger. Click first, then type.
- Date selector: [data-testid="uitk-date-selector-input1-default"] -- opens a calendar picker. Click dates on the calendar, do NOT type dates directly.
- Travelers/cabin: [data-testid="travelers-field"]
- Cabin class: #preferred-class-input-trigger or [data-testid="preferred-class-input-trigger"]
- Swap origin/destination: [aria-label="Swap origin and destination values"]

HEADER/NAVIGATION:
- Sign in menu: [data-testid="header-menu-button"]
- Logo/home: [data-testid="header-brand-logo-anchor"]
- Toolbar button: [data-testid="egds-toolbar-button"]

PACKAGE TYPE SELECTION:
- Stay tab: #package-type-selector-stay
- Flight tab: #package-type-selector-flight
- Car tab: #package-type-selector-car
- These tabs switch between booking types (hotel, flight, car rental)

CAR RENTAL FIELDS:
- Pick-up time: #pick_up_time
- Drop-off time: #drop_off_time

DEALS & EXTRAS:
- AARP rates checkbox: #aarp_rates
- Discount codes: #discount_codes
- Save to trip: [aria-label="Save <property name> to a trip"] (dynamic aria-label with property name)
- Gallery trigger: [data-testid="uitk-gallery-item-current-trigger"]

LOGIN:
- Email input: #loginFormEmailInput
- Submit login: #loginFormSubmitButton

UTILITY:
- Scroll to top: [aria-label="Scroll to top"]
- Feedback: [aria-label="Feedback"]
- Help: [aria-label="How can we help?"]`,

  selectors: {
    'booking': {
      destination: '#ss, input[name="ss"]',
      checkIn: '[data-testid="date-display-field-start"]',
      checkOut: '[data-testid="date-display-field-end"]',
      guests: '#xp__guests__toggle',
      searchButton: 'button[type="submit"]',
      hotelCard: '[data-testid="property-card"]',
      price: '[data-testid="price-and-discounted-price"]'
    },
    'expedia': {
      searchButton: '#search_button',
      destination: '[aria-label="Going to"]',
      origin: '[aria-label="Leaving from"]',
      dateSelector: '[data-testid="uitk-date-selector-input1-default"]',
      travelers: '[data-testid="travelers-field"]',
      cabinClass: '#preferred-class-input-trigger, [data-testid="preferred-class-input-trigger"]',
      swapOriginDest: '[aria-label="Swap origin and destination values"]',
      signIn: '[data-testid="header-menu-button"]',
      logo: '[data-testid="header-brand-logo-anchor"]',
      submitButton: '[data-testid="submit-button"]',
      pickUpTime: '#pick_up_time',
      dropOffTime: '#drop_off_time',
      packageStay: '#package-type-selector-stay',
      packageFlight: '#package-type-selector-flight',
      packageCar: '#package-type-selector-car',
      aarpRates: '#aarp_rates',
      discountCodes: '#discount_codes',
      galleryTrigger: '[data-testid="uitk-gallery-item-current-trigger"]',
      loginEmail: '#loginFormEmailInput',
      loginSubmit: '#loginFormSubmitButton',
      resultCard: '.uitk-card',
      price: '.uitk-type-600'
    },
    'airbnb': {
      destination: '#bigsearch-query-location-input',
      checkIn: '[data-testid="structured-search-input-field-split-dates-0"]',
      checkOut: '[data-testid="structured-search-input-field-split-dates-1"]',
      guests: '[data-testid="structured-search-input-field-guests-button"]',
      searchButton: '[data-testid="structured-search-input-search-button"]',
      listingCard: '[data-testid="card-container"]',
      price: '._1y74zjx'
    },
    'kayak': {
      origin: '.zEiP-origin input',
      destination: '.zEiP-destination input',
      departDate: '.zEiP-formField:nth-child(3)',
      searchButton: '.zEiP-submit button',
      resultCard: '.nrc6-inner',
      price: '.f8F1-price-text'
    },
    'southwest': {
      origin: '#originationAirportCode',
      destination: '#destinationAirportCode',
      departDate: '#departureDate',
      returnDate: '#returnDate',
      searchButton: '#form-mixin--submit-button',
      fareCard: '.fare-button'
    },
    'united': {
      origin: '#bookFlightOriginInput',
      destination: '#bookFlightDestinationInput',
      departDate: '#DepartDate',
      returnDate: '#ReturnDate',
      searchButton: '#bookFlightForm button[type="submit"]'
    },
    'google': {
      origin: '[aria-label="Where from?"] input',
      destination: '[aria-label="Where to?"] input',
      departDate: '[aria-label="Departure"] input',
      returnDate: '[aria-label="Return"] input',
      searchButton: '[aria-label="Search"]',
      resultCard: '.pIav2d',
      price: '.YMlIz'
    }
  },

  workflows: {
    searchFlights: [
      'Enter origin airport (type and select from dropdown)',
      'Enter destination airport (type and select from dropdown)',
      'Click departure date field to open calendar',
      'Navigate to correct month and click the day',
      'Click return date and select from calendar',
      'Set passenger count if not default',
      'Click Search button',
      'Wait for results to load',
      'Report top results with prices and details'
    ],
    bookHotel: [
      'Enter destination city',
      'Select check-in date from calendar',
      'Select check-out date from calendar',
      'Set number of guests',
      'Click Search',
      'Wait for results to load',
      'Compare top options by price and rating',
      'Report findings'
    ]
  },

  warnings: [
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion',
    'Prices may change between search and booking -- note "price not guaranteed"',
    'Budget airlines (Spirit, Frontier) show base price without baggage fees',
    'Multi-city/complex itineraries may need the "Multi-city" tab first',
    'Booking.com and Expedia show "Genius" or "Member" prices requiring login',
    'Southwest does not appear on aggregator sites -- search southwest.com directly',
    'Expedia destination/origin inputs are button triggers, not direct text inputs -- click first, then type in the revealed input',
    'Expedia date selector opens a calendar picker -- click dates on the calendar, do not type dates directly',
    'Expedia uses uitk-* (UI Toolkit) component classes which are semi-stable but prefer data-testid selectors',
    'Package selector tabs (#package-type-selector-stay/flight/car) switch between booking types on Expedia',
    'Car rental on Expedia has separate pick-up/drop-off time fields (#pick_up_time, #drop_off_time)',
    'Save-to-trip buttons on Expedia have dynamic aria-labels containing the hotel/property name'
  ],

  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
};

registerSiteGuide(TRAVEL_GUIDE);
