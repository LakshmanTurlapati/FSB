# Technology Stack: Career Search Automation + Google Sheets Formatting

**Project:** FSB v9.4 - Career Search Automation
**Researched:** 2026-02-23
**Mode:** Ecosystem (Stack dimension for subsequent milestone)
**Constraint:** Vanilla JS, no build system, no external libraries, Chrome Extension MV3
**Overall confidence:** HIGH

---

## Executive Summary

FSB v9.4 requires NO new external dependencies. The existing stack (vanilla JS, Chrome Extension MV3, importScripts service worker, per-site guide system, memory layer, keyboard/debugger API tooling) already contains every building block needed. The work is purely new vanilla JavaScript modules that transform existing data (JSON session logs) into existing formats (site guide JS files) and orchestrate existing tools (type, keyPress, click, navigate) in new patterns (career search workflow, Google Sheets formatting).

Three capability gaps exist, all solvable with new vanilla JS code:

1. **Session Log Parser** -- Transform the 38 JSON research logs (6,800+ lines each for deep sites, ~800 for Sheets) into the `registerSiteGuide({...})` format already consumed by the AI prompt system. The logs already contain the exact data needed: interactive elements with selectors, internal links with URLs, page titles, form metadata, and navigation structure. This is a mechanical transformation, not a research problem.

2. **Career-Specific Data Schema** -- The existing site guide format lacks a `jobSchema` field for structured job data extraction. A lightweight extension to the guide format (adding `jobSchema`, `searchWorkflow`, `paginationPattern`) gives the AI the intelligence to extract structured data across heterogeneous career sites.

3. **Google Sheets Formatting via Keyboard Shortcuts** -- FSB already types into Sheets via Name Box navigation and CDP text insertion. Formatting (bold headers, cell colors, column widths) requires keyboard shortcuts (Ctrl+B, Ctrl+Shift+1-6) and toolbar button clicks (fill color, font color pickers). The existing `keyPress` tool with `ctrlKey`/`shiftKey` modifiers and the `click` tool already handle this. The missing piece is a Sheets-specific site guide with formatting workflows.

**Key decision: Do NOT add any libraries, APIs, or build tools.** Every capability needed is achievable with the existing toolset plus new vanilla JS modules.

---

## 1. Session Log Parsing (New Module)

### What Exists

**Confidence: HIGH** (Verified by reading actual log files and existing converter)

The 38 session logs in `/Logs/` follow a consistent JSON schema:

```javascript
{
  "domain": "careers.microsoft.com",
  "id": "research_1771837697366",
  "startTime": 1771837697366,
  "endTime": 1771837890302,
  "startUrl": "https://careers.microsoft.com/",
  "status": "completed",
  "pages": [
    {
      "depth": 0,
      "url": "https://careers.microsoft.com/",
      "title": "Home | Microsoft Careers",
      "timestamp": 1771837704278,
      "interactiveElements": [
        {
          "type": "button|input|a|div",
          "text": "Find jobs",
          "id": "find-jobs-btn",
          "class": "find-jobs-btn",
          "elementId": "button_find_jobs_btn_...",
          "selectors": ["#find-jobs-btn", "//button[...]"]
        }
      ],
      "internalLinks": [
        { "text": "Careers", "url": "https://careers.microsoft.com/v2/global/en/home.html" }
      ],
      "forms": [],
      "headings": [],
      "keySelectors": [],
      "navigation": [],
      "layout": {}
    }
  ],
  "summary": {
    "totalPages": 25,
    "totalElements": 464,
    "totalForms": 0,
    "totalLinks": 363,
    "crawlDuration": 192936,
    "uniqueUrls": 25
  }
}
```

The existing `sitemap-converter.js` (`convertToSiteMap()`) already transforms this schema into a sitemap memory object. The existing `sitemap-refiner.js` (`refineSiteMapWithAI()`) already enriches sitemaps with AI-generated workflows and tips.

### What Needs to Be Built

A new module: `session-log-parser.js` (or integrated into existing sitemap pipeline).

**Purpose:** Convert session log JSON into `registerSiteGuide({...})` format JS files.

**The transformation is mechanical:**

| Session Log Field | Site Guide Field | Transformation |
|---|---|---|
| `domain` | `site` name | Extract readable name from domain |
| `domain` | `patterns` | Generate regex from domain |
| `interactiveElements[].selectors` | `selectors` | Classify by role (searchBox, jobCards, etc.) |
| `interactiveElements[].type + .text` | Element classification | `input` with search-related text -> `searchBox` |
| `internalLinks` | `workflows` | Derive navigation paths |
| `pages[].title + .url` | `guidance` text | Describe page structure |
| AI enrichment (existing refiner) | `workflows`, `warnings`, `tips` | Same Tier 2 pattern |

### Recommended Approach

Use a **two-tier approach matching the existing sitemap pipeline:**

**Tier 1 (Pure heuristic, no AI cost):** Parse JSON, classify interactive elements by heuristics:
- Inputs with `placeholder*="search"`, `name*="keyword"`, `name*="search"`, `name*="q"`, `name*="k"` -> `searchBox`
- Inputs with `placeholder*="location"`, `name*="l"`, `name*="location"` -> `locationBox`
- Buttons with text matching `"search"`, `"find jobs"`, `"apply"` -> `searchButton`, `applyButton`
- Links containing `/jobs/`, `/careers/`, `/apply/` -> navigation workflow steps
- Elements with class/text containing `"job-card"`, `"job-listing"`, `"position"`, `"opening"` -> `jobCards`

**Tier 2 (AI enrichment, existing pattern):** Send the Tier 1 output to the AI refiner (already built in `sitemap-refiner.js`) with a career-specific prompt variant to generate:
- Verified search workflow steps
- Pagination detection
- Job listing element identification
- Warning about dynamic loading, iframes, login walls

### Technology Stack: None New

| Component | Technology | Rationale |
|---|---|---|
| Parsing | Vanilla JS `JSON.parse()` | Logs are already valid JSON |
| Heuristic classification | Vanilla JS string matching | Regex/includes on element attributes |
| File generation | String templates | Generate `registerSiteGuide({...})` JS source |
| AI enrichment | Existing `UniversalProvider` | Same pattern as `sitemap-refiner.js` |
| Storage | `chrome.storage.local` or file output | Existing memory storage pattern |

### NOT Needed

- **No JSON Schema validator** -- Log format is controlled by FSB's own Site Explorer; it never varies
- **No streaming JSON parser** -- Largest log is ~7K lines (~500KB), well within memory
- **No AST/code generation library** -- Site guide JS files are simple string templates
- **No natural language processing** -- Element classification is pattern matching on known attributes

---

## 2. Career-Specific Data Structures (Schema Extension)

### What Exists

**Confidence: HIGH** (Verified by reading existing site guide files)

Current site guide format:

```javascript
registerSiteGuide({
  site: 'Indeed',
  category: 'Career & Job Search',
  patterns: [/indeed\.com/i],
  guidance: `...free-text AI instructions...`,
  selectors: {
    searchBox: '...',
    jobCards: '...',
    jobTitle: '...',
    // ...
  },
  workflows: {
    searchJobs: ['Step 1', 'Step 2', ...],
    extractJobData: ['Step 1', 'Step 2', ...]
  },
  warnings: ['...'],
  toolPreferences: ['navigate', 'type', 'click', ...]
});
```

The `_shared.js` for the Career category already defines the 6 required fields:
1. Company Name
2. Role/Title
3. Date Posted
4. Location
5. Description Summary
6. Apply Link

### What Needs to Be Added

Extend the site guide schema with career-specific structured fields. These are consumed by the AI prompt system via `_buildTaskGuidance()` in `ai-integration.js`.

```javascript
registerSiteGuide({
  // ...existing fields...

  // NEW: Structured job listing schema for data extraction
  jobSchema: {
    title: { selectors: ['.jobTitle a', '.jcs-JobTitle'], attribute: 'textContent' },
    company: { selectors: ['.companyName'], attribute: 'textContent' },
    location: { selectors: ['.companyLocation'], attribute: 'textContent' },
    datePosted: { selectors: ['.date'], attribute: 'textContent' },
    description: { selectors: ['.job-description p:first-child'], attribute: 'textContent', maxLength: 200 },
    applyLink: { selectors: ['.jobsearch-IndeedApplyButton a', 'a[href*="apply"]'], attribute: 'href' }
  },

  // NEW: Explicit search workflow with parameter slots
  searchWorkflow: {
    steps: [
      { action: 'navigate', target: 'https://www.amazon.jobs/' },
      { action: 'type', selector: 'searchBox', value: '{query}' },
      { action: 'type', selector: 'locationBox', value: '{location}' },
      { action: 'click', selector: 'searchButton' },
      { action: 'waitForElement', selector: 'jobCards' }
    ],
    parameters: ['query', 'location']
  },

  // NEW: Pagination pattern for multi-page results
  paginationPattern: {
    type: 'click',  // 'click' | 'scroll' | 'url-param'
    nextSelector: '.pagination-next, [aria-label="Next"]',
    hasMoreIndicator: '.pagination-next:not([disabled])',
    maxPages: 3
  }
});
```

### Why This Structure

| Field | Purpose | How AI Uses It |
|---|---|---|
| `jobSchema` | Tells AI exactly which selectors to use for each data field | AI extracts structured data instead of guessing element roles |
| `searchWorkflow` | Pre-defined step sequence with `{parameter}` slots | AI fills in user's query/location and executes without improvising |
| `paginationPattern` | How to get more results | AI knows whether to click "Next", scroll, or modify URL |

### Integration Point

The existing `_buildTaskGuidance()` method in `ai-integration.js` (lines 3921-3983) already formats site guide data into the system prompt. It concatenates `guidance`, `selectors`, `workflows`, and `warnings`. Adding `jobSchema`, `searchWorkflow`, and `paginationPattern` requires a small extension to this method -- serialize these new fields into the prompt text when present.

### Technology Stack: None New

This is a schema convention change (adding optional fields to the site guide object), not a technology change. No new dependencies.

---

## 3. Google Sheets Formatting via Browser Automation

### What Exists

**Confidence: HIGH** (Verified by reading actions.js and google-sheets.js site guide)

FSB already supports Google Sheets interaction:
- **Name Box navigation:** Click `#t-name-box`, type cell reference (e.g., "A1"), press Enter
- **Cell data entry:** Type value, press Tab (next column) or Enter (next row)
- **Canvas-based editor detection:** `FSB.isCanvasBasedEditor()` returns true on `docs.google.com`
- **CDP text insertion:** Direct text input bypassing DOM for canvas editors
- **keyPress tool with modifiers:** `keyPress({ key, ctrlKey, shiftKey, altKey, metaKey })` via Chrome Debugger API
- **Click tool:** Works on toolbar buttons (they are standard DOM elements with aria-labels)

### What Formatting Requires

Google Sheets formatting is achievable through two mechanisms FSB already has:

**Mechanism 1: Keyboard Shortcuts (preferred -- reliable, no DOM lookup needed)**

| Formatting | Shortcut (Windows/ChromeOS) | Shortcut (Mac) | FSB Tool Call |
|---|---|---|---|
| Bold | Ctrl+B | Cmd+B | `keyPress({ key: 'b', ctrlKey: true })` |
| Italic | Ctrl+I | Cmd+I | `keyPress({ key: 'i', ctrlKey: true })` |
| Underline | Ctrl+U | Cmd+U | `keyPress({ key: 'u', ctrlKey: true })` |
| Strikethrough | Alt+Shift+5 | Cmd+Shift+X | `keyPress({ key: '5', altKey: true, shiftKey: true })` |
| Number format | Ctrl+Shift+1 through 6 | Cmd+Shift+1-6 | `keyPress({ key: '1', ctrlKey: true, shiftKey: true })` |
| Clear formatting | Ctrl+\ | Cmd+\ | `keyPress({ key: '\\', ctrlKey: true })` |
| Select all in row | Shift+Space | Shift+Space | `keyPress({ key: ' ', shiftKey: true })` |
| Select entire column | Ctrl+Space | Ctrl+Space | `keyPress({ key: ' ', ctrlKey: true })` |
| Select range | Shift+Arrow | Shift+Arrow | `keyPress({ key: 'ArrowRight', shiftKey: true })` |

**Sources:** [Google Sheets Keyboard Shortcuts](https://support.google.com/docs/answer/181110)

**Mechanism 2: Toolbar Button Clicks (for colors and advanced formatting)**

Google Sheets toolbar buttons are standard DOM elements (not canvas) with `aria-label` attributes. These are clickable via FSB's existing `click` tool.

| Formatting | Toolbar Element | Approach |
|---|---|---|
| Fill color | Button with aria-label containing "Fill color" | Click button to open picker, then click color swatch |
| Font color | Button with aria-label containing "Text color" or "Font color" | Click button to open picker, then click color swatch |
| Font size | Dropdown with current font size value | Click to open, type size or click option |
| Merge cells | Button with aria-label "Merge cells" | Select range first, then click |
| Borders | Button with aria-label "Borders" | Click to open border picker |
| Text alignment | Buttons with aria-label "Left align", "Center align", "Right align" | Direct click |
| Column resize | Double-click column border in header | Use existing doubleClick tool |

**Confidence on aria-labels: MEDIUM** -- These are discoverable at runtime by FSB's DOM analysis, but exact labels may vary by locale and Google Sheets version. The site guide should document the known labels, with the AI falling back to visual inspection of the toolbar if labels change.

**Mechanism 3: Format Menu Navigation (fallback for colors)**

For fill/font color when toolbar buttons are hard to target:
1. Click Format menu (`#docs-format-menu`)
2. Navigate to relevant submenu item
3. Select color from the color picker dialog

### Recommended Formatting Workflow

For the career search output (formatted table with headers):

```
1. Navigate to cell A1 via Name Box
2. Type header row: "Company" [Tab] "Role" [Tab] "Date Posted" [Tab] "Location" [Tab] "Description" [Tab] "Apply Link" [Enter]
3. Select header row: Click A1, then Shift+Ctrl+Right to select through F1
4. Apply bold: Ctrl+B
5. Apply fill color: Click Fill Color toolbar button, select header color
6. Enter data rows: Type value [Tab] value [Tab] ... [Enter] per row
7. Auto-resize columns: Select all (Ctrl+A), then Format menu -> Column width -> Fit to data
```

### What Needs to Be Built

A Sheets-specific formatting workflow section in the Google Sheets site guide, plus a small enhancement to the `_buildTaskGuidance()` prompt builder to include formatting instructions when the task involves data output to Sheets.

**No new tools needed.** The existing `keyPress`, `click`, `type`, and `navigate` tools cover all required operations.

### Technology Stack: None New

| Capability | Existing Tool | New Code Needed |
|---|---|---|
| Cell navigation | Name Box click + type + Enter | None |
| Data entry | CDP type + Tab/Enter keyPress | None |
| Bold/italic/underline | keyPress with modifiers | None (already supports ctrlKey, shiftKey) |
| Fill color | click on toolbar button | Site guide with toolbar selectors |
| Column resize | Format menu navigation | Site guide workflow steps |
| Range selection | Shift+Arrow/Click keyPress | None |

---

## 4. Job Data Extraction and Structured Output

### What Exists

The AI already extracts text from pages via `getText` and `getAttribute` tools. The memory system already stores structured data. The career category `_shared.js` already defines the 6 required fields.

### What Needs to Be Built

A **job data accumulator** pattern -- the AI needs to collect data across multiple career sites and hold it in working memory until ready to output to Google Sheets.

**Option A: AI Conversation Memory (Recommended)**

The AI already maintains conversation history across iterations. The structured prompt can instruct the AI to accumulate job data in a consistent format within its conversation context:

```
After extracting jobs from each site, record them in this format in your response:
JOB_DATA: {"company": "...", "title": "...", "datePosted": "...", "location": "...", "description": "...", "applyLink": "..."}
```

The AI's conversation history preserves this across tab switches and site navigations. When it reaches the Sheets output phase, it has all accumulated data in context.

**Pros:** No new storage mechanism needed, uses existing conversation flow
**Cons:** Limited by context window, data could be lost if conversation is compacted

**Option B: chrome.storage.local Accumulator**

Store extracted job data in a dedicated `chrome.storage.local` key during the session:

```javascript
// In background.js or a new career-session.js module
async function addJobData(sessionId, jobData) {
  const key = `career_jobs_${sessionId}`;
  const existing = await chrome.storage.local.get(key);
  const jobs = existing[key] || [];
  jobs.push(jobData);
  await chrome.storage.local.set({ [key]: jobs });
}
```

**Pros:** Survives context compaction, can accumulate unlimited jobs, inspectable
**Cons:** Requires a new tool for the AI to call, adds implementation complexity

**Recommendation: Option B (storage accumulator).** The end-to-end workflow involves visiting 30+ career sites, extracting 3-5 jobs each, then outputting 90-150 rows to Sheets. This exceeds comfortable conversation context. A storage accumulator is more robust and enables progress tracking.

### New Tool Needed

One new tool for the content script `tools` object:

```javascript
// Add to content/actions.js tools object
storeJobData: async (params) => {
  const { company, title, datePosted, location, description, applyLink } = params;
  const response = await chrome.runtime.sendMessage({
    action: 'storeCareerData',
    data: { company, title, datePosted, location, description, applyLink }
  });
  return { success: response.success, totalJobs: response.totalJobs };
},

getStoredJobs: async (params) => {
  const response = await chrome.runtime.sendMessage({
    action: 'getCareerData'
  });
  return { success: true, jobs: response.jobs, totalJobs: response.jobs.length };
}
```

Plus a message handler in `background.js`:

```javascript
case 'storeCareerData':
  // Append to session-scoped storage
  break;
case 'getCareerData':
  // Return all accumulated jobs for current session
  break;
```

### Technology Stack: None New

This uses `chrome.storage.local` (already a permission) and the existing message passing architecture.

---

## 5. Multi-Tab Orchestration

### What Exists

**Confidence: HIGH** (Verified in background.js and actions.js)

FSB already has:
- `openNewTab` tool -- opens URLs in new tabs
- `switchToTab` tool -- switches between open tabs
- Tab tracking in background.js via `chrome.tabs` API
- `webNavigation` permission for detecting tab navigations

### What Needs to Be Built

The career search workflow requires visiting 30+ career sites sequentially. Two approaches:

**Approach A: Single-Tab Sequential (Recommended)**

Navigate to each career site in the same tab, extract data, then navigate to the next site. Finally, open Google Sheets and output all data.

**Pros:** Simple, matches existing FSB single-tab automation model, no tab management complexity
**Cons:** Slower (sequential navigation), AI must track progress

**Approach B: Multi-Tab Parallel**

Open multiple tabs, extract data in parallel.

**Pros:** Faster
**Cons:** Significantly more complex orchestration, AI context doesn't span tabs, harder to debug

**Recommendation: Approach A (single-tab sequential).** Multi-tab parallelism is a future optimization. The v9.4 goal is end-to-end functionality, not speed. The storage accumulator (Section 4) decouples extraction from output, so the AI can extract from all sites first, then switch to Sheets for output.

---

## 6. Site Guide Generation Pipeline

### Overview

The end-to-end pipeline for turning session logs into site guides:

```
Session Logs (JSON)                  Site Guides (JS)
     |                                    ^
     v                                    |
[Tier 1: Heuristic Parser]          [File Generator]
     |                                    ^
     v                                    |
[Intermediate Structure]    ---->   [Tier 2: AI Enrichment]
```

### Module Architecture

| Module | Location | Purpose | New/Existing |
|---|---|---|---|
| `session-log-parser.js` | `lib/career/` or `lib/memory/` | Tier 1 heuristic parsing of JSON logs | NEW |
| `career-guide-generator.js` | `lib/career/` | Generate `registerSiteGuide()` JS source files | NEW |
| `sitemap-refiner.js` | `lib/memory/` | AI enrichment (Tier 2) | EXISTING (may need career-specific prompt variant) |
| `site-guides/index.js` | `site-guides/` | Registry and URL matching | EXISTING (no changes needed) |
| `background.js` | root | importScripts for new career site guides | EXISTING (add new importScripts lines) |

### File Output Location

New career site guides go in `site-guides/career/`:

```
site-guides/career/
  _shared.js          (existing -- category-level guidance)
  generic.js          (existing -- ATS platform patterns)
  indeed.js           (existing)
  glassdoor.js        (existing)
  builtin.js          (existing)
  microsoft.js        (NEW -- generated from session log)
  amazon-jobs.js      (NEW -- generated from session log)
  meta.js             (NEW -- generated from session log)
  apple.js            (NEW -- generated from session log)
  boeing.js           (NEW -- generated from session log)
  ... (30+ more)
```

Each generated file follows the exact same `registerSiteGuide({...})` pattern as existing files. They are loaded via `importScripts()` in `background.js`, same as the 43 existing guides.

### Session Log Inventory

38 research logs available covering:

**FAANG/Big Tech (7):** Microsoft, Amazon, Meta, Apple, Google, NVIDIA, Tesla
**Finance (7):** Goldman Sachs, JP Morgan, Visa, Bank of America, Mastercard, Morgan Stanley, Capital One
**Enterprise/Defense (5):** Boeing, Lockheed Martin, IBM, Oracle, Deloitte
**Telecom (3):** AT&T, Verizon, Qatar Airways
**Retail (5):** Walmart, Target, Home Depot, Costco, Lowe's
**Healthcare/Other (7):** CVS Health, UnitedHealth, Pfizer, J&J, McKesson, Mr Cooper, TI
**AI (1):** OpenAI
**Productivity (1):** Google Docs/Sheets (for Sheets formatting intelligence)
**Search (3):** Google.com (for career page discovery workflow)

---

## 7. Complete Stack Summary

### No New Dependencies

| Category | Technology | Version | Status | Notes |
|---|---|---|---|---|
| Runtime | Chrome Extension MV3 | Chrome 88+ | EXISTING | No changes |
| Language | Vanilla JavaScript ES2021+ | N/A | EXISTING | No changes |
| AI Integration | UniversalProvider | N/A | EXISTING | May add career-specific prompt |
| Storage | chrome.storage.local | MV3 API | EXISTING | Add career data accumulator |
| Keyboard | Chrome Debugger API (CDP) | N/A | EXISTING | Already supports key modifiers |
| DOM Analysis | FSB DOM analyzer | N/A | EXISTING | No changes |
| Action Tools | tools object in actions.js | N/A | EXISTING | Add 2 new tools (storeJobData, getStoredJobs) |
| Site Guides | registerSiteGuide() system | N/A | EXISTING | Add 30+ new career site files |
| Sitemap Pipeline | sitemap-converter + refiner | N/A | EXISTING | Reuse for session log processing |

### New Vanilla JS Modules

| Module | Purpose | Est. Lines | Complexity |
|---|---|---|---|
| `lib/career/session-log-parser.js` | Parse JSON logs, classify elements | 200-300 | LOW -- string matching |
| `lib/career/career-guide-generator.js` | Generate site guide JS source files | 150-250 | LOW -- template strings |
| `lib/career/career-data-store.js` | Accumulate extracted job data in storage | 80-120 | LOW -- CRUD on chrome.storage |
| 30+ `site-guides/career/*.js` files | Per-site career intelligence | 50-80 each | LOW -- generated output |
| Enhanced `google-sheets.js` | Add formatting workflows | +50-80 lines | LOW -- extend existing |

### Tools Addition to actions.js

| Tool | Purpose | Params |
|---|---|---|
| `storeJobData` | Save extracted job to session accumulator | `{ company, title, datePosted, location, description, applyLink }` |
| `getStoredJobs` | Retrieve all accumulated jobs for Sheets output | `{}` |

### Background.js Changes

| Change | Purpose |
|---|---|
| Add `importScripts()` for new career guides | Load 30+ generated site guides |
| Add message handlers for `storeCareerData` / `getCareerData` | Support job data accumulation |

---

## 8. Alternatives Considered and Rejected

| Alternative | Why Rejected |
|---|---|
| **Google Sheets API** | FSB automates the browser, not APIs. Using the Sheets API would require OAuth, API keys, and a different architecture. The browser automation approach is consistent with FSB's design philosophy. |
| **Puppeteer/Playwright** | FSB is a Chrome Extension with content scripts, not a Node.js automation tool. These libraries run outside the browser and cannot be used in an extension context. |
| **JSON Schema validation library (ajv)** | Session logs are produced by FSB's own code in a fixed format. Adding a validation library for a controlled schema is unnecessary complexity. Simple runtime checks suffice. |
| **Template engine (handlebars, ejs)** | Site guide files are simple JS with a function call wrapping an object literal. ES template literals handle this without external dependencies. |
| **Build system (webpack, esbuild)** | FSB's constraint is no build system. 30+ new site guide files loaded via `importScripts()` follow the same pattern as the existing 43 files. |
| **IndexedDB** | `chrome.storage.local` with `unlimitedStorage` permission (already granted) is simpler and sufficient for the expected data volume (150 jobs with 6 fields each is <100KB). |
| **Web Workers for parallel parsing** | 38 log files parse in <100ms sequentially. Parallelism adds complexity with no perceptible benefit. |
| **Clipboard API for Sheets data paste** | Could paste a full table at once, but formatting (bold headers, colors) requires per-cell control. Sequential Name Box entry + keyboard shortcuts gives full formatting control. |

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google Sheets toolbar aria-labels change | LOW | MEDIUM | Site guide uses known labels; AI falls back to visual toolbar inspection |
| Career site redesigns invalidate selectors | MEDIUM | LOW | Session logs can be re-crawled; generic fallback patterns in `_shared.js` cover common ATS platforms |
| 30+ importScripts calls slow service worker startup | LOW | LOW | Each file is 50-80 lines (~3KB). 30 files = ~90KB total, negligible vs existing 43 files |
| Job data accumulator exceeds storage | LOW | LOW | 150 jobs at ~500 bytes each = ~75KB, well within 10MB+ limit |
| AI context window insufficient for multi-site workflow | MEDIUM | MEDIUM | Storage accumulator decouples extraction from output; AI doesn't need to hold all data in context |
| Google Sheets canvas blocks formatting keyboard shortcuts | LOW | HIGH | Verified: keyboard shortcuts work in Sheets (they are handled by Sheets' JS, not the canvas). CDP keyPress dispatches events that Sheets responds to. |

---

## Sources

- Session log format: Verified by reading `/Logs/fsb-research-careers.microsoft.com-2026-02-23.json` (6,892 lines)
- Site guide format: Verified by reading `/site-guides/career/generic.js`, `/site-guides/career/indeed.js`, `/site-guides/productivity/google-sheets.js`
- Site guide consumption: Verified by reading `_buildTaskGuidance()` in `/ai/ai-integration.js` (lines 3921-3983)
- Sitemap pipeline: Verified by reading `/lib/memory/sitemap-converter.js` and `/lib/memory/sitemap-refiner.js`
- Canvas editor detection: Verified by reading `isCanvasBasedEditor()` in `/content/messaging.js` (line 217)
- keyPress tool: Verified by reading `/content/actions.js` (line 3134) -- supports `ctrlKey`, `shiftKey`, `altKey`, `metaKey` modifiers via Chrome Debugger API
- Google Sheets keyboard shortcuts: [Google Docs Editors Help](https://support.google.com/docs/answer/181110)
- Manifest permissions: Verified by reading `/manifest.json` -- already has `debugger`, `clipboardWrite`, `storage`, `unlimitedStorage`
