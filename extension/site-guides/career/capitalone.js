registerSiteGuide({
  site: 'Capital One',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.capitalonecareers.com/',
  patterns: [
    /www\.capitalonecareers\.com/i
  ],
  guidance: `CAPITAL ONE CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.capitalonecareers.com/"
  # search and extract
  click e5    # search box
  type e5 "data scientist"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Capital One","role":"...","location":"...","link":"...","source":"capitalone"}\nStart: https://www.capitalonecareers.com/`,
  selectors: {
    searchBox: '//button[normalize-space(.)="Search Jobs"], [aria-expanded="true"], [aria-controls="search-location-ab25abfe04-mindreader"], [role="combobox"][aria-describedby="search-error-1 autocomplete-message-search-location-ab25abfe04"], #search-keyword-ab25abfe04, [name="k"]',
    locationFilter: '//button[normalize-space(.)="Locations"], [aria-expanded="false"], //a[normalize-space(.)="United States"], #city-toggle, //a[normalize-space(.)="60303514304\n\n                 "], [data-fsb-id="a_60303514304_02232026_search_results_"]',
    departmentFilter: '//a[normalize-space(.)="Teams"], #category-toggle, //button[normalize-space(.)="Teams"], [data-fsb-id="a_a_tech_career_built__content"], //a[normalize-space(.)="91213338320\n\n                 "], [data-fsb-id="a_91213338320_01302026_search_results_"]',
    jobCards: '//button[normalize-space(.)="Explore Jobs"], [aria-expanded="false"], //a[normalize-space(.)="Careers Blog"], //button[normalize-space(.)="Set Job Alert"], [aria-label="Save Job"], [role="button"]',
    jobTitle: '#disclosure-btn-1, [aria-controls="disclosure-content-1"]',
    applyButton: '//label[normalize-space(.)="You’re interested in"], [data-fsb-id="label_youre_interested_in_search_jobs"], #nav-anchor-apply, //a[normalize-space(.)="Applying 101"], [data-fsb-id="button_expand_allcollapse_a_fs_12"], .disclosure--toggle-all',
    pagination: '//button[normalize-space(.)="Next"], //button[normalize-space(.)="Previous"], //a[normalize-space(.)="Benefits"], //a[normalize-space(.)="Capital One 101"], //a[normalize-space(.)="Culture"], //a[normalize-space(.)="Diversity & Inclusion"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.capitalonecareers.com/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Click job title to view details',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
