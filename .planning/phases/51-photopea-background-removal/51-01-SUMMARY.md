---
phase: 51-photopea-background-removal
plan: 01
subsystem: site-guides
tags: [photopea, canvas, magic-wand, background-removal, image-editing, cdp, site-guide]

# Dependency graph
requires:
  - phase: 48-figma-frame-alignment
    provides: Excalidraw site guide pattern for canvas-based design apps
provides:
  - Photopea site guide with magic wand tool selection and background removal workflows
  - importScripts registration for photopea.js in background.js Design & Whiteboard section
affects: [51-02 live MCP test, future Photopea automation tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: [research-based site guide with canvas/DOM split interaction model]

key-files:
  created: [site-guides/design/photopea.js]
  modified: [background.js]

key-decisions:
  - "Research-based selectors for Photopea custom UI framework -- to be validated in Plan 02 live MCP test"
  - "URL hash method (photopea.com#open:URL) documented as simplest image loading path for automation"
  - "Backspace key documented instead of Delete for Mac compatibility in clearing selections"

patterns-established:
  - "Image editor site guide pattern: keyboard shortcuts for tool selection, CDP for canvas interaction, DOM for toolbar/menus"

requirements-completed: [CANVAS-05]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 51 Plan 01: Photopea Site Guide Summary

**Photopea site guide with magic wand background removal workflow, Photoshop keyboard shortcuts, and canvas/toolbar DOM split**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T22:55:05Z
- **Completed:** 2026-03-20T22:58:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created comprehensive Photopea site guide with 6 workflows (dismissSplash, loadImageViaUrl, loadSampleImage, selectMagicWand, removeBackground, invertAndDelete)
- Documented 14+ Photoshop keyboard shortcuts for tool selection and editing operations
- Registered Photopea site guide in background.js importScripts under Design & Whiteboard category alongside Excalidraw

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Photopea site guide with magic wand and background removal patterns** - `eeac267` (feat)
2. **Task 2: Register Photopea site guide in background.js** - `4a0e724` (feat)

## Files Created/Modified
- `site-guides/design/photopea.js` - Photopea site guide with canvas selectors, toolbar layout, keyboard shortcuts, Magic Wand workflow, and background removal steps
- `background.js` - Added importScripts entry for photopea.js in Design & Whiteboard section (line 148)

## Decisions Made
- **Research-based selectors:** Photopea uses a custom UI framework (not standard HTML form elements). Selectors are research-based and commented as needing live validation in Plan 02. This matches the approach taken in Phase 49 (Google Maps) and Phase 50 (Google Solitaire).
- **URL hash image loading:** Documented `photopea.com#open:IMAGE_URL` as the simplest automation path for loading images, avoiding File menu interaction complexity.
- **Mac Backspace vs Delete:** Explicitly documented that Mac Delete key is Backspace, and press_key should use "Backspace" not "Delete" for clearing selections -- this was a known gotcha from Photoshop keyboard conventions.
- **6 workflows instead of 3:** Added loadImageViaUrl and invertAndDelete workflows beyond the minimum 3 required, as these are common automation patterns for Photopea.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated that MCP tools might not be available for live DOM inspection and allowed research-based selectors with comments noting they need live validation. Selectors follow patterns consistent with Photopea's known UI structure.

## Known Stubs

None. All selectors have values (research-based, not placeholder text). All workflows have complete step sequences.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Photopea site guide is ready for Plan 02 live MCP test
- Plan 02 will validate selectors against actual Photopea DOM via get_dom_snapshot
- Plan 02 will execute the removeBackground workflow and generate CANVAS-05 diagnostic report

## Self-Check: PASSED

- FOUND: site-guides/design/photopea.js
- FOUND: .planning/phases/51-photopea-background-removal/51-01-SUMMARY.md
- FOUND: eeac267 (Task 1 commit)
- FOUND: 4a0e724 (Task 2 commit)

---
*Phase: 51-photopea-background-removal*
*Completed: 2026-03-20*
