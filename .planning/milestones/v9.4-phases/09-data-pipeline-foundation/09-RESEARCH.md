# Phase 9: Data Pipeline Foundation - Research

**Researched:** 2026-02-23
**Domain:** Session log parsing, site guide generation, selector stability classification
**Confidence:** HIGH

## Summary

This phase transforms 38 research session logs (JSON files in `Logs/`) into per-company career site guides using the existing `site-guides/career/` infrastructure. The codebase already has a mature site guide system with `registerSiteGuide()`, URL pattern matching, selector objects, workflows, and warnings. The research logs contain structured data: interactive elements with selectors, internal links, forms, and page metadata across multiple depths. The parser is a build-time tool (not runtime) that Claude runs to produce static `.js` guide files.

The key technical challenges are: (1) filtering career-relevant elements from the full DOM extraction in each log, (2) classifying selector stability to prefer `id`, `aria-label`, `role`, and `data-*` attributes over hashed CSS classes, (3) detecting ATS platforms from URL patterns and DOM signatures, and (4) generating guides in the exact format the existing registry expects.

**Primary recommendation:** Build a Node.js parser script that reads each research log, extracts career-relevant interactive elements, classifies selector stability, detects ATS platform, and writes a `.js` site guide file matching the existing `registerSiteGuide()` format. Then update `background.js` imports and audit the 4 existing career guides.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full interaction path coverage: search box, filters (location/department), results container, individual job cards, pagination, and apply button
- Hashed/unstable CSS selectors are included but flagged with stability warnings (stable alternatives tried first)
- ATS-based inheritance: company guides extend ATS base guides (workday.js, greenhouse.js, etc.) with company-specific overrides
- Primary career URL only per company (no alternate/category URLs)
- Selectors and URLs only -- no behavioral metadata (auth walls, AJAX quirks). AI discovers those at runtime
- Even all-hashed-selector sites get a guide generated (something is better than nothing)
- Interaction sequence included: ordered workflow (e.g., cookie dismiss -> search -> filter -> results)
- When multiple sessions conflict on interaction order, most recent session wins
- Machine-optimized, minimal format (no comments or human-readable explanations)
- Flexible structure per company (no forced standard interface). Phase 10 adapts to whatever each guide provides
- ATS auto-detected from session logs via URL patterns and DOM signatures (no manual mapping)
- 5 ATS base guides created: Workday, Greenhouse, Lever, iCIMS, Taleo (as separate files)
- Generic ATS fallback guide also created in Phase 9 for unrecognized platforms
- Source: 38 research logs in Logs/ directory (fsb-research-domain-YYYY-MM-DD.json format)
- Research logs only; session logs (fsb-session-*.json) are ignored
- Extract everything from logs (all interactive elements, forms, headings, links). Guide generation step filters what's career-relevant
- All page depths used (depth 0, 1, 2, etc.)
- Incomplete/partial logs: extract what's there
- Multiple sessions for same company: union of all selectors
- Parser is a build-time tool Claude runs during development, not runtime
- No summary report generated -- just produce the guide files
- Raw log files kept in Logs/ directory as-is after parsing
- Combination scoring: both element coverage AND selector stability determine confidence
- HIGH = good element coverage + mostly stable selectors
- MEDIUM = partial coverage or mixed selector quality
- LOW = below minimum quality bar (fewer than 3 usable elements AND all selectors fragile) -> URL-only guidance + generic ATS fallback
- Confidence score stored inside each site guide file (no separate manifest)
- Score is informational only -- does NOT affect how Phase 10 uses the guide
- New company guides go into existing site-guides/career/ directory
- 5 separate ATS base files in site-guides/career/
- Parser auto-updates site-guides/index.js registry AND background.js imports
- No separate sitemap JSON files -- site guides are the sole output
- Existing 4 career guides (generic.js, indeed.js, glassdoor.js, builtin.js) audited and improved

### Claude's Discretion
- Exact confidence scoring algorithm and thresholds
- How to filter career-relevant elements from raw extraction
- File naming convention for per-company guides
- Internal parser architecture and implementation approach
- How ATS detection heuristics work (URL pattern matching, DOM signature matching)

### Deferred Ideas (OUT OF SCOPE)
- Audit and improve ALL 53 site guides across all 9 categories (not just career) -- future phase
- Site Guides Viewer design mismatch (noted in STATE.md as deferred from v9.3)
</user_constraints>

## Standard Stack

This phase does not introduce new libraries. All work uses Node.js built-ins and the existing site-guides infrastructure.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Node.js `fs` | Built-in | Read research logs, write guide files | Already available, no dependencies needed |
| JSON.parse | Built-in | Parse research log JSON files | Logs are standard JSON |
| String templates | Built-in | Generate JavaScript source files | Guide files are JS with `registerSiteGuide()` calls |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `path` module | Resolve file paths for cross-platform | When constructing Logs/ and site-guides/ paths |
| RegExp | ATS detection patterns, selector classification | Matching hashed CSS classes, URL patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js script | Python script | Node.js matches the project's JavaScript ecosystem; no reason to introduce Python |
| Manual file generation | Template engine (Handlebars, etc.) | Overkill for simple string concatenation; adds dependency |

**Installation:** None required. No new dependencies.

## Architecture Patterns

### Existing Site Guide Format (MUST MATCH)

Every site guide calls `registerSiteGuide()` with this object shape:

```javascript
registerSiteGuide({
  site: 'Company Name',           // Human-readable company name
  category: 'Career & Job Search', // Always this for career guides
  patterns: [                      // RegExp array for URL matching
    /domain\.com/i
  ],
  guidance: `COMPANY-SPECIFIC INTELLIGENCE:
...multi-line string with navigation tips...`,
  selectors: {                     // CSS selectors keyed by semantic name
    searchBox: '#search-input, [aria-label="Search"]',
    locationFilter: '#location, input[name="location"]',
    jobCards: '.job-listing, [data-testid="job-card"]',
    jobTitle: '.job-title, h2 a',
    applyButton: 'a[href*="apply"], .apply-btn'
  },
  workflows: {                     // Named step sequences
    searchJobs: [
      'Navigate to company career page',
      'Enter search terms in search box',
      'Apply filters if specified',
      'Scan results for relevant positions'
    ]
  },
  warnings: [                      // Gotchas and pitfalls
    'Site uses dynamic loading -- wait for content after navigation'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
```

### Recommended Parser Architecture

```
scripts/
  parse-research-logs.js    # Main parser script (build-time tool)
```

**Parser pipeline (single script, sequential steps):**

1. **Scan** -- Read all `fsb-research-*.json` files from `Logs/`, skip `fsb-session-*.json` and non-career domains (google.com, docs.google.com, qatarairways.com)
2. **Parse** -- For each log, extract interactive elements, internal links, forms from all page depths
3. **Filter** -- Identify career-relevant elements using keyword heuristics (search, job, career, filter, location, department, apply, keyword, position, submit, results, pagination)
4. **Classify** -- Rate each selector's stability (stable: id, aria-label, role, data-*; unstable: hashed classes; moderate: semantic classes, name attributes, xpath)
5. **Detect ATS** -- Match URL patterns and DOM signatures against known ATS platforms
6. **Score** -- Compute confidence (HIGH/MEDIUM/LOW) based on element coverage + selector stability
7. **Generate** -- Write `.js` guide file per company matching `registerSiteGuide()` format
8. **Register** -- Update `background.js` imports and `site-guides/index.js` if needed

### File Naming Convention (Recommendation)

Use the domain name, kebab-cased, as the file name:
- `careers.microsoft.com` -> `microsoft.js`
- `www.amazon.jobs` -> `amazon-jobs.js`
- `jobs.boeing.com` -> `boeing.js`
- `www.metacareers.com` -> `meta.js`

ATS base guides use the ATS name:
- `workday.js`, `greenhouse.js`, `lever.js`, `icims.js`, `taleo.js`

### background.js Import Pattern

New imports must follow the existing pattern at lines 74-77:

```javascript
// Career & Job Search guides
importScripts('site-guides/career/indeed.js');
importScripts('site-guides/career/glassdoor.js');
importScripts('site-guides/career/builtin.js');
importScripts('site-guides/career/generic.js');
// ATS base guides
importScripts('site-guides/career/workday.js');
importScripts('site-guides/career/greenhouse.js');
// ... per-company guides
importScripts('site-guides/career/microsoft.js');
importScripts('site-guides/career/amazon-jobs.js');
// ... etc
```

### Anti-Patterns to Avoid
- **DO NOT create a runtime parser**: The parser runs at build time. Output is static JS files that ship with the extension.
- **DO NOT create separate JSON sitemap files**: Site guides ARE the output. No intermediate JSON files.
- **DO NOT hardcode ATS mappings**: Detect ATS from log data automatically.
- **DO NOT add human-readable comments in guide files**: Machine-optimized, minimal format.
- **DO NOT force a standard interface across all guides**: Each company's guide has whatever selectors that company's logs revealed. No empty placeholder fields.

## Research Log Data Profile

### File Inventory (33 career company logs)

Confirmed 33 unique career company research logs in `Logs/` directory. Additionally, 3 Google search logs (for Citi, Google Careers, and AmEx) and 1 Google Docs log exist but are not direct career page crawls. The Qatar Airways log is not career-related.

**Total career-relevant logs to process: 33 direct company logs + 3 Google search logs (extract career URLs for Citi, Google, AmEx if present).**

Note: The CONTEXT.md mentions "38 research logs" -- the actual count is 38 files total but only 33 are direct career site crawls. The Google search logs may contain career page links for 3 additional companies.

### Log JSON Structure

Every research log has this shape:

```json
{
  "domain": "careers.microsoft.com",
  "startUrl": "https://careers.microsoft.com/",
  "startTime": 1771837697366,
  "endTime": 1771837890302,
  "status": "completed",
  "settings": { "maxDepth": 3, "maxPages": 25 },
  "pages": [
    {
      "depth": 0,
      "url": "https://careers.microsoft.com/",
      "title": "Home | Microsoft Careers",
      "timestamp": 1771837704278,
      "interactiveElements": [
        {
          "type": "button|input|a|div|span|label|...",
          "text": "Find jobs",
          "id": "find-jobs-btn",
          "class": "find-jobs-btn",
          "elementId": "button_find_jobs_btn_container_384be",
          "selectors": [
            "#find-jobs-btn",
            "//button[normalize-space(.)=\"Find jobs\"]"
          ]
        }
      ],
      "forms": [],
      "headings": [],
      "internalLinks": [
        { "text": "Locations", "url": "https://careers.microsoft.com/.../locations.html" }
      ],
      "navigation": [],
      "keySelectors": [],
      "layout": {}
    }
  ],
  "siteMap": { "/": { "depth": 0, "elementCount": 17, ... } },
  "summary": { "totalPages": 25, "totalElements": 464, ... }
}
```

### Data Richness Categories

| Category | Count | Companies | Notes |
|----------|-------|-----------|-------|
| Rich (300+ elements) | 23 | BofA, Home Depot, Mastercard, McKesson, Microsoft, Mr. Cooper, UnitedHealth, Boeing, CVS Health, OpenAI, Apple, AT&T, Capital One, Costco, Deloitte, Goldman Sachs, IBM, Lockheed Martin, Morgan Stanley, NVIDIA, Oracle, Pfizer, Verizon | Full guide generation possible |
| Moderate (50-299 elements) | 4 | TI, Amazon Jobs, JPMorgan Chase, Meta | Good guide generation possible |
| Sparse (1-49 elements) | 4 | J&J (26), Lowe's (10), Target (23), Visa (26) | Limited guides with partial selectors |
| Empty (0 elements) | 2 | Walmart (0 elements, 438 links), Tesla (0 elements, 0 links) | URL-only guidance + generic ATS fallback |

### Selector Distribution Across All Logs

| Selector Type | Count | Percentage | Stability |
|---------------|-------|------------|-----------|
| XPath (//...) | 8,785 | 30.1% | MODERATE -- stable if based on text, fragile if positional |
| aria-label/aria-* | 6,159 | 21.1% | STABLE -- persist across deploys |
| Semantic classes (.btn, .job-title) | 5,397 | 18.5% | MODERATE -- usually stable but can change |
| data-* attributes | 3,584 | 12.3% | STABLE -- intentionally added for testing/targeting |
| ID selectors (#...) | 3,417 | 11.7% | STABLE -- most reliable |
| role attributes | 1,346 | 4.6% | STABLE -- accessibility standard |
| name attributes | 363 | 1.2% | STABLE -- form-specific |
| type attributes | 72 | 0.2% | MODERATE -- generic |
| Hashed classes | 47 | 0.2% | UNSTABLE -- change on every build |
| Other | 3 | 0.0% | - |

**Key finding:** 49.7% of selectors are stable (id, aria, role, data-*, name). Only 0.2% are truly hashed/unstable. XPath selectors (30.1%) need case-by-case evaluation -- text-based XPaths like `//button[normalize-space(.)="Find jobs"]` are stable; position-based ones are fragile.

### ATS Detection Results

Based on keyword scanning across all log data:

| ATS Platform | Companies Detected | Detection Method |
|-------------|-------------------|------------------|
| Workday | Deloitte (82 refs), CVS Health (48), Pfizer (20), Target (6) | "workday" keyword in element classes/URLs |
| Phenom | Mr. Cooper (50 refs), CVS Health (72) | "phenom" keyword in element data |
| Taleo | UnitedHealth Group (6 refs) | "taleo" keyword in URLs |
| Greenhouse | Costco (2 refs) | "greenhouse" keyword in URLs |
| Lever | None detected | No lever.co URLs in logs |
| iCIMS | None detected | No iCIMS patterns in logs |

**Note:** Most companies (28/33) use custom career pages with no detectable ATS. The 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) should still be created based on general knowledge of these platforms, even if not all are detected in current logs. Companies like Deloitte, Pfizer, Target, CVS Health will extend the Workday base guide.

## Confidence Scoring Algorithm (Recommendation)

### Proposed Thresholds

```
Career-relevant element categories:
  1. searchBox -- search input fields
  2. locationFilter -- location/city filter
  3. departmentFilter -- department/team filter
  4. jobCards -- job listing containers
  5. jobTitle -- job title elements
  6. applyButton -- apply/submit links
  7. pagination -- next/previous page controls
  8. resultsContainer -- job results wrapper

Coverage score (0-8): count of categories with at least one selector found

Selector stability score:
  stable_ratio = (id + aria + role + data_attr + name selectors) / total_selectors

Confidence mapping:
  HIGH:   coverage >= 4 AND stable_ratio >= 0.5
  MEDIUM: coverage >= 2 OR (coverage >= 1 AND stable_ratio >= 0.3)
  LOW:    coverage < 2 AND (total_elements < 3 OR stable_ratio < 0.3)
```

### Edge Cases

- **Walmart (0 elements, 438 links):** LOW confidence. Has internal links (career area URLs) but no interactive elements. Generate URL-only guide with the career page URL and link to generic ATS fallback.
- **Tesla (0 elements, 0 links):** LOW confidence. Only has the URL `https://www.tesla.com/careers`. URL-only guide.
- **J&J, Lowe's, Target, Visa (sparse):** Will likely be MEDIUM. Have some elements but limited coverage. Extract what exists.

## Career Element Filtering (Recommendation)

### Keyword-Based Heuristic

Filter elements by checking their `text`, `id`, `class`, `aria-label`, and `selectors` against career keywords:

**Primary keywords (strong career signal):**
- search, job, career, position, role, opening, vacancy
- filter, location, department, team, category
- apply, submit, results, listing
- keyword, find, explore

**Secondary keywords (moderate signal, require context):**
- next, previous, pagination, page
- sort, relevance, date
- remote, hybrid, full-time, part-time, internship

**Exclusion keywords (non-career elements to skip):**
- cookie, consent, privacy, gdpr
- newsletter, subscribe, sign-up (unless career-specific)
- social media sharing (share, tweet, facebook)
- navigation chrome (home, about, contact, blog -- unless career-specific like "About us" on a career page)
- feedback, survey

### Page Depth Strategy

- **Depth 0**: Main career landing page -- richest source of search/filter selectors
- **Depth 1**: Sub-pages (departments, locations, programs) -- may have category-specific filters
- **Depth 2+**: Deep pages (individual job listings, FAQs) -- may have apply button selectors, job detail elements

For each company, prioritize elements from depth 0 for the main workflow, but include unique selectors from deeper depths (especially apply buttons and job detail elements).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Site guide registration | Custom registry system | Existing `registerSiteGuide()` in `site-guides/index.js` | Already handles URL pattern matching, category grouping, and knowledge graph integration |
| URL pattern matching | Custom URL parser | RegExp patterns matching existing guides | All existing guides use `/domain\.com/i` patterns |
| Background import management | Manual file tracking | Auto-scan `site-guides/career/` directory | Ensures consistency between files and imports |
| Selector deduplication | Custom dedup logic | Use `Set` or `Map` keyed by selector string | Standard JS data structures handle this |

## Common Pitfalls

### Pitfall 1: Duplicate Elements Across Pages
**What goes wrong:** The same interactive element (e.g., site nav buttons) appears on every crawled page, inflating element counts.
**Why it happens:** Research logs crawl up to 25 pages per site, and shared navigation/header/footer elements repeat on each page.
**How to avoid:** Deduplicate elements by selector string. When the same selector appears on multiple pages, keep only one instance. Use the element from the shallowest depth page.
**Warning signs:** A company log shows 500+ elements but only 20 unique selectors.

### Pitfall 2: Non-Career Elements Dominating
**What goes wrong:** Site navigation (Products, About, Contact), cookie banners, and social media buttons outnumber career-specific elements.
**Why it happens:** Career pages are part of larger company websites with global navigation.
**How to avoid:** Apply career keyword filtering aggressively. For depth 0, most elements will be global nav -- the career-specific ones are the search box, location filter, and job listing elements. Use the text/id/class content to differentiate.
**Warning signs:** A guide has selectors for "Products", "Solutions", "Support" but none for "Search jobs" or "Apply".

### Pitfall 3: XPath Selectors with Dynamic Text
**What goes wrong:** XPath selectors like `//button[normalize-space(.)="Find jobs"]` are stable, but `//div[3]/button[2]` (positional XPath) break when page structure changes.
**Why it happens:** The research crawler generates both text-based and positional XPaths.
**How to avoid:** Classify XPaths: text-based (`normalize-space`, `contains(text()`) are STABLE; positional (`div[3]/button[2]`) are UNSTABLE. Prefer text-based XPaths alongside CSS selectors.
**Warning signs:** Selectors that contain position indices like `[3]`, `[2]` without text matching.

### Pitfall 4: Google Search Logs Treated as Company Logs
**What goes wrong:** The 3 Google search logs (for Citi, Google Careers, AmEx) have domain `www.google.com` and contain Google search UI elements, not career page elements.
**Why it happens:** These companies' career pages were searched for via Google rather than crawled directly.
**How to avoid:** Exclude `www.google.com` and `docs.google.com` domains from company guide generation. For Citi, Google Careers, and AmEx, generate URL-only guides (LOW confidence) using the search query URL to derive the career page URL.
**Warning signs:** Guide for "google.com" with search box selectors instead of career selectors.

### Pitfall 5: importScripts Order Matters
**What goes wrong:** If a company guide is imported before `site-guides/index.js` or `site-guides/career/_shared.js`, the `registerSiteGuide()` function is not yet defined.
**Why it happens:** Chrome Extension service worker `importScripts` executes synchronously in order.
**How to avoid:** Always add new career guide imports AFTER the existing career guide imports block in `background.js` (after line 77). ATS base guides should be imported before per-company guides that extend them.
**Warning signs:** Extension fails to load with "registerSiteGuide is not defined" error.

### Pitfall 6: Pattern Conflicts Between Guides
**What goes wrong:** A company guide pattern like `/microsoft\.com/i` matches `careers.microsoft.com` but also `microsoft.com/surface/`, causing the career guide to activate on non-career Microsoft pages.
**Why it happens:** Overly broad regex patterns.
**How to avoid:** Make patterns specific to career URLs. Use the exact career domain: `/careers\.microsoft\.com/i` not `/microsoft\.com/i`. For companies with career pages under their main domain (e.g., `apple.com/careers/`), include the path: `/apple\.com\/careers/i`.
**Warning signs:** Career guide activating on non-career pages.

### Pitfall 7: Generic Guide Shadowing Company Guides
**What goes wrong:** The existing `generic.js` career guide has broad patterns (`/\/careers\/?/i`, `/\/jobs\/?/i`) that match before company-specific guides.
**Why it happens:** `getGuideForUrl()` returns the FIRST match from `SITE_GUIDES_REGISTRY`, and generic patterns like `/\/careers/` match any career page URL.
**How to avoid:** Company-specific guides must be imported (and thus registered) BEFORE the generic guide in `background.js`. The generic guide should be a fallback, registered last among career guides.
**Warning signs:** Company career pages always showing generic guidance instead of company-specific.

## Code Examples

### Research Log Element Structure (Verified from Logs)

```javascript
// Source: Logs/fsb-research-www.amazon.jobs-2026-02-23.json
{
  "type": "input",        // HTML tag type
  "text": "",             // Visible text content (may be empty for inputs)
  "id": "search_typeahead-homepage",
  "class": "form-control tt-input",
  "elementId": "combobox_search_typeahead_homepage_search_typeahea_text",
  "selectors": [
    "[role=\"combobox\"][aria-labelledby=\"search_typeahead-homepage-label\"]",
    "[aria-controls=\"search_typeahead-homepage-listbox-2stkayz\"]"
  ]
}
```

### Selector Stability Classification

```javascript
function classifySelector(selector) {
  if (selector.startsWith('#')) return 'STABLE';           // ID selector
  if (selector.startsWith('[aria-')) return 'STABLE';      // Accessibility attribute
  if (selector.startsWith('[role=')) return 'STABLE';      // ARIA role
  if (selector.startsWith('[data-')) return 'STABLE';      // Data attribute
  if (selector.startsWith('[name=')) return 'STABLE';      // Form name
  if (selector.startsWith('//')) {
    // XPath: stable if text-based, unstable if positional
    if (/normalize-space|contains\(text\(\)|contains\(\.,/.test(selector)) {
      return 'STABLE';
    }
    return 'UNSTABLE';
  }
  if (selector.startsWith('.')) {
    // Class-based: check for hashed patterns
    if (/[a-zA-Z]+-[a-f0-9]{5,}|[a-f0-9]{5,}[a-zA-Z]+|css-[a-z0-9]+|sc-[a-z0-9]+/.test(selector)) {
      return 'UNSTABLE';
    }
    return 'MODERATE';
  }
  return 'MODERATE';
}
```

### Generated Guide File Example

```javascript
// Machine-generated from fsb-research-careers.microsoft.com-2026-02-23.json
registerSiteGuide({
  site: 'Microsoft',
  category: 'Career & Job Search',
  confidence: 'HIGH',
  careerUrl: 'https://careers.microsoft.com/',
  patterns: [
    /careers\.microsoft\.com/i
  ],
  selectors: {
    searchButton: '[aria-label="Search jobs"], #search',
    findJobsButton: '#find-jobs-btn',
    jobInput: '#job, [name="job"]',
    locationInput: '#location',
    locationFilter: 'input[type="text"][placeholder*="City"]'
  },
  workflows: {
    searchJobs: [
      'Navigate to https://careers.microsoft.com/',
      'Enter job keywords in the job input field',
      'Enter location in the location filter',
      'Click Find jobs button',
      'Scan job listings for relevant positions',
      'Click into each job for details'
    ]
  },
  warnings: [
    'Uses custom career platform (not standard ATS)',
    'Some selectors flagged as UNSTABLE: .ms-Button.ms-Button--default (hashed pattern)'
  ],
  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']
});
```

### ATS Detection Logic

```javascript
function detectATS(logData) {
  const fullText = JSON.stringify(logData).toLowerCase();
  const urlText = logData.pages.map(p => p.url || '').join(' ').toLowerCase();

  // URL pattern detection (highest confidence)
  if (/myworkdayjobs\.com/.test(urlText)) return 'workday';
  if (/boards\.greenhouse\.io|grnh\.se/.test(urlText)) return 'greenhouse';
  if (/jobs\.lever\.co|lever\.co\//.test(urlText)) return 'lever';
  if (/icims\.com|jobs-.*\.icims\.com/.test(urlText)) return 'icims';
  if (/taleo\.net|oracle.*taleo/.test(urlText)) return 'taleo';

  // DOM signature detection (keyword frequency)
  const workdayCount = (fullText.match(/workday/g) || []).length;
  const phenomCount = (fullText.match(/phenom/g) || []).length;
  const taleoCount = (fullText.match(/taleo/g) || []).length;
  const greenhouseCount = (fullText.match(/greenhouse/g) || []).length;

  if (workdayCount > 10) return 'workday';
  if (taleoCount > 3) return 'taleo';
  if (greenhouseCount > 3) return 'greenhouse';
  // Phenom is an experience platform, not an ATS -- note but don't map
  // phenomCount tracked for informational purposes

  return null; // Custom/unknown platform
}
```

### Updating background.js Imports

```javascript
// After existing career guide imports (line 77), add:
// ATS base guides (imported before per-company guides)
importScripts('site-guides/career/workday.js');
importScripts('site-guides/career/greenhouse.js');
importScripts('site-guides/career/lever.js');
importScripts('site-guides/career/icims.js');
importScripts('site-guides/career/taleo.js');
// Per-company career guides (alphabetical)
importScripts('site-guides/career/amazon-jobs.js');
importScripts('site-guides/career/apple.js');
importScripts('site-guides/career/att.js');
// ... etc
// Generic MUST remain last (fallback)
```

**Critical:** The generic.js import must be MOVED to the end of the career imports block so company-specific guides match first.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Category-level guides only (generic.js covers all career sites) | Per-company guides with specific selectors | Phase 9 (now) | AI gets precise selectors instead of guessing |
| Google search to find career pages | Direct career URL in guide (careerUrl field) | Phase 9 (now) | Eliminates Google search overhead, faster navigation |
| All selectors treated equally | Stability-classified selectors with warnings | Phase 9 (now) | AI knows which selectors to trust |

## Open Questions

1. **Google Search Logs -- Citi, Google Careers, AmEx**
   - What we know: 3 research logs have domain `www.google.com` and were searches for these companies' career pages. They contain Google search UI elements, not career page elements.
   - What's unclear: Whether to extract the target career URLs from the search queries and create URL-only guides for these 3 companies.
   - Recommendation: Parse the `startUrl` query parameter to extract the intended career URL (e.g., `careers.citi.com`, `careers.google.com`, `aexpcareers.com`). Generate LOW-confidence URL-only guides for these 3 companies.

2. **Qatar Airways Log**
   - What we know: `fsb-research-www.qatarairways.com-2026-02-21.json` is not a career page crawl (it's the main airline site).
   - What's unclear: Whether to include it.
   - Recommendation: Skip it entirely. Not a career company log.

3. **Google Docs Log**
   - What we know: `fsb-research-docs.google.com-2026-02-23.json` is a Google Sheets/Docs crawl, not career-related.
   - Recommendation: Skip it entirely.

4. **ATS Base Guides Content**
   - What we know: The user wants 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo). However, only Workday, Taleo, and Greenhouse have detectable presence in the current logs. Lever and iCIMS have zero detections.
   - What's unclear: What selectors to put in Lever and iCIMS base guides since no log data exists for them.
   - Recommendation: Create Lever and iCIMS base guides with well-known generic selectors from general knowledge of these platforms. Mark their confidence as MEDIUM (not data-derived). This is acceptable because the user explicitly requested all 5 ATS base guides.

5. **Phenom Platform**
   - What we know: Mr. Cooper and CVS Health use Phenom (a candidate experience platform, not a traditional ATS). Phenom was not listed as one of the 5 ATS base guides to create.
   - Recommendation: Do not create a Phenom base guide (not requested). These companies get standard per-company guides.

## Sources

### Primary (HIGH confidence)
- Direct examination of 38 research log JSON files in `Logs/` directory
- Direct examination of 4 existing career site guides (`generic.js`, `indeed.js`, `glassdoor.js`, `builtin.js`)
- Direct examination of `site-guides/index.js` (registration system)
- Direct examination of `background.js` (import pattern, lines 4-106)
- Direct examination of `lib/memory/sitemap-converter.js` (existing log parsing logic)

### Secondary (MEDIUM confidence)
- ATS detection results from keyword scanning across all log data
- Selector stability classification pattern analysis
- Hashed CSS class pattern detection across all logs

### Tertiary (LOW confidence)
- Lever and iCIMS platform selector knowledge (from training data, not log-verified)
- XPath stability heuristics (text-based vs positional classification)

## Metadata

**Confidence breakdown:**
- Log structure and format: HIGH -- directly examined multiple log files
- Existing site guide format: HIGH -- directly examined 6 guide files across categories
- Selector distribution: HIGH -- computed from all 29,173 selectors across career logs
- ATS detection: MEDIUM -- keyword-based detection; real ATS usage may differ from what's detectable in crawl data
- Career element filtering: MEDIUM -- heuristic approach; will need tuning during implementation
- Confidence scoring algorithm: MEDIUM -- proposed thresholds; may need adjustment after seeing results

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days -- log data is static, guide format is stable)
