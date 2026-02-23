registerSiteGuide({
  site: 'Home Depot',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.homedepot.com/',
  patterns: [
    /careers\.homedepot\.com/i
  ],
  guidance: `HOME DEPOT CAREER NAVIGATION:\nStart: https://careers.homedepot.com/`,
  selectors: {
    searchBox: '.fusion-button.button-flat, input[type="text"][placeholder="Example\\:35X"], .searchlnk.gu-wht1, .location-search-type-label, .search-results-title, #cws_quickjobsearch_keywords',
    locationFilter: '.control-label, .fusion-modal-text-link.locationtype-info, .radius-label.location-radius-control, .growunder.gu-org1, #zip, [name="zip"]',
    departmentFilter: '.sf-label-checkbox, #sf-input-9f3ba36895cbd6d1e71071ca1abe04aa, [name="_sft_portfolio_category\\[\\]"], #sf-input-10bbeeaa27ef44e58de1323749c31b16, #sf-input-7de761dfc38ef23758399d423383a729, [data-fsb-id="label_storescashiers_sales_presentation"]',
    jobCards: '.awb-menu__main-a.awb-menu__main-a_regular, .alert-link, .capjob, .fusion-button.button-flat, .leaflet-container.leaflet-retina, .growunder.gu-wht1',
    applyButton: '//a[normalize-space(.)="Apply"], [aria-label="Apply opens in new tab"]',
    pagination: '//a[normalize-space(.)="homepage"], [data-fsb-id="a_homepage_content"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.homedepot.com/',
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
