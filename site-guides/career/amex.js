registerSiteGuide({
  site: 'American Express',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://aexpcareers.com/',
  patterns: [
    /aexpcareers\.com/i
  ],
  guidance: `AMERICAN EXPRESS CAREER NAVIGATION:\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://aexpcareers.com/`,
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
