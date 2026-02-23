# Project Research Summary

**Project:** FSB v9.4 - Career Search Automation + Google Sheets Output
**Domain:** Chrome Extension browser automation — career site data extraction and structured spreadsheet output
**Researched:** 2026-02-23
**Confidence:** HIGH

## Executive Summary

FSB v9.4 adds career search automation to an already-complete browser automation platform. The central research finding is unambiguous: every architectural subsystem needed for this feature already exists in the codebase. The work is a pipeline assembly problem, not a greenfield build. The extension already has multi-tab tools, career site guides, Google Sheets interaction logic, a memory/sitemap system, and a task orchestration prompt for career searches. The gap is three targeted pieces: converting 38 pre-existing JSON session logs into per-company site guides, adding a structured data accumulator to persist job data across service worker restarts, and extending the Google Sheets site guide with formatting workflows (bold headers, colored rows). No new external dependencies are needed.

The recommended implementation approach follows the existing dual-channel knowledge pattern FSB already uses: bundled site maps (generated offline from session logs) provide navigation intelligence, while per-company site guides provide precise selector-level guidance for the highest-priority sites. The generic ATS fallback guide covers the remaining sites adequately. The AI orchestrates all tab switching and data entry within its existing reasoning loop — no custom orchestration layer is needed or appropriate. The session log pipeline (Tier 1 heuristic parsing plus Tier 2 AI enrichment) is already built for live crawls and needs only a batch entry point for the 38 pre-existing log files.

The three highest-severity risks are: (1) service worker termination mid-workflow causing data loss — mitigated by persisting extracted job data to `chrome.storage.local` after each site; (2) empty DOM snapshots from heavy JS-rendered sites producing misleading site guides — mitigated by confidence-scoring session logs and excluding zero-element logs from selector generation; and (3) hashed/obfuscated CSS class names from React/Stylex and CSS-in-JS systems breaking site guide selectors on every deploy — mitigated by classifying selector stability during parsing and excluding unstable tokens. Anti-features — auto-apply, login-wall scraping, real-time monitoring — are explicitly out of scope with strong rationale and must not be built.

---

## Key Findings

### Recommended Stack

No new external dependencies are needed. The entire v9.4 feature is achievable with the existing vanilla JavaScript, Chrome Extension MV3, and UniversalProvider stack. See `.planning/research/STACK.md` for full detail.

New code additions are three lightweight vanilla JS modules totaling approximately 430-670 lines, plus 30+ generated site guide files (~50-80 lines each). Two new tools (`storeJobData`, `getStoredJobs`) are added to the existing `content/actions.js` tool object. Two message handlers are added to `background.js`. The Google Sheets site guide gets a formatting workflow section. No build system, no npm packages, no external APIs beyond the existing AI provider.

**Core technologies (all existing):**
- Vanilla JavaScript ES2021+: all new modules — no framework overhead, consistent with codebase constraint
- Chrome Extension MV3 / importScripts: site guide loading — same pattern as existing 43 guides
- UniversalProvider (existing): AI enrichment in Tier 2 sitemap refinement — reuse of `sitemap-refiner.js`
- chrome.storage.local (existing): job data accumulator — already has unlimitedStorage permission
- Chrome Debugger API / keyPress tool (existing): Google Sheets formatting shortcuts — already supports ctrlKey, shiftKey, metaKey modifiers

### Expected Features

See `.planning/research/FEATURES.md` for full detail with dependency graph and competitor analysis.

**Must have (table stakes — v9.4 Core):**
- Site guide parsing pipeline (P0 prerequisite) — convert 38 session logs into per-company guides; without this the AI is blind on most career pages
- TS-1: Single-company career search — navigate one site, search, extract 3-5 jobs with 6 required fields (Company, Title, Date Posted, Location, Description, Apply Link)
- TS-2: Multi-company sequential search — handle prompts naming 2-10 companies, visit each in sequence, accumulate data
- TS-3: Google Sheets basic data entry — create Sheet, set up header row, enter rows via Name Box plus Tab/Enter pattern
- TS-4: Vague query interpretation — map "tech internships" or "DevOps positions" to concrete search terms
- TS-6: Error reporting — report which companies returned no results; never produce silent failures

**Should have (differentiators — v9.4.x):**
- D-1: Formatted Google Sheets output — bold headers, colored header row, frozen row
- D-2: Structured data accumulator — replace fragile conversation-memory accumulation with chrome.storage persistence
- D-3: Progress reporting — "Searching Microsoft... (2/5)" UI feedback during long multi-site workflows
- D-6: Company name resolution — embed direct career URLs in site guides to skip Google search overhead
- D-7: Sheet title and tab naming — contextual names like "Job Search - SWE Internships - Feb 2026"
- TS-5: Deduplication — eliminate cross-site duplicate listings before writing to Sheets

**Defer (v9.5+):**
- D-4: Salary information extraction — needs per-site salary selector identification; pay transparency varies by jurisdiction
- D-5: Apply link validation — adds significant time per job; defer until base workflow speed is acceptable

**Explicit anti-features (must NOT build):**
- Auto-apply: legal and ethical risk, quality destruction, scope explosion into unreliable ATS form automation
- Scraping behind login walls: TOS violations, account risk, credential security liability
- Real-time job monitoring: MV3 service worker lifecycle prohibits continuous background polling
- Resume/cover letter generation: different product category with a different quality bar
- Full job description extraction: destroys spreadsheet readability, multiplies extraction time 5-10x per site
- Comparison scoring or ranking: subjective, creates false confidence, exposes liability if users act on scores

### Architecture Approach

FSB already has all five pipeline stages needed for career search automation. The architecture task is assembling existing components in the right order, not building new subsystems. See `.planning/research/ARCHITECTURE.md` for full component map and integration point analysis.

The dual-channel knowledge pattern is the foundational design: site guides (hardcoded JS loaded at extension start) provide expert behavioral instructions, while bundled site maps (generated from session logs, loaded on demand per domain) provide structural navigation intelligence. These two channels are combined in the AI prompt. The generic ATS fallback guide (`site-guides/career/generic.js`) covers approximately 80% of career sites adequately; per-company guides add precision for the highest-complexity sites only.

**Major components:**
1. Session Log Parser (NEW, ~200-300 lines) — batch entry point that feeds existing `convertToSiteMap()` plus `createSiteMapMemory()` pipeline for 38 pre-existing JSON logs; outputs bundled site-map JSON files with confidence scoring
2. Site Guide Generator (NEW, ~150-250 lines) — converts sitemap data into `registerSiteGuide()` JS files with stability-classified selectors (prefer ARIA/role/id, exclude hashed class names entirely)
3. Career Data Store (NEW, ~80-120 lines) — `chrome.storage.local` accumulator for extracted job data with per-session keying; exposes `storeJobData` and `getStoredJobs` tools to the AI
4. Career Task Prompt Enhancement (EXISTING, targeted edits) — batch iteration instructions, row tracking across tab switches, error recovery per company, auth wall handling in `TASK_PROMPTS.career`
5. Google Sheets Formatting Workflow (EXISTING extended) — add formatting workflows to `google-sheets.js` site guide: bold via keyPress, fill color via toolbar DOM click chain, Name Box timing sequence

**Key architecture decisions that must be respected:**
- AI-driven tab management only: do NOT build a custom orchestration layer; the AI reasons about when to switch tabs based on prompt instructions and tab context injected by background.js
- Generic fallback with specific overrides: bundled site maps for most companies, per-company guides only for the 5-10 most complex ATS platforms
- Name Box navigation exclusively for Google Sheets: never click canvas grid cells; enforce this in the career task prompt's Sheets phase
- "Collect all, then write" tab pattern: accumulate all job data across career site tabs first, then open Sheets once and write all rows; eliminates back-and-forth tab switching that causes context loss

### Critical Pitfalls

Top 5 by severity. See `.planning/research/PITFALLS.md` for all 15 pitfalls with recovery strategies and phase mapping.

1. **Service worker termination mid-workflow** — Multi-site career search runs 5-15 minutes, exceeding MV3's 30-second idle or 5-minute execution limits. Data stored in background.js JavaScript variables is lost on worker restart. Prevention: persist extracted job data to `chrome.storage.local` after every site extraction, not just at workflow end. The `career-data-store.js` module must be the first deliverable in Phase 3, before the multi-site loop is built.

2. **Empty DOM snapshots from JS-rendered career sites** — Tesla, Walmart, and several others show `totalElements: 0` in session logs because the research crawler captured pre-hydration HTML. Generating site guides from these logs produces misleading selectors. Prevention: implement confidence scoring during log parsing (HIGH: more than 10 interactive elements, MEDIUM: 1-10 elements, LOW: 0 elements). LOW-confidence sites get URL-only guidance with no selectors, falling back to the generic ATS guide at runtime.

3. **Hashed and obfuscated CSS class names** — Meta uses React/Stylex hashed class tokens (`x1i10hfl`), Goldman Sachs uses content-hashed component class names. These selectors break on every deploy, often within days. Prevention: during site guide generation, classify selectors by stability. STABLE selectors are id attributes, aria-label, role, name, and data-testid. UNSTABLE selectors are hashed or generated tokens — exclude them entirely. Use XPath with visible text content as the fallback for sites with no stable attributes.

4. **Google Sheets canvas grid is not clickable (already partially mitigated)** — Google Sheets renders its cell grid on an HTML canvas element; individual cells have no DOM representation. The existing `google-sheets.js` site guide already documents this and mandates Name Box navigation. Remaining risk is AI prompt drift during complex formatting sequences. Prevention: explicitly prohibit `click` actions targeting grid or cell elements in the career prompt's Sheets phase, and include the Name Box sequence verbatim.

5. **Google Sheets has no keyboard shortcut for cell colors** — Bold (Ctrl+B) and italic (Ctrl+I) have keyboard shortcuts; fill color and text color do not. Prevention: for header row color formatting, use FSB's existing `click` tool to click the fill color toolbar button (a real DOM element with an aria-label), then click the color swatch in the dropdown. The exact selector chain must be documented in the Sheets site guide after live DOM inspection of the toolbar.

---

## Implications for Roadmap

Based on combined research, the dependency graph is clear and drives a specific phase order. The session log pipeline is the prerequisite for all automation. Multi-site data persistence must be built before the multi-site loop. Sheets formatting polish comes last.

### Phase 1: Data Pipeline Foundation

**Rationale:** Nothing else can work without site-specific knowledge for the 38 career domains. Session logs are available now and can be processed offline before any live automation is tested. This phase has no external runtime dependencies and validates the pipeline produces useful output before automation work begins.

**Delivers:**
- `lib/career/session-log-parser.js` — batch processor for 38 JSON log files with confidence scoring per log
- `lib/career/career-guide-generator.js` — converts sitemaps to `registerSiteGuide()` format with selector stability classification
- Bundled site map JSON files in `site-maps/{domain}.json` for all 38 domains
- Per-company site guide JS files in `site-guides/career/` for the top 10 highest-priority companies (Big Tech, Finance)
- Redirect domain mappings in per-company guides (e.g., walmart.com maps to Workday subdomain)

**Addresses features:** Site guide parsing pipeline (P0), D-6 company name resolution (direct career URLs embedded in guides)

**Avoids pitfalls:** Pitfall 1 (empty DOM snapshots flagged by confidence scoring before guides are written), Pitfall 5 (hashed selectors filtered at parse time), Pitfall 15 (ATS redirect domains included in guide URL patterns)

**Research flag:** Standard patterns. The `sitemap-converter.js` and `sitemap-refiner.js` pipeline is fully implemented. This is mechanical code reuse with a batch entry point. No additional research needed.

### Phase 2: Career Search Core (Single Site)

**Rationale:** Multi-company orchestration multiplies the complexity of every failure mode. A single-site bug that causes one failure causes ten failures at multi-site scale. Validate the atomic unit first. This phase also installs the foundational AI behavior rules (cookie consent, auth walls, pagination) that all subsequent phases depend on.

**Delivers:**
- Enhanced `TASK_PROMPTS.career` with cookie consent pre-dismissal step, auth wall skip-and-notify rule, and pagination cap (3 pages or 15 results per site)
- Auth classification field (`authRequired: none | browse_only | full`) in per-company site guides from Phase 1
- Validated single-company search on at least 20 of the 38 session-log-covered sites
- MUST-HAVE vs BEST-EFFORT field distinction in extraction prompt (title + company + apply link are required; date, location, description are best-effort)

**Addresses features:** TS-1 (single-company search), TS-4 (vague query handling), TS-6 (error reporting)

**Avoids pitfalls:** Pitfall 6 (cookie consent banners — pre-navigation hook in career site visit workflow), Pitfall 8 (auth walls — skip and notify pattern), Pitfall 9 (pagination — explicit cap and next-page check step), Pitfall 13 (incomplete data — must-have field enforcement)

**Research flag:** Workday, Greenhouse, and Lever ATS platforms collectively power 15+ of the 38 companies in the session logs. The generic guide covers them at URL-pattern level but precision selectors for their search forms may need targeted addition during this phase. These are well-documented platforms with consistent DOM patterns — this is validation work, not open-ended research.

### Phase 3: Multi-Site Orchestration with Data Persistence

**Rationale:** The data accumulator must be built before the multi-site loop, not after. Service worker termination (Pitfall 4) is the highest-recovery-cost pitfall. If in-memory accumulation is used and the worker terminates after site 3 of 10, all extracted data from sites 1-3 is permanently lost. Persistence is the foundation; the multi-site loop is built on top of it.

**Delivers:**
- `lib/career/career-data-store.js` — `chrome.storage.local` accumulator with incremental write after each site extraction
- `storeJobData` and `getStoredJobs` tools added to `content/actions.js`
- `storeCareerData` and `getCareerData` message handlers in `background.js`
- Enhanced `TASK_PROMPTS.career` for batch processing: company list parsing from user input, sequential site iteration, row number tracking across tab switches, completion criteria requiring all companies processed
- Tab management strategy implemented: single career tab reused sequentially (navigate to next company, do not stack tabs), Sheets tab opened once and held open for the write phase
- Deduplication logic: AI compares new extraction against accumulated list before calling `storeJobData`

**Addresses features:** TS-2 (multi-company sequential search), D-2 (structured data accumulator), D-3 (progress reporting), TS-5 (deduplication)

**Avoids pitfalls:** Pitfall 4 (service worker state loss — storage persistence after each site), Pitfall 10 (duplicate listings — accumulator-level deduplication), Pitfall 11 (tab management chaos — collect-all-then-write pattern eliminates back-and-forth switching)

**Research flag:** Standard patterns. Session management and chrome.storage CRUD appear in 50+ existing locations in the codebase. No new architectural patterns are introduced.

### Phase 4: Google Sheets Integration (Basic Data Entry)

**Rationale:** With the data accumulator in place, the Sheets write phase can be tested completely independently from the search phase. This decoupling is essential for debugging — Name Box timing issues and row tracking errors are much easier to reproduce and fix when the search phase is not also running. Build in isolation, then integrate.

**Delivers:**
- End-to-end validated workflow: career search accumulation result feeds directly into Sheets write phase
- `TASK_PROMPTS.career` Sheets phase with explicit Name Box interaction sequence (click Name Box, wait 200ms, select all text, type cell reference, press Enter, wait 200ms, type value, Tab to advance)
- Row number tracking requirement in prompt: AI must note next empty row before any tab switch
- Handling for both new Sheet creation from sheets.google.com home and existing Sheet URL provided by user
- Sheet title naming from task context

**Addresses features:** TS-3 (Google Sheets basic data entry), D-7 (Sheet title and tab naming)

**Avoids pitfalls:** Pitfall 2 (canvas grid clicks — Name Box exclusivity enforced in prompt), Pitfall 14 (Name Box timing — explicit wait and select-all sequence), Pitfall 11 (tab management — collect-then-write confirms correct tab separation)

**Research flag:** Live testing required during implementation. Google Sheets DOM structure changes between product updates. The Name Box interaction sequence must be validated against a real Sheets instance. No pre-planning research needed; the existing site guide documents the correct approach.

### Phase 5: Google Sheets Formatting

**Rationale:** Formatting is a differentiator, not a correctness requirement. Deferring it until basic data entry is confirmed working ensures higher-risk phases are stable before formatting complexity is added. Google Sheets color formatting specifically requires live DOM inspection of the toolbar before the selector chain can be written — this inspection cannot happen until an actual Sheets session is open during implementation.

**Delivers:**
- Header row formatting: bold via Ctrl+B keyPress, fill color via toolbar dropdown click then swatch click, frozen header row via View menu navigation
- Toolbar selector chain documented in `google-sheets.js` site guide with known aria-label values for fill color and text color buttons
- Platform modifier validation: macOS (metaKey) vs Windows (ctrlKey) tested for all formatting shortcuts via Debugger API keyPress path
- Column auto-sizing via Format menu navigation

**Addresses features:** D-1 (formatted Google Sheets output)

**Avoids pitfalls:** Pitfall 3 (no keyboard shortcut for colors — toolbar click approach implemented), Pitfall 7 (Mac vs Windows keyboard shortcuts — platform detection verified in Debugger API path)

**Research flag:** Live DOM inspection of Google Sheets toolbar is required at implementation time to get current aria-label values for color picker elements. These change with Google Sheets updates. This is a one-time validation task at the start of Phase 5, not ongoing research.

### Phase Ordering Rationale

- **Data pipeline before all automation phases:** Site guides and bundled site maps are loaded at extension start and queried per URL match. Without them, all career automation falls back to generic patterns and produces lower success rates on complex career sites.
- **Single-site before multi-site:** Validate the atomic extraction unit on real sites before adding multi-company orchestration complexity. Failures are cheaper to diagnose at single-site scale.
- **Data persistence before multi-site loop:** MV3 service worker lifecycle makes in-memory accumulation unsafe for workflows lasting more than a few minutes. Persistence is the risk mitigation, not an optional optimization.
- **Basic Sheets entry before formatting:** A misaligned row caused by a Name Box timing bug shifts every subsequent row. Confirm positional accuracy under real conditions before adding formatting operations that depend on correct cell positions.
- **Collect-all-then-write tab pattern:** Switching tabs frequently (search site A, switch to Sheets, switch back to site B, switch to Sheets) creates compounding context-management complexity. Collecting all data in the accumulator, then performing one continuous Sheets write pass, eliminates this class of failure.

### Research Flags

Phases needing deeper research or live validation during planning:
- **Phase 2 (Career Search Core):** Workday, Greenhouse, and Lever appear across 15+ of the 38 session log companies. The generic guide covers URL patterns but precise search form selectors may need per-platform additions. Inspect 3-5 representative session logs from Workday-powered sites to determine if the generic selectors are sufficient or need augmentation.
- **Phase 5 (Sheets Formatting):** Open a live Google Sheets session at the start of implementation and inspect toolbar DOM to document current aria-label values for fill color and text color dropdown buttons before writing any site guide instructions.

Phases with standard patterns where research-phase can be skipped:
- **Phase 1 (Data Pipeline):** Mechanical code reuse. The `sitemap-converter.js` and `sitemap-refiner.js` pipeline is fully implemented and documented. A batch entry point is ~50 lines of new code.
- **Phase 3 (Multi-Site Orchestration):** The chrome.storage CRUD pattern and background.js message handler pattern appear in dozens of existing locations. No new architectural patterns are introduced.
- **Phase 4 (Sheets Basic Entry):** The Name Box workflow is documented and correctly implemented in the existing site guide. This is integration testing and prompt engineering, not research.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified by reading actual source files: sitemap-converter.js, sitemap-refiner.js, memory-storage.js, google-sheets.js site guide, actions.js keyPress implementation. Zero new dependencies confirmed. |
| Features | HIGH | Table stakes grounded in direct codebase analysis of TASK_PROMPTS.career, _shared.js extraction schema, existing site guides. Sheets color formatting feasibility is MEDIUM — toolbar DOM structure must be verified live. Competitor analysis MEDIUM due to search result currency. |
| Architecture | HIGH | Based on direct analysis of all pipeline components. The component map in ARCHITECTURE.md accurately reflects the codebase. Integration points are verified against actual function signatures and file locations. |
| Pitfalls | HIGH | Grounded in actual session log analysis (Tesla 0 elements confirmed, Meta hashed classes confirmed, Boeing URL pagination confirmed) and Chrome Extension MV3 documented lifecycle constraints. Google Sheets canvas architecture confirmed via Google's published documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Google Sheets toolbar selector values:** Fill color and text color toolbar button aria-labels must be inspected from a live Google Sheets instance at the start of Phase 5. These change with Google Sheets product updates. Do not hardcode values from documentation — verify at implementation time.

- **Workday, Greenhouse, and Lever ATS precision selectors:** The generic.js guide covers these platforms with URL pattern matching, but search form selector precision has not been verified against the specific session log data for these platforms. Address during Phase 2 by inspecting 3-5 Workday-powered company session logs in the `/Logs/` directory.

- **Maximum iteration count threshold for large company lists:** The default session iteration limit may be insufficient for workflows covering 10+ companies (estimated 60-100 iterations needed). The exact threshold requires empirical testing during Phase 3. If the limit proves too low, increase `maxIterations` for career task type or document session continuity as the user-facing workaround.

- **Meta and Goldman Sachs partial auth wall classification:** Both sites have partial auth gating — some listings are public, apply buttons are gated. The skip-and-notify strategy is clear for fully gated sites, but the exact prompt language to detect partial gating without false-positive skips on public content needs validation during Phase 2 testing.

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)

- `ai/ai-integration.js` — TASK_PROMPTS.career (lines 262-331), detectTaskType(), _buildTaskGuidance(), _fetchSiteMap(), formatSiteKnowledge()
- `site-guides/career/_shared.js` — career category shared guidance, 6-field extraction schema, strategy priority rules
- `site-guides/career/generic.js` — generic ATS platform patterns, URL matching coverage for Workday, Lever, Greenhouse
- `site-guides/career/indeed.js`, `glassdoor.js`, `builtin.js` — per-site guide structure and format reference
- `site-guides/productivity/google-sheets.js` — canvas-based interaction model, Name Box workflow documentation, canvas warning
- `site-guides/index.js` — `registerSiteGuide()` registry, `getGuideForUrl()` URL pattern matching logic
- `lib/memory/sitemap-converter.js` — `convertToSiteMap()` Tier 1 heuristic pipeline
- `lib/memory/sitemap-refiner.js` — `refineSiteMapWithAI()` Tier 2 AI enrichment
- `lib/memory/memory-schemas.js` — `createSiteMapMemory()` factory
- `lib/memory/memory-storage.js` — `memoryStorage.add()` persistence
- `background.js` — activeSessions Map, session management, multi-tab handling, `getSiteMap` message handler, importScripts site guide loading sequence
- `content/actions.js` — keyPress tool with modifier key support, openNewTab, switchToTab, listTabs, closeTab tools
- `utils/site-explorer.js` — `autoConvertToMemory()` pipeline (reference for batch log import design)
- `/Logs/fsb-research-careers.microsoft.com-2026-02-23.json` — session log format verification, 6,892 lines
- `/Logs/fsb-research-www.amazon.jobs-2026-02-23.json` — session log format, search element identification confirmed
- `/Logs/fsb-research-www.tesla.com-2026-02-23.json` — totalElements: 0 confirmed (empty DOM snapshot)
- `manifest.json` — permissions verified: debugger, clipboardWrite, storage, unlimitedStorage, webNavigation

### Secondary (MEDIUM confidence — external documentation)

- [Google Sheets Keyboard Shortcuts](https://support.google.com/docs/answer/181110) — confirmed no built-in color shortcut; bold, italic, underline confirmed
- [Google Docs Community: Shortcut for cell color](https://support.google.com/docs/thread/227704922) — Alt+/ menu search workaround for colors confirmed
- [The New Stack: Google Docs Canvas Rendering](https://thenewstack.io/google-docs-switches-to-canvas-rendering-sidelining-the-dom/) — canvas architecture explanation
- [Chrome Developers: Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 30-second idle timeout, 5-minute execution limit
- Web scraping and anti-bot detection references: ZenRows, Akamai Bot Manager, Cloudflare JS Detections

### Tertiary (MEDIUM confidence — competitive landscape)

- [12 Best AI Job Search Tools in 2026](https://jobcopilot.com/best-ai-job-search-tools/) — competitive positioning for FSB differentiation
- [AI Auto-Apply Tools vs Traditional Job Search 2026](https://careerattraction.com/ai-auto-apply-tools-vs-traditional-job-search-in-2026/) — anti-apply anti-feature rationale
- [Web Scraping Job Postings Guide](https://www.octoparse.com/blog/web-scraping-job-postings) — data quality challenges, deduplication, expired listings
- [Job Search Spreadsheet tracking expectations](https://www.tealhq.com/post/job-search-tracking-spreadsheet) — user expectations for spreadsheet output format

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
