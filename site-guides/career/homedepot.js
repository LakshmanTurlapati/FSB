registerSiteGuide({
  site: 'Home Depot',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.homedepot.com/',
  patterns: [
    /careers\.homedepot\.com/i
  ],
  guidance: `HOME DEPOT CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.homedepot.com/"
  # search and extract
  click e5    # search box
  type e5 "store associate"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Home Depot","role":"...","location":"...","link":"...","source":"homedepot"}\nStart: https://careers.homedepot.com/`,
  selectors: {
    searchBox: '#cws_quickjobsearch_keywords, [aria-label="Keyword"], #cws_quickjobsearch_location, [name="location"], //a[normalize-space(.)="Search FOR HOURLY ROLES"], //a[normalize-space(.)="SEARCH REMOTE ROLES"]',
    locationFilter: '#zip, [name="zip"], //label[normalize-space(.)="Zip*"], //a[normalize-space(.)="Privacy & Security Statement"], [aria-label="Privacy & Security Statement opens in new tab"], //a[normalize-space(.)="Associate Privacy Statement"]',
    departmentFilter: '#sf-input-9f3ba36895cbd6d1e71071ca1abe04aa, [name="_sft_portfolio_category\\[\\]"], #sf-input-10bbeeaa27ef44e58de1323749c31b16, #sf-input-7de761dfc38ef23758399d423383a729, [data-fsb-id="label_storescashiers_sales_presentation"], //label[normalize-space(.)="Job Category"]',
    jobCards: '//a[normalize-space(.)="NOW HIRING FOR HOURLY JOBSSear"], [data-fsb-id="a_now_hiring_for_hourl_content"], //a[normalize-space(.)="Shop Jobs"], //a[normalize-space(.)="careers.homedepot.com"], //a[normalize-space(.)="careerdepot.homedepot.com"], //a[normalize-space(.)="sales specialist"]',
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
