---
phase: 10-career-search-core
plan: 01
subsystem: site-guide-lookup
tags: [company-lookup, alias-map, NLP-extraction, cookie-dismissal, error-templates]

requires:
  - phase: 09
    provides: 40+ career site guides with .site values and careerUrl fields
provides:
  - getGuideByCompanyName() function for company-to-guide resolution
  - extractCompanyFromTask() function for NLP company name extraction
  - Enhanced category guidance with cookie dismissal and error reporting
affects:
  - 10-02 (career prompt refinement consumes getGuideByCompanyName)
  - 10-03 (guide injection into AI prompt uses extractCompanyFromTask + getGuideByCompanyName)

tech-stack:
  added: []
  patterns:
    - Alias map pattern for canonical name resolution
    - Multi-strategy regex matching for NLP extraction (at/suffix/for/on patterns)
    - Prioritized guidance sections (cookie first, then strategy, then errors)

key-files:
  created: []
  modified:
    - site-guides/index.js
    - site-guides/career/_shared.js

key-decisions:
  - "38 alias entries covering all companies with common abbreviations/alternate names"
  - "Alias targets validated against actual .site values in career guide files (not assumed from research)"
  - "Research file had incorrect alias targets (JP Morgan Chase, J&J, Amex, TI) -- corrected to actual values (JPMorgan Chase, Johnson & Johnson, American Express, Texas Instruments)"
  - "extractCompanyFromTask uses last-occurrence 'at' matching to handle 'search for openings at Goldman Sachs' correctly"
  - "Pattern 3 (for) checks first word against non-company-words to avoid 'for software jobs' false match"

duration: 4min
completed: 2026-02-23
---

# Phase 10 Plan 01: Company Name Lookup and Category Guidance Enhancement Summary

**Added getGuideByCompanyName() with 38-entry alias map and extractCompanyFromTask() with 4-pattern NLP extraction, plus cookie-first category guidance and structured error reporting templates.**

## Performance
- **Duration:** ~4.5 minutes
- **Started:** 2026-02-23T12:44:39Z
- **Completed:** 2026-02-23T12:49:12Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Added `COMPANY_ALIASES` constant with 38 entries mapping common company names/abbreviations to exact `.site` values
- Added `getGuideByCompanyName()` with 3-tier matching: alias lookup, direct case-insensitive match, partial match
- Added `extractCompanyFromTask()` with 4 NLP patterns: "at [Company]", "[Company] jobs", "for [Company]", "on [Company]"
- All alias targets verified against actual career guide `.site` values (corrected 4 errors from research file)
- Added COOKIE BANNER DISMISSAL as first priority in category guidance
- Added ERROR REPORTING section with structured templates for no-results, auth-wall, page-error, no-guide
- Added 2 new warnings for cookie blocking and silent failure prevention

## Task Commits
1. **Task 1: Add getGuideByCompanyName() to site-guides/index.js** - `fdf0503` (feat)
2. **Task 2: Enhance _shared.js with cookie banner dismissal and error templates** - `ed1f8bf` (feat)

## Files Created/Modified
- `site-guides/index.js` - Added COMPANY_ALIASES, getGuideByCompanyName(), extractCompanyFromTask() (+157 lines)
- `site-guides/career/_shared.js` - Added cookie dismissal section, error reporting section, 2 new warnings (+18 lines)

## Decisions Made
1. **Corrected alias targets from research**: Research file had `JP Morgan Chase` (space), `J&J`, `Amex`, `TI` as alias targets. Actual `.site` values are `JPMorgan Chase` (no space), `Johnson & Johnson`, `American Express`, `Texas Instruments`. Fixed all before implementation.
2. **Last-occurrence "at" matching**: `extractCompanyFromTask` uses the LAST "at [X]" match in the string to correctly handle "search for openings at Goldman Sachs" (takes "Goldman Sachs", not "openings").
3. **First-word filter for "for" pattern**: Pattern 3 checks only the first word of the match against non-company-words to reject "for software jobs" while accepting "for Microsoft".
4. **Added Lowe's aliases**: Included `lowes` and `lowe's` mapping to `Lowe's` (with proper apostrophe handling via double-quoted strings).
5. **38 aliases total**: Went beyond the plan's minimum of 15 entries to cover all companies with commonly used abbreviations.

## Deviations from Plan
### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extractCompanyFromTask regex false matches**
- **Found during:** Task 1 testing
- **Issue:** Initial regex matched "for openings" in "search for openings at Goldman Sachs" as the company, and "roles at AT&T" as a full match for "look for roles at AT&T"
- **Fix:** Changed to last-occurrence "at" matching and first-word non-company-word filtering
- **Files modified:** site-guides/index.js
- **Commit:** fdf0503

**2. [Rule 1 - Bug] Fixed research alias targets not matching actual .site values**
- **Found during:** Task 1 implementation
- **Issue:** Research file COMPANY_ALIASES had 4 incorrect targets (JP Morgan Chase, J&J, Amex, TI) that would not match any registered career guide
- **Fix:** Cross-referenced all alias targets against actual `.site` values from career guide files
- **Files modified:** site-guides/index.js
- **Commit:** fdf0503

## Issues Encountered
None

## Next Phase Readiness
Plan 10-01 provides the two core functions needed by Plans 10-02 and 10-03:
- `getGuideByCompanyName()` is ready for consumption by `_buildTaskGuidance()` in Plan 10-03
- `extractCompanyFromTask()` is ready for consumption by `buildPrompt()` in Plan 10-03
- Enhanced category guidance will be automatically injected into all career task prompts

## Self-Check: PASSED
