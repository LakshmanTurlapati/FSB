registerSiteGuide({
  site: 'Johnson & Johnson',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.jnj.com/',
  patterns: [
    /careers\.jnj\.com/i
  ],
  guidance: `JOHNSON & JOHNSON CAREER NAVIGATION:\nStart: https://careers.jnj.com/`,
  selectors: {
    searchBox: '#js-quick-job-search, //button[normalize-space(.)="Search"], //button[normalize-space(.)="Search J&J.com"], #ql-search, //label[normalize-space(.)="Keywords:"], .SearchOverlay-search-button',
    locationFilter: '#ql-country, [name="country"], //button[normalize-space(.)="English USA"], [aria-label="English USA - Open modal to change region"], //label[normalize-space(.)="Country / Territory:"], .visually-hidden',
    departmentFilter: '[aria-expanded="false"], [aria-label="Open Sub Navigation for  Healthcare areas"]',
    jobCards: '[aria-expanded="false"], [aria-label="Open Sub Navigation for Careers"], #js-saved-jobs-page, [data-fsb-id="a_js_saved_jobs_page_global_site_nav"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.jnj.com/',
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
