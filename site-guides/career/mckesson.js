registerSiteGuide({
  site: 'McKesson',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.mckesson.com/',
  patterns: [
    /careers\.mckesson\.com/i
  ],
  guidance: `MCKESSON CAREER NAVIGATION:\nStart: https://careers.mckesson.com/`,
  selectors: {
    searchBox: '.search-form__saved-jobs-link, .filter-button, .recently-viewed-job-list__search-jobs-link, #search-radius-cfd8b105c2, [name="r"], #search-keyword-cfd8b105c2',
    locationFilter: '#country-toggle, //button[normalize-space(.)="Country"], #region-toggle, //button[normalize-space(.)="State/Province"], #city-toggle, //button[normalize-space(.)="City"]',
    departmentFilter: '.hub-filter__select, .hub-filter__label, .filter-button, #data-content-feed-7a40ddbcb5-facet-custom_fields_jobfunction, //label[normalize-space(.)="Functional Area"], #category-toggle',
    jobCards: '.hub-filter__select, .hub-item__link, .search-results__job-title-link, //button[normalize-space(.)="Career Opportunities"], [aria-controls="career-opportunities-menu"], #data-content-feed-7a40ddbcb5-pillar-2',
    pagination: '//a[normalize-space(.)="Homepage"], [data-fsb-id="a_homepage_content"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.mckesson.com/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Use pagination to view additional results'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
