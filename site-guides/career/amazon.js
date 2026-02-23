registerSiteGuide({
  site: 'Amazon',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.amazon.jobs/',
  patterns: [
    /www\.amazon\.jobs/i
  ],
  guidance: `AMAZON CAREER NAVIGATION:\nStart: https://www.amazon.jobs/`,
  selectors: {
    searchBox: '._button_n1mfs_1, .card-wrapper_root__AfvuQ.card-wrapper_link__HME9X, [aria-controls="search_typeahead-homepage-listbox-2stkayz"], [role="combobox"][aria-labelledby="search_typeahead-homepage-label"], #search-button, [role="button"][aria-labelledby="search-button-label"]',
    locationFilter: '.card.rounded, .card-wrapper_root__AfvuQ.card-wrapper_link__HME9X, [aria-controls="location-typeahead-homepage-listbox-iaen4ix"], [role="combobox"][aria-labelledby="location-typeahead-homepage-label"], [data-fsb-id="a_locationssee_where_a"], [aria-controls="location-typeahead-homepage-listbox-hroqq4y"]',
    departmentFilter: '.card.rounded, .card-wrapper_root__AfvuQ.card-wrapper_link__HME9X, [data-fsb-id="a_teamsget_to_know_ama"], //a[normalize-space(.)="Amazon Business"], [data-fsb-id="a_business_and_corpora_business_and_co"], [data-fsb-id="a_customer_experience__customer_experi"]',
    jobCards: '.card.rounded, .navbar-brand.mt-2, .dropdown-toggle.enriched-profile, ._wrapper_ehm1a_5, .card-wrapper_root__AfvuQ.card-wrapper_link__HME9X, .hero-content-module_eyebrow__7bNew.hero-content-module_dark__XOKyK',
    pagination: '[aria-label="Explore"], [role="button"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.amazon.jobs/',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Use pagination to view additional results'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
