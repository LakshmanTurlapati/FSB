/**
 * Site Guide: Expedia
 * Per-site guide for Expedia travel booking platform.
 */

registerSiteGuide({
  site: 'Expedia',
  category: 'Travel & Booking',
  patterns: [
    /expedia\.com/i
  ],
  guidance: `EXPEDIA-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for flights
  click e5    # Flight tab
  click e8    # origin field (button trigger)
  type e10 "LAX"
  click e12   # destination field (button trigger)
  type e14 "JFK"
  click e18   # date selector
  click e22   # calendar day
  click e25   # search button

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
  workflows: {
    searchFlights: [
      'Click the Flight tab (#package-type-selector-flight)',
      'Click origin field [aria-label="Leaving from"] then type airport',
      'Click destination field [aria-label="Going to"] then type destination',
      'Click date selector to open calendar and select dates',
      'Set passenger count via travelers field',
      'Click Search button (#search_button)',
      'Wait for results to load',
      'Report top results with prices and details'
    ],
    bookHotel: [
      'Click the Stay tab (#package-type-selector-stay)',
      'Click destination field [aria-label="Going to"] then type city',
      'Select check-in and check-out dates from calendar',
      'Set number of guests',
      'Click Search',
      'Wait for results to load',
      'Compare top options by price and rating',
      'Report findings'
    ]
  },
  warnings: [
    'Expedia destination/origin inputs are button triggers, not direct text inputs -- click first, then type in the revealed input',
    'Expedia date selector opens a calendar picker -- click dates on the calendar, do not type dates directly',
    'Expedia uses uitk-* (UI Toolkit) component classes which are semi-stable but prefer data-testid selectors',
    'Package selector tabs (#package-type-selector-stay/flight/car) switch between booking types',
    'Car rental has separate pick-up/drop-off time fields (#pick_up_time, #drop_off_time)',
    'Save-to-trip buttons have dynamic aria-labels containing the hotel/property name',
    'Expedia shows member prices that require login'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
