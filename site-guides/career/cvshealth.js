registerSiteGuide({
  site: 'CVS Health',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: 'workday',
  careerUrl: 'https://jobs.cvshealth.com/',
  patterns: [
    /jobs\.cvshealth\.com/i
  ],
  guidance: `CVS HEALTH CAREER NAVIGATION:\nStart: https://jobs.cvshealth.com/\nATS: workday`,
  selectors: {
    searchBox: '.phw-visually-hidden, .phw-btn.phw-g-btn-link, .phw-btn.phw-g-btn-primary, [aria-controls="typehead-listbox"], [role="combobox"], [aria-controls="gllocationListbox"]',
    locationFilter: '.phw-visually-hidden, .phw-component-v1-meta-default.phw-posn-relative, //label[normalize-space(.)="location"], [aria-controls="loc-listbox"], [aria-owns="loc-listbox"], //label[normalize-space(.)="Location"]',
    departmentFilter: '[aria-controls="CategoryBody"], [aria-label="Category"], #facetInput_0, [aria-label="category"], #category_phs_Clinical1260, [aria-label="Clinical(1260jobs)"]',
    jobCards: '.phw-btn.phw-g-menu-list-link, .phw-btn.phw-g-btn-link, .phw-btn.phw-s-find-jobs, .phw-g-job-title-link.phw-word-break, .phw-check-label._fct-label-text_mwltb_119, //button[normalize-space(.)="Careers"]',
    pagination: '//a[normalize-space(.)="Candidate Home"], [aria-label="Link to WorkDay sign in page"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://jobs.cvshealth.com/',
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
    'Uses workday ATS platform -- expect dynamic loading and potential iframes',
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
