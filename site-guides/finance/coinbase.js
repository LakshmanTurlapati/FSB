/**
 * Site Guide: Coinbase
 * Per-site guide for Coinbase cryptocurrency exchange platform.
 */

registerSiteGuide({
  site: 'Coinbase',
  category: 'Finance & Trading',
  patterns: [
    /coinbase\.com/i
  ],
  guidance: `COINBASE-SPECIFIC INTELLIGENCE:

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

GENERAL CRYPTO:
- Coinbase and other crypto platforms trade 24/7 -- no market hours concept
- Prices are highly volatile -- note the timestamp of any price extracted
- Coinbase now offers stocks and prediction markets in addition to crypto`,
  selectors: {
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
  workflows: {
    getQuote: [
      'Click search button [aria-label="search"] to reveal search input',
      'Type asset name or ticker in the search input',
      'Select from autocomplete suggestions',
      'Wait for asset page to load',
      'Extract price and key data',
      'Report extracted data with timestamp'
    ],
    checkPortfolio: [
      'Sign in if not already authenticated',
      'Navigate to portfolio/holdings section',
      'Wait for data to load',
      'Scroll to see all positions if needed',
      'Extract position details',
      'Report portfolio summary'
    ]
  },
  warnings: [
    'Coinbase shows cookie consent banner that MUST be dismissed first via #onetrust-accept-btn-handler or #onetrust-reject-all-handler',
    'Coinbase search is two-step: click [aria-label="search"] button first, then type in the search input that appears',
    'Coinbase watchlist aria-label has a double space: "Add  to watchList" (not "Add to watchlist")',
    'Many Coinbase features require sign-in (trading, portfolio, etc.)',
    'Coinbase now offers stocks and prediction markets in addition to crypto',
    'Styled-components class names (like GlobalNavLink__StyledLink-sc-...) are unstable -- use data-testid or aria-label selectors instead',
    'Crypto prices are 24/7 and highly volatile -- always note the timestamp'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
