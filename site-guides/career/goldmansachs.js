registerSiteGuide({
  site: 'Goldman Sachs',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.goldmansachs.com/careers/',
  patterns: [
    /www\.goldmansachs\.com\/careers/i
  ],
  guidance: `GOLDMAN SACHS CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.goldmansachs.com/careers/"
  # search and extract
  click e5    # search box
  type e5 "investment banking analyst"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Goldman Sachs","role":"...","location":"...","link":"...","source":"goldmansachs"}\nStart: https://www.goldmansachs.com/careers/`,
  selectors: {
    searchBox: '[name="searchValue"], //a[normalize-space(.)="What We Do"], [aria-expanded="false"], input[type="text"][placeholder="Search\\ by\\ Role\\,\\ Skill\\,\\ or\\ Business"]',
    locationFilter: '//a[normalize-space(.)="See Office Locations"], .gs-uitk-c-1ojzahj--button-root.gs-button',
    departmentFilter: '[data-fsb-id="button_searchform"], //a[normalize-space(.)="Financial Documents"], //a[normalize-space(.)="Press Releases"], //a[normalize-space(.)="Corporate Governance"], //a[normalize-space(.)="Creditor Information"], //a[normalize-space(.)="Presentations"]',
    jobCards: '//a[normalize-space(.)="Careers"], [aria-expanded="false"], [data-fsb-id="a_2025_fourth_quarter_"], #button_491109909, .gs-link.gs-uitk-c-1hrsm82--link-root--link-anchor, .gs-uitk-c-9lrr8l--button-root.gs-button',
    pagination: '[aria-label="Go to Goldman Sachs Home Page"], [role="button"], [aria-label="Play"], [data-testid="gs-media-player__preview-play-icon"], [data-fsb-id="div_presentation"], .react-player__preview'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.goldmansachs.com/careers/',
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
