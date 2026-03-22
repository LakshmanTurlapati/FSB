---
phase: 84-google-doc-word-replace
plan: 01
subsystem: site-guides
tags: [google-docs, canvas-rendering, word-replacement, find-toolbar, context-bloat, mcp-edge-case]

# Dependency graph
requires:
  - phase: 60-text-selection-precision
    provides: "select_text_range tool and text selection patterns (referenced in contrast -- Range API does NOT work on canvas)"
provides:
  - "manualWordReplace workflow in google-docs.js with 9-step Ctrl+F/double-click/type replacement loop"
  - "CONTEXT-08 guidance section documenting canvas rendering constraint and manual replace strategy"
  - "Context bloat mitigation pattern for multi-occurrence word replacement (under 500 chars)"
  - "4 new warnings for CONTEXT-08 constraints"
affects: [84-02-PLAN, mcp-edge-case-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Ctrl+F locate / double-click select / type replace loop for canvas-based editors"]

key-files:
  created: []
  modified: ["site-guides/productivity/google-docs.js"]

key-decisions:
  - "Ctrl+F (Find only) instead of Ctrl+H (Find and Replace) per CONTEXT-08 constraint"
  - "Double-click word selection as primary method since Range API cannot target canvas-rendered text"
  - "Find toolbar occurrence count for progress tracking instead of re-reading document text"

patterns-established:
  - "Canvas editor word replacement: locate via Find toolbar, select via double-click, replace by typing"
  - "Context bloat mitigation via browser-native search (Ctrl+F) instead of AI reading DOM"

requirements-completed: [CONTEXT-08]

# Metrics
duration: 1min
completed: 2026-03-22
---

# Phase 84 Plan 01: Google Doc Word Replace Site Guide Summary

**manualWordReplace workflow with 5-phase Ctrl+F/double-click/type strategy for canvas-based Google Docs word replacement without Find/Replace dialog**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-22T07:29:13Z
- **Completed:** 2026-03-22T07:30:58Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added CONTEXT-08 guidance section with 5-phase manual word replacement strategy (locate via Ctrl+F, select via double-click, replace by typing, find next, verify completion)
- Added manualWordReplace workflow with 9 steps covering setup through verification and reporting
- Added skip-auth expectation documentation for Google Docs editing
- Added context bloat mitigation guidance keeping replacement tracking under 500 characters
- Added 4 new warnings for CONTEXT-08 constraints (no Ctrl+H, canvas vs Range API, Find toolbar reset, occurrence count tracking)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add manualWordReplace workflow and CONTEXT-08 guidance to google-docs.js** - `49a4265` (feat)

## Files Created/Modified
- `site-guides/productivity/google-docs.js` - Added CONTEXT-08 guidance section, manualWordReplace workflow, skip-auth expectation, context bloat mitigation, and 4 new warnings (66 lines added)

## Decisions Made
- Ctrl+F (Find only) approach per CONTEXT-08 constraint -- locates words without triggering the Replace dialog
- Double-click as primary word selection method -- Range API (select_text_range) cannot operate on canvas-rendered text nodes
- Find toolbar occurrence count (e.g., "3 of 7") for progress tracking -- avoids re-reading document text and prevents context bloat

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- google-docs.js site guide updated with complete CONTEXT-08 manual word replacement intelligence
- Ready for Plan 02 live MCP test to validate the workflow against an actual Google Doc
- Expected Plan 02 outcome: SKIP-AUTH (Google account required for editing) or PARTIAL (navigation and text reading works but editing blocked)

## Self-Check: PASSED

- FOUND: site-guides/productivity/google-docs.js
- FOUND: .planning/phases/84-google-doc-word-replace/84-01-SUMMARY.md
- FOUND: commit 49a4265

---
*Phase: 84-google-doc-word-replace*
*Completed: 2026-03-22*
