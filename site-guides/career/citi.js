registerSiteGuide({
  site: 'Citi',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://careers.citi.com/',
  patterns: [
    /careers\.citi\.com/i
  ],
  guidance: `CITI CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.citi.com/"
  # search and extract
  click e5    # search box
  type e5 "risk analyst"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Citi","role":"...","location":"...","link":"...","source":"citi"}\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://careers.citi.com/`,
  workflows: {
    searchJobs: [
      'Navigate to https://careers.citi.com/',
      'Use generic ATS fallback interaction patterns',
      'Look for search box, location filter, and job listings',
      'Scan results and click into relevant positions'
    ]
  },
  warnings: ['LOW confidence -- selectors may be incomplete or unstable'],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
