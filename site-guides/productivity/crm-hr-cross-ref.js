/**
 * Site Guide: CRM HR Cross-Reference
 * Per-site guide for cross-referencing employee names between a web CRM and
 * a separate HR portal using multi-tab MCP tools.
 * Addresses CONTEXT-09: Context Bloat & Long-Running Workflows -- tracking
 * 50 name lookups across two separate web applications in different browser tabs.
 *
 * Primary CRM target: DemoQA Webtables (demoqa.com/webtables)
 * Primary HR Portal target: The-Internet Herokuapp (the-internet.herokuapp.com/tables)
 * Fallback targets: JSONPlaceholder, ReqRes, DummyJSON (all auth-free JSON APIs)
 */

registerSiteGuide({
  site: 'CRM HR Cross-Reference',
  category: 'Productivity Tools',
  patterns: [
    /demoqa\.com/i,
    /the-internet\.herokuapp\.com/i,
    /reqres\.in/i,
    /dummyjson\.com/i,
    /jsonplaceholder\.typicode\.com/i
  ],
  guidance: `CRM VS HR PORTAL CROSS-REFERENCE INTELLIGENCE (CONTEXT-09):

TARGET SITES:
  Primary CRM: demoqa.com/webtables
    - Public practice site with employee data table
    - Columns: First Name, Last Name, Age, Email, Salary, Department
    - Features: Add, Edit, Delete, Search, Pagination
    - No authentication required

  Primary HR Portal: the-internet.herokuapp.com/tables
    - Public test site with sortable data tables
    - Columns: Last Name, First Name, Email, Due, Web Site, Action
    - Table 1 and Table 2 with different employee records
    - Static HTML, all rows visible on load, no auth required

  Fallback CRM: jsonplaceholder.typicode.com/users
    - Public REST API rendered as JSON (10 users)
    - Fields: name, email, phone, company
    - Read via read_page on the JSON response body

  Fallback HR Portal: reqres.in/api/users?page=1
    - Public paginated API (6 users per page, 2 pages)
    - Fields: first_name, last_name, email, avatar
    - Navigate page=1 and page=2 for all 12 users

  Additional Fallback: dummyjson.com/users
    - Public API with 30 users
    - Fields: firstName, lastName, email, company.department
    - Single endpoint returns all users in JSON

CROSS-REFERENCE STRATEGY:
  1. Open CRM in one tab, HR portal in a second tab
  2. Extract employee names from CRM in batches of 10
  3. Switch to HR portal tab, search/scan for each name in the batch
  4. Record match or mismatch for each name
  5. Switch back to CRM, advance to next batch of 10
  6. Repeat until 50 names processed (or all available names exhausted)
  7. Compile final cross-reference report with counts

CONTEXT BLOAT MITIGATION FOR 50-NAME CROSS-REFERENCE:
  - Extract names in batches of 10 from CRM -- do NOT extract all 50 at once
  - Per-name record format: {name, crmFound, hrFound, match} -- under 60 chars each
  - 50 records at 60 chars = 3000 characters total -- well within context budget
  - After each batch cross-reference, store ONLY the compact result
  - Do NOT retain full DOM snapshots from either tab between batches
  - Batch summary tracking: {batchNumber, namesProcessed, matched, mismatched, currentTab}
  - Total tracking overhead per batch: under 200 characters

SKIP-AUTH EXPECTATION:
  - All primary and fallback targets are auth-free demo/test sites
  - If any target unexpectedly requires login, document as SKIP-AUTH
  - Attempt next fallback target before declaring skip-auth for the full workflow
  - JSONPlaceholder and DummyJSON are pure API endpoints -- never require auth

DEDUPLICATION:
  - Maintain a Set of already-cross-referenced names (lowercase normalized)
  - Before cross-referencing a name, check if it was already processed in a prior batch
  - This prevents duplicate lookups when CRM pagination overlaps or reloads
  - Names are normalized: trim whitespace, lowercase, collapse multiple spaces`,

  selectors: {
    demoqa: {
      employeeTable: '.rt-table',
      tableRow: '.rt-tr-group',
      firstName: '.rt-td:nth-child(1)',
      lastName: '.rt-td:nth-child(2)',
      email: '.rt-td:nth-child(3)',
      searchBox: '#searchBox',
      pagination: '.-pagination',
      nextPage: '.-next button',
      prevPage: '.-previous button'
    },
    herokuapp: {
      table1: '#table1',
      table2: '#table2',
      tableRow: '#table1 tbody tr',
      lastName: 'td:nth-child(1)',
      firstName: 'td:nth-child(2)',
      email: 'td:nth-child(3)',
      sortHeader: 'th span'
    },
    reqres: {
      userList: 'body',
      userData: 'pre'
    },
    dummyjson: {
      userList: 'body',
      userData: 'pre'
    }
  },

  workflows: {
    crossReferenceEmployees: [
      {
        step: 1,
        name: 'SETUP',
        description: 'Navigate to CRM site (demoqa.com/webtables). Verify employee table loads (.rt-table visible). Record initial tab as crmTabId via list_tabs.',
        tools: ['navigate', 'read_page', 'list_tabs']
      },
      {
        step: 2,
        name: 'EXTRACT BATCH FROM CRM',
        description: 'Read first 10 employee names from the table using read_page on .rt-tr-group elements. Extract firstName and lastName from each row. Store as compact array: [{name: "FirstName LastName", source: "crm"}]. If more than 10 rows visible, record only first 10 for this batch.',
        tools: ['read_page']
      },
      {
        step: 3,
        name: 'OPEN HR PORTAL TAB',
        description: 'Use open_tab to navigate to the-internet.herokuapp.com/tables. Record as hrTabId. Verify table loads (#table1 visible).',
        tools: ['open_tab', 'read_page']
      },
      {
        step: 4,
        name: 'CROSS-REFERENCE BATCH',
        description: 'For each name in the current batch: search/scan the HR portal table rows for a matching firstName+lastName. Record match result: {name, crmFound: true, hrFound: true/false, match: true/false}.',
        tools: ['read_page', 'scroll']
      },
      {
        step: 5,
        name: 'SWITCH BACK TO CRM',
        description: 'Use switch_tab to return to crmTabId. Navigate to next page or scroll to next batch of 10 names.',
        tools: ['switch_tab', 'click', 'scroll']
      },
      {
        step: 6,
        name: 'EXTRACT NEXT BATCH',
        description: 'Read next 10 names from CRM. Append to the names array (avoid duplicates by checking against already-processed names). Use pagination (.-next button) if needed to access additional rows.',
        tools: ['read_page', 'click']
      },
      {
        step: 7,
        name: 'SWITCH TO HR PORTAL',
        description: 'Use switch_tab to hrTabId. Cross-reference the new batch against HR portal data.',
        tools: ['switch_tab', 'read_page']
      },
      {
        step: 8,
        name: 'REPEAT',
        description: 'Continue steps 5-7 until 50 names have been extracted and cross-referenced (or all available names exhausted). Each iteration processes one batch of 10 names.',
        tools: ['switch_tab', 'read_page', 'click', 'scroll']
      },
      {
        step: 9,
        name: 'COMPILE RESULTS',
        description: 'After all batches processed, compile final cross-reference report: { totalCrmNames: N, totalHrNames: M, matched: X, crmOnly: Y, hrOnly: Z, mismatched: W }.',
        tools: []
      },
      {
        step: 10,
        name: 'VERIFY',
        description: 'Switch between tabs to spot-check 3 random matches and 1 random mismatch. Confirm name appears in the expected system.',
        tools: ['switch_tab', 'read_page']
      },
      {
        step: 11,
        name: 'CONTEXT TRACKING',
        description: 'Throughout the workflow, maintain only: { batchNumber: N, namesProcessed: N, matched: N, mismatched: N, currentTab: "crm"|"hr" }. Total tracking under 200 characters per batch summary.',
        tools: []
      },
      {
        step: 12,
        name: 'REPORT',
        description: 'State final cross-reference outcome with counts and any discrepancies found. Format: "Cross-referenced X names: Y matched, Z CRM-only, W HR-only."',
        tools: []
      }
    ]
  },

  warnings: [
    'CONTEXT-09: Extract employee names in batches of 10 from CRM, cross-reference each batch in HR portal, then return for next batch. Do NOT extract all 50 names at once -- context bloat risk.',
    'After each batch cross-reference, store ONLY the compact result {name, match: true/false}. Do NOT retain full DOM snapshots from either tab.',
    'DemoQA webtables has pagination -- use the next page button (.-next button) to access additional employee rows beyond the first page.',
    'The-Internet herokuapp tables are static HTML -- all rows visible on initial load, no pagination needed. Scan all rows to find matches.',
    'If demo sites are unavailable or require auth: document as SKIP-AUTH and attempt JSON API fallbacks (reqres.in, dummyjson.com) instead.'
  ],

  toolPreferences: [
    'navigate',
    'read_page',
    'click',
    'type_text',
    'scroll',
    'open_tab',
    'switch_tab',
    'list_tabs'
  ]
});
