---
phase: 30-productivity-site-intelligence
plan: 02
subsystem: site-guides
tags: [google-keep, todoist, fsbElements, keyboard-shortcuts, productivity]

# Dependency graph
requires:
  - phase: 30-01
    provides: generalized fsbElements injection pipeline, keyword matching for all apps
provides:
  - Google Keep site guide with 16 fsbElements, 8 workflows, 12 warnings
  - Todoist site guide with 18 fsbElements, 8 workflows, 14 warnings
  - Quick Add natural language syntax documentation (#project @label p1-p4 dates)
affects: [30-03, 30-04, 30-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [aria-first selector ordering for standard DOM apps, VERIFY/STUCK workflow pattern]

key-files:
  created:
    - site-guides/productivity/google-keep.js
    - site-guides/productivity/todoist.js
  modified: []

key-decisions:
  - "aria/role-first selector strategy for both Keep and Todoist (standard DOM, good ARIA support)"
  - "Quick Add documented as THE primary Todoist task creation method with full natural language syntax"
  - "Prominent single-key shortcut hazard warning in Todoist guidance and warnings"

patterns-established:
  - "VERIFY/STUCK pattern: every workflow ends with VERIFY (how to confirm success) and STUCK (fallback recovery)"
  - "Keyboard-first guidance: shortcuts listed as primary method, click as fallback"

requirements-completed: [KEEP-01, KEEP-02, TODO-01, TODO-02]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 30 Plan 02: Google Keep and Todoist Site Guides Summary

**Full site guides for Google Keep (373 lines) and Todoist (458 lines) with keyboard-first workflows, 5-strategy fsbElements, and Quick Add natural language syntax documentation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T08:57:52Z
- **Completed:** 2026-03-16T09:02:21Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Google Keep site guide with 16 fsbElements, 8 detailed workflows (createNote, createChecklist, pinNote, archiveNote, deleteNote, addLabel, searchNotes, editNote), and 12 app-specific warnings
- Todoist site guide with 18 fsbElements, 8 detailed workflows (quickAddTask, completeTask, editTask, organizeByProject, setPriority, setDueDate, searchTasks, navigateViews), and 14 warnings
- Todoist Quick Add natural language syntax fully documented: #project @label p1-p4 date/time/duration phrases with left-to-right parsing order
- Single-key shortcut interception hazard prominently warned in Todoist guidance, workflows, and warnings array

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Google Keep site guide** - `e30de72` (feat)
2. **Task 2: Create Todoist site guide** - `8e6b636` (feat)

## Files Created/Modified
- `site-guides/productivity/google-keep.js` - Google Keep site guide (373 lines): fsbElements, guidance, workflows, warnings, selectors, toolPreferences
- `site-guides/productivity/todoist.js` - Todoist site guide (458 lines): fsbElements, guidance, workflows, warnings, selectors, toolPreferences

## Decisions Made
- Used aria/role-first selector strategy for both apps since they use standard DOM with descriptive ARIA labels (no hashed CSS)
- Documented Todoist Quick Add as THE primary creation method, with inline add (A shortcut) as secondary
- Made single-key shortcut hazard the most prominent warning in Todoist guide with ASCII-art emphasis box in guidance text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both simple-tier guides complete, validating the site guide file structure pattern
- Ready for Wave 3: medium-complexity apps (Trello, Google Calendar) which add modal/popover workflows
- The VERIFY/STUCK workflow pattern established here should be replicated in all future guides

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 30-productivity-site-intelligence*
*Completed: 2026-03-16*
