---
phase: 37-smart-progress-eta
plan: 02
subsystem: ui
tags: [progress-tracking, eta, multi-site, google-sheets, workflow]

requires:
  - phase: 37-smart-progress-eta plan 01
    provides: phase-weighted calculateProgress with detectTaskPhase and formatETA
provides:
  - calculateMultiSiteProgress function (company-based progress with per-company ETA)
  - calculateSheetsProgress function (row-based data entry progress, iteration-based formatting progress)
  - Automatic delegation from calculateProgress to workflow-specific functions
affects: [overlay-ux, progress-display]

tech-stack:
  added: []
  patterns: [workflow-specific progress delegation, compound progress (within-company + across-companies)]

key-files:
  created: []
  modified: [background.js]

key-decisions:
  - "Delegation pattern in calculateProgress avoids changing every sendSessionStatus call site"
  - "Multi-site progress combines completed companies + within-company iteration fraction"
  - "Sheets formatting uses iteration-based progress since row count is irrelevant during formatting"

patterns-established:
  - "Workflow delegation: calculateProgress delegates to workflow-specific functions via session property checks"
  - "Compound progress: multi-site progress = (completedIndex + withinCompanyFraction) / totalCompanies"

requirements-completed: [PROG-04]

duration: 1min
completed: 2026-03-17
---

# Phase 37 Plan 02: Workflow-Specific Progress Summary

**Multi-site and Sheets workflow-specific progress functions with company-based and row-based ETA calculations, delegated automatically from calculateProgress**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T09:04:47Z
- **Completed:** 2026-03-17T09:06:02Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added calculateMultiSiteProgress: progress = (completedCompanies + currentCompanyFraction) / totalCompanies with per-company ETA
- Added calculateSheetsProgress: data entry progress = rowsWritten/totalRows with per-row ETA; formatting = iteration-based 0-100%
- Wired delegation in calculateProgress so all existing sendSessionStatus spread calls automatically get workflow-specific progress
- Added explicit progress fields (progressPercent: 0) to sheets-entry and sheets-formatting initial status calls
- Added calculateSheetsProgress spread to the sheets row-tracking sendSessionStatus call

## Task Commits

Each task was committed atomically:

1. **Task 1: Add calculateMultiSiteProgress and calculateSheetsProgress functions** - `488c360` (feat)

## Files Created/Modified
- `background.js` - Two new progress functions, delegation in calculateProgress, progress fields in sheets status calls

## Decisions Made
- Used delegation pattern in calculateProgress (checking session.multiSite / session.sheetsData) to avoid modifying every sendSessionStatus call site -- all 4 existing spread calls automatically get workflow-specific results
- Multi-site ETA uses average time per completed company extrapolated to remaining companies
- Sheets formatting progress uses iteration-based calculation since formatting has no row count concept

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow-specific progress functions ready for all multi-site and Sheets sessions
- Generic phase-weighted model preserved for standard single-site sessions
- Ready for Plan 03 (if any) or next phase

---
*Phase: 37-smart-progress-eta*
*Completed: 2026-03-17*
