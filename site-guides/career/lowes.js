registerSiteGuide({
  site: 'Lowe\'s',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://jobs.lowes.com/',
  patterns: [
    /jobs\.lowes\.com/i
  ],
  guidance: `LOWE'S CAREER NAVIGATION:\nStart: https://jobs.lowes.com/`,
  selectors: {
    searchBox: '//a[normalize-space(.)="Search & Apply"], [aria-label="Search & Apply"]',
    locationFilter: '//button[normalize-space(.)="Where You Work"], [aria-expanded="false"]',
    jobCards: '//button[normalize-space(.)="Career Growth"], [aria-expanded="false"]',
    applyButton: '//a[normalize-space(.)="Apply Status"], [aria-label="Apply Status"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://jobs.lowes.com/',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
