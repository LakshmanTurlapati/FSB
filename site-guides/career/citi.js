registerSiteGuide({
  site: 'Citi',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://careers.citi.com/',
  patterns: [
    /careers\.citi\.com/i
  ],
  guidance: `CITI CAREER NAVIGATION:\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://careers.citi.com/`,
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
