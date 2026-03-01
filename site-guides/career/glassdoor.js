registerSiteGuide({
  site: 'Glassdoor',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.glassdoor.com',
  patterns: [
    /glassdoor\.(com|co\.\w+)/i
  ],
  guidance: `GLASSDOOR NAVIGATION:

COMMON PATTERNS:
  # search for jobs
  click e5    # keyword search box
  type e5 "UX designer"
  click e8    # location field
  type e8 "Austin"
  enter
  # extract from results
  click e12   # job card
  gettext e15   # job title
  gettext e18   # company
  storejobdata {"company":"...","role":"...","location":"...","link":"...","source":"glassdoor"}\nCombines job listings with company reviews and salary data.\nKeyword + location search fields.\nMay require login for full job descriptions.\nSalary estimates are Glassdoor estimates, not guaranteed.`,
  selectors: {
    searchBox: '#sc\\.keyword, input[name="sc.keyword"]',
    locationBox: '#sc\\.location, input[name="sc.location"]',
    jobCards: '.JobCard, [data-test="job-listing"]',
    jobTitle: '.JobCard-title, [data-test="job-title"]',
    company: '.EmployerProfile, [data-test="employer-name"]',
    location: '[data-test="emp-location"]',
    datePosted: '[data-test="job-age"], .listing-age',
    applyButton: '.apply-button, [data-test="apply-button"]',
    resultsContainer: '.JobsList, [data-test="job-list"]',
    pagination: '.pagination, [data-test="pagination"], button[aria-label="Next"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to glassdoor.com',
      'Enter job keywords in keyword search field',
      'Enter location in location search field',
      'Submit search',
      'Wait for results to load',
      'Scan .JobCard elements for relevant positions',
      'Click into each relevant listing for full details'
    ],
    extractJobData: [
      'Get job title from .JobCard-title',
      'Get company name from .EmployerProfile',
      'Get location from [data-test="emp-location"]',
      'Get date posted from [data-test="job-age"]',
      'Check for salary estimate if visible',
      'Get apply link from apply button',
      'Verify all 6 fields captured'
    ]
  },
  warnings: [
    'May require login for full job descriptions or apply',
    'May use iframes for job details -- try direct job URL if content inaccessible',
    'Salary estimates are Glassdoor estimates, not guaranteed',
    'Pop-ups and sign-in prompts may appear -- dismiss to continue'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
