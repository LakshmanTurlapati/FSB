registerSiteGuide({
  site: 'Boeing',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://jobs.boeing.com/',
  patterns: [
    /jobs\.boeing\.com/i
  ],
  guidance: `BOEING CAREER NAVIGATION:\nStart: https://jobs.boeing.com/`,
  selectors: {
    searchBox: '.search-form__find-contract-jobs-link, #search-location-7065cf89f2, [name="l"], #search-keyword-7065cf89f2, [name="k"], //a[normalize-space(.)="Find U.S. Contract Jobs"]',
    locationFilter: '[aria-controls="tablist-benefits"], [aria-label="select benefits tab"], #country-toggle, //button[normalize-space(.)="Country"], #region-toggle, //button[normalize-space(.)="State"]',
    departmentFilter: '//a[normalize-space(.)="#TeamBoeing"], [data-fsb-id="a_teamboeing_main"]',
    jobCards: '.recently-viewed-job-list.header-nav__saved-jobs-link, .heading-and-body-text__button-link, .hub-filter__select, .recently-viewed-job-list__view-all-jobs-link, .search-results__job-link, .primary-btn--lg--transparent-boeing-blue',
    applyButton: '.hub-filter__button, #faq_faq-toggle_s1_q3, [aria-controls="faq_s1_q3"], //button[normalize-space(.)="Apply Filter"]',
    pagination: '.text-column-and-media__video-btn, [data-fsb-id="button_play_video_pursue_yo_content"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://jobs.boeing.com/',
      'Dismiss cookie banner if present',
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
