registerSiteGuide({
  site: 'UnitedHealth Group',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.unitedhealthgroup.com/',
  patterns: [
    /careers\.unitedhealthgroup\.com/i
  ],
  guidance: `UNITEDHEALTH GROUP CAREER NAVIGATION:\nStart: https://careers.unitedhealthgroup.com/`,
  selectors: {
    searchBox: '.ojp-nav__search-icon--desktop, input[type="text"][placeholder="Search\\ by\\ keyword\\,\\ location\\ or\\ career\\ area"], [aria-controls="search-container"], #careers-job-search-input, #cws_jobsearch_parent_category, [name="parent_category"]',
    locationFilter: '.header-component-language-placeholder, .radius-label.location-radius-control, //a[normalize-space(.)="Country"], #geotooltip, [aria-label="Use your current location"], //label[normalize-space(.)="Location"]',
    departmentFilter: '//label[normalize-space(.)="Choose Business"], [data-fsb-id="label_choose_business_cws_search_form"], //label[normalize-space(.)="Job Category"], [data-fsb-id="label_job_category_cws_search_form"]',
    jobCards: '.ojp-nav__link, .ojp-utility-nav__link, .job.clearfix, .ejd-social-share.ejd-social-banner, #careers-job-search-btn, //a[normalize-space(.)="Search jobs"]',
    applyButton: '//a[normalize-space(.)="External Candidate Application"], [aria-label="Apply opens in new tab"], //a[normalize-space(.)="Apply"]',
    pagination: '//a[normalize-space(.)="homepage"], [data-fsb-id="a_homepage_content"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.unitedhealthgroup.com/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link',
      'Use pagination to view additional results'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
