registerSiteGuide({
  site: 'Meta',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.metacareers.com/',
  patterns: [
    /www\.metacareers\.com/i
  ],
  guidance: `META CAREER NAVIGATION:\nStart: https://www.metacareers.com/`,
  selectors: {
    searchBox: '.xjbqb8w.x1lliihq, input[type="text"][placeholder="Search\\ by\\ technology\\,\\ team\\,\\ location\\,\\ or\\ ref\\.code"], .x1lliihq.x1r8uery, [aria-label="Search all results"], [role="button"], //label[normalize-space(.)="Search"]',
    locationFilter: '.x1i10hfl.x1qjc9v5, [role="link"]',
    jobCards: '//a[normalize-space(.)="View all jobs at Meta"], [role="link"], [aria-expanded="false"], [aria-label="Bookmark this job"], [role="button"], //a[normalize-space(.)="View jobs and internships"]',
    pagination: '[aria-label="Open login page"], [role="button"], [aria-label="Next slide"], [aria-label="Previous slide"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.metacareers.com/',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Use pagination to view additional results'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
