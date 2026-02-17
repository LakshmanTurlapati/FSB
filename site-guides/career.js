/**
 * Site Guide: Career & Job Search
 * Covers company career pages, Indeed, Glassdoor, BuiltIn, LinkedIn Jobs,
 * Handshake, WorkAtAStartup, and other job board sites.
 * Provides guidance for job search, data extraction, and structured entry into Google Sheets.
 */

const CAREER_GUIDE = {
  name: 'Career & Job Search',

  patterns: [
    /\/careers\/?/i,
    /\/jobs\/?/i,
    /\/career\/?/i,
    /\/job-openings\/?/i,
    /\/open-positions\/?/i,
    /\/work-with-us\/?/i,
    /\/join-us\/?/i,
    /indeed\.com/i,
    /glassdoor\.(com|co\.\w+)/i,
    /builtin\.com/i,
    /workatastartup\.com/i,
    /linkedin\.com\/jobs/i,
    /handshake\.com/i,
    /lever\.co/i,
    /greenhouse\.io/i,
    /ashbyhq\.com/i,
    /myworkdayjobs\.com/i,
    /icims\.com/i,
    /jobvite\.com/i
  ],

  guidance: `CAREER & JOB SEARCH INTELLIGENCE:

STRATEGY PRIORITY -- ALWAYS follow this order:
1. DIRECT COMPANY CAREER PAGE (PRIMARY): Navigate to [company].com/careers or [company].com/jobs first.
   - Google search: "[company name] careers" or "[company name] jobs"
   - Click the OFFICIAL company careers link (not Indeed/Glassdoor mirrors)
   - Company career pages have the most accurate, up-to-date listings
2. THIRD-PARTY JOB BOARDS (FALLBACK ONLY): Use Indeed, Glassdoor, BuiltIn, LinkedIn Jobs only if:
   - The company does not have a direct careers page
   - The direct careers page has no relevant listings
   - The user explicitly requests a specific job board

REQUIRED DATA FIELDS (extract ALL 6 for each job):
1. Company Name -- the employer
2. Role/Title -- exact job title as listed
3. Date Posted -- when the listing was posted (or "Not listed" if unavailable)
4. Location -- city/state, "Remote", or "Hybrid"
5. Description Summary -- 1-2 sentence summary of the role responsibilities
6. Apply Link -- the direct URL to apply (copy from browser address bar or href)

SEARCH & FILTER WORKFLOW:
- Look for search/filter inputs on career pages (role, location, department)
- Type the relevant search term (e.g., "software engineer", "product manager")
- Apply location filters if the user specified a location
- Scroll through results to find matching positions
- Click into individual job listings to extract full details

RELEVANCE FILTERING:
- If user says "find jobs at [company]" with no role specified, extract the first 3-5 listings
- If user specifies a role (e.g., "software engineer jobs"), only extract matching roles
- Skip internships unless explicitly requested
- Skip roles that are clearly unrelated to the search term

DATA EXTRACTION TECHNIQUE:
- Use getText on job title elements to get exact role names
- Use getText on location/date elements for metadata
- Use getAttribute with "href" on apply buttons/links to get apply URLs
- Summarize the job description from the first paragraph or key responsibilities
- If date posted is not visible, check for relative dates ("2 days ago", "1 week ago")

SITE-SPECIFIC NOTES:
- Indeed: Job cards use .job_seen_beacon or .resultContent containers
- Glassdoor: Job listings behind .JobCard containers; may require login for full details
- BuiltIn: Clean career page format; jobs listed in card grids
- LinkedIn: Requires login for most features; use only as last resort
- Lever/Greenhouse/Ashby: Common ATS platforms used by startups; clean job listing format
- Workday: Complex iframe-based interface; may need to interact with dropdowns carefully`,

  selectors: {
    indeed: {
      searchBox: '#text-input-what, input[name="q"]',
      locationBox: '#text-input-where, input[name="l"]',
      searchButton: 'button[type="submit"], .yosegi-InlineWhatWhere-primaryButton',
      jobCards: '.job_seen_beacon, .resultContent, .jobsearch-ResultsList .result',
      jobTitle: '.jobTitle a, .jcs-JobTitle',
      company: '.companyName, [data-testid="company-name"]',
      location: '.companyLocation, [data-testid="text-location"]',
      datePosted: '.date, [data-testid="myJobsStateDate"]',
      applyButton: '.jobsearch-IndeedApplyButton, [data-testid="indeedApplyButton"]'
    },
    glassdoor: {
      searchBox: '#sc\\.keyword, input[name="sc.keyword"]',
      locationBox: '#sc\\.location, input[name="sc.location"]',
      jobCards: '.JobCard, [data-test="job-listing"]',
      jobTitle: '.JobCard-title, [data-test="job-title"]',
      company: '.EmployerProfile, [data-test="employer-name"]',
      location: '[data-test="emp-location"]',
      applyButton: '.apply-button, [data-test="apply-button"]'
    },
    builtin: {
      searchBox: 'input[name="search"], input[placeholder*="Search"]',
      jobCards: '.job-card, [data-id="job-card"]',
      jobTitle: '.job-card-title, h2 a',
      company: '.company-name, .job-card-company',
      location: '.job-card-location, .location',
      applyButton: 'a[href*="apply"], .apply-btn'
    },
    generic: {
      searchBox: 'input[type="search"], input[placeholder*="Search"], input[name*="search"], input[name*="keyword"]',
      jobCards: '[class*="job-card"], [class*="job-listing"], [class*="position-card"], [class*="opening"]',
      jobTitle: '[class*="job-title"], [class*="position-title"], h2 a, h3 a',
      location: '[class*="location"], [class*="job-location"]',
      applyButton: 'a[href*="apply"], button[class*="apply"], [class*="apply-btn"]'
    }
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
    thirdPartySearch: [
      'Navigate to the job board (Indeed, Glassdoor, etc.)',
      'Enter the company name and role in the search fields',
      'Set the location filter if specified',
      'Search and wait for results',
      'Scan results for relevant positions',
      'Click into each relevant job listing',
      'Extract all 6 required fields from each listing',
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
      'Verify all 6 fields are captured',
      'Move to the next relevant listing',
      'After collecting all data, proceed to Google Sheets entry if requested'
    ]
  },

  warnings: [
    'Sponsored/promoted job listings appear first on Indeed and Glassdoor -- skip unless no organic results match',
    'Many job boards require login to see full job descriptions or apply -- note when auth walls appear',
    'Do NOT construct company career URLs from guesswork (e.g., stripe.com/careers) -- always Google search first to find the actual careers page',
    'Glassdoor may use iframes for job details -- if content is not accessible, try the direct job URL',
    'LinkedIn Jobs requires authentication -- use only as a last resort and warn user about login requirement',
    'Workday career sites use complex iframe navigation -- interact with dropdown menus carefully',
    'Job listings may have expired -- check the date posted and note if a listing seems old',
    'Some career pages are single-page apps (React/Angular) that load dynamically -- wait for content after navigation',
    'Job descriptions can be very long -- summarize to 1-2 sentences focusing on key responsibilities',
    'Apply links may redirect to external ATS (Lever, Greenhouse, Workday) -- capture the final destination URL'
  ],

  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'openNewTab', 'switchToTab', 'waitForElement']
};

registerSiteGuide(CAREER_GUIDE);
