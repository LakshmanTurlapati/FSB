registerSiteGuide({
  site: 'Target',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://jobs.target.com/',
  patterns: [
    /jobs\.target\.com/i
  ],
  guidance: `TARGET CAREER NAVIGATION:\nStart: https://jobs.target.com/`,
  selectors: {
    searchBox: '#site-header-search-toggle, #query-input-1771837359594, [aria-controls="recommended-keywords-flyout-query-1771837359594"], //button[normalize-space(.)="Search jobs"], //label[normalize-space(.)="Job title, skill, or keyword"], .global-header--search-toggle.button',
    locationFilter: '//button[normalize-space(.)="Clear location"], #location-autocomplete-input-1771837359594, [aria-controls="location-autocomplete-flyout-location-1771837359594"], //label[normalize-space(.)="City or Zip Code"], .form-input-clear.button, .sr-only',
    departmentFilter: '[data-fsb-id="a_go_to_workday_team_m_section"], .link-cta',
    jobCards: '//button[normalize-space(.)="Saved jobs (0)"], //a[normalize-space(.)="Careers"], [aria-expanded="false"], .job-save-modal-trigger.button-text-link'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://jobs.target.com/',
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
