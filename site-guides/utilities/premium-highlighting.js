/**
 * Site Guide: Premium Highlighting Avoidance
 * Per-site guide for selecting the cheapest flight on airline and travel booking
 * sites that use misleading visual highlighting to steer users toward premium
 * fare options using DOM-based numeric price comparison.
 *
 * Key challenge: Airline and travel booking sites visually emphasize expensive
 * premium/business/recommended fare options using larger fonts, brighter colors,
 * border highlighting, top positioning, and "Best Value"/"Recommended" badges
 * while making economy/basic fares visually subdued (smaller text, gray color,
 * no border, bottom position, no badge). The AI must IGNORE all visual styling
 * and select PURELY by numeric price comparison from DOM-extracted text.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-06) -- the
 * cheapest option IS visible and clickable, but the site UI design makes
 * expensive options visually dominant while the cheapest option is visually
 * subdued. DOM text analysis and numeric price comparison is the only reliable
 * selection method.
 *
 * Distinction from other DARK patterns:
 * - DARK-01 (Fake Download): Deceptive buttons linking to ads -- DOM href analysis
 * - DARK-02 (Cookie Opt-Out): Hidden reject path -- multi-layer DOM navigation
 * - DARK-03 (Shuffled Cancel): Randomized button positions -- text-based classification
 * - DARK-04 (Camouflaged Close): Hidden close buttons -- DOM attribute detection
 * - DARK-05 (Adblocker Bypass): Modal blocking -- DOM removal / CSS override
 * - DARK-06 (Premium Highlighting): Visual misdirection -- numeric price comparison
 *
 * Created for Phase 92, DARK-06 edge case validation.
 * Target: select the cheapest flight on a site with misleading premium highlighting.
 */

registerSiteGuide({
  site: 'Premium Highlighting Avoidance',
  category: 'Utilities',
  patterns: [
    /cheapest.*flight/i,
    /lowest.*fare/i,
    /best.*price/i,
    /select.*cheap/i,
    /misleading.*highlight/i,
    /premium.*highlight/i,
    /fare.*class/i,
    /economy.*basic/i,
    /flight.*result/i,
    /booking.*flight/i,
    /airline.*price/i,
    /google\.com\/flights/i,
    /kayak\.com/i,
    /southwest\.com/i,
    /expedia\.com/i,
    /united\.com/i,
    /delta\.com/i,
    /aa\.com/i,
    /jetblue\.com/i,
    /spirit\.com/i,
    /frontier\.com/i
  ],

  guidance: `PREMIUM HIGHLIGHTING AVOIDANCE INTELLIGENCE (DARK-06):

DARK PATTERN CONTEXT:
Airline and travel booking sites use misleading visual design to steer users toward
higher-priced premium fare options. The cheapest flight IS available and clickable
but the UI makes it visually undesirable compared to premium options. The AI must
IGNORE all visual styling (colors, sizes, badges, positions, borders, highlights)
and select PURELY by numeric price comparison from DOM text.

Seven common misleading premium highlighting techniques:

(1) COLOR AND CONTRAST EMPHASIS: Premium/business fares are shown in bold colors
    (blue, green, gold) with high contrast backgrounds and vivid borders. Basic/economy
    fares are shown in muted gray or low-contrast colors with no background fill.
    Counter: DOM text contains the same price regardless of how the element is styled.
    Ignore all CSS color, background-color, border-color properties.

(2) SIZE SCALING: Premium fare cards are physically larger (wider, taller) with larger
    font sizes for the price and detail text. Economy cards are compact with smaller
    text, sometimes 50-70% the font size of premium cards.
    Counter: get_text extracts the raw text content regardless of font size or element
    dimensions. A "$199" in 12px text is the same price as "$499" in 24px text.

(3) BADGE AND LABEL MANIPULATION: Premium options are marked with eye-catching badges:
    "Recommended", "Best Value", "Most Popular", "Best Deal", "Editor's Choice",
    "Top Pick". Economy options have no badge, or are labeled with clinical/unappealing
    terms: "Basic", "Light", "Saver", "No Frills".
    Counter: NEVER trust badge text. Badges are marketing labels, not price indicators.
    "Best Value" is placed on mid-tier fares that maximize airline revenue, NOT on the
    cheapest fare. Extract the actual price number and compare numerically.

(4) POSITION MANIPULATION: Premium options are placed at the top of the results list
    or in the center column (eye-tracking sweet spot). The cheapest option is pushed
    to the bottom of the list, the far left column, or below the fold requiring scroll.
    Counter: Extract prices from EVERY result on the page, not just the first visible
    ones. Scroll down to find additional results. The minimum numeric price wins
    regardless of where it appears on the page.

(5) DEFAULT PRE-SELECTION: Some airline sites pre-select the premium fare tier with
    a checked radio button, highlighted border, or active CSS class. The user must
    actively deselect the premium option and click the cheaper one to override.
    Counter: Detect pre-selected elements via input[type="radio"]:checked,
    [aria-checked="true"], or [class*="selected"]. If the pre-selected option is NOT
    the cheapest, explicitly click the cheapest option to override the default.

(6) HIDDEN TOTAL PRICING: Displayed "from" prices may exclude taxes, baggage fees,
    or seat selection fees. A fare showing "$99" may cost "$199" after mandatory fees.
    The DOM text usually contains the actual total somewhere (often in smaller text
    below the headline price, or revealed on hover/click).
    Counter: Look for total price elements, not just headline prices. Check for text
    like "total", "incl. taxes", "all-in price" near the fare card. If multiple
    prices appear for one fare, prefer the higher/total value for accurate comparison.

(7) FARE CLASS OBFUSCATION: Cheapest fares are labeled with unappealing names to
    discourage selection: "Basic Economy" (no overhead bin), "Light" (no luggage),
    "Saver" (no changes). Premium fares have aspirational names: "Comfort+",
    "Main Cabin Extra", "Premium Economy", "Business Saver". The naming is designed
    to make the cheapest fare feel inferior.
    Counter: Ignore fare class names entirely. The fare name does not affect the
    numeric price. Extract the price from each fare tier and pick the minimum.

PRICE-BASED SELECTION STRATEGY:
The core selection approach is numeric price comparison from DOM text. This strategy
is immune to ALL visual styling because it operates on raw text content only.

Step A: EXTRACT ALL PRICES
  Use get_dom_snapshot to find all flight result elements on the page. For each
  result element, extract the price text using get_text. Prices appear in many
  formats across airline sites:
  - "$199", "$199.00" (US dollar)
  - "199 USD", "USD 199" (currency code)
  - "From $199" (prefix text)
  - "EUR 199", "199 EUR" (Euro)
  - "GBP 199" (British pound)
  - "1,234" (thousands separator)
  - "$1,234.56" (full format)
  Collect the price text from EVERY flight option on the page. Do NOT stop at the
  first result. Do NOT skip results that appear small, gray, or at the bottom.

Step B: PARSE TO NUMERIC VALUES
  Strip currency symbols ($, EUR, GBP, CAD, AUD, etc.), commas, spaces, and prefix
  text ("From", "from", "Starting at"). Convert to float for numeric comparison.
  Handle edge cases:
  - "1,234" -> 1234.0
  - "$1,234.56" -> 1234.56
  - "From $199" -> 199.0
  - "199 USD" -> 199.0
  - "EUR 199.99" -> 199.99

Step C: COMPARE AND IDENTIFY MINIMUM
  Sort all parsed numeric prices ascending. The minimum value is the cheapest
  flight. Record which DOM element (result card or fare tier cell) contains this
  minimum price. If two results have the same minimum price, prefer the first one
  found (arbitrary tiebreaker).

Step D: CLICK THE CHEAPEST
  Click the result card, "Select" button, or fare tier cell that contains the
  minimum price. Selection criteria:
  - Do NOT click based on position (first result is NOT always cheapest)
  - Do NOT click based on visual prominence (largest card is NOT cheapest)
  - Do NOT click based on badges ("Best Value" is NOT cheapest)
  - Do NOT click the pre-selected option (default is NOT cheapest)
  - ONLY click based on which element contains the lowest numeric price

Step E: VERIFY SELECTION
  After clicking, verify the selected fare price matches the cheapest price found.
  Use get_dom_snapshot or get_text on the booking summary, confirmation area, or
  price breakdown panel to confirm the expected price appears. If a different
  (higher) price appears in the summary, the selection may have failed -- retry
  clicking the cheapest option.

AIRLINE SITE RESULT DOM PATTERNS:
Flight results are structured differently across airline and aggregator sites.
Understanding the DOM patterns helps locate price elements reliably.

Google Flights:
  - Result cards: .pIav2d or [data-resultid] containers
  - Price display: .YMlIz or [aria-label*="price"] or [aria-label*="dollar"]
  - Multiple result rows per search, one price per row
  - Prices in aria-label attributes provide clean numeric text
  - Aggregator: one best-price per flight, compare across rows

Kayak:
  - Result cards: .nrc6-inner or [id^="resultInner"]
  - Price display: .f8F1-price-text or [class*="price"]
  - "View Deal" button per result row
  - Aggregator: one price per row from cheapest provider, compare across rows

Southwest:
  - Fare cards: .fare-button with 3 fare class columns per flight row
  - Fare tiers: Wanna Get Away (cheapest), Anytime (mid), Business Select (most expensive)
  - Price in .fare-button--value or .fare-button .swa-g-font-size-heading-2
  - Airline direct: MULTIPLE fare tiers per row, compare across BOTH rows AND columns
  - The leftmost column (Wanna Get Away) is usually cheapest for any given flight

United:
  - Result container: .app-components-ResultsContainer
  - Fare class columns per flight: Economy, Economy Plus, Business, First
  - Price in .atm-c-pricing-link__price or [class*="price"]
  - Economy column on left, Business/First on right
  - Airline direct: compare across both rows (different flights) and columns (fare tiers)

Expedia:
  - Result cards: [data-test-id="offer-listing"] or .uitk-card
  - Price display: [data-test-id="listing-price"] or .uitk-type-500
  - Shows price per traveler; total price may appear separately
  - Aggregator: one price per row, compare across rows
  - Watch for "per person" vs "total" price distinction

Generic pattern:
  - Look for repeating container elements with price text that differ by amount
    but share the same DOM structure (same class names, same nesting depth)
  - Price elements typically have class names containing: price, fare, cost, amount
  - Data attributes: data-testid*="price", data-price, data-amount
  - ARIA: aria-label containing dollar amounts or price descriptions
  - Repeating [class*="result"], [class*="flight"], [class*="fare"] containers

FARE CLASS DARK PATTERNS:
Airlines present 2-5 fare tiers per flight. Each flight row shows multiple price
columns, one per fare class. The dark pattern is making the mid-tier or premium
tier visually dominant:
  - Premium tier: larger cell, brighter color, "Recommended" badge, pre-selected radio
  - Economy tier: smaller cell, muted color, no badge, unselected radio

Counter strategy for multi-tier fare displays:
  1. For each flight row, extract the price from EVERY fare tier column
  2. The cheapest fare tier is usually the leftmost or first column (Basic Economy)
  3. Compare prices across ALL fare tiers for the same flight
  4. Also compare across different flight rows to find the absolute cheapest
  5. The minimum price across all rows AND all columns is the true cheapest flight

AGGREGATOR VS AIRLINE SITE DIFFERENCES:
The DOM structure differs between aggregator sites and airline direct sites, which
affects the price extraction strategy:

Aggregator sites (Google Flights, Kayak, Expedia, Skyscanner):
  - Show ONE price per result row (usually the cheapest available for that routing)
  - Each row = one flight option at one price
  - Compare prices ACROSS ROWS to find cheapest
  - Simpler extraction: one price per container element

Airline direct sites (Southwest, United, Delta, American, JetBlue):
  - Show MULTIPLE fare tiers per flight row (2-5 columns: Basic, Main, Comfort, Business)
  - Each row = one flight with multiple price options
  - Compare prices ACROSS BOTH ROWS (different flights) AND COLUMNS (fare tiers)
  - More complex extraction: multiple prices per container, organized in a grid
  - The cheapest is often Basic Economy in the leftmost column of any row

Mixed sites (some OTAs):
  - May show one headline price per row but expand to reveal fare tier options on click
  - Extract the headline price first for cross-row comparison
  - If clicking reveals fare tiers, extract all tier prices for that flight`,

  selectors: {
    resultContainer: {
      google: '[data-resultid], .pIav2d, li[class*="result"]',
      kayak: '.nrc6-inner, [id^="resultInner"]',
      expedia: '[data-test-id="offer-listing"], .uitk-card',
      southwest: '.air-booking-select-detail',
      united: '.app-components-ResultsContainer',
      generic: '[class*="result"], [class*="flight"], [class*="fare"], [data-testid*="result"], [data-testid*="flight"]'
    },
    priceElement: {
      google: '.YMlIz, [aria-label*="price"], [aria-label*="dollar"]',
      kayak: '.f8F1-price-text, [class*="price"]',
      expedia: '[data-test-id="listing-price"], .uitk-type-500',
      southwest: '.fare-button--value, .fare-button .swa-g-font-size-heading-2',
      united: '.atm-c-pricing-link__price, [class*="price"]',
      generic: '[class*="price"], [class*="fare"], [class*="cost"], [class*="amount"], [data-testid*="price"]'
    },
    fareClassLabel: {
      column: '[class*="fare-class"], [class*="cabin"], [class*="tier"]',
      badge: '[class*="badge"], [class*="tag"], [class*="label"], [class*="recommended"], [class*="best"]',
      preSelected: '[class*="selected"], [class*="active"], [class*="checked"], input[type="radio"]:checked'
    },
    premiumIndicators: {
      badge: '[class*="recommended"], [class*="best-value"], [class*="popular"], [class*="suggested"]',
      highlighted: '[class*="highlight"], [class*="featured"], [class*="promoted"], [class*="premium"]',
      preselected: 'input[type="radio"]:checked, [aria-checked="true"], [class*="selected"]'
    }
  },

  workflows: {
    selectCheapestFlight: [
      {
        step: 1,
        name: 'Navigate to flight results',
        description: 'Use navigate to load the flight search results page. If starting from a search form, fill in the search criteria (origin, destination, dates) and submit first. Wait for results to load by using get_dom_snapshot to confirm result container elements are present in the DOM. Do not proceed until at least one flight result is visible.',
        tools: ['navigate', 'click', 'get_dom_snapshot']
      },
      {
        step: 2,
        name: 'Identify result structure',
        description: 'Use get_dom_snapshot to determine the site type. Aggregator sites (Google Flights, Kayak, Expedia) show one price per result row -- compare across rows. Airline direct sites (Southwest, United, Delta) show multiple fare tier columns per flight row -- compare across rows AND columns. Look for repeating container elements with price text to identify the result structure.',
        tools: ['get_dom_snapshot', 'read_page']
      },
      {
        step: 3,
        name: 'Extract ALL prices',
        description: 'For each result container found, use get_text to extract the price text from every price element. Collect ALL prices on the page, not just the visually prominent ones. Scroll down to find additional results below the fold. Do NOT stop at the first result. Do NOT skip results that appear small, gray, or at the bottom of the page.',
        tools: ['get_dom_snapshot', 'get_text', 'get_attribute']
      },
      {
        step: 4,
        name: 'Ignore visual cues',
        description: 'CRITICAL: Do NOT factor in ANY of these when choosing which flight to select: (a) badge text like "Recommended" or "Best Value", (b) card size or border thickness, (c) font size or text color, (d) position on page (top vs bottom), (e) pre-selected radio button or highlighted state, (f) fare class name ("Basic" vs "Premium"). Only the numeric price value matters for selection.',
        tools: []
      },
      {
        step: 5,
        name: 'Parse and compare prices',
        description: 'Strip currency symbols ($, EUR, GBP), commas, spaces, and prefix text ("From", "Starting at") from each price string. Convert to numeric float values. Find the minimum value. Record which result element (card, row, or fare tier cell) contains the minimum price. If tied, prefer the first occurrence.',
        tools: ['get_text']
      },
      {
        step: 6,
        name: 'Click cheapest option',
        description: 'Click the result card, "Select" button, or fare tier cell that contains the minimum price. If the element is a fare tier within a flight row (airline direct site), click that specific tier cell, not the highlighted or pre-selected one. If a "Select" or "Book" button is associated with the cheapest result, click that button.',
        tools: ['click']
      },
      {
        step: 7,
        name: 'Handle pre-selection override',
        description: 'If a more expensive option is pre-selected (radio button checked, highlighted border, active CSS class), explicitly click the cheapest option to override the default pre-selection. After clicking, verify the selection changed by checking which element now has the selected/active state. If the pre-selection persists, try clicking directly on the radio button or input element for the cheapest fare.',
        tools: ['click', 'get_dom_snapshot', 'get_attribute']
      },
      {
        step: 8,
        name: 'Verify selection',
        description: 'Use get_dom_snapshot or get_text on the booking summary area, price breakdown panel, or confirmation section to confirm the selected price matches the cheapest price found in step 5. If a different (higher) price appears in the summary, the selection may have failed -- scroll back up and retry clicking the cheapest option directly.',
        tools: ['get_dom_snapshot', 'get_text', 'read_page']
      }
    ]
  },

  warnings: [
    'DARK-06: Airlines visually emphasize EXPENSIVE options and visually suppress CHEAP options. IGNORE all visual styling (color, size, borders, badges, position). Select ONLY by lowest numeric price from DOM text.',
    'NEVER trust badge text like "Recommended", "Best Value", "Most Popular" -- these are marketing labels placed on mid-tier or premium fares to steer users away from the cheapest option.',
    'Extract prices from EVERY result row and fare tier column. Do NOT stop at the first visible price or the largest/most prominent price element. The cheapest option may be in a small, gray, bottom-positioned element.',
    'On airline direct sites (Southwest, United, Delta), each flight row has multiple fare class columns. The cheapest is usually the leftmost or smallest column. Compare prices ACROSS columns for the same flight, not just across different flights.',
    'If a fare tier is PRE-SELECTED (checked radio, highlighted border), it is almost certainly NOT the cheapest. Click the cheapest tier explicitly to override the default selection.'
  ],

  toolPreferences: ['navigate', 'click', 'read_page', 'get_dom_snapshot', 'get_text', 'get_attribute']
});
