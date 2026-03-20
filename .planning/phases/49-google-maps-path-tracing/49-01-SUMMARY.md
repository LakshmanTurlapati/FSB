---
phase: 49-google-maps-path-tracing
plan: 01
subsystem: mcp
tags: [cdp, mouseWheel, scroll, google-maps, canvas-zoom, mcp-tools]

requires:
  - phase: 48-excalidraw-edge-cases
    provides: CDP click_at and drag tools with modifier key support
provides:
  - scroll_at MCP tool for coordinate-targeted wheel events
  - cdpScrollAt content script relay
  - handleCDPMouseWheel background CDP handler
affects: [49-02, google-maps, canvas-apps, map-zoom]

tech-stack:
  added: []
  patterns:
    - "CDP mouseWheel dispatch via Input.dispatchMouseEvent type mouseWheel"

key-files:
  created: []
  modified:
    - background.js
    - content/actions.js
    - mcp-server/src/tools/manual.ts

key-decisions:
  - "Follow existing click_at/drag CDP pattern for mouseWheel (attach/sendCommand/detach)"
  - "Default deltaY=-120 (one tick zoom in) matching standard wheel event convention"

patterns-established:
  - "CDP mouseWheel pattern: same attach/dispatch/detach as click and drag"

requirements-completed: [CANVAS-03]

duration: 2min
completed: 2026-03-20
---

# Phase 49 Plan 01: scroll_at MCP Tool Summary

**CDP mouseWheel tool for coordinate-targeted zoom on Google Maps and canvas apps, dispatching trusted Input.dispatchMouseEvent at specific viewport coordinates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T21:05:46Z
- **Completed:** 2026-03-20T21:08:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added handleCDPMouseWheel background handler following the established click/drag CDP pattern
- Added cdpScrollAt content script relay with chrome.runtime.sendMessage to background
- Registered scroll_at MCP tool with x, y, deltaY, deltaX parameters wired to cdpScrollAt

## Task Commits

Each task was committed atomically:

1. **Task 1: Add handleCDPMouseWheel background handler and cdpScrollAt content relay** - `c02483e` (feat)
2. **Task 2: Register scroll_at MCP tool in manual.ts** - `06818c9` (feat)

## Files Created/Modified
- `background.js` - Added handleCDPMouseWheel function and cdpMouseWheel message routing case
- `content/actions.js` - Added cdpScrollAt tool relay function
- `mcp-server/src/tools/manual.ts` - Registered scroll_at MCP tool with Zod schema

## Decisions Made
- Followed existing click_at/drag CDP pattern exactly (attach/sendCommand/detach) for consistency
- Default deltaY=-120 matches standard browser wheel event convention (negative = scroll up / zoom in)
- No modifier key support needed for scroll_at (unlike click_at/drag which need shift/ctrl/alt)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- scroll_at tool is registered and ready for use in 49-02 (Google Maps path tracing test)
- Full chain verified: MCP scroll_at -> execAction -> cdpScrollAt (content) -> cdpMouseWheel (message) -> handleCDPMouseWheel (background) -> CDP Input.dispatchMouseEvent mouseWheel

---
*Phase: 49-google-maps-path-tracing*
*Completed: 2026-03-20*
