registerSiteGuide({
  site: 'AT&T',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.att.jobs/',
  patterns: [
    /www\.att\.jobs/i
  ],
  guidance: `AT&T CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.att.jobs/"
  # search and extract
  click e5    # search box
  type e5 "network engineer"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"AT&T","role":"...","location":"...","link":"...","source":"att"}\nStart: https://www.att.jobs/`,
  selectors: {
    searchBox: '//button[normalize-space(.)="Search Jobs"], #search-keyword-77da3e4899, [name="k"], [aria-controls="search-location-77da3e4899-mindreader"], [role="combobox"][aria-describedby="search-error-2 autocomplete-message-search-location-77da3e4899"], #search-submit-77da3e4899',
    locationFilter: '#country-toggle, //button[normalize-space(.)="Country"], #region-toggle, //button[normalize-space(.)="State"], #city-toggle, //button[normalize-space(.)="City"]',
    departmentFilter: '#category-toggle, //button[normalize-space(.)="Category"], //a[normalize-space(.)="Business Development and Strat"], [data-fsb-id="a_business_development_search_results_"], //a[normalize-space(.)="Business Sales"], [aria-label="Employee Group Conference 2023 (Video)"]',
    jobCards: '//button[normalize-space(.)="Careers"], [aria-controls="nav-content-1"], //button[normalize-space(.)="Early Careers"], [aria-controls="nav-content-2"], //a[normalize-space(.)="Saved Jobs"], //a[normalize-space(.)="Early Careers"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.att.jobs/',
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
