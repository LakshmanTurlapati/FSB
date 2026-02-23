registerSiteGuide({
  site: 'Indeed',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.indeed.com',
  patterns: [
    /indeed\.com/i
  ],
  guidance: `INDEED NAVIGATION:\nSearch has two fields: "What" (keywords) and "Where" (location).\nClear "Where" before typing new location (may have default).\nSponsored listings appear first -- skip unless no organic results match.\nSome job details open in side panel rather than new page.`,
  selectors: {
    searchBox: '#text-input-what, input[name="q"]',
    locationBox: '#text-input-where, input[name="l"]',
    searchButton: 'button[type="submit"], .yosegi-InlineWhatWhere-primaryButton',
    jobCards: '.job_seen_beacon, .resultContent, .jobsearch-ResultsList .result',
    jobTitle: '.jobTitle a, .jcs-JobTitle',
    company: '.companyName, [data-testid="company-name"]',
    location: '.companyLocation, [data-testid="text-location"]',
    datePosted: '.date, [data-testid="myJobsStateDate"]',
    applyButton: '.jobsearch-IndeedApplyButton, [data-testid="indeedApplyButton"]',
    resultsContainer: '.jobsearch-ResultsList, #mosaic-jobResults',
    pagination: 'nav[aria-label="pagination"], a[data-testid="pagination-page-next"], .css-1jg5dlr'
  },
  workflows: {
    searchJobs: [
      'Navigate to indeed.com',
      'Enter job keywords in the "What" field',
      'Clear and enter location in the "Where" field',
      'Click search button or press Enter',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Click into each relevant listing for full details'
    ],
    extractJobData: [
      'Get job title from .jobTitle a',
      'Get company name from .companyName',
      'Get location from .companyLocation',
      'Get date posted from .date element',
      'Read first paragraph of job description',
      'Get apply link from apply button href',
      'Verify all 6 fields captured'
    ]
  },
  warnings: [
    'Sponsored/promoted listings appear first -- skip unless no organic results match',
    'Some job details open in side panel -- check both layouts',
    'Indeed may require login to apply -- note auth walls',
    'Clear "Where" field before typing new location'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
