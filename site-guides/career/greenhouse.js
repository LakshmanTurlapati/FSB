registerSiteGuide({
  site: 'Greenhouse ATS',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: 'greenhouse',
  patterns: [
    /boards\.greenhouse\.io/i,
    /grnh\.se/i
  ],
  guidance: `GREENHOUSE ATS PLATFORM INTELLIGENCE:

SEARCH:
- searchBox: input#search-input, [aria-label="Search"], input[placeholder*="Search"]
- locationFilter: select#office-filter, [data-mapped="true"][name="office_id"], #departments-select
- departmentFilter: select#department-filter, [name="department_id"]

RESULTS:
- jobCards: .opening, [class*="job-post"], tr.job-post
- jobTitle: .opening a, [class*="job-post"] a, td.cell-title a
- location: .location, [class*="job-post-location"]
- applyButton: a[href*="/apply"], .btn-apply, #submit-app

WORKFLOW:
1. Navigate to Greenhouse board URL
2. Use department/location dropdowns to filter
3. Scan job cards in listing
4. Click job title for detail page (separate URL)
5. Extract fields from detail page
6. Get apply link from detail page`,
  selectors: {
    searchBox: 'input#search-input, [aria-label="Search"], input[placeholder*="Search"]',
    locationFilter: 'select#office-filter, [data-mapped="true"][name="office_id"], #departments-select',
    departmentFilter: 'select#department-filter, [name="department_id"]',
    jobCards: '.opening, [class*="job-post"], tr.job-post',
    jobTitle: '.opening a, [class*="job-post"] a, td.cell-title a',
    location: '.location, [class*="job-post-location"]',
    applyButton: 'a[href*="/apply"], .btn-apply, #submit-app'
  },
  workflows: {
    searchJobs: [
      'Navigate to Greenhouse board URL',
      'Use department dropdown to filter by team',
      'Use location dropdown to filter by office',
      'Scan job card list for relevant positions',
      'Click job title link for detail page',
      'Extract job data from detail page',
      'Get apply link from detail page'
    ]
  },
  warnings: [
    'Greenhouse boards are simple HTML pages, not SPAs -- standard DOM interaction works',
    'Job detail pages are separate URLs -- clicking a job title navigates away from the listing',
    'Apply links redirect to multi-step application forms',
    'Some boards use custom styling that overrides default Greenhouse selectors',
    'Department and location filters are native select elements -- use selectOption tool'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement', 'selectOption']
});
