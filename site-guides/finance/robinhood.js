/**
 * Site Guide: Robinhood
 * Per-site guide for Robinhood trading platform.
 */

registerSiteGuide({
  site: 'Robinhood',
  category: 'Finance & Trading',
  patterns: [
    /robinhood\.com/i
  ],
  guidance: `ROBINHOOD-SPECIFIC INTELLIGENCE:

SEARCH:
- Search input: #downshift-0-input
- Type a ticker symbol or company name and select from autocomplete

STOCK/CRYPTO PAGES:
- Current price: .css-4bw2gz
- Buy button: [data-testid="OrderFormBuyButton"]
- Sell button: [data-testid="OrderFormSellButton"]
- Portfolio value: [data-testid="PortfolioValue"]

TRADING:
- Robinhood requires authentication for all trading actions
- Do NOT execute trades unless explicitly requested by the user
- Buy/Sell forms appear on the right side of stock pages
- Market orders execute immediately; limit orders wait for target price

PORTFOLIO:
- Portfolio overview shows on the home page when logged in
- Individual positions show gain/loss, current value, and cost basis
- Scroll to see all positions if portfolio is large`,
  selectors: {
    searchBox: '#downshift-0-input',
    price: '.css-4bw2gz',
    buyButton: '[data-testid="OrderFormBuyButton"]',
    sellButton: '[data-testid="OrderFormSellButton"]',
    portfolio: '[data-testid="PortfolioValue"]'
  },
  workflows: {
    getQuote: [
      'Enter ticker symbol in search bar (#downshift-0-input)',
      'Select from autocomplete suggestions',
      'Wait for stock page to load',
      'Extract price and key data',
      'Report extracted data'
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
    'Trading platforms (Robinhood) require authentication for account actions',
    'Do NOT execute trades unless explicitly requested by the user',
    'Robinhood uses styled-components -- CSS class names (like .css-4bw2gz) may be unstable',
    'Market orders execute immediately -- always confirm with user before placing'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'hover', 'getAttribute']
});
