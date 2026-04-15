# Phase 10: Career Search Core - Research

**Researched:** 2026-02-23
**Domain:** Career site navigation, job data extraction, AI prompt engineering, error reporting
**Confidence:** HIGH

## Summary

Phase 10 transforms FSB from having static site intelligence (site guides from Phase 9) into actively using that intelligence to perform single-company career searches. The extension already has every runtime component needed: an AI automation loop in `background.js`, 40+ career site guides with `careerUrl` and selectors, a task type detection system that classifies career tasks, a `career` prompt template in `TASK_PROMPTS`, and a `careerValidator` completion validator. The core work is wiring these existing pieces together with career-search-specific enhancements.

Three requirements drive Phase 10: SEARCH-01 (single-company search with job data extraction), SEARCH-03 (vague query interpretation), and SEARCH-05 (error reporting for no-results/auth-wall scenarios). The existing `career` task prompt already instructs the AI through a 6-phase workflow (navigate -> search -> extract -> sheets), but this prompt was written for end-to-end career-to-sheets workflows. Phase 10 must refine it for single-company search only (no Sheets entry -- that is Phase 12). Additionally, the `careerUrl` field on site guides is never consumed by the runtime -- it exists in guide objects but no code reads it for navigation. This is a critical gap: the AI currently needs to Google search for career pages even though we have direct URLs.

The biggest technical challenge is not building new infrastructure but tuning the AI's behavior through prompt engineering and providing the right context at the right time. The AI must: (1) use `careerUrl` to navigate directly instead of Google searching, (2) use guide selectors to interact with career page elements, (3) extract structured job data with required fields (company, title, apply link) and best-effort fields (date, location, description), (4) dismiss cookie consent banners before interacting, and (5) report errors clearly when things fail.

**Primary recommendation:** Create a career search orchestration layer in `background.js` that resolves company names to site guides (and their `careerUrl`), refine the `career` task prompt to focus on single-site search and extraction (not Sheets entry), add a company-name-to-guide lookup function in `site-guides/index.js`, enhance cookie banner dismissal in the career workflow prompt, and add structured error reporting for no-results and auth-wall scenarios.

## Standard Stack

This phase does not introduce new libraries. All work uses the existing extension infrastructure.

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `site-guides/index.js` | Registry | Guide lookup by URL, task, and (new) company name | Already handles URL pattern matching and task keyword matching |
| `ai/ai-integration.js` | AI prompts | `TASK_PROMPTS.career` and `_buildTaskGuidance()` | Already builds career-specific prompts with site guide injection |
| `background.js` | Session management | `classifyTask()`, `careerValidator()`, session loop | Already classifies career tasks and validates completion |
| Site guide files | `site-guides/career/*.js` | 40+ guides with `careerUrl`, `selectors`, `workflows` | Phase 9 output; ready to consume |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `content/actions.js` | Action execution | `getText`, `getAttribute`, `click`, `type` | Job data extraction (getText for titles, getAttribute for hrefs) |
| `content/dom-analysis.js` | DOM analysis | Cookie consent detection (already skips cookies in analysis) | Identifying cookie banners for dismissal |
| `site-guides/career/_shared.js` | Category guidance | Shared career strategy, required data fields | Injected into all career task prompts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prompt-only approach (AI decides everything) | Programmatic scraper (content script extracts data mechanically) | Programmatic scraper is fragile -- every site has different DOM structure. AI-driven approach uses site guide hints but adapts to actual page content. Prompt-only is the right choice for this project's architecture |
| Company name matching in JS | Fuzzy matching library (Fuse.js) | Overkill -- company names are a finite known set from site guides. Simple case-insensitive matching with alias support is sufficient |

**Installation:** None required. No new dependencies.

## Architecture Patterns

### How the Existing System Works (Critical Context)

The automation flow for a career task today:

```
User types: "find software engineer jobs at Microsoft"
  |
  v
background.js: startAutomation()
  -> Creates session with task string
  -> classifyTask("find software engineer jobs at Microsoft") -> "career"
  |
  v
startAutomationLoop(sessionId)
  -> Each iteration:
     1. Inject content script, get DOM state
     2. ai.buildPrompt(task, domState, context)
        -> detectTaskType() -> "career"
        -> getGuideForTask(task, currentUrl)
           -> First tries URL match (if on careers.microsoft.com, matches Microsoft guide)
           -> Falls back to keyword match (if not on career page yet)
        -> _buildTaskGuidance("career", siteGuide, currentUrl)
           -> If siteGuide: injects category guidance + site guidance + selectors + workflows + warnings
           -> If no siteGuide: falls back to TASK_PROMPTS.career (generic career prompt)
     3. AI processes prompt, returns actions
     4. Actions executed via content script
     5. Loop continues until taskComplete: true or max iterations
```

### Gap Analysis: What Exists vs What Phase 10 Needs

| Capability | Exists? | Gap |
|-----------|---------|-----|
| Career task detection | YES (`classifyTask`, `detectTaskType`) | None -- works well |
| Career prompt template | YES (`TASK_PROMPTS.career`) | Needs refinement: currently includes Sheets data entry (Phases 12-13), needs to focus on search+extract only |
| Site guide injection | YES (`_buildTaskGuidance`) | Works when URL matches. Gap: first iteration is on current page (not career site), so guide may not match yet |
| Company name -> guide lookup | NO | New function needed: map "Microsoft" -> Microsoft guide with `careerUrl` |
| Direct navigation via `careerUrl` | NO | `careerUrl` field exists in guides but no code reads it. AI currently Google-searches for career pages |
| Cookie banner dismissal | PARTIAL | Workflow steps mention it. No dedicated cookie dismiss logic. AI sees it in DOM and handles ad-hoc |
| Job data extraction format | PARTIAL | Category guidance defines 6 fields. No structured extraction or result format validation |
| Error reporting (no results) | NO | AI might say "no results" in free text. No structured error reporting to user |
| Error reporting (auth wall) | PARTIAL | System prompt mentions login detection. AI reports auth walls but no career-specific handling |
| Vague query interpretation | NO | No mapping from "tech internships" -> concrete search terms |
| Completion validation | YES (`careerValidator`) | Currently checks for Sheets entry. Needs update for Phase 10 scope (search+extract only) |

### Recommended Architecture

```
Phase 10 Changes:
|
+-- site-guides/index.js
|   +-- NEW: getGuideByCompanyName(companyName)
|       Maps "Microsoft" -> Microsoft guide (with careerUrl, selectors, etc.)
|       Supports aliases: "JPMorgan" -> "JP Morgan Chase" guide
|       Returns null for unknown companies (triggers generic fallback)
|
+-- ai/ai-integration.js
|   +-- MODIFY: TASK_PROMPTS.career
|       Split into TASK_PROMPTS.career (Phase 10: search+extract only)
|       Remove Sheets data entry phases (defer to Phase 12)
|       Add: structured result format for extracted jobs
|       Add: cookie banner dismissal as FIRST step
|       Add: error reporting instructions (no results, auth wall)
|       Add: vague query interpretation instructions
|   +-- MODIFY: _buildTaskGuidance()
|       When task is career AND no URL guide matches yet:
|       Look up company name from task, inject careerUrl for direct navigation
|
+-- background.js
|   +-- MODIFY: careerValidator()
|       Update for Phase 10 scope (search+extract without Sheets)
|       Accept: getText actions + AI reports extracted jobs
|       Bonus: AI result contains job data fields
|   +-- MODIFY: classifyTask() or pre-processing
|       Extract company name from task for guide lookup
|
+-- site-guides/career/_shared.js
|   +-- MODIFY: Category guidance
|       Add: cookie banner dismissal as priority step
|       Add: structured error messages for common failures
```

### Pattern 1: Company Name to Guide Resolution

**What:** Map user-provided company name (from task text) to the correct site guide.
**When to use:** On first iteration of a career task, before the AI has navigated to any career page.
**Why needed:** The current system only matches guides by URL (after navigation) or by broad task keywords (which returns the category, not a specific company guide). For the first iteration, we need to tell the AI exactly which career URL to navigate to.

```javascript
// In site-guides/index.js
function getGuideByCompanyName(companyName) {
  if (!companyName) return null;
  const nameLower = companyName.toLowerCase().trim();

  // Aliases for common variations
  const ALIASES = {
    'jpmorgan': 'JP Morgan Chase',
    'jp morgan': 'JP Morgan Chase',
    'jpm': 'JP Morgan Chase',
    'bofa': 'Bank of America',
    'boa': 'Bank of America',
    'bank of america': 'Bank of America',
    'cap one': 'Capital One',
    'meta': 'Meta',
    'facebook': 'Meta',
    'cvs': 'CVS Health',
    'jnj': 'J&J',
    'johnson & johnson': 'J&J',
    'johnson and johnson': 'J&J',
    'lm': 'Lockheed Martin',
    'lockheed': 'Lockheed Martin',
    'uhg': 'UnitedHealth Group',
    'unitedhealth': 'UnitedHealth Group',
    'amex': 'American Express',
    'american express': 'Amex',
    'ti': 'TI',
    'texas instruments': 'TI',
    'mr cooper': 'Mr. Cooper',
    'mrcooper': 'Mr. Cooper',
    'gs': 'Goldman Sachs',
    'goldman': 'Goldman Sachs',
    'ms': 'Morgan Stanley',
    'morgan stanley': 'Morgan Stanley',
    'oracle': 'Oracle',
    'goog': 'Google Careers',
    'google': 'Google Careers',
    'openai': 'OpenAI'
  };

  // Check aliases first
  const aliasMatch = ALIASES[nameLower];
  if (aliasMatch) {
    return SITE_GUIDES_REGISTRY.find(g =>
      g.category === 'Career & Job Search' && g.site === aliasMatch
    ) || null;
  }

  // Direct site name match (case-insensitive)
  const directMatch = SITE_GUIDES_REGISTRY.find(g =>
    g.category === 'Career & Job Search' &&
    g.site && g.site.toLowerCase() === nameLower
  );
  if (directMatch) return directMatch;

  // Partial match (company name is contained in guide site name or vice versa)
  const partialMatch = SITE_GUIDES_REGISTRY.find(g =>
    g.category === 'Career & Job Search' &&
    g.site && (
      g.site.toLowerCase().includes(nameLower) ||
      nameLower.includes(g.site.toLowerCase())
    )
  );
  return partialMatch || null;
}
```

### Pattern 2: Career Prompt Refinement (Phase 10 Scope)

**What:** Refactored `TASK_PROMPTS.career` that focuses on search+extract only.
**When to use:** Replaces the current career prompt for Phase 10. Phase 12 will add Sheets entry back.

The current career prompt has 6 phases (navigate -> search -> extract -> sheets -> headers -> data entry). Phase 10 needs only phases 1-3 plus structured output.

Key additions:
1. Cookie banner dismissal as first action
2. Direct navigation via `careerUrl` (no Google search needed when guide exists)
3. Structured job data output format in the completion result
4. Explicit error reporting instructions
5. Vague query interpretation guidance

### Pattern 3: Cookie Banner Dismissal

**What:** Instruct AI to dismiss cookie banners before career page interaction.
**When to use:** As the FIRST workflow step after navigation.
**How it works:** The AI already sees cookie banners in DOM analysis (they are not filtered out). The category guidance and per-site workflows already mention "Dismiss cookie banner if present." The enhancement is making this an explicit, prioritized instruction.

Common cookie banner selectors across career sites (from site guide data):
- `#onetrust-accept-btn-handler` (OneTrust -- used by many enterprise sites)
- `[id*="cookie"] [class*="accept"]`
- `button[class*="cookie"][class*="accept"]`
- `[aria-label*="Accept"][aria-label*="cookie"]`
- `[data-testid*="cookie-accept"]`
- Generic: buttons with text "Accept", "Accept All", "I Accept", "Got it", "OK", "Agree"

The AI should attempt cookie dismissal with a soft timeout: try once, if no cookie banner visible, proceed immediately.

### Pattern 4: Vague Query Interpretation

**What:** Map broad/vague user queries to concrete search terms.
**When to use:** When the user says "find tech internships" without specifying a company or specific role.

Strategy: Include interpretation instructions in the career prompt that tell the AI to:
1. Extract any company name mentioned -> look up guide
2. Extract role keywords -> use as search terms
3. If no company specified -> use generic career guide and search Google
4. If no role specified -> extract first 3-5 listings from the career page
5. Map common vague terms:
   - "tech internships" -> search "software engineer intern" or "technology intern"
   - "DevOps positions" -> search "DevOps engineer" or "site reliability"
   - "finance roles" -> search "financial analyst" or "finance associate"

### Pattern 5: Structured Error Reporting

**What:** Explicit failure messages sent to user when career search fails.
**When to use:** When the AI encounters no results, auth walls, or broken pages.

Error categories:
1. **No results found:** AI searched but career site returned empty results. Report: "No [role] jobs found at [company]. The career page returned 0 results for '[search term]'."
2. **Auth wall / login required:** Career site requires authentication. Report: "[Company] requires login to view job listings. Try accessing the career page directly at [careerUrl]."
3. **Career page unreachable:** Site is down, redirects, or has a captcha. Report: "Could not access [company]'s career page at [careerUrl]. The site may be temporarily unavailable."
4. **Unknown company:** No site guide exists. Report: "No career guide found for [company]. Trying a Google search for '[company] careers'..."

### Anti-Patterns to Avoid

- **DO NOT build a separate career search engine module.** The AI automation loop IS the search engine. Phase 10 is prompt engineering + guide lookup, not new infrastructure.
- **DO NOT add a programmatic scraper for job data.** The AI uses getText/getAttribute through the existing action system. Job extraction is AI-driven, not script-driven.
- **DO NOT modify the automation loop (`startAutomationLoop`).** The loop is generic and works for all task types. Career-specific behavior comes through prompts and validators.
- **DO NOT create a new message type for career results.** Use the existing `automationComplete` message with the result string containing structured job data.
- **DO NOT add Sheets entry to Phase 10.** The career prompt currently includes Sheets phases -- these must be REMOVED for Phase 10 and re-added in Phase 12.
- **DO NOT dismiss cookies programmatically in content script.** The AI handles cookie dismissal through its normal action flow (click the accept button). The content script cookie detection in `dom-analysis.js` already skips cookies from element analysis.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Company name matching | Fuzzy string matching library | Simple alias map + case-insensitive search in `getGuideByCompanyName()` | We have a known, finite set of ~40 company guides. Fuzzy matching is overkill and introduces ambiguity |
| Job data extraction | Custom DOM scraper per site | AI-driven extraction via getText/getAttribute with site guide selectors as hints | Every site has different structure. AI adapts; scrapers break |
| Cookie banner dismissal | Content script auto-dismiss | AI instruction to click accept button on first interaction | Cookie banners vary wildly. AI can identify them from DOM context; hardcoded selectors would miss many |
| Error detection | Custom error parsing logic | AI reasoning + completion validator signals | The AI already analyzes page state in each iteration. Adding error detection to the prompt is sufficient |

**Key insight:** Phase 10 is fundamentally about prompt engineering and guide-to-prompt wiring, not new infrastructure. The automation loop, action system, and site guides already exist. The work is making them cooperate for career search specifically.

## Common Pitfalls

### Pitfall 1: Guide Not Matched on First Iteration
**What goes wrong:** The AI starts on the user's current tab (e.g., Google homepage). `getGuideForUrl(currentUrl)` returns null because the URL is not a career site. The career-specific site guide with selectors is never injected.
**Why it happens:** Guide lookup is URL-based. On the first iteration, the user is not on the career page yet.
**How to avoid:** Add company-name-based guide lookup that runs BEFORE URL matching. Extract company name from the task text, find the matching guide, and inject its `careerUrl` and guidance into the first-iteration prompt. The URL-based matching then takes over on subsequent iterations (after navigation).
**Warning signs:** AI Google-searches for "Microsoft careers" even though the Microsoft guide has `careerUrl: 'https://careers.microsoft.com/'`.

### Pitfall 2: Career Prompt Includes Sheets Entry
**What goes wrong:** The AI tries to open Google Sheets and enter data after extracting jobs, even though Phase 10 is search-only.
**Why it happens:** The current `TASK_PROMPTS.career` includes phases 4-6 (navigate to Sheets, set up headers, enter data). The AI follows these instructions.
**How to avoid:** Remove Sheets-related phases from the career prompt for Phase 10. Replace with: "Report extracted jobs in a structured format in your result. Do NOT navigate to Google Sheets."
**Warning signs:** AI opens sheets.google.com during a career search task.

### Pitfall 3: careerValidator Expects Sheets
**What goes wrong:** The `careerValidator` in `background.js` gives bonus score for being on Google Sheets URL and having type actions (data entry). In Phase 10 (no Sheets), the validator never awards these bonuses, making completion validation harder.
**Why it happens:** The validator was designed for the full career-to-sheets workflow.
**How to avoid:** Update `careerValidator` for Phase 10: award bonuses for getText actions (extraction), AI result containing job data fields (company, title, link), and the AI being on a career site URL. Remove the Sheets URL bonus.
**Warning signs:** Career tasks hit max iterations because the validator score never reaches the approval threshold.

### Pitfall 4: Cookie Banner Blocks Interaction
**What goes wrong:** The AI tries to type in the search box but a cookie consent overlay intercepts the click. The action fails or types into the wrong element.
**Why it happens:** Cookie consent banners are modal overlays that cover the page. They intercept clicks and prevent interaction with underlying elements.
**How to avoid:** Make cookie banner dismissal the FIRST workflow step in the career prompt, before any search interaction. The AI should check for and dismiss any overlay before proceeding.
**Warning signs:** Type action on search box fails with "element not clickable" or "element intercepted."

### Pitfall 5: AI Loops on Search Page Without Clicking Results
**What goes wrong:** The AI types a search query, results appear, but instead of extracting data from results, the AI refines the search or scrolls endlessly.
**Why it happens:** The career prompt doesn't explicitly tell the AI to stop searching and start extracting after results load. The AI's general behavior is to keep exploring.
**How to avoid:** Add explicit extraction trigger in the prompt: "After search results load, STOP searching and START extracting. Extract data from the first 3-5 relevant results. Do NOT refine the search unless zero results are returned."
**Warning signs:** AI performs 5+ type actions on the same search box, or scrolls through 10+ pages of results without extracting anything.

### Pitfall 6: Vague Queries Produce No Actionable Intent
**What goes wrong:** User says "find tech internships" and the AI doesn't know which company to search or what to type.
**Why it happens:** No company name in the query means no guide lookup. The AI falls back to the generic career prompt which says "Google search for company careers."
**How to avoid:** Add vague query handling: (1) If no company name detected, ask the AI to interpret the broad term into a concrete action (e.g., search Google for "software engineer intern jobs" and present results from multiple job boards), (2) Provide a mapping of common vague terms to concrete search queries in the prompt.
**Warning signs:** AI enters "tech internships" verbatim into a search box and gets poor results.

### Pitfall 7: Job Data Fields Missing from AI Result
**What goes wrong:** AI marks task complete with a result like "Found 5 jobs at Microsoft" but doesn't include the actual job data (titles, links, etc.).
**Why it happens:** The AI treats extraction as a navigation task and reports completion at a high level without detailed data.
**How to avoid:** Define a structured output format in the prompt and validate it in the completion logic. The result must include at minimum: company name, job title, and apply link for each extracted job. Use the `careerValidator` to check for these patterns.
**Warning signs:** AI result is a single sentence without specific job titles or links.

## Code Examples

### Current careerValidator (Must Be Updated)

```javascript
// Source: background.js lines 3603-3623
function careerValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  const currentUrl = context.currentUrl || '';
  const isOnSheets = /docs\.google\.com\/spreadsheets/.test(currentUrl);
  if (isOnSheets && signals.actionChainComplete) {
    score = Math.min(1, score + 0.15);
    evidence.push('Career: data entered into Google Sheets');
  }
  const resultLower = (aiResponse.result || '').toLowerCase();
  if (/entered.*sheet|added.*sheet|spreadsheet/.test(resultLower)) {
    score = Math.min(1, score + 0.1);
    evidence.push('Career: AI confirmed sheet data entry');
  }
  const actionHistory = session.actionHistory || [];
  const getTextCount = actionHistory.filter(a => a.tool === 'getText').length;
  const typeCount = actionHistory.filter(a => a.tool === 'type').length;
  if (getTextCount >= 3 && typeCount >= 6) {
    score = Math.min(1, score + 0.1);
    evidence.push('Career: extraction+entry actions detected');
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'career' };
}
```

**Phase 10 update needed:**
- Remove Sheets URL bonus (no Sheets in Phase 10)
- Remove "entered sheet" text bonus
- Add: Career site URL bonus (AI is on a `careerUrl` from a guide)
- Add: getText count bonus (extraction signals)
- Add: AI result contains structured job data (company/title/link patterns)
- Adjust type+getText thresholds (getText >= 3 is good, type can be lower since no Sheets)

### Current TASK_PROMPTS.career (Lines 262-331 of ai-integration.js)

The current prompt includes 6 phases. Phase 10 needs only phases 1-3 plus structured output format. Key sections to keep:
- Phase 1: Navigate to career page (with `careerUrl` enhancement)
- Phase 2: Search for jobs
- Phase 3: Extract job data (with structured output format)

Key sections to REMOVE for Phase 10:
- Phase 4: Navigate to Google Sheets
- Phase 5: Set up headers
- Phase 6: Enter row data
- Completion criteria mentioning Sheets

Key sections to ADD:
- Cookie banner dismissal step
- Structured job data output format
- Error reporting instructions
- Vague query interpretation guidance

### Guide Lookup Flow (New)

```javascript
// In ai-integration.js _buildTaskGuidance() or buildPrompt()
// When task is career and no URL guide matched:

// Extract company name from task
const companyMatch = extractCompanyFromTask(task);
if (companyMatch) {
  const companyGuide = getGuideByCompanyName(companyMatch);
  if (companyGuide && companyGuide.careerUrl) {
    // Inject direct navigation URL into the prompt
    guidance += `\n\nDIRECT CAREER URL: Navigate to ${companyGuide.careerUrl} (skip Google search)`;
    // Also inject the guide's selectors and workflows
    siteGuide = companyGuide; // Use this guide for guidance building
  }
}
```

### Structured Job Data Output Format

```
When task is complete, provide job data in this format in your result field:

JOBS FOUND: [number]
---
1. [Job Title]
   Company: [Company Name]
   Location: [City, State / Remote / Hybrid]
   Date: [Date posted or "Not listed"]
   Description: [1-2 sentence summary]
   Apply: [URL]
---
2. [Job Title]
   ...

If no jobs found:
NO RESULTS: [Company Name] career page returned 0 results for "[search term]"

If auth wall encountered:
AUTH REQUIRED: [Company Name] requires login to view listings. Career page: [URL]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI Google-searches for career pages | Direct `careerUrl` from site guides | Phase 9 (data exists), Phase 10 (consumed) | Eliminates 1-3 iterations of Google search overhead |
| Generic career prompt for all sites | Site-specific selectors/workflows injected per company | Phase 9 (guides created) | AI knows exactly what to click instead of guessing |
| Career validator checks for Sheets entry | Career validator checks for job data extraction | Phase 10 (needed) | Correct completion detection for search-only tasks |
| Free-text AI result reporting | Structured job data format in result | Phase 10 (needed) | Parseable results for Phase 11 multi-site aggregation |

## Open Questions

1. **Company name extraction from task text**
   - What we know: Tasks like "find software engineer jobs at Microsoft" contain the company name. Regex or keyword matching can extract it.
   - What's unclear: Edge cases like "find jobs at JP Morgan Chase" (multi-word), "find jobs at BofA" (alias), "find tech internships" (no company).
   - Recommendation: Build a simple extractor that looks for patterns like "at [Company]", "jobs at [Company]", "[Company] careers". Use the alias map from `getGuideByCompanyName` to resolve variations. When no company detected, fall back to Google search.

2. **Vague queries without company names**
   - What we know: SEARCH-03 requires handling queries like "find tech internships" where no specific company is named.
   - What's unclear: Should FSB search a default set of companies? Pick one company? Search a job board like Indeed?
   - Recommendation: For Phase 10 (single-company search), if no company is detected, the AI should interpret the broad query into a concrete action: search Indeed or a similar job board, or ask the user for a specific company. The prompt should guide the AI to report what it interpreted and what it searched. Full multi-company search comes in Phase 11.

3. **How many jobs to extract per company**
   - What we know: Category guidance says "3-5 listings if no role specified." Current prompt says "3-5 max unless user specifies otherwise."
   - What's unclear: Is 3-5 the right default for Phase 10?
   - Recommendation: Keep 3-5 as default. The AI can adjust based on user intent ("find ALL software engineer jobs" -> extract more). The structured output format should handle variable numbers.

4. **First-iteration guide injection timing**
   - What we know: `_buildTaskGuidance()` runs during `buildPrompt()`, which calls `getGuideForTask(task, currentUrl)`. On first iteration, `currentUrl` is the user's current tab, not the career page.
   - What's unclear: Whether to modify `getGuideForTask`, `_buildTaskGuidance`, or `buildPrompt` to inject career guide on first iteration.
   - Recommendation: Modify `_buildTaskGuidance` to accept an optional pre-resolved guide. In `buildPrompt`, when task type is "career" and no URL-based guide matched, extract company name and look up guide. Pass the resolved guide to `_buildTaskGuidance`. This keeps the change localized.

5. **Cookie consent banner variability**
   - What we know: Many career sites show cookie consent banners (OneTrust, CookieBot, custom). The per-site workflows mention "Dismiss cookie banner if present." No dedicated cookie selectors exist in site guides.
   - What's unclear: Whether to add `cookieDismiss` selectors to site guides or rely on AI recognition.
   - Recommendation: Rely on AI recognition. The prompt should instruct the AI: "Before interacting with the career page, check for and dismiss any cookie consent, privacy, or overlay banner. Look for buttons with text 'Accept', 'Accept All', 'I Accept', 'Got it', 'OK', 'Agree', or 'Close'. If no banner is visible, proceed immediately." This is more robust than hardcoded selectors because cookie banners change frequently.

## Sources

### Primary (HIGH confidence)
- Direct examination of `site-guides/index.js` -- guide registration, URL matching, task matching
- Direct examination of `ai/ai-integration.js` -- `TASK_PROMPTS.career` (lines 262-331), `_buildTaskGuidance` (lines 3913-3983), `detectTaskType` (lines 3986-4079), `buildPrompt` (lines 1933-2600)
- Direct examination of `background.js` -- `classifyTask` (lines 3217-3264), `careerValidator` (lines 3603-3623), `validateCompletion` (lines 3673-3718), `startAutomationLoop` (lines 6208-6400), session creation (lines 4700-4850)
- Direct examination of `site-guides/career/_shared.js` -- category guidance with required data fields
- Direct examination of 10+ career site guides (microsoft.js, amazon.js, meta.js, boeing.js, google-careers.js, workday.js, greenhouse.js, lever.js, icims.js, taleo.js, generic.js)
- Direct examination of `content/dom-analysis.js` -- cookie consent detection (lines 1218-1219), consent input detection (line 431-432)

### Secondary (MEDIUM confidence)
- Common cookie consent banner selectors (OneTrust `#onetrust-accept-btn-handler` confirmed from coinbase.js guide; other selectors from training data)
- Company name alias patterns (from training data -- should be validated against actual guide `.site` values)

### Tertiary (LOW confidence)
- Vague query -> concrete search term mappings (heuristic recommendations, needs testing)

## Metadata

**Confidence breakdown:**
- Architecture patterns: HIGH -- directly examined all relevant code paths in ai-integration.js, background.js, and site-guides/index.js
- Gap analysis: HIGH -- systematic comparison of what exists vs what's needed
- Prompt engineering approach: HIGH -- existing prompt patterns well-understood from code examination
- Company name resolution: MEDIUM -- alias map approach is sound but exact alias list needs validation
- Cookie banner handling: MEDIUM -- common patterns known but site-specific banners vary
- Vague query interpretation: MEDIUM -- heuristic approach; needs real-world testing to tune

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days -- site guides are static, architecture is stable)
