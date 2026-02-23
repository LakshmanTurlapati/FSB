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
    searchBox: '.search-icon, .hyper-link.anchor-9, .hyper-link, [data-fsb-id="button_cws_primary_nav"], [data-fsb-id="a_research_research_cmp_secondary_n"], [aria-label="JPMorganChase Institute Research Topics "]',
    locationFilter: '.hyper-link.anchor-9, [aria-label="Global locations"]',
    departmentFilter: '.primary-link, .hyper-link.anchor-9, //a[normalize-space(.)="Join our team"], [aria-label="Join our team open in new window"], //a[normalize-space(.)="How we do business"], [data-fsb-id="a_business_growth_and__cmp_primary_foo"]',
    jobCards: '.primary-link, .header-link, .hyper-link.anchor-9, .hyper-link, //a[normalize-space(.)="Careers and skills"], //a[normalize-space(.)="Careers"]',
    pagination: '.iconAnchor.small, .hyper-link.anchor-9, [aria-label="Company Logo and link to home page"], [data-fsb-id="a_company_logo_and_link_to_home__cws_primary_nav"], [aria-label="Next Slide"], [aria-label="Previous Slide"]'
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
