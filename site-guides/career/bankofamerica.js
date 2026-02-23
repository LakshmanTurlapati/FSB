registerSiteGuide({
  site: 'Bank of America',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.bankofamerica.com/',
  patterns: [
    /careers\.bankofamerica\.com/i
  ],
  guidance: `BANK OF AMERICA CAREER NAVIGATION:\nStart: https://careers.bankofamerica.com/`,
  selectors: {
    searchBox: 'input[type="text"][placeholder="Keyword\\ or\\ requisition\\ \\#"], .keyword__magnifier, input[type="image"], //button[normalize-space(.)="Search jobs"], [aria-controls="subnav-0"], #standalone_for-students',
    locationFilter: '#Regions-tab1-tabpanel-1, [role="tabpanel"][aria-labelledby="tab1"], #locat, //button[normalize-space(.)="Location"]',
    departmentFilter: '.header__utility-link.t-track-utility-link, [aria-label="Small business opens in a new window"], [aria-label="Businesses & institutions opens in a new window"], #standalone_for-professionals, //a[normalize-space(.)="For professionals"], #crprt',
    jobCards: '.t-track-main-logo, .job-search-tile__url.t-track-search-select-position, .t-track-body-copy-link, [aria-label="Bank of America Careers Homepage"], #standalone_find-your-opportunity, //a[normalize-space(.)="Find your opportunity"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.bankofamerica.com/',
      'Dismiss cookie banner if present',
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
