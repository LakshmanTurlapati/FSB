/**
 * Shared Category Guidance: Finance & Trading
 * Category-level guidance that applies to all finance and trading sites.
 */

registerCategoryGuidance({
  category: 'Finance & Trading',
  icon: 'fa-chart-line',
  guidance: `FINANCE & TRADING INTELLIGENCE:

STOCK QUOTE LOOKUP:
1. Use the search/quote bar to enter a ticker symbol (e.g., AAPL, MSFT, TSLA)
2. Wait for autocomplete suggestions and click the correct match
3. On the quote page, extract: current price, change ($ and %), volume, market cap
4. Note whether the market is open or closed (after-hours prices may differ)

DATA EXTRACTION:
- Financial data is often in tables -- look for <table> elements
- Key metrics: Price, Change, Volume, Market Cap, P/E Ratio, 52-Week Range
- Charts are visual only -- extract data from the summary/stats section instead
- Numbers may use abbreviations (B=billion, M=million, K=thousand)

PORTFOLIO/WATCHLIST:
- Adding to watchlist: Find the "Add to Watchlist" or star/bookmark icon
- Portfolio views may require scrolling horizontally for all columns
- Sort by clicking column headers

CHART INTERACTION:
- Timeframe buttons (1D, 5D, 1M, 6M, YTD, 1Y, 5Y) change the view
- Hovering on a chart shows data for that point in time
- Do NOT try to extract data from chart pixels -- use the data tables instead

NEWS & ANALYSIS:
- Financial news articles are usually below the quote summary
- Analyst ratings may show Buy/Hold/Sell recommendations
- Earnings dates and estimates are in the "Analysis" or "Financials" tab`,
  warnings: [
    'Financial data may be delayed 15-20 minutes unless it says "real-time"',
    'After-hours prices differ from regular market prices',
    'Trading platforms require authentication for account actions',
    'Do NOT execute trades unless explicitly requested by the user',
    'Crypto prices are 24/7 and highly volatile -- always note the timestamp'
  ]
});
