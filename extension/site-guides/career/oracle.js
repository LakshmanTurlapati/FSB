registerSiteGuide({
  site: 'Oracle',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.oracle.com/corporate/careers/',
  patterns: [
    /www\.oracle\.com\/corporate/i
  ],
  guidance: `ORACLE CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.oracle.com/corporate/careers/"
  # search and extract
  click e5    # search jobs link
  type e8 "database administrator"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Oracle","role":"...","location":"...","link":"...","source":"oracle"}\nStart: https://www.oracle.com/corporate/careers/`,
  selectors: {
    searchBox: '#u30searchBtn, [aria-label="Open Search Field"], //a[normalize-space(.)="Search jobs at Oracle"], [data-fsb-id="a_search_jobs_at_oracl_rh09"], [aria-label="Search Oracle.com"], [role="combobox"]',
    locationFilter: '//a[normalize-space(.)="Country"], //a[normalize-space(.)="United States"], [data-fsb-id="a_united_states"], //a[normalize-space(.)="Find phone numbers for your re"], [data-fsb-id="a_find_phone_numbers_f_rc59"], .flag-focus',
    departmentFilter: '//a[normalize-space(.)="Save your seat for business in"], [data-fsb-id="a_save_your_seat_for_b_rc63"], #product-grouping, [name="product-grouping"], [aria-controls="rc30skillbridge"], [aria-selected="true"]',
    jobCards: '[aria-label="oracle careers create future with us"], [aria-controls="ct12-submenu-2"], [role="button"], //a[normalize-space(.)="Careers at Oracle"], [data-fsb-id="a_careers_at_oracle_option"], //a[normalize-space(.)="Careers"]',
    jobTitle: '#u30btitle, [aria-label="Oracle Home"], [aria-label="Home"]',
    applyButton: '//a[normalize-space(.)="Apply now"], [data-fsb-id="a_apply_now_rc30datacenter"], [data-fsb-id="a_apply_now_rc59"]',
    pagination: '[aria-label="next slide"], [aria-label="previous slide"], #cloudAccountButton, //a[normalize-space(.)="Next"], .rh08-arrow.rh08-nextarrow, .rh08-arrow.rh08-prevarrow'
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
