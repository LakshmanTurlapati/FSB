---
phase: 122-connection-auto-start
plan: 01
subsystem: streaming
tags: [websocket, dom-stream, chrome-tabs, active-tab-tracking, service-worker]

# Dependency graph
requires:
  - phase: 44-dom-cloning-stream
    provides: DOM serialization, mutation streaming, ws-client forwarding infrastructure
provides:
  - "_streamingTabId global for always-on tab tracking"
  - "_streamingActive flag for dashboard stream lifecycle"
  - "chrome.tabs.onActivated listener with 300ms debounce for tab switch re-targeting"
  - "_handleStreamTabSwitch function for stream handoff between tabs"
  - "domStreamReady message handler for content script page-ready signals"
  - "Stream survives task completion (decoupled from broadcastDashboardComplete)"
affects: [122-02, 123-layout-modes, 124-visual-fidelity, 125-remote-control]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always-on streaming with _streamingActive gate on tab switch handler"
    - "_streamingTabId > _dashboardTaskTabId > active tab query fallback chain"
    - "300ms debounce on tab activation to prevent rapid-fire snapshots"
    - "URL regex filter for restricted pages (chrome://, about://, edge://, brave://, chrome-extension://)"

key-files:
  created: []
  modified:
    - background.js
    - ws/ws-client.js

key-decisions:
  - "Stream decoupled from task lifecycle: broadcastDashboardComplete no longer stops stream"
  - "Tab switch uses 300ms debounce to avoid rapid-fire snapshots during quick tab cycling"
  - "Restricted URL regex filters chrome/about/edge/brave/chrome-extension protocols"
  - "domStreamReady message auto-starts stream if _streamingActive is true"
  - "Pause does not clear _streamingActive (paused is still conceptually active)"

patterns-established:
  - "_streamingTabId as the canonical tab for DOM stream forwarding"
  - "ext:stream-tab-info WS message for dashboard tab change notifications"
  - "ext:page-ready WS message for content script load signals"

requirements-completed: [CONN-01, CONN-02, CONN-03]

# Metrics
duration: 2min
completed: 2026-03-29
---

# Phase 122 Plan 01: Connection Auto-Start (Extension Side) Summary

**Always-on DOM stream tracking via chrome.tabs.onActivated with 300ms debounce, _streamingTabId priority chain in ws-client, and stream decoupled from task lifecycle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T11:48:01Z
- **Completed:** 2026-03-29T11:49:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Active tab tracking installed via chrome.tabs.onActivated with 300ms debounce to prevent rapid-fire snapshots
- Tab switches send domStreamStop to old tab and domStreamStart to new tab, with URL validation filtering restricted pages
- Task completion no longer tears down the DOM stream (broadcastDashboardComplete decoupled)
- _forwardToContentScript uses _streamingTabId > _dashboardTaskTabId > active tab query fallback chain
- _streamingActive flag managed by dash:dom-stream-start/stop messages (pause does not clear it)
- domStreamReady handler auto-starts stream on content script page load when streaming is active

## Task Commits

Each task was committed atomically:

1. **Task 1: Add active-tab tracking and stream-aware tab switching in background.js** - `bd466b8` (feat)
2. **Task 2: Update ws-client.js to use _streamingTabId and manage _streamingActive flag** - `2ce2f27` (feat)

## Files Created/Modified
- `background.js` - Added _streamingTabId/_streamingActive globals, chrome.tabs.onActivated listener, _handleStreamTabSwitch function, domStreamReady case handler; removed domStreamStop from broadcastDashboardComplete
- `ws/ws-client.js` - Updated _forwardToContentScript to prefer _streamingTabId; added _streamingActive flag management in dom-stream-start/stop cases

## Decisions Made
- Stream decoupled from task lifecycle: broadcastDashboardComplete no longer calls domStreamStop, allowing the dashboard preview to stay live between tasks
- 300ms debounce on tab switch prevents rapid-fire snapshots during quick tab cycling
- Restricted URL regex `/^(chrome|about|edge|brave|chrome-extension):/` filters non-streamable pages and sends a not-ready signal to dashboard instead
- domStreamReady from content scripts auto-starts stream if _streamingActive is true, enabling automatic stream recovery after page navigation
- Pause does not clear _streamingActive because paused is still conceptually active (gray state per CONTEXT.md toggle decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension-side always-on streaming is complete
- Ready for 122-02: Dashboard auto-start on page-ready signal, toggle button, recovery logic, status badge
- _streamingTabId and _streamingActive globals are available for ws-client.js and background.js consumers
- ext:stream-tab-info and ext:page-ready WS messages are being sent, ready for dashboard to handle

## Self-Check: PASSED

- FOUND: .planning/phases/122-connection-auto-start/122-01-SUMMARY.md
- FOUND: background.js (modified)
- FOUND: ws/ws-client.js (modified)
- FOUND: commit bd466b8 (Task 1)
- FOUND: commit 2ce2f27 (Task 2)

---
*Phase: 122-connection-auto-start*
*Completed: 2026-03-29*
