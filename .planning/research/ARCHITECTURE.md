# Architecture: Career Search Automation Pipeline

**Domain:** Session log -> sitemap -> site guide -> AI automation pipeline for career search + Google Sheets
**Researched:** 2026-02-23
**Overall Confidence:** HIGH (based on direct analysis of all pipeline components in the codebase)

---

## Executive Summary

FSB already has every major subsystem needed for career search automation. The architecture question is not "what needs to be built from scratch" but "how do the existing subsystems connect for this specific workflow." The answer is a pipeline with 5 stages, each mapping directly to existing code:

1. **PARSE** -- Session logs (JSON in `/logs/`) already match the format `convertToSiteMap()` expects
2. **STORE** -- `createSiteMapMemory()` and `memoryStorage.add()` already persist sitemaps
3. **GUIDE** -- Site guides already exist for career category (4 files) and Google Sheets
4. **EXECUTE** -- Multi-tab tools (`openNewTab`, `switchToTab`, `listTabs`) and the `career` + `multitab` task types already exist
5. **FORMAT** -- The Google Sheets site guide already documents the canvas-based Name Box workflow

The primary gap is a **batch orchestration layer** -- the ability to run the career search workflow across N companies in sequence, accumulating extracted data and writing it to a single Sheets document. FSB's current session model handles one task at a time. The AI handles multi-step reasoning within a session, but there is no built-in mechanism for "repeat this workflow for each item in a list."

---

## Current Architecture (Relevant Subsystems)

### 1. Session Log Format (Input)

Session logs in `/logs/` are produced by `SiteExplorer` (BFS crawler). Each JSON file contains:

```
{
  "domain": "www.amazon.jobs",
  "id": "research_1771837691120",
  "pages": [
    {
      "depth": 0,
      "url": "https://www.amazon.jobs/",
      "title": "Amazon Jobs",
      "forms": [],
      "headings": [],
      "interactiveElements": [
        {
          "type": "input",
          "id": "search_typeahead-homepage",
          "class": "form-control tt-input",
          "selectors": ["[role=\"combobox\"]...", "#search-button"],
          "text": "..."
        }
      ],
      "internalLinks": [...],
      "navigation": [...]
    }
  ]
}
```

**Key observation:** This is the exact format `convertToSiteMap()` in `lib/memory/sitemap-converter.js` already consumes. The converter extracts pages, navigation, forms, keySelectors, and pageElements from this structure.

### 2. Sitemap Conversion Pipeline (PARSE -> STORE)

The existing pipeline is two-tier:

```
Session Log (JSON)
       |
       v
convertToSiteMap(research)          -- Tier 1: local extraction (lib/memory/sitemap-converter.js)
       |
       v
sitePattern object (pages, navigation, forms, keySelectors, pageElements, pageLinks)
       |
       v
refineSiteMapWithAI(sitePattern)    -- Tier 2: AI enrichment (lib/memory/sitemap-refiner.js)
       |                               Adds: workflows, tips, pagePurposes, selectorPreferences,
       |                                     navigationStrategy
       v
createSiteMapMemory(domain, sitePattern)  -- Wraps in memory schema (lib/memory/memory-schemas.js)
       |
       v
memoryStorage.add(memory)           -- Persists to chrome.storage.local (lib/memory/memory-storage.js)
```

**Entry points that already trigger this pipeline:**
- `SiteExplorer.autoConvertToMemory()` -- called when a crawl completes with `autoSaveToMemory: true`
- `ui/options.js` line 3249 -- manual conversion button in the Options page UI

**The gap:** Neither entry point is designed for batch processing of pre-existing session logs from `/logs/`. The Options page UI converts one research entry at a time from `fsbResearchData` in chrome.storage, not from files on disk. The logs in `/logs/` are standalone JSON files that were exported from the crawler but may not be in `fsbResearchData`.

### 3. Site Guide System (GUIDE)

Site guides register at extension load time via `importScripts()` in `background.js`:

```
background.js
  |-- importScripts('site-guides/index.js')           -- Registry: registerSiteGuide(), getGuideForUrl()
  |-- importScripts('site-guides/career/_shared.js')   -- Category guidance: strategy, data fields, warnings
  |-- importScripts('site-guides/career/indeed.js')    -- Indeed-specific selectors, workflows
  |-- importScripts('site-guides/career/glassdoor.js') -- Glassdoor-specific selectors, workflows
  |-- importScripts('site-guides/career/builtin.js')   -- BuiltIn-specific selectors, workflows
  |-- importScripts('site-guides/career/generic.js')   -- Generic ATS patterns (Lever, Greenhouse, Workday)
  |-- importScripts('site-guides/productivity/google-sheets.js') -- Sheets Name Box workflow
```

**Guide matching flow during automation:**

```
ai-integration.js:1975  getGuideForTask(task, currentUrl)
       |
       v
site-guides/index.js:109  getGuideForUrl(url) -- tests URL against guide.patterns[]
       |                                          e.g., /indeed\.com/i, /glassdoor\.(com|co\.\w+)/i
       v                                          /\/careers\/?/i, /\/jobs\/?/i (generic.js)
(matched guide) --> ai-integration.js:3921  _buildTaskGuidance(taskType, siteGuide, currentUrl)
       |
       v
Prompt injection:
  - Category guidance (e.g., "CAREER & JOB SEARCH INTELLIGENCE: STRATEGY PRIORITY...")
  - Site-specific guidance (e.g., "INDEED-SPECIFIC INTELLIGENCE: SEARCH...")
  - Known selectors (e.g., "searchBox: #text-input-what, .yosegi-InlineWhatWhere...")
  - Workflows (e.g., "searchJobs: Navigate to indeed.com -> Enter keywords -> ...")
  - Warnings (e.g., "Sponsored listings appear first -- skip unless...")
```

**Coverage assessment for career sites:**

| Site | Has Guide? | Guide Type | Patterns Matched |
|------|-----------|------------|-----------------|
| indeed.com | Yes | Per-site | `/indeed\.com/i` |
| glassdoor.com | Yes | Per-site | `/glassdoor\.(com\|co\.\w+)/i` |
| builtin.com | Yes | Per-site | `/builtin\.com/i` |
| amazon.jobs | No (matched by generic) | Generic ATS | `/\/jobs\/?/i` |
| careers.microsoft.com | No (matched by generic) | Generic ATS | `/\/careers\/?/i` |
| linkedin.com/jobs | Yes (social guide) | Per-site | `/linkedin\.com/i` |
| myworkdayjobs.com | No (matched by generic) | Generic ATS | `/myworkdayjobs\.com/i` |
| lever.co | No (matched by generic) | Generic ATS | `/lever\.co/i` |
| greenhouse.io | No (matched by generic) | Generic ATS | `/greenhouse\.io/i` |
| Any URL with /careers/ | Matched by generic | Generic ATS | `/\/careers\/?/i` |

**The generic.js guide is the critical fallback.** It matches any URL containing `/careers/`, `/jobs/`, or known ATS domain patterns. This means most of the 35+ session logs will match the generic guide without needing per-site guides. However, per-site guides with precise selectors significantly improve automation success rates.

### 4. Site Map Knowledge Injection (GUIDE, parallel channel)

In addition to site guides (hardcoded), the AI also receives site map knowledge (dynamically generated from crawl data):

```
ai-integration.js:1411  _fetchSiteMap(context)
       |
       v
background.js:4053  'getSiteMap' message handler
       |-- Priority 1: loadBundledSiteMap(domain) -- checks site-maps/{domain}.json
       |-- Priority 2: memoryManager.getAll() -- finds site_map memories by domain
       v
ai-integration.js:2541  formatSiteKnowledge(siteMap, domain)
       |
       v
Injected into user prompt:
  "=== SITE KNOWLEDGE (careers.microsoft.com):
   Pages: /careers - Microsoft Careers, /careers/search - Job Search (2 forms)...
   Navigation: Job Search -> /careers/search, Students -> /careers/students...
   Workflows: Job search: /careers -> use search form -> click result -> /careers/view/{id}
   Tips: AJAX loading on search results, multi-step application forms...
   Nav strategy: Start at /careers, use search form for filtering
   Key selectors: /careers/search: input[name=q], .job-card, .job-title..."
```

**This is the bridge between session logs and AI prompt.** When session logs are converted to sitemaps and stored in memory, the AI automatically receives site-specific navigation intelligence even without a hardcoded site guide.

### 5. Multi-Tab Orchestration (EXECUTE)

FSB already supports multi-tab workflows through these mechanisms:

**Task type detection:**
```javascript
// ai-integration.js:4009-4016
const outputDestinations = ['google doc', 'google sheet', 'spreadsheet', ...];
const gatherActions = ['find', 'search', 'research', 'look up', ...];
if (hasOutputDest && hasGatherAction) return 'multitab';
```

A task like "find software engineer jobs at Microsoft and add them to a Google Sheet" triggers `multitab` task type.

**Tab management tools available to AI:**
- `openNewTab({url, active})` -- opens new tab, returns tabId, adds to `session.allowedTabs`
- `switchToTab({tabId})` -- switches to allowed tab, updates `session.tabId`
- `listTabs({currentWindowOnly})` -- lists all tabs with isAllowedTab flag
- `closeTab({tabId})` -- closes non-current tab
- `waitForTabLoad({tabId, timeout})` -- waits for tab to finish loading
- `getCurrentTab()` -- gets current tab info

**Security model:**
- `session.allowedTabs` is pre-populated with all non-restricted tabs in the current window
- Tabs opened by `openNewTab` are automatically added to `allowedTabs`
- `switchToTab` enforces whitelist -- blocks switching to unauthorized tabs
- Content script injection is restricted to authorized tabs only

**Tab context in AI prompt:**
```javascript
// background.js:6945-6975
tabInfo = {
  currentTabId: session.tabId,
  allTabs: allTabs.map(tab => ({
    id: tab.id, url: tab.url, title: tab.title,
    active: tab.active, status: tab.status,
    isAllowedTab: allowedTabs.includes(tab.id),
    domain: new URL(tab.url).hostname
  })),
  sessionTabs, allowedTabs
};
```

**The `career` task prompt already includes multi-tab phases:**
```
PHASE 4 -- NAVIGATE TO GOOGLE SHEETS
PHASE 5 -- SET UP HEADERS (Company, Role, Date Posted, Location, Description, Apply Link)
PHASE 6 -- ENTER ROW DATA (Tab-separated entry via Name Box)
```

### 6. Google Sheets Interaction (FORMAT)

The Sheets site guide (`site-guides/productivity/google-sheets.js`) documents the canvas-based interaction model:

```
1. Click Name Box (#t-name-box) -- the cell reference input at top-left
2. Type cell reference (e.g., "A1") and press Enter
3. Type cell value
4. Press Tab (next column) or Enter (next row)
```

**Key workflows already defined:**
- `createNewSheet` -- navigate to sheets.google.com, click Blank template
- `navigateToExistingSheet` -- navigate to URL, wait for Name Box
- `setupHeaderRow` -- A1, type "Company", Tab, type "Role", Tab, ...
- `enterRowData` -- Click Name Box, type "A2", Enter, type value, Tab, ...
- `navigateToCell` -- Click Name Box, type reference, Enter

**Critical warning in guide:**
> Google Sheets cells are rendered on a CANVAS -- you CANNOT click individual cells via DOM selectors. Always use the Name Box for cell navigation.

---

## Integration Architecture for Career Search

### Data Flow (End-to-End)

```
SESSION LOGS (/logs/*.json)
       |
       | [NEW: Batch log parser]
       v
convertToSiteMap(research) x N     -- existing Tier 1 converter
       |
       v
refineSiteMapWithAI(sitePattern)    -- existing Tier 2 AI refiner (optional, costs API tokens)
       |
       v
createSiteMapMemory(domain, sitePattern)  -- existing memory creator
       |
       v
memoryStorage.add(memory) x N      -- stored in chrome.storage.local
       |
       | [At automation time, automatic lookup:]
       v
User prompt: "Find software engineer jobs at Microsoft, Apple, Amazon and add to Google Sheet"
       |
       v
detectTaskType() -> 'career' (has career keywords) or 'multitab' (has output destination)
       |
       | Note: Task type becomes 'multitab' because it mentions Google Sheet + gather action
       v
For each company, the AI:
  1. Navigates to company career page (guided by site guide + site map knowledge)
  2. Searches for matching jobs (guided by selectors from site guide or site map)
  3. Extracts job data (Company, Role, Date, Location, Description, Apply Link)
  4. Switches to Google Sheets tab
  5. Enters data row (guided by Sheets site guide Name Box workflow)
  6. Switches back to next company
       |
       v
Google Sheet with job listings
```

### Component Map (Existing vs New)

| Component | Status | File(s) | Changes Needed |
|-----------|--------|---------|----------------|
| Session log parser | EXISTING | `lib/memory/sitemap-converter.js` | Minor: add batch entry point |
| Sitemap refiner | EXISTING | `lib/memory/sitemap-refiner.js` | None |
| Memory storage | EXISTING | `lib/memory/memory-storage.js`, `memory-schemas.js` | None |
| Site map retrieval | EXISTING | `background.js:4053` (`getSiteMap`) | None |
| Site map injection | EXISTING | `ai-integration.js:2541` (`formatSiteKnowledge`) | None |
| Career category guide | EXISTING | `site-guides/career/_shared.js` | Minor: refine strategy |
| Generic ATS guide | EXISTING | `site-guides/career/generic.js` | Minor: add more ATS patterns from logs |
| Indeed/Glassdoor/BuiltIn guides | EXISTING | `site-guides/career/{site}.js` | None |
| Google Sheets guide | EXISTING | `site-guides/productivity/google-sheets.js` | None |
| Multi-tab tools | EXISTING | `background.js:6002` (`handleMultiTabAction`) | None |
| Multi-tab context | EXISTING | `background.js:6945` (tab context gathering) | None |
| Career task prompt | EXISTING | `ai-integration.js:262` (`TASK_PROMPTS.career`) | Moderate: enhance for batch |
| Multitab task prompt | EXISTING | `ai-integration.js:194` (`TASK_PROMPTS.multitab`) | Minor: career-specific tips |
| Task type detection | EXISTING | `ai-integration.js:3986` (`detectTaskType`) | None |
| **NEW: Batch log import** | NEW | TBD: `utils/log-importer.js` or Options page | Reads `/logs/` JSON, runs batch convert |
| **NEW: Per-company site guides** | NEW | `site-guides/career/{company}.js` | Generated from session logs |
| **NEW: Site guide generator** | NEW | TBD: `utils/guide-generator.js` | Converts sitePattern to registerSiteGuide format |

### Integration Points (Where New Code Touches Existing)

#### Integration Point 1: Log Import -> Sitemap Pipeline

**Where:** New utility that reads session log JSON and feeds it through existing `convertToSiteMap()` + `createSiteMapMemory()` pipeline.

**Existing code path:** `SiteExplorer.autoConvertToMemory()` (utils/site-explorer.js:709-764) already does exactly this for live crawl results. The new code replicates this logic for pre-existing JSON files.

**Implementation options:**

**Option A: Build-time script (RECOMMENDED for initial setup)**
A Node.js script that reads `/logs/*.json`, runs `convertToSiteMap()`, and produces output artifacts:
- Site map JSON files in `site-maps/{domain}.json` (bundled, highest priority in `loadBundledSiteMap`)
- Site guide JS files in `site-guides/career/{company}.js` (registered at load time)

Advantages: No runtime cost, guides are available immediately, works offline.
Disadvantage: Requires running the script when logs change.

**Option B: Options page UI (for ongoing use)**
Add a "Batch Import" button to the Options page that reads session logs from `fsbResearchData` storage and batch-converts them to site map memories.

**Option C: Background script import handler**
A message handler in `background.js` that accepts JSON content and runs the pipeline.

**Recommendation:** Use Option A for the 35+ existing logs (one-time setup), then Option B for ongoing imports from new crawls.

#### Integration Point 2: Site Guide Generation from Sitemaps

**Where:** Convert sitemap data (pages, selectors, forms, workflows) into `registerSiteGuide()` format.

**Existing format target:**
```javascript
registerSiteGuide({
  site: 'Amazon Jobs',
  category: 'Career & Job Search',
  patterns: [/amazon\.jobs/i, /www\.amazon\.jobs/i],
  guidance: `AMAZON JOBS-SPECIFIC INTELLIGENCE:...`,
  selectors: {
    searchBox: '[role="combobox"][aria-labelledby="search_typeahead-homepage-label"]',
    searchButton: '#search-button',
    locationInput: '[role="combobox"][aria-labelledby="location-typeahead-homepage-label"]'
  },
  workflows: {
    searchJobs: ['Navigate to amazon.jobs', 'Enter keywords in search box', ...],
    extractJobData: ['Get job title from listing', ...]
  },
  warnings: ['Amazon Jobs uses typeahead search -- wait for suggestions before pressing Enter'],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', ...]
});
```

**Generation logic:** Extract from session log interactive elements:
- Input elements with search-related ids/classes -> `selectors.searchBox`
- Button elements near search inputs -> `selectors.searchButton`
- Elements with location-related attributes -> `selectors.locationInput`
- Job-card-like containers -> `selectors.jobCards`
- Apply links/buttons -> `selectors.applyButton`

This can be done with heuristics (pattern matching on element attributes) or by feeding the session log through AI refinement (existing `refineSiteMapWithAI` already produces workflows and tips).

#### Integration Point 3: Career Task Prompt Enhancement

**Where:** `ai-integration.js` line 262, `TASK_PROMPTS.career`

The current career prompt defines 6 phases (Navigate, Search, Extract, Navigate to Sheets, Set Up Headers, Enter Row Data). For batch multi-company workflows, the prompt needs:

**Additions needed:**
- Batch iteration instructions ("Process each company in the user's list one by one")
- Data accumulation strategy ("Remember extracted data across tab switches")
- Row tracking ("Keep track of which row you are on in the spreadsheet -- A2, A3, A4, etc.")
- Error recovery per company ("If a company's career page has no results, skip and move to the next")
- Completion criteria ("Mark complete only after ALL companies have been processed")

**No structural changes to the prompt system.** This is content modification within the existing `TASK_PROMPTS.career` string.

#### Integration Point 4: background.js Import Registration

**Where:** `background.js` lines 73-77 (site guide importScripts for career category)

New per-company site guides need to be registered via `importScripts()`:

```javascript
// Per-site guides: Career (generated from session logs)
importScripts('site-guides/career/amazon-jobs.js');
importScripts('site-guides/career/microsoft-careers.js');
importScripts('site-guides/career/apple-careers.js');
// ... etc for each company with a session log
```

**Alternative:** Use bundled site maps instead of site guides. Site maps are loaded dynamically from `site-maps/{domain}.json` by `loadBundledSiteMap()` and injected into the prompt by `formatSiteKnowledge()`. This avoids modifying background.js for each new company.

**Recommendation:** Use BOTH channels:
- **Bundled site maps** for navigation intelligence (pages, links, forms) -- generated from session logs
- **Per-company site guides** only for the most important companies with hand-tuned selectors

This is the existing pattern: the generic.js guide provides fallback coverage, per-site guides provide precision for high-priority sites, and site maps provide domain-specific navigation context.

---

## Multi-Tab Workflow Architecture

### Single-Session Multi-Tab (Current Model)

FSB already handles multi-tab within a single session. The AI decides when to open/switch tabs.

```
Session Start (user sends task)
  |
  v
AI iteration 1: Navigate to careers.microsoft.com
AI iteration 2: Search for "software engineer"
AI iteration 3: Extract job data from result 1
AI iteration 4: Extract job data from result 2
AI iteration 5: openNewTab({url: "https://sheets.google.com"})
  |-- background.js adds new tabId to session.allowedTabs
AI iteration 6: Create blank spreadsheet
AI iteration 7: Set up header row (A1: Company, B1: Role, ...)
AI iteration 8: Enter data row 1 (A2: Microsoft, B2: Software Engineer, ...)
AI iteration 9: Enter data row 2 (A3: Microsoft, B3: Senior SWE, ...)
  |
  v
For next company:
AI iteration 10: switchToTab(originalTabId) -- back to career site
AI iteration 11: Navigate to careers.apple.com
...
AI iteration 15: switchToTab(sheetsTabId) -- back to Sheets
AI iteration 16: Enter data row 3 (A4: Apple, ...)
...
```

**This model works for 2-3 companies** within the default 20 iteration limit. For larger batches (10+ companies), iterations may be exhausted.

### Batch Strategy Options

**Option A: Increase max iterations for career tasks**
Set `session.maxIterations` to 50-100 for career batch tasks. Simple, but uses more API tokens per session.

**Option B: Session continuity (existing feature)**
FSB already supports session continuity (`conversationId`, `commandCount`). User sends follow-up commands to the same session:
- "Find jobs at Microsoft, Apple, Amazon and add to this Google Sheet"
- (session completes first batch or runs out of iterations)
- "Continue -- add Google, Meta, Netflix to the same sheet"

**Option C: Task decomposition in the career prompt**
The career prompt already decomposes into phases. Enhance it to produce a plan:
1. AI produces a company list from the user's request
2. AI processes one company at a time
3. After each company, AI updates Sheets and moves to the next
4. If iterations are low, AI reports progress and marks partial completion

**Recommendation:** Option C (task decomposition) is the most natural fit. The AI already reasons about multi-step workflows. The career prompt just needs clear instructions about batch iteration patterns.

### Tab Lifecycle for Career Search

```
Tab 1 (Original): User's starting tab
  |
  v
AI opens Tab 2: Career site (e.g., careers.microsoft.com)
  |-- Searches, extracts data
  |-- AI stores extracted data in its reasoning/memory
  v
AI opens Tab 3: Google Sheets (or navigates Tab 1 to Sheets)
  |-- Creates/opens spreadsheet
  |-- Enters header row
  |-- Enters data rows from extracted data
  v
AI switches to Tab 2: Navigate to next career site
  |-- Or navigates within Tab 2 to next company
  |-- Extracts more data
  v
AI switches to Tab 3: Enter additional rows
  |-- Continues from last row (e.g., A5, A6, ...)
  v
Repeat until all companies processed
```

**Key concern:** The AI must track the current row number across tab switches. The career prompt should emphasize row tracking: "After entering data, note the next empty row number in your reasoning before switching tabs."

---

## Suggested Build Order

Based on dependency analysis and risk assessment:

### Phase 1: Log-to-Sitemap Pipeline (Foundation)

**What:** Build-time script that processes `/logs/*.json` into bundled site maps.

**Why first:** This produces the artifacts that all subsequent phases consume. Without site maps, the AI has no site-specific knowledge for the 35+ career domains.

**Touches:**
- NEW: `scripts/import-logs.js` or similar build script
- EXISTING: `lib/memory/sitemap-converter.js` (reuse `convertToSiteMap`)
- EXISTING: `site-maps/` directory (output bundled JSON)

**Validation:** After running, `loadBundledSiteMap('careers.microsoft.com')` returns structured sitemap data.

### Phase 2: Site Guide Generation (Optional Precision Layer)

**What:** Generate per-company site guide files from session log data.

**Why second:** Per-company guides provide selector-level precision beyond what sitemaps offer. This improves automation success rate for the most important career sites.

**Touches:**
- NEW: `scripts/generate-guides.js` or similar
- NEW: `site-guides/career/{company}.js` (generated files)
- EXISTING: `background.js` (add importScripts for new guides)
- EXISTING: `site-guides/career/generic.js` (may update fallback patterns)

**Validation:** `getGuideForUrl('https://careers.microsoft.com/search')` returns the Microsoft-specific guide with selectors.

### Phase 3: Career Prompt Enhancement (AI Behavior)

**What:** Enhance `TASK_PROMPTS.career` for batch multi-company workflows with row tracking, error recovery per company, and iteration management.

**Why third:** With site maps and guides in place, the AI has the navigation intelligence. Now it needs behavioral instructions for batch processing.

**Touches:**
- EXISTING: `ai-integration.js` (TASK_PROMPTS.career, TASK_PROMPTS.multitab)
- EXISTING: `site-guides/career/_shared.js` (may refine category guidance)

**Validation:** Run a career search task for 3 companies with Sheets output. Verify AI processes each company in sequence, enters data correctly, and tracks row numbers.

### Phase 4: End-to-End Workflow Testing and Refinement

**What:** Test the full pipeline with real career sites, refine selectors and prompts based on success/failure patterns.

**Why last:** Only meaningful after all prior phases are in place.

**Touches:**
- EXISTING: Various site guides and prompt text (iterative refinement)
- EXISTING: `site-guides/career/generic.js` (add ATS patterns discovered during testing)

---

## Patterns to Follow

### Pattern 1: Dual-Channel Knowledge (Site Guide + Site Map)

The existing architecture provides two parallel knowledge channels to the AI:

1. **Site guides** (hardcoded in JS, loaded at extension start): Provide expert-crafted guidance text, curated selectors, step-by-step workflows, and warnings. These are HIGH-QUALITY but STATIC.

2. **Site maps** (stored in memory or bundled JSON, loaded per-domain at runtime): Provide crawl-derived page structure, navigation links, form fields, and AI-generated workflows/tips. These are BROAD but may have STALE selectors.

For career search, use BOTH:
- Site guides for behavioral instructions (how to search, what to extract, what to avoid)
- Site maps for structural intelligence (what pages exist, what interactive elements are on each page)

### Pattern 2: Generic Fallback with Specific Overrides

The `generic.js` career guide matches any URL with `/careers/`, `/jobs/`, or known ATS patterns. This provides baseline competence for ALL career sites. Per-company guides override with precise selectors when available.

**This is the correct pattern for scaling to 35+ companies.** Do not write per-company guides for all 35. Instead:
- Generic guide handles 80% of sites adequately
- Per-company guides for the top 5-10 most complex sites (Workday, custom ATS)
- Site maps fill the gap with domain-specific page structure

### Pattern 3: AI-Driven Tab Management

FSB does NOT hardcode tab switching logic. The AI receives tab context (all open tabs with IDs, URLs, and allowed status) and decides when to open, switch, or close tabs. This is the correct pattern for career search.

Do not build a "tab orchestrator" that programmatically opens career sites in tabs. Let the AI reason about when to switch. The career prompt guides this reasoning with phase instructions.

### Pattern 4: Name Box Navigation for Sheets

All cell navigation in Google Sheets MUST go through the Name Box (`#t-name-box`). The canvas-based grid does not expose individual cells as DOM elements. This is already documented in the Sheets site guide and must be respected in the career prompt's data entry phase.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Building a Custom Orchestration Layer

**What:** Creating a new "batch job runner" or "workflow engine" that manages the career search pipeline outside of the AI session.

**Why bad:** FSB's architecture delegates all decision-making to the AI within a session. The AI already handles multi-step, multi-tab workflows. Adding a separate orchestration layer creates a parallel control flow that conflicts with the AI's reasoning.

**Instead:** Enhance the career task prompt to include batch processing instructions. The AI handles iteration, error recovery, and tab management within its existing reasoning loop.

### Anti-Pattern 2: One Site Guide Per Session Log

**What:** Generating a separate site guide file for each of the 35+ session logs.

**Why bad:** 35+ site guide files bloat `background.js` with importScripts, increase extension load time, and most guides would be nearly identical (same generic patterns). The site guide registry is searched linearly for URL pattern matching -- more guides = slower matching.

**Instead:** Use bundled site maps for most companies (loaded on-demand, not at startup) and site guides only for the 5-10 most complex sites.

### Anti-Pattern 3: Hardcoding Company Lists in Prompts

**What:** Embedding specific company names, URLs, or career page structures in the task prompts.

**Why bad:** Fragile, doesn't scale, and the prompt grows with each company.

**Instead:** The user specifies companies in their task. The AI uses site guides and site maps to navigate each one. The career prompt provides the behavioral framework, not the company-specific details.

### Anti-Pattern 4: Scraping Data in Content Script

**What:** Building custom scraping logic in content scripts that extracts job data into a structured format before the AI sees it.

**Why bad:** Every career site has a different layout. Custom scraping logic for 35+ sites is an enormous maintenance burden. The AI's ability to understand page content through DOM analysis is the entire point of FSB.

**Instead:** Let the AI use `getText` and `getAttribute` tools to extract data, guided by site-specific selectors from guides/sitemaps. The AI interprets what it sees, not a scraping pipeline.

---

## Scalability Considerations

| Concern | At 5 companies | At 20 companies | At 50+ companies |
|---------|----------------|-----------------|-------------------|
| Iterations | 20-30 (fits in one session) | 60-100 (needs high iteration limit or continuity) | 150+ (needs session continuity or batching) |
| Site maps | Load from memory, ~50ms each | Same, may need memory cleanup | Consider LRU eviction or lazy loading |
| Tab count | 2-3 tabs (career + Sheets) | 2-3 tabs (reuse career tab) | Same (AI reuses tabs) |
| Sheets rows | 15-25 rows | 60-100 rows | 150+ rows (Sheets handles this fine) |
| API tokens | ~5K-10K per company | ~100K-200K total | Significant cost -- need token budget awareness |
| Success rate | High (can hand-tune) | Moderate (generic guide limits) | Depends on site complexity and ATS variety |

---

## Sources

- Direct analysis of `background.js` (session management, multi-tab handling, site map retrieval)
- Direct analysis of `ai/ai-integration.js` (task type detection, prompt building, site guide injection, site map injection)
- Direct analysis of `site-guides/index.js` (guide registry, URL pattern matching, `getGuideForUrl()`)
- Direct analysis of `site-guides/career/*.js` (4 existing career guides + shared category guidance)
- Direct analysis of `site-guides/productivity/google-sheets.js` (Sheets interaction model)
- Direct analysis of `lib/memory/sitemap-converter.js` (Tier 1 conversion from session logs)
- Direct analysis of `lib/memory/sitemap-refiner.js` (Tier 2 AI enrichment)
- Direct analysis of `lib/memory/memory-schemas.js` (createSiteMapMemory factory)
- Direct analysis of `lib/memory/memory-manager.js` (memory add/search/consolidate)
- Direct analysis of `utils/site-explorer.js` (autoConvertToMemory pipeline)
- Direct analysis of `/logs/fsb-research-www.amazon.jobs-2026-02-23.json` (session log format)
- Direct analysis of `manifest.json` (permissions, web_accessible_resources for site-maps)
