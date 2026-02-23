registerSiteGuide({
  site: 'JPMorgan Chase',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.jpmorganchase.com/careers',
  patterns: [
    /www\.jpmorganchase\.com\/careers/i
  ],
  guidance: `JPMORGAN CHASE CAREER NAVIGATION:\nStart: https://www.jpmorganchase.com/careers`,
  selectors: {
    searchBox: '[data-fsb-id="button_cws_primary_nav"], [data-fsb-id="a_research_research_cmp_secondary_n"], [aria-label="JPMorganChase Institute Research Topics "], .search-icon, .hyper-link.anchor-9, .hyper-link',
    locationFilter: '[aria-label="Global locations"], .hyper-link.anchor-9',
    departmentFilter: '//a[normalize-space(.)="Join our team"], [aria-label="Join our team open in new window"], //a[normalize-space(.)="How we do business"], [data-fsb-id="a_business_growth_and__cmp_primary_foo"], [aria-label="Business growth"], .primary-link',
    jobCards: '//a[normalize-space(.)="Careers and skills"], //a[normalize-space(.)="Careers"], [data-fsb-id="a_careers_careers_cmp_secondary_n"], [aria-label="Careers and skills"], [aria-label="Careers"], //a[normalize-space(.)="Learn more"]',
    pagination: '[aria-label="Company Logo and link to home page"], [data-fsb-id="a_company_logo_and_link_to_home__cws_primary_nav"], [aria-label="Next Slide"], [aria-label="Previous Slide"], [aria-label="opens gold suppliers page"], .iconAnchor.small'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.jpmorganchase.com/careers',
      'Dismiss cookie banner if present',
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
