registerSiteGuide({
  site: 'Capital One',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.capitalonecareers.com/',
  patterns: [
    /www\.capitalonecareers\.com/i
  ],
  guidance: `CAPITAL ONE CAREER NAVIGATION:\nStart: https://www.capitalonecareers.com/`,
  selectors: {
    searchBox: '.search-button, .footer-top__link, .link-directional, .hub-item__link, //button[normalize-space(.)="Search Jobs"], [aria-expanded="true"]',
    locationFilter: '.footer-top__link, //button[normalize-space(.)="Locations"], [aria-expanded="false"], //a[normalize-space(.)="United States"], #city-toggle, //a[normalize-space(.)="60303514304\n\n                 "]',
    departmentFilter: '.footer-top__link, .hub-item__link, //a[normalize-space(.)="Teams"], #category-toggle, //button[normalize-space(.)="Teams"], [data-fsb-id="a_a_tech_career_built__content"]',
    jobCards: '.navigation__link, .search-results-intro__button, .link-directional, .in-page-nav__link, .footer-top__link, //button[normalize-space(.)="Explore Jobs"]',
    jobTitle: '#disclosure-btn-1, [aria-controls="disclosure-content-1"]',
    applyButton: '.disclosure--toggle-all, //label[normalize-space(.)="You’re interested in"], [data-fsb-id="label_youre_interested_in_search_jobs"], #nav-anchor-apply, //a[normalize-space(.)="Applying 101"], [data-fsb-id="button_expand_allcollapse_a_fs_12"]',
    pagination: '.slick-next.slick-arrow, .slick-prev.slick-arrow, .in-page-nav__link, //button[normalize-space(.)="Next"], //button[normalize-space(.)="Previous"], //a[normalize-space(.)="Benefits"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.capitalonecareers.com/',
      'Dismiss cookie banner if present',
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
