/**
 * Site Guide: Generic Career / ATS Platforms
 * Per-site guide for generic career pages and common ATS platforms
 * (Lever, Greenhouse, Ashby, Workday, iCIMS, Jobvite).
 */

registerSiteGuide({
  site: 'Generic Career / ATS',
  category: 'Career & Job Search',
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
  guidance: `GENERIC CAREER / ATS PLATFORM INTELLIGENCE:

COMMON ATS PLATFORMS:
- Lever (lever.co): Clean job listing format, single-page application forms
- Greenhouse (greenhouse.io): Structured job boards with department/location filters
- Ashby (ashbyhq.com): Modern job board with search and filtering
- Workday (myworkdayjobs.com): Complex iframe-based interface with dropdown menus
- iCIMS (icims.com): Enterprise ATS with multi-step application forms
- Jobvite (jobvite.com): Social recruiting platform with referral features

SEARCH & NAVIGATION:
- Generic search: input[type="search"], input[placeholder*="Search"], input[name*="search"], input[name*="keyword"]
- Most career pages have search/filter inputs for role, location, and department
- Look for department/team filters to narrow results
- Some pages use URL parameters for filtering (e.g., ?department=engineering)

JOB LISTINGS:
- Cards: [class*="job-card"], [class*="job-listing"], [class*="position-card"], [class*="opening"]
- Title: [class*="job-title"], [class*="position-title"], h2 a, h3 a
- Location: [class*="location"], [class*="job-location"]
- Apply: a[href*="apply"], button[class*="apply"], [class*="apply-btn"]

WORKDAY-SPECIFIC:
- Workday uses complex iframe-based navigation
- Interact with dropdown menus carefully
- Job listings load dynamically -- wait for content after each interaction`,
  selectors: {
    searchBox: 'input[type="search"], input[placeholder*="Search"], input[name*="search"], input[name*="keyword"]',
    jobCards: '[class*="job-card"], [class*="job-listing"], [class*="position-card"], [class*="opening"]',
    jobTitle: '[class*="job-title"], [class*="position-title"], h2 a, h3 a',
    location: '[class*="location"], [class*="job-location"]',
    applyButton: 'a[href*="apply"], button[class*="apply"], [class*="apply-btn"]'
  },
  workflows: {
    directCompanySearch: [
      'Search Google for "[company name] careers" or "[company name] jobs"',
      'Click on the OFFICIAL company careers page link (not Indeed/Glassdoor)',
      'Once on the career page, look for search/filter functionality',
      'Enter the role keyword if the user specified one',
      'Apply location filter if specified',
      'Scroll through job listings to find relevant positions',
      'Click into each relevant job to extract all 6 required fields',
      'Collect data for 3-5 most relevant positions'
    ],
    jobDataExtraction: [
      'Identify the job title element and extract exact text',
      'Identify the company name (may be in header or breadcrumb)',
      'Find the location information (city/state/remote)',
      'Find the date posted (check for relative dates like "2 days ago")',
      'Read the first paragraph or key responsibilities for description summary',
      'Get the apply button/link href for the apply URL',
      'If on a listing page, use the current URL as the apply link',
      'Verify all 6 fields are captured'
    ]
  },
  warnings: [
    'Do NOT construct company career URLs from guesswork (e.g., stripe.com/careers) -- always Google search first to find the actual careers page',
    'Workday career sites use complex iframe navigation -- interact with dropdown menus carefully',
    'Some career pages are single-page apps (React/Angular) that load dynamically -- wait for content after navigation',
    'Apply links may redirect to external ATS (Lever, Greenhouse, Workday) -- capture the final destination URL',
    'LinkedIn Jobs requires authentication -- use only as a last resort and warn user about login requirement'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'openNewTab', 'switchToTab', 'waitForElement']
});
