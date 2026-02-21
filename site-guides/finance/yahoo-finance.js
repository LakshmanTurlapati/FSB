/**
 * Site Guide: Yahoo Finance
 * Per-site guide for Yahoo Finance stock quotes and financial data.
 */

registerSiteGuide({
  site: 'Yahoo Finance',
  category: 'Finance & Trading',
  patterns: [
    /finance\.yahoo\.com/i
  ],
  guidance: `YAHOO FINANCE-SPECIFIC INTELLIGENCE:

STOCK QUOTE LOOKUP:
1. Use the search bar (#ybar-sbq or #yfin-usr-qry) to enter a ticker symbol (e.g., AAPL, MSFT, TSLA)
2. Wait for autocomplete suggestions and click the correct match
3. On the quote page, extract: current price, change ($ and %), volume, market cap
4. Note whether the market is open or closed (after-hours prices may differ)

DATA EXTRACTION:
- Key data fields use data-testid and data-field attributes for reliable selection
- Price: [data-testid="qsp-price"]
- Change: [data-testid="qsp-price-change"]
- Volume: [data-field="regularMarketVolume"]
- Market Cap: [data-field="marketCap"]
- P/E Ratio: [data-field="trailingPE"]
- 52-Week Range: [data-field="fiftyTwoWeekRange"]

NAVIGATION TABS:
- Summary: [data-test="SUMMARY"]
- Statistics: [data-test="STATISTICS"]
- Financials: [data-test="FINANCIALS"]
- Use these tabs to access different data views for a stock

WATCHLIST:
- Add to watchlist button: [data-testid="add-to-watchlist"]
- Portfolio views may require scrolling horizontally for all columns

NEWS & ANALYSIS:
- News articles are below the quote summary, accessible via .js-content-viewer
- Analyst ratings may show Buy/Hold/Sell recommendations`,
  selectors: {
    searchBox: '#ybar-sbq, #yfin-usr-qry',
    price: '[data-testid="qsp-price"]',
    priceChange: '[data-testid="qsp-price-change"]',
    volume: '[data-field="regularMarketVolume"]',
    marketCap: '[data-field="marketCap"]',
    peRatio: '[data-field="trailingPE"]',
    weekRange: '[data-field="fiftyTwoWeekRange"]',
    addToWatchlist: '[data-testid="add-to-watchlist"]',
    newsArticle: '.js-content-viewer',
    summaryTab: '[data-test="SUMMARY"]',
    statisticsTab: '[data-test="STATISTICS"]',
    financialsTab: '[data-test="FINANCIALS"]'
  },
  workflows: {
    getQuote: [
      'Enter ticker symbol in search bar (#ybar-sbq)',
      'Select from autocomplete suggestions',
      'Wait for quote page to load',
      'Extract price, change, volume, market cap using data-testid selectors',
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
    'Yahoo Finance may show consent/cookie popups that need dismissing first',
    'Financial data may be delayed 15-20 minutes unless it says "real-time"',
    'After-hours prices differ from regular market prices'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
