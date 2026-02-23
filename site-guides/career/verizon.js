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
    searchBox: '.pl-1.mb-0, .Button__Button-dtMRoO.styled__SearchButton-kUSFql, .vz-text-link, #js-main-search-field, [aria-label="job titles, skills and keywords"], #js-quick-job-search',
    locationFilter: '.pl-1.mb-0, .u-colorPrimary.u-marginTop--md20, .u-fontText.u-text--xs12, [aria-controls="radix-_R_aladlfkeivb_"], [role="combobox"], //button[normalize-space(.)="Locations"]',
    departmentFilter: '.vz-text-link, //button[normalize-space(.)="Life at Verizon"], [aria-controls="radix-_R_3eceivb_-content-radix-_R_4receivb_"], //button[normalize-space(.)="Career Paths"], [aria-controls="radix-_R_3eceivb_-content-radix-_R_6receivb_"], #gnav20-eyebrow-link-Business',
    jobCards: '.inline-flex.items-center, .ring-transparent.focus-visible\\:outline, .block.text-black, .data-\\[active\\=true\\]\\:focus\\:bg-accent.data-\\[active\\=true\\]\\:hover\\:bg-accent, .gnav20-bubble-position, //a[normalize-space(.)="Go to saved jobs0"]',
    jobTitle: '#acc-item-1859-label, [aria-controls="acc-item-1859"], #acc-item-31-label, [aria-controls="acc-item-31"]',
    pagination: '.gnav20-slide-arrow.gnav20-slide-arrow-next, .gnav20-slide-arrow.gnav20-slide-arrow-prev, .slick-next.slick-arrow, #gnav20-eyebrow-link-About-Us, [aria-label="Verizon About Us Services HomePage"], [aria-label="next promo message 2 of 2"]'
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
