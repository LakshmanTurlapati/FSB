---
phase: 125-remote-control
plan: 01
subsystem: ws, cdp, browser-automation
tags: [chrome-debugger, cdp, websocket, remote-control, input-dispatch]

# Dependency graph
requires:
  - phase: 122-connection-auto-start
    provides: WS client infrastructure, _streamingTabId, _streamingActive globals
  - phase: 123-layout-modes
    provides: Preview container and scaling for coordinate mapping (consumed by plan 02)
provides:
  - handleRemoteControlStart/Stop for debugger lifecycle management
  - handleRemoteClick/Key/Scroll CDP dispatch functions
  - WS message routing for dash:remote-click, dash:remote-key, dash:remote-scroll, dash:remote-control-start, dash:remote-control-stop
affects: [125-02, dashboard-remote-control-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [attach-once-detach-on-stop debugger lifecycle, global function dispatch from ws-client to background]

key-files:
  created: []
  modified: [background.js, ws/ws-client.js]

key-decisions:
  - "Debugger attached once on remote control start, detached on stop -- no per-event attach/detach overhead"
  - "Scroll events have no console logging to avoid spam from frequent wheel events"
  - "Handler functions are standalone globals in background.js, called from ws-client.js via bare function calls (matches existing pattern for _streamingActive access)"

patterns-established:
  - "Remote control debugger lifecycle: attach once via handleRemoteControlStart, detach via handleRemoteControlStop, null guard on every dispatch"
  - "CDP Input.dispatchMouseEvent for click (mousePressed + mouseReleased) and scroll (mouseWheel)"
  - "CDP Input.dispatchKeyEvent for keyDown/keyUp/char with key, code, text, modifiers"

requirements-completed: [CONTROL-01, CONTROL-02, CONTROL-03, CONTROL-04]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 125 Plan 01: Remote Control Extension-Side Summary

**WS message routing and CDP dispatch for remote click, type, and scroll events from the dashboard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T03:38:56Z
- **Completed:** 2026-03-31T03:40:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 5 remote control handler functions added to background.js (start, stop, click, key, scroll)
- Debugger lifecycle management: attach once on start, detach on stop, null guard on every dispatch
- WS message routing for all 5 dash:remote-* message types in ws-client.js
- CONTROL-04 (stop button) acknowledged as already implemented by Phase 122.2

## Task Commits

Each task was committed atomically:

1. **Task 1: Add remote control CDP dispatch functions to background.js** - `eaf3e1c` (feat)
2. **Task 2: Wire WS message routing for remote control in ws-client.js** - `261e6f4` (feat)

## Files Created/Modified
- `background.js` - Added _remoteControlDebuggerTabId state variable, handleRemoteControlStart, handleRemoteControlStop, handleRemoteClick, handleRemoteKey, handleRemoteScroll functions
- `ws/ws-client.js` - Added 5 case statements in _handleMessage switch for dash:remote-control-start, dash:remote-control-stop, dash:remote-click, dash:remote-key, dash:remote-scroll

## Decisions Made
- Debugger attached once on remote control start, detached on stop -- avoids per-event attach/detach overhead that would add latency to every click/key/scroll
- Scroll events suppress console logging since wheel events fire at 60Hz and would flood the console
- Error handling nulls _remoteControlDebuggerTabId on failure -- forces re-attach on next start (self-healing)
- CONTROL-04 not modified -- already implemented by Phase 122.2 stop button

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension-side remote control infrastructure complete
- Plan 02 (dashboard UI overlay, coordinate mapping, toggle button) can now send messages that will be handled by these handlers
- The dashboard needs to send dash:remote-control-start before sending click/key/scroll events
- Coordinate reverse-scaling (dividing by previewScale) is the dashboard's responsibility (plan 02)

## Self-Check: PASSED

- All files exist: background.js, ws/ws-client.js, 125-01-SUMMARY.md
- All commits exist: eaf3e1c, 261e6f4
- 5 handler functions in background.js, 5 message routes in ws-client.js

---
*Phase: 125-remote-control*
*Completed: 2026-03-31*
