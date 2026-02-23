registerSiteGuide({
  site: 'BuiltIn',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.builtin.com',
  patterns: [
    /builtin\.com/i
  ],
  guidance: `BUILTIN NAVIGATION:\nTech company job listings with card grid layout.\nCity-specific pages available (builtin.com/chicago, builtin.com/nyc).\nFilters: location, role type, experience level, company size.\nRemote job filtering available.`,
  selectors: {
    searchBox: 'input[name="search"], input[placeholder*="Search"]',
    jobCards: '.job-card, [data-id="job-card"]',
    jobTitle: '.job-card-title, h2 a',
    company: '.company-name, .job-card-company',
    location: '.job-card-location, .location',
    datePosted: '.job-card-date, [class*="date-posted"], time',
    applyButton: 'a[href*="apply"], .apply-btn',
    resultsContainer: '.jobs-list, [class*="job-results"], [class*="job-list"]',
    pagination: '.pagination, a[rel="next"], button[class*="next"], [aria-label="Next page"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to builtin.com',
      'Enter job keywords in search input',
      'Apply location and role type filters as needed',
      'Wait for job card results to load',
      'Scan job cards for relevant positions',
      'Click into each relevant listing for full details'
    ],
    extractJobData: [
      'Get job title from .job-card-title',
      'Get company name from .company-name',
      'Get location from .job-card-location',
      'Get date posted if visible',
      'Read job description for summary',
      'Get apply link from apply button href',
      'Verify all 6 fields captured'
    ]
  },
  warnings: [
    'Focused on tech companies -- non-tech roles may have limited listings',
    'City-specific subdomains show location-filtered results',
    'Some company profiles may require account for full details'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
