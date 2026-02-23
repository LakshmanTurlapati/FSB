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
    searchBox: '[aria-controls="search-container"], #careers-job-search-input, #cws_jobsearch_parent_category, [name="parent_category"], [aria-label="Choose Business"], [role="combobox"][aria-describedby="search-help_1"]',
    locationFilter: '//a[normalize-space(.)="Country"], #geotooltip, [aria-label="Use your current location"], //label[normalize-space(.)="Location"], [data-fsb-id="label_location_cws_search_form"], //label[normalize-space(.)="within"]',
    departmentFilter: '//label[normalize-space(.)="Choose Business"], [data-fsb-id="label_choose_business_cws_search_form"], //label[normalize-space(.)="Job Category"], [data-fsb-id="label_job_category_cws_search_form"]',
    jobCards: '#careers-job-search-btn, //a[normalize-space(.)="Search jobs"], //a[normalize-space(.)="Careers"], //a[normalize-space(.)="Career events"], //a[normalize-space(.)="Job Seeker Resources"], [aria-label="Job Seeker Resources opens in new tab"]',
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
