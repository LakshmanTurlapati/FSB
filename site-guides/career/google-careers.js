registerSiteGuide({
  site: 'Google Careers',
  category: 'Career & Job Search',
  confidence: 'LOW',
  ats: null,
  careerUrl: 'https://careers.google.com/',
  patterns: [
    /careers\.google\.com/i
  ],
  guidance: `GOOGLE CAREERS CAREER NAVIGATION:\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\nStart: https://careers.google.com/`,
  workflows: {
    searchJobs: [
      'Navigate to https://careers.google.com/',
      'Use generic ATS fallback interaction patterns',
      'Look for search box, location filter, and job listings',
      'Scan results and click into relevant positions'
    ]
  },
  warnings: ['LOW confidence -- selectors may be incomplete or unstable'],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
