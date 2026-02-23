registerSiteGuide({
  site: 'NVIDIA',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.nvidia.com/en-us/about-nvidia/careers/',
  patterns: [
    /www\.nvidia\.com\/en-us/i
  ],
  guidance: `NVIDIA CAREER NAVIGATION:\nStart: https://www.nvidia.com/en-us/about-nvidia/careers/`,
  selectors: {
    searchBox: '.menu-level-1, .nv-menu-button.menu-level-1, [aria-label="Search NVIDIA"], #nv-search-box, [role="none"], //a[normalize-space(.)="What\'s New"]',
    locationFilter: '[aria-expanded="false"], [aria-label="Country Selector"]',
    departmentFilter: '.subnav-category, #sub-btn0, #sub-btn1, //a[normalize-space(.)="Meet our Teams"]',
    jobCards: '.sub-brand-link.dropdown-toggle, .breadcrumb-page-link.cta, #career-hero-cta, //a[normalize-space(.)="Find Your Next Job"], //a[normalize-space(.)="Careers"], #sub-btn1',
    jobTitle: '[aria-expanded="false"], [role="menuitem"]',
    pagination: '//a[normalize-space(.)="Next Steps"], [data-fsb-id="a_next_steps"], //button[normalize-space(.)="Next"], [aria-label="Next"], //button[normalize-space(.)="Previous"], [aria-label="Previous"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.nvidia.com/en-us/about-nvidia/careers/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Click job title to view details',
      'Use pagination to view additional results'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
