---
phase: 10-career-search-core
plan: 02
subsystem: completion-validation
tags: [careerValidator, completion-scoring, search-extract, job-data-detection]

requires:
  - phase: 09
    provides: site guides with careerUrl and selectors for 40+ companies
provides:
  - careerValidator tuned for Phase 10 search+extract scope (no Sheets dependencies)
affects:
  - 10-03 (career prompt refinement relies on validator accepting search+extract completions)
  - 11 (multi-site orchestration inherits this validator)
  - 12 (Sheets data entry phase will extend validator with Sheets bonuses)

tech-stack:
  added: []
  patterns:
    - Career URL pattern matching array for site detection
    - Structured job data regex detection (JOBS FOUND, job titles, apply links)
    - Error report as valid completion signal (SEARCH-05)

key-files:
  created: []
  modified:
    - background.js

key-decisions:
  - "getText threshold lowered from 3 to 2 (search+extract needs fewer extractions than full Sheets workflow)"
  - "Error reports (NO RESULTS, AUTH REQUIRED) treated as valid completions with +0.15 bonus (SEARCH-05 requirement)"
  - "Career URL patterns use 12 common patterns covering ATS platforms and major job boards"
  - "Job title detection uses common role keyword regex rather than exact title matching"

duration: 1min
completed: 2026-02-23
---

# Phase 10 Plan 02: Career Validator Update Summary

**careerValidator rewritten for search+extract scope: career site URL detection, getText/getAttribute extraction bonuses, structured job data and error report recognition, Sheets dependencies fully removed**

## Performance
- **Duration:** ~1 minute
- **Started:** 2026-02-23T12:45:16Z
- **Completed:** 2026-02-23T12:46:34Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced Sheets-dependent careerValidator with search+extract-focused version
- Added career site URL detection using 12 common patterns (workday, greenhouse, lever, icims, taleo, indeed, glassdoor, builtin, plus generic /careers and /jobs paths)
- Added getText and getAttribute extraction action bonuses (getText >= 2: +0.1, getAttribute >= 1: +0.05)
- Added structured job data detection in AI result (JOBS FOUND pattern, job title keywords + apply URLs)
- Added error report detection as valid completion (NO RESULTS, AUTH REQUIRED, PAGE ERROR, login required) per SEARCH-05 requirement
- Added navigate+search+extract action pattern bonus (click >= 2, type >= 1, getText >= 2: +0.1)
- Maintained approval threshold at score >= 0.5 consistent with all other validators

## Task Commits
1. **Task 1: Update careerValidator for Phase 10 search+extract scope** - `e2728f0` (feat)

## Files Created/Modified
- `background.js` - Replaced careerValidator function (lines 3603-3670): removed Sheets URL check, Sheets text matching, and high type-count threshold; added career URL patterns, extraction action bonuses, structured job data detection, error report recognition, and action pattern bonus

## Decisions Made
1. getText threshold lowered from 3 to 2 -- search+extract workflows need fewer getText calls than the full career-to-Sheets workflow that included Sheets data verification
2. Error reports treated as valid completions (+0.15 bonus) -- SEARCH-05 requires explicit error reporting; a "NO RESULTS" or "AUTH REQUIRED" response is a successful task completion, not a failure
3. Career URL patterns include 12 entries covering ATS platforms (Workday, Greenhouse, Lever, iCIMS, Taleo) and job boards (Indeed, Glassdoor, BuiltIn) plus generic /careers and /jobs path patterns
4. Job title detection uses keyword regex (engineer, manager, analyst, etc.) rather than exact matching -- broad enough to catch most job titles without false positives on non-job content

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
Ready for 10-03 (career prompt refinement + company-name guide injection wiring). The validator now correctly accepts search+extract completions, so career tasks will not hit max iterations when the AI successfully extracts job data or reports errors.

## Self-Check: PASSED
