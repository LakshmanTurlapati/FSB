registerSiteGuide({
  site: 'Deloitte',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: 'workday',
  careerUrl: 'https://www.deloitte.com/global/en/careers.html',
  patterns: [
    /www\.deloitte\.com\/global/i
  ],
  guidance: `DELOITTE CAREER NAVIGATION:\nStart: https://www.deloitte.com/global/en/careers.html\nATS: workday`,
  selectors: {
    searchBox: '.cmp-header__primary-nav-link, #search-button, [aria-label="Search"], //a[normalize-space(.)="Search Deloitte jobs"], [data-fsb-id="a_search_deloitte_jobs_main"], //a[normalize-space(.)="What we do"]',
    departmentFilter: '.cmp-promo-tracking, //a[normalize-space(.)="Deloitte Private global report"], [data-fsb-id="a_deloitte_private_glo_main"], [data-fsb-id="a_climate_governance_i_main"], [data-fsb-id="a_gartner_critical_cap_main"], [data-fsb-id="a_gartner_magic_quadra_main"]',
    jobCards: '.cmp-header__primary-nav-link, //a[normalize-space(.)="Careers"], //a[normalize-space(.)="See Deloitte Jobs"], [role="button"], #guideContainer-rootPanel-guidedropdownlist_232306899___widget, [aria-label="Topic*"]',
    applyButton: '.cmp-floating-filter__btn, //button[normalize-space(.)="Apply"]',
    pagination: '//a[normalize-space(.)="Submit RFP"], [aria-label="Submit RFP"], //a[normalize-space(.)="Contact Us"], [aria-label="Contact Us"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.deloitte.com/global/en/careers.html',
      'Enter job keywords in the search box',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  warnings: [
    'Uses workday ATS platform -- expect dynamic loading and potential iframes'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
