registerSiteGuide({
  site: 'Tesla',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://www.tesla.com/careers',
  patterns: [
    /www\.tesla\.com\/careers/i
  ],
  guidance: `TESLA CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.tesla.com/careers"
  # search and extract
  click e5    # search box
  type e5 "battery engineer"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Tesla","role":"...","location":"...","link":"...","source":"tesla"}\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://www.tesla.com/careers`,
  workflows: {
    searchJobs: [
      'Navigate to https://www.tesla.com/careers',
      'Use generic ATS fallback interaction patterns',
      'Look for search box, location filter, and job listings',
      'Scan results and click into relevant positions'
    ]
  },
  warnings: ['LOW confidence -- selectors may be incomplete or unstable'],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
