registerSiteGuide({
  site: 'Microsoft',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.microsoft.com/',
  patterns: [
    /careers\.microsoft\.com/i
  ],
  guidance: `MICROSOFT CAREER NAVIGATION:\nStart: https://careers.microsoft.com/`,
  selectors: {
    searchBox: '#search, [aria-label="Search jobs"], #find-jobs-btn, //button[normalize-space(.)="Find jobs"], #professionTabbox9, [role="button"]',
    locationFilter: 'input[type="text"][placeholder="City\\,\\ state\\,\\ or\\ country\\/region"], #nav-c1-Locations, //a[normalize-space(.)="Locations"], #location, #careers-customHTabs-tablinks-id1-2, [aria-label="Greater China Region"]',
    departmentFilter: '#nav-c1-professions, //a[normalize-space(.)="Professions"], #profession_grid_block11, [aria-label="Digital sales and solutions"], #profession_grid_block14, [aria-label="Governance, risk, and compliance"]',
    jobCards: '.careers-twoColumnTextMedia-Video, .ms-Link.footer-link, .careers-clickableCard-linkTextDec.careers-card-clickable, .careers-verticalTab-linkTextDec, .careers-childrenText-link, .careers-twoColumnTextMedia-link',
    pagination: '//a[normalize-space(.)="View previous applications and"], [data-fsb-id="a_view_previous_applic"], #careers-customLeftCarousel-previdc1, [aria-label="Previous Slide"], //a[normalize-space(.)="visit the Accessibility page"], [data-fsb-id="a_visit_the_accessibil_container_384be"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.microsoft.com/',
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
