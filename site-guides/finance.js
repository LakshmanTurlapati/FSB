/**
 * Site Guide: Finance & Trading
 * Covers Yahoo Finance, Google Finance, TradingView, Robinhood, Fidelity
 */

const FINANCE_GUIDE = {
  name: 'Finance & Trading',

  patterns: [
    /finance\.yahoo\.com/i,
    /google\.com\/finance/i,
    /tradingview\.com/i,
    /robinhood\.com/i,
    /fidelity\.com/i,
    /schwab\.com/i,
    /etrade\.com/i,
    /coinbase\.com/i,
    /binance\.com/i,
    /bloomberg\.com/i,
    /marketwatch\.com/i,
    /investing\.com/i,
    /cnbc\.com/i,
    /seekingalpha\.com/i,
    /stocktwits\.com/i,
    /finviz\.com/i,
    /morningstar\.com/i,
    /wsj\.com/i
  ],

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
- TradingView charts are interactive but complex
- Timeframe buttons (1D, 5D, 1M, 6M, YTD, 1Y, 5Y) change the view
- Hovering on a chart shows data for that point in time
- Do NOT try to extract data from chart pixels -- use the data tables instead

NEWS & ANALYSIS:
- Financial news articles are usually below the quote summary
- Analyst ratings may show Buy/Hold/Sell recommendations
- Earnings dates and estimates are in the "Analysis" or "Financials" tab

COINBASE-SPECIFIC INTELLIGENCE:

COOKIE CONSENT (MUST HANDLE FIRST):
- Coinbase shows a cookie consent banner on first visit that MUST be dismissed before any interaction.
- Accept: #onetrust-accept-btn-handler
- Reject: #onetrust-reject-all-handler
- Customize: #onetrust-pc-btn-handler

NAVIGATION:
- Home: [data-testid="header-home-link"]
- Sign in: [data-testid="header-sign-in-button"]
- Sign up: [data-testid="header-get-started-button"]
- Cryptocurrencies: [data-testid="main-nav-link-prices"]
- Nav dropdowns: [aria-controls="global-nav-dropdown-individuals"], [aria-controls="global-nav-dropdown-businesses"], etc.
- Language selector: [aria-label="open language selector"]

SEARCH (TWO-STEP PROCESS):
1. Click the search button: [aria-label="search"] (icon button, not an input)
2. Type in the search input that appears: [aria-label="Search for an asset"] or #searchInput
- Do NOT try to type directly -- the search input is hidden until the button is clicked.

MARKET OVERVIEW:
- Market stats buttons: [aria-label="Total market cap market statistics"], [aria-label="Trade volume market statistics"], [aria-label="BTC dominance market statistics"], [aria-label="Buy-sell ratio market statistics"]
- Currency selector: [aria-label="Currency selector USD"]
- Coinbase 50 Index: [data-testid="coin-50-info-button"]
- Asset cards: [data-testid="contained-asset-card"]

ASSET INTERACTION:
- Add to watchlist: [aria-label="Add  to watchList"] (NOTE: double space between "Add" and "to")
- Trade buttons: [aria-label="Trade Bitcoin"], [aria-label="Trade Ethereum"], etc.
- Asset pages: /price/bitcoin, /price/ethereum, etc.
- Prediction markets: /prediction-markets
- Stocks: /stocks

GENERAL CRYPTO PLATFORMS:
- Coinbase and Binance use similar patterns to stock platforms
- Crypto trades 24/7 -- no market hours concept
- Prices are highly volatile -- note the timestamp of any price extracted`,

  selectors: {
    'finance.yahoo': {
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
    'google': {
      searchBox: '.Ax4B8.ZAGvjd input',
      price: '.YMlKec.fxKbKc',
      priceChange: '.JwB6zf',
      marketCap: '[data-attrid="Market cap"]',
      peRatio: '[data-attrid="P/E ratio"]',
      watchlistButton: '.W1gRjb'
    },
    'tradingview': {
      searchBox: '#header-toolbar-symbol-search input',
      price: '.js-symbol-last',
      changePercent: '.js-symbol-change-pt',
      timeframeButtons: '.item-2IihgTnv',
      chartContainer: '.chart-gui-wrapper',
      watchlistPanel: '.widgetbar-widget-watchlist'
    },
    'robinhood': {
      searchBox: '#downshift-0-input',
      price: '.css-4bw2gz',
      buyButton: '[data-testid="OrderFormBuyButton"]',
      sellButton: '[data-testid="OrderFormSellButton"]',
      portfolio: '[data-testid="PortfolioValue"]'
    },
    'coinbase': {
      searchButton: '[aria-label="search"]',
      searchInput: '#searchInput, [aria-label="Search for an asset"]',
      homeLink: '[data-testid="header-home-link"]',
      signIn: '[data-testid="header-sign-in-button"]',
      signUp: '[data-testid="header-get-started-button"]',
      navPrices: '[data-testid="main-nav-link-prices"]',
      navIndividuals: '[aria-controls="global-nav-dropdown-individuals"]',
      navBusinesses: '[aria-controls="global-nav-dropdown-businesses"]',
      cookieAccept: '#onetrust-accept-btn-handler',
      cookieReject: '#onetrust-reject-all-handler',
      addToWatchlist: '[aria-label="Add  to watchList"]',
      tradeBitcoin: '[aria-label="Trade Bitcoin"]',
      tradeEthereum: '[aria-label="Trade Ethereum"]',
      marketCapStats: '[aria-label="Total market cap market statistics"]',
      tradeVolumeStats: '[aria-label="Trade volume market statistics"]',
      btcDominanceStats: '[aria-label="BTC dominance market statistics"]',
      buySellRatioStats: '[aria-label="Buy-sell ratio market statistics"]',
      currencySelector: '[aria-label="Currency selector USD"]',
      assetCard: '[data-testid="contained-asset-card"]',
      coinbaseIndex: '[data-testid="coin-50-info-button"]',
      languageSelector: '[aria-label="open language selector"]',
      price: '[data-testid="asset-price"]',
      buyButton: '[data-testid="buy-button"]',
      sellButton: '[data-testid="sell-button"]'
    },
    'finviz': {
      searchBox: '#js_p_typeahead',
      price: '.snapshot-td2 .tab-link b',
      screenerFilters: '.screener-combo-select',
      stockTable: '#screener-content table'
    }
  },

  workflows: {
    getQuote: [
      'Enter ticker symbol in search bar',
      'Select from autocomplete suggestions',
      'Wait for quote page to load',
      'Extract price, change, volume, market cap',
      'Report all extracted data with timestamps'
    ],
    compareStocks: [
      'Look up first stock and record its data',
      'Look up second stock and record its data',
      'Compare key metrics side by side',
      'Report the comparison'
    ],
    checkPortfolio: [
      'Navigate to portfolio/holdings section',
      'Wait for data to load',
      'Scroll to see all positions if needed',
      'Extract position details (symbol, shares, value, gain/loss)',
      'Report portfolio summary'
    ]
  },

  warnings: [
    'Financial data may be delayed 15-20 minutes unless it says "real-time"',
    'After-hours prices differ from regular market prices',
    'Trading platforms (Robinhood, Fidelity) require authentication for account actions',
    'Do NOT execute trades unless explicitly requested by the user',
    'TradingView charts are canvas-based -- cannot extract data from the chart itself',
    'Yahoo Finance may show consent/cookie popups that need dismissing first',
    'Crypto prices are 24/7 and highly volatile -- always note the timestamp',
    'Coinbase shows cookie consent banner that MUST be dismissed first via #onetrust-accept-btn-handler or #onetrust-reject-all-handler',
    'Coinbase search is two-step: click [aria-label="search"] button first, then type in the search input that appears',
    'Coinbase watchlist aria-label has a double space: "Add  to watchList" (not "Add to watchlist")',
    'Many Coinbase features require sign-in (trading, portfolio, etc.)',
    'Coinbase now offers stocks and prediction markets in addition to crypto',
    'Styled-components class names (like GlobalNavLink__StyledLink-sc-...) are unstable -- use data-testid or aria-label selectors instead'
  ],

  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
};

registerSiteGuide(FINANCE_GUIDE);
