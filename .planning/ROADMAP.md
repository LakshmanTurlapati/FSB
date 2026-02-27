# Roadmap: FSB v9.4 Career Search Automation

## Overview

v9.4 transforms FSB from a general-purpose browser automation tool into a career search powerhouse. The milestone converts 38 crowd session logs into site intelligence (sitemaps and site guides), builds a career search workflow that navigates company career sites and extracts job listings, and outputs results to beautifully formatted Google Sheets. The five phases follow a strict dependency chain: site intelligence must exist before automation, single-site search must work before multi-site, data persistence must exist before multi-site loops, and basic Sheets entry must be correct before formatting is layered on.

## Milestones

<details>
<summary>v9.3 Tech Debt Cleanup (Phases 4-8) - SHIPPED 2026-02-23</summary>

See `.planning/milestones/v9.3-ROADMAP.md` for full details.
5 phases, 17 plans, 9 requirements (100% satisfied).

</details>

### v9.4 Career Search Automation (Complete)

**Milestone Goal:** Autonomous career site search across 30+ companies with formatted Google Sheets output.

## Phases

- [x] **Phase 9: Data Pipeline Foundation** - Parse session logs into sitemaps and site guides with confidence scoring
- [x] **Phase 10: Career Search Core** - Single-company search navigates, extracts, and reports errors
- [x] **Phase 11: Multi-Site Orchestration** - Sequential multi-company search with persistent data accumulation
- [x] **Phase 12: Google Sheets Data Entry** - Write accumulated job data to Sheets via Name Box pattern
- [x] **Phase 13: Google Sheets Formatting** - Bold headers, colored rows, frozen header, auto-sized columns
- [x] **Phase 14: Execution Acceleration** - Batched same-page action sequences with smart completion detection, plus timezone/country context for location-aware AI decisions (completed 2026-02-24)

## Phase Details

### Phase 9: Data Pipeline Foundation
**Goal**: Site intelligence exists for all 38 session-log companies so the AI can navigate their career pages with precision
**Depends on**: Nothing (first phase of v9.4)
**Requirements**: PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):
  1. Running the session log parser against the 38 JSON log files produces per-company site guide JS files with HIGH/MEDIUM/LOW confidence scores
  2. Per-company site guide JS files exist for the top-priority companies with stability-classified selectors (no hashed CSS tokens)
  3. Each generated site guide contains the company's direct career URL so searches skip Google entirely
  4. LOW-confidence sites (zero interactive elements in logs) produce URL-only guidance with no selectors, falling back to the generic ATS guide
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md -- Build session log parser script (Node.js build-time tool)
- [x] 09-02-PLAN.md -- Create 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo)
- [x] 09-03-PLAN.md -- Run parser, register outputs in background.js, audit existing career guides

### Phase 10: Career Search Core
**Goal**: Users can ask FSB to search one company's career site and get back extracted job listings with clear error reporting
**Depends on**: Phase 9 (site guides must exist)
**Requirements**: SEARCH-01, SEARCH-03, SEARCH-05
**Success Criteria** (what must be TRUE):
  1. User says "find software engineer jobs at Microsoft" and FSB navigates to Microsoft's career page, searches, and extracts jobs with company name, title, and apply link (required) plus date, location, and description (best-effort)
  2. User says "find tech internships" (vague query) and FSB interprets it into concrete search terms and executes a career search
  3. When a company's career site yields no results or hits an auth wall, FSB explicitly reports the failure to the user (never silent)
  4. Cookie consent banners are dismissed before search interaction begins
**Plans**: 3 plans

Plans:
- [x] 10-01-PLAN.md -- Company name-to-guide lookup + shared guidance enhancement (cookie dismissal, error templates)
- [x] 10-02-PLAN.md -- Career validator update for search+extract scope (remove Sheets dependencies)
- [x] 10-03-PLAN.md -- Career prompt refinement + company-name guide injection wiring

### Phase 11: Multi-Site Orchestration with Data Persistence
**Goal**: Users can name 2-10 companies in one prompt and FSB searches each sequentially, persisting data after each site to survive service worker restarts
**Depends on**: Phase 10 (single-site search must work first)
**Requirements**: SEARCH-02, SEARCH-04, SEARCH-06, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. User says "find DevOps jobs at Microsoft, Amazon, and Google" and FSB visits each company's career site in sequence, extracting jobs from each
  2. After each company extraction, job data is persisted to chrome.storage.local (killing the service worker mid-workflow does not lose previously extracted data)
  3. The AI can call storeJobData and getStoredJobs tools during career workflows to accumulate and retrieve extracted listings
  4. Duplicate job listings across companies are eliminated before the final dataset is assembled
  5. Progress reporting shows the current company and count during multi-site workflows (e.g., "Searching Amazon... 2/3")
**Plans**: 3 plans

Plans:
- [x] 11-01-PLAN.md -- Data persistence tools (storeJobData/getStoredJobs), multi-company parser, deduplication
- [x] 11-02-PLAN.md -- Multi-site orchestrator (sequential loop, completion interception, auth deferral, progress, prompt augmentation)
- [x] 11-03-PLAN.md -- UAT gap closure: conversation reset on phase transitions + session timeout fix

### Phase 12: Google Sheets Data Entry
**Goal**: Accumulated job data flows into a Google Sheet with correct cell positioning via Name Box navigation
**Depends on**: Phase 11 (data must be accumulated before writing)
**Requirements**: SHEETS-01, SHEETS-02, SHEETS-04
**Success Criteria** (what must be TRUE):
  1. FSB creates a new Google Sheet (or opens a user-provided URL) and writes job data rows using the Name Box + Tab/Enter pattern without clicking the canvas grid
  2. The default column layout is company, title, date, location, description, apply link -- and the user can customize which fields appear
  3. The Sheet is named from the task context (e.g., "Job Search - SWE Internships - Feb 2026")
  4. All rows written match the accumulated data with no missing entries or misaligned columns
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md -- Sheets data entry orchestrator (trigger, data retrieval, tab management, session launch, prompt injection)
- [x] 12-02-PLAN.md -- Site guide enhancement, append detection, rename, batch persist, completion handling

### Phase 13: Google Sheets Formatting
**Goal**: The finished Google Sheet has professional formatting -- bold colored header row, frozen header, and auto-sized columns
**Depends on**: Phase 12 (data must be correctly entered before formatting)
**Requirements**: SHEETS-03, SHEETS-05
**Success Criteria** (what must be TRUE):
  1. The header row is bold (Ctrl+B / Cmd+B) with a colored background applied via the toolbar fill color dropdown
  2. The header row is frozen so it stays visible when scrolling through results
  3. Columns are auto-sized for readable output (no truncated text, no excessive whitespace)
**Plans**: 2 plans

Plans:
- [x] 13-01-PLAN.md -- Formatting orchestrator in background.js + site guide formatting workflows
- [x] 13-02-PLAN.md -- AI formatting prompt directive injection in ai-integration.js

### Phase 14: Execution Acceleration
**Goal**: The automation engine executes faster and smarter -- batching multiple same-page actions into a single AI turn with DOM-based completion detection between each, and injecting the user's timezone/country so the AI makes location-aware decisions (e.g., filtering career searches to local jobs)
**Depends on**: Phase 13 (all existing automation must be stable before changing the execution model)
**Requirements**: ACCEL-01, ACCEL-02, ACCEL-03, ACCEL-04, ACCEL-05
**Success Criteria** (what must be TRUE):
  1. The AI can return multiple sequential actions in a single response when they target the same page, and the execution engine runs them in order with DOM stability checks between each
  2. Fixed inter-action delays are replaced by smart DOM mutation monitoring -- each action proceeds as soon as the page stabilizes
  3. The user's timezone, local datetime, and country are passed to the AI in the system prompt so it can make location-aware decisions
  4. Career searches default to filtering by the user's country when no explicit location is specified
  5. Overall task completion time is measurably reduced compared to one-action-per-iteration
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md -- Timezone/country locale detection and AI prompt injection
- [x] 14-02-PLAN.md -- Batch action execution engine with DOM-based completion detection

### Phase 14.3: Fix Sheets cell edit mode escape and Name Box navigation sequence (INSERTED)

**Goal:** Eliminate the AI's failure to exit cell edit mode before Name Box navigation on Google Sheets by adding an explicit Escape step before every Name Box navigation instruction in the site guide, TASK_PROMPTS, and continuation reminder
**Depends on:** Phase 14
**Requirements:** FIX-SHEETS-ESCAPE
**Success Criteria** (what must be TRUE):
  1. Every Name Box navigation instruction is preceded by a Press Escape step across the site guide guidance text, 9 workflow arrays, TASK_PROMPTS multitab section, and buildMinimalUpdate continuation reminder
  2. The TASK_PROMPTS multitab section has a 6-step procedure (Steps 0-5) with Step 0 being Escape
  3. The site guide warnings array contains a CRITICAL warning about pressing Escape before clicking the Name Box
  4. Workflows that already have Escape (renameSheet, formatHeaderRow) are not double-Escaped
  5. The fillSheetData clipboard path and buildSheetsFormattingDirective are completely unaffected
**Plans:** 1 plan

Plans:
- [ ] 14.3-01-PLAN.md -- Add Escape-before-NameBox to site guide (guidance + 9 workflows + warning) and ai-integration.js (TASK_PROMPTS Step 0 + buildMinimalUpdate first bullet)

### Phase 14.2: Fix AI Google Sheets cell navigation and data entry confusion (INSERTED)
**Goal:** Eliminate the AI's confusion between Name Box cell navigation and cell data entry on Google Sheets by adding explicit disambiguation prompts to the site guide, task prompt, and continuation iterations
**Depends on:** Phase 14
**Requirements:** FIX-SHEETS-NAV
**Success Criteria** (what must be TRUE):
  1. The AI navigates to cells by clicking the Name Box, typing the cell reference, pressing Enter, then typing the data value as a separate step
  2. The AI never types cell references (like "B1") directly into cells as data values
  3. Continuation iterations (iteration 2+) retain Sheets-specific Name Box guidance via buildMinimalUpdate injection
  4. The fillSheetData clipboard path for career workflows is completely unaffected
**Plans:** 1/1 plans complete

Plans:
- [x] 14.2-01-PLAN.md -- Site guide disambiguation WARNING + expanded multitab Sheets section + continuation prompt Sheets injection

### Phase 14.1: Fix batch action behavior on Google Sheets (INSERTED)
**Goal:** Prevent AI from batching multiple type actions on Google Sheets (canvas-based grid causes value concatenation) via prompt-level warning and execution-level URL-based safety check with graceful single-action fallback
**Depends on:** Phase 14
**Requirements:** FIX-BATCH-SHEETS
**Success Criteria** (what must be TRUE):
  1. The AI does not batch multiple type actions when on a Google Sheets URL
  2. If the AI still batches type actions on Sheets, the execution engine catches it and falls back to single-action execution
  3. Non-type batch actions on Sheets (getText, click, keyPress) are NOT suppressed
  4. Existing fillSheetData clipboard path is unaffected
**Plans:** 1/1 plans complete

Plans:
- [x] 14.1-01-PLAN.md -- Prompt-level batch warning + URL-based suppression guard + single-action fallback

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 9. Data Pipeline Foundation | 3/3 | Complete | 2026-02-23 |
| 10. Career Search Core | 3/3 | Complete | 2026-02-23 |
| 11. Multi-Site Orchestration | 3/3 | Complete | 2026-02-24 |
| 12. Google Sheets Data Entry | 2/2 | Complete | 2026-02-23 |
| 13. Google Sheets Formatting | 2/2 | Complete | 2026-02-23 |
| 14. Execution Acceleration | 2/2 | Complete    | 2026-02-24 |
| 14.1. Fix Batch on Sheets | 1/1 | Complete   | 2026-02-25 |
| 14.2. Fix Sheets Nav/Entry | 1/1 | Complete    | 2026-02-26 |

---
*Created: 2026-02-23 for milestone v9.4 Career Search Automation*
