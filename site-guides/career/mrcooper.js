registerSiteGuide({
  site: 'Mr. Cooper',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.mrcooper.com/',
  patterns: [
    /careers\.mrcooper\.com/i
  ],
  guidance: `MR. COOPER CAREER NAVIGATION:\nStart: https://careers.mrcooper.com/`,
  selectors: {
    locationFilter: '.form-control, #country, #country-label, //label[normalize-space(.)="Country*"]',
    departmentFilter: '.drop-down.india-team, //button[normalize-space(.)="India"], //a[normalize-space(.)="OUR TEAMS"], [data-fsb-id="a_our_teams_nav"], //button[normalize-space(.)="OUR TEAMS"], [aria-expanded="false"]',
    jobCards: '.form-control, //a[normalize-space(.)="Browse JObs"], [role="link"], //a[normalize-space(.)="Explore Rocket Careers"], [aria-label="Explore Rocket Careers"], [data-fsb-id="a_explore_rocket_careers_ppc_section"]',
    pagination: '.form-control, .col-12.col-sm-12, #previousWorker, #previousWorker-label'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.mrcooper.com/',
      'Dismiss cookie banner if present',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Use pagination to view additional results'
    ]
  },
  warnings: [
    'No search box detected -- may need to browse listings manually or use URL parameters',
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
