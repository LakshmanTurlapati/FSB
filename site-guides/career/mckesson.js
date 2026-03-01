registerSiteGuide({
  site: 'McKesson',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.mckesson.com/',
  patterns: [
    /careers\.mckesson\.com/i
  ],
  guidance: `MCKESSON CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.mckesson.com/"
  # search and extract
  click e5    # search box
  type e5 "supply chain analyst"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"McKesson","role":"...","location":"...","link":"...","source":"mckesson"}\nStart: https://careers.mckesson.com/`,
  selectors: {
    searchBox: '#search-radius-cfd8b105c2, [name="r"], #search-keyword-cfd8b105c2, [name="k"], [aria-controls="search-location-cfd8b105c2-mindreader"], [role="combobox"][aria-describedby="search-error-1 autocomplete-message-search-location-cfd8b105c2"]',
    locationFilter: '#country-toggle, //button[normalize-space(.)="Country"], #region-toggle, //button[normalize-space(.)="State/Province"], #city-toggle, //button[normalize-space(.)="City"]',
    departmentFilter: '#data-content-feed-7a40ddbcb5-facet-custom_fields_jobfunction, //label[normalize-space(.)="Functional Area"], #category-toggle, //button[normalize-space(.)="Category"], #custom_fields\\.jobfunction-toggle, //button[normalize-space(.)="Job Function"]',
    jobCards: '//button[normalize-space(.)="Career Opportunities"], [aria-controls="career-opportunities-menu"], #data-content-feed-7a40ddbcb5-pillar-2, [data-fsb-id="a_a_transportation_sup_content"], [data-fsb-id="a_consolidated_mail_ou_search_results"], //a[normalize-space(.)="Customer Care Supervisor"]',
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
