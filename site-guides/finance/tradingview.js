/**
 * Site Guide: TradingView
 * Per-site guide for TradingView charting and market analysis platform.
 */

registerSiteGuide({
  site: 'TradingView',
  category: 'Finance & Trading',
  patterns: [
    /tradingview\.com/i
  ],
  guidance: `TRADINGVIEW-SPECIFIC INTELLIGENCE:

SYMBOL SEARCH:
1. Use the search input (#header-toolbar-symbol-search input) to enter a ticker symbol
2. Wait for autocomplete suggestions and click the correct match
3. The chart will update to show the selected symbol

CHART INTERACTION:
- TradingView charts are interactive canvas-based charts
- Timeframe buttons (.item-2IihgTnv) change the view (1D, 5D, 1M, etc.)
- Hovering on a chart shows data for that point in time
- Do NOT try to extract data from chart pixels -- use the data panels instead

DATA EXTRACTION:
- Current price: .js-symbol-last
- Change percentage: .js-symbol-change-pt
- Chart container: .chart-gui-wrapper
- Use the summary/stats panels for numerical data rather than the chart

WATCHLIST:
- Watchlist panel: .widgetbar-widget-watchlist
- Add symbols to watchlist from the search results
- Watchlist shows in the right sidebar

DRAWING TOOLS:
- TradingView has extensive drawing tools for technical analysis
- These are complex and require precise interaction
- Prefer using the built-in indicators panel for analysis`,
  selectors: {
    searchBox: '#header-toolbar-symbol-search input',
    price: '.js-symbol-last',
    changePercent: '.js-symbol-change-pt',
    timeframeButtons: '.item-2IihgTnv',
    chartContainer: '.chart-gui-wrapper',
    watchlistPanel: '.widgetbar-widget-watchlist'
  },
  workflows: {
    getQuote: [
      'Enter ticker symbol in search bar',
      'Select from autocomplete suggestions',
      'Wait for chart to update',
      'Extract price and change from the data panel',
      'Report extracted data with timestamps'
    ],
    compareStocks: [
      'Look up first stock and record its data',
      'Look up second stock and record its data',
      'Compare key metrics side by side',
      'Report the comparison'
    ]
  },
  warnings: [
    'TradingView charts are canvas-based -- cannot extract data from the chart itself',
    'Use the data panels and summary stats for numerical data extraction',
    'Some features require a TradingView subscription (Pro, Pro+, Premium)',
    'Drawing tools and indicators are complex -- prefer reading existing analysis'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
