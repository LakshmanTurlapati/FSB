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
    searchBox: '.pl-4.d-none, input[type="button"], section, #tb-search-widget-radius, [name="r"], #tb-search-widget-keyword',
    locationFilter: '.px-2.pt-lg-2, //a[normalize-space(.)="Locations"], #navIconGlobe, [aria-controls="navMenu_2_GlobalActivity"], //label[normalize-space(.)="Location"], [data-fsb-id="label_location_tb_search_widge"]',
    departmentFilter: '.px-2.pt-lg-2, //a[normalize-space(.)="Skill Areas"], #category-toggle, //a[normalize-space(.)="Career Area"], #job_level-toggle, //a[normalize-space(.)="Business Area"]',
    jobCards: '.listedLink, .ajd_navigation__a, [aria-controls="navMenu_2_Careers"], [aria-expanded="false"], //a[normalize-space(.)="Sr Systems Engineer – Radar In"], [data-fsb-id="a_sr_systems_engineer__search_results_"]',
    applyButton: '.ajd_btn__apply.button, //a[normalize-space(.)="Apply Now"]'
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
