registerSiteGuide({
  site: 'Boeing',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://jobs.boeing.com/',
  patterns: [
    /jobs\.boeing\.com/i
  ],
  guidance: `BOEING CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://jobs.boeing.com/"
  # search and extract
  click e5    # search box
  type e5 "aerospace engineer"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Boeing","role":"...","location":"...","link":"...","source":"boeing"}\nStart: https://jobs.boeing.com/`,
  selectors: {
    searchBox: '#search-location-7065cf89f2, [name="l"], #search-keyword-7065cf89f2, [name="k"], //a[normalize-space(.)="Find U.S. Contract Jobs"], #search-submit-7065cf89f2',
    locationFilter: '[aria-controls="tablist-benefits"], [aria-label="select benefits tab"], #country-toggle, //button[normalize-space(.)="Country"], #region-toggle, //button[normalize-space(.)="State"]',
    departmentFilter: '//a[normalize-space(.)="#TeamBoeing"], [data-fsb-id="a_teamboeing_main"]',
    jobCards: '//button[normalize-space(.)="Careers"], [aria-controls="header-nav__careers-sub-menu-container"], //a[normalize-space(.)="0 Saved Jobs"], #tab-panel-us-benefits, [role="tabpanel"][aria-labelledby="tab-us-benefits"], //a[normalize-space(.)="View all entry-level jobs"]',
    applyButton: '#faq_faq-toggle_s1_q3, [aria-controls="faq_s1_q3"], //button[normalize-space(.)="Apply Filter"], .hub-filter__button',
    pagination: '[data-fsb-id="button_play_video_pursue_yo_content"], .text-column-and-media__video-btn'
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
