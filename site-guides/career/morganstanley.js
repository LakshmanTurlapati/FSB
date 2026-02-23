registerSiteGuide({
  site: 'Morgan Stanley',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.morganstanley.com/people',
  patterns: [
    /www\.morganstanley\.com\/people/i
  ],
  guidance: `MORGAN STANLEY CAREER NAVIGATION:\nStart: https://www.morganstanley.com/people`,
  selectors: {
    searchBox: '.search-control, .tile.tile-2x2, .tile.tile-1x2, .msaw-header-search-control, [aria-label="Search Bar"], //a[normalize-space(.)="What We Do"]',
    locationFilter: '//a[normalize-space(.)="Region"], [aria-expanded="false"]',
    departmentFilter: '.cmp-storycard__link, .subcategory_firstBlueCtaButton, //a[normalize-space(.)="Experienced Professionals"], [aria-label="Experienced Professionals"], [data-fsb-id="a_strategies_to_financ"], //a[normalize-space(.)="Find a Financial Advisor"]',
    jobCards: '.cmp-storycard__link, .msaw-top-nav-item-role.employer, //a[normalize-space(.)="Careers"], [aria-expanded="false"], [data-fsb-id="a_jean_hynes_dig_deep_"], //a[normalize-space(.)="For Employees"]',
    jobTitle: '.cmp-storycard__link.cmp-storycard__titleLink, //a[normalize-space(.)="AI’s Impact Accelerates"], [aria-label="AI’s Impact Accelerates"], [aria-label="2026 Stock Market Outlook: The Bull Market Still Has Room to Run"]',
    applyButton: '.practicehero_firstWhiteCtaButton.type-cta, .practicehero_secondWhiteCtaButton.type-cta, [data-fsb-id="a_startups_apply_here_"], [data-fsb-id="a_nonprofits_apply_her"]',
    pagination: '.cmp_articleheader_page_topic, .page-article.article, //a[normalize-space(.)="Outlooks"], //a[normalize-space(.)="Insights"], [role="article"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.morganstanley.com/people',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Click job title to view details',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
