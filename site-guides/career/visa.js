registerSiteGuide({
  site: 'Visa',
  category: 'Career & Job Search',
  confidence: 'MEDIUM',
  ats: null,
  careerUrl: 'https://usa.visa.com/careers.html',
  patterns: [
    /usa\.visa\.com\/careers\.html/i
  ],
  guidance: `VISA CAREER NAVIGATION:\nStart: https://usa.visa.com/careers.html`,
  selectors: {
    searchBox: '//a[normalize-space(.)="Job Search"], [aria-label="Job Search (Open in new window)"]',
    jobCards: '.vs-mb-1.vs-btn, [aria-label="Find open job roles,(Open in new window, External Link)"], //a[normalize-space(.)="U.S. Careers"], [aria-label="U.S. Careers"], //a[normalize-space(.)="Students + Early Careers"], [aria-label="Students + Early Careers (Open in new window)"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://usa.visa.com/careers.html',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Wait for results to load',
      'Scan job cards for relevant positions'
    ]
  },
  warnings: [
    'No apply button detected -- application may redirect to external ATS'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
