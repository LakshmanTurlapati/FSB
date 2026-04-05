---
phase: 09-data-pipeline-foundation
plan: 02
subsystem: data-pipeline
tags: [site-guides, ats, workday, greenhouse, lever, icims, taleo, career]

requires:
  - phase: none
    provides: existing registerSiteGuide() infrastructure in site-guides/index.js
provides:
  - 5 ATS base guide files (workday.js, greenhouse.js, lever.js, icims.js, taleo.js)
  - Platform-specific selectors, workflows, and warnings for each ATS
  - ATS inheritance targets for company-specific guides (Plan 03)
affects: [09-03 parser company guide generation, 10 single-site search automation]

tech-stack:
  added: []
  patterns:
    - "ATS base guide pattern: registerSiteGuide() with ats field for platform inheritance"
    - "Confidence field: HIGH for log-verified ATS, MEDIUM for general-knowledge ATS"

key-files:
  created:
    - site-guides/career/workday.js
    - site-guides/career/greenhouse.js
    - site-guides/career/lever.js
    - site-guides/career/icims.js
    - site-guides/career/taleo.js
  modified: []

key-decisions:
  - "Workday and Greenhouse confidence set to HIGH (detected in research logs)"
  - "Lever, iCIMS, Taleo confidence set to MEDIUM (created from general platform knowledge, no log data)"
  - "Lever guide omits searchBox and pagination selectors (platform does not have these features)"
  - "Each ATS guide includes ats field for programmatic identification by company guides"

patterns-established:
  - "ATS base guide shape: site, category, confidence, ats, patterns, guidance, selectors, workflows, warnings, toolPreferences"
  - "Guidance field format: section headers (SEARCH/RESULTS/WORKFLOW) with selector references and numbered steps"

duration: 2min
completed: 2026-02-23
---

# Phase 9 Plan 02: ATS Base Guides Summary

**5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) with platform-specific selectors, workflows, and SPA/iframe/form-submission warnings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T10:49:12Z
- **Completed:** 2026-02-23T10:51:20Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Created Workday ATS guide with data-automation-id selectors and SPA/iframe warnings
- Created Greenhouse ATS guide with HTML board selectors and native select dropdown notes
- Created Lever ATS guide noting single-page listing and no search/pagination
- Created iCIMS ATS guide with form-based server-side rendering workflow
- Created Taleo ATS guide with Oracle requisition list and full-page-reload warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Workday and Greenhouse ATS base guides** - `b87ed97` (feat)
2. **Task 2: Create Lever, iCIMS, and Taleo ATS base guides** - `e82b64c` (feat)

## Files Created
- `site-guides/career/workday.js` - Workday ATS base guide (59 lines) with data-automation-id selectors
- `site-guides/career/greenhouse.js` - Greenhouse ATS base guide (58 lines) with board selectors
- `site-guides/career/lever.js` - Lever ATS base guide (55 lines) with posting selectors
- `site-guides/career/icims.js` - iCIMS ATS base guide (63 lines) with iCIMS-prefixed selectors
- `site-guides/career/taleo.js` - Taleo ATS base guide (64 lines) with requisition list selectors

## Decisions Made
- Workday and Greenhouse set to HIGH confidence since both were detected in research logs (Workday: Deloitte/CVS/Pfizer/Target; Greenhouse: Costco)
- Lever, iCIMS, Taleo set to MEDIUM confidence since they were created from general platform knowledge per user decision (no log data for these platforms)
- Lever guide intentionally omits searchBox and pagination selectors since the platform typically shows all jobs on a single page without search
- Added `ats` field to each guide for programmatic identification when company guides inherit from ATS base guides

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 ATS base guides ready for company guide inheritance in Plan 03
- background.js imports and import ordering will be handled by Plan 03 parser
- ATS detection logic in Plan 01 parser can reference these ats field values
- Generic career guide (generic.js) pattern overlap with ATS guides is expected -- import ordering ensures ATS guides match first

## Self-Check: PASSED

---
*Phase: 09-data-pipeline-foundation*
*Completed: 2026-02-23*
