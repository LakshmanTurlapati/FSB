registerSiteGuide({
  site: 'Mastercard',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.mastercard.com/',
  patterns: [
    /careers\.mastercard\.com/i
  ],
  guidance: `MASTERCARD CAREER NAVIGATION:\nStart: https://careers.mastercard.com/`,
  selectors: {
    searchBox: '[aria-controls="typehead-listbox"], [aria-owns="typehead-listbox"], #ph-search-backdrop, [aria-label="Search"], //label[normalize-space(.)="Search job title"], //a[normalize-space(.)="​​​​​​​See what we\'re made of"]',
    locationFilter: '[aria-controls="gllocationListbox"], [aria-owns="gllocationListbox"], //label[normalize-space(.)="Location"], .sr-only',
    departmentFilter: '[aria-label="0 Saved jobs"], //a[normalize-space(.)="five specialized service areas"], [aria-label="consulting specializations"], .phs-job-cart-area',
    jobCards: '[aria-label="View jobs"], [role="link"], //button[normalize-space(.)="Browse jobs"], [aria-expanded="false"], //a[normalize-space(.)="Jump to AI jobs"], [aria-label="Jump to AI jobs"]',
    applyButton: '//a[normalize-space(.)="Apply to student opportunities"], [aria-label="Apply to student opportunities"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.mastercard.com/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
