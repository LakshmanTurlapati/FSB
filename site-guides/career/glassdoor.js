/**
 * Site Guide: Glassdoor
 * Per-site guide for Glassdoor job search and company review platform.
 */

registerSiteGuide({
  site: 'Glassdoor',
  category: 'Career & Job Search',
  patterns: [
    /glassdoor\.(com|co\.\w+)/i
  ],
  guidance: `GLASSDOOR-SPECIFIC INTELLIGENCE:

SEARCH:
- Keyword search: #sc\\.keyword or input[name="sc.keyword"]
- Location search: #sc\\.location or input[name="sc.location"]
- Glassdoor combines job listings with company reviews and salary data

JOB LISTINGS:
- Job cards use .JobCard or [data-test="job-listing"] containers
- Job title: .JobCard-title or [data-test="job-title"]
- Company name: .EmployerProfile or [data-test="employer-name"]
- Location: [data-test="emp-location"]
- Apply button: .apply-button or [data-test="apply-button"]
- Some listings show salary estimates from Glassdoor data

NAVIGATION:
- Glassdoor may require login for full job descriptions
- Company pages show reviews, salaries, interviews, and benefits tabs
- Job details may use iframes -- if content is not accessible, try the direct job URL
- Salary data is a key differentiator -- extract salary ranges when visible`,
  selectors: {
    searchBox: '#sc\\.keyword, input[name="sc.keyword"]',
    locationBox: '#sc\\.location, input[name="sc.location"]',
    jobCards: '.JobCard, [data-test="job-listing"]',
    jobTitle: '.JobCard-title, [data-test="job-title"]',
    company: '.EmployerProfile, [data-test="employer-name"]',
    location: '[data-test="emp-location"]',
    applyButton: '.apply-button, [data-test="apply-button"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to glassdoor.com',
      'Enter job title or keywords in the keyword search field',
      'Enter location in the location search field',
      'Submit the search',
      'Wait for job listing results to load',
      'Scan .JobCard elements for relevant positions',
      'Click into each relevant listing for full details'
    ],
    extractJobData: [
      'Get the job title from .JobCard-title or [data-test="job-title"]',
      'Get the company name from .EmployerProfile',
      'Get the location from [data-test="emp-location"]',
      'Check for salary estimate if visible',
      'Read the job description summary',
      'Get the apply link from the apply button',
      'Verify all 6 required fields are captured'
    ]
  },
  warnings: [
    'Glassdoor may require login to see full job descriptions or apply',
    'Glassdoor may use iframes for job details -- if content is not accessible, try the direct job URL',
    'Salary estimates shown by Glassdoor are estimates, not guaranteed -- note this when reporting',
    'Pop-ups and sign-in prompts may appear frequently -- dismiss them to continue browsing'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
