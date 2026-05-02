registerSiteGuide({
  site: 'Workday ATS',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: 'workday',
  patterns: [
    /myworkdayjobs\.com/i,
    /wd\d+\.myworkday\.com/i
  ],
  guidance: `WORKDAY ATS PLATFORM INTELLIGENCE:

COMMON PATTERNS:
  # search for jobs
  click e5    # search box
  type e5 "software engineer"
  enter
  # browse results
  scroll down
  click e12   # job card/title
  # extract job data
  gettext e15   # job title
  gettext e18   # location
  getattr e20 "href"   # apply link
  storejobdata {"company":"...","role":"...","location":"...","type":"...","link":"...","source":"workday"}

SEARCH:
- searchBox: [data-automation-id="keywordSearchInput"], input[aria-label="Search for jobs"], [data-automation-id="searchBox"]
- locationFilter: [data-automation-id="locationSearchInput"], button[aria-label="Search Location"], [data-automation-id="location"]
- departmentFilter: button[aria-label="Job Category"], [data-automation-id="jobFamilyGroupFilter"]

RESULTS:
- jobCards: [data-automation-id="jobItem"], li[class*="css-"], section[data-automation-id="jobResults"]
- jobTitle: [data-automation-id="jobTitle"], a[data-automation-id="jobTitle"]
- applyButton: a[data-automation-id="applyButton"], [data-automation-id="applyBtn"]
- pagination: [data-automation-id="paginationLabel"], button[aria-label="next"], [data-automation-id="nextPage"]

WORKFLOW:
1. Navigate to career page and wait for Workday SPA to load
2. Enter keywords in search box
3. Apply location filter (click to open dropdown, then click option)
4. Scroll through results
5. Click job card for details
6. Extract job data from detail view`,
  selectors: {
    searchBox: '[data-automation-id="keywordSearchInput"], input[aria-label="Search for jobs"], [data-automation-id="searchBox"]',
    locationFilter: '[data-automation-id="locationSearchInput"], button[aria-label="Search Location"], [data-automation-id="location"]',
    departmentFilter: 'button[aria-label="Job Category"], [data-automation-id="jobFamilyGroupFilter"]',
    jobCards: '[data-automation-id="jobItem"], li[class*="css-"], section[data-automation-id="jobResults"]',
    jobTitle: '[data-automation-id="jobTitle"], a[data-automation-id="jobTitle"]',
    applyButton: 'a[data-automation-id="applyButton"], [data-automation-id="applyBtn"]',
    pagination: '[data-automation-id="paginationLabel"], button[aria-label="next"], [data-automation-id="nextPage"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to Workday career page',
      'Wait for SPA content to fully load',
      'Enter job keywords in search box',
      'Click location filter to open dropdown, then select option',
      'Wait for results to update dynamically',
      'Scroll through job cards',
      'Click job title for detail view',
      'Extract job data from detail page'
    ]
  },
  warnings: [
    'Workday uses complex SPA with data-automation-id attributes -- always use these selectors first',
    'Content loads dynamically -- always wait after navigation or filter changes',
    'Some Workday sites embed content in iframes -- check for iframe boundaries',
    'Dropdown filters require click to open, then click to select option -- two interactions per filter',
    'Pagination may use infinite scroll or numbered pages depending on configuration'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement', 'waitForDOMStable']
});
