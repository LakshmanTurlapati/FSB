registerSiteGuide({
  site: 'OpenAI',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://openai.com/careers',
  patterns: [
    /openai\.com\/careers/i
  ],
  guidance: `OPENAI CAREER NAVIGATION:\nStart: https://openai.com/careers`,
  selectors: {
    searchBox: '.transition.duration-200, .transition.ease-curve-a, .transition.duration-short, [aria-label="Open Search"], [aria-label="Close Search"], //a[normalize-space(.)="Research Index"]',
    locationFilter: '[aria-label="logo HP Electric Blue keyline RGB, intuit logo, state farm logo, thermofisher-black@2x, Logo > Oracle grayscale, uber, BBVA logo SVG, cisco-black@2x, t-mobile wordmark"], [role="group"]',
    departmentFilter: '.group.relative, .mt-xs.bg-primary-4, .transition.duration-short, .transition.ease-curve-a, [data-fsb-id="div_main"], #WzE4sz68FtsmgR3O7Ckjt',
    jobCards: '.transition.ease-curve-a, .transition.duration-short, //a[normalize-space(.)="Careers"], //a[normalize-space(.)="View open roles"]',
    pagination: '.text-primary-100.bg-primary-4, [aria-label="Play audio of page text"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://openai.com/careers',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
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
