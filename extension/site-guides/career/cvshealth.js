registerSiteGuide({
  site: 'CVS Health',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: 'workday',
  careerUrl: 'https://jobs.cvshealth.com/',
  patterns: [
    /jobs\.cvshealth\.com/i
  ],
  guidance: `CVS HEALTH CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://jobs.cvshealth.com/"
  # search and extract
  click e5    # search box
  type e5 "pharmacist"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"CVS Health","role":"...","location":"...","link":"...","source":"cvshealth"}\nStart: https://jobs.cvshealth.com/\nATS: workday`,
  selectors: {
    searchBox: '[aria-controls="typehead-listbox"], [role="combobox"], [aria-controls="gllocationListbox"], #ph-search-backdrop, [aria-label="Search"], //a[normalize-space(.)="Search Jobs"]',
    locationFilter: '//label[normalize-space(.)="location"], [aria-controls="loc-listbox"], [aria-owns="loc-listbox"], //label[normalize-space(.)="Location"], .phw-visually-hidden, .phw-component-v1-meta-default.phw-posn-relative',
    departmentFilter: '[aria-controls="CategoryBody"], [aria-label="Category"], #facetInput_0, [aria-label="category"], #category_phs_Clinical1260, [aria-label="Clinical(1260jobs)"]',
    jobCards: '//button[normalize-space(.)="Careers"], //a[normalize-space(.)="Saved jobs(0)"], [aria-label="0 saved jobs"], [aria-label="Save Shift Supervisor  to job cart"], //label[normalize-space(.)="Clinical (1260)jobs"], [role="text"]',
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
