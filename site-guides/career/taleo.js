registerSiteGuide({
  site: 'Taleo ATS',
  category: 'Career & Job Search',
  confidence: 'MEDIUM',
  ats: 'taleo',
  patterns: [
    /taleo\.net/i,
    /oracle.*taleo/i,
    /taleo.*oracle/i
  ],
  guidance: `TALEO ATS PLATFORM INTELLIGENCE:

SEARCH:
- searchBox: input#ftlKeywordSearch, input[name="keyword"], [aria-label="Search Keyword"]
- locationFilter: select#ftlLocation, select[name="location"], [id*="locationInput"]
- departmentFilter: select#ftlCategory, select[name="category"]

RESULTS:
- jobCards: .requisition, tr.requisitionListItem, [class*="requisitionList"] tr
- jobTitle: .requisitionListTitle a, [class*="reqTitle"] a, td.colTitle a
- location: .requisitionListLocation, td.colLocation
- applyButton: a[href*="apply"], .applyButton, [class*="applyLink"]
- pagination: .paginationLabel, a.next, [class*="pagingLink"]

WORKFLOW:
1. Navigate to Taleo portal URL
2. Enter search keyword
3. Select location from dropdown
4. Click Search button
5. Wait for page reload
6. Scan requisition list
7. Click job title for detail page
8. Extract fields from detail page`,
  selectors: {
    searchBox: 'input#ftlKeywordSearch, input[name="keyword"], [aria-label="Search Keyword"]',
    locationFilter: 'select#ftlLocation, select[name="location"], [id*="locationInput"]',
    departmentFilter: 'select#ftlCategory, select[name="category"]',
    jobCards: '.requisition, tr.requisitionListItem, [class*="requisitionList"] tr',
    jobTitle: '.requisitionListTitle a, [class*="reqTitle"] a, td.colTitle a',
    location: '.requisitionListLocation, td.colLocation',
    applyButton: 'a[href*="apply"], .applyButton, [class*="applyLink"]',
    pagination: '.paginationLabel, a.next, [class*="pagingLink"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to Taleo portal URL',
      'Enter search keyword in keyword field',
      'Select location from dropdown filter',
      'Click Search button to submit',
      'Wait for full page reload with results',
      'Scan requisition list for relevant positions',
      'Click job title for detail page',
      'Extract job data from detail page'
    ]
  },
  warnings: [
    'Taleo is an older Oracle ATS with server-rendered pages -- full page reloads after each interaction',
    'Always wait for page load after clicking Search or navigating to a job detail',
    'Some Taleo portals redirect through Oracle login -- note auth walls when encountered',
    'Dropdown filters may require selecting from pre-populated option lists -- use selectOption tool',
    'Requisition list uses table layout -- job data is in table cells, not card elements'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement', 'selectOption']
});
