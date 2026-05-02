registerSiteGuide({
  site: 'Visa',
  category: 'Career & Job Search',
  confidence: 'MEDIUM',
  ats: null,
  careerUrl: 'https://usa.visa.com/careers.html',
  patterns: [
    /usa\.visa\.com\/careers\.html/i
  ],
  guidance: `VISA CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://usa.visa.com/careers.html"
  # search and extract
  click e5    # job search link
  click e8    # search box
  type e8 "data engineer"
  enter
  click e12   # job result
  gettext e15   # job title
  storejobdata {"company":"Visa","role":"...","location":"...","link":"...","source":"visa"}\nStart: https://usa.visa.com/careers.html`,
  selectors: {
    searchBox: '//a[normalize-space(.)="Job Search"], [aria-label="Job Search (Open in new window)"]',
    jobCards: '[aria-label="Find open job roles,(Open in new window, External Link)"], //a[normalize-space(.)="U.S. Careers"], [aria-label="U.S. Careers"], //a[normalize-space(.)="Students + Early Careers"], [aria-label="Students + Early Careers (Open in new window)"], //a[normalize-space(.)="Careers at Visa"]'
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
