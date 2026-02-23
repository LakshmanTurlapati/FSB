registerSiteGuide({
  site: 'Oracle',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.oracle.com/corporate/careers/',
  patterns: [
    /www\.oracle\.com\/corporate/i
  ],
  guidance: `ORACLE CAREER NAVIGATION:\nStart: https://www.oracle.com/corporate/careers/`,
  selectors: {
    searchBox: '.u30searchbttn, input[type="submit"], .vjs-big-play-button, #u30searchBtn, [aria-label="Open Search Field"], //a[normalize-space(.)="Search jobs at Oracle"]',
    locationFilter: '.flag-focus, //a[normalize-space(.)="Country"], //a[normalize-space(.)="United States"], [data-fsb-id="a_united_states"], //a[normalize-space(.)="Find phone numbers for your re"], [data-fsb-id="a_find_phone_numbers_f_rc59"]',
    departmentFilter: '//a[normalize-space(.)="Save your seat for business in"], [data-fsb-id="a_save_your_seat_for_b_rc63"], #product-grouping, [name="product-grouping"], [aria-controls="rc30skillbridge"], [aria-selected="true"]',
    jobCards: '.vjs-big-play-button, [aria-label="oracle careers create future with us"], [aria-controls="ct12-submenu-2"], [role="button"], //a[normalize-space(.)="Careers at Oracle"], [data-fsb-id="a_careers_at_oracle_option"]',
    jobTitle: '#u30btitle, [aria-label="Oracle Home"], [aria-label="Home"]',
    applyButton: '//a[normalize-space(.)="Apply now"], [data-fsb-id="a_apply_now_rc30datacenter"], [data-fsb-id="a_apply_now_rc59"]',
    pagination: '.rh08-arrow.rh08-nextarrow, .rh08-arrow.rh08-prevarrow, [aria-label="next slide"], [aria-label="previous slide"], #cloudAccountButton, //a[normalize-space(.)="Next"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.oracle.com/corporate/careers/',
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
