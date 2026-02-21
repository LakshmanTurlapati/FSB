/**
 * Shared Category Guidance: Travel & Booking
 * Category-level guidance that applies to all travel and booking sites.
 */

registerCategoryGuidance({
  category: 'Travel & Booking',
  icon: 'fa-plane',
  guidance: `TRAVEL & BOOKING INTELLIGENCE:

FLIGHT SEARCH:
1. FORM FILLING ORDER: Fill fields in this order -- Origin, Destination, Departure Date, Return Date (if round trip), Passengers.
2. DATE PICKERS: These are the trickiest part of travel sites.
   - Click the date input to open the calendar widget
   - Navigate months using arrows (do NOT type dates directly)
   - Click the specific day on the calendar
   - Wait for the calendar to update before selecting return date
3. AIRPORT CODES: Type city name or airport code. Wait for the autocomplete dropdown, then click the correct suggestion. Do NOT just type and press Enter.
4. PASSENGERS: Find the passenger count selector. Usually a dropdown or +/- buttons.

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
- Do NOT auto-fill payment unless explicitly asked`,
  warnings: [
    'Date pickers require clicking on calendar -- do NOT type dates into inputs directly',
    'Airport/city inputs need autocomplete selection -- wait for dropdown and click the suggestion',
    'Prices may change between search and booking -- note "price not guaranteed"',
    'Budget airlines show base price without baggage fees',
    'Multi-city/complex itineraries may need the "Multi-city" tab first'
  ]
});
