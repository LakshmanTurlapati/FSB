/**
 * Site Guide: Google Finance
 * Per-site guide for Google Finance stock quotes and market data.
 */

registerSiteGuide({
  site: 'Google Finance',
  category: 'Finance & Trading',
  patterns: [
    /google\.com\/finance/i
  ],
  guidance: `GOOGLE FINANCE-SPECIFIC INTELLIGENCE:

STOCK QUOTE LOOKUP:
1. Use the search input (.Ax4B8.ZAGvjd input) to enter a ticker symbol
2. Wait for autocomplete suggestions and click the correct match
3. On the quote page, extract: current price (.YMlKec.fxKbKc), change (.JwB6zf)
4. Note whether the market is open or closed

DATA EXTRACTION:
- Price display: .YMlKec.fxKbKc
- Price change: .JwB6zf
- Market cap: [data-attrid="Market cap"]
- P/E ratio: [data-attrid="P/E ratio"]
- Google Finance uses data-attrid attributes for financial metrics

WATCHLIST:
- Add to watchlist via .W1gRjb button
- Watchlist shows on the main Google Finance page

NAVIGATION:
- Google Finance integrates with Google Search results
- Stock quotes may appear directly in search results as well`,
  selectors: {
    searchBox: '.Ax4B8.ZAGvjd input',
    price: '.YMlKec.fxKbKc',
    priceChange: '.JwB6zf',
    marketCap: '[data-attrid="Market cap"]',
    peRatio: '[data-attrid="P/E ratio"]',
    watchlistButton: '.W1gRjb'
  },
  workflows: {
    getQuote: [
      'Enter ticker symbol in search bar',
      'Select from autocomplete suggestions',
      'Wait for quote page to load',
      'Extract price, change, market cap, P/E ratio',
      'Report all extracted data with timestamps'
    ],
    compareStocks: [
      'Look up first stock and record its data',
      'Look up second stock and record its data',
      'Compare key metrics side by side',
      'Report the comparison'
    ]
  },
  warnings: [
    'Financial data may be delayed 15-20 minutes unless it says "real-time"',
    'After-hours prices differ from regular market prices',
    'Google Finance is integrated into Google Search -- stock data may appear in search results directly'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
