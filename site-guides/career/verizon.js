registerSiteGuide({
  site: 'Verizon',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.verizon.com/about/careers/',
  patterns: [
    /www\.verizon\.com\/about/i
  ],
  guidance: `VERIZON CAREER NAVIGATION:\nStart: https://www.verizon.com/about/careers/`,
  selectors: {
    searchBox: '#js-main-search-field, [aria-label="job titles, skills and keywords"], #js-quick-job-search, //button[normalize-space(.)="Explore Jobs"], //label[normalize-space(.)="Search Jobs"], #gnav20-search-icon',
    locationFilter: '[aria-controls="radix-_R_aladlfkeivb_"], [role="combobox"], //button[normalize-space(.)="Locations"], [aria-controls="radix-_R_3eceivb_-content-radix-_R_8receivb_"], //label[normalize-space(.)="Location:"], [aria-label="Get it fast | Enter your location"]',
    departmentFilter: '//button[normalize-space(.)="Life at Verizon"], [aria-controls="radix-_R_3eceivb_-content-radix-_R_4receivb_"], //button[normalize-space(.)="Career Paths"], [aria-controls="radix-_R_3eceivb_-content-radix-_R_6receivb_"], #gnav20-eyebrow-link-Business, [aria-label="Verizon Business Services HomePage"]',
    jobCards: '//a[normalize-space(.)="Go to saved jobs0"], //a[normalize-space(.)="Verizon Careers"], //a[normalize-space(.)="Careers"], //a[normalize-space(.)="Jobs"], #gnav20-eyebrow-link-Careers, [aria-label="Verizon Careers Services HomePage"]',
    jobTitle: '#acc-item-1859-label, [aria-controls="acc-item-1859"], #acc-item-31-label, [aria-controls="acc-item-31"]',
    pagination: '#gnav20-eyebrow-link-About-Us, [aria-label="Verizon About Us Services HomePage"], [aria-label="next promo message 2 of 2"], #gnav20-eyebrow-link-Personal, [aria-label="Verizon Personal Services HomePage"], [aria-label="previous promo message 2 of 2"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.verizon.com/about/careers/',
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
