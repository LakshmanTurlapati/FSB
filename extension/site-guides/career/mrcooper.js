registerSiteGuide({
  site: 'Mr. Cooper',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.mrcooper.com/',
  patterns: [
    /careers\.mrcooper\.com/i
  ],
  guidance: `MR. COOPER CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.mrcooper.com/"
  # browse and extract
  click e5    # browse jobs link
  scroll down
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Mr. Cooper","role":"...","location":"...","link":"...","source":"mrcooper"}\nStart: https://careers.mrcooper.com/`,
  selectors: {
    locationFilter: '#country, #country-label, //label[normalize-space(.)="Country*"], .form-control',
    departmentFilter: '//button[normalize-space(.)="India"], //a[normalize-space(.)="OUR TEAMS"], [data-fsb-id="a_our_teams_nav"], //button[normalize-space(.)="OUR TEAMS"], [aria-expanded="false"], //a[normalize-space(.)="Our Teams"]',
    jobCards: '//a[normalize-space(.)="Browse JObs"], [role="link"], //a[normalize-space(.)="Explore Rocket Careers"], [aria-label="Explore Rocket Careers"], [data-fsb-id="a_explore_rocket_careers_ppc_section"], //a[normalize-space(.)="BROWSE JOBS"]',
    pagination: '#previousWorker, #previousWorker-label, .form-control, .col-12.col-sm-12'
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
