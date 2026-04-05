---
phase: 09-data-pipeline-foundation
plan: 01
subsystem: data-pipeline
tags: [node-script, json-parsing, selector-classification, ats-detection, site-guides]

# Dependency graph
requires:
  - phase: none
    provides: Research logs in Logs/ directory and existing site-guides infrastructure
provides:
  - scripts/parse-research-logs.js -- build-time parser that reads research logs and generates career guides
  - 36 per-company career site guide files in site-guides/career/
  - Confidence scores (HIGH/MEDIUM/LOW) for each company guide
  - ATS platform detection (workday for Deloitte, CVS Health, Pfizer)
affects: [09-02 (background.js imports), 09-03 (audit existing guides), 10 (single-site automation)]

# Tech tracking
tech-stack:
  added: []
  patterns: [build-time-parser, selector-stability-classification, ats-auto-detection, confidence-scoring]

key-files:
  created:
    - scripts/parse-research-logs.js
    - site-guides/career/microsoft.js
    - site-guides/career/amazon.js
    - site-guides/career/boeing.js
    - site-guides/career/deloitte.js
    - site-guides/career/tesla.js
    - site-guides/career/walmart.js
    - site-guides/career/citi.js
    - site-guides/career/amex.js
    - site-guides/career/google-careers.js
    - (and 26 more per-company guide files)
  modified: []

key-decisions:
  - "Keyword heuristic categorization for career elements (searchBox, locationFilter, departmentFilter, jobCards, jobTitle, applyButton, pagination, resultsContainer, cookieDismiss)"
  - "Selector stability sorted: STABLE first (id, aria, role, data-*, name, text-based XPath), then MODERATE (semantic classes), then UNSTABLE (hashed classes, positional XPath)"
  - "Domain pattern specificity: career-specific subdomains (careers.X.com) match broadly, general domains (apple.com) include career path to avoid false matches"
  - "Google search logs parsed for combobox text field to extract career URLs for Citi, Google Careers, and AmEx"

patterns-established:
  - "Build-time parser pattern: Node.js script reads data, generates static JS assets"
  - "Confidence scoring: coverage (0-8 categories) x stability ratio determines HIGH/MEDIUM/LOW"
  - "LOW-confidence guide format: minimal guide with careerUrl and generic fallback reference"

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 9 Plan 1: Research Log Parser Summary

**Node.js build-time parser (1000 lines) that reads 38 research logs, extracts career-relevant elements, classifies selector stability, detects ATS platforms, and generates 36 per-company registerSiteGuide() career guides**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T10:48:18Z
- **Completed:** 2026-02-23T10:51:30Z
- **Tasks:** 1
- **Files created:** 37 (1 script + 36 guide files)

## Accomplishments
- Created comprehensive parser script at scripts/parse-research-logs.js (1000 lines, no external deps)
- Generated 36 career site guides: 30 HIGH confidence, 1 MEDIUM, 5 LOW
- ATS detection identified Workday usage at Deloitte, CVS Health, and Pfizer
- Google search logs correctly parsed to extract career URLs for Citi, Google Careers, and AmEx
- Tesla and Walmart correctly produced LOW-confidence URL-only guides
- Non-career logs (Google Docs, Qatar Airways) correctly skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the research log parser script** - `65c6792` (feat)

## Files Created/Modified
- `scripts/parse-research-logs.js` - Build-time parser: scan, group, parse, filter, classify, detect ATS, score confidence, generate guides
- `site-guides/career/microsoft.js` - HIGH confidence, 166 selectors, 5 categories
- `site-guides/career/amazon.js` - HIGH confidence, 108 selectors, 5 categories
- `site-guides/career/boeing.js` - HIGH confidence, 342 selectors, 6 categories
- `site-guides/career/deloitte.js` - HIGH confidence, ATS:workday, 32 selectors, 5 categories
- `site-guides/career/cvshealth.js` - HIGH confidence, ATS:workday, 60 selectors, 5 categories
- `site-guides/career/pfizer.js` - HIGH confidence, ATS:workday, 18 selectors, 4 categories
- `site-guides/career/tesla.js` - LOW confidence, URL-only guide
- `site-guides/career/walmart.js` - LOW confidence, URL-only guide
- `site-guides/career/citi.js` - LOW confidence, URL-only (from Google search log)
- `site-guides/career/amex.js` - LOW confidence, URL-only (from Google search log)
- `site-guides/career/google-careers.js` - LOW confidence, URL-only (from Google search log)
- (and 25 more company guide files)

## Decisions Made
- Used keyword heuristics for career element categorization rather than ML or manual mapping. 9 categories cover the career workflow: searchBox, locationFilter, departmentFilter, jobCards, jobTitle, applyButton, pagination, resultsContainer, cookieDismiss
- Selector stability classification: 3 tiers (STABLE/MODERATE/UNSTABLE) with XPath sub-classification for text-based vs positional
- Domain pattern matching uses career-specific paths for general domains (apple.com/careers) to prevent false activation on non-career pages
- Confidence thresholds: HIGH requires 4+ categories AND 50%+ stable selectors; MEDIUM requires 2+ categories; LOW is everything else
- ATS detection uses both URL pattern matching (highest priority) and DOM keyword frequency (>10 occurrences)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- 36 company guide files ready in site-guides/career/ for background.js import registration (Plan 02/03)
- ATS base guides (workday.js, greenhouse.js, lever.js, icims.js, taleo.js) already exist from prior work
- Existing 4 career guides (generic.js, indeed.js, glassdoor.js, builtin.js) remain unchanged, ready for audit (Plan 03)
- Parser is idempotent -- can be re-run as research logs are updated

## Self-Check: PASSED

---
*Phase: 09-data-pipeline-foundation*
*Completed: 2026-02-23*
