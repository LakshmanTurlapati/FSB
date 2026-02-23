registerSiteGuide({
  site: 'Pfizer',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: 'workday',
  careerUrl: 'https://www.pfizer.com/about/careers',
  patterns: [
    /www\.pfizer\.com\/about/i
  ],
  guidance: `PFIZER CAREER NAVIGATION:\nStart: https://www.pfizer.com/about/careers\nATS: workday`,
  selectors: {
    searchBox: '#edit-keywords, [name="keywords"], //button[normalize-space(.)="Search"], #edit-search-api-fulltext, [aria-label="Search Input Box"], .header__search.hide-element-text',
    locationFilter: '#edit-workday-wrapper-region_input, #edit-workday-wrapper-location_input, input[type="text"][placeholder="Region"], input[type="text"][placeholder="Site\\ Location"]',
    departmentFilter: '#edit-workday-wrapper-category_input, input[type="text"][placeholder="Job\\ Category"]',
    jobCards: '//a[normalize-space(.)="Careers"], [data-fsb-id="a_careers_header"], [data-fsb-id="a_careers_main_content"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.pfizer.com/about/careers',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions'
    ]
  },
  warnings: [
    'Uses workday ATS platform -- expect dynamic loading and potential iframes',
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
