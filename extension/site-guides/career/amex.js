registerSiteGuide({
  site: 'American Express',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://aexpcareers.com/',
  patterns: [
    /aexpcareers\.com/i
  ],
  guidance: `AMERICAN EXPRESS CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://aexpcareers.com/"
  # search and extract
  click e5    # search box
  type e5 "product manager"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"American Express","role":"...","location":"...","link":"...","source":"amex"}\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://aexpcareers.com/`,
  workflows: {
    searchJobs: [
      'Navigate to https://aexpcareers.com/',
      'Use generic ATS fallback interaction patterns',
      'Look for search box, location filter, and job listings',
      'Scan results and click into relevant positions'
    ]
  },
  warnings: ['LOW confidence -- selectors may be incomplete or unstable'],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
