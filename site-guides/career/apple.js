registerSiteGuide({
  site: 'Apple',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.apple.com/careers/',
  patterns: [
    /www\.apple\.com\/careers/i
  ],
  guidance: `APPLE CAREER NAVIGATION:\nStart: https://www.apple.com/careers/`,
  selectors: {
    searchBox: '#globalnav-menubutton-link-search, //a[normalize-space(.)="Search Roles"], [aria-controls="_r_0__listbox"], [role="combobox"][aria-labelledby="_r_0__label"], //button[normalize-space(.)="Submit"], #_r_0__label',
    locationFilter: '#as-localnav-menustate-open, //a[normalize-space(.)="Local Nav Open Menu"], //a[normalize-space(.)="United States"], .as-localnav-menucta-anchor.as-localnav-menucta-anchor-open, .as-globalfooter-mini-locale-link',
    departmentFilter: '[aria-controls="panel-_r_3_-1"], [aria-selected="false"], //a[normalize-space(.)="Apple and Business"], //a[normalize-space(.)="Shop for Business"], //a[normalize-space(.)="Small Business"], [data-fsb-id="a_small_business_ac_localnav"]',
    jobCards: '//a[normalize-space(.)="Careers at Apple"], [data-fsb-id="a_careers_at_apple_careers_localna"], //a[normalize-space(.)="Career Opportunities"], .as-globalfooter-directory-column-section-link',
    jobTitle: '//a[normalize-space(.)="Mac"], //a[normalize-space(.)="iPad"], //a[normalize-space(.)="iPhone"], //a[normalize-space(.)="Apple Watch"], //a[normalize-space(.)="Apple Vision Pro"], //a[normalize-space(.)="AirPods"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.apple.com/careers/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Click job title to view details'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
