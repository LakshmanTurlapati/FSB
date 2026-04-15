# Phase 10: Career Search Core - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Single-company career search automation. User gives a natural language query (e.g., "find software engineer jobs at Microsoft"), FSB navigates to the company's career site, searches for matching roles, extracts job data, and reports results. Multi-site orchestration, data persistence across companies, and Sheets output are separate phases (11-13).

</domain>

<decisions>
## Implementation Decisions

### Search Term Interpretation
- AI interprets vague queries into concrete search terms before executing (e.g., "tech jobs" becomes "software engineer", "data scientist", etc.)
- Location is extracted from the query when mentioned ("jobs at Amazon in Seattle" extracts "Seattle"), but FSB never prompts for location if absent
- When a query maps to multiple terms, FSB runs multiple searches on the same site and merges results (deduplicating by job/role ID or apply URL)
- Role level (internship, senior, entry-level) is treated as a preference, not a hard filter -- close matches are included (e.g., "internship" also captures "new grad")
- Stop searching once ~25 relevant jobs are extracted per company, even if more search terms remain
- Only extract jobs the AI judges as relevant to the user's intent -- filter out non-matching roles (e.g., skip "sales engineer" when user asked for "software engineer")
- Use career site filters (department, location dropdowns) alongside search box when they clearly match the user's intent

### Job Data Extraction
- Required fields per job: company name, title, apply link (direct application page URL)
- Best-effort fields: date, location, description
- Description field: AI reads the full job description and produces a high-quality summary (not raw text, not just a snippet)
- Extract from listing page first; only click into individual job detail pages when needed fields (apply link, full description) are not available on the listing
- Open job detail pages in a new tab, extract, close tab, return to listing -- keeps listing state intact
- Summarize each job description in real-time during extraction and store in intermediate memory

### Intermediate Memory / Session Enhancement
- AI tracks accumulated job data in conversation context for real-time decisions (dedup, relevance filtering, cap checking)
- Session storage handles durability -- existing session persistence already covers this
- Session structure needs new fields for: accumulated job data, search terms used, extraction progress
- This naturally feeds into Phase 11's persistence requirements

### Results Presentation
- FSB works silently during search -- visual feedback shows what's happening, but job data is not dumped into chat
- On completion: structured summary (total count, breakdown by location, top role titles found)
- Jobs are only listed if user explicitly asks to "show" or "list" results -- displayed as compact list (Title | Company | Location, one line per job)
- Zero results: report directly to user ("No matching jobs found") -- do not write empty results to any document
- When task includes an output destination (Sheets, doc), FSB performs the full workflow and summarizes what was done in a paragraph

### Error Handling & Recovery
- Retry once on error (refresh page, try again), then report failure with user-friendly message (no technical jargon)
- Keep partial data on failure -- if 5 jobs extracted before site broke, keep them
- After keeping partial data, retry automation to continue extracting; if recovery fails, proceed with what was collected to the next step
- CAPTCHA: use existing CAPTCHA solver if configured in settings; skip site if CAPTCHA handling is disabled
- Login walls: use existing login detection system (detects password fields, pauses automation, shows inline login prompt)
- Status messages during search: concise and summarized (not verbose per-action detail)

### Navigation & Site Guide Usage
- Navigation priority: direct career URL from site guide first, Google "[company] careers" as fallback if URL fails (404, redirect)
- For unknown companies (no site guide): Google their career page and attempt full AI exploration of the unknown site
- Always navigate to dedicated jobs/careers page, not homepage search
- Verify the page is actually a career page before starting search interaction
- Site guide selectors take priority -- try guide selectors first, fall back to AI DOM analysis only if they fail
- ATS mismatch detection: if the actual ATS differs from what the site guide expects, detect and switch to the correct guide (or explore from scratch)
- Cookie consent banners: handle on-the-fly when they block an action, not as a proactive pre-step
- Actively explore the page to find search interface (click tabs, expand sections) if not immediately visible
- Iframe handling: detect and interact within iframes (common with iCIMS and similar ATS platforms)
- Multi-search flow: re-search on same page when convenient but always reset/update active filters for new search terms

### SPA & Dynamic Loading
- Hybrid approach: short timeout using existing DOM stability detection first
- If page doesn't stabilize, fall back to career-specific SPA handling that watches for job listing elements to appear

### Smart Delays
- Enhance existing smart delay system to be genuinely context-aware for career searches
- Adaptive based on site responsiveness, action type, and any signs of rate limiting
- Claude has discretion on implementation details

### Claude's Discretion
- Exact search term expansion strategy per query type
- Smart delay tuning per site
- DOM stability timeout thresholds
- How to handle career sites with unusual layouts
- Session field naming and structure for intermediate memory
- Deduplication logic details (when job ID vs URL vs title matching)

</decisions>

<specifics>
## Specific Ideas

- Intermediate memory concept: AI accumulates context throughout the search process, making real-time decisions about pagination depth, relevance, and when to stop
- "We don't show anything until the user asks to list or show" -- the automation is silent, visual feedback handles status, results only appear on request or when writing to a destination
- Zero results should suggest trying an agent for automated retry (agent is a future phase feature)
- Session management already persists data -- extend it rather than building new persistence
- Login detection is already robust (password field detection, inline login prompt in sidepanel, resume after login)
- Existing CAPTCHA framework and smart delay system should be leveraged and enhanced, not replaced

</specifics>

<deferred>
## Deferred Ideas

- Automated retry agent for failed/zero-result searches -- future phase
- Multi-site orchestration -- Phase 11
- Google Sheets data entry -- Phase 12
- Google Sheets formatting -- Phase 13

</deferred>

---

*Phase: 10-career-search-core*
*Context gathered: 2026-02-23*
