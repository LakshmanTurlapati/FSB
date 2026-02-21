/**
 * Site Guide: Kayak
 * Per-site guide for Kayak travel search and comparison platform.
 */

registerSiteGuide({
  site: 'Kayak',
  category: 'Travel & Booking',
  patterns: [
    /kayak\.com/i
  ],
  guidance: `KAYAK-SPECIFIC INTELLIGENCE:

FLIGHT SEARCH:
1. Origin input: .zEiP-origin input
2. Destination input: .zEiP-destination input
3. Departure date: .zEiP-formField:nth-child(3)
4. Search button: .zEiP-submit button
5. Type city name or airport code and select from autocomplete

DATE PICKER:
- Click the date field to open the calendar
- Navigate months and click specific days
- Do NOT type dates directly

RESULTS:
- Result cards: .nrc6-inner
- Price display: .f8F1-price-text
- Kayak aggregates results from multiple providers
- "View Deal" buttons redirect to the provider's site
- Sort and filter options at the top

COMPARISON:
- Kayak shows results from multiple booking sites
- Price may vary by provider for the same flight/hotel
- Check which provider offers the best price`,
  selectors: {
    origin: '.zEiP-origin input',
    destination: '.zEiP-destination input',
    departDate: '.zEiP-formField:nth-child(3)',
    searchButton: '.zEiP-submit button',
    resultCard: '.nrc6-inner',
    price: '.f8F1-price-text'
  },
  workflows: {
    searchFlights: [
      'Enter origin airport in origin input',
      'Enter destination airport in destination input',
      'Click departure date field to open calendar',
      'Navigate to correct month and click the day',
      'Click Search button',
      'Wait for results to load',
      'Report top results with prices from different providers'
    ]
  },
  warnings: [
    'Kayak aggregates results from multiple providers -- prices vary by source',
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion',
    '"View Deal" buttons redirect to external booking sites',
    'Prices may change between search and booking -- note "price not guaranteed"'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'selectOption', 'navigate', 'hover', 'focus']
});
