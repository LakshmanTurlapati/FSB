registerSiteGuide({
  site: 'Lockheed Martin',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.lockheedmartinjobs.com/',
  patterns: [
    /www\.lockheedmartinjobs\.com/i
  ],
  guidance: `LOCKHEED MARTIN CAREER NAVIGATION:\nStart: https://www.lockheedmartinjobs.com/`,
  selectors: {
    searchBox: '#tb-search-widget-radius, [name="r"], #tb-search-widget-keyword, [name="k"], #tb-search-widget-location, [name="location"]',
    locationFilter: '//a[normalize-space(.)="Locations"], #navIconGlobe, [aria-controls="navMenu_2_GlobalActivity"], //label[normalize-space(.)="Location"], [data-fsb-id="label_location_tb_search_widge"], //a[normalize-space(.)="We\'re hiring! Radar, EW and Se"]',
    departmentFilter: '//a[normalize-space(.)="Skill Areas"], #category-toggle, //a[normalize-space(.)="Career Area"], #job_level-toggle, //a[normalize-space(.)="Business Area"], .px-2.pt-lg-2',
    jobCards: '[aria-controls="navMenu_2_Careers"], [aria-expanded="false"], //a[normalize-space(.)="Sr Systems Engineer – Radar In"], [data-fsb-id="a_sr_systems_engineer__search_results_"], //a[normalize-space(.)="Sr Staff RF Engineer\n         "], [data-fsb-id="a_sr_staff_rf_engineer_search_results_"]',
    applyButton: '//a[normalize-space(.)="Apply Now"], .ajd_btn__apply.button'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.lockheedmartinjobs.com/',
      'Dismiss cookie banner if present',
      'Enter job keywords in the search box',
      'Set location filter if specified',
      'Apply department/category filter if specified',
      'Wait for results to load',
      'Scan job cards for relevant positions',
      'Locate apply button for application link'
    ]
  },
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
