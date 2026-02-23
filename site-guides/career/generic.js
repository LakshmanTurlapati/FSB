registerSiteGuide({
  site: 'Generic Career / ATS',
  category: 'Career & Job Search',
  confidence: 'MEDIUM',
  ats: null,
  careerUrl: null,
  patterns: [
    /\/careers\/?/i,
    /\/jobs\/?/i,
    /\/career\/?/i,
    /\/job-openings\/?/i,
    /\/open-positions\/?/i,
    /\/work-with-us\/?/i,
    /\/join-us\/?/i,
    /workatastartup\.com/i,
    /handshake\.com/i,
    /lever\.co/i,
    /greenhouse\.io/i,
    /ashbyhq\.com/i,
    /myworkdayjobs\.com/i,
    /icims\.com/i,
    /jobvite\.com/i
  ],
  guidance: `GENERIC CAREER FALLBACK:\nThis guide matches when no company-specific or ATS-specific guide applies.\nFor known ATS platforms, dedicated guides exist: Workday (workday.js), Greenhouse (greenhouse.js), Lever (lever.js), iCIMS (icims.js), Taleo (taleo.js).\nWorkflow: search box -> enter keywords -> apply filters -> scan listings -> extract job data.`,
  selectors: {
    searchBox: 'input[type="search"], input[placeholder*="Search"], input[name*="search"], input[name*="keyword"]',
    jobCards: '[class*="job-card"], [class*="job-listing"], [class*="position-card"], [class*="opening"]',
    jobTitle: '[class*="job-title"], [class*="position-title"], h2 a, h3 a',
    location: '[class*="location"], [class*="job-location"]',
    applyButton: 'a[href*="apply"], button[class*="apply"], [class*="apply-btn"]',
    resultsContainer: '[class*="results"], [class*="openings"], [class*="listings"], [id*="results"]',
    pagination: '[class*="pagination"], a[rel="next"], button[class*="next"], [aria-label="Next"]'
  },
  workflows: {
    directCompanySearch: [
      'Search Google for "[company name] careers" or "[company name] jobs"',
      'Click on the OFFICIAL company careers page link (not Indeed/Glassdoor)',
      'Look for search/filter functionality on the career page',
      'Enter role keyword if specified',
      'Apply location filter if specified',
      'Scroll through job listings for relevant positions',
      'Click into each relevant job to extract all 6 required fields'
    ],
    jobDataExtraction: [
      'Extract job title text',
      'Identify company name (header or breadcrumb)',
      'Find location (city/state/remote)',
      'Find date posted (check relative dates like "2 days ago")',
      'Read first paragraph for description summary',
      'Get apply button/link href for apply URL',
      'Verify all 6 fields captured'
    ]
  },
  warnings: [
    'Do NOT construct company career URLs from guesswork -- always Google search first',
    'Some career pages are SPAs that load dynamically -- wait for content after navigation',
    'Apply links may redirect to external ATS -- capture the final destination URL'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'openNewTab', 'switchToTab', 'waitForElement']
});
