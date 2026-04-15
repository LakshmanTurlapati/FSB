registerSiteGuide({
  site: 'Lever ATS',
  category: 'Career & Job Search',
  confidence: 'MEDIUM',
  ats: 'lever',
  patterns: [
    /jobs\.lever\.co/i,
    /lever\.co\//i
  ],
  guidance: `LEVER ATS PLATFORM INTELLIGENCE:

COMMON PATTERNS:
  # browse job listings (Lever has no search box)
  scroll down
  click e5    # department filter
  click e8    # department option
  click e12   # job posting title
  # extract job data
  gettext e15   # job title
  gettext e18   # location
  getattr e20 "href"   # apply link
  storejobdata {"company":"...","role":"...","location":"...","type":"...","link":"...","source":"lever"}

FILTERS:
- departmentFilter: .filter [data-department], .sort-by-dept, [class*="department"]
- locationFilter: .filter [data-location], .sort-by-location, [class*="location"]

RESULTS:
- jobCards: .posting, [data-qa="posting-name"], .posting-title
- jobTitle: .posting-title, .posting-name, h5 a
- location: .posting-categories .location, .sort-by-location
- applyButton: a[href*="/apply"], .posting-btn-submit, [data-qa="btn-apply"]

WORKFLOW:
1. Navigate to Lever board URL
2. Optionally filter by department or location
3. Scan posting list (all jobs shown on single page)
4. Click posting title for detail page
5. Extract fields from detail page
6. Get apply link`,
  selectors: {
    departmentFilter: '.filter [data-department], .sort-by-dept, [class*="department"]',
    locationFilter: '.filter [data-location], .sort-by-location, [class*="location"]',
    jobCards: '.posting, [data-qa="posting-name"], .posting-title',
    jobTitle: '.posting-title, .posting-name, h5 a',
    location: '.posting-categories .location, .sort-by-location',
    applyButton: 'a[href*="/apply"], .posting-btn-submit, [data-qa="btn-apply"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to Lever board URL',
      'Optionally filter by department or location',
      'Scroll through posting list (all jobs on single page)',
      'Click posting title for detail page',
      'Extract job data from detail page',
      'Get apply link from detail page'
    ]
  },
  warnings: [
    'Lever boards show all positions on a single page -- no pagination needed',
    'Job detail pages are separate URLs -- clicking a title navigates away',
    'Apply forms are multi-step -- each step loads in the same page',
    'Lever boards typically lack a search box -- use department/location filters instead',
    'Some companies customize Lever board styling extensively'
  ],
  toolPreferences: ['navigate', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
