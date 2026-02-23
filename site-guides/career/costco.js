registerSiteGuide({
  site: 'Costco',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.costco.com/jobs.html',
  patterns: [
    /www\.costco\.com\/jobs\.html/i
  ],
  guidance: `COSTCO CAREER NAVIGATION:\nStart: https://www.costco.com/jobs.html`,
  selectors: {
    searchBox: '#search-field, [aria-label="Search"], //a[normalize-space(.)="What\'s New"], [aria-label="Search Costco"], [role="combobox"][aria-describedby="typeahead-search-field-description"], [data-testid="SearchButton"]',
    locationFilter: '//button[normalize-space(.)="19707"], [aria-label=" ZIP Code 19707, current delivery location"], #Home_Ancillary_10, //a[normalize-space(.)="Locations"], #country-select, [aria-expanded="false"]',
    departmentFilter: '#Home_Ancillary_3, //a[normalize-space(.)="Business Delivery"], #show_more_category, [data-testid="Button"], #attributes\\.category_info, //button[normalize-space(.)="Category"]',
    jobCards: '//a[normalize-space(.)="Costco Career FAQs"], //a[normalize-space(.)="Why Costco"], [aria-label="Learn more about why costco is a great place to work"], //a[normalize-space(.)="Careers"], [aria-label="Learn more about our careers"], //a[normalize-space(.)="Our Values"]',
    applyButton: '//a[normalize-space(.)="Apply Now"], .btn-block.eco-job-cta-apply',
    pagination: '//a[normalize-space(.)="Costco Next"], [aria-label="Next promo"], [data-testid="NextButton"], [aria-label="Previous promo"], [data-testid="PrevButton"], #mapFocus'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.costco.com/jobs.html',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
