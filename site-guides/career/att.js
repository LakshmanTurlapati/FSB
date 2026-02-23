registerSiteGuide({
  site: 'AT&T',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.att.jobs/',
  patterns: [
    /www\.att\.jobs/i
  ],
  guidance: `AT&T CAREER NAVIGATION:\nStart: https://www.att.jobs/`,
  selectors: {
    searchBox: '.navigation__search-toggle, .add-keyword.fs-col-span-2, .fs-col-span-12.fs-col-span-m-3, //button[normalize-space(.)="Search Jobs"], #search-keyword-77da3e4899, [name="k"]',
    locationFilter: '#country-toggle, //button[normalize-space(.)="Country"], #region-toggle, //button[normalize-space(.)="State"], #city-toggle, //button[normalize-space(.)="City"]',
    departmentFilter: '.section7__link, .video-button, #category-toggle, //button[normalize-space(.)="Category"], //a[normalize-space(.)="Business Development and Strat"], [data-fsb-id="a_business_development_search_results_"]',
    jobCards: '.utility-nav__link, .callout__wrapping-link.section26__link, //button[normalize-space(.)="Careers"], [aria-controls="nav-content-1"], //button[normalize-space(.)="Early Careers"], [aria-controls="nav-content-2"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.att.jobs/',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
