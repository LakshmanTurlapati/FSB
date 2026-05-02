registerSiteGuide({
  site: 'OpenAI',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://openai.com/careers',
  patterns: [
    /openai\.com\/careers/i
  ],
  guidance: `OPENAI CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://openai.com/careers"
  # browse and extract
  scroll down
  click e5    # job listing
  gettext e8    # job title
  gettext e10   # location
  storejobdata {"company":"OpenAI","role":"...","location":"...","link":"...","source":"openai"}\nStart: https://openai.com/careers`,
  selectors: {
    searchBox: '[aria-label="Open Search"], [aria-label="Close Search"], //a[normalize-space(.)="Research Index"], //a[normalize-space(.)="Research Overview"], //a[normalize-space(.)="Research Residency"], #\\31 VETmSyUHHLzJufUMpS9VS',
    locationFilter: '[aria-label="logo HP Electric Blue keyline RGB, intuit logo, state farm logo, thermofisher-black@2x, Logo > Oracle grayscale, uber, BBVA logo SVG, cisco-black@2x, t-mobile wordmark"], [role="group"]',
    departmentFilter: '[data-fsb-id="div_main"], #WzE4sz68FtsmgR3O7Ckjt, [aria-label="Deepening our collaboration with the U.S. Department of Energy - Global Affairs - Dec 18, 2025"], [data-fsb-id="div_gap_lg"], [data-fsb-id="div_container"], [aria-label="Open modal"]',
    jobCards: '//a[normalize-space(.)="Careers"], //a[normalize-space(.)="View open roles"], .transition.ease-curve-a, .transition.duration-short',
    pagination: '[aria-label="Play audio of page text"], .text-primary-100.bg-primary-4'
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
