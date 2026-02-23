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
    searchBox: '.globalnav-link.globalnav-link-search, .localnav-menu-link.large-nav, .form-icons.form-icons-search15, .form-textbox-input.rf-pnf-search-input, .form-textbox-label, #globalnav-menubutton-link-search',
    locationFilter: '.as-localnav-menucta-anchor.as-localnav-menucta-anchor-open, .as-globalfooter-mini-locale-link, #as-localnav-menustate-open, //a[normalize-space(.)="Local Nav Open Menu"], //a[normalize-space(.)="United States"]',
    departmentFilter: '.as-globalfooter-directory-column-section-link, [aria-controls="panel-_r_3_-1"], [aria-selected="false"], //a[normalize-space(.)="Apple and Business"], //a[normalize-space(.)="Shop for Business"], //a[normalize-space(.)="Small Business"]',
    jobCards: '.as-globalfooter-directory-column-section-link, //a[normalize-space(.)="Careers at Apple"], [data-fsb-id="a_careers_at_apple_careers_localna"], //a[normalize-space(.)="Career Opportunities"]',
    jobTitle: '.rf-productnav-card-title, .localnav-title, //a[normalize-space(.)="Mac"], //a[normalize-space(.)="iPad"], //a[normalize-space(.)="iPhone"], //a[normalize-space(.)="Apple Watch"]'
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
