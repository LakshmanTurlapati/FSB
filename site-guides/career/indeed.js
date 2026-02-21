/**
 * Site Guide: Indeed
 * Per-site guide for Indeed job search platform.
 */

registerSiteGuide({
  site: 'Indeed',
  category: 'Career & Job Search',
  patterns: [
    /indeed\.com/i
  ],
  guidance: `INDEED-SPECIFIC INTELLIGENCE:

SEARCH:
- Search box has two fields: "What" (job title/keywords) and "Where" (location)
- "What" field: #text-input-what or input[name="q"]
- "Where" field: #text-input-where or input[name="l"]
- Search button: button[type="submit"] or .yosegi-InlineWhatWhere-primaryButton
- Clear the "Where" field before typing a new location (it may have a default)

JOB LISTINGS:
- Job cards use .job_seen_beacon or .resultContent or .jobsearch-ResultsList .result containers
- Job title link: .jobTitle a or .jcs-JobTitle (click to see full description)
- Company name: .companyName or [data-testid="company-name"]
- Location: .companyLocation or [data-testid="text-location"]
- Date posted: .date or [data-testid="myJobsStateDate"]
- Apply button: .jobsearch-IndeedApplyButton or [data-testid="indeedApplyButton"]

NAVIGATION:
- Sponsored/promoted listings appear at the top -- skip unless no organic results match
- Pagination controls at the bottom of results
- Use scroll to load more results if the page uses infinite scrolling
- Some job details open in a side panel rather than a new page`,
  selectors: {
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
  workflows: {
    searchJobs: [
      'Navigate to indeed.com',
      'Enter the job title or keywords in the "What" field',
      'Enter the location in the "Where" field (clear first if pre-filled)',
      'Click the search button or press Enter',
      'Wait for search results to load',
      'Scan job cards for relevant positions',
      'Click into each relevant listing for full details'
    ],
    extractJobData: [
      'Identify the job title from .jobTitle a or .jcs-JobTitle',
      'Get the company name from .companyName',
      'Get the location from .companyLocation',
      'Check the date posted from .date element',
      'Read the first paragraph of the job description for summary',
      'Get the apply link from the apply button href',
      'Verify all 6 required fields are captured'
    ]
  },
  warnings: [
    'Sponsored/promoted job listings appear first -- skip unless no organic results match',
    'Some job details open in a side panel rather than a new page -- check both layouts',
    'Indeed may require login to apply -- note when auth walls appear',
    'The "Where" field may have a default location -- clear it before typing a new one'
  ],
  toolPreferences: ['navigate', 'searchGoogle', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
