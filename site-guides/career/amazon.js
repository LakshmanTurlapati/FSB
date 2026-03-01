registerSiteGuide({
  site: 'Amazon',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  ats: null,
  careerUrl: 'https://www.amazon.jobs/',
  patterns: [
    /www\.amazon\.jobs/i
  ],
  guidance: `AMAZON CAREER NAVIGATION:

COMMON PATTERNS:
  # navigate to career page
  navigate "https://www.amazon.jobs/"
  # search and extract
  click e5    # search box
  type e5 "solutions architect"
  enter
  click e10   # job result
  gettext e12   # job title
  storejobdata {"company":"Amazon","role":"...","location":"...","link":"...","source":"amazon"}\nStart: https://www.amazon.jobs/`,
  selectors: {
    searchBox: '[aria-controls="search_typeahead-homepage-listbox-2stkayz"], [role="combobox"][aria-labelledby="search_typeahead-homepage-label"], #search-button, [role="button"][aria-labelledby="search-button-label"], [aria-controls="search_typeahead-homepage-listbox-wow8dle"], [aria-controls="kxuq4z-9ZAGolFYTS0-2"]',
    locationFilter: '[aria-controls="location-typeahead-homepage-listbox-iaen4ix"], [role="combobox"][aria-labelledby="location-typeahead-homepage-label"], [data-fsb-id="a_locationssee_where_a"], [aria-controls="location-typeahead-homepage-listbox-hroqq4y"], [data-fsb-id="a_facilities_maintenan_facilities_main"], [aria-controls="location-typeahead-homepage-listbox-poduhdg"]',
    departmentFilter: '[data-fsb-id="a_teamsget_to_know_ama"], //a[normalize-space(.)="Amazon Business"], [data-fsb-id="a_business_and_corpora_business_and_co"], [data-fsb-id="a_customer_experience__customer_experi"], [data-fsb-id="a_business_and_merchan_business_and_me"], [data-fsb-id="a_business_intelligenc_business_intell"]',
    jobCards: '//a[normalize-space(.)="Find your role"], [aria-label="Student opportunities"], [aria-label="Hourly jobs"], [aria-label="AI careers"], [data-fsb-id="a_job_categoriesfind_t"], //a[normalize-space(.)="Amazon Jobs home page"]',
    pagination: '[aria-label="Explore"], [role="button"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://www.amazon.jobs/',
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
