/**
 * Site Guide: Steam
 * Per-site guide for Steam store and community platforms.
 */

registerSiteGuide({
  site: 'Steam',
  category: 'Gaming Platforms',
  patterns: [
    /store\.steampowered\.com/i,
    /steamcommunity\.com/i
  ],
  guidance: `STEAM-SPECIFIC INTELLIGENCE:

CRITICAL -- CSS CLASSES ARE HASHED/DYNAMIC:
- Steam uses hashed CSS classes like "_175B12uOwmeGBNcSaQFe-Z" that change on every build.
- NEVER use these hashed classes as selectors. They WILL break.
- Use XPath with normalize-space(), [role], [aria-label], [name], and semantic selectors instead.

SEARCH:
- Search box: [role="combobox"][name="term"] or [name="term"]
- Type your query into the combobox and press Enter to search.
- Do NOT try to click search suggestions -- just press Enter after typing.

NAVIGATION:
- Top nav buttons use XPath: //button[normalize-space(.)="Categories"], //button[normalize-space(.)="Browse"]
- Main nav links: //a[normalize-space(.)="STORE"], //a[normalize-space(.)="COMMUNITY"], //a[normalize-space(.)="SUPPORT"]
- Home logo: [aria-label="Link to the Steam Homepage"]
- Install Steam button: .header_installsteam_btn

SIGN IN:
- Sign in link: .global_action_link with text "sign in" or XPath //a[normalize-space(.)="sign in"]
- Login page: store.steampowered.com/login with standard username/password fields
- Steam Guard (2FA) will prompt after credentials -- user must approve manually

PRICE & DISCOUNT EXTRACTION:
- Discount blocks use [aria-label] attributes with structured price info
- The aria-label contains full pricing like: "25% off. $39.99 normally, discounted to $29.99"
- Extract price info from [aria-label] on discount elements, NOT from inner text spans
- Featured games: .store_main_capsule links with inline text containing title + price + tags

AGE VERIFICATION:
- Steam shows age gates on mature content pages
- These require selecting a birth date from dropdowns and clicking a confirm button
- Select a date that makes the user 18+ (e.g., January 1, 1990) and proceed`,
  selectors: {
    searchBox: '[role="combobox"][name="term"], [name="term"]',
    signIn: '.global_action_link',
    homeLogo: '[aria-label="Link to the Steam Homepage"]',
    navStore: '//a[normalize-space(.)="STORE"]',
    navCommunity: '//a[normalize-space(.)="COMMUNITY"]',
    navAbout: '//a[normalize-space(.)="About"]',
    navSupport: '//a[normalize-space(.)="SUPPORT"]',
    categories: '//button[normalize-space(.)="Categories"]',
    browse: '//button[normalize-space(.)="Browse"]',
    languageSelector: '#language_pulldown',
    discountBlock: '.discount_block',
    featuredGame: '.store_main_capsule',
    installSteam: '.header_installsteam_btn'
  },
  workflows: {
    priceCheck: [
      'Search for the game using the search box ([name="term"])',
      'Press Enter to submit the search',
      'Click the correct game from search results',
      'Extract the price from the game store page (check [aria-label] on discount elements)',
      'Report the price, any discounts, and availability'
    ],
    browseStore: [
      'Navigate to store.steampowered.com or use category buttons',
      'Browse featured/sale/new release sections',
      'Extract game titles, prices, and tags',
      'Report findings to the user'
    ],
    login: [
      'Click the sign in link (.global_action_link)',
      'Fill in username/email field',
      'Fill in password field',
      'Submit the login form',
      'Handle Steam Guard/2FA prompt (user must approve manually)'
    ]
  },
  warnings: [
    'Steam CSS classes are hashed/dynamic (e.g., _175B12uOwmeGBNcSaQFe-Z) -- NEVER use these as selectors, they change on every build',
    'Age verification gates may appear on mature content pages -- select a valid birth date and confirm',
    'Steam Guard (2FA) is required for login -- automation can fill credentials but user must approve the 2FA prompt',
    'Steam uses a mix of old jQuery and new React components -- selectors may behave differently across page sections',
    'Discount prices are best extracted from [aria-label] attributes which contain structured price info'
  ],
  toolPreferences: ['click', 'type', 'pressEnter', 'scroll', 'getText', 'waitForElement', 'navigate', 'getAttribute']
});
