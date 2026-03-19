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

COMMON PATTERNS:
  # look up a symbol
  click e5    # symbol search input
  type e5 "TSLA"
  click e8    # autocomplete match
  gettext e12   # current price
  gettext e15   # change percentage

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
- TradingView drawing tools are in the left-side toolbar as standard HTML DOM elements
- Drawing toolbar buttons use regular DOM clicks (existing click tool works)
- Fibonacci Retracement is under the "Gann and Fibonacci tools" group button
- After selecting a drawing tool, chart canvas interaction requires CDP trusted events
- Use cdpClickAt or cdpDrag tools for all canvas coordinate interactions
- Content script dispatchEvent() produces untrusted events that canvas ignores

DRAWING TOOLS -- CDP INTERACTION:
- The chart canvas listens for mousedown/mousemove/mouseup events and checks isTrusted
- CDP Input.dispatchMouseEvent produces trusted browser-level events
- cdpClickAt(x, y): sends mousePressed + mouseReleased at viewport coordinates
- cdpDrag(startX, startY, endX, endY, steps, stepDelayMs): sends mousePressed + N mouseMoved + mouseReleased
- Coordinates are viewport-relative (use getBoundingClientRect(), NOT offsetTop/offsetLeft)
- TradingView uses 5px manhattan distance threshold to distinguish click from drag
- Ensure drag distance exceeds 50px and use at least 10 intermediate mouseMoved steps

FIBONACCI RETRACEMENT WORKFLOW (CONFIRMED via live test 2026-03-19):
1. Click [aria-label="Fib retracement"] on the left toolbar (DOM click works)
2. Click first point on chart canvas (local low) using cdpClickAt with viewport coords
3. Click second point on chart canvas (local high) using cdpClickAt with viewport coords
4. TradingView Fibonacci uses click-click pattern (two separate CDP clicks, NOT drag)
5. All 7 standard levels render: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1
6. Verify Fibonacci lines appeared by checking for new drawing DOM elements

MODAL HANDLING:
- TradingView shows sign-up and cookie modals to unauthenticated users
- Dismiss by clicking close buttons on .tv-dialog or overlay elements
- Check for modals before attempting chart interaction
- Free tier allows drawing tools without login`,
  selectors: {
    searchBox: '#header-toolbar-symbol-search input',
    price: '.js-symbol-last',
    changePercent: '.js-symbol-change-pt',
    timeframeButtons: '.item-2IihgTnv',
    chartContainer: '.chart-gui-wrapper',
    watchlistPanel: '.widgetbar-widget-watchlist',
    drawingToolbar: '.drawing-toolbar, [data-name="drawing-toolbar"]',
    fibToolGroup: '[data-name="Gann and Fibonacci Tools"], [aria-label="Fib retracement"]',
    fibRetracement: '[aria-label="Fib retracement"], [data-name="Fib Retracement"], [data-tool-name="FibRetracement"]',
    chartCanvas: '.chart-gui-wrapper canvas, .chart-markup-table canvas',
    modalOverlay: '.tv-dialog, .tv-dialog__modal-wrap, [class*="overlay"]',
    modalClose: '.tv-dialog .close-BZKENkhT, .tv-dialog__close, [data-name="close"]'
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
    ],
    drawFibRetracement: [
      'Dismiss any sign-up or cookie modals (click close on .tv-dialog overlays)',
      'Click [aria-label="Fib retracement"] on left toolbar (DOM click)',
      'Get chart canvas bounding rect via getBoundingClientRect for viewport coordinates',
      'Click first point on chart canvas (local low) using cdpClickAt with viewport coordinates',
      'Click second point on chart canvas (local high) using cdpClickAt with viewport coordinates',
      'Fibonacci uses click-click pattern (two separate CDP clicks, NOT drag)',
      'Verify Fibonacci lines appeared on chart (all 7 levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)'
    ]
  },
  warnings: [
    'TradingView charts are canvas-based -- cannot extract data from the chart itself',
    'Use the data panels and summary stats for numerical data extraction',
    'Some features require a TradingView subscription (Pro, Pro+, Premium)',
    'Canvas interactions MUST use cdpClickAt or cdpDrag -- content script events are untrusted and ignored',
    'CDP coordinates are viewport-relative -- always use getBoundingClientRect() not offsetTop/offsetLeft',
    'Drag distance must exceed 50px with at least 10 intermediate mouseMoved steps for TradingView to register'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute', 'cdpClickAt', 'cdpDrag']
});
