registerSiteGuide({
  site: 'IBM',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.ibm.com/careers/',
  patterns: [
    /www\.ibm\.com\/careers/i
  ],
  guidance: `IBM CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.ibm.com/careers/"
  # search and extract
  click e5    # search box
  type e5 "cloud architect"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"IBM","role":"...","location":"...","link":"...","source":"ibm"}\nStart: https://www.ibm.com/careers/`,
  selectors: {
    searchBox: '#search__input-22, [role="searchbox"], #search__input__search-22, [aria-label="Search"], #ibmdocs-searchbar, #ibmdocs-searchbar-search',
    locationFilter: '//button[normalize-space(.)="Location"], [aria-controls="accordion-item-5"]',
    departmentFilter: '[data-fsb-id="a_ibm_cloud_pak_for_bu_docs_cards_sect"], //a[normalize-space(.)="Explore by product area"], [data-fsb-id="a_explore_by_product_a"], #search-result-1bda42dd9cac2789aece198c682fc3c03d5b362fbe6788a0407388298681a064-dp0, #search-result-a07d5be429a369a05547cca1d30c7e677d93d9631c5dd76772b4996af530181f-dp1, #search-result-47c3125b479c9f3ed955a4471f054769013c019bab4beb58b0d898d30291cb4c-dp2',
    jobCards: '//a[normalize-space(.)="Explore all roles"], [data-fsb-id="a_explore_all_roles"], //a[normalize-space(.)="See your results"], [data-fsb-id="a_see_your_results_list"], [aria-label="careers-ambient-video (0:13 min)"], [data-fsb-id="c4d-video-player_careers_ambient_video_013_min"]',
    jobTitle: '//a[normalize-space(.)="Downloads"], [role="menuitem"], //a[normalize-space(.)="Documentation"], //a[normalize-space(.)="Cases"], //a[normalize-space(.)="Monitoring"], //a[normalize-space(.)="Manage support account"]',
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
