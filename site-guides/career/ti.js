registerSiteGuide({
  site: 'Texas Instruments',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.ti.com/',
  patterns: [
    /careers\.ti\.com/i
  ],
  guidance: `TEXAS INSTRUMENTS CAREER NAVIGATION:\nStart: https://careers.ti.com/`,
  selectors: {
    searchBox: '.search-box-compact__button.text-color-secondary, .oj-helper-hidden-accessible, .search-context-button.search-context-button--selected, .search-context-button, .search-filters__pill.search-filters__pill--contains-selected-items, .search-jobs__clear-filters.text-color-secondary',
    locationFilter: '.oj-helper-hidden-accessible, //label[normalize-space(.)="City, state, country"]',
    jobCards: '.categories-list__button, .favourite-star.job-tile__favorited, .search-results-sorting__section.text-color-primary, .job-list-item__link, [aria-label="All Jobs 359"], [aria-controls="sortMenu"]',
    applyButton: '//button[normalize-space(.)="Next"], [aria-label="Next"], //button[normalize-space(.)="Cancel"], [aria-label="Cancel"]',
    pagination: '.app-header__logo.app-header__logo--desktop, [aria-label="Go to Home Page"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.ti.com/',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
