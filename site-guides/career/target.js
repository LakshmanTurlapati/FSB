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
    searchBox: '.global-header--search-toggle.button, .recommended-keywords--submit.form-search-submit--button, .job-search-quick-form--button-submit.button, .recommended-keywords--label.sr-only, #site-header-search-toggle, #query-input-1771837359594',
    locationFilter: '.form-input-clear.button, .sr-only, //button[normalize-space(.)="Clear location"], #location-autocomplete-input-1771837359594, [aria-controls="location-autocomplete-flyout-location-1771837359594"], //label[normalize-space(.)="City or Zip Code"]',
    departmentFilter: '.link-cta, [data-fsb-id="a_go_to_workday_team_m_section"]',
    jobCards: '.job-save-modal-trigger.button-text-link, //button[normalize-space(.)="Saved jobs (0)"], //a[normalize-space(.)="Careers"], [aria-expanded="false"]'
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
