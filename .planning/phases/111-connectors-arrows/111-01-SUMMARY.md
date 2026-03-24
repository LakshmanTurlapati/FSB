---
phase: 111-connectors-arrows
plan: 01
subsystem: site-guides
tags: [excalidraw, arrows, connectors, cdp, canvas]

# Dependency graph
requires:
  - phase: 110-element-editing
    provides: Element editing workflows and guidance in Excalidraw site guide
provides:
  - CONNECTORS AND ARROWS guidance section with 4 subsections
  - 4 workflow arrays (arrowBindToShapes, elbowRouting, changeArrowhead, labelArrow)
  - Edge coordinate formula for reliable arrow auto-binding
affects: [112-styling-layout, 114-natural-language-diagrams]

# Tech tracking
tech-stack:
  added: []
  patterns: [edge-coordinate targeting for arrow binding, properties panel interaction for routing/arrowhead changes]

key-files:
  created: []
  modified: [site-guides/design/excalidraw.js]

key-decisions:
  - "Edge coordinate formula documented inline for AI to calculate arrow start/end points from shape position and size"
  - "Arrow label workflow reuses same transient textarea pattern as shape text entry (TEXT-02/TEXT-03)"

patterns-established:
  - "Edge-coordinate targeting: arrows bind to shape edges via formula right-edge=(x+w, y+h/2) etc., not shape centers"
  - "Properties panel interaction: select element first, then click DOM buttons in properties panel for routing/arrowhead changes"

requirements-completed: [CONN-01, CONN-02, CONN-03, CONN-04]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 111 Plan 01: Connectors & Arrows Summary

**Arrow binding with edge-coordinate targeting, elbow routing, 5 arrowhead styles, and labeled connector workflows added to Excalidraw site guide**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T07:29:15Z
- **Completed:** 2026-03-24T07:31:15Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added CONNECTORS AND ARROWS guidance section with 4 subsections covering arrow binding, elbow routing, arrowhead styles, and labeled arrows
- Added 4 workflow arrays (arrowBindToShapes, elbowRouting, changeArrowhead, labelArrow) to the workflows object
- Added 2 warnings for edge-coordinate targeting and arrow label textarea usage
- Documented edge coordinate formula for reliable auto-binding (endpoints within ~5px of shape boundary)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CONNECTORS AND ARROWS guidance section and workflow arrays** - `bf04f50` (feat)

## Files Created/Modified
- `site-guides/design/excalidraw.js` - Added CONNECTORS AND ARROWS guidance section between ELEMENT EDITING and CANVAS ELEMENT, 4 workflow arrays, and 2 warnings

## Decisions Made
- Edge coordinate formula documented inline so AI can calculate arrow start/end points from shape position and size without external reference
- Arrow label workflow reuses the same transient textarea pattern as shape text entry (TEXT-02/TEXT-03), maintaining consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Connectors and arrows guidance complete, ready for Phase 112 (Styling & Layout)
- All 4 CONN requirements satisfied (CONN-01 through CONN-04)

---
*Phase: 111-connectors-arrows*
*Completed: 2026-03-24*
