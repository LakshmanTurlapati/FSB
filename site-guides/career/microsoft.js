registerSiteGuide({
  site: 'Microsoft',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://careers.microsoft.com/',
  patterns: [
    /careers\.microsoft\.com/i
  ],
  guidance: `MICROSOFT CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://careers.microsoft.com/"
  # search and extract
  click e5    # search box
  type e5 "cloud engineer"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Microsoft","role":"...","location":"...","link":"...","source":"microsoft"}\nStart: https://careers.microsoft.com/`,
  selectors: {
    searchBox: '#search, [aria-label="Search jobs"], #find-jobs-btn, //button[normalize-space(.)="Find jobs"], #professionTabbox9, [role="button"]',
    locationFilter: '#nav-c1-Locations, //a[normalize-space(.)="Locations"], #location, #careers-customHTabs-tablinks-id1-2, [aria-label="Greater China Region"], #careers-customLeftCarousel-dotid-c1-d1',
    departmentFilter: '#nav-c1-professions, //a[normalize-space(.)="Professions"], #profession_grid_block11, [aria-label="Digital sales and solutions"], #profession_grid_block14, [aria-label="Governance, risk, and compliance"]',
    jobCards: '#uhfCatLogo, //a[normalize-space(.)="Careers"], #job, [name="job"], #careers-twoColumnTextMedia-myVideoOverlay1, [aria-label="Our Mission video"]',
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
