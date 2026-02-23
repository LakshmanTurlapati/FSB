# Pitfalls Research: Career Search Automation with Google Sheets Output

**Domain:** Career site browser automation + Google Sheets formatting via UI interaction
**Researched:** 2026-02-23
**Confidence:** HIGH (based on direct analysis of 35 session logs, existing codebase architecture, FSB tool capabilities, and web research on anti-bot/ATS/Sheets challenges)

---

## Critical Pitfalls

Mistakes that cause the feature to fail entirely or produce unusable output.

---

### Pitfall 1: Empty DOM Snapshots from Heavy JS-Rendered Career Sites

**What goes wrong:**
The session log parser produces sitemaps and site guides with zero interactive elements for sites like Tesla, Walmart, and others that rely on heavy client-side JavaScript rendering. Tesla's session log (`fsb-research-www.tesla.com-2026-02-23.json`) shows `totalElements: 0`, `totalForms: 0`, `totalLinks: 0` -- the research crawler captured nothing. Walmart (`careers.walmart.com`) shows `interactiveElements: []` despite having a full career search interface. If site guides are generated from these empty logs, the AI gets no selector guidance and falls back to generic heuristics, which fail on complex SPAs.

**Why it happens:**
The crowd session log research crawler likely captures the initial HTML before JavaScript frameworks (React, Angular, Workday's custom framework) hydrate the DOM. Career sites from major corporations increasingly use:
- React with Stylex (Meta/metacareers.com -- hashed class names like `x1i10hfl x1qjc9v5`)
- Workday-powered iframes (Walmart, UnitedHealth, McKesson)
- Custom SPA frameworks (Tesla, Apple)
- Server-side rendered shells that populate via API calls after page load

These sites look empty to a crawler that does not wait for JavaScript execution to complete.

**How to avoid:**
1. Flag session logs with `totalElements: 0` or `interactiveElements: []` as INCOMPLETE -- do not generate site guides from them
2. For flagged sites, the site guide should contain navigation-only guidance (URLs from `internalLinks`) rather than selector-based guidance
3. Build a "confidence score" for each parsed session log: HIGH (>10 interactive elements captured), MEDIUM (1-10 elements), LOW (0 elements, links only)
4. For LOW confidence sites, the site guide `selectors` field should be empty or contain only generic ATS selectors from the `_shared.js` category guidance
5. The AI already handles sites without selectors -- it uses DOM analysis at runtime. The danger is generating a site guide with WRONG selectors from stale/empty data that misleads the AI.

**Warning signs:**
- Session log `summary.totalElements === 0` for a site that clearly has interactive content
- Session log shows only `internalLinks` but no `interactiveElements` or `forms`
- Multiple pages crawled but all show `elementCount: 0`

**Phase to address:**
Session Log Parsing phase (Phase 1/2) -- must implement confidence scoring during log parsing, before site guide generation

---

### Pitfall 2: Google Sheets Canvas Grid is Not Clickable via DOM

**What goes wrong:**
The developer attempts to automate Google Sheets cell interaction by clicking on cells or reading cell content via DOM selectors. This fails completely because Google Sheets renders its grid on an HTML `<canvas>` element. Individual cells are NOT DOM elements -- they are pixels painted on a canvas. FSB's `click` tool targets DOM elements, so clicking "cell B3" has no DOM target. The existing Google Sheets site guide already documents this, but the AI instruction can drift during complex multi-step formatting workflows where it "forgets" to use the Name Box.

**Why it happens:**
Google Sheets (like Google Docs) switched to canvas-based rendering for performance. The cell grid that users see and interact with is a single `<canvas>` element, not a table of `<td>` elements. The toolbar and menus ARE standard DOM elements, but the cell content area is opaque to DOM automation.

**How to avoid:**
1. The Google Sheets site guide (already exists at `site-guides/productivity/google-sheets.js`) correctly documents the Name Box (`#t-name-box`) as the PRIMARY navigation method
2. Reinforce in the career search workflow prompt: "NEVER try to click on cells directly. ALWAYS use Name Box navigation: click `#t-name-box`, type cell reference (e.g., 'A1'), press Enter, then type cell value"
3. Implement a workflow-level instruction sequence for the Sheets phase: navigate to cell via Name Box -> type value -> Tab to next column -> repeat -> Enter for next row
4. The Tab/Enter data entry pattern (type value, Tab, type value, Tab... Enter) is the most reliable and does not require clicking cells at all after the initial Name Box navigation

**Warning signs:**
- AI actions include `click` on a selector containing "cell", "grid", or canvas-related elements
- AI repeatedly tries to interact with the spreadsheet grid and gets stuck
- Action results return "element not found" in the Sheets context

**Phase to address:**
Google Sheets Workflow phase -- must be addressed when building the Sheets formatting workflow, with explicit workflow-level instructions that override any AI temptation to click cells

---

### Pitfall 3: Google Sheets Has NO Direct Keyboard Shortcut for Cell Colors

**What goes wrong:**
The developer or AI assumes that applying fill color or text color in Google Sheets can be done with a simple keyboard shortcut like Ctrl+B for bold. There is NO built-in single keyboard shortcut for fill color or text color in Google Sheets. Attempting to use a non-existent shortcut does nothing, and the workflow stalls. The header row formatting -- which requires colored backgrounds and bold text -- will only be half-implemented (bold works, colors do not).

**Why it happens:**
Bold (Ctrl+B), Italic (Ctrl+I), and Underline (Ctrl+U) have direct keyboard shortcuts. Developers assume colors follow the same pattern. They do not. Applying colors requires one of:
- **Toolbar button click:** Click the fill color dropdown in the toolbar (DOM element), then click a color swatch
- **Menu navigation via keyboard:** Alt+/ (Windows) or Ctrl+Option+/ (Mac) to open "Search the menus", type "Fill color", navigate the color palette with arrow keys
- **Custom macro:** Record a macro and assign it to Ctrl+Alt+Shift+1

**How to avoid:**
1. For fill color: Use FSB's `click` tool to click the fill color toolbar button dropdown, then click the specific color swatch element. The toolbar buttons ARE standard DOM elements (unlike cells).
2. For text color: Same approach -- click the text color dropdown button, then click the desired color swatch.
3. Document the exact selector chain in the Sheets site guide:
   - Fill color button: toolbar button with paint bucket icon, aria-label containing "Fill color"
   - Color swatches: the dropdown that appears contains clickable `<span>` or `<td>` elements representing colors
4. For the header row formatting workflow: select the row first (click row number), then apply bold (Ctrl+B via keyPress), then apply fill color (click toolbar dropdown + swatch), then apply text color if needed
5. Test the color picker element selectors at runtime -- Google Sheets color picker DOM structure may vary between updates

**Warning signs:**
- The AI tries `keyPress` with modifier keys for colors and nothing happens
- Headers appear bold but without colored backgrounds
- The Sheets formatting step takes many iterations with the AI trying different non-existent shortcuts

**Phase to address:**
Google Sheets Workflow phase -- must prototype the color application workflow with actual Sheets DOM inspection before writing the site guide instructions

---

### Pitfall 4: Service Worker State Loss During Multi-Site Career Search

**What goes wrong:**
A career search workflow visits 5+ career sites sequentially, collecting job data from each. The collected data (job titles, descriptions, links) is stored in JavaScript variables in the MV3 service worker (`background.js`). Mid-workflow, Chrome terminates the service worker (30-second idle timeout or 5-minute execution limit), and ALL collected job data from previously visited sites is lost. The workflow then writes an incomplete Google Sheet with data from only the most recent site.

**Why it happens:**
Chrome Extension Manifest V3 service workers are terminated aggressively:
- After 30 seconds of inactivity
- After 5 minutes of continuous execution
- During browser resource pressure

FSB's `activeSessions` Map (line 1002 of background.js) stores session state in memory. While FSB has session persistence logic (restoring from `chrome.storage` on restart), the COLLECTED DATA from the career search (extracted job listings) is likely stored as part of the session's working state, which may or may not be persisted between service worker restarts.

The career search workflow is uniquely vulnerable because:
- It runs longer than typical single-site automations (visiting 5+ sites takes 5-15 minutes)
- Data accumulates across sites and must survive site transitions
- Each site transition involves navigation, which can briefly idle the service worker

**How to avoid:**
1. Persist collected job data to `chrome.storage.local` after EACH extraction, not just at workflow end
2. Design the data model so job data is incrementally written: `{ jobs: [...previousJobs, ...newJobsFromThisSite] }` with a storage key per workflow session
3. On service worker restart, read accumulated data from storage before continuing to the next site
4. Use the keepalive mechanism FSB already has (line 873 checks for active sessions), but verify it stays alive during the longer career search workflows
5. Consider breaking the workflow into sub-tasks: "extract from site A" -> persist -> "extract from site B" -> persist -> "write to Sheets" rather than one continuous session

**Warning signs:**
- Session logs show the service worker restarting mid-workflow (look for `sessions_restored` log entries)
- Google Sheet output is missing data from earlier sites in the workflow
- The `activeSessions` Map size drops to 0 and gets repopulated from storage during a workflow

**Phase to address:**
Multi-site Orchestration phase -- must implement incremental data persistence as the foundation before building the multi-site loop

---

### Pitfall 5: Hashed/Obfuscated Class Names in SPA Career Sites

**What goes wrong:**
Site guides generated from session logs contain CSS class selectors like `x1i10hfl x1qjc9v5 xjbqb8w` (Meta), `gs-uitk-c-1ms76ic--input-control-input` (Goldman Sachs), or `transition duration-200 ease-curve-a` (OpenAI). These selectors are either hashed (change on every build) or generated from CSS-in-JS frameworks (Stylex, CSS Modules, Tailwind). The next time the career site deploys an update, ALL these selectors break. The site guide becomes a liability -- it provides confidently wrong guidance.

**Why it happens:**
Modern career sites use:
- **Meta:** React + Stylex -- class names are hashed tokens (`x1i10hfl`) that change with each build
- **Goldman Sachs:** Custom component library with generated class names containing content hashes (`gs-uitk-c-1ms76ic`)
- **OpenAI:** Tailwind CSS -- class names describe styles (`transition duration-200`) but are not semantically stable
- **Tesla:** Minimal rendered HTML -- the crawler captured nothing at all

These are NOT stable selectors. Session logs from February 23, 2026 contain class names that may already be different by the time the feature ships.

**How to avoid:**
1. During site guide generation, classify selectors by stability:
   - **STABLE:** `#id` selectors, `[aria-label="..."]`, `[role="..."]`, `[name="..."]`, `[data-testid="..."]` -- include these in site guides
   - **SEMI-STABLE:** Semantic class names (`.search-form__submit-btn`, `.job-card`) -- include with warning
   - **UNSTABLE:** Hashed class names, CSS-in-JS tokens -- EXCLUDE from site guides
2. Prioritize ARIA and role-based selectors. The Meta session log shows `[aria-label="Open login page"]` alongside the hashed classes -- use the ARIA selector, discard the class
3. Prioritize XPath with text content: `//button[normalize-space(.)="Search Jobs"]` -- text rarely changes even when class names do
4. The existing site guide for Generic Career / ATS already uses semantic selectors (`input[type="search"]`, `[class*="job-card"]`) -- this is the right pattern
5. For each site guide, rate selector stability: HIGH/MEDIUM/LOW. LOW stability selectors should be used only as fallback, never as primary

**Warning signs:**
- Site guide contains selectors that are mostly random-looking strings (`x1i10hfl`, `gs-uitk-c-`)
- Automation works when tested but breaks within days/weeks
- The AI falls back to generic selectors frequently, ignoring site-specific guidance

**Phase to address:**
Session Log Parsing phase -- selector stability classification must happen DURING parsing, not after

---

## Moderate Pitfalls

Mistakes that cause partial failures, degraded quality, or wasted AI iterations.

---

### Pitfall 6: Cookie Consent Banners Block Career Site Interaction

**What goes wrong:**
Every career site visit begins with a cookie consent banner overlay that blocks interaction with the underlying page. The AI sees the cookie banner elements in the DOM context and either (a) tries to interact with the career page through the banner (clicks are intercepted by the banner's overlay), or (b) wastes 2-3 AI iterations figuring out it needs to dismiss the banner first. Across 5+ career sites, this wastes 10-15 iterations total.

**Why it happens:**
Cookie consent is ubiquitous on corporate career sites, especially European-headquartered companies or any company with GDPR compliance. The session logs confirm this -- NVIDIA's log shows `#onetrust-pc-btn-handler` ("Manage Settings") and `#onetrust-reject-all-handler` ("Turn Off Optional Cookies") as interactive elements. OneTrust is the most common cookie consent provider across enterprise career sites.

FSB's existing DOM analysis already has basic cookie/consent filtering (line 1218-1219 of `content/dom-analysis.js`: `if (text.includes('cookie') || cls.includes('consent'))`), but this filtering SKIPS the elements rather than dismissing them. The AI may not see the consent banner in its element list but still be blocked by the overlay.

**How to avoid:**
1. Add a "pre-navigation hook" in the career search workflow: before any career site interaction, check for common cookie consent selectors and dismiss them
2. Common cookie consent selectors to auto-dismiss:
   - OneTrust: `#onetrust-accept-btn-handler` (Accept All), `#onetrust-reject-all-handler` (Reject All)
   - CookieBot: `#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll`
   - Generic: `button[id*="accept"], button[class*="accept-cookies"], [aria-label*="Accept"]`
3. Include cookie dismissal as step 1 in every career site's workflow section of the site guide
4. The AI prompt for the career search should explicitly state: "When first visiting a career site, dismiss any cookie consent banner IMMEDIATELY before attempting any other interaction"

**Warning signs:**
- First 2-3 iterations on each career site involve clicking non-career-related elements
- AI reports "element not interactable" or "click intercepted" on career page elements
- DOM snapshot shows overlay/modal elements blocking the main content

**Phase to address:**
Career Site Navigation phase -- cookie dismissal should be a standard pre-step in every site visit

---

### Pitfall 7: Platform-Specific Keyboard Shortcuts (Mac vs Windows) in Sheets Formatting

**What goes wrong:**
The Google Sheets formatting workflow uses `keyPress` with modifier keys for bold, undo, select-all, etc. The shortcut uses `ctrlKey: true` for Windows but requires `metaKey: true` (Cmd) for macOS. If the wrong modifier is used, the shortcut silently fails -- Ctrl+B on Mac does NOT bold text in Google Sheets. The workflow appears to run (no errors) but formatting is not applied.

**Why it happens:**
Google Sheets keyboard shortcuts differ by OS:
- **Bold:** Ctrl+B (Windows/ChromeOS) vs Cmd+B (macOS)
- **Undo:** Ctrl+Z (Windows) vs Cmd+Z (macOS)
- **Select All:** Ctrl+A (Windows) vs Cmd+A (macOS)
- **Fill color search:** Alt+/ (Windows) vs Ctrl+Option+/ (macOS)

FSB already has platform detection (`navigator.userAgent?.includes('Macintosh')` in `ai-integration.js` line 4212, `content/actions.js` line 1627, `content/messaging.js` line 457, and `background.js` line 8372). However, this detection is done at the point of use, not centralized. If the site guide's workflow instructions hardcode `ctrlKey: true`, the platform detection in the action code is bypassed because the AI is told to send a specific modifier.

**How to avoid:**
1. The Sheets site guide workflow instructions should NEVER specify `ctrlKey` or `metaKey` directly. Instead, use platform-agnostic descriptions: "Press the platform Bold shortcut (Ctrl+B on Windows, Cmd+B on Mac)"
2. Better: Create a `platformShortcut` abstraction in the keyPress tool that auto-detects: `keyPress({ key: 'b', platformModifier: true })` which becomes `ctrlKey` on Windows and `metaKey` on Mac
3. If the AI generates `{ "tool": "keyPress", "params": { "key": "b", "ctrlKey": true } }` on a Mac, it should still work because the `keyPress` implementation already has platform detection for the Debugger API path. Verify this path works correctly.
4. Test ALL formatting shortcuts on both platforms before shipping. The `keyPress` tool delegates to the Chrome Debugger API (which sends raw key events) -- verify that Debugger API key events respect the OS-level modifier mapping

**Warning signs:**
- Formatting works on one OS but not the other during testing
- Bold/italic shortcuts produce no visible change (silent failure)
- AI tries the same formatting shortcut repeatedly and gets stuck

**Phase to address:**
Google Sheets Workflow phase -- must test on both Mac and Windows, and verify the Debugger API keyPress path handles platform modifiers correctly

---

### Pitfall 8: Auth Walls and Login Requirements on Career Sites

**What goes wrong:**
Several career sites require authentication before showing job listings or full job details. Meta's career site shows a login button (`[aria-label="Open login page"]`), and many sites gate the "Apply" button behind login. The AI navigates to a career site, finds a login wall, and either (a) gets stuck in a login loop it cannot complete, or (b) wastes iterations trying to interact with a page that requires authentication.

**Why it happens:**
Career sites have varying auth requirements:
- **No auth needed to browse:** Boeing, Amazon, Microsoft, Google, Apple -- job listings are public
- **Auth needed for full details/apply:** Meta (profile required for some listings), Goldman Sachs (partial gating)
- **Auth needed to search:** Some Workday-powered sites require account creation before searching
- **Auth redirects:** Clicking a job listing redirects to an ATS (Lever, Greenhouse) that may require its own auth

FSB cannot and should not automate login -- it would require storing user credentials for dozens of career sites, which is a security liability and against most sites' Terms of Service.

**How to avoid:**
1. Classify career sites in site guides as `authRequired: 'none' | 'browse_only' | 'full'`
2. For `authRequired: 'browse_only'` sites (most): extract data from public listing pages without clicking "Apply"
3. For `authRequired: 'full'` sites: skip the site and inform the user: "Meta careers requires login. Please log in manually and re-run the search for Meta."
4. The AI prompt should explicitly state: "If you encounter a login wall, DO NOT attempt to log in. Note the site as 'requires authentication' and move to the next site."
5. Include the apply link from the URL structure (many ATS systems use predictable URL patterns) rather than clicking through auth-gated apply buttons

**Warning signs:**
- AI encounters login forms or "Sign In" buttons and tries to interact with them
- AI gets redirected to an auth page and loops
- Job data extraction returns empty because content is behind auth

**Phase to address:**
Site Guide Generation phase -- auth classification must be part of each site guide; Career Workflow phase -- AI prompt must include auth-wall handling instructions

---

### Pitfall 9: Pagination and Infinite Scroll Missing Jobs

**What goes wrong:**
Career site search results are paginated or use infinite scroll. The automation extracts only the first page of results (typically 10-25 jobs) and misses dozens or hundreds of additional matching positions. Boeing's session log shows URL-based pagination (`?page=2`), while sites like Amazon and Meta use infinite scroll (load-on-scroll or "Load More" buttons). If pagination is not handled, the user gets an incomplete job list that may miss the most relevant positions (which are often not on page 1).

**Why it happens:**
Each career site implements pagination differently:
- **URL parameter pagination:** Boeing (`?page=2`), Microsoft, Amazon -- next page requires URL navigation or parameter change
- **Button pagination:** "Next", "Load More", "Show More Results" buttons that load content dynamically
- **Infinite scroll:** Meta, some Greenhouse-powered sites -- scrolling down triggers API calls that append results
- **No pagination (pre-filtered):** Small companies with few listings, or highly filtered searches

The AI may not realize results are paginated, or may treat the first page as complete. Without explicit workflow instructions, it extracts what it sees and moves on.

**How to avoid:**
1. Site guides should document pagination type for each career site: `paginationType: 'url' | 'button' | 'infiniteScroll' | 'none'`
2. The career search workflow prompt should state: "After extracting results from the first page, check for pagination controls (Next button, page numbers, scroll-to-load). If found, navigate to additional pages until you have at least [N] matching results or no more pages exist."
3. Set a reasonable cap: extract up to 10-15 relevant results per site, not all 500+ results from a large company
4. For infinite scroll sites: scroll down 3-5 times and extract what loads. Do not scroll indefinitely.
5. For URL-based pagination: limit to first 3 pages (30-75 results) to avoid excessive iteration counts and API costs

**Warning signs:**
- Output consistently shows exactly 10 or 25 jobs per company (default page size)
- User searches for a broad role and gets very few results from a large company
- Session logs show no scroll or pagination actions after the initial search

**Phase to address:**
Career Site Navigation phase -- pagination handling must be in the workflow design; Site Guide phase -- document pagination type per site

---

### Pitfall 10: Duplicate Job Listings Across Sites and Searches

**What goes wrong:**
When searching multiple career sites for the same role, the same job listing appears in the Google Sheet multiple times. A "Software Engineer" search at Microsoft might return the same position via careers.microsoft.com, LinkedIn, and Indeed. Even within a single site, the same role may appear under different departments or search queries. The Google Sheet looks unprofessional and wastes the user's time reviewing duplicates.

**Why it happens:**
- Companies cross-post the same listing on multiple platforms
- Career sites show the same position under multiple categories/departments
- Slight title variations ("Software Engineer" vs "Software Engineer, Backend") look like different jobs but may be the same position
- Different URLs for the same job (careers.microsoft.com/job/123 vs microsoft.jobs.com/job/123)

**How to avoid:**
1. Implement deduplication before writing to Google Sheets. Deduplicate on: company name + job title (normalized, case-insensitive) + location
2. When extracting from multiple sources for the same company, prefer the DIRECT career page listing over third-party mirrors (Indeed, Glassdoor)
3. The workflow should compare each new job against the accumulated list before adding it
4. Since FSB uses AI to extract job data, the deduplication can be AI-assisted: include the accumulated job list in the AI context and instruct "Skip any job that appears to be a duplicate of an already-extracted listing"
5. Normalize titles before comparison: strip "Senior"/"Staff" prefix differences that indicate genuinely different roles, but catch exact duplicates

**Warning signs:**
- Google Sheet has consecutive rows with the same company + nearly identical title
- Total job count seems inflated relative to the number of sites searched
- Same apply link URL appears multiple times

**Phase to address:**
Data Collection phase -- deduplication logic must run before Sheets write, not after

---

### Pitfall 11: Tab Management Chaos During Multi-Site Workflows

**What goes wrong:**
The career search workflow opens 5+ career site tabs, a Google Sheets tab, and possibly Google Search tabs for discovering career URLs. With 7-10+ tabs open, the AI loses track of which tab contains what. It switches to the wrong tab, tries to interact with a career site tab while thinking it is in Google Sheets (or vice versa), or the content script on a background tab becomes disconnected (BF cache eviction). Data intended for Google Sheets gets typed into a career site search box.

**Why it happens:**
FSB has multi-tab tools (`openNewTab`, `switchToTab`, `closeTab`, `listTabs`) that work at the individual action level. But when the AI needs to orchestrate a complex multi-tab workflow (search site A -> extract -> search site B -> extract -> switch to Sheets -> enter data), the AI must maintain a mental model of which tab is which. This mental model degrades over many iterations.

Additionally, Chrome may evict background tabs to the BF cache (back-forward cache), which disconnects the content script. FSB has BF cache handling, but it adds latency and can fail if the tab was evicted entirely.

**How to avoid:**
1. Design the workflow to minimize open tabs: visit ONE career site at a time, extract data, close the tab, then open the next site. Do not keep all career sites open simultaneously.
2. The Google Sheets tab should be opened FIRST and kept as the "home" tab. All career site tabs are temporary -- open, extract, close.
3. Track tab IDs in the session state: `{ sheetsTabId: 123, currentCareerTabId: 456 }`. After each site extraction, the workflow returns to the Sheets tab before opening the next site.
4. After switching tabs, always verify the current URL matches expectations before interacting. If the tab URL is wrong, use `listTabs` to find the correct tab.
5. Consider a "collect first, write later" pattern: visit all career sites and accumulate data in the session state, THEN open Google Sheets ONCE and write all data. This avoids back-and-forth tab switching.

**Warning signs:**
- AI actions target elements that do not exist on the current page (wrong tab)
- "Element not found" errors that are actually tab-context errors
- Data written to wrong location (career site search box instead of Sheets cell)
- Service worker logs show frequent `switchToTab` actions with errors

**Phase to address:**
Multi-site Orchestration phase -- tab management strategy must be designed before the workflow is built; "collect then write" vs "write as you go" is a critical architecture decision

---

## Minor Pitfalls

Mistakes that cause quality issues or suboptimal results but are relatively easy to fix.

---

### Pitfall 12: Expired and Stale Job Listings in Output

**What goes wrong:**
The Google Sheet includes job listings that have already been filled or expired. Career sites often keep expired listings visible for weeks or months, especially if they use content management systems that do not auto-remove. The user applies to an expired position and wastes time.

**How to avoid:**
1. Extract the "Date Posted" field for every listing and include it in the Google Sheet
2. The AI should prioritize recent listings (posted within last 30 days) over older ones
3. If "Date Posted" is not available, note it as "Date not listed" -- this itself is a signal that the listing may be stale
4. Flag listings with ambiguous dates ("months ago") in the Sheet with a note

**Warning signs:**
- "Date Posted" column shows dates from months ago
- Many listings show "Date not listed"
- Apply links return 404 or "position no longer available" errors

**Phase to address:**
Data Extraction phase -- date extraction and recency filtering should be part of the extraction workflow

---

### Pitfall 13: Incomplete Job Data Extraction (Missing Fields)

**What goes wrong:**
The 6 required fields (Company, Title, Date, Location, Description, Apply Link) are not consistently extractable from every career site. Some sites do not show "Date Posted" on the listing page. Others bury the "Location" in a dropdown or secondary view. The description may be behind a "Read More" click. The result is a Google Sheet with inconsistent data quality -- some rows are complete, others have 2-3 empty cells.

**How to avoid:**
1. Accept that 100% field completion is not achievable across all sites. Design the workflow to handle missing fields gracefully (write "Not available" rather than leaving cells empty)
2. Prioritize title + company + apply link as MUST-HAVE fields. Date, location, and description are BEST-EFFORT.
3. For description: extract the first 1-2 sentences visible on the listing page. Do NOT click into each job detail page for full descriptions -- this multiplies the iteration count by 5-10x and makes the workflow impractically slow
4. For apply link: use the current URL of the listing page as the apply link if no explicit "Apply" button href is available

**Warning signs:**
- Google Sheet has many empty cells in the Date or Description columns
- The workflow takes excessively long because the AI is clicking into each job detail page
- AI gets stuck trying to find a field that does not exist on the current page

**Phase to address:**
Data Extraction phase -- define MUST-HAVE vs BEST-EFFORT fields clearly in the workflow prompt

---

### Pitfall 14: Google Sheets Name Box Timing and Focus Issues

**What goes wrong:**
The Name Box (`#t-name-box`) is clicked, but the text inside it is not fully selected, so typing a cell reference like "A1" appends to the existing text instead of replacing it. Or the Name Box click is registered but focus shifts back to the grid before the cell reference is typed. The result: navigation goes to the wrong cell, and data is entered in the wrong location.

**How to avoid:**
1. After clicking the Name Box, add a short wait (100-200ms) for the text to be selected
2. Use a `selectText` or `Ctrl+A` inside the Name Box to ensure existing text is fully selected before typing
3. After typing the cell reference and pressing Enter, verify the Name Box now shows the expected reference
4. Consider using `clearInput` on the Name Box before typing the cell reference, instead of relying on auto-select behavior
5. The workflow sequence should be: click Name Box -> wait 200ms -> select all text in Name Box -> type cell reference -> press Enter -> wait 200ms -> type cell value

**Warning signs:**
- Data appears in unexpected cells (offset from expected position)
- The Name Box shows a reference like "Sheet1A1" (appended instead of replaced)
- The AI reports success but cell values are in wrong positions

**Phase to address:**
Google Sheets Workflow phase -- the Name Box interaction sequence must be tested and refined with actual Sheets interaction

---

### Pitfall 15: ATS Platform Redirects Break URL Tracking

**What goes wrong:**
Many company career pages redirect to external ATS platforms (Workday, Greenhouse, Lever, iCIMS). The user expects job listings from "careers.microsoft.com" but the actual job search happens on "microsoft.wd1.myworkdayjobs.com" or similar. The site guide keyed to "careers.microsoft.com" does not match the actual URL where interaction happens. The AI loses the benefit of site-specific guidance after the redirect.

**How to avoid:**
1. Site guides should include `redirectDomains` in their patterns: if the career page redirects to a known ATS domain, the site guide should still match
2. The generic career/ATS site guide (`site-guides/career/generic.js`) already includes patterns for `myworkdayjobs.com`, `lever.co`, `greenhouse.io` etc. -- ensure these patterns are comprehensive
3. When parsing session logs, track redirect chains: if the crawl started at `careers.walmart.com` but ended at `walmart.wd5.myworkdayjobs.com`, the site guide should cover both domains
4. Consider matching site guides by the COMPANY name rather than just URL pattern, using a lookup table: `{ "walmart": ["careers.walmart.com", "walmart.wd5.myworkdayjobs.com"] }`

**Warning signs:**
- AI navigates to a career page, gets redirected, and then receives generic guidance instead of site-specific guidance
- Session logs show the start URL and end URL have different domains
- The same ATS platform (e.g., Workday) appears for multiple companies but with different subdomains

**Phase to address:**
Site Guide Generation phase -- redirect domain mapping should be part of the site guide structure

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding 35 career site URLs in the workflow | Quick to implement, works for the initial set | Every new career site requires code changes. Cannot handle user-requested sites not in the list. | Never -- use dynamic site discovery via Google search instead |
| Storing all job data in a single background.js variable | Simple implementation, no async storage overhead | Data loss on service worker restart, memory issues with large result sets | Only for prototyping -- must migrate to chrome.storage before multi-site |
| Generating one mega-prompt with all career site instructions | Single AI call, simple implementation | Prompt size exceeds token limits with 35 sites, slow inference, irrelevant context for current site | Never -- use per-site prompt assembly from modular site guides |
| Using raw session log selectors in site guides without stability classification | Fast site guide generation, high specificity | Selectors break on next site deploy, mislead the AI, worse than no selectors | Only for sites with stable selectors (id-based, aria-based) |
| Collecting all data then writing to Sheets in one batch | Simpler workflow, fewer tab switches | If Sheets write fails mid-way, ALL data must be re-entered. No incremental progress visible to user. | Acceptable for MVP if data is persisted to storage before Sheets write |

## Integration Gotchas

Common mistakes when integrating career search with the existing FSB system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Site guides for 35 new career sites | Adding 35 separate `<script>` tags to `options.html` (already 53 scripts) | Bundle career site guides or lazy-load them. Consider a single `career-sites-all.js` file |
| AI prompt with site-specific guidance | Sending ALL 35 career site guides in every AI call | Detect current URL, load ONLY the matching site guide + shared category guidance into the prompt |
| Multi-tab actions in background.js | Assuming content script is always available in all tabs | Re-inject content script after tab switch, verify with healthCheck before interacting |
| Google Sheets interaction from career search context | Using the same AI iteration to both extract career data AND write to Sheets | Separate concerns: extraction iterations use career-site prompts, Sheets iterations use Sheets-specific prompts. Switch prompt context when switching tab context |
| Session state across multiple career sites | Treating each site visit as an independent session | One session spans the entire workflow. The session must track: accumulated jobs, sites visited, sites remaining, current phase (searching vs writing) |

## Performance Traps

Patterns that work at small scale but degrade at workflow scale.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full DOM snapshot per AI iteration during Sheets write | Each Sheets iteration sends the entire DOM (toolbar + grid metadata), most of which never changes | For Sheets iterations, send a MINIMAL context: just Name Box value, current cell reference, and recently entered values | After 30+ cell entries (60+ iterations), AI context fills up with repeated DOM snapshots |
| AI context includes ALL accumulated job data | Every career site iteration includes the full list of previously extracted jobs for dedup | Only include the last 5-10 extracted jobs for dedup context, store full list in session state | After extracting from 5+ sites (50+ jobs), context exceeds token budget |
| No cap on career site results per site | AI keeps scrolling/paginating through hundreds of results | Cap at 10-15 relevant results per site. State this limit explicitly in the prompt. | A broad search at Amazon returns 500+ results, causing 20+ iterations of scrolling |
| One-at-a-time Sheets cell entry | Each cell value requires: Name Box click -> type ref -> Enter -> type value -> Tab | Use the Tab/Enter pattern for sequential data entry. Navigate to starting cell once, then Tab across columns and Enter for new rows | A 10-company x 6-field sheet requires 60 individual cell navigations instead of 10 row entries |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Session log parsing "complete":** Often missing LOW-confidence site classification. Verify that sites with 0 interactive elements are flagged, not silently generating empty site guides
- [ ] **Site guide selectors "working":** Often using unstable hashed class selectors. Verify each site guide uses aria/role/id selectors as PRIMARY, class selectors only as fallback
- [ ] **Google Sheets "formatting working":** Often missing color formatting (bold works, colors do not). Verify fill color and text color are applied, not just bold/italic
- [ ] **Multi-site search "complete":** Often tested with 2-3 sites. Test with 5+ sites to verify service worker persistence and tab management at scale
- [ ] **Job data "extracted":** Often missing Date Posted or Description. Verify all 6 required fields are populated (or explicitly marked "Not available")
- [ ] **Career site navigation "working":** Often tested on sites without auth walls. Test with Meta, Goldman Sachs, and Workday-powered sites that have login requirements
- [ ] **Cookie consent "handled":** Often works for OneTrust but misses other consent frameworks. Test with CookieBot, TrustArc, and custom consent implementations
- [ ] **Pagination "handled":** Often extracts only first page. Verify that the workflow checks for and handles pagination on paginated sites (Boeing, Amazon)
- [ ] **Tab management "stable":** Often tested with 2 tabs (career + Sheets). Test with 5+ tabs to verify no content script disconnections or wrong-tab interactions

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Empty DOM snapshots (Pitfall 1) | LOW | Re-classify site as "navigation-only" in site guide. Use generic ATS selectors + AI runtime DOM analysis instead of site-specific selectors |
| Canvas click failure in Sheets (Pitfall 2) | LOW | AI should automatically detect Name Box availability and use it. Add explicit instruction in iteration prompt: "Use Name Box, never click grid cells" |
| Color shortcut failure in Sheets (Pitfall 3) | MEDIUM | Switch from keyboard shortcut approach to toolbar click approach. Requires DOM inspection of color picker toolbar buttons and swatches |
| Service worker data loss (Pitfall 4) | HIGH | If detected mid-workflow, restart from last persisted checkpoint. If not detected until Sheets write, must re-visit sites that lost data. Prevention (incremental persistence) is critical. |
| Hashed selectors broken (Pitfall 5) | LOW | Fall back to generic selectors in the shared career guide. The AI's runtime DOM analysis should handle the rest. Remove broken site-specific selectors from guide. |
| Auth wall blocking (Pitfall 8) | LOW | Skip the site, notify user, move to next site. User can manually log in and re-run for that site. |
| Tab management chaos (Pitfall 11) | MEDIUM | Use `listTabs` to reorient. Close all career site tabs, reopen only the current one. Worst case: restart the workflow from the Sheets tab with accumulated data. |
| Wrong cell data entry (Pitfall 14) | MEDIUM | Use Ctrl+Z/Cmd+Z to undo, re-navigate via Name Box. If extensively wrong, start a new Sheet and re-enter. This is why "collect then write" is preferred over "write as you go". |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 Empty DOM snapshots | Session Log Parsing | Every generated site guide has a `confidence` score. Sites with score LOW have no selectors, only URL guidance |
| #2 Canvas grid not clickable | Google Sheets Workflow | Sheets workflow uses Name Box exclusively. No `click` actions targeting grid/cell elements |
| #3 No color keyboard shortcut | Google Sheets Workflow | Header row has fill color AND bold applied. Color is applied via toolbar click, not keyboard shortcut |
| #4 Service worker data loss | Multi-site Orchestration | Job data persists to chrome.storage after each site. Killing service worker mid-workflow does not lose data |
| #5 Hashed class selectors | Session Log Parsing | Each selector in site guides has a `stability` rating. No hashed-only selectors without ARIA/role fallbacks |
| #6 Cookie consent banners | Career Site Navigation | First action on any career site is cookie consent check/dismiss. Test with NVIDIA (OneTrust confirmed) |
| #7 Mac vs Windows shortcuts | Google Sheets Workflow | Formatting tested on both macOS and Windows. Platform detection verified for Debugger API keyPress path |
| #8 Auth walls | Site Guide Generation | Each site guide has `authRequired` field. AI prompt includes auth-wall handling ("skip and notify") |
| #9 Pagination missing jobs | Career Site Navigation | Test with Boeing (URL pagination) and Amazon (button pagination). Verify 2+ pages are extracted |
| #10 Duplicate listings | Data Collection | Run dedup before Sheets write. Test: search "software engineer" at related companies, verify no exact-title+company duplicates |
| #11 Tab management | Multi-site Orchestration | Test 5-site workflow end-to-end. Verify no wrong-tab interactions in session logs |
| #12 Expired listings | Data Extraction | Date Posted field extracted for every listing. Listings older than 60 days flagged |
| #13 Incomplete data | Data Extraction | MUST-HAVE fields (title, company, apply link) present for 100% of entries. BEST-EFFORT fields noted as "Not available" when missing |
| #14 Name Box timing | Google Sheets Workflow | Cell navigation sequence tested: click Name Box -> wait -> select all -> type ref -> Enter -> wait -> type value. Verify correct cell targeted |
| #15 ATS redirects | Site Guide Generation | Site guides include redirect domains. Test with Walmart (Workday redirect) |

## Sources

- Direct analysis of 35 career site session logs in `/Logs/fsb-research-*.json` (Tesla showing 0 elements, Meta showing hashed classes, Boeing showing URL pagination, Walmart showing empty interactive elements with populated internal links)
- Direct analysis of existing site guides: `site-guides/career/_shared.js`, `site-guides/career/generic.js`, `site-guides/productivity/google-sheets.js`, `site-guides/productivity/google-docs.js`
- Direct analysis of FSB codebase: `content/actions.js` (keyPress tool, multi-tab tools), `background.js` (activeSessions Map, service worker lifecycle), `content/dom-analysis.js` (cookie consent filtering), `ai-integration.js` (platform detection)
- [Google Docs Editors Help: Keyboard shortcuts for Google Sheets](https://support.google.com/docs/answer/181110) -- Official Google documentation confirming no built-in color keyboard shortcut
- [Google Docs Editors Community: Shortcut key to color a cell](https://support.google.com/docs/thread/227704922) -- Confirms Alt+/ menu search workaround for colors
- [The New Stack: Google Docs Switches to Canvas Rendering](https://thenewstack.io/google-docs-switches-to-canvas-rendering-sidelining-the-dom/) -- Canvas rendering architecture in Google Docs/Sheets
- [Chrome for Developers: Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- 30-second idle timeout, 5-minute execution limit
- [ZenRows: Bypass Bot Detection](https://www.zenrows.com/blog/bypass-bot-detection) -- Anti-bot detection mechanisms (fingerprinting, behavioral analysis, TLS)
- [ScrapingBee: Web Scraping Challenges 2025](https://www.scrapingbee.com/blog/web-scraping-challenges/) -- Dynamic content loading, anti-scraping measures
- [JobsPikr: Job Scraping Explained](https://www.jobspikr.com/blog/guide-to-job-scraping/) -- Job data quality: deduplication, expired listings, data normalization
- [Cloudflare: JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/) -- Cloudflare anti-bot JS challenge injection
- [Akamai: Bot Manager](https://www.akamai.com/products/bot-manager) -- Behavioral analysis, JA3/JA4 fingerprinting

---
*Pitfalls research for: Career Search Automation with Google Sheets Output (FSB v9.4)*
*Researched: 2026-02-23*
