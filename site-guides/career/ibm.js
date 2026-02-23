registerSiteGuide({
  site: 'IBM',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.ibm.com/careers/',
  patterns: [
    /www\.ibm\.com\/careers/i
  ],
  guidance: `IBM CAREER NAVIGATION:\nStart: https://www.ibm.com/careers/`,
  selectors: {
    searchBox: '.bx--label, .ibmdocs-searchbar-magnifier, .action-btn.cds--btn, .action-btn-wrapper, .sk-search-box__action, .bx--card-group__card',
    locationFilter: '//button[normalize-space(.)="Location"], [aria-controls="accordion-item-5"]',
    departmentFilter: '.cds--link.cds--tile, .bx--card-group__card, .sk-item-list-option.sk-item-list__item, [data-fsb-id="a_ibm_cloud_pak_for_bu_docs_cards_sect"], //a[normalize-space(.)="Explore by product area"], [data-fsb-id="a_explore_by_product_a"]',
    jobCards: '.cmp-breadcrumb__item-link, //a[normalize-space(.)="Explore all roles"], [data-fsb-id="a_explore_all_roles"], //a[normalize-space(.)="See your results"], [data-fsb-id="a_see_your_results_list"], [aria-label="careers-ambient-video (0:13 min)"]',
    jobTitle: '.masthead-l1-title.masthead-l1-link, //a[normalize-space(.)="Downloads"], [role="menuitem"], //a[normalize-space(.)="Documentation"], //a[normalize-space(.)="Cases"], //a[normalize-space(.)="Monitoring"]',
    pagination: '[data-fsb-id="select_main"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.ibm.com/careers/',
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
