/**
 * Site Guide: BuiltIn
 * Per-site guide for BuiltIn tech career platform.
 */

registerSiteGuide({
  site: 'BuiltIn',
  category: 'Career & Job Search',
  patterns: [
    /builtin\.com/i
  ],
  guidance: `BUILTIN-SPECIFIC INTELLIGENCE:

SEARCH:
- Search input: input[name="search"] or input[placeholder*="Search"]
- BuiltIn focuses on tech company job listings
- Clean career page format with jobs listed in card grids
- City-specific pages available (e.g., builtin.com/chicago, builtin.com/nyc)

JOB LISTINGS:
- Job cards: .job-card or [data-id="job-card"]
- Job title: .job-card-title or h2 a
- Company name: .company-name or .job-card-company
- Location: .job-card-location or .location
- Apply button: a[href*="apply"] or .apply-btn

NAVIGATION:
- Filter by location, role type, experience level, and company size
- BuiltIn highlights "Best Places to Work" companies
- Company profiles include culture, benefits, and tech stack info
- Remote job filtering available`,
  selectors: {
    searchBox: 'input[name="search"], input[placeholder*="Search"]',
    jobCards: '.job-card, [data-id="job-card"]',
    jobTitle: '.job-card-title, h2 a',
    company: '.company-name, .job-card-company',
    location: '.job-card-location, .location',
    applyButton: 'a[href*="apply"], .apply-btn'
  },
  workflows: {
    searchJobs: [
      'Navigate to builtin.com',
      'Use the search input to enter job title or keywords',
      'Apply location and role type filters as needed',
      'Wait for job card results to load',
      'Scan job cards for relevant positions',
      'Click into each relevant listing for full details'
    ],
    extractJobData: [
      'Get the job title from .job-card-title',
      'Get the company name from .company-name',
      'Get the location from .job-card-location',
      'Read the job description for a summary',
      'Get the apply link from the apply button href',
      'Verify all 6 required fields are captured'
    ]
  },
  warnings: [
    'BuiltIn is focused on tech companies -- non-tech roles may have limited listings',
    'City-specific subdomains (builtin.com/chicago) show location-filtered results',
    'Some company profiles may require an account to view full details'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
