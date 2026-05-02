/**
 * Site Guide: Finviz
 * Per-site guide for Finviz stock screener and financial data platform.
 */

registerSiteGuide({
  site: 'Finviz',
  category: 'Finance & Trading',
  patterns: [
    /finviz\.com/i
  ],
  guidance: `FINVIZ-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # look up a stock
  click e5    # search/quote input
  type e5 "GOOG"
  enter
  gettext e10   # price
  # use stock screener
  click e15   # screener filter dropdown
  click e18   # filter option

STOCK SEARCH:
- Search/quote input: #js_p_typeahead
- Type a ticker symbol and select from autocomplete
- Finviz is primarily a stock screener and data visualization tool

DATA EXTRACTION:
- Price: .snapshot-td2 .tab-link b
- Financial data is displayed in dense table format
- Finviz tables pack many metrics into compact layouts
- Look for table cells rather than individual labeled elements

STOCK SCREENER:
- Screener filters: .screener-combo-select
- Stock results table: #screener-content table
- Filters allow selection by market cap, P/E, sector, industry, etc.
- Apply filters and wait for the table to update

HEAT MAP & VISUALIZATIONS:
- Finviz is known for its market heat map and sector visualizations
- These are image/canvas-based -- cannot extract data from them directly
- Use the underlying data tables instead`,
  selectors: {
    searchBox: '#js_p_typeahead',
    price: '.snapshot-td2 .tab-link b',
    screenerFilters: '.screener-combo-select',
    stockTable: '#screener-content table'
  },
  workflows: {
    getQuote: [
      'Enter ticker symbol in search bar (#js_p_typeahead)',
      'Select from autocomplete suggestions',
      'Wait for stock page to load',
      'Extract price and key financial metrics from the snapshot table',
      'Report extracted data'
    ],
    screenStocks: [
      'Navigate to the screener page',
      'Set desired filters using the screener dropdowns',
      'Wait for results table to update',
      'Extract matching stocks from the results table',
      'Report findings'
    ]
  },
  warnings: [
    'Finviz free version has delayed data -- Elite subscription provides real-time',
    'Heat maps and visualizations are image-based -- extract data from tables instead',
    'Screener results may paginate -- check for next page links',
    'Financial data may be delayed 15-20 minutes unless it says "real-time"'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
