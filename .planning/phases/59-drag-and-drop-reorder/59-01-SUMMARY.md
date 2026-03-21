---
phase: 59-drag-and-drop-reorder
plan: 01
subsystem: mcp-tools
tags: [drag-drop, mcp, trello, react-beautiful-dnd, site-guide, kanban]

# Dependency graph
requires:
  - phase: 58-click-and-hold-record
    provides: click_and_hold MCP tool pattern and CDP coordinate tools section structure
provides:
  - drag_drop MCP tool exposing DOM-level dragdrop with 3-method fallback (HTML5, Pointer, Mouse)
  - Trello site guide dragAndDropReorder workflow with 3-tier approach
  - Updated Trello toolPreferences with drag_drop, drag, click_at, get_dom_snapshot
affects: [59-02-PLAN live MCP test, future drag-and-drop edge cases]

# Tech tracking
tech-stack:
  added: []
  patterns: [DOM drag_drop vs CDP drag tool distinction, 3-tier fallback workflow pattern]

key-files:
  created: []
  modified:
    - mcp-server/src/tools/manual.ts
    - site-guides/productivity/trello.js

key-decisions:
  - "drag_drop placed in Interaction tools section (with click, type) not CDP section -- it uses DOM selectors not coordinates"
  - "sourceSelector/targetSelector MCP params map to sourceRef/targetRef internal params for FSB element resolution"
  - "holdMs=200 recommended for react-beautiful-dnd to recognize drag intent vs default 150"

patterns-established:
  - "DOM-level drag tools use element references; CDP drag tools use viewport coordinates -- keep them separate"
  - "3-tier fallback workflow: DOM drag_drop first, CDP drag second, UI button fallback third"

requirements-completed: [MICRO-03]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 59 Plan 01: Drag-and-Drop Reorder Summary

**drag_drop MCP tool exposing DOM-level 3-method fallback chain (HTML5 DragEvent, PointerEvent, MouseEvent) with Trello site guide 3-tier drag-and-drop reorder workflow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T10:32:26Z
- **Completed:** 2026-03-21T10:35:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Exposed existing dragdrop content action as drag_drop MCP tool with sourceSelector/targetSelector params mapping to sourceRef/targetRef
- Added Trello dragAndDropReorder workflow with 3-tier approach: DOM drag_drop (PointerEvent for rbd), CDP drag (raw mouse), Move button fallback
- Updated Trello toolPreferences with drag_drop, drag, click_at, get_dom_snapshot, read_page
- Added new selectors (lastCardInList, firstCardInList, listCards, movePositionSelect) and 3-tier warning
- MCP server builds cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose dragdrop as drag_drop MCP tool in manual.ts** - `7b90728` (feat)
2. **Task 2: Update Trello site guide with dragAndDropReorder workflow** - `aba03a8` (feat)

## Files Created/Modified
- `mcp-server/src/tools/manual.ts` - Added drag_drop server.tool with 3-method fallback description, sourceSelector/targetSelector params mapping to dragdrop FSB verb
- `site-guides/productivity/trello.js` - Added dragAndDropReorder workflow, updated moveCard STUCK line, expanded toolPreferences, added drag selectors, added 3-tier warning

## Decisions Made
- drag_drop placed in Interaction tools section (between double_click and focus) rather than CDP coordinate tools section -- it uses DOM element references, not viewport coordinates
- sourceSelector/targetSelector param names chosen to match MCP naming conventions while mapping to sourceRef/targetRef internally
- holdMs=200 recommended in Trello workflow for react-beautiful-dnd recognition time (vs default 150)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- drag_drop MCP tool ready for live testing in Plan 02
- Trello site guide dragAndDropReorder workflow ready for MCP manual execution
- 3-tier approach gives multiple fallback paths if react-beautiful-dnd blocks synthetic events

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 59-drag-and-drop-reorder*
*Completed: 2026-03-21*
