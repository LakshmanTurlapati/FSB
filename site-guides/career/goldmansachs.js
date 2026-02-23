registerSiteGuide({
  site: 'Goldman Sachs',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.goldmansachs.com/careers/',
  patterns: [
    /www\.goldmansachs\.com\/careers/i
  ],
  guidance: `GOLDMAN SACHS CAREER NAVIGATION:\nStart: https://www.goldmansachs.com/careers/`,
  selectors: {
    searchBox: 'input[type="text"][placeholder="Search\\ by\\ Role\\,\\ Skill\\,\\ or\\ Business"], [name="searchValue"], //a[normalize-space(.)="What We Do"], [aria-expanded="false"]',
    locationFilter: '.gs-uitk-c-1ojzahj--button-root.gs-button, //a[normalize-space(.)="See Office Locations"]',
    departmentFilter: '.gs-input-group-button.gs-button, .gs-link.gs-uitk-c-kom84d--link-root--link-anchor--category-header-link-list-link, .gs-link.gs-uitk-c-h0rt87--link-root--link-anchor--category-header-share-link, .gs-link.gs-uitk-c-ubw1si--link-root--link-anchor--link-group-link-style, [data-fsb-id="button_searchform"], //a[normalize-space(.)="Financial Documents"]',
    jobCards: '.gs-link.gs-uitk-c-1hrsm82--link-root--link-anchor, .gs-uitk-c-9lrr8l--button-root.gs-button, //a[normalize-space(.)="Careers"], [aria-expanded="false"], [data-fsb-id="a_2025_fourth_quarter_"], #button_491109909',
    pagination: '.react-player__preview, [aria-label="Go to Goldman Sachs Home Page"], [role="button"], [aria-label="Play"], [data-testid="gs-media-player__preview-play-icon"], [data-fsb-id="div_presentation"]'
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
