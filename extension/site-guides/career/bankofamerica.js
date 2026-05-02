registerSiteGuide({
  site: 'Bank of America',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.bankofamerica.com/',
  patterns: [
    /careers\.bankofamerica\.com/i
  ],
  guidance: `BANK OF AMERICA CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.bankofamerica.com/"
  # search and extract
  click e5    # search box
  type e5 "financial analyst"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Bank of America","role":"...","location":"...","link":"...","source":"bankofamerica"}\nStart: https://careers.bankofamerica.com/`,
  selectors: {
    searchBox: '//button[normalize-space(.)="Search jobs"], [aria-controls="subnav-0"], #standalone_for-students, [aria-label="For students - Job Search"], #menu-item-What\\ we\\ do, //a[normalize-space(.)="What we do"]',
    locationFilter: '#Regions-tab1-tabpanel-1, [role="tabpanel"][aria-labelledby="tab1"], #locat, //button[normalize-space(.)="Location"]',
    departmentFilter: '[aria-label="Small business opens in a new window"], [aria-label="Businesses & institutions opens in a new window"], #standalone_for-professionals, //a[normalize-space(.)="For professionals"], #crprt, [aria-controls="prgrms-crprt-tabpanel-2"]',
    jobCards: '[aria-label="Bank of America Careers Homepage"], #standalone_find-your-opportunity, //a[normalize-space(.)="Find your opportunity"], #prgrms-bnkng-tabpanel-1, [role="tabpanel"][aria-labelledby="bnkng"], [data-fsb-id="a_real_estate_syndicat_maincontentstar"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.bankofamerica.com/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
