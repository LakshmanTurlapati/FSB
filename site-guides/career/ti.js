registerSiteGuide({
  site: 'Texas Instruments',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.ti.com/',
  patterns: [
    /careers\.ti\.com/i
  ],
  guidance: `TEXAS INSTRUMENTS CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.ti.com/"
  # search and extract
  click e5    # search box
  type e5 "embedded systems engineer"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Texas Instruments","role":"...","location":"...","link":"...","source":"ti"}\nStart: https://careers.ti.com/`,
  selectors: {
    searchBox: '[aria-controls="suggestions-keywords"], [aria-label="Find jobs and events"], //button[normalize-space(.)="Near Location"], [aria-label="You\'ve selected the Near Location search mode."], [aria-label="Search for Jobs and Events"], [aria-controls="suggestions-locations"]',
    locationFilter: '//label[normalize-space(.)="City, state, country"], .oj-helper-hidden-accessible',
    jobCards: '[aria-label="All Jobs 359"], [aria-controls="sortMenu"], [aria-label="Sort By Posting Date"], [aria-label="Add Job to My Job Selections"], //label[normalize-space(.)="Posting Date"], [data-fsb-id="a_main"]',
    applyButton: '//button[normalize-space(.)="Next"], [aria-label="Next"], //button[normalize-space(.)="Cancel"], [aria-label="Cancel"]',
    pagination: '[aria-label="Go to Home Page"], .app-header__logo.app-header__logo--desktop'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.ti.com/',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
