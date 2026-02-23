# Feature Research: Career Search Automation + Google Sheets Output

**Domain:** Career search automation with structured spreadsheet output
**Researched:** 2026-02-23
**Confidence:** HIGH
**Scope:** Adding career search automation to FSB Chrome Extension (v9.4) -- multi-company job search, data extraction, and formatted Google Sheets output

---

## Existing Capabilities (What FSB Already Has)

Before mapping new features, these are the building blocks already in place. Every new feature below either extends these or fills a gap between them.

| Capability | Status | Location |
|-----------|--------|----------|
| AI-powered browser automation (25+ tools) | Shipped | content/actions.js |
| Career site guides (Indeed, Glassdoor, BuiltIn, generic ATS) | Shipped | site-guides/career/ |
| Career category shared guidance (6-field extraction, strategy priority) | Shipped | site-guides/career/_shared.js |
| Google Sheets site guide (Name Box navigation, Tab/Enter data entry) | Shipped | site-guides/productivity/google-sheets.js |
| Google Docs formatted paste (bold, tables, lists via Clipboard API) | Shipped | content/rich-text.js |
| Multi-tab tools (openNewTab, switchToTab, closeTab, listTabs) | Shipped | content/actions.js, background.js |
| Task type detection (career, multitab) | Shipped | ai-integration.js, background.js |
| Career-specific prompt template (6-phase workflow) | Shipped | ai-integration.js TASK_PROMPTS.career |
| Site guide URL pattern matching | Shipped | site-guides/index.js |
| Crowd session logs for 34 career sites + Google Docs | Available | /logs/ directory |
| Memory system (sitemaps per domain, cross-site patterns) | Shipped | lib/memory/ |
| Multitab completion validator | Shipped | background.js multitabValidator |
| Conversation history across iterations | Shipped | background.js sessionAIInstances |

**Key gap:** FSB can search ONE career site and enter data into ONE Google Sheet in a single session. It does NOT have structured multi-company orchestration, data accumulation across sites, or Google Sheets formatting (bold, colors, column sizing).

---

## Table Stakes (Users Expect These)

Features users assume exist when they say "find me internships and put them in a spreadsheet." Missing any of these makes the product feel broken.

---

### TS-1: Single-Company Career Search with Data Extraction

**Why Expected:** This is the atomic unit of the workflow. If FSB cannot reliably navigate one career site, find matching jobs, and extract the 6 required fields (company, title, date, location, description, apply link), nothing else matters.

**Complexity:** MEDIUM -- The AI prompt template (TASK_PROMPTS.career) and career site guides already define this workflow. The challenge is reliability across the 30+ different ATS platforms (Workday, Lever, Greenhouse, Ashby, iCIMS, custom builds). Each has different DOM structures, search mechanisms, and listing formats.

**Dependencies on Existing FSB:**
- Career site guides (generic.js, indeed.js, glassdoor.js, builtin.js) -- already shipped
- Career shared guidance (_shared.js 6-field extraction) -- already shipped
- getText, getAttribute, click, type, scroll tools -- already shipped

**Needs New Site Guide Data:** YES -- The 34 crowd session logs need to be parsed into per-company site guides with selectors for each company's career page (search box, job cards, job title, location, date, apply link). The generic.js guide covers common ATS patterns, but company-specific selectors increase reliability. For example, Microsoft's career page uses `#find-jobs-btn` and `[aria-label="Search jobs"]` (visible in the session log), while Amazon uses `#search-typeahead-homepage` and `#search-button`.

**What "done" looks like:**
- User says "find software engineering internships at Microsoft"
- FSB navigates to careers.microsoft.com (via Google search)
- FSB uses the search box to enter "software engineering internship"
- FSB extracts 3-5 matching listings with all 6 fields
- FSB reports the findings to the user

---

### TS-2: Multi-Company Sequential Search

**Why Expected:** The core value proposition is "find me jobs at Microsoft, Amazon, AND Google." Users name 2-10 companies in a single prompt. If FSB can only handle one company, users just do it manually.

**Complexity:** HIGH -- This requires FSB to orchestrate a sequential workflow: search company A, accumulate data, search company B, accumulate more data, etc. The AI needs to maintain state across company transitions -- remembering which companies it has already searched, which it has not, and what data it has collected so far.

**Dependencies on Existing FSB:**
- Multi-tab tools (openNewTab, switchToTab) -- already shipped
- Multitab task detection (classifyTask returns 'multitab') -- already shipped
- Conversation history preservation -- already shipped

**Key challenge:** The AI's conversation history currently preserves intent across iterations, but there is no structured data accumulation mechanism. After extracting jobs from Microsoft, the AI needs to remember the extracted data while it searches Amazon. The conversation memory can hold this if the AI formats it as structured text in its responses, but it is fragile -- context window limits may truncate earlier findings.

**Needs New Site Guide Data:** YES -- Each company needs its own site guide or the AI needs to rely on the generic ATS guide + sitemaps generated from crowd session logs.

**What "done" looks like:**
- User says "find software engineering internships at Microsoft, Amazon, and Google"
- FSB searches Microsoft careers, extracts 3-5 jobs
- FSB opens a new tab (or navigates) to Amazon careers, extracts 3-5 jobs
- FSB opens a new tab to Google careers, extracts 3-5 jobs
- All extracted data is preserved and available for the next phase (Sheets entry)

---

### TS-3: Google Sheets Data Entry (Basic)

**Why Expected:** "Put them in a spreadsheet" is the explicit user request. If the data stays in chat but never appears in a Sheet, the task is not done.

**Complexity:** MEDIUM -- The Google Sheets site guide already defines the Name Box navigation pattern (click #t-name-box, type cell reference, Enter, type value, Tab). The TASK_PROMPTS.career prompt already has Phase 4-6 covering Sheet creation, header setup, and row data entry. The challenge is reliability: Google Sheets is canvas-based, and the Name Box is the only reliable entry point. Tab/Enter sequencing must be exact -- one missed Tab shifts all subsequent columns.

**Dependencies on Existing FSB:**
- Google Sheets site guide (google-sheets.js) -- already shipped
- Name Box navigation workflow -- already defined
- type, keyPress, click tools -- already shipped

**Needs New Site Guide Data:** The existing Google Sheets site guide covers basic data entry. May need enhancement for:
- Creating a new blank spreadsheet from sheets.google.com home
- Handling the "Blank spreadsheet" template button
- Dealing with Google account authentication walls

**What "done" looks like:**
- FSB navigates to sheets.google.com or a provided Sheet URL
- Creates a new blank spreadsheet (if needed)
- Sets up header row: Company | Role | Date Posted | Location | Description | Apply Link
- Enters all extracted job data, one row per job
- All 6 columns populated for each row

---

### TS-4: Vague Query Interpretation

**Why Expected:** Users are often vague. "Find me tech internships" does not specify a company, a role exactly, or a location. FSB needs to handle ambiguity gracefully rather than failing or asking for clarification on every detail.

**Complexity:** LOW -- The AI is inherently good at interpreting vague queries. The existing career shared guidance already handles this: "If user says 'find jobs at [company]' with no role specified, extract the first 3-5 listings." The AI just needs good prompt engineering to map vague terms to search queries. "Tech internships" becomes a search for "software engineering intern" or "technology intern" on career pages.

**Dependencies on Existing FSB:**
- AI natural language understanding -- inherent in the LLM
- Career shared guidance relevance rules -- already shipped

**Needs New Site Guide Data:** No

**What "done" looks like:**
- "Find me tech internships" -> AI searches for "software engineering intern" or similar on career pages
- "Find me jobs at big tech companies" -> AI interprets as Microsoft, Google, Amazon, Apple, Meta
- "Look for DevOps positions" -> AI searches multiple companies for "DevOps Engineer"

---

### TS-5: Deduplication Awareness

**Why Expected:** The same job may appear on a company's direct career page AND on Indeed or Glassdoor. If a user searches both, they do not want duplicate rows in their spreadsheet.

**Complexity:** LOW -- The AI can compare job titles, company names, and locations before adding a row. This is a prompt engineering task, not an architecture task. The existing career shared guidance already prioritizes direct company pages over job boards: "ALWAYS try the company's direct career page FIRST."

**Dependencies on Existing FSB:**
- Career shared guidance strategy priority -- already shipped

**Needs New Site Guide Data:** No

**What "done" looks like:**
- If the same "Software Engineer II" at Microsoft appears on both careers.microsoft.com and Indeed, FSB enters it once
- AI compares new extraction against already-collected data before adding

---

### TS-6: Error Reporting When No Results Found

**Why Expected:** If Microsoft has no "quantum computing intern" openings, the user needs to know. Silent failure (empty spreadsheet with no explanation) is the worst outcome.

**Complexity:** LOW -- The AI already has fallback strategies in the career prompt: "If no results on company site: try Indeed search." The addition is explicit reporting: "No matching positions found at [company] for [role]. Tried direct career page and Indeed."

**Dependencies on Existing FSB:**
- Career prompt fallback strategies -- already shipped
- Chat UI for progress reporting -- already shipped

**Needs New Site Guide Data:** No

**What "done" looks like:**
- FSB reports in the chat: "Found 4 jobs at Microsoft, 0 at Boeing (no quantum computing intern roles listed), 3 at Google"
- Empty companies are noted but do not produce empty rows in the Sheet

---

## Differentiators (What Makes This Amazing vs. Just Functional)

Features that transform "it works" into "this is incredible." Not expected, but once experienced, users would not go back.

---

### D-1: Formatted Google Sheets Output (Bold Headers, Colored Header Row, Auto-Sized Columns)

**Value Proposition:** The difference between a wall of text dumped into a Sheet and a professional-looking tracker. Users share these Sheets with friends, career counselors, and advisors. Formatting communicates care and professionalism.

**Complexity:** HIGH -- Google Sheets formatting cannot be done via the Sheets API (FSB is a browser extension, not a server-side app). All formatting must happen through keyboard shortcuts and toolbar interactions:
- **Bold headers:** Select row 1, press Ctrl+B. Requires selecting the row first (click row number "1" on the left gutter).
- **Header background color:** Select row 1, click the fill color toolbar button, pick a color from the palette. This involves clicking a dropdown widget, which is a DOM interaction on Google Sheets' toolbar -- possible but fragile.
- **Freeze header row:** View menu -> Freeze -> 1 row. Menu navigation via DOM clicks.
- **Auto-size columns:** Select all (Ctrl+A), then right-click column header -> "Resize columns" -> "Fit to data." Alternatively, double-click column border in the header row -- this is a positional click on a thin border, unreliable via automation.

The Google Sheets site guide needs significant enhancement to cover formatting workflows (toolbar button selectors, menu navigation paths, color picker interaction).

**Dependencies on Existing FSB:**
- Google Sheets site guide -- needs formatting workflow additions
- click, keyPress tools -- already shipped
- Google Docs formatted paste (Clipboard API) -- relevant precedent but Sheets uses different approach

**Needs New Site Guide Data:** YES -- Need selectors for Google Sheets toolbar: bold button, fill color button, color picker palette, View menu freeze option, Format menu. The crowd session log for docs.google.com shows the docs home page but may not have the Sheets editor toolbar elements.

---

### D-2: Structured Data Accumulator (Cross-Site State Management)

**Value Proposition:** Currently the AI relies on conversation history to remember extracted data across company transitions. This is fragile: if the context window fills up, earlier data gets truncated. A structured data accumulator would hold extracted job data in a reliable in-memory structure that persists across the entire multi-company workflow.

**Complexity:** MEDIUM -- This could be implemented as a session-level data store in background.js that the AI writes to after each company search and reads from when entering Sheets data. The AI would use a new tool like `storeJobData` and `getCollectedJobData`.

**Dependencies on Existing FSB:**
- Session management (background.js sessions) -- already shipped
- Tool library extensibility -- already designed for new tools

**Needs New Site Guide Data:** No

**What it enables:**
- After searching 10 companies, all 30-50 job listings are reliably stored
- No data loss from context window truncation
- Sheet entry phase reads from the accumulator, not from conversation memory
- Can report totals: "Collected 47 jobs across 10 companies"

---

### D-3: Progress Reporting During Multi-Company Search

**Value Proposition:** Searching 10 career sites takes 5-15 minutes. Without progress feedback, users think FSB is stuck. Progress reporting transforms anxiety into confidence.

**Complexity:** LOW -- FSB already has a chat UI and a progress overlay system. Adding messages like "Searching Microsoft... (1/5)" or "Found 3 jobs at Amazon, moving to Google (3/5)" is a prompt engineering enhancement plus minor UI work.

**Dependencies on Existing FSB:**
- Chat UI message display -- already shipped
- Progress overlay (ProgressOverlay class) -- already shipped

**Needs New Site Guide Data:** No

---

### D-4: Salary Information Extraction (When Available)

**Value Proposition:** Many career pages now show salary ranges (especially in states with pay transparency laws -- Colorado, New York, California, Washington). Users building comparison spreadsheets want salary data. An extra "Salary Range" column elevates the output significantly.

**Complexity:** LOW -- This is an extension of the 6-field extraction to 7 fields. The AI already extracts text from job listings; adding salary detection is a prompt instruction. The Google Sheets header row gets one more column.

**Dependencies on Existing FSB:**
- Career data extraction workflow -- already shipped
- getText tool -- already shipped

**Needs New Site Guide Data:** Site guides may need salary-related selectors for sites that display salary prominently (Glassdoor already has salary estimates as a feature).

---

### D-5: Apply Link Validation

**Value Proposition:** Dead or expired job links frustrate users. If FSB can verify that apply links actually lead to application pages (not 404s or expired listings), the output is more trustworthy.

**Complexity:** MEDIUM -- Would require FSB to briefly navigate to each apply link, check for error indicators (404 pages, "this position has been filled" messages), and note validity. This adds time to the workflow but significantly improves output quality.

**Dependencies on Existing FSB:**
- Navigation tools -- already shipped
- Page context detection (error message detection) -- already shipped in content/dom-analysis.js

**Needs New Site Guide Data:** No

---

### D-6: Smart Company Name Resolution

**Value Proposition:** Users say "Boeing" but the career site is jobs.boeing.com. Users say "Goldman" but it is goldmansachs.com/careers. Users say "J&J" but it is careers.jnj.com. Reliable company-to-career-URL mapping prevents wasted time on wrong sites.

**Complexity:** LOW -- This is largely handled by the existing strategy of Googling "[company name] careers." The crowd session logs provide a verified mapping of 34 company names to career URLs. This mapping can be embedded in site guides so the AI does not need to Google every time.

**Dependencies on Existing FSB:**
- Google search workflow -- already shipped
- Career site guides -- existing + new from session logs

**Needs New Site Guide Data:** YES -- Embed direct career URLs in per-company site guides. For example: Microsoft -> careers.microsoft.com, Amazon -> www.amazon.jobs, Meta -> www.metacareers.com.

---

### D-7: Sheet Title and Tab Naming

**Value Proposition:** Instead of "Untitled spreadsheet," the Sheet gets a meaningful name like "Job Search - Software Engineering - Feb 2026." Small touch, big difference in organization.

**Complexity:** LOW -- Click the title area in Google Sheets (which is a regular input field, unlike the canvas), type the title. Already feasible with existing tools.

**Dependencies on Existing FSB:**
- Google Sheets site guide -- needs title selector addition
- type, click tools -- already shipped

**Needs New Site Guide Data:** Minimal -- add the sheet title input selector.

---

## Anti-Features (Things to Deliberately NOT Build)

Features that seem useful but create serious problems for FSB's use case. These are deliberate scope exclusions with rationale.

---

### AF-1: Auto-Apply to Jobs

**Why Requested:** "Find jobs AND apply for me" is a natural extension. Auto-apply tools (LazyApply, Simplify, LoopCV) are a hot market segment.

**Why Problematic:**
- **Legal and ethical risk:** Submitting applications on behalf of users without their explicit per-application approval crosses a line. Employers increasingly penalize auto-applied candidates.
- **Quality destruction:** Mass auto-apply generates low-quality applications. Employers detect and filter these.
- **Authentication walls:** Most application forms require login, personal info, resume upload, and custom responses. FSB cannot fill these reliably.
- **Irreversibility:** Applying cannot be undone. A bug that applies to the wrong job has real consequences.
- **Scope explosion:** Application forms vary wildly (Workday multi-step, Lever single-page, Greenhouse with custom questions). Supporting even 10 ATS platforms is a major engineering effort.

**What to Do Instead:** FSB provides the "Apply Link" column so users can click and apply themselves. The value is in discovery and organization, not submission.

---

### AF-2: Scraping Behind Login Walls

**Why Requested:** LinkedIn Jobs, some Glassdoor listings, and enterprise Workday portals require authentication for full job descriptions.

**Why Problematic:**
- **TOS violations:** Automated access to authenticated sessions is explicitly prohibited by LinkedIn, Glassdoor, and most job boards.
- **Account risk:** Users' accounts could be flagged or banned for automated behavior.
- **Session security:** FSB would need to operate within authenticated sessions, creating security surface area.
- **Credential handling:** FSB should never store, manage, or interact with user credentials beyond what is needed for its own API keys.

**What to Do Instead:** Stick to public career pages (direct company sites are almost always public). If a job board requires login, note the limitation in the chat and skip that source. The career shared guidance already warns: "Indeed may require login to apply -- note when auth walls appear."

---

### AF-3: Real-Time Job Monitoring / Alerts

**Why Requested:** "Notify me when new software engineering jobs are posted at Google." Continuous monitoring sounds like a natural extension.

**Why Problematic:**
- **Chrome Extension lifecycle:** Manifest V3 service workers are terminated after 5 minutes of inactivity. Continuous background polling is architecturally impossible without a separate server.
- **Rate limiting:** Repeatedly hitting career sites would trigger anti-bot measures.
- **Scope creep:** This transforms FSB from a task automation tool into a job board aggregator, which is a fundamentally different product.

**What to Do Instead:** Users can run the career search task periodically ("Find me new SWE jobs at Google this week"). Each run produces a fresh Sheet. Manual triggers, not automated monitoring.

---

### AF-4: Resume/Cover Letter Generation

**Why Requested:** Tools like Teal, Huntr, and Jobright offer AI-generated resumes tailored to each job listing.

**Why Problematic:**
- **Different product:** Resume generation is a document creation task, not a browser automation task. It requires different AI capabilities (writing quality, formatting, PDF generation).
- **Quality bar:** Bad auto-generated resumes harm users' job prospects. This is high-stakes output that requires careful human review.
- **Scope explosion:** Resume formatting, ATS keyword optimization, template selection -- each is a feature unto itself.

**What to Do Instead:** FSB extracts job descriptions so users can feed them into dedicated resume tools. The "Description" column gives users the raw material for manual tailoring.

---

### AF-5: Excessive Data Extraction Per Job (Full Job Description)

**Why Requested:** Users might want the complete multi-paragraph job description in the spreadsheet.

**Why Problematic:**
- **Spreadsheet readability:** Full job descriptions (500-2000 words each) in a cell make the Sheet unusable. Cells become walls of text that break the tabular format.
- **Extraction time:** Reading and copying full descriptions multiplies the time per job by 3-5x.
- **Context window pressure:** Storing full descriptions for 30+ jobs would exceed the AI's context limits.

**What to Do Instead:** Extract a 1-2 sentence summary of key responsibilities (as the current prompt specifies). The apply link lets users read the full description when they want it.

---

### AF-6: Comparison Scoring or Ranking

**Why Requested:** "Rank these jobs by relevance" or "score each job match on a 1-10 scale."

**Why Problematic:**
- **Subjective:** Job fit depends on resume, experience, preferences, and career goals that FSB does not know.
- **False confidence:** An AI-generated "fit score" of 8/10 might mislead users into not reading the job description.
- **Liability:** If FSB ranks a poor-fit job highly and the user applies based on the score, it creates a negative experience.

**What to Do Instead:** Present all matching jobs in the Sheet and let users sort, filter, and evaluate themselves. The structured format (company, title, location, salary) already enables human comparison.

---

## Feature Dependencies

```
TS-1 (Single-Company Search)
    |
    +-- TS-2 (Multi-Company Sequential) -- requires TS-1 working reliably
    |       |
    |       +-- D-2 (Data Accumulator) -- enhances TS-2 reliability
    |       |
    |       +-- D-3 (Progress Reporting) -- enhances TS-2 UX
    |
    +-- TS-3 (Google Sheets Data Entry) -- independent of TS-2, can work with TS-1 alone
    |       |
    |       +-- D-1 (Formatted Output) -- enhances TS-3 with styling
    |       |
    |       +-- D-7 (Sheet Title) -- enhances TS-3 with naming
    |
    +-- TS-4 (Vague Query) -- enhances TS-1, no hard dependency
    |
    +-- TS-5 (Deduplication) -- needed once TS-2 exists (multi-source risk)
    |
    +-- TS-6 (Error Reporting) -- enhances TS-1 and TS-2
    |
    +-- D-4 (Salary Extraction) -- extends TS-1 extraction, minor addition
    |
    +-- D-5 (Apply Link Validation) -- independent, applies after TS-1
    |
    +-- D-6 (Company Name Resolution) -- enhances TS-1 navigation phase

Site Guide Parsing (prerequisite for all):
    Session logs -> Per-company site guides -> Sitemaps
    (This is the data pipeline that feeds TS-1 reliability)
```

### Dependency Notes

- **TS-2 requires TS-1:** Cannot search multiple companies if single-company search is unreliable.
- **TS-3 is parallel to TS-2:** Sheets entry can be tested with data from one company. Does not require multi-company to work first.
- **D-1 requires TS-3:** Cannot format a Sheet that has no data in it yet.
- **D-2 enhances TS-2:** Without the accumulator, multi-company data relies on conversation memory (fragile but functional).
- **Site guide parsing is the critical prerequisite:** The 34 crowd session logs must be converted into usable site guides before any career search feature works reliably at scale.

---

## MVP Definition

### Launch With (v9.4 Core)

The minimum that satisfies "find me internships and put them in a spreadsheet":

- [ ] **Site guide parsing pipeline** -- Convert 34 crowd session logs into per-company site guides with selectors (search box, job cards, title, location, date, apply link, pagination). Without this, the AI is flying blind on most company career pages.
- [ ] **TS-1: Single-company search** -- Navigate one career site, search, extract 3-5 jobs with 6 fields. This must work on at least 20 of the 34 companies.
- [ ] **TS-2: Multi-company sequential search** -- Handle prompts naming 2-10 companies. Visit each sequentially, accumulate data in conversation memory.
- [ ] **TS-3: Google Sheets basic data entry** -- Create Sheet, set up headers, enter rows with Tab/Enter pattern.
- [ ] **TS-4: Vague query handling** -- Interpret "tech internships" and "DevOps positions" correctly.
- [ ] **TS-6: Error reporting** -- Report which companies had no results.

### Add After Core Works (v9.4.x)

- [ ] **D-1: Formatted output** -- Bold headers, colored header row, frozen header. Add once basic data entry is reliable.
- [ ] **D-2: Data accumulator** -- Structured data store for multi-company workflows. Add if conversation memory proves too fragile.
- [ ] **D-3: Progress reporting** -- "Searching Microsoft... (2/5)". Add for UX polish.
- [ ] **D-6: Company name resolution** -- Embed direct career URLs in site guides. Add to reduce Google search overhead.
- [ ] **D-7: Sheet title naming** -- "Job Search - SWE Internships - Feb 2026". Quick UX win.
- [ ] **TS-5: Deduplication** -- Add once multi-source search is common.

### Future Consideration (v9.5+)

- [ ] **D-4: Salary extraction** -- Needs per-site salary selector identification
- [ ] **D-5: Apply link validation** -- Adds significant time per job, defer until speed is acceptable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|-----------|--------------------:|----------|-------|
| Site guide parsing (34 sites) | HIGH | HIGH | P0 | Data pipeline |
| TS-1: Single-company search | HIGH | MEDIUM | P1 | Core |
| TS-2: Multi-company sequential | HIGH | HIGH | P1 | Core |
| TS-3: Sheets basic data entry | HIGH | MEDIUM | P1 | Core |
| TS-4: Vague query handling | MEDIUM | LOW | P1 | Core |
| TS-6: Error reporting | MEDIUM | LOW | P1 | Core |
| D-1: Formatted output | MEDIUM | HIGH | P2 | Polish |
| D-2: Data accumulator | HIGH | MEDIUM | P2 | Reliability |
| D-3: Progress reporting | MEDIUM | LOW | P2 | Polish |
| D-6: Company name resolution | MEDIUM | LOW | P2 | Optimization |
| D-7: Sheet title naming | LOW | LOW | P2 | Polish |
| TS-5: Deduplication | LOW | LOW | P2 | Data quality |
| D-4: Salary extraction | LOW | LOW | P3 | Future |
| D-5: Apply link validation | LOW | MEDIUM | P3 | Future |

**Priority key:**
- P0: Prerequisite -- must exist before any feature works
- P1: Must have for launch -- the core "find jobs, put in Sheet" workflow
- P2: Should have -- reliability, UX polish, and optimization
- P3: Nice to have -- future enhancement

---

## Competitor Feature Analysis

| Feature | JobPilot | Teal | Simplify | FSB (Our Approach) |
|---------|----------|------|----------|-------------------|
| Multi-site search | No (single-board autofill) | No (manual entry) | No (autofill only) | YES -- navigate actual career sites |
| Job tracking spreadsheet | Yes (built-in tracker) | Yes (built-in tracker) | No | YES -- real Google Sheet user owns |
| Data extraction | Basic (title, company) | Saves job details | Auto-populates from listing | Full 6-field extraction via DOM |
| Formatting | Built-in UI styling | Built-in UI styling | N/A | Google Sheets native formatting |
| Direct company career pages | No (job boards only) | No (job boards only) | No (job boards only) | YES -- prioritizes direct career pages |
| Auto-apply | No | No | Yes (autofill) | NO -- deliberately excluded |
| Resume tailoring | No | Yes | Yes | NO -- out of scope |
| Price | $9-29/mo | Free/Premium | Free/Premium | Free (user's own AI API key) |

**FSB's differentiator vs. competitors:** FSB navigates actual company career pages (not just job board aggregators) and produces a real Google Sheet that the user owns and controls. Competitors are either (a) job board extensions that only work on Indeed/LinkedIn, or (b) application trackers that require manual data entry. FSB automates the full pipeline: discovery + extraction + organization.

---

## User Workflow Scenarios

### Scenario 1: Specific Multi-Company Search
**Input:** "Find all software engineering internships at Microsoft, Amazon, and Google and put them in a Google Sheet"
**Expected behavior:**
1. FSB navigates to careers.microsoft.com, searches "software engineering intern," extracts 3-5 matches
2. FSB navigates to www.amazon.jobs, searches same, extracts 3-5 matches
3. FSB navigates to careers.google.com, searches same, extracts 3-5 matches
4. FSB creates a new Google Sheet titled "SWE Internships - Feb 2026"
5. Sets up header row: Company | Role | Date Posted | Location | Description | Apply Link
6. Enters all extracted jobs (9-15 rows)
7. Reports: "Found 4 at Microsoft, 5 at Amazon, 3 at Google. 12 jobs entered into Google Sheet."

### Scenario 2: Vague Query
**Input:** "Find me tech internships"
**Expected behavior:**
1. FSB interprets "tech internships" broadly -- searches for "technology intern" or "software intern"
2. AI decides which companies to search (top tech employers or asks user to specify)
3. Searches 3-5 career sites
4. Extracts matching positions
5. Enters into a new Google Sheet

### Scenario 3: Single Company, Specific Role
**Input:** "Find DevOps Engineer positions at Boeing"
**Expected behavior:**
1. FSB navigates to jobs.boeing.com (via Google search or site guide URL)
2. Searches "DevOps Engineer"
3. Extracts all matching positions (may be 0-10)
4. If 0 results: reports "No DevOps Engineer positions found at Boeing"
5. If results found: enters into Sheet or reports in chat

### Scenario 4: Existing Sheet
**Input:** "Find data science jobs at Goldman Sachs and add to [Google Sheets URL]"
**Expected behavior:**
1. FSB navigates to Goldman Sachs careers
2. Searches "data science"
3. Extracts matches
4. Navigates to the provided Sheet URL
5. Finds the next empty row (does not overwrite existing data)
6. Enters new data starting from that row

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| Table stakes features | HIGH | Based on direct codebase analysis, existing prompt templates, site guides, and tools. Clear what exists and what gaps remain. |
| Differentiator feasibility | MEDIUM | Google Sheets formatting via browser automation is feasible (toolbar buttons exist in DOM) but untested at this level of detail. Bold and freeze should work. Color picker interaction is uncertain. |
| Anti-features rationale | HIGH | Based on competitive landscape research, Chrome Extension MV3 architecture constraints, and FSB design principles. Auto-apply exclusion is well-supported by industry evidence. |
| Complexity estimates | MEDIUM | Based on existing codebase understanding but not validated against actual implementation. Multi-company orchestration complexity may be higher than estimated if conversation memory proves insufficient. |
| Competitor analysis | MEDIUM | Based on WebSearch results. Competitor features may have changed since search results were generated. Core competitive positioning is sound. |

---

## Sources

**Codebase analysis (HIGH confidence):**
- ai-integration.js TASK_PROMPTS.career (lines 262-331): Existing 6-phase career workflow
- site-guides/career/_shared.js: Career category shared guidance with 6-field extraction, strategy priority
- site-guides/career/generic.js: Generic ATS platform guide with selectors and workflows
- site-guides/career/indeed.js, glassdoor.js, builtin.js: Per-site career guides
- site-guides/productivity/google-sheets.js: Google Sheets Name Box navigation and data entry workflows
- background.js classifyTask(): Multitab and career task type detection
- content/actions.js: openNewTab, switchToTab multi-tab tools
- /logs/ directory: 34 crowd session logs with DOM snapshots

**Competitive landscape (MEDIUM confidence):**
- [12 Best AI Job Search Tools in 2026](https://jobcopilot.com/best-ai-job-search-tools/)
- [15 Best Chrome Extensions for Job Seekers in 2026](https://www.jobpilotapp.com/blog/best-chrome-extensions-job-seekers)
- [Best Job Searching Tools 2026](https://www.frontlinesourcegroup.com/blog-2026-job-search-tools.html)
- [7 Best AI Job Search Tools 2026](https://www.flashfirejobs.com/blog/ai-job-search-tools)
- [6 Best Tools for Automating Your Job Search](https://scale.jobs/blog/6-best-tools-for-automating-your-job-search)
- [AI Auto-Apply Tools vs Traditional Job Search 2026](https://careerattraction.com/ai-auto-apply-tools-vs-traditional-job-search-in-2026/)

**Job search spreadsheet expectations (MEDIUM confidence):**
- [How to Use a Job Search Spreadsheet - Teal](https://www.tealhq.com/post/job-search-tracking-spreadsheet)
- [Job Search Spreadsheet Guide - Indeed](https://www.indeed.com/career-advice/finding-a-job/job-search-spreadsheet)
- [Free Job Application Tracker Spreadsheet](https://spreadsheetpoint.com/templates/job-tracker-spreadsheet/)
- [Job Application Tracker Templates - BeamJobs](https://www.beamjobs.com/career-blog/job-application-tracker-google-sheets)
- [Free Job Application Tracker Google Sheets 2026](https://clickup.com/blog/job-search-google-sheets-templates/)

**Google Sheets formatting (MEDIUM confidence):**
- [Basic Formatting - Google Sheets API](https://developers.google.com/sheets/api/samples/formatting)
- [Keyboard shortcuts for Google Sheets](https://support.google.com/docs/answer/181110)
- [Google Sheets Shortcuts - Zapier](https://zapier.com/blog/google-sheets-shortcuts/)

**Job data extraction challenges (MEDIUM confidence):**
- [Web Scraping Job Postings Guide - Octoparse](https://www.octoparse.com/blog/web-scraping-job-postings)
- [Ultimate Guide to Web Scraping Job Boards - Bardeen](https://www.bardeen.ai/answers/how-to-web-scrape-employer-job-boards)
- [Job Scraping Explained 2025 - JobsPikr](https://www.jobspikr.com/blog/guide-to-job-scraping/)

---
*Feature research for: Career Search Automation + Google Sheets Output*
*Researched: 2026-02-23*
*Milestone: v9.4*
