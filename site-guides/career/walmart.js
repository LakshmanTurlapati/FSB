registerSiteGuide({
  site: 'Walmart',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://careers.walmart.com/',
  patterns: [
    /careers\.walmart\.com/i
  ],
  guidance: `WALMART CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.walmart.com/"
  # search and extract
  click e5    # search box
  type e5 "store manager"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Walmart","role":"...","location":"...","link":"...","source":"walmart"}\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://careers.walmart.com/`,
  workflows: {
    searchJobs: [
      'Navigate to https://careers.walmart.com/',
      'Use generic ATS fallback interaction patterns',
      'Look for search box, location filter, and job listings',
      'Scan results and click into relevant positions'
    ]
  },
  warnings: ['LOW confidence -- selectors may be incomplete or unstable'],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
