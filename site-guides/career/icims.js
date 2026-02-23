registerSiteGuide({
  site: 'iCIMS ATS',
  category: 'Career & Job Search',
  confidence: 'MEDIUM',
  ats: 'icims',
  patterns: [
    /icims\.com/i,
    /jobs-.*\.icims\.com/i,
    /careers-.*\.icims\.com/i
  ],
  guidance: `ICIMS ATS PLATFORM INTELLIGENCE:

SEARCH:
- searchBox: input#iCIMS_Keyword, input[name="keyword"], [aria-label="Keyword search"]
- locationFilter: input#iCIMS_Location, input[name="location"], select[name="location"]
- departmentFilter: select#iCIMS_Category, select[name="category"]

RESULTS:
- jobCards: .iCIMS_JobsTable tr, .iCIMS_MainJobList .row, [class*="JobResult"]
- jobTitle: .iCIMS_JobTitle a, [class*="JobTitle"] a, h2.iCIMS_JobTitle
- location: .iCIMS_JobLocation, [class*="JobLocation"]
- applyButton: a[href*="apply"], .iCIMS_ApplyOnlineLink, [class*="ApplyButton"]
- pagination: .iCIMS_Paginator a, [class*="pagination"], a[title="Next Page"]

WORKFLOW:
1. Navigate to iCIMS portal
2. Enter keywords in search box
3. Apply location/category filters
4. Submit search form
5. Scan results table
6. Click job title for detail page
7. Extract fields from detail page`,
  selectors: {
    searchBox: 'input#iCIMS_Keyword, input[name="keyword"], [aria-label="Keyword search"]',
    locationFilter: 'input#iCIMS_Location, input[name="location"], select[name="location"]',
    departmentFilter: 'select#iCIMS_Category, select[name="category"]',
    jobCards: '.iCIMS_JobsTable tr, .iCIMS_MainJobList .row, [class*="JobResult"]',
    jobTitle: '.iCIMS_JobTitle a, [class*="JobTitle"] a, h2.iCIMS_JobTitle',
    location: '.iCIMS_JobLocation, [class*="JobLocation"]',
    applyButton: 'a[href*="apply"], .iCIMS_ApplyOnlineLink, [class*="ApplyButton"]',
    pagination: '.iCIMS_Paginator a, [class*="pagination"], a[title="Next Page"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to iCIMS portal URL',
      'Enter job keywords in search box',
      'Apply location and category filters',
      'Submit search form (click search button or press Enter)',
      'Wait for full page reload with results',
      'Scan results table for relevant positions',
      'Click job title for detail page',
      'Extract job data from detail page'
    ]
  },
  warnings: [
    'iCIMS uses server-side rendering with form-based navigation -- search triggers full page reload',
    'Search requires explicit form submission, not AJAX -- wait for page load after submit',
    'Multi-step application forms -- each step is a separate page load',
    'Some iCIMS portals embed job listings in iframes',
    'Category and location filters may be select dropdowns or text inputs depending on configuration'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
